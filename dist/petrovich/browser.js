import { chromium } from 'playwright';
/**
 * Создаёт Chromium для запуска в контейнере (Railway/Docker).
 * Эти флаги нужны, чтобы браузер не падал из‑за sandbox/dev-shm.
 */
export async function launchBrowser() {
    return chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
}
//# sourceMappingURL=browser.js.map