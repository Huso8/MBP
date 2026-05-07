import type { SortMode } from '../petrovich/types.js';

/**
 * Память на время жизни процесса.
 * Здесь хранится состояние пользователя (выбранная сортировка и последние результаты).
 */

export type LastResultItem = { url: string; name: string };

export class BotState {
	private readonly userSort = new Map<number, SortMode>();
	private readonly lastResults = new Map<number, Map<string, LastResultItem>>();

	getSort(userId: number): SortMode {
		return this.userSort.get(userId) ?? 'popular';
	}

	setSort(userId: number, mode: SortMode): void {
		this.userSort.set(userId, mode);
	}

	setLastResults(userId: number, items: Map<string, LastResultItem>): void {
		this.lastResults.set(userId, items);
	}

	getLastResult(userId: number, productId: string): LastResultItem | undefined {
		return this.lastResults.get(userId)?.get(productId);
	}
}

