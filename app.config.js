// app.config.js
const fs = require('fs');
const path = require('path');

// Load base expo config from app.json
const baseConfig = require('./app.json').expo;

let localExtra = {};
try {
  const localPath = path.resolve(__dirname, 'app.local.json');
  if (fs.existsSync(localPath)) {
    localExtra = require(localPath).extra;
  }
} catch (e) {
  // ignore if file not present
}

module.exports = {
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    ...localExtra,
  },
};
