// send-push.js
// Script Node.js pour envoyer une notification push test via le service Expo
// Utilise le token stocké dans Supabase (profiles.push_token)

const { Expo } = require('expo-server-sdk'); // npm i expo-server-sdk
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // charge .env si présent

// Supabase configuration – assurez‑vous que les variables d’environnement existent
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction principale
(async () => {
  try {
    // Récupérer le token du premier profil (ou ajuster la requête selon votre logique)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('push_token')
      .neq('push_token', null)
      .limit(1);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      console.log('Aucun token push trouvé dans Supabase.');
      return;
    }

    const token = profiles[0].push_token;
    console.log('Token récupéré :', token);

    // Créer un message Expo
    const expo = new Expo();
    const messages = [];

    // Vérifier que le token est valide pour Expo
    if (!Expo.isExpoPushToken(token)) {
      console.error('Le token n’est pas un token Expo valide :', token);
      return;
    }

    messages.push({
      to: token,
      sound: 'default',
      title: '🔔 Test Push Expo',
      body: 'Ceci est une notification push de test depuis le script Node.js',
      data: { test: true },
    });

    // Envoyer les messages en lot
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log('Tickets reçus :', ticketChunk);
        tickets.push(...ticketChunk);
      } catch (e) {
        console.error('Erreur lors de l’envoi du chunk :', e);
      }
    }

    // Vous pouvez récupérer les receipts si vous le désirez (optionnel)
    // const receiptIds = tickets.filter(t => t.id).map(t => t.id);
    // const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    // for (let receiptChunk of receiptChunks) {
    //   const receipts = await expo.getPushNotificationReceiptsAsync(receiptChunk);
    //   console.log('Receipts :', receipts);
    // }
  } catch (err) {
    console.error('Erreur globale :', err);
  }
})();
