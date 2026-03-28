import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  analyzePricing,
  deleteAccount as deleteAccountRequest,
  getDashboard,
  listMediaAssets,
  listProperties,
  login,
  requestOtp,
  savePhoto,
  verifyEmailOtp,
} from '../services/api';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { device, radius, spacing, typography } from '../theme/responsive';
import { colors } from '../theme/tokens';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Signed-in user';
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false, compact = false }) {
  return (
    <GlassButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      compact={compact}
      variant={variant}
    />
  );
}

function TabChip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabChip, active ? styles.tabChipActive : null]}>
      <Text style={active ? styles.tabChipLabelActive : styles.tabChipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function BottomTabButton({ label, active, onPress, accent }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.bottomTabButton}>
      <View
        style={[
          styles.bottomTabIconWrap,
          active ? styles.bottomTabIconWrapActive : null,
          active && accent ? { borderColor: accent, backgroundColor: `${accent}22` } : null,
        ]}
      >
        <View
          style={[
            styles.bottomTabDot,
            active ? styles.bottomTabDotActive : null,
            active && accent ? { backgroundColor: accent } : null,
          ]}
        />
      </View>
      <Text style={active ? styles.bottomTabLabelActive : styles.bottomTabLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScoreBadge({ label, value }) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scorePillLabel}>{label}</Text>
      <Text style={styles.scorePillValue}>{value}</Text>
    </View>
  );
}

