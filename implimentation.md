# Plan d'implémentation - Masquage des abonnements et redirection après paiement

Ce plan détaille les modifications à apporter pour :
1. Masquer les autres cartes d'abonnement (y compris la carte d'abonnement gratuit) lorsqu'un abonnement payant est actif. Si l'abonnement prend fin (par exemple après une annulation de renouvellement), toutes les cartes s'affichent à nouveau.
2. Rediriger l'utilisateur vers la page d'accueil avec un Toast "Abonnement {nom} activé" dès que le paiement Stripe est validé.
3. S'assurer que le statut de l'abonnement sur la page profil se met à jour immédiatement.

## Modifications proposées

### 1. Intégration de React Native Toast Message
#### [MODIFY] [App.js](file:///d:/DOSSIER%20PROJET/site_Evady/evadydotcom/App.js)
- Importer `Toast` depuis `react-native-toast-message`.
- Rendre `<Toast />` à la racine de l'application (juste après `<AppNavigator />` dans `GestureHandlerRootView`).

### 2. Gestion de l'affichage des cartes d'abonnement et redirection après paiement
#### [MODIFY] [SubscriptionScreen.js](file:///d:/DOSSIER%20PROJET/site_Evady/evadydotcom/src/screens/SubscriptionScreen.js)
- Filtrer la liste des cartes `PLANS` affichées : si `currentTier !== 'free'`, afficher uniquement le plan correspondant à `currentTier`. Sinon, afficher tous les plans.
- Utiliser `useNavigation` pour rediriger vers la page d'accueil (`Accueil`).
- Importer `Toast` depuis `react-native-toast-message`.
- Après le retour de Stripe (`WebBrowser.openBrowserAsync`), récupérer le nouvel état de l'abonnement via `fetchSubscription`.
- Si le tier a changé et n'est plus `free` :
  - Déclencher un toast de type `success` avec le message `"Abonnement {nom abonnement} activé"`.
  - Rediriger l'utilisateur vers la page d'accueil : `navigation.navigate('MainTabs', { screen: 'Accueil' })`.

### 3. Mise à jour directe du statut sur la page Profil
La page profil utilise déjà le hook Zustand `useSubscriptionStore` et met à jour son état local via un `useEffect` écoutant les changements de `subscription`. Étant donné que la mise à jour de la souscription dans le store se fait directement après validation du paiement, la page profil reflètera immédiatement le nouveau statut dès que le store Zustand sera mis à jour.

## Plan de vérification

### Vérification manuelle
1. Simuler ou effectuer un flux d'achat d'abonnement.
2. Vérifier que lors du retour à l'application après un paiement validé :
   - L'utilisateur est bien redirigé vers l'accueil.
   - Un toast de succès s'affiche avec le bon nom d'abonnement.
   - Sur la page abonnement, seul l'abonnement actif est affiché (les autres et le gratuit sont masqués).
   - Sur la page profil, le statut mis à jour (Basic, Premium ou VIP) s'affiche immédiatement.
3. Simuler l'expiration/l'annulation finale de l'abonnement (retour au tier `free`) et s'assurer que toutes les cartes réapparaissent.
