import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';

import { RootScreen } from './src/screens/RootScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <RootScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#162027',
  },
});