const LAST_LOGIN_EMAIL_KEY = 'workside.lastLoginEmail';
const BIOMETRIC_ENABLED_KEY = 'workside.biometricEnabled';
const BIOMETRIC_CREDENTIALS_KEY = 'workside.biometricCredentials';
const APP_WEB_URL = Constants.expoConfig?.extra?.webUrl || 'https://worksidehomeadvisor.netlify.app';
const TERMS_URL = `${APP_WEB_URL}/terms`;
const PRIVACY_URL = `${APP_WEB_URL}/privacy`;
const SUPPORT_EMAIL =
  Constants.expoConfig?.extra?.supportEmail || 'support@worksidesoftware.com';

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('properties');
  const [propertySection, setPropertySection] = useState('overview');
  const [propertyDetailsCollapsed, setPropertyDetailsCollapsed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometricCredentials, setHasBiometricCredentials] = useState(false);
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState('');
  const [galleryFilter, setGalleryFilter] = useState('All');
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

  const selectedPhoto = useMemo(
    () => gallery.find((asset) => asset.id === selectedPhotoId) || gallery[0] || null,
    [gallery, selectedPhotoId],
  );

  const galleryFilters = useMemo(() => {
    const roomLabels = gallery
      .map((asset) => asset.roomLabel)
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);

    return ['All', ...roomLabels];
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    if (galleryFilter === 'All') {
      return gallery;
    }

    return gallery.filter((asset) => asset.roomLabel === galleryFilter);
  }, [gallery, galleryFilter]);

  const featuredPhotoCount = useMemo(
    () => gallery.filter((asset) => !asset.analysis?.retakeRecommended).length,
    [gallery],
  );

  const bestPhotoCandidates = useMemo(
    () =>
      [...gallery]
        .filter((asset) => asset.analysis)
        .sort(
          (left, right) =>
            Number(right.analysis?.overallQualityScore || 0) -
            Number(left.analysis?.overallQualityScore || 0),
        )
        .slice(0, 3),
    [gallery],
  );

  const roomCoverage = useMemo(() => {
    const capturedRooms = new Set(gallery.map((asset) => asset.roomLabel).filter(Boolean));
    const recommendedRooms = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
    return recommendedRooms.map((room) => ({
      room,
      captured: capturedRooms.has(room),
    }));
  }, [gallery]);

  const sellerTasks = useMemo(() => {
    const tasks = [];

    if (!selectedProperty) {
      return tasks;
    }

    tasks.push({
      key: 'pricing',
      title: dashboard?.pricing?.mid ? 'Refresh pricing before launch' : 'Run your first pricing analysis',
      detail: dashboard?.pricing?.mid
        ? `Current midpoint is ${formatCurrency(dashboard.pricing.mid)}. Refresh after major prep or staging updates.`
        : 'Use the live comps workflow to generate a fresh list-price band for this property.',
      done: Boolean(dashboard?.pricing?.mid),
      tone: dashboard?.pricing?.mid ? 'done' : 'open',
    });

    tasks.push({
      key: 'photos',
      title: gallery.length >= 5 ? 'Review best listing photos' : 'Capture the core listing rooms',
      detail:
        gallery.length >= 5
          ? `${featuredPhotoCount} photos currently look like good flyer candidates. Review the weakest rooms for retakes.`
          : 'Aim for at least living room, kitchen, primary bedroom, bathroom, and exterior coverage.',
      done: gallery.length >= 5,
      tone: gallery.length >= 5 ? 'done' : 'open',
    });

    const retakeCount = gallery.filter((asset) => asset.analysis?.retakeRecommended).length;
    tasks.push({
      key: 'retakes',
      title: retakeCount ? 'Address photo retake recommendations' : 'No retakes currently flagged',
      detail: retakeCount
        ? `${retakeCount} saved photos were flagged by AI for lighting, clarity, or composition improvements.`
        : 'Your saved photo set is currently in good shape for marketing review.',
      done: retakeCount === 0,
      tone: retakeCount === 0 ? 'done' : 'warning',
    });

    tasks.push({
      key: 'flyer',
      title: 'Generate or refresh the flyer draft',
      detail:
        'Once pricing and core photos look strong, regenerate the flyer so the property story reflects the latest market position.',
      done: false,
      tone: 'open',
    });

    return tasks;
  }, [dashboard, featuredPhotoCount, gallery, selectedProperty]);

  const topComps = dashboard?.pricing?.selectedComps?.slice(0, 4) || [];
  const accountDeletionBlocked = Boolean(
    session?.user?.isDemoAccount || session?.user?.role === 'admin' || session?.user?.role === 'super_admin',
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLocalAuthState() {
      try {
        const [savedEmail, biometricPreference, biometricCreds, hardwareAvailable, enrolled] = await Promise.all([
          SecureStore.getItemAsync(LAST_LOGIN_EMAIL_KEY),
          SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
          SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        if (savedEmail && isMounted) {
          setForm((current) => ({
            ...current,
            email: current.email || savedEmail,
          }));
        }

        if (isMounted) {
          setBiometricAvailable(Boolean(hardwareAvailable && enrolled));
          setBiometricEnabled(biometricPreference === 'true');
          setHasBiometricCredentials(Boolean(biometricCreds));
        }
      } catch (storageError) {
        // Keep auth usable even if secure storage is unavailable.
      }
    }

    loadLocalAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function persistLastLoginEmail(email) {
    try {
      await SecureStore.setItemAsync(LAST_LOGIN_EMAIL_KEY, email);
    } catch (storageError) {
      // Login should still succeed even if persistence is unavailable.
    }
  }

  async function persistBiometricCredentials(email, password) {
    try {
      await SecureStore.setItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        JSON.stringify({
          email,
          password,
        }),
      );
      setHasBiometricCredentials(true);
    } catch (storageError) {
      setHasBiometricCredentials(false);
    }
  }

  async function clearBiometricCredentials() {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    } catch (storageError) {
      // Ignore cleanup failures.
    } finally {
      setHasBiometricCredentials(false);
    }
  }

  async function setBiometricPreference(nextValue) {
    try {
      if (nextValue) {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      } else {
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }
      setBiometricEnabled(nextValue);
    } catch (storageError) {
      setError('Unable to update biometric preference on this device.');
    }
  }

  function resetWorkspaceState() {
    setProperties([]);
    setPropertyId('');
    setDashboard(null);
    setPhotoAsset(null);
    setAnalysis(null);
    setGallery([]);
    setSelectedPhotoId('');
    setGalleryFilter('All');
    setActiveTab('properties');
    setPropertySection('overview');
    setPropertyDetailsCollapsed(false);
  }

  function handleSignOut() {
    setSession(null);
    resetWorkspaceState();
    setShowPassword(false);
    setError('');
    setStatus('Signed out. Sign in to load your properties and capture listing photos.');
  }

  async function handleBiometricLogin() {
    if (!biometricAvailable || !biometricEnabled || !hasBiometricCredentials) {
      setError('Biometric login is not ready on this device yet.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios' ? 'Unlock Workside Home Advisor' : 'Confirm your identity',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!biometricResult.success) {
        throw new Error('Biometric authentication was cancelled or failed.');
      }

      const credentialsRaw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!credentialsRaw) {
        throw new Error('No saved biometric login credentials were found.');
      }

      const credentials = JSON.parse(credentialsRaw);
      const result = await login({
        email: credentials.email,
        password: credentials.password,
      });

      if (result.requiresOtpVerification) {
        setAuthMode('verify');
        updateField('email', credentials.email);
        setStatus('This account still needs OTP verification before biometric login can finish.');
        return;
      }

      setSession(result);
      await persistLastLoginEmail(credentials.email);
      setActiveTab('properties');
      await loadPropertiesForUser(result.user.id);
      setStatus('Unlocked with biometrics.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleBiometric() {
    if (!biometricAvailable) {
      setError('Biometric authentication is not available on this device.');
      return;
    }

    if (!biometricEnabled) {
      if (!hasBiometricCredentials) {
        setError('Complete a successful password login first so we can securely save credentials for biometric unlock.');
        return;
      }

      await setBiometricPreference(true);
      setStatus('Biometric login is enabled.');
      return;
    }

    await setBiometricPreference(false);
    setStatus('Biometric login is disabled.');
  }

  async function openExternalUrl(url) {
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      setError('Unable to open that link on this device right now.');
    }
  }

  function confirmDeleteAccount() {
    if (!session?.token) {
      return;
    }

    if (accountDeletionBlocked) {
      setError('Demo and admin accounts are protected and cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete account?',
      'This permanently removes your account, owned properties, saved pricing, generated flyers, and associated media. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError('');

            try {
              await deleteAccountRequest(session.token);
              await SecureStore.deleteItemAsync(LAST_LOGIN_EMAIL_KEY);
              await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
              await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
              setSession(null);
              resetWorkspaceState();
              setBiometricEnabled(false);
              setHasBiometricCredentials(false);
              setForm((current) => ({
                ...current,
                email: '',
                password: '',
                otpCode: '',
              }));
              setStatus('Your account has been deleted.');
            } catch (requestError) {
              setError(requestError.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function loadPropertyWorkspace(targetPropertyId) {
    if (!targetPropertyId) {
      setDashboard(null);
      setGallery([]);
      setSelectedPhotoId('');
      return;
    }

    const [dashboardResponse, mediaResponse] = await Promise.all([
      getDashboard(targetPropertyId),
      listMediaAssets(targetPropertyId),
    ]);
    const nextGallery = mediaResponse.assets || [];
    setDashboard(dashboardResponse);
    setGallery(nextGallery);
    setSelectedPhotoId(nextGallery[0]?.id || '');
    setGalleryFilter('All');
  }

  async function loadPropertiesForUser(userId) {
    const propertiesResponse = await listProperties(userId);
    const nextProperties = propertiesResponse.properties || [];
    const nextPropertyId = nextProperties[0]?.id || '';

    setProperties(nextProperties);
    setPropertyId(nextPropertyId);
    setPropertySection('overview');

    await loadPropertyWorkspace(nextPropertyId);
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
      await persistLastLoginEmail(form.email);
      await persistBiometricCredentials(form.email, form.password);
      setActiveTab('properties');
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
      await persistLastLoginEmail(form.email);
      setActiveTab('properties');
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
    setPropertySection('overview');
    setBusy(true);
    setError('');

    try {
      await loadPropertyWorkspace(property.id);
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
        throw new Error(
          `Permission required to ${mode === 'camera' ? 'use the camera' : 'open the photo library'}.`,
        );
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
      setActiveTab('capture');
      setStatus('Photo ready. Add a room label and save it to the property.');
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
      const nextGallery = mediaResponse.assets || [];

      setAnalysis(response.analysis);
      setGallery(nextGallery);
      setSelectedPhotoId(response.asset?.id || nextGallery[0]?.id || '');
      setActiveTab('gallery');
      setStatus('Photo saved to the property gallery and analyzed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function renderAuth() {
    return (
      <View style={styles.authShell}>
        <View style={styles.authHero}>
          <Text
            style={styles.titleSingleLine}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            Workside Home Advisor
          </Text>
          <Text style={styles.authIntro}>
            Sign in to access your properties, capture listing photos, and review AI guidance in the field.
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Mobile sign-in</Text>
          <Text style={styles.cardBody}>
            Use the same verified seller account you created on the web portal.
          </Text>
          <View style={styles.segmentRow}>
            <ActionButton
              label="Password login"
              onPress={() => setAuthMode('login')}
              variant={authMode === 'login' ? 'primary' : 'secondary'}
              compact
            />
            <ActionButton
              label="Enter OTP"
              onPress={() => setAuthMode('verify')}
              variant={authMode === 'verify' ? 'primary' : 'secondary'}
              compact
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
            <View style={styles.passwordField}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#7d8a8f"
                secureTextEntry={!showPassword}
                value={form.password}
                onChangeText={(value) => updateField('password', value)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((current) => !current)}
                style={styles.passwordToggle}
              >
                <Text style={styles.passwordToggleIcon}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
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
              label={busy ? 'Working...' : authMode === 'login' ? 'Continue' : 'Verify email'}
              onPress={authMode === 'login' ? handleLogin : handleVerifyOtp}
              disabled={busy}
            />
            {authMode === 'login' && biometricAvailable && biometricEnabled && hasBiometricCredentials ? (
              <ActionButton
                label={Platform.OS === 'ios' ? 'Face ID' : 'Biometric'}
                onPress={handleBiometricLogin}
                variant="secondary"
                disabled={busy}
              />
            ) : null}
            {authMode === 'verify' ? (
              <ActionButton
                label="Resend OTP"
                onPress={handleResendOtp}
                variant="secondary"
                disabled={busy || !form.email}
              />
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.authFooter}>
          <Text style={styles.authFooterCopy}>Copyright 2026 Workside Software LLC.</Text>
          <View style={styles.authFooterLinks}>
            <TouchableOpacity onPress={() => openExternalUrl(TERMS_URL)}>
              <Text style={styles.authFooterLink}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(PRIVACY_URL)}>
              <Text style={styles.authFooterLink}>Privacy Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(`mailto:${SUPPORT_EMAIL}`)}>
              <Text style={styles.authFooterLink}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  function renderPhotoDetail(asset) {
    if (!asset) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>No photo selected</Text>
          <Text style={styles.emptyStateBody}>
            Tap a saved property photo to inspect room details, AI notes, and flyer potential.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.photoDetailCard}>
        <Image source={{ uri: asset.imageUrl || asset.imageDataUrl }} style={styles.photoDetailImage} />
        <View style={styles.photoDetailCopy}>
          <View style={styles.photoDetailHeader}>
            <View style={styles.photoDetailTitleWrap}>
              <Text style={styles.photoDetailTitle}>{asset.roomLabel || 'Room photo'}</Text>
              <Text style={styles.photoDetailMeta}>
                {asset.analysis?.roomGuess || 'Room pending'} · {asset.analysis?.overallQualityScore || '--'}/100
              </Text>
            </View>
            <Text
              style={[
                styles.photoStatusChip,
                asset.analysis?.retakeRecommended ? styles.photoStatusChipWarning : null,
              ]}
            >
              {asset.analysis?.retakeRecommended ? 'Retake recommended' : 'Good listing candidate'}
            </Text>
          </View>

          <View style={styles.scoreRow}>
            <ScoreBadge label="Lighting" value={String(asset.analysis?.lightingScore || '--')} />
            <ScoreBadge label="Composition" value={String(asset.analysis?.compositionScore || '--')} />
            <ScoreBadge label="Clarity" value={String(asset.analysis?.clarityScore || '--')} />
          </View>

          <Text style={styles.analysisSubhead}>AI summary</Text>
          <Text style={styles.cardBody}>
            {asset.analysis?.summary ||
              'AI review will appear here after the image is analyzed and attached to this property.'}
          </Text>

          {(asset.analysis?.suggestions || []).length ? (
            <>
              <Text style={styles.analysisSubhead}>Suggestions</Text>
              {asset.analysis.suggestions.map((item) => (
                <Text key={item} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      </View>
    );
  }

  function renderPropertyOverview() {
    return (
      <>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Properties</Text>
            <Text style={styles.sectionTitle}>Your available properties</Text>
          </View>
          <Text style={styles.sectionMeta}>{properties.length} available</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.propertyRow}
        >
          {properties.map((property) => (
            <TouchableOpacity
              key={property.id}
              onPress={() => handleRefreshProperty(property)}
              style={[styles.propertyCard, property.id === propertyId ? styles.propertyCardActive : null]}
            >
              <Text style={styles.propertyChipTitle}>{property.title}</Text>
              <Text style={styles.propertyChipMeta}>
                {property.city}, {property.state}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedProperty ? (
          <View style={styles.sectionStack}>
            <View style={styles.propertySummaryCard}>
              <View style={styles.propertySummaryHeader}>
                <View style={styles.propertySummaryText}>
                  <Text style={styles.propertySummaryTitle}>{selectedProperty.title}</Text>
                  <Text style={styles.propertySummaryMeta}>
                    {selectedProperty.addressLine1}, {selectedProperty.city}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPropertyDetailsCollapsed((current) => !current)}
                  style={styles.propertyCollapseButton}
                >
                  <Text style={styles.propertyCollapseButtonLabel}>
                    {propertyDetailsCollapsed ? 'Expand' : 'Collapse'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.propertySummaryBadges}>
                <ScoreBadge
                  label="Price"
                  value={
                    dashboard?.pricing
                      ? `${formatCurrency(dashboard.pricing.low)} – ${formatCurrency(dashboard.pricing.high)}`
                      : 'Pending'
                  }
                />
                <ScoreBadge label="Photos" value={String(gallery.length)} />
              </View>
            </View>

            {!propertyDetailsCollapsed ? (
              <>
                <View style={styles.propertyHero}>
                  <View style={styles.propertyHeroHeader}>
                    <View style={styles.propertyHeroTitleWrap}>
                      <Text style={styles.propertyHeroTitle}>{selectedProperty.title}</Text>
                      <Text style={styles.propertyHeroAddress}>
                        {selectedProperty.addressLine1}, {selectedProperty.city}, {selectedProperty.state}{' '}
                        {selectedProperty.zip}
                      </Text>
                    </View>
                    <Text style={styles.propertyHeroBadge}>{selectedProperty.propertyType}</Text>
                  </View>

                  <View style={styles.propertyFactRow}>
                    <ScoreBadge
                      label="Price band"
                      value={
                        dashboard?.pricing
                          ? `${formatCurrency(dashboard.pricing.low)} – ${formatCurrency(dashboard.pricing.high)}`
                          : 'Pending'
                      }
                    />
                    <ScoreBadge label="Photos" value={String(gallery.length)} />
                    <ScoreBadge label="Best shots" value={String(featuredPhotoCount)} />
                  </View>

                  <View style={styles.propertyFactRow}>
                    <ScoreBadge label="Beds" value={String(selectedProperty.bedrooms || '--')} />
                    <ScoreBadge label="Baths" value={String(selectedProperty.bathrooms || '--')} />
                    <ScoreBadge label="Sqft" value={String(selectedProperty.squareFeet || '--')} />
                  </View>

                  <Text style={styles.propertyHeroSummary}>
                    {dashboard?.pricingSummary ||
                      'Pricing and AI summary appear here once a fresh analysis is available.'}
                  </Text>

                  <View style={styles.segmentRow}>
                    <ActionButton label="Refresh pricing" onPress={handleRunPricing} disabled={busy} compact />
                    <ActionButton
                      label="Capture photos"
                      onPress={() => setActiveTab('capture')}
                      variant="secondary"
                      compact
                    />
                    <ActionButton
                      label="View gallery"
                      onPress={() => setActiveTab('gallery')}
                      variant="secondary"
                      compact
                    />
                  </View>
                </View>

                <View style={styles.subsectionTabs}>
                  <TabChip
                    label="Overview"
                    active={propertySection === 'overview'}
                    onPress={() => setPropertySection('overview')}
                  />
                  <TabChip
                    label="Insights"
                    active={propertySection === 'insights'}
                    onPress={() => setPropertySection('insights')}
                  />
                  <TabChip
                    label="Photos"
                    active={propertySection === 'photos'}
                    onPress={() => setPropertySection('photos')}
                  />
                </View>
              </>
            ) : null}

            {!propertyDetailsCollapsed && propertySection === 'overview' ? (
              <View style={styles.sectionStack}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Field-ready summary</Text>
                  <Text style={styles.cardBody}>
                    Use this property as the main mobile workspace for photo capture, quick pricing checks, and on-site seller prep.
                  </Text>
                  <View style={styles.scoreRow}>
                    <ScoreBadge
                      label="Midpoint"
                      value={
                        dashboard?.pricing?.mid
                          ? formatCurrency(dashboard.pricing.mid)
                          : 'Pending'
                      }
                    />
                    <ScoreBadge
                      label="Confidence"
                      value={
                        dashboard?.pricing?.confidence
                          ? `${Math.round(dashboard.pricing.confidence * 100)}%`
                          : '--'
                      }
                    />
                    <ScoreBadge
                      label="Comps"
                      value={String(dashboard?.pricing?.selectedComps?.length || 0)}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Next best actions</Text>
                  <Text style={styles.listItem}>• Capture strong living room, kitchen, and primary bedroom angles.</Text>
                  <Text style={styles.listItem}>• Review AI retake notes before generating a seller flyer.</Text>
                  <Text style={styles.listItem}>• Refresh pricing again after major prep or staging changes.</Text>
                </View>
              </View>
            ) : null}

            {!propertyDetailsCollapsed && propertySection === 'insights' ? (
              <View style={styles.sectionStack}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pricing insight</Text>
                  <Text style={styles.cardBody}>
                    {dashboard?.pricingSummary ||
                      'Run a fresh pricing analysis to load the latest market narrative and comp-backed recommendation.'}
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top comps</Text>
                  {topComps.length ? (
                    topComps.map((comp) => (
                      <View key={`${comp.addressLine1}-${comp.salePrice}`} style={styles.compMiniCard}>
                        <Text style={styles.compMiniTitle}>{comp.addressLine1}</Text>
                        <Text style={styles.compMiniMeta}>
                          {formatCurrency(comp.salePrice)} · {comp.distanceMiles?.toFixed?.(2) || '--'} mi · {comp.bedrooms || '--'} bd / {comp.bathrooms || '--'} ba
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.cardBody}>
                      No top comps are stored yet for this property.
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {!propertyDetailsCollapsed && propertySection === 'photos' ? (
              <View style={styles.sectionStack}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Photo library snapshot</Text>
                  <Text style={styles.cardBody}>
                    Review the latest property shots here, then switch to Gallery for a deeper photo-by-photo inspection.
                  </Text>
                  <View style={styles.scoreRow}>
                    <ScoreBadge label="Saved" value={String(gallery.length)} />
                    <ScoreBadge label="Strong" value={String(featuredPhotoCount)} />
                    <ScoreBadge
                      label="Retakes"
                      value={String(gallery.filter((asset) => asset.analysis?.retakeRecommended).length)}
                    />
                  </View>
                </View>

                {gallery.length ? (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.photoRail}
                    >
                      {gallery.map((asset) => (
                        <TouchableOpacity
                          key={asset.id}
                          onPress={() => {
                            setSelectedPhotoId(asset.id);
                            setActiveTab('gallery');
                          }}
                          style={[
                            styles.photoRailCard,
                            asset.id === selectedPhoto?.id ? styles.photoRailCardActive : null,
                          ]}
                        >
                          <Image source={{ uri: asset.imageUrl || asset.imageDataUrl }} style={styles.photoRailImage} />
                          <Text style={styles.photoRailLabel} numberOfLines={1}>
                            {asset.roomLabel || 'Room photo'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {renderPhotoDetail(selectedPhoto)}
                  </>
                ) : (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No property photos yet</Text>
                    <Text style={styles.emptyStateBody}>
                      Capture your first room shot to start building the mobile-ready property gallery.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No property selected</Text>
            <Text style={styles.emptyStateBody}>
              Choose a property to review pricing, capture photos, and inspect the existing gallery.
            </Text>
          </View>
        )}
      </>
    );
  }

  function renderCapture() {
    return (
      <>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Capture</Text>
            <Text style={styles.sectionTitle}>Room-by-room photo intake</Text>
          </View>
          <Text style={styles.sectionMeta}>{selectedProperty?.title || 'No property'}</Text>
        </View>

        {selectedProperty ? (
          <View style={styles.capturePropertyBanner}>
            <View>
              <Text style={styles.capturePropertyTitle}>{selectedProperty.title}</Text>
              <Text style={styles.capturePropertyMeta}>
                {selectedProperty.addressLine1}, {selectedProperty.city}, {selectedProperty.state}
              </Text>
            </View>
            <Text style={styles.capturePropertyBadge}>{gallery.length} photos</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Capture for {selectedProperty?.title || 'your property'}</Text>
          <Text style={styles.cardBody}>
            Tag each image by room, then save it to the property so it becomes available for AI review and flyer selection.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Room label"
            placeholderTextColor="#7d8a8f"
            value={form.roomLabel}
            onChangeText={(value) => updateField('roomLabel', value)}
          />
          <View style={styles.quickTagRow}>
            {['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'].map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => updateField('roomLabel', tag)}
                style={[
                  styles.quickTagChip,
                  form.roomLabel === tag ? styles.quickTagChipActive : null,
                ]}
              >
                <Text
                  style={form.roomLabel === tag ? styles.quickTagChipLabelActive : styles.quickTagChipLabel}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.segmentRow}>
            <ActionButton
              label="Use camera"
              onPress={() => pickImage('camera')}
              disabled={busy || !propertyId}
            />
            <ActionButton
              label="Photo library"
              onPress={() => pickImage('library')}
              variant="secondary"
              disabled={busy || !propertyId}
            />
          </View>
          {photoAsset?.uri ? (
            <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderTitle}>No pending capture yet</Text>
              <Text style={styles.photoPlaceholderBody}>
                Choose the camera or library to add a room photo for this property.
              </Text>
            </View>
          )}
          <ActionButton
            label="Save + analyze photo"
            onPress={handleSavePhoto}
            disabled={busy || !propertyId || !photoAsset?.base64}
          />
        </View>

        {analysis ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Latest AI analysis</Text>
            <Text style={styles.analysisHeadline}>
              {analysis.roomGuess} · {analysis.overallQualityScore}/100
            </Text>
            <Text style={styles.cardBody}>{analysis.summary}</Text>
            <View style={styles.scoreRow}>
              <ScoreBadge label="Lighting" value={String(analysis.lightingScore)} />
              <ScoreBadge label="Composition" value={String(analysis.compositionScore)} />
              <ScoreBadge label="Clarity" value={String(analysis.clarityScore)} />
            </View>
            <Text style={styles.analysisSubhead}>Suggestions</Text>
            {(analysis.suggestions || []).map((item) => (
              <Text key={item} style={styles.listItem}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}
      </>
    );
  }

  function renderGallery() {
    return (
      <>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Gallery</Text>
            <Text style={styles.sectionTitle}>Property photo library</Text>
          </View>
          <Text style={styles.sectionMeta}>{gallery.length} saved</Text>
        </View>

        {gallery.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No saved photos yet</Text>
            <Text style={styles.emptyStateBody}>
              Capture a room photo and save it to start building the property gallery.
            </Text>
          </View>
        ) : (
          <View style={styles.sectionStack}>
            <View style={styles.filterRow}>
              {galleryFilters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setGalleryFilter(filter)}
                  style={[styles.filterChip, galleryFilter === filter ? styles.filterChipActive : null]}
                >
                  <Text style={galleryFilter === filter ? styles.filterChipLabelActive : styles.filterChipLabel}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderPhotoDetail(selectedPhoto)}

            <View style={styles.galleryGrid}>
              {filteredGallery.map((asset) => (
                <TouchableOpacity
                  key={asset.id}
                  onPress={() => setSelectedPhotoId(asset.id)}
                  style={[
                    styles.galleryCard,
                    asset.id === selectedPhoto?.id ? styles.galleryCardActive : null,
                  ]}
                >
                  <Image source={{ uri: asset.imageUrl || asset.imageDataUrl }} style={styles.galleryImage} />
                  <View style={styles.galleryCopy}>
                    <Text style={styles.galleryTitle}>{asset.roomLabel || 'Room photo'}</Text>
                    <Text style={styles.galleryMeta}>
                      {asset.analysis?.roomGuess || 'Room pending'} · {asset.analysis?.overallQualityScore || '--'}/100
                    </Text>
                    <Text style={styles.galleryMeta}>
                      {asset.analysis?.retakeRecommended ? 'Retake recommended' : 'Usable for flyer review'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </>
    );
  }

  function renderVision() {
    return (
      <View style={styles.sectionStack}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Vision</Text>
            <Text style={styles.sectionTitle}>Listing vision mode</Text>
          </View>
          <Text style={styles.sectionMeta}>{selectedProperty?.title || 'No property'}</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Best current listing candidates</Text>
          <Text style={styles.cardBody}>
            Use this view to decide which rooms deserve retakes, which images belong on the flyer, and what story the property should tell visually.
          </Text>
          {bestPhotoCandidates.length ? (
            bestPhotoCandidates.map((asset, index) => (
              <View key={asset.id} style={styles.visionRow}>
                <View style={styles.visionRank}>
                  <Text style={styles.visionRankLabel}>{index + 1}</Text>
                </View>
                <View style={styles.visionCopy}>
                  <Text style={styles.visionTitle}>{asset.roomLabel || 'Room photo'}</Text>
                  <Text style={styles.galleryMeta}>
                    Score {asset.analysis?.overallQualityScore || '--'} · {asset.analysis?.bestUse || 'General marketing'}
                  </Text>
                  <Text style={styles.cardBody}>
                    {asset.analysis?.summary || 'AI summary will appear here after the image is analyzed.'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.cardBody}>
              Save a few property photos first and Vision mode will rank the strongest listing candidates for you.
            </Text>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Room coverage map</Text>
          <Text style={styles.cardBody}>
            These are the core rooms the app wants before you market or generate polished flyer drafts.
          </Text>
          <View style={styles.checklistStack}>
            {roomCoverage.map((item) => (
              <View key={item.room} style={styles.checklistRow}>
                <Text style={item.captured ? styles.checklistBulletDone : styles.checklistBulletPending}>
                  {item.captured ? '✓' : '•'}
                </Text>
                <View style={styles.checklistCopy}>
                  <Text style={styles.checklistTitle}>{item.room}</Text>
                  <Text style={styles.galleryMeta}>
                    {item.captured ? 'Captured and available for review.' : 'Still needs a usable photo.'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Presentation direction</Text>
          <Text style={styles.cardBody}>
            {dashboard?.pricingSummary
              ? `Lead with the strongest visual moments, then support the current ${formatCurrency(
                  dashboard.pricing?.mid || 0,
                )} midpoint with bright, clean rooms and a calm, move-in-ready feel.`
              : 'Run pricing and save a few photos to unlock a stronger listing direction for this property.'}
          </Text>
          <Text style={styles.listItem}>• Prioritize natural light, clutter-free framing, and level horizons.</Text>
          <Text style={styles.listItem}>• Use exterior and kitchen photos to anchor the opening visual sequence.</Text>
          <Text style={styles.listItem}>• Retake rooms with weak lighting before pushing them into flyers or marketing.</Text>
        </GlassCard>
      </View>
    );
  }

  function renderTasks() {
    return (
      <View style={styles.sectionStack}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Tasks</Text>
            <Text style={styles.sectionTitle}>Seller action checklist</Text>
          </View>
          <Text style={styles.sectionMeta}>{sellerTasks.length} active items</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Next best moves</Text>
          <Text style={styles.cardBody}>
            This checklist keeps the seller workflow moving from pricing to prep, then into media and flyer readiness.
          </Text>
          <View style={styles.checklistStack}>
            {sellerTasks.map((task) => (
              <View
                key={task.key}
                style={[
                  styles.taskCard,
                  task.tone === 'done' ? styles.taskCardDone : null,
                  task.tone === 'warning' ? styles.taskCardWarning : null,
                ]}
              >
                <View style={styles.taskHeader}>
                  <Text style={task.done ? styles.taskStatusDone : styles.taskStatusPending}>
                    {task.done ? 'Done' : task.tone === 'warning' ? 'Needs review' : 'Open'}
                  </Text>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                </View>
                <Text style={styles.cardBody}>{task.detail}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>What this app will do next</Text>
          <Text style={styles.listItem}>• Vision mode will keep improving photo ranking and staging direction.</Text>
          <Text style={styles.listItem}>• Flyer generation will get stronger as you refresh pricing and photo coverage.</Text>
          <Text style={styles.listItem}>• Upcoming prep tasks will expand into room-by-room seller guidance.</Text>
        </GlassCard>
      </View>
    );
  }

  function renderSettings() {
    return (
      <View style={styles.sectionStack}>
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <Text style={styles.profileName}>{getDisplayName(session.user)}</Text>
          <Text style={styles.profileEmail}>{session.user.email}</Text>
          <Text style={styles.cardBody}>
            Manage account access, legal links, and mobile field preferences from one place.
          </Text>
          <View style={styles.profileMetaRow}>
            <ScoreBadge label="Selected property" value={selectedProperty?.title || 'None'} />
            <ScoreBadge label="Gallery count" value={String(gallery.length)} />
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Legal and support</Text>
          <Text style={styles.cardBody}>
            Review your customer-facing policies or reach Workside support from the app.
          </Text>
          <View style={styles.sectionStack}>
            <ActionButton label="Terms of Service" onPress={() => openExternalUrl(TERMS_URL)} variant="secondary" />
            <ActionButton label="Privacy Notice" onPress={() => openExternalUrl(PRIVACY_URL)} variant="secondary" />
            <ActionButton
              label={SUPPORT_EMAIL}
              onPress={() => openExternalUrl(`mailto:${SUPPORT_EMAIL}`)}
              variant="secondary"
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Biometric login</Text>
          <Text style={styles.cardBody}>
            Use {Platform.OS === 'ios' ? 'Face ID or Touch ID' : 'fingerprint or device biometrics'} to unlock the last successful password account faster.
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Biometric unlock</Text>
              <Text style={styles.settingSubtitle}>
                {biometricAvailable
                  ? hasBiometricCredentials
                    ? biometricEnabled
                      ? 'Enabled for future sign-ins.'
                      : 'Available. Turn it on when you want faster sign-in.'
                    : 'Complete a password login first so credentials can be stored securely.'
                  : 'No enrolled biometrics were detected on this device.'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleToggleBiometric}
              style={[
                styles.togglePill,
                biometricEnabled ? styles.togglePillActive : null,
                !biometricAvailable ? styles.togglePillDisabled : null,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  biometricEnabled ? styles.toggleThumbActive : null,
                ]}
              />
            </TouchableOpacity>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Account actions</Text>
          <Text style={styles.cardBody}>
            You can sign out any time. Standard user accounts can also be permanently deleted here to comply with App Store account management requirements.
          </Text>
          {accountDeletionBlocked ? (
            <Text style={styles.protectedAccountNotice}>
              This is a protected internal {session.user.isDemoAccount ? 'demo' : 'admin'} account, so account deletion is disabled.
            </Text>
          ) : null}
          <View style={styles.sectionStack}>
            <ActionButton label="Sign out" onPress={handleSignOut} variant="secondary" />
            <ActionButton
              label="Delete account"
              onPress={confirmDeleteAccount}
              variant="destructive"
              disabled={busy || accountDeletionBlocked}
            />
          </View>
        </GlassCard>
      </View>
    );
  }

  function renderAuthenticatedWorkspace() {
    const tabAccent = {
      properties: colors.moss,
      vision: '#97c6bf',
      capture: colors.clay,
      tasks: '#e0c27a',
      gallery: '#9cc7d8',
      profile: colors.sand,
    };

    return (
      <View style={styles.workspaceShell}>
        <ScrollView
          style={styles.workspaceScroll}
          contentContainerStyle={styles.workspaceContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identityCard}>
            <Text style={styles.identityLabel}>Signed in as</Text>
            <Text style={styles.identityName}>{getDisplayName(session.user)}</Text>
            <Text style={styles.identityEmail}>{session.user.email}</Text>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.clay} style={styles.spinner} /> : null}

          {activeTab === 'properties' ? renderPropertyOverview() : null}
          {activeTab === 'vision' ? renderVision() : null}
          {activeTab === 'capture' ? renderCapture() : null}
          {activeTab === 'tasks' ? renderTasks() : null}
          {activeTab === 'gallery' ? renderGallery() : null}
          {activeTab === 'profile' ? renderSettings() : null}
        </ScrollView>

        <View style={styles.bottomTabBar}>
          <BottomTabButton
            label="Properties"
            active={activeTab === 'properties'}
            onPress={() => setActiveTab('properties')}
            accent={tabAccent.properties}
          />
          <BottomTabButton
            label="Vision"
            active={activeTab === 'vision'}
            onPress={() => setActiveTab('vision')}
            accent={tabAccent.vision}
          />
          <BottomTabButton
            label="Capture"
            active={activeTab === 'capture'}
            onPress={() => setActiveTab('capture')}
            accent={tabAccent.capture}
          />
          <BottomTabButton
            label="Tasks"
            active={activeTab === 'tasks'}
            onPress={() => setActiveTab('tasks')}
            accent={tabAccent.tasks}
          />
          <BottomTabButton
            label="Gallery"
            active={activeTab === 'gallery'}
            onPress={() => setActiveTab('gallery')}
            accent={tabAccent.gallery}
          />
          <BottomTabButton
            label="Settings"
            active={activeTab === 'profile'}
            onPress={() => setActiveTab('profile')}
            accent={tabAccent.profile}
          />
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
      {session?.user ? (
        renderAuthenticatedWorkspace()
      ) : (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {renderAuth()}
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.clay} style={styles.spinner} /> : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 16,
  },
  workspaceShell: {
    flex: 1,
  },
  workspaceScroll: {
    flex: 1,
  },
  workspaceContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: 16,
  },
  authShell: {
    gap: 16,
  },
  authHero: {
    gap: 10,
    paddingTop: 8,
  },
  titleSingleLine: {
    color: colors.cream,
    fontSize: device.isSmallWidth ? typography.title : typography.headline,
    fontWeight: '800',
    lineHeight: device.isSmallWidth ? typography.title + 4 : typography.headline + 4,
    textAlign: 'center',
    width: '100%',
  },
  authIntro: {
    color: colors.sand,
    fontSize: typography.body,
    lineHeight: typography.body + 7,
    textAlign: 'center',
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(36, 48, 57, 0.58)',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  cardTitle: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.sand,
    fontSize: typography.body,
    lineHeight: typography.body + 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionEyebrow: {
    color: colors.moss,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.sand,
    fontSize: 13,
    marginTop: 18,
  },
  sectionStack: {
    gap: 14,
  },
  input: {
    minHeight: device.isCompactHeight ? 48 : 52,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.panelSoft,
    color: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: typography.bodyLarge,
  },
  passwordField: {
    minHeight: device.isCompactHeight ? 48 : 52,
    borderRadius: radius.md,
    paddingLeft: 14,
    paddingRight: 8,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    minHeight: 50,
    color: colors.cream,
    fontSize: typography.bodyLarge,
  },
  passwordToggle: {
    minWidth: 60,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  passwordToggleIcon: {
    color: colors.sand,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTagChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickTagChipActive: {
    borderColor: colors.clay,
    backgroundColor: 'rgba(210,136,89,0.16)',
  },
  quickTagChipLabel: {
    color: colors.sand,
    fontSize: 13,
    fontWeight: '600',
  },
  quickTagChipLabelActive: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: 14,
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
    fontWeight: '800',
    fontSize: 15,
  },
  buttonSecondaryLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 15,
  },
  status: {
    color: colors.moss,
    backgroundColor: 'rgba(124, 162, 127, 0.1)',
    borderRadius: radius.md,
    padding: 12,
    lineHeight: 20,
  },
  error: {
    color: '#f0a08e',
    backgroundColor: 'rgba(174, 67, 53, 0.12)',
    borderRadius: radius.md,
    padding: 12,
    lineHeight: 20,
  },
  spinner: {
    marginVertical: 8,
  },
  identityCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124, 162, 127, 0.12)',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  identityLabel: {
    color: colors.moss,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  identityName: {
    color: colors.cream,
    fontSize: typography.title,
    fontWeight: '800',
  },
  identityEmail: {
    color: colors.sand,
    fontSize: 14,
  },
  bottomTabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(18, 27, 33, 0.96)',
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  bottomTabIconWrap: {
    width: 42,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  bottomTabIconWrapActive: {
    borderColor: colors.clay,
  },
  bottomTabDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.sand,
    opacity: 0.75,
  },
  bottomTabDotActive: {
    opacity: 1,
  },
  bottomTabLabel: {
    color: colors.sand,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomTabLabelActive: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabChipActive: {
    borderColor: colors.clay,
    backgroundColor: 'rgba(210,136,89,0.16)',
  },
  tabChipLabel: {
    color: colors.sand,
    fontWeight: '600',
  },
  tabChipLabelActive: {
    color: colors.cream,
    fontWeight: '800',
  },
  propertyRow: {
    gap: 10,
    paddingVertical: 4,
  },
  propertySummaryCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  propertySummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  propertySummaryText: {
    flex: 1,
    gap: 4,
  },
  propertySummaryTitle: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '800',
  },
  propertySummaryMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
  },
  propertySummaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  propertyCollapseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  propertyCollapseButtonLabel: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  propertyCard: {
    width: 204,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(36, 48, 57, 0.7)',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  propertyCardActive: {
    borderColor: colors.clay,
    shadowColor: colors.clay,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  propertyChipTitle: {
    color: colors.cream,
    fontWeight: '800',
    fontSize: 16,
  },
  propertyChipMeta: {
    color: colors.sand,
    fontSize: 13,
  },
  propertyHero: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.clay,
    gap: 14,
  },
  propertyHeroHeader: {
    gap: 10,
  },
  propertyHeroTitleWrap: {
    gap: 6,
  },
  propertyHeroTitle: {
    color: '#fff8f2',
    fontSize: 24,
    fontWeight: '800',
  },
  propertyHeroAddress: {
    color: '#fff1e6',
    fontSize: 14,
    lineHeight: 20,
  },
  propertyHeroBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    color: '#fff8f2',
    backgroundColor: 'rgba(22,32,39,0.18)',
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  propertyFactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  propertyHeroSummary: {
    color: '#fff4ea',
    fontSize: 15,
    lineHeight: 23,
  },
  subsectionTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compMiniCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  compMiniTitle: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  compMiniMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
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
    gap: 2,
  },
  scorePillLabel: {
    color: colors.sand,
    fontSize: 12,
  },
  scorePillValue: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '800',
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
  },
  photoRail: {
    gap: 12,
    paddingVertical: 2,
  },
  photoRailCard: {
    width: 128,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photoRailCardActive: {
    borderColor: colors.clay,
  },
  photoRailImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.panelSoft,
  },
  photoRailLabel: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  photoDetailCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 48, 57, 0.76)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  photoDetailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.panelSoft,
  },
  photoDetailCopy: {
    padding: 16,
    gap: 10,
  },
  photoDetailHeader: {
    gap: 8,
  },
  photoDetailTitleWrap: {
    gap: 4,
  },
  photoDetailTitle: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: '800',
  },
  photoDetailMeta: {
    color: colors.sand,
    fontSize: 14,
  },
  photoStatusChip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(124,162,127,0.14)',
    color: colors.moss,
    fontSize: 12,
    fontWeight: '700',
  },
  photoStatusChipWarning: {
    backgroundColor: 'rgba(210,136,89,0.18)',
    color: '#f2be95',
  },
  photoPlaceholder: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  photoPlaceholderTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  photoPlaceholderBody: {
    color: colors.sand,
    lineHeight: 20,
  },
  galleryGrid: {
    gap: 12,
  },
  galleryCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 48, 57, 0.72)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  galleryCardActive: {
    borderColor: colors.clay,
  },
  galleryImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.panelSoft,
  },
  galleryCopy: {
    padding: 14,
    gap: 6,
  },
  galleryTitle: {
    color: colors.cream,
    fontWeight: '800',
    fontSize: 16,
  },
  galleryMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
  },
  analysisHeadline: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '800',
  },
  analysisSubhead: {
    color: colors.moss,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  listItem: {
    color: colors.sand,
    lineHeight: 22,
  },
  profileName: {
    color: colors.cream,
    fontSize: 22,
    fontWeight: '800',
  },
  profileEmail: {
    color: colors.sand,
    fontSize: 14,
  },
  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: 'rgba(210,136,89,0.16)',
    borderColor: colors.clay,
  },
  filterChipLabel: {
    color: colors.sand,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipLabelActive: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  capturePropertyBanner: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  capturePropertyTitle: {
    color: colors.cream,
    fontSize: 17,
    fontWeight: '800',
  },
  capturePropertyMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
  },
  capturePropertyBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.panelSoft,
    color: colors.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(36, 48, 57, 0.74)',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  emptyStateTitle: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: colors.sand,
    fontSize: 14,
    lineHeight: 22,
  },
  authFooter: {
    gap: 10,
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  authFooterCopy: {
    color: colors.sand,
    fontSize: typography.caption,
    textAlign: 'center',
  },
  authFooterLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  authFooterLink: {
    color: colors.moss,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  protectedAccountNotice: {
    color: '#f2be95',
    backgroundColor: 'rgba(210,136,89,0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
    lineHeight: typography.body + 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    color: colors.cream,
    fontSize: typography.body,
    fontWeight: '700',
  },
  settingSubtitle: {
    color: colors.sand,
    fontSize: typography.caption,
    lineHeight: typography.caption + 6,
  },
  togglePill: {
    width: 58,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  togglePillActive: {
    backgroundColor: 'rgba(124, 162, 127, 0.26)',
    borderColor: 'rgba(124, 162, 127, 0.42)',
  },
  togglePillDisabled: {
    opacity: 0.45,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.sand,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.moss,
  },
  visionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  visionRank: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(210,136,89,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(210,136,89,0.34)',
  },
  visionRankLabel: {
    color: colors.cream,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  visionCopy: {
    flex: 1,
    gap: 4,
  },
  visionTitle: {
    color: colors.cream,
    fontSize: typography.body,
    fontWeight: '800',
  },
  checklistStack: {
    gap: spacing.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checklistBulletPending: {
    color: colors.clay,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    minWidth: 16,
  },
  checklistBulletDone: {
    color: colors.moss,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    minWidth: 16,
  },
  checklistCopy: {
    flex: 1,
    gap: 2,
  },
  checklistTitle: {
    color: colors.cream,
    fontSize: typography.body,
    fontWeight: '700',
  },
  taskCard: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  taskCardDone: {
    backgroundColor: 'rgba(124, 162, 127, 0.1)',
  },
  taskCardWarning: {
    backgroundColor: 'rgba(210,136,89,0.11)',
  },
  taskHeader: {
    gap: 6,
  },
  taskStatusDone: {
    color: colors.moss,
    fontSize: typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  taskStatusPending: {
    color: colors.clay,
    fontSize: typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  taskTitle: {
    color: colors.cream,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
});
