# WG Subscriptions — Система управления VPN подписками

## Что делает

- Управление клиентами WireGuard (привязка к пирам в WG Easy)
- Автоматическое отключение при истечении подписки (каждый день в 10:00)
- WhatsApp уведомления за 1 день до конца и при отключении
- Приём оплаты через ЮКассу или ручное подтверждение
- Веб-панель управления

## Быстрая установка (Linux/VPS)

```bash
git clone <repo> /opt/wg-manager
cd /opt/wg-manager
sudo bash install.sh
```

Скрипт автоматически:
- Установит Node.js 20, Chromium и все зависимости
- Запросит параметры и создаст `.env`
- Соберёт фронтенд
- Настроит **PM2** (автозапуск при перезагрузке сервера)
- Настроит **Nginx** + предложит SSL через Certbot

## Установка на Windows

```
install.bat
```

## Ручная установка на VPS

```bash
npm install
cp .env.example .env
nano .env        # заполнить параметры
npm run build
npm start
```

## Первый запуск

При старте в терминале появится QR-код — открой WhatsApp → Связанные устройства → Привязать устройство → отсканируй.
Сессия сохраняется в `data/wwebjs_auth/`, повторно сканировать не нужно.

## Импорт клиентов из wg0.json (бекап WG Easy)

```bash
npm run import-wg /путь/к/wg0.json
```

Автоматически распознаёт телефоны из имён вида `"02С4 89287288833"`.

## .env переменные

| Переменная | Описание |
|---|---|
| `WG_EASY_URL` | URL WireGuard Easy (например `http://localhost:51821`) |
| `WG_EASY_PASSWORD` | Пароль от WG Easy |
| `YUKASSA_SHOP_ID` | ID магазина ЮКассы |
| `YUKASSA_SECRET_KEY` | Секретный ключ ЮКассы |
| `JWT_SECRET` | Случайная строка для токенов |
| `ADMIN_USERNAME` | Логин в панель |
| `ADMIN_PASSWORD` | Пароль в панель |
| `SUBSCRIPTION_PRICE` | Стоимость подписки (по умолчанию 250) |
| `APP_URL` | URL сервиса (для ссылок в сообщениях) |

## Структура проекта

```
├── server/
│   ├── index.js          # Express сервер
│   ├── db.js             # SQLite база данных
│   ├── wgEasy.js         # WireGuard Easy API
│   ├── whatsapp.js       # WhatsApp (whatsapp-web.js)
│   ├── yukassa.js        # ЮКасса API
│   ├── scheduler.js      # Cron: проверка подписок
│   ├── middleware/
│   │   └── auth.js       # JWT авторизация
│   ├── routes/
│   │   ├── clients.js    # API клиентов
│   │   ├── payments.js   # API платежей
│   │   └── auth.js       # Авторизация
│   └── scripts/
│       └── importFromWg0.js  # Импорт из бекапа
├── client/               # React фронтенд
├── data/                 # База данных + сессия WhatsApp
└── .env                  # Конфигурация
```





echo "ADMIN_PHONE=79280939344" >> /opt/wg-manager/.env