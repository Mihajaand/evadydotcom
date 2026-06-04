// test-notification.cjs
// Script Node.js pour afficher une notification Windows en mode CommonJS

const notifier = require('node-notifier');
const path = require('path');

notifier.notify({
  title: '🔔 Test de notification',
  message: 'Ceci est un message de démonstration depuis Node.js (CommonJS)',
  // icon: path.join(__dirname, 'icon.png'), // optionnel
  sound: true,
  wait: false
}, function (err, response, metadata) {
  if (err) console.error('Erreur de notification :', err);
});
