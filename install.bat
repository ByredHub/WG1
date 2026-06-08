@echo off
chcp 65001 >nul
title WG Subscription Manager — Установка

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      WG Subscription Manager Setup      ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Проверка Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [ОШИБКА] Node.js не установлен!
    echo  Скачайте с https://nodejs.org/ (версия 18+^)
    pause
    exit /b 1
)
for /f "tokens=1" %%v in ('node -v') do echo  Node.js %%v найден

:: Создание .env если нет
if not exist .env (
    echo.
    echo  Создаю .env из примера...
    copy .env.example .env >nul
    echo  [!] Откройте файл .env и заполните параметры:
    echo      - APP_URL, ADMIN_PASSWORD, WG_EASY_PASSWORD
    echo      - SBP_PHONE, SBP_BANK, SBP_NAME
    echo      - JWT_SECRET (замените на случайную строку^)
    echo.
    notepad .env
)

:: Создание папок
if not exist data mkdir data
if not exist data\wwebjs_auth mkdir data\wwebjs_auth

:: Установка зависимостей
echo.
echo  [1/2] Установка зависимостей...
call npm install
if errorlevel 1 ( echo  [ОШИБКА] npm install завершился с ошибкой & pause & exit /b 1 )

echo.
echo  [2/2] Сборка фронтенда...
call npm run build
if errorlevel 1 ( echo  [ОШИБКА] Сборка провалилась & pause & exit /b 1 )

:: Установка PM2
where pm2 >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Устанавливаю PM2...
    call npm install -g pm2
)

:: Запуск
echo.
echo  Запускаю приложение...
pm2 delete wg-manager >nul 2>&1
pm2 start server/index.js --name wg-manager --restart-delay=3000
pm2 save

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        Установка завершена!              ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Команды управления:
echo    pm2 status          — статус
echo    pm2 logs wg-manager — логи (QR-код WhatsApp)
echo    pm2 restart wg-manager — перезапуск
echo.
echo  После запуска откройте логи и отсканируйте QR WhatsApp:
echo    pm2 logs wg-manager
echo.
pause
