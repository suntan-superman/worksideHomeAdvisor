import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  analyzePricing,
  getDashboard,
  listMediaAssets,
  listProperties,
  login,
  requestOtp,
  savePhoto,
  verifyEmailOtp,
} from '../services/api';
import { colors } from '../theme/tokens';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={variant === 'secondary' ? styles.buttonSecondaryLabel : styles.buttonLabel}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [status, setStatus] = useState('Sign in to load your properties and capture listing photos.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    otpCode: '',
    roomLabel: 'Living room',
  });

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId) || null,
    [properties, propertyId],
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadPropertiesForUser(userId) {
    const propertiesResponse = await listProperties(userId);
    const nextProperties = propertiesResponse.properties || [];
    setProperties(nextProperties);
    const nextPropertyId = nextProperties[0]?.id || '';
    setPropertyId(nextPropertyId);

    if (nextPropertyId) {
      const [dashboardResponse, mediaResponse] = await Promise.all([
        getDashboard(nextPropertyId),
        listMediaAssets(nextPropertyId),
      ]);
      setDashboard(dashboardResponse);
      setGallery(mediaResponse.assets || []);
    } else {
      setDashboard(null);
      setGallery([]);
    }
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
      await loadPropertiesForUser(result.user.id);
      setStatus('Mobile workspace loaded.');
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
      await loadPropertiesForUser(result.user.id);
      setStatus('Email verified. Mobile workspace loaded.');
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

  async function handleRefreshProperty(property) {
    setPropertyId(property.id);
    setBusy(true);
    setError('');

    try {
      const [dashboardResponse, mediaResponse] = await Promise.all([
        getDashboard(property.id),
        listMediaAssets(property.id),
      ]);
      setDashboard(dashboardResponse);
      setGallery(mediaResponse.assets || []);
      setAnalysis(null);
      setPhotoAsset(null);
      setStatus(`Loaded ${property.title}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunPricing() {
    if (!propertyId) {
      return;
    }

    setBusy(true);
    setError('');
    setStatus('Running RentCast + AI pricing analysis...');

    try {
      await analyzePricing(propertyId);
      const dashboardResponse = await getDashboard(propertyId);
      setDashboard(dashboardResponse);
      setStatus('Pricing analysis refreshed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function pickImage(mode) {
    setBusy(true);
    setError('');

    try {
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error(`Permission required to ${mode === 'camera' ? 'use the camera' : 'open the photo library'}.`);
      }

      const pickerResult =
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

      if (pickerResult.canceled || !pickerResult.assets?.[0]) {
        setBusy(false);
        return;
      }

      setPhotoAsset(pickerResult.assets[0]);
      setAnalysis(null);
      setStatus('Photo ready. Send it for AI quality analysis when you are ready.');
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
    setStatus('Saving photo and running AI quality analysis...');

    try {
      const response = await savePhoto(propertyId, {
        roomLabel: form.roomLabel,
        mimeType: photoAsset.mimeType || 'image/jpeg',
        imageBase64: photoAsset.base64,
        width: photoAsset.width,
        height: photoAsset.height,
      });
      const mediaResponse = await listMediaAssets(propertyId);
      setAnalysis(response.analysis);
      setGallery(mediaResponse.assets || []);
      setStatus('Photo saved to the property gallery and analyzed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Powered by Workside Software</Text>
        <Text style={styles.title}>Capture photos and improve them fast.</Text>
        <Text style={styles.body}>
          The mobile app now focuses on the seller’s field workflow: sign in,
          pick a property, capture room photos, and get AI feedback on quality
          and retake suggestions.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile sign-in</Text>
        <Text style={styles.cardBody}>
          Use the same verified seller account you created on the web portal.
        </Text>
        <View style={styles.segmentRow}>
          <ActionButton
            label="Log in"
            onPress={() => setAuthMode('login')}
            variant={authMode === 'login' ? 'primary' : 'secondary'}
          />
          <ActionButton
            label="Verify OTP"
            onPress={() => setAuthMode('verify')}
            variant={authMode === 'verify' ? 'primary' : 'secondary'}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="seller@example.com"
          placeholderTextColor="#7d8a8f"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
        />
        {authMode === 'login' ? (
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#7d8a8f"
            secureTextEntry
            value={form.password}
            onChangeText={(value) => updateField('password', value)}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="6-digit OTP"
            placeholderTextColor="#7d8a8f"
            value={form.otpCode}
            onChangeText={(value) => updateField('otpCode', value)}
          />
        )}
        <View style={styles.segmentRow}>
          <ActionButton
            label={busy ? 'Working...' : authMode === 'login' ? 'Log in' : 'Verify'}
            onPress={authMode === 'login' ? handleLogin : handleVerifyOtp}
            disabled={busy}
          />
          {authMode === 'verify' ? (
            <ActionButton
              label="Resend OTP"
              onPress={handleResendOtp}
              variant="secondary"
              disabled={busy || !form.email}
            />
          ) : null}
        </View>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {busy ? <ActivityIndicator color={colors.clay} style={styles.spinner} /> : null}

      {session?.user ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Property workspace</Text>
            <Text style={styles.cardBody}>
              Signed in as {session.user.email}. Choose a property to inspect and photograph.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyRow}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  onPress={() => handleRefreshProperty(property)}
                  style={[
                    styles.propertyChip,
                    property.id === propertyId ? styles.propertyChipActive : null,
                  ]}
                >
                  <Text style={styles.propertyChipTitle}>{property.title}</Text>
                  <Text style={styles.propertyChipMeta}>
                    {property.city}, {property.state}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedProperty ? (
              <View style={styles.readinessCard}>
                <Text style={styles.readinessLabel}>{selectedProperty.title}</Text>
                <Text style={styles.readinessScore}>
                  {dashboard?.pricing
                    ? `${formatCurrency(dashboard.pricing.low)} to ${formatCurrency(dashboard.pricing.high)}`
                    : 'Run pricing analysis'}
                </Text>
                <Text style={styles.readinessBody}>
                  {dashboard?.pricingSummary ||
                    'Once pricing runs, this card will show the latest RentCast + AI summary.'}
                </Text>
                <ActionButton
                  label="Refresh pricing"
                  onPress={handleRunPricing}
                  disabled={busy}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photo capture + AI review</Text>
            <Text style={styles.cardBody}>
              Capture the room, then let AI score lighting, composition, clarity, and retake value.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Room label"
              placeholderTextColor="#7d8a8f"
              value={form.roomLabel}
              onChangeText={(value) => updateField('roomLabel', value)}
            />
            <View style={styles.segmentRow}>
              <ActionButton label="Use camera" onPress={() => pickImage('camera')} disabled={busy || !propertyId} />
              <ActionButton
                label="Photo library"
                onPress={() => pickImage('library')}
                variant="secondary"
                disabled={busy || !propertyId}
              />
            </View>
            {photoAsset?.uri ? (
              <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} />
            ) : null}
            <ActionButton
              label="Save + analyze photo"
              onPress={handleSavePhoto}
              disabled={busy || !propertyId || !photoAsset?.base64}
            />
          </View>

          {analysis ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>AI photo analysis</Text>
              <Text style={styles.analysisHeadline}>
                {analysis.roomGuess} · {analysis.overallQualityScore}/100
              </Text>
              <Text style={styles.cardBody}>{analysis.summary}</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Lighting</Text>
                  <Text style={styles.scorePillValue}>{analysis.lightingScore}</Text>
                </View>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Composition</Text>
                  <Text style={styles.scorePillValue}>{analysis.compositionScore}</Text>
                </View>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Clarity</Text>
                  <Text style={styles.scorePillValue}>{analysis.clarityScore}</Text>
                </View>
              </View>
              <Text style={styles.analysisSubhead}>Best use</Text>
              <Text style={styles.cardBody}>{analysis.bestUse}</Text>
              <Text style={styles.analysisSubhead}>Suggestions</Text>
              {analysis.suggestions.map((item) => (
                <Text key={item} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
              <Text style={styles.analysisSubhead}>Issues</Text>
              {analysis.issues.map((item) => (
                <Text key={item} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saved photo gallery</Text>
            <Text style={styles.cardBody}>
              Each saved photo is now tied to the selected property in MongoDB along with its latest AI review.
            </Text>
            {gallery.length === 0 ? (
              <Text style={styles.cardBody}>No saved photos yet for this property.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                {gallery.map((asset) => (
                  <View key={asset.id} style={styles.galleryCard}>
                    <Image
                      source={{ uri: asset.imageUrl || asset.imageDataUrl }}
                      style={styles.galleryImage}
                    />
                    <Text style={styles.galleryTitle}>{asset.roomLabel}</Text>
                    <Text style={styles.galleryMeta}>
                      {asset.analysis?.overallQualityScore || '--'}/100 · {asset.analysis?.retakeRecommended ? 'Retake' : 'Usable'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    paddingTop: 24,
    gap: 12,
  },
  kicker: {
    color: colors.moss,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.cream,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
  body: {
    color: colors.sand,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  cardTitle: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: '700',
  },
  cardBody: {
    color: colors.sand,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.panelSoft,
    color: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.clay,
  },
  buttonSecondary: {
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#fff7f0',
    fontWeight: '700',
  },
  buttonSecondaryLabel: {
    color: colors.cream,
    fontWeight: '700',
  },
  status: {
    color: colors.moss,
    backgroundColor: 'rgba(124, 162, 127, 0.1)',
    borderRadius: 16,
    padding: 12,
    lineHeight: 20,
  },
  error: {
    color: '#f0a08e',
    backgroundColor: 'rgba(174, 67, 53, 0.12)',
    borderRadius: 16,
    padding: 12,
    lineHeight: 20,
  },
  spinner: {
    marginVertical: 8,
  },
  propertyRow: {
    gap: 10,
    paddingVertical: 4,
  },
  galleryRow: {
    gap: 12,
    paddingVertical: 4,
  },
  propertyChip: {
    width: 200,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  propertyChipActive: {
    borderColor: colors.clay,
  },
  propertyChipTitle: {
    color: colors.cream,
    fontWeight: '700',
  },
  propertyChipMeta: {
    color: colors.sand,
    fontSize: 13,
  },
  readinessCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.clay,
    gap: 8,
  },
  readinessLabel: {
    color: '#fff6ef',
    fontSize: 14,
    opacity: 0.9,
  },
  readinessScore: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  readinessBody: {
    color: '#fff6ef',
    fontSize: 15,
    lineHeight: 22,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
  },
  galleryCard: {
    width: 168,
    gap: 8,
  },
  galleryImage: {
    width: 168,
    height: 126,
    borderRadius: 16,
    backgroundColor: colors.panelSoft,
  },
  galleryTitle: {
    color: colors.cream,
    fontWeight: '700',
  },
  galleryMeta: {
    color: colors.sand,
    fontSize: 13,
  },
  analysisHeadline: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
  },
  analysisSubhead: {
    color: colors.moss,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scorePill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    minWidth: 92,
  },
  scorePillLabel: {
    color: colors.sand,
    fontSize: 12,
  },
  scorePillValue: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: '700',
  },
  listItem: {
    color: colors.sand,
    lineHeight: 22,
  },
});
