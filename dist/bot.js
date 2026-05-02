import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { searchInPetrovich } from './parser.js';
dotenv.config();
const bot = new Bot(process.env.BOT_TOKEN);
bot.command('start', (ctx) => {
    ctx.reply('👷‍♂️ Бот для поиска в Петровиче (Москва)\n\n' +
        'Просто напиши, что нужно найти, например:\n' +
        '• гипсокартон кнауф 12.5\n' +
        '• арматура 12 мм\n' +
        '• пеноплекс 50мм 1180x580\n' +
        '• саморез 3.5x35');
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
        const results = await searchInPetrovich(query);
        if (results.length === 0) {
            return ctx.api.editMessageText(message.chat.id, message.message_id, 'Ничего не найдено 😕');
        }
        let text = `🔎 Результаты по запросу: <b>${query}</b>\n\n`;
        results.slice(0, 6).forEach((item, i) => {
            text += `${i + 1}. <b>${item.name}</b>\n`;
            text += `   💰 ${item.price}\n`;
            text += `   📍 ${item.availability}\n`;
            text += `   🔗 ${item.url}\n\n`;
        });
        await ctx.api.editMessageText(message.chat.id, message.message_id, text, { parse_mode: 'HTML' });
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