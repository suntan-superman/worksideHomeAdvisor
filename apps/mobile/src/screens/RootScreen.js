import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import {
  API_URL,
  getDashboard,
  listMediaAssets,
  listProperties,
  login,
  requestOtp,
  savePhoto,
  verifyEmailOtp,
} from '../services/api';

const ROOM_LABEL_OPTIONS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Signed-in user';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCreatedAt(value) {
  if (!value) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    return '';
  }
}

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [propertyDetailsCollapsed, setPropertyDetailsCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Sign in with the same verified seller account you use on the web.');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [photoAsset, setPhotoAsset] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    otpCode: '',
    roomLabel: ROOM_LABEL_OPTIONS[0],
  });

  const selectedProperty = properties.find((property) => property.id === propertyId) || null;
  const selectedAsset = gallery.find((asset) => asset.id === selectedAssetId) || gallery[0] || null;

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadPropertyWorkspace(userId) {
    const propertiesResponse = await listProperties(userId);
    const nextProperties = propertiesResponse.properties || [];
    const nextPropertyId = nextProperties[0]?.id || '';
    setProperties(nextProperties);
    setPropertyId(nextPropertyId);

    if (!nextPropertyId) {
      setDashboard(null);
      return;
    }

    const [dashboardResponse, mediaResponse] = await Promise.all([
      getDashboard(nextPropertyId),
      listMediaAssets(nextPropertyId),
    ]);
    setDashboard(dashboardResponse);
    setGallery(mediaResponse.assets || []);
    setSelectedAssetId(mediaResponse.assets?.[0]?.id || '');
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
      await loadPropertyWorkspace(result.user.id);
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
      await loadPropertyWorkspace(result.user.id);
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
    setProperties([]);
    setPropertyId('');
    setDashboard(null);
    setGallery([]);
    setSelectedAssetId('');
    setAuthMode('login');
    setShowPassword(false);
    setError('');
    setStatus('Signed out. Sign in again to continue.');
  }

  async function handleSelectProperty(nextPropertyId) {
    setBusy(true);
    setError('');

    try {
      setPropertyId(nextPropertyId);
      setPropertyDetailsCollapsed(false);
      const [dashboardResponse, mediaResponse] = await Promise.all([
        getDashboard(nextPropertyId),
        listMediaAssets(nextPropertyId),
      ]);
      setDashboard(dashboardResponse);
      setGallery(mediaResponse.assets || []);
      setSelectedAssetId(mediaResponse.assets?.[0]?.id || '');
      const nextProperty = properties.find((property) => property.id === nextPropertyId);
      setStatus(nextProperty ? `Loaded ${nextProperty.title}.` : 'Property loaded.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickImage(mode) {
    if (!propertyId) {
      setError('Select a property before capturing photos.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error(
          `Permission required to ${mode === 'camera' ? 'use the camera' : 'open the photo library'}.`,
        );
      }

      const result =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.6,
              base64: true,
            });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setPhotoAsset(result.assets[0]);
      setStatus('Photo ready. Save it to the property when you are ready.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePhoto() {
    if (!propertyId || !photoAsset?.base64) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await savePhoto(propertyId, {
        roomLabel: form.roomLabel,
        mimeType: photoAsset.mimeType || 'image/jpeg',
        imageBase64: photoAsset.base64,
        width: photoAsset.width,
        height: photoAsset.height,
      });
      const mediaResponse = await listMediaAssets(propertyId);
      setGallery(mediaResponse.assets || []);
      setSelectedAssetId(mediaResponse.assets?.[0]?.id || '');
      setPhotoAsset(null);
      setStatus('Photo saved to the selected property.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (session?.user) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.kicker}>Property Baseline</Text>
            <Text style={styles.title}>Workside Home Advisor</Text>
            <Text style={styles.body}>
              The app is authenticated and loading live property data again. Next we can layer in capture and gallery safely.
            </Text>

            <View style={styles.userCard}>
              <Text style={styles.label}>Signed in as</Text>
              <Text style={styles.userName}>{getDisplayName(session.user)}</Text>
              <Text style={styles.userEmail}>{session.user.email}</Text>
            </View>

            <Text style={styles.label}>Properties</Text>
            <View style={styles.propertyList}>
              {properties.length ? (
                properties.map((property) => (
                  <Pressable
                    key={property.id}
                    onPress={() => handleSelectProperty(property.id)}
                    style={[
                      styles.propertyCard,
                      property.id === propertyId ? styles.propertyCardActive : null,
                    ]}
                  >
                    <Text style={styles.propertyTitle}>{property.title}</Text>
                    <Text style={styles.propertyMeta}>
                      {[property.city, property.state].filter(Boolean).join(', ')}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.body}>No properties were found for this account yet.</Text>
              )}
            </View>

            {selectedProperty ? (
              <View style={styles.workspaceCard}>
                <View style={styles.workspaceHeaderRow}>
                  <View style={styles.workspaceHeaderCopy}>
                    <Text style={styles.label}>Selected property</Text>
                    <Text style={styles.userName}>{selectedProperty.title}</Text>
                    <Text style={styles.userEmail}>
                      {[
                        selectedProperty.addressLine1,
                        [selectedProperty.city, selectedProperty.state, selectedProperty.zip].filter(Boolean).join(' '),
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setPropertyDetailsCollapsed((current) => !current)}
                    style={styles.collapseButton}
                  >
                    <Text style={styles.collapseButtonText}>
                      {propertyDetailsCollapsed ? 'Expand' : 'Collapse'}
                    </Text>
                  </Pressable>
                </View>

                {!propertyDetailsCollapsed ? (
                  <>
                    {dashboard?.pricing ? (
                      <View style={styles.pricingCard}>
                        <Text style={styles.label}>Recommended price band</Text>
                        <Text style={styles.priceBand}>
                          {formatCurrency(dashboard.pricing.low)} to {formatCurrency(dashboard.pricing.high)}
                        </Text>
                        <Text style={styles.body}>
                          Midpoint {formatCurrency(dashboard.pricing.mid)} with{' '}
                          {Math.round((dashboard.pricing.confidence || 0) * 100)}% confidence.
                        </Text>
                      </View>
                    ) : null}

                    {dashboard?.pricingSummary ? (
                      <>
                        <Text style={styles.label}>Latest analysis</Text>
                        <Text style={styles.body}>{dashboard.pricingSummary}</Text>
                      </>
                    ) : null}

                    <View style={styles.captureCard}>
                      <Text style={styles.label}>Photo capture</Text>
                      <Text style={styles.body}>
                        Capture or select the next room photo and save it to this property.
                      </Text>

                      <View style={styles.roomChipRow}>
                        {ROOM_LABEL_OPTIONS.map((room) => (
                          <Pressable
                            key={room}
                            onPress={() => updateField('roomLabel', room)}
                            style={[
                              styles.roomChip,
                              form.roomLabel === room ? styles.roomChipActive : null,
                            ]}
                          >
                            <Text style={form.roomLabel === room ? styles.roomChipLabelActive : styles.roomChipLabel}>
                              {room}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.actionRow}>
                        <Pressable
                          onPress={() => handlePickImage('camera')}
                          style={[styles.button, styles.buttonSecondary, styles.flexButton]}
                        >
                          <Text style={styles.buttonSecondaryText}>Use camera</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handlePickImage('library')}
                          style={[styles.button, styles.buttonSecondary, styles.flexButton]}
                        >
                          <Text style={styles.buttonSecondaryText}>Photo library</Text>
                        </Pressable>
                      </View>

                    {photoAsset ? (
                      <View style={styles.photoPreviewCard}>
                          <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} />
                          <Text style={styles.body}>
                            Ready to save as {form.roomLabel.toLowerCase()} for this property.
                          </Text>
                          <Pressable
                            onPress={handleSavePhoto}
                            style={[styles.button, busy ? styles.buttonDisabled : styles.buttonPrimary]}
                            disabled={busy}
                          >
                            <Text style={styles.buttonText}>Save photo</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.galleryCard}>
                      <Text style={styles.label}>Saved photo gallery</Text>
                      <Text style={styles.body}>
                        Saved photos stay attached to this property and can feed later flyer and vision workflows.
                      </Text>

                      {gallery.length ? (
                        <>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.galleryRail}
                          >
                            {gallery.map((asset) => (
                              <Pressable
                                key={asset.id}
                                onPress={() => setSelectedAssetId(asset.id)}
                                style={[
                                  styles.galleryTile,
                                  asset.id === selectedAsset?.id ? styles.galleryTileActive : null,
                                ]}
                              >
                                <Image source={{ uri: asset.imageUrl }} style={styles.galleryTileImage} />
                                <Text style={styles.galleryTileLabel} numberOfLines={1}>
                                  {asset.roomLabel}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>

                          {selectedAsset ? (
                            <View style={styles.selectedAssetCard}>
                              <Image source={{ uri: selectedAsset.imageUrl }} style={styles.selectedAssetImage} />
                              <Text style={styles.selectedAssetTitle}>{selectedAsset.roomLabel}</Text>
                              <Text style={styles.selectedAssetMeta}>
                                Saved {formatCreatedAt(selectedAsset.createdAt) || 'recently'}
                                {selectedAsset.analysis?.roomGuess
                                  ? ` · AI sees ${selectedAsset.analysis.roomGuess.toLowerCase()}`
                                  : ''}
                              </Text>
                              {selectedAsset.analysis?.summary ? (
                                <Text style={styles.body}>{selectedAsset.analysis.summary}</Text>
                              ) : null}
                              {typeof selectedAsset.analysis?.overallQualityScore === 'number' ? (
                                <Text style={styles.assetScore}>
                                  Quality score {selectedAsset.analysis.overallQualityScore}/100
                                  {selectedAsset.analysis?.retakeRecommended ? ' · Retake suggested' : ''}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <Text style={styles.body}>No saved photos yet for this property.</Text>
                      )}
                    </View>
                  </>
                ) : (
                  <Text style={styles.body}>Property details are collapsed. Expand when you want pricing and capture tools.</Text>
                )}
              </View>
            ) : null}

            {status ? <Text style={styles.status}>{status}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}

            <Text style={styles.label}>API endpoint</Text>
            <Text style={styles.value}>{API_URL}</Text>

            <Pressable onPress={handleSignOut} style={[styles.button, styles.buttonSecondary]}>
              <Text style={styles.buttonSecondaryText}>Sign out</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
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
  propertyList: {
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  propertyCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
    gap: 4,
  },
  propertyCardActive: {
    borderColor: '#d28859',
    backgroundColor: '#3a4752',
  },
  propertyTitle: {
    color: '#f8f1e6',
    fontSize: 18,
    fontWeight: '800',
  },
  propertyMeta: {
    color: '#dbcbb7',
    fontSize: 14,
  },
  workspaceCard: {
    gap: 10,
    marginTop: 4,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  workspaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  workspaceHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  collapseButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  collapseButtonText: {
    color: '#f8f1e6',
    fontSize: 13,
    fontWeight: '700',
  },
  pricingCard: {
    gap: 6,
    marginTop: 2,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  priceBand: {
    color: '#fff7ee',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
  },
  captureCard: {
    gap: 12,
    marginTop: 8,
    paddingTop: 4,
  },
  galleryCard: {
    gap: 12,
    marginTop: 8,
    paddingTop: 4,
  },
  roomChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomChip: {
    minWidth: 92,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  roomChipActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  roomChipLabel: {
    color: '#dbcbb7',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  roomChipLabelActive: {
    color: '#fff7ee',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  photoPreviewCard: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#1b252d',
  },
  galleryRail: {
    gap: 12,
    paddingVertical: 2,
  },
  galleryTile: {
    width: 108,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  galleryTileActive: {
    borderColor: '#d28859',
  },
  galleryTileImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1b252d',
  },
  galleryTileLabel: {
    color: '#f8f1e6',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectedAssetCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  selectedAssetImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#1b252d',
  },
  selectedAssetTitle: {
    color: '#f8f1e6',
    fontSize: 18,
    fontWeight: '800',
  },
  selectedAssetMeta: {
    color: '#dbcbb7',
    fontSize: 14,
    lineHeight: 20,
  },
  assetScore: {
    color: '#93a982',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
