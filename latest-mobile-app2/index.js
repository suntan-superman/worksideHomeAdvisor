import React from 'react';
import 'expo/src/Expo.fx';
import { AppRegistry } from 'react-native';

import App from './App.js';

console.log('[boot] index.js loaded');
console.log('[boot] registering root component');

AppRegistry.registerComponent('main', () => {
  console.log('[boot] AppRegistry provider invoked');
  return function BootstrappedApp(props) {
    console.log('[boot] BootstrappedApp render');
    return <App {...props} />;
  };
});
