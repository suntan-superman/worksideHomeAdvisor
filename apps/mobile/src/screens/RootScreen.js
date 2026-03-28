import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Signed-in user';
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false, compact = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        compact ? styles.buttonCompact : null,
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

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('properties');
  const [propertySection, setPropertySection] = useState('overview');
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

  const topComps = dashboard?.pricing?.selectedComps?.slice(0, 4) || [];

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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

            {propertySection === 'overview' ? (
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

            {propertySection === 'insights' ? (
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

            {propertySection === 'photos' ? (
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

  function renderProfile() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.profileName}>{getDisplayName(session.user)}</Text>
        <Text style={styles.profileEmail}>{session.user.email}</Text>
        <Text style={styles.cardBody}>
          Current mobile mode is optimized for field capture, quick pricing review, and property media organization.
        </Text>
        <View style={styles.profileMetaRow}>
          <ScoreBadge label="Selected property" value={selectedProperty?.title || 'None'} />
          <ScoreBadge label="Gallery count" value={String(gallery.length)} />
        </View>
      </View>
    );
  }

  function renderAuthenticatedWorkspace() {
    const tabAccent = {
      properties: colors.moss,
      capture: colors.clay,
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
          {activeTab === 'capture' ? renderCapture() : null}
          {activeTab === 'gallery' ? renderGallery() : null}
          {activeTab === 'profile' ? renderProfile() : null}
        </ScrollView>

        <View style={styles.bottomTabBar}>
          <BottomTabButton
            label="Properties"
            active={activeTab === 'properties'}
            onPress={() => setActiveTab('properties')}
            accent={tabAccent.properties}
          />
          <BottomTabButton
            label="Capture"
            active={activeTab === 'capture'}
            onPress={() => setActiveTab('capture')}
            accent={tabAccent.capture}
          />
          <BottomTabButton
            label="Gallery"
            active={activeTab === 'gallery'}
            onPress={() => setActiveTab('gallery')}
            accent={tabAccent.gallery}
          />
          <BottomTabButton
            label="Profile"
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
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 36,
    gap: 16,
  },
  workspaceShell: {
    flex: 1,
  },
  workspaceScroll: {
    flex: 1,
  },
  workspaceContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
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
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  authIntro: {
    color: colors.sand,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
    fontSize: 24,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.sand,
    fontSize: 15,
    lineHeight: 23,
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
    fontSize: 22,
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
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.panelSoft,
    color: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
  },
  passwordField: {
    minHeight: 50,
    borderRadius: 16,
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
    fontSize: 16,
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
  identityCard: {
    padding: 18,
    borderRadius: 22,
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
    fontSize: 22,
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
    gap: 8,
    paddingHorizontal: 10,
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
    fontSize: 11,
    fontWeight: '600',
  },
  bottomTabLabelActive: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '800',
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
  propertyCard: {
    width: 204,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
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
    padding: 20,
    borderRadius: 26,
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
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.panel,
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.panel,
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
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.panel,
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
});
