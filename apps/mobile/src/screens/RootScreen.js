import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { API_URL, login, requestOtp, verifyEmailOtp } from '../services/api';

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Signed-in user';
}

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Sign in with the same verified seller account you use on the web.');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    otpCode: '',
  });

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleLogin() {
    setBusy(true);
    setError('');

    try {
      const result = await login({
        email: form.email,
        password: form.password,
      });

      if (result.requiresOtpVerification) {
        setAuthMode('verify');
        setStatus('Your account needs OTP verification before the mobile workspace can load.');
        return;
      }

      setSession(result);
      setStatus('Signed in successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setBusy(true);
    setError('');

    try {
      const result = await verifyEmailOtp({
        email: form.email,
        otpCode: form.otpCode,
      });
      setSession(result);
      setStatus('Email verified. Signed in successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    setBusy(true);
    setError('');

    try {
      await requestOtp({ email: form.email });
      setStatus('A fresh OTP was sent to your email.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function handleSignOut() {
    setSession(null);
    setAuthMode('login');
    setShowPassword(false);
    setError('');
    setStatus('Signed out. Sign in again to continue.');
  }

  if (session?.user) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Authenticated Baseline</Text>
          <Text style={styles.title}>Workside Home Advisor</Text>
          <Text style={styles.body}>
            The live auth flow is connected. Next we can bring back the property workspace safely.
          </Text>

          <View style={styles.userCard}>
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.userName}>{getDisplayName(session.user)}</Text>
            <Text style={styles.userEmail}>{session.user.email}</Text>
          </View>

          <Text style={styles.label}>API endpoint</Text>
          <Text style={styles.value}>{API_URL}</Text>

          <Pressable onPress={handleSignOut} style={[styles.button, styles.buttonSecondary]}>
            <Text style={styles.buttonSecondaryText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>Fresh Mobile Baseline</Text>
          <Text style={styles.title}>Workside Home Advisor</Text>
          <Text style={styles.body}>
            Clean auth-only rebuild. Once this signs in reliably on Android and iOS, we can layer
            the property workflow back on safely.
          </Text>

          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setAuthMode('login')}
              style={[styles.segmentButton, authMode === 'login' ? styles.segmentButtonActive : null]}
            >
              <Text style={authMode === 'login' ? styles.segmentLabelActive : styles.segmentLabel}>
                Log in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('verify')}
              style={[styles.segmentButton, authMode === 'verify' ? styles.segmentButtonActive : null]}
            >
              <Text style={authMode === 'verify' ? styles.segmentLabelActive : styles.segmentLabel}>
                Verify OTP
              </Text>
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#7d8a8f"
            style={styles.input}
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
          />

          {authMode === 'login' ? (
            <View style={styles.passwordWrap}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Password"
                placeholderTextColor="#7d8a8f"
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                value={form.password}
                onChangeText={(value) => updateField('password', value)}
              />
              <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                <Text style={styles.eyeButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          ) : (
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="OTP code"
              placeholderTextColor="#7d8a8f"
              style={styles.input}
              value={form.otpCode}
              onChangeText={(value) => updateField('otpCode', value)}
            />
          )}

          <Pressable
            onPress={authMode === 'login' ? handleLogin : handleVerifyOtp}
            style={[styles.button, busy ? styles.buttonDisabled : styles.buttonPrimary]}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Working...' : authMode === 'login' ? 'Continue' : 'Verify email'}
            </Text>
          </Pressable>

          {authMode === 'verify' ? (
            <Pressable onPress={handleResendOtp} disabled={busy}>
              <Text style={styles.inlineLink}>Resend OTP</Text>
            </Pressable>
          ) : null}

          {status ? <Text style={styles.status}>{status}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}

          <Text style={styles.label}>API endpoint</Text>
          <Text style={styles.value}>{API_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#162027',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
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
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  segmentButtonActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  segmentLabel: {
    color: '#dbcbb7',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentLabelActive: {
    color: '#fff7ee',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    borderRadius: 18,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
    color: '#f8f1e6',
    fontSize: 17,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 84,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeButtonText: {
    color: '#f3a56a',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#d28859',
  },
  buttonSecondary: {
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff7ee',
    fontSize: 17,
    fontWeight: '800',
  },
  buttonSecondaryText: {
    color: '#f8f1e6',
    fontSize: 16,
    fontWeight: '700',
  },
  inlineLink: {
    color: '#f3a56a',
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    color: '#93a982',
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: '#f0a08e',
    fontSize: 15,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 4,
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
  userCard: {
    gap: 4,
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  userName: {
    color: '#f8f1e6',
    fontSize: 20,
    fontWeight: '800',
  },
  userEmail: {
    color: '#dbcbb7',
    fontSize: 15,
  },
});
