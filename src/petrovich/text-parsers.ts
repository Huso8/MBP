/**
 * Парсеры строк из текстового содержимого карточки товара.
 * Здесь только "чистые" функции без Playwright.
 */

function normalizeSpaces(s: string): string {
	return s.replace(/\s+/g, ' ').trim();
}

/** Достаёт цены вида «239 ₽», «1 234 ₽» из текста карточки */
export function parsePricesFromCardText(text: string): string[] {
	const t = text.replace(/\u00A0/g, ' ');
	const matches = [...t.matchAll(/(\d[\d\s]*)\s*₽/g)];
	const nums = matches.map((m) => m[1].replace(/\s/g, '')).filter(Boolean);
	return [...new Set(nums)];
}

/** Форматирует цену для выдачи в Telegram */
export function formatPriceLine(cardText: string): string {
	const nums = parsePricesFromCardText(cardText);
	if (nums.length === 0) return 'Цена не указана';
	if (nums.length === 1) {
		const n = nums[0];
		return `${n.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
	}
	const a = nums[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	const b = nums[1].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	if (nums[0] === nums[1]) return `${a} ₽`;
	return `${a} ₽ (было ${b} ₽)`;
}

/** Возвращает "текущую" цену (первую) для сортировки по дешевизне */
export function currentPriceRubles(cardText: string): number | null {
	const nums = parsePricesFromCardText(cardText);
	if (nums.length === 0) return null;
	const n = Number(nums[0]);
	return Number.isFinite(n) ? n : null;
}

/** Пытается вытащить человеческое наличие из текста карточки */
export function parseAvailabilityFromCardText(cardText: string): string {
	const t = normalizeSpaces(cardText);
	const patterns: RegExp[] = [
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
		if (m) return m[0];
	}
	return 'Уточняйте наличие';
}

