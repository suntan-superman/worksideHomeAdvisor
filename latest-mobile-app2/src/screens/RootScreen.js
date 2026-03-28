import * as ImagePicker from 'expo-image-picker';
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
  deleteAccount,
  getDashboard,
  listMediaAssets,
  listProperties,
  login,
  requestOtp,
  savePhoto,
  updateMediaAsset,
  verifyEmailOtp,
} from '../services/api';
import { colors } from '../theme/tokens';

const TERMS_URL = 'https://worksidehomeadvisor.netlify.app/terms';
const PRIVACY_URL = 'https://worksidehomeadvisor.netlify.app/privacy';
const SUPPORT_EMAIL = 'support@worksidesoftware.com';
const ROOM_LABEL_OPTIONS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const LAST_LOGIN_EMAIL_KEY = 'workside:last-login-email';

function getAsyncStorage() {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Signed-in user';
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

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
    >
      <Text style={active ? styles.tabButtonLabelActive : styles.tabButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function BottomTabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.bottomTabButton}>
      <View style={[styles.bottomTabIconWrap, active ? styles.bottomTabIconWrapActive : null]}>
        <View style={[styles.bottomTabDot, active ? styles.bottomTabDotActive : null]} />
      </View>
      <Text style={active ? styles.bottomTabLabelActive : styles.bottomTabLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('properties');
  const [propertySection, setPropertySection] = useState('overview');
  const [propertyDetailsCollapsed, setPropertyDetailsCollapsed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState('');
  const [galleryFilter, setGalleryFilter] = useState('All');
  const [photoRoomDraft, setPhotoRoomDraft] = useState('Living room');
  const [photoNoteDraft, setPhotoNoteDraft] = useState('');
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

  const selectedComps = dashboard?.pricing?.selectedComps?.slice(0, 4) || [];
  const galleryFilters = useMemo(() => {
    const labels = gallery
      .map((asset) => asset.roomLabel)
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);
    return ['All', ...labels];
  }, [gallery]);
  const filteredGallery = useMemo(() => {
    if (galleryFilter === 'All') {
      return gallery;
    }

    return gallery.filter((asset) => asset.roomLabel === galleryFilter);
  }, [gallery, galleryFilter]);
  const bestPhotoCandidates = useMemo(
    () =>
      [...gallery]
        .filter((asset) => asset.analysis)
        .sort(
          (left, right) =>
            Number(Boolean(right.listingCandidate)) - Number(Boolean(left.listingCandidate)) ||
            Number(right.analysis?.overallQualityScore || 0) -
            Number(left.analysis?.overallQualityScore || 0),
        )
        .slice(0, 3),
    [gallery],
  );
  const galleryStats = useMemo(() => {
    const total = gallery.length;
    const strong = gallery.filter((asset) => !asset.analysis?.retakeRecommended).length;
    const retakes = gallery.filter((asset) => asset.analysis?.retakeRecommended).length;
    return { total, strong, retakes };
  }, [gallery]);
  const roomCoverage = useMemo(() => {
    const capturedRooms = new Set(gallery.map((asset) => asset.roomLabel).filter(Boolean));
    const recommendedRooms = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
    return recommendedRooms.map((room) => ({
      room,
      captured: capturedRooms.has(room),
    }));
  }, [gallery]);
  const sellerTasks = useMemo(() => {
    if (!selectedProperty) {
      return [];
    }

    const retakeCount = gallery.filter((asset) => asset.analysis?.retakeRecommended).length;
    return [
      {
        key: 'pricing',
        title: dashboard?.pricing?.mid ? 'Refresh pricing before launch' : 'Run your first pricing analysis',
        detail: dashboard?.pricing?.mid
          ? `Current midpoint is ${formatCurrency(dashboard.pricing.mid)}. Refresh after major prep or staging updates.`
          : 'Generate a live comp-backed price band for this property.',
        done: Boolean(dashboard?.pricing?.mid),
      },
      {
        key: 'photos',
        title: gallery.length >= 5 ? 'Core photo coverage is in place' : 'Capture the key listing rooms',
        detail:
          gallery.length >= 5
            ? `${gallery.length} saved photos are attached to this property.`
            : 'Aim for living room, kitchen, primary bedroom, bathroom, and exterior shots.',
        done: gallery.length >= 5,
      },
      {
        key: 'retakes',
        title: retakeCount ? 'Review AI retake recommendations' : 'No photo retakes currently flagged',
        detail: retakeCount
          ? `${retakeCount} saved photos were flagged for a better angle, lighting, or sharper retake.`
          : 'Your current saved photo set has no active retake flags.',
        done: retakeCount === 0,
      },
      {
        key: 'marketing',
        title: 'Refresh flyer and seller marketing copy',
        detail: 'Once photos and pricing look strong, regenerate the flyer and listing copy from the web workspace.',
        done: false,
      },
    ];
  }, [dashboard, gallery, selectedProperty]);
  const accountDeletionBlocked = Boolean(
    session?.user?.isDemoAccount || session?.user?.role === 'admin' || session?.user?.role === 'super_admin',
  );

  useEffect(() => {
    let mounted = true;

    const storage = getAsyncStorage();
    if (!storage) {
      return () => {
        mounted = false;
      };
    }

    storage
      .getItem(LAST_LOGIN_EMAIL_KEY)
      .then((savedEmail) => {
        if (!mounted || !savedEmail) {
          return;
        }

        setForm((current) => ({
          ...current,
          email: current.email || savedEmail,
        }));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPhotoRoomDraft(selectedPhoto?.roomLabel || ROOM_LABEL_OPTIONS[0]);
  }, [selectedPhoto?.id, selectedPhoto?.roomLabel]);

  useEffect(() => {
    setPhotoNoteDraft(selectedPhoto?.listingNote || '');
  }, [selectedPhoto?.id, selectedPhoto?.listingNote]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function rememberLastLoginEmail(email) {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    const storage = getAsyncStorage();
    if (!storage) {
      return;
    }

    try {
      await storage.setItem(LAST_LOGIN_EMAIL_KEY, trimmedEmail);
    } catch {
      // Non-blocking convenience only.
    }
  }

  async function openExternalUrl(url) {
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      setError('Unable to open that link on this device right now.');
    }
  }

  function resetWorkspace() {
    setActiveTab('properties');
    setPropertySection('overview');
    setPropertyDetailsCollapsed(false);
    setProperties([]);
    setPropertyId('');
    setDashboard(null);
    setPhotoAsset(null);
    setAnalysis(null);
    setGallery([]);
    setSelectedPhotoId('');
    setGalleryFilter('All');
  }

  function handleSignOut() {
    setSession(null);
    resetWorkspace();
    setShowPassword(false);
    setError('');
    setStatus('Signed out. Sign in to load your properties and capture listing photos.');
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
      'This permanently removes your account and associated property workspace data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError('');

            try {
              await deleteAccount(session.token);
              setSession(null);
              resetWorkspace();
              setShowPassword(false);
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

  async function loadPropertyWorkspace(nextPropertyId) {
    if (!nextPropertyId) {
      setDashboard(null);
      setGallery([]);
      setSelectedPhotoId('');
      return;
    }

    const [dashboardResponse, mediaResponse] = await Promise.all([
      getDashboard(nextPropertyId),
      listMediaAssets(nextPropertyId),
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

      await rememberLastLoginEmail(form.email);
      setSession(result);
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
      await rememberLastLoginEmail(form.email);
      setSession(result);
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
      await loadPropertyWorkspace(propertyId);
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
        return;
      }

      setPhotoAsset(pickerResult.assets[0]);
      setAnalysis(null);
      setActiveTab('capture');
      setStatus('Photo ready. Save it when you are ready for AI review.');
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
      setSelectedPhotoId(nextGallery[0]?.id || '');
      setActiveTab('gallery');
      setStatus('Photo saved to the property gallery and analyzed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleListingCandidate() {
    if (!selectedPhoto?.id) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await updateMediaAsset(selectedPhoto.id, {
        listingCandidate: !selectedPhoto.listingCandidate,
      });
      setGallery((current) =>
        current.map((asset) => (asset.id === response.asset.id ? response.asset : asset)),
      );
      setStatus(
        response.asset.listingCandidate
          ? 'Photo marked as a listing candidate.'
          : 'Photo removed from listing candidates.',
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePhotoNote() {
    if (!selectedPhoto?.id) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await updateMediaAsset(selectedPhoto.id, {
        listingNote: photoNoteDraft,
      });
      setGallery((current) =>
        current.map((asset) => (asset.id === response.asset.id ? response.asset : asset)),
      );
      setStatus('Photo note saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePhotoRoomLabel() {
    if (!selectedPhoto?.id || !photoRoomDraft) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await updateMediaAsset(selectedPhoto.id, {
        roomLabel: photoRoomDraft,
      });
      setGallery((current) =>
        current.map((asset) => (asset.id === response.asset.id ? response.asset : asset)),
      );
      setGalleryFilter('All');
      setStatus('Photo room label updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function renderFeedback() {
    return (
      <>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={colors.clay} style={styles.spinner} /> : null}
      </>
    );
  }

  function renderAuth() {
    return (
      <View style={styles.authShell}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Powered by Workside Software</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.title}>
            Workside Home Advisor
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mobile sign-in</Text>
          <Text style={styles.cardBody}>
            Use the same verified seller account you created on the web portal.
          </Text>

          <View style={styles.segmentRow}>
            <ActionButton
              label="Password login"
              onPress={() => setAuthMode('login')}
              variant={authMode === 'login' ? 'primary' : 'secondary'}
            />
            {authMode === 'verify' ? (
              <ActionButton
                label="Enter OTP"
                onPress={() => setAuthMode('verify')}
                variant="primary"
              />
            ) : null}
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
                <Text style={styles.passwordToggleLabel}>{showPassword ? 'Hide' : 'Show'}</Text>
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

        {renderFeedback()}

        <View style={styles.authFooter}>
          <Text style={styles.footerCopy}>Copyright 2026 Workside Software LLC.</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => openExternalUrl(TERMS_URL)}>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(PRIVACY_URL)}>
              <Text style={styles.footerLink}>Privacy Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(`mailto:${SUPPORT_EMAIL}`)}>
              <Text style={styles.footerLink}>{SUPPORT_EMAIL}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  function renderPropertiesTab() {
    function renderPropertyOverview() {
      return (
        <>
          <View style={styles.readinessCard}>
            <Text style={styles.readinessLabel}>Latest pricing</Text>
            <Text style={styles.readinessScore}>
              {dashboard?.pricing
                ? `${formatCurrency(dashboard.pricing.low)} to ${formatCurrency(dashboard.pricing.high)}`
                : 'Run pricing analysis'}
            </Text>
            <Text style={styles.readinessBody}>
              {dashboard?.pricingSummary ||
                'Once pricing runs, this section will show the latest RentCast + AI summary.'}
            </Text>
            <ActionButton label="Refresh pricing" onPress={handleRunPricing} disabled={busy} />
          </View>
        </>
      );
    }

    function renderPropertyInsights() {
      return selectedComps.length ? (
        <View style={styles.compList}>
          {selectedComps.map((comp) => (
            <View key={comp.address || `${comp.price}-${comp.distanceMiles}`} style={styles.compCard}>
              <Text style={styles.compTitle}>{comp.address}</Text>
              <Text style={styles.compMeta}>
                {formatCurrency(comp.price)} · {Number(comp.distanceMiles || 0).toFixed(2)} mi
              </Text>
              <Text style={styles.compMeta}>
                {comp.beds || '--'} bd · {comp.baths || '--'} ba · {comp.squareFeet || '--'} sqft
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.cardBody}>
          Run pricing to load nearby comparables and more detailed market context.
        </Text>
      );
    }

    function renderPropertyPhotos() {
      return gallery.length ? (
        <View style={styles.inlinePhotoStack}>
          {bestPhotoCandidates.length ? (
            <View style={styles.inlinePhotoSummary}>
              <Text style={styles.inlinePhotoHeadline}>Best current listing candidates</Text>
              <Text style={styles.cardBody}>
                {bestPhotoCandidates.map((asset) => asset.roomLabel).join(', ')}
              </Text>
            </View>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRail}
          >
            {gallery.slice(0, 6).map((asset) => (
              <TouchableOpacity
                key={asset.id}
                onPress={() => {
                  setSelectedPhotoId(asset.id);
                  setActiveTab('gallery');
                }}
                style={styles.galleryThumbCard}
              >
                <Image
                  source={{ uri: asset.imageUrl || asset.imageDataUrl }}
                  style={styles.galleryThumbImage}
                />
                <Text style={styles.galleryThumbLabel} numberOfLines={1}>
                  {asset.roomLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.cardBody}>
          No saved photos yet. Capture a few rooms to start building the property story.
        </Text>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed in as</Text>
          <Text style={styles.identityName}>{getDisplayName(session.user)}</Text>
          <Text style={styles.identityEmail}>{session.user.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property workspace</Text>
          <Text style={styles.cardBody}>Choose a property to inspect and photograph.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propertyRow}
          >
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
        </View>

        {selectedProperty ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.cardTitle}>{selectedProperty.title}</Text>
                <Text style={styles.cardBody}>
                  {selectedProperty.addressLine1}, {selectedProperty.city}, {selectedProperty.state}{' '}
                  {selectedProperty.zip}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPropertyDetailsCollapsed((current) => !current)}
                style={styles.collapseButton}
              >
                <Text style={styles.collapseButtonLabel}>
                  {propertyDetailsCollapsed ? 'Expand' : 'Collapse'}
                </Text>
              </TouchableOpacity>
            </View>

            {!propertyDetailsCollapsed ? (
              <>
                <View style={styles.subsectionTabs}>
                  <TabButton
                    label="Overview"
                    active={propertySection === 'overview'}
                    onPress={() => setPropertySection('overview')}
                  />
                  <TabButton
                    label="Insights"
                    active={propertySection === 'insights'}
                    onPress={() => setPropertySection('insights')}
                  />
                  <TabButton
                    label="Photos"
                    active={propertySection === 'photos'}
                    onPress={() => setPropertySection('photos')}
                  />
                </View>

                {propertySection === 'overview' ? renderPropertyOverview() : null}
                {propertySection === 'insights' ? renderPropertyInsights() : null}
                {propertySection === 'photos' ? renderPropertyPhotos() : null}
              </>
            ) : (
              <Text style={styles.cardBody}>
                Pricing, comps, and photo workflow are ready below when you want them.
              </Text>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  function renderCaptureTab() {
    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photo capture + AI review</Text>
          <Text style={styles.cardBody}>
            Capture the room, then let AI score lighting, composition, clarity, and retake value.
          </Text>
          {selectedProperty ? (
            <View style={styles.capturePropertyBanner}>
              <View style={styles.capturePropertyCopy}>
                <Text style={styles.capturePropertyTitle}>{selectedProperty.title}</Text>
                <Text style={styles.capturePropertyMeta}>
                  {selectedProperty.city}, {selectedProperty.state} · {galleryStats.total} saved photo{galleryStats.total === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.capturePropertyBadge}>
                {dashboard?.pricing?.mid ? formatCurrency(dashboard.pricing.mid) : 'No pricing yet'}
              </Text>
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Room label"
            placeholderTextColor="#7d8a8f"
            value={form.roomLabel}
            onChangeText={(value) => updateField('roomLabel', value)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickTagRow}
          >
            {ROOM_LABEL_OPTIONS.map((label) => (
              <TouchableOpacity
                key={label}
                onPress={() => updateField('roomLabel', label)}
                style={[styles.quickTagChip, form.roomLabel === label ? styles.quickTagChipActive : null]}
              >
                <Text
                  style={form.roomLabel === label ? styles.quickTagChipLabelActive : styles.quickTagChipLabel}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
          {photoAsset?.uri ? <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} /> : null}
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
            <Text style={styles.analysisSubhead}>Suggestions</Text>
            {analysis.suggestions.map((item) => (
              <Text key={item} style={styles.listItem}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  function renderGalleryTab() {
    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved photo gallery</Text>
          <Text style={styles.cardBody}>
            Each saved photo is tied to the selected property with room context and AI review.
          </Text>
          <View style={styles.scoreRow}>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillLabel}>Saved</Text>
              <Text style={styles.scorePillValue}>{galleryStats.total}</Text>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillLabel}>Strong</Text>
              <Text style={styles.scorePillValue}>{galleryStats.strong}</Text>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillLabel}>Retakes</Text>
              <Text style={styles.scorePillValue}>{galleryStats.retakes}</Text>
            </View>
          </View>
          {gallery.length === 0 ? (
            <Text style={styles.cardBody}>No saved photos yet for this property.</Text>
          ) : (
            <>
              <View style={styles.filterRow}>
                {galleryFilters.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setGalleryFilter(filter)}
                    style={[styles.filterChip, galleryFilter === filter ? styles.filterChipActive : null]}
                  >
                    <Text
                      style={
                        galleryFilter === filter ? styles.filterChipLabelActive : styles.filterChipLabel
                      }
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryRail}
              >
                {filteredGallery.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    onPress={() => setSelectedPhotoId(asset.id)}
                    style={[
                      styles.galleryThumbCard,
                      asset.id === selectedPhoto?.id ? styles.galleryThumbCardActive : null,
                    ]}
                  >
                    <Image
                      source={{ uri: asset.imageUrl || asset.imageDataUrl }}
                      style={styles.galleryThumbImage}
                    />
                    <Text style={styles.galleryThumbLabel} numberOfLines={1}>
                      {asset.roomLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedPhoto ? (
                <View style={styles.galleryDetailCard}>
                  <Image
                    source={{ uri: selectedPhoto.imageUrl || selectedPhoto.imageDataUrl }}
                    style={styles.galleryDetailImage}
                  />
                  <Text style={styles.galleryDetailTitle}>{selectedPhoto.roomLabel}</Text>
                  <Text style={styles.galleryDetailMeta}>
                    {(selectedPhoto.analysis?.overallQualityScore || '--') + '/100'} ·{' '}
                    {selectedPhoto.analysis?.retakeRecommended ? 'Retake recommended' : 'Good listing candidate'}
                  </Text>
                  <Text style={styles.analysisSubhead}>Room label</Text>
                  <View style={styles.filterRow}>
                    {ROOM_LABEL_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setPhotoRoomDraft(option)}
                        style={[styles.filterChip, photoRoomDraft === option ? styles.filterChipActive : null]}
                      >
                        <Text
                          style={photoRoomDraft === option ? styles.filterChipLabelActive : styles.filterChipLabel}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <ActionButton
                    label="Save room label"
                    onPress={handleSavePhotoRoomLabel}
                    variant="secondary"
                    disabled={busy}
                  />
                  <View style={styles.segmentRow}>
                    <ActionButton
                      label={selectedPhoto.listingCandidate ? 'Remove listing candidate' : 'Mark as listing candidate'}
                      onPress={handleToggleListingCandidate}
                      variant={selectedPhoto.listingCandidate ? 'secondary' : 'primary'}
                      disabled={busy}
                    />
                  </View>
                  <View style={styles.scoreRow}>
                    <View style={styles.scorePill}>
                      <Text style={styles.scorePillLabel}>Lighting</Text>
                      <Text style={styles.scorePillValue}>{selectedPhoto.analysis?.lightingScore ?? '--'}</Text>
                    </View>
                    <View style={styles.scorePill}>
                      <Text style={styles.scorePillLabel}>Composition</Text>
                      <Text style={styles.scorePillValue}>{selectedPhoto.analysis?.compositionScore ?? '--'}</Text>
                    </View>
                    <View style={styles.scorePill}>
                      <Text style={styles.scorePillLabel}>Clarity</Text>
                      <Text style={styles.scorePillValue}>{selectedPhoto.analysis?.clarityScore ?? '--'}</Text>
                    </View>
                  </View>
                  {selectedPhoto.analysis?.summary ? (
                    <Text style={styles.cardBody}>{selectedPhoto.analysis.summary}</Text>
                  ) : null}
                  <Text style={styles.analysisSubhead}>Listing note</Text>
                  <TextInput
                    style={[styles.input, styles.noteInput]}
                    placeholder="Add a note like hero image, retake later, or use for flyer."
                    placeholderTextColor="#7d8a8f"
                    multiline
                    value={photoNoteDraft}
                    onChangeText={setPhotoNoteDraft}
                  />
                  <ActionButton
                    label="Save note"
                    onPress={handleSavePhotoNote}
                    variant="secondary"
                    disabled={busy}
                  />
                  {selectedPhoto.analysis?.bestUse ? (
                    <>
                      <Text style={styles.analysisSubhead}>Best use</Text>
                      <Text style={styles.cardBody}>{selectedPhoto.analysis.bestUse}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  function renderVisionTab() {
    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Listing vision</Text>
          <Text style={styles.cardBody}>
            Use the strongest saved photos to shape the property story before you build a flyer or listing.
          </Text>
          {bestPhotoCandidates.length ? (
            <View style={styles.visionStack}>
              {bestPhotoCandidates.map((asset, index) => (
                <View key={asset.id} style={styles.visionRow}>
                  <View style={styles.visionRank}>
                    <Text style={styles.visionRankLabel}>#{index + 1}</Text>
                  </View>
                  <View style={styles.visionCopy}>
                    <Text style={styles.visionTitle}>{asset.roomLabel}</Text>
                    <Text style={styles.cardBody}>
                      {asset.listingCandidate ? 'Marked candidate · ' : ''}
                      {(asset.analysis?.overallQualityScore || '--') + '/100'} ·{' '}
                      {asset.analysis?.retakeRecommended ? 'Needs another pass' : 'Strong flyer candidate'}
                    </Text>
                    {asset.listingNote ? (
                      <Text style={styles.visionBody}>Note: {asset.listingNote}</Text>
                    ) : null}
                    {asset.analysis?.summary ? (
                      <Text style={styles.visionBody}>{asset.analysis.summary}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.cardBody}>
              Save a few room photos first and this tab will highlight the best candidates for flyers and listing marketing.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Room coverage</Text>
          <Text style={styles.cardBody}>
            This quick checklist helps you see whether the property has enough room variety for a polished listing.
          </Text>
          <View style={styles.checklistStack}>
            {roomCoverage.map((item) => (
              <View key={item.room} style={styles.checklistRow}>
                <Text style={item.captured ? styles.checkmarkDone : styles.checkmarkOpen}>
                  {item.captured ? '✓' : '•'}
                </Text>
                <View style={styles.checklistCopy}>
                  <Text style={styles.checklistTitle}>{item.room}</Text>
                  <Text style={styles.cardBody}>
                    {item.captured ? 'Captured in the current property gallery.' : 'Still recommended for a complete listing package.'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  function renderTasksTab() {
    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seller tasks</Text>
          <Text style={styles.cardBody}>
            Use this list to keep pricing, photos, and marketing work moving in the right order.
          </Text>
          <View style={styles.taskStack}>
            {sellerTasks.length ? (
              sellerTasks.map((task) => (
                <View key={task.key} style={[styles.taskCard, task.done ? styles.taskCardDone : null]}>
                  <Text style={task.done ? styles.taskStatusDone : styles.taskStatusOpen}>
                    {task.done ? 'Done' : 'Next up'}
                  </Text>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.cardBody}>{task.detail}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.cardBody}>
                Sign in and choose a property to generate a guided seller checklist.
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  function renderSettingsTab() {
    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Text style={styles.identityName}>{getDisplayName(session.user)}</Text>
          <Text style={styles.identityEmail}>{session.user.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Help + legal</Text>
          <View style={styles.settingsLinkStack}>
            <TouchableOpacity onPress={() => openExternalUrl(TERMS_URL)}>
              <Text style={styles.settingsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(PRIVACY_URL)}>
              <Text style={styles.settingsLink}>Privacy Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openExternalUrl(`mailto:${SUPPORT_EMAIL}`)}>
              <Text style={styles.settingsLink}>Email support</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <ActionButton label="Sign out" onPress={handleSignOut} variant="secondary" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          {accountDeletionBlocked ? (
            <Text style={styles.cardBody}>
              Demo and admin accounts are protected and cannot be deleted from the mobile app.
            </Text>
          ) : (
            <>
              <Text style={styles.cardBody}>
                App Store rules require an in-app account deletion path. This permanently removes
                your account and associated workspace data.
              </Text>
              <ActionButton label="Delete account" onPress={confirmDeleteAccount} variant="secondary" />
            </>
          )}
        </View>
      </View>
    );
  }

  function renderWorkspace() {
    let content = renderPropertiesTab();
    let headerTitle = 'Property fieldwork';
    let headerBody = 'Review pricing, move room by room, and keep the listing package organized.';

    if (activeTab === 'capture') {
      content = renderCaptureTab();
      headerTitle = 'Capture';
      headerBody = 'Shoot the next room, label it clearly, and send it through AI review.';
    } else if (activeTab === 'vision') {
      content = renderVisionTab();
      headerTitle = 'Vision';
      headerBody = 'See which saved rooms currently look strongest for flyers and listing marketing.';
    } else if (activeTab === 'tasks') {
      content = renderTasksTab();
      headerTitle = 'Tasks';
      headerBody = 'Work the seller checklist in the right order so launch prep stays focused.';
    } else if (activeTab === 'gallery') {
      content = renderGalleryTab();
      headerTitle = 'Gallery';
      headerBody = 'Review saved rooms, filter by space, and decide what is strong enough for the listing.';
    } else if (activeTab === 'settings') {
      content = renderSettingsTab();
      headerTitle = 'Settings';
      headerBody = 'Manage your session, legal links, and account controls.';
    }

    return (
      <View style={styles.workspaceShell}>
        <ScrollView
          style={styles.workspaceScroll}
          contentContainerStyle={styles.workspaceContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.workspaceHeader}>
            <Text style={styles.kicker}>Workside Home Advisor</Text>
            <Text style={styles.workspaceTitle}>{headerTitle}</Text>
            <Text style={styles.workspaceBody}>{headerBody}</Text>
          </View>

          {renderFeedback()}
          {content}
        </ScrollView>

        <View style={styles.bottomTabBar}>
          <BottomTabButton
            label="Properties"
            active={activeTab === 'properties'}
            onPress={() => setActiveTab('properties')}
          />
          <BottomTabButton
            label="Capture"
            active={activeTab === 'capture'}
            onPress={() => setActiveTab('capture')}
          />
          <BottomTabButton
            label="Vision"
            active={activeTab === 'vision'}
            onPress={() => setActiveTab('vision')}
          />
          <BottomTabButton
            label="Tasks"
            active={activeTab === 'tasks'}
            onPress={() => setActiveTab('tasks')}
          />
          <BottomTabButton
            label="Gallery"
            active={activeTab === 'gallery'}
            onPress={() => setActiveTab('gallery')}
          />
          <BottomTabButton
            label="Settings"
            active={activeTab === 'settings'}
            onPress={() => setActiveTab('settings')}
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
        renderWorkspace()
      ) : (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {renderAuth()}
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
    padding: 20,
    gap: 16,
  },
  authShell: {
    gap: 16,
    paddingTop: 8,
  },
  hero: {
    gap: 10,
    paddingTop: 20,
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
    fontWeight: '800',
    lineHeight: 40,
  },
  workspaceShell: {
    flex: 1,
  },
  workspaceScroll: {
    flex: 1,
  },
  workspaceContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 124,
  },
  workspaceHeader: {
    gap: 6,
    paddingTop: 12,
  },
  workspaceTitle: {
    color: colors.cream,
    fontSize: 30,
    fontWeight: '800',
  },
  workspaceBody: {
    color: colors.sand,
    fontSize: 15,
    lineHeight: 22,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subsectionTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabButtonActive: {
    borderColor: colors.clay,
    backgroundColor: 'rgba(210, 136, 89, 0.18)',
  },
  tabButtonLabel: {
    color: colors.sand,
    fontWeight: '700',
  },
  tabButtonLabelActive: {
    color: colors.cream,
    fontWeight: '800',
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
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.panelSoft,
    color: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 18,
  },
  noteInput: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
  },
  passwordField: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    color: colors.cream,
    fontSize: 18,
    minHeight: 48,
  },
  passwordToggle: {
    minWidth: 58,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  passwordToggleLabel: {
    color: colors.sand,
    fontWeight: '700',
    fontSize: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTagRow: {
    gap: 8,
    paddingVertical: 2,
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
    backgroundColor: 'rgba(210, 136, 89, 0.18)',
  },
  quickTagChipLabel: {
    color: colors.sand,
    fontSize: 13,
    fontWeight: '700',
  },
  quickTagChipLabelActive: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '800',
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
    marginVertical: 4,
  },
  authFooter: {
    gap: 10,
    alignItems: 'center',
    paddingBottom: 12,
  },
  footerCopy: {
    color: colors.sand,
    fontSize: 12,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  footerLink: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '700',
  },
  tabContent: {
    gap: 16,
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
    borderRadius: 24,
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
    width: 34,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  bottomTabIconWrapActive: {
    borderColor: colors.clay,
    backgroundColor: 'rgba(210, 136, 89, 0.18)',
  },
  bottomTabDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.sand,
    opacity: 0.75,
  },
  bottomTabDotActive: {
    backgroundColor: colors.cream,
    opacity: 1,
  },
  bottomTabLabel: {
    color: colors.sand,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomTabLabelActive: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  identityName: {
    color: colors.cream,
    fontSize: 24,
    fontWeight: '800',
  },
  identityEmail: {
    color: colors.sand,
    fontSize: 14,
  },
  propertyRow: {
    gap: 10,
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
  sectionHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  collapseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  collapseButtonLabel: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '700',
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
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  readinessBody: {
    color: '#fff6ef',
    fontSize: 15,
    lineHeight: 22,
  },
  compList: {
    gap: 10,
  },
  capturePropertyBanner: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  capturePropertyCopy: {
    flex: 1,
    gap: 4,
  },
  capturePropertyTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '800',
  },
  capturePropertyMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
  },
  capturePropertyBadge: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  inlinePhotoStack: {
    gap: 12,
  },
  inlinePhotoSummary: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  inlinePhotoHeadline: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '800',
  },
  compCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  compTitle: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  compMeta: {
    color: colors.sand,
    fontSize: 13,
    lineHeight: 18,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
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
  galleryRail: {
    gap: 12,
    paddingVertical: 4,
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
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: 'rgba(210, 136, 89, 0.18)',
    borderColor: colors.clay,
  },
  filterChipLabel: {
    color: colors.sand,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipLabelActive: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '800',
  },
  galleryThumbCard: {
    width: 128,
    gap: 8,
  },
  galleryThumbCardActive: {
    opacity: 1,
  },
  galleryThumbImage: {
    width: 128,
    height: 96,
    borderRadius: 16,
    backgroundColor: colors.panelSoft,
  },
  galleryThumbLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 13,
  },
  galleryDetailCard: {
    gap: 10,
  },
  galleryDetailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
  },
  galleryDetailTitle: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
  },
  galleryDetailMeta: {
    color: colors.sand,
    fontSize: 13,
  },
  settingsLinkStack: {
    gap: 10,
  },
  settingsLink: {
    color: colors.moss,
    fontSize: 15,
    fontWeight: '700',
  },
  visionStack: {
    gap: 14,
  },
  visionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  visionRank: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(210, 136, 89, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(210, 136, 89, 0.36)',
  },
  visionRankLabel: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '800',
  },
  visionCopy: {
    flex: 1,
    gap: 4,
  },
  visionTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '800',
  },
  visionBody: {
    color: colors.sand,
    fontSize: 14,
    lineHeight: 20,
  },
  checklistStack: {
    gap: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checklistCopy: {
    flex: 1,
    gap: 2,
  },
  checklistTitle: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  checkmarkDone: {
    color: colors.moss,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 16,
  },
  checkmarkOpen: {
    color: colors.clay,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 16,
  },
  taskStack: {
    gap: 12,
  },
  taskCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  taskCardDone: {
    backgroundColor: 'rgba(124, 162, 127, 0.12)',
  },
  taskStatusDone: {
    color: colors.moss,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  taskStatusOpen: {
    color: colors.clay,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  taskTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '800',
  },
});
