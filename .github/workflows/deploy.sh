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

# ── 3. Build (a régi verzió még fut közben!) ─────────────────────────────────
echo "→ Build..."
NODE_OPTIONS="--max-old-space-size=3072" npm run build

# ── 4. Migráció ───────────────────────────────────────────────────────────────
echo "→ Migrációk..."
npx tsx scripts/migrate.ts

# ── 5. Graceful reload (régi process az új start után áll csak le) ────────────
echo "→ Reload..."
pm2 reload "$PM2_NAME" --update-env

# ── Takarítás ────────────────────────────────────────────────────────────────
rm -rf .next-rollback

echo ""
echo "✅ Deploy kész."
pm2 list
