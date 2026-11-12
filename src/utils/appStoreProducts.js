export const APP_STORE_PRODUCTS = {
  vip: 'evady_vip_monthly',
  premium: 'premium_abo',
  basic: 'basic',
};

export const APP_STORE_PRODUCT_TIERS = Object.fromEntries(
  Object.entries(APP_STORE_PRODUCTS).map(([tier, productId]) => [productId, tier])
);

export const getTierForAppStoreProduct = (productId) =>
  APP_STORE_PRODUCT_TIERS[productId] || null;
