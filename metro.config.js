const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix: Metro on Windows fails to resolve react-native-web's VirtualizedList
// directory when imports use relative paths crossing package boundaries.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix: Metro on web fails to resolve react-native-svg (tries lib/module, which doesn't exist)
  if (platform === 'web' && moduleName === 'react-native-svg') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-svg/lib/commonjs/index.js'
      ),
      type: 'sourceFile',
    };
  }
  if (
    platform === 'web' &&
    moduleName.endsWith('VirtualizedList') &&
    context.originModulePath.includes('react-native-web')
  ) {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/index.js'
      ),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
