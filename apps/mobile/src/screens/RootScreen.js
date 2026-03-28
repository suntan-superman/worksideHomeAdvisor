import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'not configured';

export function RootScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Fresh Mobile Baseline</Text>
        <Text style={styles.title}>Workside Home Advisor</Text>
        <Text style={styles.body}>
          This is a clean Expo rebuild baseline. Once this boots on Android and iOS, we can port
          features back from `latest-mobile-app/mobile` one safe slice at a time.
        </Text>
        <Text style={styles.label}>API endpoint</Text>
        <Text style={styles.value}>{apiUrl}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#162027',
  },
  card: {
    backgroundColor: '#26323d',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#384855',
  },
  kicker: {
    color: '#93a982',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8f1e6',
    fontSize: 32,
    fontWeight: '800',
  },
  body: {
    color: '#dbcbb7',
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    color: '#93a982',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  value: {
    color: '#f3a56a',
    fontSize: 15,
    lineHeight: 22,
  },
});
