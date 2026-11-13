#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/var/www/davelopment-booking"
PM2_NAME="davelopment-booking"

# ── Biztonsági zár: csak a booking app mappájában futhat ──────────────────────
cd "$DEPLOY_DIR"
if [ "$(pwd)" != "$DEPLOY_DIR" ]; then
  echo "❌ BIZTONSÁGI HIBA: rossz mappa ($(pwd)). Leállítva — davelopment.hu érintetlen."
  exit 1
fi
# PM2 ellenőrzés: a process létezik-e és booking-hoz tartozik
if ! pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  echo "❌ BIZTONSÁGI HIBA: '$PM2_NAME' PM2 process nem található. Leállítva."
  exit 1
fi

# ── Szerver-szintű deploy-zár ─────────────────────────────────────────────────
# A davelopment.hu ugyanezen a VPS-en (4 GB RAM) deployol — ha a két deploy egyszerre fut, a booking buildje (3 GB
# heap) mellett a szerver swapol, és az élő oldalak lelassulnak. A közös zárral a második megvárja az elsőt
# (a davelopment.hu ship-it.yml-je ugyanezt a fájlt zárolja).
exec 9>/tmp/vps-deploy.lock
echo "→ Deploy-zár..."
flock -w 1800 9 || { echo "❌ A deploy-zár 30 percen belül nem szabadult fel. Leállítva."; exit 1; }

# ── Node 22 ──────────────────────────────────────────────────────────────────
export NVM_DIR="$DEPLOY_DIR/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
echo "→ Node: $(node -v)"

# ── Rollback-pont mentése ─────────────────────────────────────────────────────
ROLLBACK_HASH=$(git rev-parse HEAD)
echo "→ Rollback pont: $ROLLBACK_HASH"

# ── Két váltakozó build-mappa — „blue-green deploy” (.next-blue / .next-green) ─────────────────────────────
# A futó app az AKTÍV mappából szolgál ki, az új build a MÁSIKBA megy, és csak a kész build után indul át rá az app
# (NEXT_DIST_DIR, ld. next.config.ts). Korábban a build a futó app `.next`-jét írta felül, és a build percei alatt
# az oldalak egy része 500-at adott. Átnevezni nem lehet: a Next a mappa nevét beleégeti a buildbe.
# Az előző build a másik mappában megmarad → a visszaállás egy újraindítás, újrabuildelés nélkül.
ACTIVE=$(cat .next-active 2>/dev/null || echo ".next")
if [ "$ACTIVE" = ".next-blue" ]; then NEXT_BUILD=".next-green"; else NEXT_BUILD=".next-blue"; fi
echo "→ Aktív build: $ACTIVE · az új ide készül: $NEXT_BUILD"
APP_PORT=$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"' || true)
APP_PORT=${APP_PORT:-3001}

# ── Hibakezelő: automatikus rollback ─────────────────────────────────────────
# A build / migráció hibájánál az app még a régi mappán fut, így elég a kódot visszaállítani.
rollback() {
  echo ""
  echo "❌ Deploy sikertelen — a kód visszaáll, a régi build fut tovább ($ACTIVE)."
  git checkout -- tsconfig.json 2>/dev/null || true
  git reset --hard "$ROLLBACK_HASH"
  exit 1
}
trap rollback ERR

# ── 1. Pull ───────────────────────────────────────────────────────────────────
echo "→ git pull..."
# a build a tsconfig.json-be beírja a saját mappáját — ne akassza el a pullt
git checkout -- package-lock.json tsconfig.json
git pull origin main

# ── 2. Install (csak ha package.json változott) ───────────────────────────────
if git diff "$ROLLBACK_HASH" HEAD -- package.json | grep -q .; then
  echo "→ npm install (package.json változott)..."
  npm install --cache "$DEPLOY_DIR/.npm-cache"
fi

# ── 3. Migráció (a build ELŐTT!) ──────────────────────────────────────────────
# A `next build` statikus/SSG oldalai már az ÚJ kód elvárásai szerint kérdezik le a DB-t
# (pl. új mezők a főoldalon) — ha a séma még a régi, a build hibázik, pedig a migráció
# maga hibátlan lenne. Ezért a migráció megelőzi a buildet, nem fordítva.
# FONTOS a migrációkat író/generáló oldalon: amíg ez fut, a RÉGI kód még kiszolgál
# forgalmat — egy migráció, ami egy még AKTÍVAN használt oszlopot DROP-ol, ronthatja a
# régi verziót ez alatt a pár perc alatt. Új mezőt/táblát mindig bátran adj hozzá; egy
# már kivezetett mező tényleges DROP-ját inkább egy KÉSŐBBI, külön migrációba tedd, csak
# miután az őt már nem használó kód biztosan él éles környezetben (expand-contract minta).
echo "→ Migrációk..."
npx tsx scripts/migrate.ts

# ── 4. Build — a MÁSIK mappába, a régi verzió közben zavartalanul fut ───────
echo "→ Build ($NEXT_BUILD)..."
rm -rf "$NEXT_BUILD"
# alacsonyabb CPU/IO-prioritással: build közben az élő oldalak (booking, davelopment.hu) kapják a gépet
NEXT_DIST_DIR="$NEXT_BUILD" NODE_OPTIONS="--max-old-space-size=3072" nice -n 10 ionice -c3 npm run build
git checkout -- tsconfig.json

# ── 5. Átváltás az új buildre ────────────────────────────────────────────────
trap - ERR
echo "→ Reload az új buildre..."
NEXT_DIST_DIR="$NEXT_BUILD" pm2 reload "$PM2_NAME" --update-env

# ellenőrzés: ha az új build nem válaszol, vissza a régire (az még megvan a lemezen)
ok=""
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$APP_PORT/" || true)
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "❌ Az új build nem válaszol (HTTP $code) — vissza a régire ($ACTIVE)..."
  if [ "$ACTIVE" = ".next" ]; then NEXT_DIST_DIR= pm2 reload "$PM2_NAME" --update-env; else NEXT_DIST_DIR="$ACTIVE" pm2 reload "$PM2_NAME" --update-env; fi
  git reset --hard "$ROLLBACK_HASH"
  exit 1
fi

echo "$NEXT_BUILD" > .next-active
pm2 save > /dev/null
# régi maradékok (az első átálláskor: a régi `.next` és mentése) — a másik váltakozó mappa megmarad visszaállásnak
rm -rf .next-rollback
if [ "$ACTIVE" = ".next" ]; then rm -rf .next; fi

echo ""
echo "✅ Deploy kész ($NEXT_BUILD)."
pm2 list
