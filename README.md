# Proxy Switcher

Проект расширения Proxy Switcher на базе исходного `proxySwitcher`, но без PAC-скриптов.

## Что изменено

- Используется нативный API Firefox: `browser.proxy.onRequest`.
- Проксирование выбирается на каждый запрос в `background.js`.
- Добавлен фильтр вкладок в popup (`Фильтр вкладок`) с быстрым добавлением хоста в правила.
- Сохранена модель профилей, привязок хостов, белого списка, дефолтного профиля и глобального режима.

## Запуск в Firefox

1. Откройте `about:debugging`.
2. Выберите `This Firefox`.
3. Нажмите `Load Temporary Add-on...`.
4. Выберите файл `manifest.json` из папки проекта.

## Папка проекта

- `manifest.json` - Firefox WebExtension (MV2)
- `background.js` - выбор прокси через `proxy.onRequest`
- `popup.html`, `popup.js`, `popup.css` - быстрые настройки и фильтр вкладок
- `settings.html`, `settings.js`, `settings.css` - расширенные настройки
