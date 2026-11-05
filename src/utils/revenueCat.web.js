const unavailable = () => {
  throw new Error('Les achats intégrés ne sont disponibles que sur iOS.');
};

export const getAvailablePackages = unavailable;
export const purchasePackage = unavailable;
export const restorePurchases = unavailable;
export const showManageSubscriptions = unavailable;
export const getTierForProduct = () => null;
