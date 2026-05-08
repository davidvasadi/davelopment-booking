# 🚀 Bookly VPS Deployment Guide

## Előkészítés

### 1. VPS Server Setup (Ubuntu 22.04)

```bash
# SSH kapcsolat
ssh deploy@46.29.142.31

# System update
sudo apt update && sudo apt upgrade -y

# Node.js telepítése
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL telepítése
sudo apt install -y postgresql postgresql-contrib

# PM2 global install
npm install -g pm2

# Nginx
sudo apt install -y nginx

# Git
sudo apt install -y git
```

### 2. PostgreSQL Setup

```bash
sudo sudo -u postgres psql

# Bookly database + user
CREATE DATABASE bookly;
CREATE USER bookly WITH PASSWORD 'REDACTED';
ALTER ROLE bookly SET client_encoding TO 'utf8';
ALTER ROLE bookly SET default_transaction_isolation TO 'read committed';
ALTER ROLE bookly SET default_transaction_deferrable TO 'on';
ALTER ROLE bookly SET default_transaction_deferrable TO 'on';
GRANT ALL PRIVILEGES ON DATABASE bookly TO bookly;
\q
```

### 3. Project Setup

```bash
# Repo klónozása
cd /var/www
sudo git clone https://github.com/davidvasadi/bookly.git

# Permission
sudo chown -R deploy:deploy bookly/

# Navigate + install
cd bookly
npm install

# Build production
NODE_ENV=production npm run build

# Migrations futtatása
npm run migrate
```

### 4. Environment Setup

```bash
# .env.local másolása
cp .env.example .env.local

# Szerkesztés (vi vagy nano)
nano .env.local
```

**Beállítandó:**
- DATABASE_URI: `postgresql://bookly:REDACTED@localhost:5432/bookly`
- PAYLOAD_SECRET: Biztonságos random string (64 char)
- GOOGLE_CLIENT_ID / SECRET
- FACEBOOK_CLIENT_ID / SECRET
- RESEND_API_KEY
- NODE_ENV: `production`

### 5. PM2 Setup

```bash
# ecosystem.config.js módosítása
# Update: cwd path, NODE_ENV, PORT

# Start PM2
pm2 start ecosystem.config.js

# Auto-start on boot
pm2 startup
pm2 save

# Monitoring
pm2 monit
pm2 logs bookly
```

### 6. Nginx Setup

```bash
# Copy nginx config
sudo cp nginx-template.conf /etc/nginx/sites-available/bookly

# Enable
sudo ln -s /etc/nginx/sites-available/bookly /etc/nginx/sites-enabled/bookly

# Disable default
sudo rm /etc/nginx/sites-enabled/default

# Teszt
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
# Certbot install
sudo apt install certbot python3-certbot-nginx -y

# Certificate
sudo certbot certonly --standalone -d davelopment.hu

# Nginx update (már van az config-ban)

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 8. Firewall

```bash
# UFW enable
sudo ufw enable

# SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check
sudo ufw status
```

---

## 📦 CI/CD (GitHub Actions - Optional)

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: 46.29.142.31
          username: deploy
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /var/www/bookly
            git pull origin main
            npm install
            npm run build
            pm2 restart bookly
```

---

## 🔧 Maintenance

### Regular Backups

```bash
# PostgreSQL backup
sudo pg_dump bookly > /backups/bookly-$(date +%Y%m%d).sql

# Cron job (daily 2 AM)
0 2 * * * sudo pg_dump bookly > /backups/bookly-$(date \%Y\%m\%d).sql
```

### Monitoring

```bash
# PM2 monit
pm2 monit

# Logs
pm2 logs bookly --lines 100

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/bookly-error.log
```

### Updates

```bash
# Node dependencies
npm update

# Production rebuild
npm run build

# PM2 restart
pm2 restart bookly
```

---

## 🐛 Troubleshooting

### Could not connect to database
- Check PostgreSQL: `sudo systemctl status postgresql`
- Verify credentials in `.env.local`
- Connection string: `postgresql://bookly:password@localhost:5432/bookly`

### PM2 not restarting
```bash
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 list

# Check logs
pm2 logs bookly
sudo tail -f /var/log/nginx/bookly-error.log
```

### SSL issues
```bash
sudo certbot renew --dry-run
sudo systemctl restart nginx
```

---

## 📞 Contact

Issues: david@davelopment.hu
