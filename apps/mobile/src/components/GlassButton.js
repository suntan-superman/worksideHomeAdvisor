import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/tokens';

export function GlassButton({
  label,
  onPress,
  disabled = false,
  compact = false,
  variant = 'primary',
  style,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        compact ? styles.buttonCompact : null,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'destructive' ? styles.destructive : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={styles.innerGlow} pointerEvents="none" />
      <Text
        style={[
          styles.label,
          variant === 'secondary' ? styles.secondaryLabel : null,
          variant === 'destructive' ? styles.destructiveLabel : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.clay,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#05080b',
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.line,
  },
  destructive: {
    backgroundColor: 'rgba(173, 75, 61, 0.24)',
    borderColor: 'rgba(255, 161, 145, 0.26)',
  },
  disabled: {
    opacity: 0.48,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '52%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    color: '#fff7f0',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryLabel: {
    color: colors.cream,
  },
  destructiveLabel: {
    color: '#ffd7cf',
  },
});
