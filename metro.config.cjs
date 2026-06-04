// metro.config.cjs
// Metro configuration (CommonJS) – required because Expo loads this file via require()
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect react-native-maps to a stub on web (native module not supported)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    const origin = context.originModulePath || '';
    const driveLetter = origin.match(/^[a-zA-Z]:/)?.[0] || 'D:';
    
    let base = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    if (!base) base = '.';

    // Ajuste la casse du lecteur Windows
    if (base.match(/^[a-zA-Z]:/)) {
      base = driveLetter + base.substring(2);
    }
    
    // Résout un chemin absolu normalisé selon l'OS (antislashs sur Windows)
    const mockPath = path.resolve(base, 'src/mocks/react-native-maps.js');

    return {
      filePath: mockPath,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};




module.exports = config;

