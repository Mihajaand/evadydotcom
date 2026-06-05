// app.config.js
const fs = require('fs');
const path = require('path');

// Load base expo config from app.json
const baseConfig = require('./app.json').expo;

let localConfig = {};
try {
  const localPath = path.resolve(__dirname, 'app.local.json');
  if (fs.existsSync(localPath)) {
    localConfig = require(localPath);
  }
} catch (e) {
  // ignore if file not present
}

module.exports = {
  ...baseConfig,
  ...localConfig,
  extra: {
    ...baseConfig.extra,
    ...(localConfig.extra || {}),
  },
};

