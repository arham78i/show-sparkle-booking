// Currency configuration for Pakistani Rupees
export const CURRENCY = {
  code: 'PKR',
  symbol: 'Rs.',
  name: 'Pakistani Rupee',
};

// Format price in PKR (no decimal places for rupees)
export function formatPrice(amount: number): string {
  return `${CURRENCY.symbol} ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

// Format price with symbol only
export function formatPriceShort(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}
