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
  plugins: [
    ...(baseConfig.plugins || []),
    ...(localConfig.plugins || []),
    "@react-native-community/datetimepicker" // <-- RAJOUTÉ ICI
  ],
  android: {
    ...(baseConfig.android || {}),
    ...(localConfig.android || {}),
    package: "com.mihajamahefa.evady"
  },
  extra: {
    ...baseConfig.extra,
    ...(localConfig.extra || {}),
    eas: {
      projectId: "88e4fc74-f8f2-4ad3-b20c-7a634976fed1"
    }
  },
};