import type { CartItem, Promotion, PriceList, TaxConfig, Product } from '../types';

/**
 * Pricing & Promotions Engine (Phase 1)
 * ------------------------------------
 * - Applies simple percentage/amount-off promotions
 * - Supports per-channel price lists
 * - Computes tax from TaxConfig when present; otherwise falls back to
 *   legacy flat TAX_RATE (handled in POS/Prospects).
 */

export interface PricingContext {
  channel: string; // 'retail' | 'wholesale' | etc.
  now: Date;
}

export interface PricedCartResult {
  lineItems: Array<{
    product: Product;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
    lineDiscount: number;
  }>;
  subtotal: number;
  discountTotal: number;
}

function isPromotionActive(promo: Promotion, ctx: PricingContext): boolean {
  if (!promo.active) return false;
  const now = ctx.now;
  if (promo.startAt && now < new Date(promo.startAt)) return false;
  if (promo.endAt && now > new Date(promo.endAt)) return false;
  if (promo.daysOfWeek && promo.daysOfWeek.length > 0) {
    const dow = now.getDay();
    if (!promo.daysOfWeek.includes(dow)) return false;
  }
  if (promo.startTimeOfDay && promo.endTimeOfDay) {
    const [sh, sm] = promo.startTimeOfDay.split(':').map(Number);
    const [eh, em] = promo.endTimeOfDay.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
  }
  if (promo.channel && promo.channel !== ctx.channel) return false;
  return true;
}

export function priceCart(params: {
  cart: CartItem[];
  products: Product[];
  promotions: Promotion[];
  priceLists: PriceList[];
  ctx: PricingContext;
}): PricedCartResult {
  const { cart, products, promotions, priceLists, ctx } = params;

  const priceList = priceLists.find(p => p.channel === ctx.channel);

  const lineItems: PricedCartResult['lineItems'] = [];

  for (const cartItem of cart) {
    const baseProduct = products.find(p => p.id === cartItem.id) || cartItem;
    const listOverride = priceList?.entries.find(e => e.productId === baseProduct.id);
    const basePrice = listOverride ? listOverride.price : baseProduct.price;

    const applicablePromos = promotions.filter(p => {
      if (!isPromotionActive(p, ctx)) return false;
      if (p.productIds && !p.productIds.includes(baseProduct.id)) return false;
      if (p.tags && !p.tags.some(tag => (baseProduct.tags || []).includes(tag))) return false;
      return true;
    });

    let lineDiscount = 0;
    let effectivePrice = basePrice;

    if (applicablePromos.length > 0) {
      // Phase 1: take the single best discount across promos
      for (const promo of applicablePromos) {
        if (promo.type === 'PERCENT_OFF' && promo.percentOff) {
          const d = basePrice * (promo.percentOff / 100);
          if (d > lineDiscount) lineDiscount = d;
        }
        if (promo.type === 'AMOUNT_OFF' && promo.amountOff) {
          if (promo.amountOff > lineDiscount) lineDiscount = promo.amountOff;
        }
      }
    }

    effectivePrice = Math.max(0, basePrice - lineDiscount);
    const lineSubtotal = effectivePrice * cartItem.quantity;

    lineItems.push({
      product: baseProduct,
      quantity: cartItem.quantity,
      unitPrice: effectivePrice,
      lineSubtotal,
      lineDiscount: lineDiscount * cartItem.quantity
    });
  }

  const subtotal = lineItems.reduce((acc, l) => acc + l.lineSubtotal, 0);
  const discountTotal = lineItems.reduce((acc, l) => acc + l.lineDiscount, 0);

  return {
    lineItems,
    subtotal,
    discountTotal
  };
}

export function computeTaxForLine(
  product: Product,
  lineNetAmount: number,
  taxConfig?: TaxConfig,
  legacyRate?: number
): number {
  if (taxConfig) {
    const rateId = product.taxCategoryId;
    let rate = taxConfig.rates.find(r => r.id === rateId);
    if (!rate && taxConfig.defaultAppliesToUntypedProducts) {
      rate = taxConfig.rates.find(r => r.isDefault);
    }
    if (!rate) return 0;
    return lineNetAmount * rate.rate;
  }
  if (legacyRate != null) {
    return lineNetAmount * legacyRate;
  }
  return 0;
}

