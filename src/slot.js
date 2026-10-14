export const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7'];
export const BET = 5;
const PAYOUTS = { '7': 50, '⭐': 25, '🔔': 15, '🍋': 10, '🍒': 8 };

export function spin(rng = Math.random) {
  return [0, 1, 2].map(() => Math.floor(rng() * SYMBOLS.length));
}

// Returns the credits won for the given reel indices.
export function payout(reels, bet = BET) {
  const [a, b, c] = reels.map((i) => SYMBOLS[i]);
  if (a === b && b === c) return bet * PAYOUTS[a];
  if (a === b || b === c || a === c) return bet;
  return 0;
}
