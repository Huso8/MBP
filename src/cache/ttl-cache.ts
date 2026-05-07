/**
 * Простой in-memory TTL кэш.
 * Подходит для одного процесса (Railway реплика = 1). При рестарте кэш очищается.
 */

export class TtlCache<T> {
	private readonly store = new Map<string, { expiresAt: number; value: T }>();

	constructor(private readonly ttlMs: number) {}

	/** Возвращает значение, если оно ещё не протухло */
	get(key: string): T | undefined {
		const now = Date.now();
		const hit = this.store.get(key);
		if (!hit) return undefined;
		if (hit.expiresAt <= now) {
			this.store.delete(key);
			return undefined;
		}
		return hit.value;
	}

	/** Кладёт значение в кэш на ttlMs */
	set(key: string, value: T): void {
		this.store.set(key, { expiresAt: Date.now() + this.ttlMs, value });
	}
}

