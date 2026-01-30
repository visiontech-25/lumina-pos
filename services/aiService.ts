import { Sale, Product, CartItem } from '../types';

/**
 * Predictive Inventory Service
 * Uses simple AI models to predict stock depletion.
 */

const aiService = {
  /**
   * Predicts the number of days until a product runs out of stock.
   * @param product The product to predict.
   * @param sales A list of recent sales.
   * @returns The predicted number of days until out of stock, or null if not enough data.
   */
  predictDaysUntilOutOfStock: (product: Product, sales: Sale[]): number | null => {
    const salesOfProduct = sales
      .flatMap(sale => sale.items)
      .filter(item => item.id === product.id);

    if (salesOfProduct.length < 3) {
      // Not enough sales data to make a reliable prediction
      return null;
    }

    const salesByDay: { [day: string]: number } = {};
    salesOfProduct.forEach(item => {
      const sale = sales.find(s => s.items.includes(item));
      if (sale) {
        const day = new Date(sale.timestamp).toISOString().split('T')[0];
        salesByDay[day] = (salesByDay[day] || 0) + item.quantity;
      }
    });

    const dailySales = Object.values(salesByDay);
    const averageDailySales = dailySales.reduce((a, b) => a + b, 0) / dailySales.length;

    if (averageDailySales <= 0) {
      return null;
    }

    const daysUntilOutOfStock = product.stock / averageDailySales;
    return Math.floor(daysUntilOutOfStock);
  },

  /**
   * Recommends products for a customer based on their purchase history.
   * @param customerSales The sales history for a specific customer.
   * @param allProducts The list of all available products.
   * @returns A list of recommended products.
   */
  getRecommendedProducts: (customerSales: Sale[], allProducts: Product[]): Product[] => {
    if (customerSales.length === 0) {
      return [];
    }

    const purchasedProductIds = new Set(
      customerSales.flatMap(sale => sale.items.map(item => item.id))
    );

    const purchasedCategories = new Set(
      customerSales
        .flatMap(sale => sale.items)
        .map(item => allProducts.find(p => p.id === item.id)?.category)
        .filter(Boolean)
    );

    const recommended = allProducts
      .filter(
        product =>
          !purchasedProductIds.has(product.id) &&
          product.category &&
          purchasedCategories.has(product.category)
      )
      .slice(0, 5);

    return recommended;
  },
};

export default aiService;
