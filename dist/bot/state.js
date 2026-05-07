export class BotState {
    userSort = new Map();
    lastResults = new Map();
    getSort(userId) {
        return this.userSort.get(userId) ?? 'popular';
    }
    setSort(userId, mode) {
        this.userSort.set(userId, mode);
    }
    setLastResults(userId, items) {
        this.lastResults.set(userId, items);
    }
    getLastResult(userId, productId) {
        return this.lastResults.get(userId)?.get(productId);
    }
}
//# sourceMappingURL=state.js.map