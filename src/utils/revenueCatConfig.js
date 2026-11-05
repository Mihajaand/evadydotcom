export const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

export const REVENUECAT_PRODUCTS = {
  basic: 'evady_basic_monthly',
  premium: 'evady_premium_monthly',
  vip: 'evady_vip_monthly',
};

export const REVENUECAT_PRODUCT_TIERS = Object.fromEntries(
  Object.entries(REVENUECAT_PRODUCTS).map(([tier, productId]) => [productId, tier])
);
