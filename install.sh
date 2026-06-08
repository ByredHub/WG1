#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║      WG Subscription Manager Setup      ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Проверка root ───────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Запустите скрипт от root: sudo bash install.sh${NC}"
  exit 1
fi

# ─── Определение директории проекта ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}▶ Рабочая директория: $SCRIPT_DIR${NC}"

# ─── Установка системных зависимостей ────────────────────────────────────────
echo -e "\n${YELLOW}[1/6] Установка системных зависимостей...${NC}"
apt-get update -qq
apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release \
  chromium-browser fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 \
  libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
  xdg-utils libgbm1 libxshmfence1 2>/dev/null || true

# ─── Установка Node.js 20 ────────────────────────────────────────────────────
echo -e "\n${YELLOW}[2/6] Проверка Node.js...${NC}"
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  echo "Устанавливаю Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y nodejs 2>/dev/null
else
  echo -e "${GREEN}Node.js $(node -v) уже установлен${NC}"
fi

# ─── npm зависимости ─────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[3/6] Установка npm зависимостей...${NC}"
npm install --production 2>/dev/null
echo "Сборка фронтенда..."
npm run build 2>/dev/null
echo -e "${GREEN}Зависимости установлены${NC}"

# ─── Создание директорий ─────────────────────────────────────────────────────
mkdir -p data/wwebjs_auth
chmod 755 data

# ─── Настройка .env ──────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/6] Настройка окружения...${NC}"

if [ -f .env ]; then
  echo -e "${GREEN}.env уже существует, пропускаю создание${NC}"
else
  echo "Заполните параметры (Enter = оставить пустым):"
  echo ""

  read -p "  URL сервиса (например https://adams.byred.fun): " APP_URL
  read -p "  Логин администратора [admin]: " ADMIN_USERNAME
  ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
  read -s -p "  Пароль администратора: " ADMIN_PASSWORD
  echo ""
  read -p "  URL WireGuard Easy [http://localhost:51821]: " WG_EASY_URL
  WG_EASY_URL=${WG_EASY_URL:-http://localhost:51821}
  read -s -p "  Пароль WireGuard Easy: " WG_EASY_PASSWORD
  echo ""
  read -p "  Стоимость подписки в рублях [250]: " SUBSCRIPTION_PRICE
  SUBSCRIPTION_PRICE=${SUBSCRIPTION_PRICE:-250}
  read -p "  Номер телефона СБП (для страницы оплаты): " SBP_PHONE
  read -p "  Банк СБП (например Сбербанк): " SBP_BANK
  read -p "  Имя получателя СБП: " SBP_NAME
  read -p "  Порт сервера [3000]: " PORT
  PORT=${PORT:-3000}

  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')

  cat > .env <<EOF
# Server
PORT=${PORT}
NODE_ENV=production
APP_URL=${APP_URL}

# Admin credentials
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# JWT Secret (сгенерирован автоматически)
JWT_SECRET=${JWT_SECRET}

# WireGuard Easy
WG_EASY_URL=${WG_EASY_URL}
WG_EASY_PASSWORD=${WG_EASY_PASSWORD}

# Подписка
SUBSCRIPTION_PRICE=${SUBSCRIPTION_PRICE}

# СБП
SBP_PHONE=${SBP_PHONE}
SBP_BANK=${SBP_BANK}
SBP_NAME=${SBP_NAME}

# Платёжный провайдер (manual / platega / yukassa)
PAYMENT_PROVIDER=manual

# ЮКасса (если используется)
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
EOF

  echo -e "${GREEN}.env создан${NC}"
fi

# ─── PM2 ─────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[5/6] Настройка автозапуска через PM2...${NC}"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 2>/dev/null
fi

pm2 delete wg-manager 2>/dev/null || true
pm2 start server/index.js --name wg-manager --restart-delay=3000 2>/dev/null
pm2 save 2>/dev/null
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || true
echo -e "${GREEN}PM2 настроен, приложение запущено${NC}"

# ─── Nginx (опционально) ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}[6/6] Настройка Nginx...${NC}"
if command -v nginx &>/dev/null || apt-get install -y -qq nginx 2>/dev/null; then
  # Читаем PORT из .env
  APP_PORT=$(grep '^PORT=' .env | cut -d= -f2)
  APP_PORT=${APP_PORT:-3000}
  DOMAIN=$(grep '^APP_URL=' .env | sed 's|^APP_URL=https\?://||' | cut -d/ -f1)
  DOMAIN=${DOMAIN:-_}

  cat > /etc/nginx/sites-available/wg-manager <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/wg-manager 2>/dev/null || true
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
  echo -e "${GREEN}Nginx настроен для домена: ${DOMAIN}${NC}"

  # Certbot SSL
  if [ "$DOMAIN" != "_" ] && [ -n "$DOMAIN" ]; then
    read -p "Получить SSL сертификат для ${DOMAIN}? (y/N): " GET_SSL
    if [[ "$GET_SSL" =~ ^[Yy]$ ]]; then
      apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" || \
        echo -e "${YELLOW}SSL не удалось получить — настройте вручную: certbot --nginx -d ${DOMAIN}${NC}"
    fi
  fi
else
  echo -e "${YELLOW}Nginx не установлен, пропускаю${NC}"
fi

# ─── Итог ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗"
echo -e "║        Установка завершена успешно!      ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo ""

APP_URL_DISPLAY=$(grep '^APP_URL=' .env | cut -d= -f2)
APP_PORT_DISPLAY=$(grep '^PORT=' .env | cut -d= -f2)
echo -e "  🌐 Адрес:      ${BLUE}${APP_URL_DISPLAY:-http://$(hostname -I | awk '{print $1}'):${APP_PORT_DISPLAY:-3000}}${NC}"
echo -e "  🔐 Логин:      ${BLUE}$(grep '^ADMIN_USERNAME=' .env | cut -d= -f2)${NC}"
echo -e "  📊 PM2 статус: ${BLUE}pm2 status${NC}"
echo -e "  📋 Логи:       ${BLUE}pm2 logs wg-manager${NC}"
echo ""
echo -e "${YELLOW}⚠  После первого запуска откройте логи и отсканируйте QR-код WhatsApp:${NC}"
echo -e "   ${BLUE}pm2 logs wg-manager${NC}"
echo ""
