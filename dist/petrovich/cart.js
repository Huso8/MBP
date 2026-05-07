import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './browser.js';
function userStatePath(userId) {
    return path.join(process.cwd(), 'data', `storageState.${userId}.json`);
}
async function ensureDataDir() {
    await mkdir(path.join(process.cwd(), 'data'), { recursive: true });
}
/**
 * Добавляет товар в корзину Петровича через Playwright.
 * Состояние (cookies/localStorage) сохраняется в `./data` отдельно на каждого Telegram-пользователя.
 */
export async function addToPetrovichCart(userId, productUrl) {
    await ensureDataDir();
    const storageState = userStatePath(userId);
    const browser = await launchBrowser();
    try {
        const context = await browser.newContext(existsSync(storageState) ? { storageState } : undefined);
        const page = await context.newPage();
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // cookie-баннер (если есть)
        const cookieBtn = page.locator('button:has-text("Закрыть"), button:has-text("Принять"), button:has-text("Согласен")');
        if (await cookieBtn.first().isVisible().catch(() => false)) {
            await cookieBtn.first().click().catch(() => { });
        }
        // кнопка "В корзину"
        const addBtn = page.locator('button:has-text("В корзину")');
        await addBtn.first().waitFor({ timeout: 15000 });
        await addBtn.first().click();
        // даём UI применить изменения
        await page.waitForTimeout(1200);
        await context.storageState({ path: storageState });
        await context.close();
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=cart.js.map