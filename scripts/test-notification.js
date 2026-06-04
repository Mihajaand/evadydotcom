// test-notification.js   <-- ES module version
import notifier from 'node-notifier';
import path from 'path';

notifier.notify(
  {
    title: '🔔 Test de notification',
    message: 'Ceci est un message de démonstration depuis Node.js (ES‑module)',
    // icon: path.join(import.meta.url.replace('file://', ''), 'icon.png'), // optionnel
    sound: true,
    wait: false,
  },
  (err, response, metadata) => {
    if (err) console.error('Erreur de notification :', err);
  }
);
