/* config-overrides.js */
const path = require('path');

module.exports = function override(config, env) {
  // Force webpack to resolve ajv to the correct version
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      'ajv': path.resolve(__dirname, 'node_modules/ajv'),
      'ajv-keywords': path.resolve(__dirname, 'node_modules/ajv-keywords'),
      'schema-utils': path.resolve(__dirname, 'node_modules/schema-utils')
    }
  };
  
  return config;
} 