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

### Achats intégrés iOS (App Store)

Les abonnements iOS utilisent `expo-iap` et les achats auto-renouvelables Apple.
Les achats Android et Web conservent Stripe. Les identifiants des produits sont
`basic`, `premium_abo` et `evady_vip_monthly` (ceux déjà créés dans App Store Connect).

Pour activer la validation sécurisée des transactions Apple :

1. Dans App Store Connect, le groupe `e-vady` et les trois abonnements mensuels
   sont déjà créés. Vérifiez/définissez leurs prix et localisations.
2. Créez une clé API « In-App Purchase » dans App Store Connect et configurez
   les secrets Edge Function Supabase (ne les ajoutez jamais à l’application) :
   `APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`,
   `APP_STORE_PRIVATE_KEY` (clé `.p8`, avec des retours à la ligne), et
   `APP_STORE_BUNDLE_ID=com.mihajamahefa.evady`. Définissez aussi un secret
   aléatoire `APP_STORE_NOTIFICATION_SECRET` côté Supabase.
3. Appliquez `supabase/add_payment_provider_to_subscriptions.sql` et
   `supabase/add_app_store_subscription_columns.sql` et
   `supabase/add_app_store_transaction_log.sql` dans le SQL Editor Supabase.
4. Déployez `supabase functions deploy verify-app-store-purchase`.
   Déployez aussi `supabase functions deploy app-store-server-notifications`.
5. Construisez un development build ou une version TestFlight; Expo Go ne
   prend pas en charge les achats natifs.
6. Dans App Store Connect → votre app → App Store Server Notifications,
   configurez l’URL de production et l’URL Sandbox vers
   `https://<project-ref>.supabase.co/functions/v1/app-store-server-notifications?secret=<APP_STORE_NOTIFICATION_SECRET>`.

Les achats Apple validés par Apple mettent à jour `subscriptions` et sont
journalisés dans `app_store_transactions`. La colonne `environment` indique
`Production` ou `Sandbox`; `is_test` permet de filtrer les transactions de test.
`event_type`, `event_subtype` et `status` permettent d’identifier la notification
et l’issue de chaque transaction.
Les notifications App Store Server journalisent aussi les renouvellements et
synchronisent l’état de l’abonnement sans attendre la prochaine ouverture de l’app.
Les achats StoreKit simulés depuis Xcode sont également journalisés avec
`environment = Xcode`, `verification_status = simulated` et `status = simulated`.
Ils ne sont pas validés par Apple et ne créent jamais d'abonnement côté serveur.
Consultez ces lignes dans Supabase Studio → Table Editor → `app_store_transactions`.

Le compte Sandbox Apple n’a pas besoin d’utiliser la même adresse e-mail que le
compte E-VADY : l’achat est lié au compte E-VADY connecté lors de l’achat.
Apple n’autorise toutefois qu’un abonnement actif par compte Apple dans un même
groupe d’abonnements. Changer de Basic à Premium modifie cet abonnement, ce
n’est pas un second paiement pour un autre compte E-VADY. Pour tester plusieurs
comptes E-VADY indépendamment, utilisez un testeur Sandbox différent pour
chacun. L’application vérifie maintenant le lien avant d’ouvrir la feuille
d’achat et ne restaure plus automatiquement l’achat d’un autre compte E-VADY.

## 📦 variable d'environmment

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xsmltvqontirppmyyfkh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbWx0dnFvbnRpcnBwbXl5ZmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODc5MjgsImV4cCI6MjA5MTY2MzkyOH0.oXPaghoOmLeA0WY4galgy0PjzlI0mRqMkFZh9EFssX4

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SOa0NLkP8GG04LfDC4E8cksxU6wiBIShbgAnpaln65weDVicBoHbMjsYwasAzN7GeOkHYgND619qHqmbOyjWmO000EZqCQDBJ

# Stripe Product IDs
EXPO_PUBLIC_STRIPE_PRODUCT_BASIC=prod_UKSA5byhwMvyNq
EXPO_PUBLIC_STRIPE_PRODUCT_PREMIUM=prod_UKSAffBD6qq8Q6
EXPO_PUBLIC_STRIPE_PRODUCT_VIP=prod_UKSBmT4H0Q8BTT

# pour l'inscription
1. Créez un projet sur [https://dashboard.emailjs.com/]

EXPO_PUBLIC_EMAILJS_SERVICE_ID=service_by97jni
EXPO_PUBLIC_EMAILJS_TEMPLATE_ID=template_vznsj2m
EXPO_PUBLIC_EMAILJS_PUBLIC_KEY=lhNTLB7ket2ged903
# Ne jamais exposer une clé privée EmailJS via EXPO_PUBLIC_ ou dans l’application cliente.

2. Créez email template pour emailJS

Bonjour {{to_name}},

Merci de vous inscrire sur E-VADY. 

Voici votre code de vérification pour finaliser votre inscription :

👉 {{verification_code}} 👈

Ce code est confidentiel et ne doit pas être partagé.

L'équipe E-VADY