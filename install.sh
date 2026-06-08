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
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
  libxrandr2 libxrender1 libxss1 libxtst6 \
  libasound2t64 libpango-1.0-0 libpangocairo-1.0-0 \
  libgbm1 libxshmfence1 libglib2.0-0 \
  fonts-liberation xdg-utils ca-certificates 2>/dev/null || true

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

# ─── Запрос домена заранее (нужен и для .env и для nginx/SSL) ────────────────
if [ -f .env ]; then
  DOMAIN=$(grep '^APP_URL=' .env | sed 's|^APP_URL=https\?://||' | cut -d/ -f1)
fi
if [ -z "$DOMAIN" ]; then
  echo ""
  read -p "  Введите домен сервиса (например adams.byred.fun): " DOMAIN
  DOMAIN=$(echo "$DOMAIN" | sed 's|https\?://||' | tr -d '/')
fi

# ─── Настройка .env ──────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/6] Настройка окружения...${NC}"

if [ -f .env ]; then
  echo -e "${GREEN}.env уже существует, пропускаю создание${NC}"
else
  echo "Заполните параметры (Enter = оставить пустым):"
  echo ""

  APP_URL="https://${DOMAIN}"
  echo "  URL сервиса: ${APP_URL}"
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

# ─── Nginx + SSL ─────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[6/6] Настройка Nginx и SSL...${NC}"

apt-get install -y -qq nginx certbot python3-certbot-nginx 2>/dev/null

APP_PORT=$(grep '^PORT=' .env | cut -d= -f2)
APP_PORT=${APP_PORT:-3000}
DOMAIN_NGINX=${DOMAIN:-_}

# HTTP конфиг (certbot потом добавит HTTPS)
cat > /etc/nginx/sites-available/wg-manager <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NGINX};

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

ln -sf /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/wg-manager
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo -e "${GREEN}Nginx настроен${NC}"

# SSL через Certbot
if [ "$DOMAIN_NGINX" != "_" ] && [ -n "$DOMAIN_NGINX" ]; then
  echo -e "${YELLOW}Получаю SSL сертификат для ${DOMAIN_NGINX}...${NC}"
  echo -e "${YELLOW}(Убедитесь что DNS запись A уже указывает на этот сервер!)${NC}"

  # Пытаемся без email (--register-unsafely-without-email), если не выйдет — с email
  if certbot --nginx -d "$DOMAIN_NGINX" --non-interactive --agree-tos \
       --register-unsafely-without-email 2>/dev/null; then
    echo -e "${GREEN}SSL сертификат получен!${NC}"
    # Автообновление
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | sort -u | crontab -
    echo -e "${GREEN}Автообновление сертификата настроено${NC}"
  else
    echo -e "${YELLOW}⚠  Не удалось получить SSL автоматически.${NC}"
    echo -e "   Получите вручную после установки:"
    echo -e "   ${BLUE}certbot --nginx -d ${DOMAIN_NGINX}${NC}"
  fi
else
  echo -e "${YELLOW}Домен не указан — SSL пропущен${NC}"
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
