import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles } from './rootScreen.styles';

export function RootScreenAuthView({
  keyboardVisible,
  authMode,
  form,
  updateField,
  showPassword,
  setShowPassword,
  busy,
  refreshing,
  handleLogin,
  handleVerifyOtp,
  handleForgotPasswordSendCode,
  handleVerifyForgotPasswordCode,
  handleResetForgottenPassword,
  handleSwitchAuthMode,
  handleResendOtp,
  status,
  error,
  openExternalLink,
  termsUrl,
  privacyUrl,
  supportUrl,
}) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View style={styles.authLayout}>
        <ScrollView
          style={styles.authScroll}
          contentContainerStyle={[
            styles.scrollContent,
            styles.authScrollContent,
            keyboardVisible ? styles.scrollContentKeyboard : null,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Home Advisor</Text>
            <Text style={styles.authPoweredBy}>powered by</Text>
            <Text style={styles.authBrand}>Workside Software</Text>
            <Text style={styles.authTagline}>Stay Connected.</Text>

            <View style={styles.authModeCard}>
              <Text style={styles.authModeTitle}>
                {authMode === 'login'
                  ? 'Sign in to continue'
                  : authMode === 'verify_email'
                    ? 'Verify your email code'
                    : authMode === 'forgot_verify'
                      ? 'Verify your reset code'
                      : authMode === 'forgot_reset'
                        ? 'Set a new password'
                        : 'Reset your password'}
              </Text>
              <Text style={styles.authModeCopy}>
                {authMode === 'login'
                  ? 'Use your Workside password to sign in.'
                  : authMode === 'verify_email'
                    ? 'Enter the code from your email to finish secure access on mobile.'
                    : authMode === 'forgot_verify'
                      ? 'Enter the password reset code from your email.'
                      : authMode === 'forgot_reset'
                        ? 'Choose and confirm a new password for this account.'
                        : 'Enter your account email and we will send a password reset code.'}
              </Text>
            </View>

            {authMode !== 'forgot_reset' ? (
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email address"
                placeholderTextColor="#7d8a8f"
                style={styles.input}
                value={form.email}
                onChangeText={(value) => updateField('email', value)}
              />
            ) : null}

            {authMode === 'login' || authMode === 'forgot_reset' ? (
              <View style={styles.passwordWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={authMode === 'forgot_reset' ? 'New password' : 'Password'}
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
            ) : authMode === 'verify_email' || authMode === 'forgot_verify' ? (
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={authMode === 'forgot_verify' ? 'Reset code' : 'OTP code'}
                placeholderTextColor="#7d8a8f"
                style={styles.input}
                value={form.otpCode}
                onChangeText={(value) => updateField('otpCode', value)}
              />
            ) : null}

            {authMode === 'forgot_reset' ? (
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Confirm new password"
                placeholderTextColor="#7d8a8f"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={form.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
              />
            ) : null}

            <Pressable
              onPress={
                authMode === 'login'
                  ? handleLogin
                  : authMode === 'verify_email'
                    ? handleVerifyOtp
                    : authMode === 'forgot_request'
                      ? handleForgotPasswordSendCode
                      : authMode === 'forgot_verify'
                        ? handleVerifyForgotPasswordCode
                        : handleResetForgottenPassword
              }
              style={[styles.button, busy ? styles.buttonDisabled : styles.buttonPrimary]}
              disabled={busy}
            >
              <Text style={styles.buttonText}>
                {busy
                  ? 'Working...'
                  : authMode === 'login'
                    ? 'Log in to workspace'
                    : authMode === 'verify_email'
                      ? 'Verify email code'
                      : authMode === 'forgot_request'
                        ? 'Send reset code'
                        : authMode === 'forgot_verify'
                          ? 'Verify reset code'
                          : 'Set new password'}
              </Text>
            </Pressable>

            <View style={styles.authSecondaryActions}>
              {authMode === 'login' ? (
                <Pressable onPress={handleForgotPasswordSendCode} disabled={busy}>
                  <Text style={styles.inlineLink}>Forget password? Send code.</Text>
                </Pressable>
              ) : authMode === 'forgot_request' ? (
                <Pressable onPress={() => handleSwitchAuthMode('login')} disabled={busy}>
                  <Text style={styles.inlineLink}>Back to password login</Text>
                </Pressable>
              ) : authMode === 'forgot_verify' ? (
                <>
                  <Pressable onPress={handleForgotPasswordSendCode} disabled={busy}>
                    <Text style={styles.inlineLink}>Resend reset code</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSwitchAuthMode('login')} disabled={busy}>
                    <Text style={styles.inlineLink}>Back to password login</Text>
                  </Pressable>
                </>
              ) : authMode === 'forgot_reset' ? (
                <Pressable onPress={() => handleSwitchAuthMode('login')} disabled={busy}>
                  <Text style={styles.inlineLink}>Back to password login</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={handleResendOtp} disabled={busy}>
                    <Text style={styles.inlineLink}>Resend code</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSwitchAuthMode('login')} disabled={busy}>
                    <Text style={styles.inlineLink}>Back to password login</Text>
                  </Pressable>
                </>
              )}
            </View>

            {status ? <Text style={styles.status}>{status}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy || refreshing ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}
          </View>
        </ScrollView>

        <View style={styles.authFooterDock}>
          <View style={styles.authFooter}>
            <Text style={styles.authFooterCopy}>Copyright 2026 Workside Software LLC.</Text>
            <View style={styles.authFooterLinks}>
              <Pressable onPress={() => openExternalLink(termsUrl)}>
                <Text style={styles.authFooterLink}>Terms of Service</Text>
              </Pressable>
              <Pressable onPress={() => openExternalLink(privacyUrl)}>
                <Text style={styles.authFooterLink}>Privacy Notice</Text>
              </Pressable>
              <Pressable onPress={() => openExternalLink(supportUrl)}>
                <Text style={styles.authFooterLink}>Support</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
