import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as ImagePicker from 'expo-image-picker';

import {
  createChecklistItem,
  createImageEnhancementJob,
  getChecklist,
  getDashboard,
  listMediaAssets,
  listMediaVariants,
  listProperties,
  login,
  requestOtp,
  savePhoto,
  selectMediaVariant,
  updateChecklistItem,
  updateMediaAsset,
  verifyEmailOtp,
} from '../services/api';

const ROOM_LABEL_OPTIONS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const LAST_LOGIN_EMAIL_KEY = 'workside.lastLoginEmail';
const WEB_BASE_URL = 'https://worksidehomeadvisor.netlify.app';
const TERMS_URL = `${WEB_BASE_URL}/terms`;
const PRIVACY_URL = `${WEB_BASE_URL}/privacy`;
const SUPPORT_URL = 'mailto:support@worksidesoftware.com';

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

function formatChecklistStatus(status) {
  if (status === 'done') {
    return 'Done';
  }

  if (status === 'in_progress') {
    return 'In progress';
  }

  return 'Open';
}

function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This variant can be marked preferred for flyer and report selection.'
  );
}

export function RootScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [propertyDetailsCollapsed, setPropertyDetailsCollapsed] = useState(false);
  const [propertySection, setPropertySection] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Sign in with the same verified seller account you use on the web.');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [mediaVariants, setMediaVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [listingNoteDraft, setListingNoteDraft] = useState('');
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [photoAsset, setPhotoAsset] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    otpCode: '',
    roomLabel: ROOM_LABEL_OPTIONS[0],
  });

  const selectedProperty = properties.find((property) => property.id === propertyId) || null;
  const selectedAsset = gallery.find((asset) => asset.id === selectedAssetId) || gallery[0] || null;
  const selectedVariant =
    mediaVariants.find((variant) => variant.id === selectedVariantId) ||
    mediaVariants.find((variant) => variant.isSelected) ||
    mediaVariants[0] ||
    null;
  const roomCoverage = ROOM_LABEL_OPTIONS.map((roomLabel) => ({
    roomLabel,
    captured: gallery.some((asset) => asset.roomLabel === roomLabel),
  }));
  const bestCandidates = [...gallery]
    .filter((asset) => typeof asset.analysis?.overallQualityScore === 'number')
    .sort(
      (left, right) => {
        if (Boolean(left.listingCandidate) !== Boolean(right.listingCandidate)) {
          return left.listingCandidate ? -1 : 1;
        }

        return (
          Number(right.analysis?.overallQualityScore || 0) -
          Number(left.analysis?.overallQualityScore || 0)
        );
      },
    )
    .slice(0, 3);
  const checklistItems = checklist?.items || [];

  useEffect(() => {
    setListingNoteDraft(selectedAsset?.listingNote || '');
  }, [selectedAsset?.id, selectedAsset?.listingNote]);

  useEffect(() => {
    async function loadVariants() {
      if (!selectedAsset?.id) {
        setMediaVariants([]);
        setSelectedVariantId('');
        return;
      }

      try {
        const variantsResponse = await listMediaVariants(selectedAsset.id);
        const nextVariants = variantsResponse.variants || [];
        setMediaVariants(nextVariants);
        setSelectedVariantId(
          nextVariants.find((variant) => variant.isSelected)?.id || nextVariants[0]?.id || '',
        );
      } catch {
        setMediaVariants([]);
        setSelectedVariantId('');
      }
    }

    loadVariants();
  }, [selectedAsset?.id]);

  useEffect(() => {
    let active = true;

    async function loadRememberedEmail() {
      try {
        const rememberedEmail = await AsyncStorage.getItem(LAST_LOGIN_EMAIL_KEY);
        if (active && rememberedEmail) {
          setForm((current) => ({
            ...current,
            email: current.email || rememberedEmail,
          }));
        }
      } catch (storageError) {
        // Keep auth usable even if local storage is unavailable.
      }
    }

    loadRememberedEmail();

    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function rememberEmail(email) {
    try {
      await AsyncStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());
    } catch (storageError) {
      // Login should still succeed even if local persistence is unavailable.
    }
  }

  async function openExternalLink(url) {
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      setError('Unable to open that link on this device right now.');
    }
  }

  async function loadPropertyWorkspace(userId) {
    const propertiesResponse = await listProperties(userId);
    const nextProperties = propertiesResponse.properties || [];
    const nextPropertyId = nextProperties[0]?.id || '';
    setProperties(nextProperties);
    setPropertyId(nextPropertyId);

    if (!nextPropertyId) {
      setDashboard(null);
      setChecklist(null);
      return;
    }

    const [dashboardResponse, mediaResponse, checklistResponse] = await Promise.all([
      getDashboard(nextPropertyId),
      listMediaAssets(nextPropertyId),
      getChecklist(nextPropertyId),
    ]);
    setDashboard(dashboardResponse);
    setChecklist(checklistResponse.checklist);
    setGallery(mediaResponse.assets || []);
    setSelectedAssetId(mediaResponse.assets?.[0]?.id || '');
    setPropertySection('overview');
  }

  async function refreshGallery(preferredAssetId = selectedAssetId) {
    const mediaResponse = await listMediaAssets(propertyId);
    const nextAssets = mediaResponse.assets || [];
    setGallery(nextAssets);
    setSelectedAssetId(preferredAssetId || nextAssets?.[0]?.id || '');
    return nextAssets;
  }

  async function refreshVariants(assetId = selectedAsset?.id) {
    if (!assetId) {
      setMediaVariants([]);
      setSelectedVariantId('');
      return [];
    }

    const variantsResponse = await listMediaVariants(assetId);
    const nextVariants = variantsResponse.variants || [];
    setMediaVariants(nextVariants);
    setSelectedVariantId(
      nextVariants.find((variant) => variant.isSelected)?.id || nextVariants[0]?.id || '',
    );
    return nextVariants;
  }

  async function refreshChecklist(nextPropertyId = propertyId) {
    if (!nextPropertyId) {
      setChecklist(null);
      return null;
    }

    const checklistResponse = await getChecklist(nextPropertyId);
    setChecklist(checklistResponse.checklist);
    return checklistResponse.checklist;
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
      await rememberEmail(form.email);
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
      await rememberEmail(form.email);
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
    setPropertySection('overview');
    setError('');
    setStatus('Signed out. Sign in again to continue.');
  }

  async function handleSelectProperty(nextPropertyId) {
    setBusy(true);
    setError('');

    try {
      setPropertyId(nextPropertyId);
      setPropertyDetailsCollapsed(false);
      setPropertySection('overview');
      const [dashboardResponse, mediaResponse, checklistResponse] = await Promise.all([
        getDashboard(nextPropertyId),
        listMediaAssets(nextPropertyId),
        getChecklist(nextPropertyId),
      ]);
      setDashboard(dashboardResponse);
      setChecklist(checklistResponse.checklist);
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
      await Promise.all([refreshGallery(), refreshChecklist()]);
      setPhotoAsset(null);
      setPropertySection('gallery');
      setStatus('Photo saved to the selected property.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleListingCandidate() {
    if (!selectedAsset) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const nextValue = !selectedAsset.listingCandidate;
      await updateMediaAsset(selectedAsset.id, {
        listingCandidate: nextValue,
      });
      await Promise.all([refreshGallery(selectedAsset.id), refreshChecklist()]);
      setStatus(
        nextValue
          ? 'Photo marked as a listing candidate.'
          : 'Photo removed from the listing-candidate set.',
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveListingNote() {
    if (!selectedAsset) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await updateMediaAsset(selectedAsset.id, {
        listingNote: listingNoteDraft,
      });
      await refreshGallery(selectedAsset.id);
      setStatus('Listing note saved to this photo.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateChecklistStatus(itemId, nextStatus) {
    setBusy(true);
    setError('');

    try {
      const response = await updateChecklistItem(itemId, {
        status: nextStatus,
      });
      const dashboardResponse = await getDashboard(propertyId);
      setDashboard(dashboardResponse);
      setChecklist(response.checklist);
      setStatus('Checklist progress saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCustomTask() {
    if (!propertyId || !customTaskTitle.trim()) {
      setError('Add a task title before saving a custom checklist item.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await createChecklistItem(propertyId, {
        title: customTaskTitle,
        category: 'custom',
        priority: 'medium',
      });
      const dashboardResponse = await getDashboard(propertyId);
      setDashboard(dashboardResponse);
      setChecklist(response.checklist);
      setCustomTaskTitle('');
      setStatus('Custom checklist task added.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateVariant(jobType) {
    if (!selectedAsset) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await createImageEnhancementJob(selectedAsset.id, {
        jobType,
      });
      await Promise.all([refreshGallery(selectedAsset.id), refreshVariants(selectedAsset.id)]);
      setSelectedVariantId(response.variant?.id || '');
      setStatus(
        response.job?.warning ||
          (jobType === 'declutter_preview'
            ? 'Declutter preview generated.'
            : 'Enhanced listing version generated.'),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectVariant(variantId) {
    if (!selectedAsset) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await selectMediaVariant(selectedAsset.id, variantId);
      await Promise.all([refreshGallery(selectedAsset.id), refreshVariants(selectedAsset.id)]);
      setSelectedVariantId(variantId);
      setStatus('Preferred variant selected for future flyer and report output.');
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
            <Text style={styles.kicker}>Mobile Workspace</Text>
            <Text style={styles.title}>Workside Home Advisor</Text>
            <Text style={styles.body}>
              Pricing, photos, checklist progress, and seller guidance stay connected here across every property.
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
                    <View style={styles.sectionChipRow}>
                      {[
                        ['overview', 'Overview'],
                        ['capture', 'Capture'],
                        ['gallery', 'Gallery'],
                        ['vision', 'Vision'],
                        ['tasks', 'Tasks'],
                      ].map(([value, label]) => (
                        <Pressable
                          key={value}
                          onPress={() => setPropertySection(value)}
                          style={[
                            styles.sectionChip,
                            propertySection === value ? styles.sectionChipActive : null,
                          ]}
                        >
                          <Text
                            style={
                              propertySection === value
                                ? styles.sectionChipLabelActive
                                : styles.sectionChipLabel
                            }
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {propertySection === 'overview' ? (
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
                      </>
                    ) : null}

                    {propertySection === 'capture' ? (
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
                    ) : null}

                    {propertySection === 'gallery' ? (
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
                                  {asset.selectedVariant ? (
                                    <Text style={styles.galleryTileTag} numberOfLines={1}>
                                      {asset.selectedVariant.label || 'Vision preferred'}
                                    </Text>
                                  ) : null}
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
                                {selectedAsset.listingCandidate ? (
                                  <Text style={styles.listingCandidateTag}>Listing candidate selected</Text>
                                ) : null}
                                {selectedAsset.selectedVariant ? (
                                  <Text style={styles.preferredVariantTag}>
                                    Preferred vision variant: {selectedAsset.selectedVariant.label || 'Vision-ready version'}
                                  </Text>
                                ) : null}
                                <View style={styles.actionRow}>
                                  <Pressable
                                    onPress={handleToggleListingCandidate}
                                    style={[
                                      styles.button,
                                      selectedAsset.listingCandidate ? styles.buttonSecondary : styles.buttonPrimary,
                                      styles.flexButton,
                                    ]}
                                    disabled={busy}
                                  >
                                    <Text
                                      style={
                                        selectedAsset.listingCandidate
                                          ? styles.buttonSecondaryText
                                          : styles.buttonText
                                      }
                                    >
                                      {selectedAsset.listingCandidate ? 'Remove candidate' : 'Mark candidate'}
                                    </Text>
                                  </Pressable>
                                </View>
                                <TextInput
                                  placeholder="Add a listing note for this photo"
                                  placeholderTextColor="#7d8a8f"
                                  style={[styles.input, styles.noteInput]}
                                  value={listingNoteDraft}
                                  onChangeText={setListingNoteDraft}
                                  multiline
                                />
                                <Pressable
                                  onPress={handleSaveListingNote}
                                  style={[styles.button, styles.buttonSecondary]}
                                  disabled={busy}
                                >
                                  <Text style={styles.buttonSecondaryText}>Save note</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </>
                        ) : (
                          <Text style={styles.body}>No saved photos yet for this property.</Text>
                        )}
                      </View>
                    ) : null}

                    {propertySection === 'vision' ? (
                      <View style={styles.sectionPanel}>
                        <Text style={styles.label}>Vision</Text>
                        <Text style={styles.body}>
                          Generate first-pass image variants and choose which version should feed materials.
                        </Text>
                        <View style={styles.coverageList}>
                          {roomCoverage.map((item) => (
                            <View key={item.roomLabel} style={styles.coverageRow}>
                              <Text style={styles.coverageRoom}>{item.roomLabel}</Text>
                              <Text style={item.captured ? styles.coverageDone : styles.coverageMissing}>
                                {item.captured ? 'Captured' : 'Missing'}
                              </Text>
                            </View>
                          ))}
                        </View>
                        {selectedAsset ? (
                          <View style={styles.visionPanel}>
                            <Text style={styles.label}>Selected photo</Text>
                            <Image source={{ uri: selectedAsset.imageUrl }} style={styles.visionImage} />
                            {selectedAsset.selectedVariant ? (
                              <Text style={styles.preferredVariantTag}>
                                Materials currently prefer {selectedAsset.selectedVariant.label || 'the saved vision variant'} for this photo.
                              </Text>
                            ) : null}
                            <View style={styles.actionRow}>
                              <Pressable
                                onPress={() => handleGenerateVariant('enhance_listing_quality')}
                                style={[styles.button, styles.buttonSecondary, styles.flexButton]}
                                disabled={busy}
                              >
                                <Text style={styles.buttonSecondaryText}>Enhance</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleGenerateVariant('declutter_preview')}
                                style={[styles.button, styles.buttonSecondary, styles.flexButton]}
                                disabled={busy}
                              >
                                <Text style={styles.buttonSecondaryText}>Declutter</Text>
                              </Pressable>
                            </View>
                            {selectedVariant ? (
                              <>
                                <Text style={styles.label}>Vision output</Text>
                                <Text style={styles.variantSummary}>{getVariantSummary(selectedVariant)}</Text>
                                <Image source={{ uri: selectedVariant.imageUrl }} style={styles.visionImage} />
                                {selectedVariant.metadata?.effects?.length ? (
                                  <View style={styles.effectList}>
                                    {selectedVariant.metadata.effects.map((effect) => (
                                      <View key={effect} style={styles.effectChip}>
                                        <Text style={styles.effectChipText}>{effect}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}
                                {selectedVariant.metadata?.differenceHint ? (
                                  <Text style={styles.variantHint}>{selectedVariant.metadata.differenceHint}</Text>
                                ) : null}
                                {selectedVariant.metadata?.warning ? (
                                  <Text style={styles.body}>{selectedVariant.metadata.warning}</Text>
                                ) : null}
                                <View style={styles.variantList}>
                                  {mediaVariants.map((variant) => (
                                    <Pressable
                                      key={variant.id}
                                      onPress={() => setSelectedVariantId(variant.id)}
                                      style={[
                                        styles.taskActionChip,
                                        variant.id === selectedVariant?.id ? styles.taskActionChipActive : null,
                                      ]}
                                    >
                                      <Text
                                        style={
                                          variant.id === selectedVariant?.id
                                            ? styles.taskActionChipTextActive
                                            : styles.taskActionChipText
                                        }
                                      >
                                        {variant.label}
                                        {variant.isSelected ? ' · Preferred' : ''}
                                      </Text>
                                    </Pressable>
                                  ))}
                                </View>
                                <Pressable
                                  onPress={() => handleSelectVariant(selectedVariant.id)}
                                  style={[styles.button, styles.buttonSecondary]}
                                  disabled={busy || selectedVariant.isSelected}
                                >
                                  <Text style={styles.buttonSecondaryText}>
                                    {selectedVariant.isSelected
                                      ? 'Preferred variant selected'
                                      : 'Use this variant in materials'}
                                  </Text>
                                </Pressable>
                              </>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={styles.candidateList}>
                          {bestCandidates.length ? (
                            bestCandidates.map((asset, index) => (
                              <View key={asset.id} style={styles.candidateCard}>
                                <Text style={styles.candidateRank}>#{index + 1}</Text>
                                <View style={styles.candidateCopy}>
                                  <Text style={styles.candidateTitle}>{asset.roomLabel}</Text>
                                  <Text style={styles.candidateMeta}>
                                    Quality {asset.analysis?.overallQualityScore || 0}/100
                                    {asset.analysis?.bestUse ? ` · ${asset.analysis.bestUse}` : ''}
                                  </Text>
                                  {asset.listingCandidate ? (
                                    <Text style={styles.candidateSelectedTag}>
                                      Seller selected{asset.listingNote ? ` · ${asset.listingNote}` : ''}
                                    </Text>
                                  ) : null}
                                  {asset.selectedVariant ? (
                                    <Text style={styles.preferredVariantTag}>
                                      {asset.selectedVariant.label || 'Vision preferred for materials'}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.body}>
                              Save a few reviewed photos and the strongest listing candidates will show here.
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : null}

                    {propertySection === 'tasks' ? (
                      <View style={styles.sectionPanel}>
                        <Text style={styles.label}>Tasks</Text>
                        <Text style={styles.body}>
                          Shared seller checklist progress now syncs with the web workspace and report.
                        </Text>
                        <View style={styles.taskSummaryCard}>
                          <Text style={styles.taskSummaryValue}>
                            {checklist?.summary?.progressPercent ?? 0}% ready
                          </Text>
                          <Text style={styles.taskSummaryText}>
                            {checklist?.summary?.completedCount ?? 0} completed · {checklist?.summary?.openCount ?? 0} open
                          </Text>
                          <Text style={styles.taskSummaryText}>
                            Next: {checklist?.nextTask?.title || 'No open tasks right now'}
                          </Text>
                        </View>
                        <View style={styles.taskList}>
                          {checklistItems.length ? (
                            checklistItems.map((task) => (
                              <View key={task.id} style={styles.taskCard}>
                                <View style={styles.taskMetaRow}>
                                  <Text
                                    style={
                                      task.status === 'done'
                                        ? styles.taskDone
                                        : task.status === 'in_progress'
                                          ? styles.taskWorking
                                          : styles.taskOpen
                                    }
                                  >
                                    {formatChecklistStatus(task.status)}
                                  </Text>
                                  <Text style={styles.taskCategory}>
                                    {String(task.category || 'custom').replace(/_/g, ' ')}
                                  </Text>
                                </View>
                                <Text style={styles.taskTitle}>{task.title}</Text>
                                <Text style={styles.taskDetail}>{task.detail}</Text>
                                <View style={styles.taskActionRow}>
                                  {[
                                    ['todo', 'To do'],
                                    ['in_progress', 'Working'],
                                    ['done', 'Done'],
                                  ].map(([nextStatus, label]) => (
                                    <Pressable
                                      key={`${task.id}-${nextStatus}`}
                                      onPress={() => handleUpdateChecklistStatus(task.id, nextStatus)}
                                      style={[
                                        styles.taskActionChip,
                                        task.status === nextStatus ? styles.taskActionChipActive : null,
                                      ]}
                                      disabled={busy}
                                    >
                                      <Text
                                        style={
                                          task.status === nextStatus
                                            ? styles.taskActionChipTextActive
                                            : styles.taskActionChipText
                                        }
                                      >
                                        {label}
                                      </Text>
                                    </Pressable>
                                  ))}
                                </View>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.body}>
                              No checklist items yet for this property.
                            </Text>
                          )}
                        </View>
                        <TextInput
                          placeholder="Add a custom seller task"
                          placeholderTextColor="#7d8a8f"
                          style={styles.input}
                          value={customTaskTitle}
                          onChangeText={setCustomTaskTitle}
                        />
                        <Pressable
                          onPress={handleCreateCustomTask}
                          style={[styles.button, styles.buttonSecondary]}
                          disabled={busy}
                        >
                          <Text style={styles.buttonSecondaryText}>Add task</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.body}>Property details are collapsed. Expand when you want pricing and capture tools.</Text>
                )}
              </View>
            ) : null}

            {status ? <Text style={styles.status}>{status}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}
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
          <Text style={styles.kicker}>Seller Access</Text>
          <Text style={styles.title}>Workside Home Advisor</Text>
          <Text style={styles.body}>
            Sign in with your verified Workside account to manage pricing, prep, photos, and listing readiness on the go.
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
        </View>

        <View style={styles.authFooter}>
          <Text style={styles.authFooterCopy}>Copyright 2026 Workside Software LLC.</Text>
          <View style={styles.authFooterLinks}>
            <Pressable onPress={() => openExternalLink(TERMS_URL)}>
              <Text style={styles.authFooterLink}>Terms of Service</Text>
            </Pressable>
            <Pressable onPress={() => openExternalLink(PRIVACY_URL)}>
              <Text style={styles.authFooterLink}>Privacy Notice</Text>
            </Pressable>
            <Pressable onPress={() => openExternalLink(SUPPORT_URL)}>
              <Text style={styles.authFooterLink}>Support</Text>
            </Pressable>
          </View>
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
    gap: 18,
  },
  card: {
    backgroundColor: 'rgba(38, 50, 61, 0.78)',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(126, 145, 160, 0.28)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
    backgroundColor: 'rgba(124, 162, 127, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  error: {
    color: '#f0a08e',
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: 'rgba(174, 67, 53, 0.12)',
    borderRadius: 14,
    padding: 12,
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
  sectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  sectionChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  sectionChipActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  sectionChipLabel: {
    color: '#dbcbb7',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionChipLabelActive: {
    color: '#fff7ee',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionPanel: {
    gap: 12,
    marginTop: 8,
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
    paddingTop: 10,
  },
  galleryTileTag: {
    color: '#d28859',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingBottom: 10,
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
  listingCandidateTag: {
    color: '#93a982',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  preferredVariantTag: {
    color: '#d28859',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  variantSummary: {
    color: '#f8f1e6',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  variantHint: {
    color: '#dbcbb7',
    fontSize: 13,
    lineHeight: 20,
  },
  noteInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  coverageList: {
    gap: 10,
  },
  coverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  coverageRoom: {
    color: '#f8f1e6',
    fontSize: 15,
    fontWeight: '700',
  },
  coverageDone: {
    color: '#93a982',
    fontSize: 14,
    fontWeight: '700',
  },
  coverageMissing: {
    color: '#f0a08e',
    fontSize: 14,
    fontWeight: '700',
  },
  candidateList: {
    gap: 10,
  },
  candidateCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  candidateRank: {
    color: '#d28859',
    fontSize: 18,
    fontWeight: '800',
    minWidth: 28,
  },
  candidateCopy: {
    flex: 1,
    gap: 4,
  },
  candidateTitle: {
    color: '#f8f1e6',
    fontSize: 16,
    fontWeight: '800',
  },
  candidateMeta: {
    color: '#dbcbb7',
    fontSize: 14,
    lineHeight: 20,
  },
  candidateSelectedTag: {
    color: '#93a982',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  visionPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  visionImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#1b252d',
  },
  effectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#22303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  effectChipText: {
    color: '#d28859',
    fontSize: 12,
    fontWeight: '700',
  },
  variantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskList: {
    gap: 10,
  },
  taskSummaryCard: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  taskSummaryValue: {
    color: '#fff7ee',
    fontSize: 26,
    fontWeight: '800',
  },
  taskSummaryText: {
    color: '#dbcbb7',
    fontSize: 14,
    lineHeight: 20,
  },
  taskCard: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  taskMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  taskDone: {
    color: '#93a982',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  taskOpen: {
    color: '#d28859',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  taskWorking: {
    color: '#e3b453',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  taskCategory: {
    color: '#b9af9f',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  taskTitle: {
    color: '#f8f1e6',
    fontSize: 16,
    fontWeight: '800',
  },
  taskDetail: {
    color: '#dbcbb7',
    fontSize: 14,
    lineHeight: 20,
  },
  taskActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  taskActionChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#425563',
    backgroundColor: '#31404d',
  },
  taskActionChipActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  taskActionChipText: {
    color: '#dbcbb7',
    fontSize: 13,
    fontWeight: '700',
  },
  taskActionChipTextActive: {
    color: '#fff7ee',
    fontSize: 13,
    fontWeight: '800',
  },
  authFooter: {
    gap: 10,
    alignItems: 'center',
    paddingBottom: 12,
  },
  authFooterCopy: {
    color: '#b9af9f',
    fontSize: 12,
    textAlign: 'center',
  },
  authFooterLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  authFooterLink: {
    color: '#93a982',
    fontSize: 12,
    fontWeight: '700',
  },
});
