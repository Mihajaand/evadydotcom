const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Redirige react-native-maps vers un stub sur le web (module natif non supporté)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: `${__dirname}/src/mocks/react-native-maps.js`,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
