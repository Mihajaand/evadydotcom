# E-VADY - Application de Rencontres

Application de rencontres React Native (Expo) avec Supabase et Stripe.

## 🚀 Installation

```bash
cd e-vady
npm install
```

## ⚙️ Configuration

### 1. Supabase
1. Créez un projet sur [supabase.com](https://supabase.com)
2. Exécutez le script `supabase-schema.sql` dans le SQL Editor
3. Modifiez `src/supabase/client.js` avec vos clés :
   - `SUPABASE_URL` 
   - `SUPABASE_ANON_KEY`
4. Activez le Storage et créez un bucket `photos` (public)

### 2. Stripe (optionnel pour le MVP)
Le système de paiement est prêt côté UI. Pour activer Stripe :
1. Créez un compte [stripe.com](https://stripe.com)
2. Configurez votre backend pour créer des PaymentIntents
3. Intégrez le token dans `SubscriptionScreen.js`

## 📱 Lancement

```bash
npx expo start
```

Puis scanner le QR code avec **Expo Go** sur votre téléphone.

## 📁 Structure du projet

```
e-vady/
├── App.js                      # Point d'entrée
├── app.json                    # Configuration Expo
├── babel.config.js             # Config Babel + Reanimated
├── supabase-schema.sql         # Schéma SQL complet
├── assets/
│   ├── logo.png               # Logo E-VADY
│   └── default-avatar.png     # Avatar par défaut
└── src/
    ├── supabase/
    │   └── client.js           # Init Supabase
    ├── store/
    │   ├── authStore.js        # État auth (Zustand)
    │   ├── messageStore.js     # État messages (Zustand)
    │   └── subscriptionStore.js # État abonnement (Zustand)
    ├── utils/
    │   ├── constants.js        # Couleurs, limites, tiers
    │   └── helpers.js          # Haversine, calcul d'âge
    ├── hooks/
    │   ├── useAuth.js          # Hook auth Supabase
    │   ├── useLocation.js      # Hook GPS Expo
    │   └── useMessages.js      # Hook messages temps réel
    ├── components/
    │   ├── Button.js           # Bouton réutilisable
    │   ├── Input.js            # Champ de saisie
    │   ├── ProfileCard.js      # Carte de profil (swipe)
    │   └── LoadingScreen.js    # Écran de chargement
    ├── screens/
    │   ├── LoginScreen.js      # Connexion
    │   ├── SignupScreen.js     # Inscription
    │   ├── HomeScreen.js       # Swipe de profils
    │   ├── SearchScreen.js     # Recherche + filtres
    │   ├── MessagesScreen.js   # Liste conversations
    │   ├── ChatScreen.js       # Chat temps réel
    │   ├── ProfileScreen.js    # Mon profil + photos
    │   └── SubscriptionScreen.js # Plans d'abonnement
    └── navigation/
        └── AppNavigator.js     # Navigation stack + tabs
```

## 🔒 Règles métier

| Règle | Détail |
|-------|--------|
| **Filtrage genre** | Hommes voient UNIQUEMENT les femmes et inversement |
| **Messages** | Uniquement homme↔femme, même genre = BLOQUÉ |
| **Signalement** | Seules les femmes peuvent signaler les hommes |
| **Auto-ban** | 5 signalements = suppression automatique du compte |
| **Limites messages** | Gratuit: 20/j, Basic: 100/j, Premium: 300/j, VIP: illimité |

## 🎨 Design

- **Rose principal:** `#F13E93`
- **Vert menthe:** `#5DD3B6`
- **Background:** `#FFFFFF`

## 📦 Abonnements

| Plan | Prix | Messages/jour |
|------|------|---------------|
| Gratuit | 0€ | 20 |
| Basic | 9,99€/mois | 100 |
| Premium | 19,99€/mois | 300 |
| VIP | 39,99€/mois | Illimité |
