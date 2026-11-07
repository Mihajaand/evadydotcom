export const APP_STORE_PRODUCTS = {
  basic: 'basic',
  premium: 'premium_abo',
  vip: 'evady_vip_monthly',
};

export const APP_STORE_PRODUCT_TIERS = Object.fromEntries(
  Object.entries(APP_STORE_PRODUCTS).map(([tier, productId]) => [productId, tier])
);

export const getTierForAppStoreProduct = (productId) =>
  APP_STORE_PRODUCT_TIERS[productId] || null;
