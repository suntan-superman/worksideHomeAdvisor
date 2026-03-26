import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView } from 'react-native';

import { RootScreen } from './src/screens/RootScreen';
import { colors } from './src/theme/tokens';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <RootScreen />
    </SafeAreaView>
  );
}
