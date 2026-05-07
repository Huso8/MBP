import { launchBrowser } from './browser.js';
import { currentPriceRubles, formatPriceLine, parseAvailabilityFromCardText } from './text-parsers.js';
function isDnsResolveError(error) {
    if (!error || typeof error !== 'object' || !('message' in error))
        return false;
    return String(error.message).includes('ERR_NAME_NOT_RESOLVED');
}
function normalizeSpaces(s) {
    return s.replace(/\s+/g, ' ').trim();
}
/**
 * Достаёт текст "карточки" товара вокруг ссылки.
 * Нужен чтобы выцепить цену/наличие без `page.evaluate` по всей странице.
 */
async function cardTextAroundLink(link) {
    const byProductCard = link.locator('xpath=ancestor::*[contains(@class,"ProductCard")][1]');
    if ((await byProductCard.count()) > 0) {
        return normalizeSpaces(await byProductCard.first().innerText());
    }
    // Fallback: поднимаемся по DOM, пока не найдём блок с ценой в ₽
    const fallback = await link.evaluate((el) => {
        let n = el;
        for (let i = 0; i < 14 && n; i++) {
            const raw = n.textContent || '';
            if (raw.includes('₽') && /\d/.test(raw))
                return raw.replace(/\s+/g, ' ').trim();
            n = n.parentElement;
        }
        return '';
    });
    return normalizeSpaces(fallback);
}
function absProductUrl(href) {
    if (!href || href === '#')
        return '#';
    if (href.startsWith('http'))
        return href;
    const p = href.startsWith('/') ? href : `/${href}`;
    return `https://www.petrovich.ru${p}`;
}
async function gotoWithFallbacks(page, query) {
    const encoded = encodeURIComponent(query);
    const urls = [
        `https://www.petrovich.ru/search/?q=${encoded}`,
        `https://petrovich.ru/search/?q=${encoded}`
    ];
    let lastError;
    for (const url of urls) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                lastError = undefined;
                return;
            }
            catch (e) {
                lastError = e;
            }
        }
    }
    throw lastError ?? new Error('NAVIGATION_FAILED');
}
/**
 * Поиск товаров в Петровиче.
 * - `popular`: порядок как на сайте (релевантность/популярность)
 * - `cheap`: сортировка по текущей цене (если распознали)
 */
export async function searchInPetrovich(query, sortMode = 'popular') {
    const browser = await launchBrowser();
    const page = await (await browser.newContext()).newPage();
    await page.setExtraHTTPHeaders({
        // на некоторых окружениях UA помогает получить "нормальную" верстку
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    try {
        console.log(`🔍 Ищу: ${query}`);
        await gotoWithFallbacks(page, query);
        // ждём появления ссылок на товары (SPA)
        try {
            await page.waitForSelector('a[href*="/product/"]', { timeout: 15000 });
        }
        catch {
            await page.waitForTimeout(2000);
            console.warn('Ссылки на товары не появились за 15с — возможна медленная сеть или другая вёрстка');
        }
        const linkLocator = page.locator('a[href*="/product/"]');
        const linkCount = await linkLocator.count();
        const seen = new Set();
        const rows = [];
        for (let i = 0; i < Math.min(linkCount, 80); i++) {
            const link = linkLocator.nth(i);
            const href = await link.getAttribute('href');
            const titleRaw = normalizeSpaces(await link.innerText());
            const title = titleRaw.replace(/^Тип товара:\s*/i, '').trim();
            if (!href)
                continue;
            if (seen.has(href))
                continue;
            if (title.length < 4 || title.startsWith('Тип товара:'))
                continue;
            seen.add(href);
            const cardText = await cardTextAroundLink(link);
            rows.push({
                product: {
                    name: title,
                    price: formatPriceLine(cardText),
                    availability: parseAvailabilityFromCardText(cardText),
                    url: absProductUrl(href)
                },
                priceNum: currentPriceRubles(cardText)
            });
        }
        if (sortMode === 'cheap') {
            rows.sort((a, b) => (a.priceNum ?? Infinity) - (b.priceNum ?? Infinity));
        }
        const products = rows.slice(0, 12).map((r) => r.product);
        console.log(`✅ Найдено товаров (после фильтра): ${products.length}`);
        return products;
    }
    catch (error) {
        if (isDnsResolveError(error))
            throw new Error('DNS_RESOLVE_FAILED');
        console.error('Ошибка парсинга:', error);
        return [];
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=search.js.map