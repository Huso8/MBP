/**
 * Простой in-memory TTL кэш.
 * Подходит для одного процесса (Railway реплика = 1). При рестарте кэш очищается.
 */
export class TtlCache {
    ttlMs;
    store = new Map();
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
    }
    /** Возвращает значение, если оно ещё не протухло */
    get(key) {
        const now = Date.now();
        const hit = this.store.get(key);
        if (!hit)
            return undefined;
        if (hit.expiresAt <= now) {
            this.store.delete(key);
            return undefined;
        }
        return hit.value;
    }
    /** Кладёт значение в кэш на ttlMs */
    set(key, value) {
        this.store.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    }
}
//# sourceMappingURL=ttl-cache.js.map