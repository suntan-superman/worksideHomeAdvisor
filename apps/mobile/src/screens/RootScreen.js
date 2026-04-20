import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as ImagePicker from 'expo-image-picker';

import {
  createChecklistItem,
  createImageEnhancementJob,
  deleteAccount,
  getCurrentUser,
  getChecklist,
  getDashboard,
  getWorkflow,
  listMediaAssets,
  listMediaVariants,
  listProperties,
  login,
  requestForgotPasswordOtp,
  requestOtp,
  resetForgottenPassword,
  savePhoto,
  saveVariantToPhotos,
  selectMediaVariant,
  updateUserProfile,
  updateChecklistItem,
  updateMediaAsset,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
} from '../services/api';
import {
  ROOM_LABEL_OPTIONS,
  formatWorkflowStatus,
  getDisplayName,
  getRecommendedSection,
  getVisionActionLabel,
  getVisionActionRecommendation,
  getVisionPipelinePackageSummary,
  getVisionSaveDefaults,
  getVisionWorkflowStageKeyForJobType,
  summarizePricing,
} from './rootScreen.helpers';
import {
  useDefaultAssetSelection,
  useDefaultPropertySelection,
  useDefaultVariantSelection,
  useKeyboardVisibility,
  useRememberedEmail,
  useSyncAccountFormFromSession,
} from './rootScreen.hooks';
import { RootScreenAuthenticatedView } from './rootScreenAuthenticatedView.js';
import { RootScreenAuthView } from './rootScreenAuthView.js';
import { RootScreenPropertyWorkspaceContent } from './rootScreenPropertyWorkspaceContent.js';
import { styles } from './rootScreen.styles';

const LAST_LOGIN_EMAIL_KEY = 'workside.lastLoginEmail';
const WEB_BASE_URL = 'https://worksideadvisor.com';
const TERMS_URL = `${WEB_BASE_URL}/terms`;
const PRIVACY_URL = `${WEB_BASE_URL}/privacy`;
const SUPPORT_URL = 'mailto:support@worksideadvisor.com';

