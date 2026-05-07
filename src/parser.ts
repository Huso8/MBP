/**
 * Совместимость со старым импортом.
 * Реальная логика теперь в `src/petrovich/*`.
 */

export type { Product, SortMode } from './petrovich/types.js';
export { searchInPetrovich } from './petrovich/search.js';
export { addToPetrovichCart } from './petrovich/cart.js';