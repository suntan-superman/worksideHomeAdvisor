import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
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
  verifyEmailOtp,
} from '../services/api';
import { colors } from '../theme/tokens';

const TERMS_URL = 'https://worksidehomeadvisor.netlify.app/terms';
const PRIVACY_URL = 'https://worksidehomeadvisor.netlify.app/privacy';
const SUPPORT_EMAIL = 'support@worksidesoftware.com';

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

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('properties');
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
  const accountDeletionBlocked = Boolean(
    session?.user?.isDemoAccount || session?.user?.role === 'admin' || session?.user?.role === 'super_admin',
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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
    setPropertyDetailsCollapsed(false);
    setProperties([]);
    setPropertyId('');
    setDashboard(null);
    setPhotoAsset(null);
    setAnalysis(null);
    setGallery([]);
    setSelectedPhotoId('');
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
  }

  async function loadPropertiesForUser(userId) {
    const propertiesResponse = await listProperties(userId);
    const nextProperties = propertiesResponse.properties || [];
    const nextPropertyId = nextProperties[0]?.id || '';

    setProperties(nextProperties);
    setPropertyId(nextPropertyId);
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

                {selectedComps.length ? (
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
                ) : null}
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
          <TextInput
            style={styles.input}
            placeholder="Room label"
            placeholderTextColor="#7d8a8f"
            value={form.roomLabel}
            onChangeText={(value) => updateField('roomLabel', value)}
          />
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
          {gallery.length === 0 ? (
            <Text style={styles.cardBody}>No saved photos yet for this property.</Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryRail}
              >
                {gallery.map((asset) => (
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
                  {selectedPhoto.analysis?.summary ? (
                    <Text style={styles.cardBody}>{selectedPhoto.analysis.summary}</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
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

    if (activeTab === 'capture') {
      content = renderCaptureTab();
    } else if (activeTab === 'gallery') {
      content = renderGalleryTab();
    } else if (activeTab === 'settings') {
      content = renderSettingsTab();
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
            <Text style={styles.workspaceTitle}>Field workspace</Text>
          </View>

          <View style={styles.tabsRow}>
            <TabButton label="Properties" active={activeTab === 'properties'} onPress={() => setActiveTab('properties')} />
            <TabButton label="Capture" active={activeTab === 'capture'} onPress={() => setActiveTab('capture')} />
            <TabButton label="Gallery" active={activeTab === 'gallery'} onPress={() => setActiveTab('gallery')} />
            <TabButton label="Settings" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
          </View>

          {renderFeedback()}
          {content}
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
    paddingBottom: 28,
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
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
});
