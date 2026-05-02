import { chromium } from 'playwright';
function isDnsResolveError(error) {
    if (!error || typeof error !== 'object' || !('message' in error)) {
        return false;
    }
    const message = String(error.message);
    return message.includes('ERR_NAME_NOT_RESOLVED');
}
function normalizeSpaces(s) {
    return s.replace(/\s+/g, ' ').trim();
}
/** Достаёт цены вида «239 ₽», «1 234 ₽» из текста карточки */
function parsePricesFromCardText(text) {
    const t = text.replace(/\u00A0/g, ' ');
    const matches = [...t.matchAll(/(\d[\d\s]*)\s*₽/g)];
    const nums = matches.map((m) => m[1].replace(/\s/g, '')).filter(Boolean);
    return [...new Set(nums)];
}
function formatPriceLine(text) {
    const nums = parsePricesFromCardText(text);
    if (nums.length === 0)
        return 'Цена не указана';
    if (nums.length === 1) {
        const n = nums[0];
        return `${n.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
    }
    const a = nums[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const b = nums[1].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (nums[0] === nums[1])
        return `${a} ₽`;
    return `${a} ₽ (было ${b} ₽)`;
}
/** Наличие: фразы как на Петровиче */
function parseAvailabilityFromCardText(text) {
    const t = normalizeSpaces(text);
    const patterns = [
        /Доступно сегодня/i,
        /Доступно завтра/i,
        /В наличии/i,
        /Нет в наличии/i,
        /Под заказ/i,
        /Ожидается/i,
        /Снят с продажи/i,
        /Осталось\s+\d+/i
    ];
    for (const re of patterns) {
        const m = t.match(re);
        if (m)
            return m[0];
    }
    return 'Уточняйте наличие';
}
async function cardTextAroundLink(link) {
    const byProductCard = link.locator('xpath=ancestor::*[contains(@class,"ProductCard")][1]');
    if ((await byProductCard.count()) > 0) {
        return normalizeSpaces(await byProductCard.first().innerText());
    }
    // Запасной вариант: поднимаемся по DOM, пока не найдём блок с ценой в ₽
    const fallback = await link.evaluate((el) => {
        let n = el;
        for (let i = 0; i < 14 && n; i++) {
            const raw = n.textContent || '';
            if (raw.includes('₽') && /\d/.test(raw)) {
                return raw.replace(/\s+/g, ' ').trim();
            }
            n = n.parentElement;
        }
        return '';
    });
    return normalizeSpaces(fallback);
}
export async function searchInPetrovich(query) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });
    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    try {
        console.log(`🔍 Ищу: ${query}`);
        const encodedQuery = encodeURIComponent(query);
        const urls = [
            `https://www.petrovich.ru/search/?q=${encodedQuery}`,
            `https://petrovich.ru/search/?q=${encodedQuery}`
        ];
        let lastError;
        for (const url of urls) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                    lastError = undefined;
                    break;
                }
                catch (error) {
                    lastError = error;
                    if (attempt === 2) {
                        console.warn(`Не удалось открыть ${url}: попытка ${attempt}/2`);
                    }
                }
            }
            if (!lastError) {
                break;
            }
        }
        if (lastError) {
            throw lastError;
        }
        // На выдаче Петровича сейчас нет [data-testid="product-card"] — ждём появления ссылок на товары (SPA).
        try {
            await page.waitForSelector('a[href*="/product/"]', { timeout: 15000 });
        }
        catch {
            await page.waitForTimeout(2000);
            console.warn('Ссылки на товары не появились за 15с — возможна медленная сеть или другая вёрстка');
        }
        const absUrl = (href) => {
            if (!href || href === '#')
                return '#';
            if (href.startsWith('http'))
                return href;
            const path = href.startsWith('/') ? href : `/${href}`;
            return `https://www.petrovich.ru${path}`;
        };
        // Порядок ссылок = порядок выдачи на сайте (релевантность / популярность), без пересортировки.
        const linkLocator = page.locator('a[href*="/product/"]');
        const linkCount = await linkLocator.count();
        const seen = new Set();
        const products = [];
        for (let i = 0; i < Math.min(linkCount, 80); i++) {
            const link = linkLocator.nth(i);
            const href = await link.getAttribute('href');
            const titleRaw = (await link.innerText()).trim().replace(/\s+/g, ' ');
            const title = titleRaw.replace(/^Тип товара:\s*/i, '').trim();
            if (!href || seen.has(href))
                continue;
            if (title.length < 4 || title.startsWith('Тип товара:'))
                continue;
            seen.add(href);
            const cardText = await cardTextAroundLink(link);
            const price = formatPriceLine(cardText);
            const availability = parseAvailabilityFromCardText(cardText);
            products.push({
                name: title,
                price,
                availability,
                url: absUrl(href)
            });
            if (products.length >= 12)
                break;
        }
        console.log(`✅ Найдено товаров (после фильтра): ${products.length}`);
        return products;
    }
    catch (error) {
        if (isDnsResolveError(error)) {
            throw new Error('DNS_RESOLVE_FAILED');
        }
        console.error('Ошибка парсинга:', error);
        return [];
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=parser.js.map