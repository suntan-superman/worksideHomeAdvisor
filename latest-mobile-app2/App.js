import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

console.log('[boot] App.js module loaded');

export default function App() {
  console.log('[boot] App component render');

  let RootScreen = null;
  let rootScreenLoadError = null;

  try {
    RootScreen = require('./src/screens/RootScreen').RootScreen;
    console.log('[boot] RootScreen require succeeded');
  } catch (error) {
    rootScreenLoadError = error;
    console.log('[boot] RootScreen require failed', error?.message || error);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#162027' }}>
      {RootScreen ? (
        <RootScreen />
      ) : (
        <View
          style={{
            flex: 1,
            padding: 24,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Text style={{ color: '#f8f1e6', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            Workside Home Advisor
          </Text>
          <Text style={{ color: '#dbcbb7', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            Mobile workspace failed to load.
          </Text>
          <Text style={{ color: '#f0a08e', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            {rootScreenLoadError?.message || 'Unknown startup error.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
