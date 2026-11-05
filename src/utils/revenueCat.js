import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import {
  REVENUECAT_IOS_API_KEY,
  REVENUECAT_PRODUCT_TIERS,
} from './revenueCatConfig';

async function identifyUser(userId) {
  if (!REVENUECAT_IOS_API_KEY) {
    throw new Error('La clé publique iOS RevenueCat n’est pas configurée.');
  }
  if (!userId) {
    throw new Error('Connectez-vous pour utiliser les achats intégrés.');
  }

  if (!(await Purchases.isConfigured())) {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
  }

  const activeUserId = await Purchases.getAppUserID();
  if (activeUserId !== userId) {
    await Purchases.logIn(userId);
  }
}

export async function getAvailablePackages(userId) {
  await identifyUser(userId);
  const offerings = await Purchases.getOfferings();
  if (!offerings.current) {
    throw new Error('Aucune offre RevenueCat active n’est configurée.');
  }

  return offerings.current.availablePackages.reduce((packages, purchasePackage) => {
    const tier = REVENUECAT_PRODUCT_TIERS[purchasePackage.product.identifier];
    if (tier) packages[tier] = purchasePackage;
    return packages;
  }, {});
}

export async function purchasePackage(userId, purchasePackage) {
  await identifyUser(userId);
  const result = await Purchases.purchasePackage(purchasePackage);
  return result;
}

export async function restorePurchases(userId) {
  await identifyUser(userId);
  return Purchases.restorePurchases();
}

export async function showManageSubscriptions(userId) {
  await identifyUser(userId);
  return Purchases.showManageSubscriptions();
}

export function getTierForProduct(productId) {
  return REVENUECAT_PRODUCT_TIERS[productId] || null;
}
