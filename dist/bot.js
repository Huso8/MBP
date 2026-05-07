import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { TtlCache } from './cache/ttl-cache.js';
import { BotState } from './bot/state.js';
import { addToPetrovichCart, searchInPetrovich } from './parser.js';
dotenv.config();
/**
 * Точка входа Telegram-бота.
 * Здесь только роутинг команд/сообщений и форматирование ответа.
 */
const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('Не задан BOT_TOKEN. Добавь его в .env или в переменные окружения.');
}
const bot = new Bot(token);
// Кэшируем поисковые ответы на 2 минуты.
const searchCache = new TtlCache(120_000);
// Состояние пользователя (сортировка, последние результаты для кнопок).
const state = new BotState();
// Корзина "внутри бота" (в памяти процесса). Нужна, потому что корзина на сайте создаётся в сессии Playwright на сервере.
const botCart = new Map();
function normalizeQuery(q) {
    return q.trim().toLowerCase().replace(/\s+/g, ' ');
}
bot.command('start', (ctx) => {
    ctx.reply('👷‍♂️ Бот для поиска в Петровиче (Москва)\n\n' +
        'Просто напиши, что нужно найти, например:\n' +
        '• гипсокартон кнауф 12.5\n' +
        '• арматура 12 мм\n' +
        '• пеноплекс 50мм 1180x580\n' +
        '• саморез 3.5x35');
});
bot.command('cheap', async (ctx) => {
    if (!ctx.from)
        return;
    state.setSort(ctx.from.id, 'cheap');
    await ctx.reply('Сортировка: от дешёвых.');
});
bot.command('popular', async (ctx) => {
    if (!ctx.from)
        return;
    state.setSort(ctx.from.id, 'popular');
    await ctx.reply('Сортировка: как на сайте (популярность/релевантность).');
});
bot.command('cart', async (ctx) => {
    if (!ctx.from)
        return;
    const items = botCart.get(ctx.from.id) ?? [];
    if (items.length === 0) {
        await ctx.reply('Корзина пуста. Добавляй товары кнопкой «🛒 В корзину» под результатами.');
        return;
    }
    const lines = items
        .slice(-20)
        .reverse()
        .map((it, idx) => `${idx + 1}. ${it.name}\n   🔗 ${it.url}`)
        .join('\n\n');
    await ctx.reply(`🛒 Твоя корзина (внутри бота):\n\n${lines}`);
});
bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('add:'))
        return;
    const productId = data.slice('add:'.length);
    const userId = ctx.from.id;
    const item = state.getLastResult(userId, productId);
    if (!item) {
        await ctx.answerCallbackQuery({ text: 'Не нашёл товар в последних результатах. Повтори поиск.' });
        return;
    }
    await ctx.answerCallbackQuery({ text: 'Добавляю в корзину…' });
    try {
        await addToPetrovichCart(userId, item.url);
        const arr = botCart.get(userId) ?? [];
        arr.push({ url: item.url, name: item.name, addedAt: Date.now() });
        botCart.set(userId, arr);
        await ctx.reply(`✅ Добавил: ${item.name}\n\n` +
            `Важно: добавление происходит в сессии браузера бота на сервере, поэтому в твоём личном браузере корзина может быть пустой.\n` +
            `Проверь «/cart» — там твоя корзина в боте.`);
    }
    catch (e) {
        console.error(e);
        await ctx.reply('Не получилось добавить в корзину (вёрстка/кнопка/доступ). Попробуй позже.');
    }
});
bot.on('message:text', async (ctx) => {
    const query = ctx.message.text.trim();
    // Команды (/start, /help, …) — только в bot.command, иначе /start уйдёт в поиск
    if (query.startsWith('/')) {
        return;
    }
    if (query.length < 3) {
        return ctx.reply('Запрос слишком короткий');
    }
    const message = await ctx.reply('🔍 Ищу в Петровиче...');
    try {
        const sortMode = state.getSort(ctx.from.id);
        const key = `${sortMode}:${normalizeQuery(query)}`;
        const cached = searchCache.get(key);
        const results = cached ?? (await searchInPetrovich(query, sortMode));
        if (!cached)
            searchCache.set(key, results);
        if (results.length === 0) {
            return ctx.api.editMessageText(message.chat.id, message.message_id, 'Ничего не найдено 😕');
        }
        let text = `🔎 Результаты по запросу: <b>${query}</b>\n\n`;
        const resMap = new Map();
        const keyboard = [];
        results.slice(0, 6).forEach((item, i) => {
            const m = String(item.url).match(/\/product\/(\d+)\//);
            const pid = m?.[1] ?? String(i);
            resMap.set(pid, { url: item.url, name: item.name });
            text += `${i + 1}. <b>${item.name}</b>\n`;
            text += `   💰 ${item.price}\n`;
            text += `   📍 ${item.availability}\n`;
            text += `   🔗 ${item.url}\n\n`;
            // Кнопка под каждой позицией
            keyboard.push([{ text: `🛒 В корзину #${i + 1}`, callback_data: `add:${pid}` }]);
        });
        state.setLastResults(ctx.from.id, resMap);
        await ctx.api.editMessageText(message.chat.id, message.message_id, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    }
    catch (error) {
        console.error(error);
        const messageText = error instanceof Error && error.message === 'DNS_RESOLVE_FAILED'
            ? 'Не удается открыть сайт Петровича (DNS/VPN). Попробуй отключить VPN или сменить DNS на 1.1.1.1 / 8.8.8.8.'
            : 'Ошибка при поиске. Попробуй позже.';
        ctx.api.editMessageText(message.chat.id, message.message_id, messageText);
    }
});
// При перезапуске Telegram отдаёт необработанные апдейты — без сброса снова выполнится старый текст (например прошлый поиск).
bot.start({ drop_pending_updates: true });
console.log('🤖 Бот запущен...');
//# sourceMappingURL=bot.js.map