export function RootScreen() {
  const queryClient = useQueryClient();
  const firstImpressionAutoStartedAssetIdsRef = useRef(new Set());
  const [authMode, setAuthMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [propertySection, setPropertySection] = useState('overview');
  const [busyState, setBusyState] = useState(false);
  const [status, setStatus] = useState('Sign in with the same verified seller account you use on the web.');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [propertyId, setPropertyId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [listingNoteDraft, setListingNoteDraft] = useState('');
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [photoAsset, setPhotoAsset] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pendingVisionJobType, setPendingVisionJobType] = useState('');
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [appScreen, setAppScreen] = useState('home');
  const [showVisionDetails, setShowVisionDetails] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [freeformEnhancementInstructions, setFreeformEnhancementInstructions] = useState('');
  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    mobilePhone: '',
    smsOptIn: false,
  });
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    otpCode: '',
    resetToken: '',
    roomLabel: ROOM_LABEL_OPTIONS[0],
  });

  const propertiesQuery = useQuery({
    queryKey: ['mobile-properties', session?.user?.id || ''],
    enabled: Boolean(session?.user?.id),
    queryFn: async () => {
      const response = await listProperties(session.user.id);
      return response.properties || [];
    },
  });

  const properties = propertiesQuery.data || [];

  const dashboardQuery = useQuery({
    queryKey: ['mobile-dashboard', propertyId],
    enabled: Boolean(session?.user?.id && propertyId),
    queryFn: async () => getDashboard(propertyId),
  });

  const checklistQuery = useQuery({
    queryKey: ['mobile-checklist', propertyId],
    enabled: Boolean(session?.user?.id && propertyId),
    queryFn: async () => {
      const response = await getChecklist(propertyId);
      return response.checklist;
    },
  });

  const galleryQuery = useQuery({
    queryKey: ['mobile-gallery', propertyId],
    enabled: Boolean(session?.user?.id && propertyId),
    queryFn: async () => {
      const response = await listMediaAssets(propertyId);
      return response.assets || [];
    },
  });

  const gallery = galleryQuery.data || [];
  const dashboard = dashboardQuery.data || null;
  const checklist = checklistQuery.data || null;
  const viewerRole = session?.user?.role === 'agent' ? 'agent' : 'seller';

  const selectedProperty = properties.find((property) => property.id === propertyId) || null;
  const workflowQuery = useQuery({
    queryKey: ['mobile-workflow', propertyId, viewerRole],
    enabled: Boolean(session?.user?.id && propertyId),
    queryFn: async () => {
      const response = await getWorkflow(propertyId, viewerRole);
      return response.workflow;
    },
  });
  const workflow = workflowQuery.data || null;
  const selectedAsset = gallery.find((asset) => asset.id === selectedAssetId) || gallery[0] || null;
  const variantsQuery = useQuery({
    queryKey: ['mobile-media-variants', selectedAsset?.id || ''],
    enabled: Boolean(session?.user?.id && selectedAsset?.id),
    queryFn: async () => {
      const response = await listMediaVariants(selectedAsset.id);
      return response.variants || [];
    },
  });

  const mediaVariants = variantsQuery.data || [];
  const selectedVariant =
    mediaVariants.find((variant) => variant.id === selectedVariantId) ||
    mediaVariants.find((variant) => variant.isSelected) ||
    mediaVariants[0] ||
    null;
  const savedAssetForSelectedVariant =
    gallery.find((asset) => String(asset?.sourceVariantId || '') === String(selectedVariant?.id || '')) ||
    null;
  const currentVisionSaveDefaults = getVisionSaveDefaults(selectedVariant);
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
  const capturedRoomCount =
    workflow?.metrics?.roomCoverageCount ?? roomCoverage.filter((item) => item.captured).length;
  const nextMissingRoom = roomCoverage.find((item) => !item.captured)?.roomLabel || ROOM_LABEL_OPTIONS[0];
  const recommendedSection = getRecommendedSection(workflow?.nextStep?.key);
  const pricingHighlights = summarizePricing(dashboard?.pricingSummary);
  const visionActionRecommendation = getVisionActionRecommendation(selectedAsset, selectedVariant);
  const recommendedVisionAction = visionActionRecommendation.presetKey;
  const recommendedDeclutterPresetKey =
    recommendedVisionAction === 'declutter_medium' || recommendedVisionAction === 'declutter_light'
      ? recommendedVisionAction
      : 'declutter_light';
  const isDeclutterRecommended =
    recommendedVisionAction === 'declutter_medium' || recommendedVisionAction === 'declutter_light';
  const isLightingRecommended = recommendedVisionAction === 'lighting_boost';
  const currentVisionPipelinePackage = getVisionPipelinePackageSummary(
    selectedVariant,
    currentVisionSaveDefaults,
  );
  const visibleVisionEffects = (selectedVariant?.metadata?.effects || []).slice(0, 2);
  const hiddenVisionEffectCount = Math.max((selectedVariant?.metadata?.effects || []).length - 2, 0);
  const openChecklistItems = checklistItems.filter((task) => task.status !== 'done');
  const completedChecklistItems = checklistItems.filter((task) => task.status === 'done');

  useEffect(() => {
    setListingNoteDraft(selectedAsset?.listingNote || '');
  }, [selectedAsset?.id, selectedAsset?.listingNote]);

  useDefaultPropertySelection({
    sessionUserId: session?.user?.id,
    properties,
    propertyId,
    setPropertyId,
    setPropertySection,
  });

  useDefaultAssetSelection({
    gallery,
    selectedAssetId,
    setSelectedAssetId,
  });

  useDefaultVariantSelection({
    mediaVariants,
    selectedVariantId,
    setSelectedVariantId,
  });

  useRememberedEmail({
    storageKey: LAST_LOGIN_EMAIL_KEY,
    setRememberedEmail,
    setForm,
  });

  useKeyboardVisibility(setKeyboardVisible);

  useSyncAccountFormFromSession({
    session,
    setAccountForm,
  });

  useEffect(() => {
    const queryError =
      propertiesQuery.error ||
      dashboardQuery.error ||
      checklistQuery.error ||
      galleryQuery.error ||
      workflowQuery.error ||
      variantsQuery.error;

    if (queryError) {
      setError(queryError.message);
    }
  }, [
    checklistQuery.error,
    dashboardQuery.error,
    galleryQuery.error,
    propertiesQuery.error,
    workflowQuery.error,
    variantsQuery.error,
  ]);

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

  async function invalidatePropertyWorkspace(nextPropertyId = propertyId) {
    if (!nextPropertyId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard', nextPropertyId] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-checklist', nextPropertyId] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-gallery', nextPropertyId] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-workflow', nextPropertyId, viewerRole] }),
    ]);
  }

  async function invalidateAssetVariants(assetId = selectedAsset?.id) {
    if (!assetId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['mobile-media-variants', assetId] });
  }

  async function persistCapturedPhoto(asset = photoAsset) {
    if (!propertyId || !asset?.base64) {
      return;
    }

    setError('');

    try {
      const response = await savePhotoMutation.mutateAsync({
        roomLabel: form.roomLabel,
        source: asset.importSource || 'mobile_capture',
        mimeType: asset.mimeType || 'image/jpeg',
        imageBase64: asset.base64,
        width: asset.width,
        height: asset.height,
      });
      setPhotoAsset(null);
      if (response?.asset?.id) {
        setSelectedAssetId(response.asset.id);
      }
      setPropertySection('vision');
      setStatus('Photo saved. Starting the first-impression pass for this room.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const savePhotoMutation = useMutation({
    mutationFn: async (payload) => savePhoto(propertyId, payload),
    onSuccess: async () => {
      await invalidatePropertyWorkspace(propertyId);
    },
  });

  const updateMediaAssetMutation = useMutation({
    mutationFn: async ({ assetId, payload }) => updateMediaAsset(assetId, payload),
  });

  const updateChecklistStatusMutation = useMutation({
    mutationFn: async ({ itemId, nextStatus }) =>
      updateChecklistItem(itemId, {
        status: nextStatus,
      }),
    onSuccess: async () => {
      await invalidatePropertyWorkspace(propertyId);
    },
  });

  const createChecklistItemMutation = useMutation({
    mutationFn: async (payload) => createChecklistItem(propertyId, payload),
    onSuccess: async () => {
      await invalidatePropertyWorkspace(propertyId);
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async ({ assetId, jobType, mode, instructions }) =>
      createImageEnhancementJob(assetId, {
        jobType,
        mode,
        instructions,
        workflowStageKey: getVisionWorkflowStageKeyForJobType(jobType, mode),
      }),
  });

  const selectVariantMutation = useMutation({
    mutationFn: async ({ assetId, variantId }) => selectMediaVariant(assetId, variantId),
  });

  const saveVariantToPhotosMutation = useMutation({
    mutationFn: async ({ variantId, payload }) => saveVariantToPhotos(variantId, payload),
    onSuccess: async () => {
      await invalidatePropertyWorkspace(propertyId);
    },
  });

  const busy =
    busyState ||
    savePhotoMutation.isPending ||
    updateMediaAssetMutation.isPending ||
    updateChecklistStatusMutation.isPending ||
    createChecklistItemMutation.isPending ||
    createVariantMutation.isPending ||
    selectVariantMutation.isPending ||
    saveVariantToPhotosMutation.isPending;
  const refreshing =
    propertiesQuery.isFetching ||
    dashboardQuery.isFetching ||
    checklistQuery.isFetching ||
    galleryQuery.isFetching ||
    variantsQuery.isFetching;

  useEffect(() => {
    if (
      propertySection !== 'vision' ||
      !selectedAsset?.id ||
      selectedAsset.assetType === 'generated' ||
      selectedAsset.selectedVariant ||
      variantsQuery.isLoading ||
      mediaVariants.length ||
      selectedVariant ||
      createVariantMutation.isPending
    ) {
      return;
    }

    if (firstImpressionAutoStartedAssetIdsRef.current.has(selectedAsset.id)) {
      return;
    }

    firstImpressionAutoStartedAssetIdsRef.current.add(selectedAsset.id);
    void handleGenerateVariant('enhance_listing_quality');
  }, [
    createVariantMutation.isPending,
    handleGenerateVariant,
    mediaVariants.length,
    propertySection,
    selectedAsset,
    selectedVariant,
    variantsQuery.isLoading,
  ]);

  async function handleLogin() {
    setBusyState(true);
    setError('');

    try {
      const result = await login({
        email: form.email,
        password: form.password,
      });

      if (result.requiresOtpVerification) {
        setAuthMode('verify_email');
        setStatus('Your account needs OTP verification before the mobile workspace can load.');
        return;
      }

      setSession(result);
      await rememberEmail(form.email);
      await queryClient.invalidateQueries({ queryKey: ['mobile-properties', result.user.id] });
      setStatus('Signed in successfully. Loading your properties...');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  async function handleVerifyOtp() {
    setBusyState(true);
    setError('');

    try {
      const result = await verifyEmailOtp({
        email: form.email,
        otpCode: form.otpCode,
      });
      setSession(result);
      await rememberEmail(form.email);
      await queryClient.invalidateQueries({ queryKey: ['mobile-properties', result.user.id] });
      setStatus('Email verified. Loading your properties...');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  async function handleResendOtp() {
    setBusyState(true);
    setError('');

    try {
      await requestOtp({ email: form.email });
      setStatus('A fresh OTP was sent to your email.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  async function handleForgotPasswordSendCode() {
    const email = String(form.email || rememberedEmail || '').trim();
    if (!email) {
      setError('Enter your email address first so we know where to send the code.');
      return;
    }

    setBusyState(true);
    setError('');

    try {
      await requestForgotPasswordOtp({ email });
      await rememberEmail(email);
      updateField('email', email);
      setAuthMode('forgot_verify');
      setStatus('Check your email for a password reset code, then enter it below.');
    } catch (requestError) {
      setError(
        requestError.message ||
          "We couldn't send a code to that email. Please double-check it and try again.",
      );
    } finally {
      setBusyState(false);
    }
  }

  function handleSwitchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setError('');
    setStatus(
      nextMode === 'verify_email'
        ? 'Enter the email code we sent you to finish sign-in.'
        : nextMode === 'forgot_request'
          ? 'Enter your account email and we will send a password reset code.'
          : nextMode === 'forgot_verify'
            ? 'Enter the password reset code from your email.'
            : nextMode === 'forgot_reset'
              ? 'Choose a new password and confirm it to finish the reset.'
              : 'Sign in with the same verified seller account you use on the web.',
    );
  }

  async function handleVerifyForgotPasswordCode() {
    setBusyState(true);
    setError('');

    try {
      const result = await verifyForgotPasswordOtp({
        email: form.email,
        otpCode: form.otpCode,
      });
      updateField('resetToken', result.resetToken);
      updateField('otpCode', '');
      updateField('password', '');
      updateField('confirmPassword', '');
      setAuthMode('forgot_reset');
      setStatus('Set your new password now.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  async function handleResetForgottenPassword() {
    setBusyState(true);
    setError('');

    try {
      const result = await resetForgottenPassword({
        resetToken: form.resetToken,
        newPassword: form.password,
        confirmPassword: form.confirmPassword,
      });
      setSession(result);
      await rememberEmail(form.email);
      const currentUser = await getCurrentUser(result.token).catch(() => ({ user: result.user }));
      setSession({
        ...result,
        user: currentUser.user || result.user,
      });
      await queryClient.invalidateQueries({ queryKey: ['mobile-properties', result.user.id] });
      setStatus('Password updated. Loading your properties...');
      setAuthMode('login');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  function performSignOut() {
    queryClient.removeQueries({ queryKey: ['mobile-properties'] });
    queryClient.removeQueries({ queryKey: ['mobile-dashboard'] });
    queryClient.removeQueries({ queryKey: ['mobile-checklist'] });
    queryClient.removeQueries({ queryKey: ['mobile-gallery'] });
    queryClient.removeQueries({ queryKey: ['mobile-workflow'] });
    queryClient.removeQueries({ queryKey: ['mobile-media-variants'] });
    setSession(null);
    setAppScreen('home');
    setPropertyId('');
    setSelectedAssetId('');
    setSelectedVariantId('');
    setAuthMode('login');
    setShowPassword(false);
    setPropertySection('overview');
    setPhotoAsset(null);
    setListingNoteDraft('');
    setCustomTaskTitle('');
    setError('');
    setStatus('Signed out. Sign in again to continue.');
  }

  function handleSignOut() {
    Alert.alert('Log out?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: performSignOut,
      },
    ]);
  }

  function handleDeleteAccount() {
    if (!session?.token) {
      setError('Your session is missing account-delete authorization. Please sign in again.');
      return;
    }

    Alert.alert(
      'Delete account?',
      'This permanently removes your Workside account, properties, photos, reports, and saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Final confirmation',
              'Are you absolutely sure you want to permanently delete this account and all related data?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: async () => {
                    setBusyState(true);
                    setError('');

                    try {
                      await deleteAccount(session.token);
                      performSignOut();
                      setStatus('Your account has been deleted.');
                    } catch (requestError) {
                      setError(requestError.message);
                    } finally {
                      setBusyState(false);
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  }

  async function handleSelectProperty(nextPropertyId) {
    setError('');

    try {
      setPropertyId(nextPropertyId);
      setPropertySection('overview');
      setAppScreen('property');
      const nextProperty = properties.find((property) => property.id === nextPropertyId);
      setStatus(nextProperty ? `Loaded ${nextProperty.title}.` : 'Property loaded.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handlePickImage(mode) {
    if (!propertyId) {
      setError('Select a property before capturing photos.');
      return;
    }

    setBusyState(true);
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

      const capturedAsset = {
        ...result.assets[0],
        importSource: mode === 'camera' ? 'mobile_capture' : 'mobile_library',
      };
      setPhotoAsset(capturedAsset);
      setStatus('Photo ready. Save it to the property when you are ready.');

      Alert.alert(
        mode === 'camera' ? 'Save this photo?' : 'Use this photo?',
        `Add this ${form.roomLabel.toLowerCase()} photo to the selected property?`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setPhotoAsset(null);
              setStatus('Photo discarded.');
            },
          },
          {
            text: 'Keep reviewing',
            style: 'cancel',
          },
          {
            text: 'Save',
            onPress: () => {
              persistCapturedPhoto(capturedAsset);
            },
          },
        ],
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  async function handleSavePhoto() {
    await persistCapturedPhoto(photoAsset);
  }

  async function handleToggleListingCandidate() {
    if (!selectedAsset) {
      return;
    }

    setError('');

    try {
      const nextValue = !selectedAsset.listingCandidate;
      await updateMediaAssetMutation.mutateAsync({
        assetId: selectedAsset.id,
        payload: {
          listingCandidate: nextValue,
        },
      });
      await invalidatePropertyWorkspace(propertyId);
      setStatus(
        nextValue
          ? 'Photo marked as a listing candidate.'
          : 'Photo removed from the listing-candidate set.',
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaveListingNote() {
    if (!selectedAsset) {
      return;
    }

    setError('');

    try {
      await updateMediaAssetMutation.mutateAsync({
        assetId: selectedAsset.id,
        payload: {
          listingNote: listingNoteDraft,
        },
      });
      await invalidatePropertyWorkspace(propertyId);
      setStatus('Listing note saved to this photo.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleUpdateChecklistStatus(itemId, nextStatus) {
    setError('');

    try {
      await updateChecklistStatusMutation.mutateAsync({
        itemId,
        nextStatus,
      });
      setStatus('Checklist progress saved.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleCreateCustomTask() {
    if (!propertyId || !customTaskTitle.trim()) {
      setError('Add a task title before saving a custom checklist item.');
      return;
    }

    setError('');

    try {
      await createChecklistItemMutation.mutateAsync({
        title: customTaskTitle,
        category: 'custom',
        priority: 'medium',
      });
      setCustomTaskTitle('');
      setStatus('Custom checklist task added.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleGenerateVariant(jobType) {
    if (!selectedAsset) {
      return;
    }

    setError('');
    setPendingVisionJobType(jobType);
    setStatus(
      jobType === 'declutter_preview' || jobType === 'declutter_light' || jobType === 'declutter_medium'
        ? 'Running Smart Enhancement cleanup for this photo. This can take a moment.'
        : jobType === 'lighting_boost'
          ? 'Running Smart Enhancement lighting recovery for this photo. This can take a moment.'
          : jobType === 'combined_listing_refresh'
            ? 'Running the stricter Listing Ready pass for this photo. This can take a moment.'
            : 'Running the First Impression pass for this photo. This can take a moment.',
    );

    try {
      const response = await createVariantMutation.mutateAsync({
        assetId: selectedAsset.id,
        jobType,
      });
      await Promise.all([
        invalidatePropertyWorkspace(propertyId),
        invalidateAssetVariants(selectedAsset.id),
      ]);
      setSelectedVariantId(response.variant?.id || '');
      setStatus(
        response.job?.input?.orchestrationDeliveryMode === 'safe_marketplace_fallback'
          ? response.job?.warning || response.job?.message || 'A safe fallback preview was returned.'
          : response.variant?.metadata?.smartEnhancementReason ||
          response.job?.input?.smartEnhancementReason ||
          response.job?.warning ||
          (jobType === 'declutter_preview' || jobType === 'declutter_light' || jobType === 'declutter_medium'
            ? 'Smart Enhancement cleanup ready.'
            : jobType === 'lighting_boost'
              ? 'Lighting recovery ready.'
            : jobType === 'combined_listing_refresh'
              ? 'Listing Ready pass generated.'
            : 'First Impression pass generated.'),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingVisionJobType('');
    }
  }

  async function handleGenerateFreeformVariant() {
    if (!selectedAsset || !freeformEnhancementInstructions.trim()) {
      setError('Describe the enhancement you want before generating a custom preview.');
      return;
    }

    setError('');
    setPendingVisionJobType('freeform');
    setStatus('Creating a Smart Enhancement custom preview. This can take a moment.');

    try {
      const response = await createVariantMutation.mutateAsync({
        assetId: selectedAsset.id,
        mode: 'freeform',
        instructions: freeformEnhancementInstructions.trim(),
      });
      await Promise.all([
        invalidatePropertyWorkspace(propertyId),
        invalidateAssetVariants(selectedAsset.id),
      ]);
      setSelectedVariantId(response.variant?.id || '');
      setStatus(
        response.job?.input?.orchestrationDeliveryMode === 'safe_marketplace_fallback'
          ? response.job?.warning || response.job?.message || 'A safe fallback preview was returned.'
          : response.job?.warning || 'Custom Smart Enhancement preview generated.',
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingVisionJobType('');
    }
  }

  async function handleSelectVariant(variantId) {
    if (!selectedAsset) {
      return;
    }

    setError('');

    try {
      await selectVariantMutation.mutateAsync({
        assetId: selectedAsset.id,
        variantId,
      });
      await Promise.all([
        invalidatePropertyWorkspace(propertyId),
        invalidateAssetVariants(selectedAsset.id),
      ]);
      setSelectedVariantId(variantId);
      setStatus('Preferred variant selected for future flyer and report output.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaveCurrentVariantToPhotos() {
    if (!selectedAsset || !selectedVariant) {
      return;
    }

    setError('');

    try {
      const response = await saveVariantToPhotosMutation.mutateAsync({
        variantId: selectedVariant.id,
        payload: {
          propertyId,
          roomLabel: selectedAsset.roomLabel,
          generationStage: currentVisionSaveDefaults.generationStage,
          generationLabel: selectedVariant.label,
          listingCandidate: currentVisionSaveDefaults.listingCandidate,
        },
      });
      await Promise.all([
        invalidatePropertyWorkspace(propertyId),
        invalidateAssetVariants(selectedAsset.id),
      ]);
      setStatus(
        response.created === false
          ? currentVisionSaveDefaults.listingCandidate
            ? 'This result was already saved in Photos and is marked as a listing candidate.'
            : 'This result was already saved in Photos as a review draft.'
          : currentVisionSaveDefaults.listingCandidate
            ? 'This result has been saved to Photos, marked as a listing candidate, and is ready for brochure/report workflows.'
            : `This result has been saved to Photos as a review draft${currentVisionSaveDefaults.qualityLabel ? ` (${currentVisionSaveDefaults.qualityLabel})` : ''}.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaveAccountSettings() {
    if (!session?.token) {
      setError('Sign in again before updating your account settings.');
      return;
    }

    setBusyState(true);
    setError('');

    try {
      const response = await updateUserProfile({
        firstName: accountForm.firstName,
        lastName: accountForm.lastName,
        mobilePhone: accountForm.mobilePhone,
        smsOptIn: accountForm.smsOptIn,
      }, session.token);
      const nextSession = {
        ...session,
        user: {
          ...session.user,
          ...response.user,
        },
      };
      setSession(nextSession);
      setStatus('Account settings updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyState(false);
    }
  }

  const propertyAddress = selectedProperty
    ? [
        selectedProperty.addressLine1,
        [selectedProperty.city, selectedProperty.state, selectedProperty.zip].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const screenTitle =
    appScreen === 'settings'
      ? 'Settings'
      : appScreen === 'property'
        ? 'Property'
        : 'Home Advisor';

  const headerSubtitle =
    appScreen === 'settings'
      ? 'Manage account, support, and legal settings.'
      : appScreen === 'property'
        ? propertyAddress
        : 'Stay Connected Across Every Property';

  function renderPropertyWorkspaceContent() {
    return (
      <RootScreenPropertyWorkspaceContent
        workflow={workflow}
        viewerRole={viewerRole}
        propertySection={propertySection}
        setPropertySection={setPropertySection}
        recommendedSection={recommendedSection}
        dashboard={dashboard}
        capturedRoomCount={capturedRoomCount}
        gallery={gallery}
        mediaVariants={mediaVariants}
        checklistItems={checklistItems}
        openChecklistItems={openChecklistItems}
        pricingHighlights={pricingHighlights}
        nextMissingRoom={nextMissingRoom}
        roomCoverage={roomCoverage}
        form={form}
        updateField={updateField}
        handlePickImage={handlePickImage}
        photoAsset={photoAsset}
        handleSavePhoto={handleSavePhoto}
        busy={busy}
        selectedAsset={selectedAsset}
        setSelectedAssetId={setSelectedAssetId}
        handleToggleListingCandidate={handleToggleListingCandidate}
        listingNoteDraft={listingNoteDraft}
        setListingNoteDraft={setListingNoteDraft}
        handleSaveListingNote={handleSaveListingNote}
        showVisionDetails={showVisionDetails}
        setShowVisionDetails={setShowVisionDetails}
        createVariantMutationIsPending={createVariantMutation.isPending}
        pendingVisionJobType={pendingVisionJobType}
        visionActionRecommendation={visionActionRecommendation}
        recommendedVisionAction={recommendedVisionAction}
        recommendedDeclutterPresetKey={recommendedDeclutterPresetKey}
        isDeclutterRecommended={isDeclutterRecommended}
        isLightingRecommended={isLightingRecommended}
        handleGenerateVariant={handleGenerateVariant}
        freeformEnhancementInstructions={freeformEnhancementInstructions}
        setFreeformEnhancementInstructions={setFreeformEnhancementInstructions}
        handleGenerateFreeformVariant={handleGenerateFreeformVariant}
        selectedVariant={selectedVariant}
        visibleVisionEffects={visibleVisionEffects}
        hiddenVisionEffectCount={hiddenVisionEffectCount}
        currentVisionPipelinePackage={currentVisionPipelinePackage}
        savedAssetForSelectedVariant={savedAssetForSelectedVariant}
        currentVisionSaveDefaults={currentVisionSaveDefaults}
        setSelectedVariantId={setSelectedVariantId}
        handleSaveCurrentVariantToPhotos={handleSaveCurrentVariantToPhotos}
        handleSelectVariant={handleSelectVariant}
        bestCandidates={bestCandidates}
        checklist={checklist}
        completedChecklistItems={completedChecklistItems}
        showCompletedTasks={showCompletedTasks}
        setShowCompletedTasks={setShowCompletedTasks}
        handleUpdateChecklistStatus={handleUpdateChecklistStatus}
        customTaskTitle={customTaskTitle}
        setCustomTaskTitle={setCustomTaskTitle}
        handleCreateCustomTask={handleCreateCustomTask}
      />
    );
  }

  if (session?.user) {
    return (
      <RootScreenAuthenticatedView
        session={session}
        appScreen={appScreen}
        setAppScreen={setAppScreen}
        screenTitle={screenTitle}
        headerSubtitle={headerSubtitle}
        properties={properties}
        propertiesQueryIsLoading={propertiesQuery.isLoading}
        handleSelectProperty={handleSelectProperty}
        handleSignOut={handleSignOut}
        selectedProperty={selectedProperty}
        workflow={workflow}
        propertyWorkspaceContent={renderPropertyWorkspaceContent()}
        accountForm={accountForm}
        setAccountForm={setAccountForm}
        viewerRole={viewerRole}
        handleSaveAccountSettings={handleSaveAccountSettings}
        handleDeleteAccount={handleDeleteAccount}
        busy={busy}
        error={error}
        refreshing={refreshing}
        supportUrl={SUPPORT_URL}
        privacyUrl={PRIVACY_URL}
        termsUrl={TERMS_URL}
        openExternalLink={openExternalLink}
      />
    );
  }

  return (
    <RootScreenAuthView
      keyboardVisible={keyboardVisible}
      authMode={authMode}
      form={form}
      updateField={updateField}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      busy={busy}
      refreshing={refreshing}
      handleLogin={handleLogin}
      handleVerifyOtp={handleVerifyOtp}
      handleForgotPasswordSendCode={handleForgotPasswordSendCode}
      handleVerifyForgotPasswordCode={handleVerifyForgotPasswordCode}
      handleResetForgottenPassword={handleResetForgottenPassword}
      handleSwitchAuthMode={handleSwitchAuthMode}
      handleResendOtp={handleResendOtp}
      status={status}
      error={error}
      openExternalLink={openExternalLink}
      termsUrl={TERMS_URL}
      privacyUrl={PRIVACY_URL}
      supportUrl={SUPPORT_URL}
    />
  );
}

