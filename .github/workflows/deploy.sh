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

# Előző .next build mentése — rollbacknél nem kell újrabuildelni
rm -rf .next-rollback
cp -r .next .next-rollback 2>/dev/null || echo "   (nincs előző build, folytatjuk)"

# ── Hibakezelő: automatikus rollback ─────────────────────────────────────────
rollback() {
  echo ""
  echo "❌ Deploy sikertelen — visszaállás az előző verzióra..."
  git reset --hard "$ROLLBACK_HASH"
  if [ -d ".next-rollback" ]; then
    rm -rf .next
    mv .next-rollback .next
    pm2 restart "$PM2_NAME" --update-env
    echo "✅ Rollback kész. Az előző verzió fut."
  else
    echo "⚠️  Nincs mentett build — manuális beavatkozás szükséges."
  fi
  exit 1
}
trap rollback ERR

# ── 1. Pull ───────────────────────────────────────────────────────────────────
echo "→ git pull..."
git checkout -- package-lock.json
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

# ── 4. Build (a régi verzió még fut közben!) ─────────────────────────────────
echo "→ Build..."
# alacsonyabb CPU/IO-prioritással: build közben az élő oldalak (booking, davelopment.hu) kapják a gépet
NODE_OPTIONS="--max-old-space-size=3072" nice -n 10 ionice -c3 npm run build

# ── 5. Graceful reload (régi process az új start után áll csak le) ────────────
echo "→ Reload..."
pm2 reload "$PM2_NAME" --update-env

# ── Takarítás ────────────────────────────────────────────────────────────────
rm -rf .next-rollback

echo ""
echo "✅ Deploy kész."
pm2 list
