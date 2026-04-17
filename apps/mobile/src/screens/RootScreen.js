import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
  selectMediaVariant,
  updateUserProfile,
  updateChecklistItem,
  updateMediaAsset,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
} from '../services/api';

const ROOM_LABEL_OPTIONS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const LAST_LOGIN_EMAIL_KEY = 'workside.lastLoginEmail';
const WEB_BASE_URL = 'https://worksideadvisor.com';
const TERMS_URL = `${WEB_BASE_URL}/terms`;
const PRIVACY_URL = `${WEB_BASE_URL}/privacy`;
const SUPPORT_URL = 'mailto:support@worksideadvisor.com';

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Signed-in user';
}

function truncateMiddle(value, maxLength = 28) {
  if (!value || value.length <= maxLength) {
    return value || '';
  }

  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
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

function formatPhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);

  if (!digits) {
    return '';
  }

  if (digits.length < 4) {
    return `(${digits}`;
  }

  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This variant can be marked preferred for flyer and report selection.'
  );
}

function formatWorkflowStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }
  if (status === 'complete') {
    return 'Complete';
  }
  if (status === 'blocked') {
    return 'Blocked';
  }
  if (status === 'locked') {
    return 'Locked';
  }
  return 'Available';
}

function getVisionJobLabel(jobType) {
  if (jobType === 'declutter_preview' || jobType === 'declutter_light' || jobType === 'declutter_medium') {
    return 'Decluttering photo';
  }
  if (jobType === 'combined_listing_refresh') {
    return 'Preparing listing-ready photo';
  }
  if (jobType === 'enhance_listing_quality') {
    return 'Preparing first-impression enhancement';
  }

  return 'Enhancing photo';
}

function getNextChecklistStatus(currentStatus) {
  if (currentStatus === 'todo') {
    return 'in_progress';
  }

  if (currentStatus === 'in_progress') {
    return 'done';
  }

  return 'todo';
}

function summarizePricing(pricingSummary) {
  if (!pricingSummary) {
    return [];
  }

  return String(pricingSummary)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getVisionActionLabel(jobType) {
  if (jobType === 'enhance_listing_quality') {
    return 'Enhance';
  }
  if (jobType === 'combined_listing_refresh') {
    return 'Listing ready';
  }
  if (jobType === 'declutter_medium') {
    return 'Declutter+';
  }
  if (jobType === 'declutter_light' || jobType === 'declutter_preview') {
    return 'Declutter';
  }

  return 'Enhance';
}

function getVisionActionRecommendation(asset, selectedVariant = null) {
  const metadata = selectedVariant?.metadata || asset?.selectedVariant?.metadata || {};
  const recommendedNextStep =
    metadata?.recommendedNextStep && typeof metadata.recommendedNextStep === 'object'
      ? metadata.recommendedNextStep
      : null;
  const requestedPresetKey =
    metadata?.requestedPresetKey ||
    '';
  const executionPresetKey =
    metadata?.executionPresetKey ||
    metadata?.presetKey ||
    '';
  const pipelineStage =
    metadata?.pipelineStage || '';
  const smartPlan = metadata?.smartEnhancementPlan || [];
  const sceneAnalysis = metadata?.sceneAnalysis || {};
  const clutterLevel = Number(
    sceneAnalysis?.clutterLevel || sceneAnalysis?.clutterScore || asset?.analysis?.clutterScore || 0,
  );
  const listingReadyLabel =
    metadata?.listingReadyLabel ||
    '';
  const fallbackApplied = Boolean(metadata?.fallbackApplied);
  const summary = String(asset?.analysis?.summary || '').toLowerCase();
  const hasDeclutterSignal =
    smartPlan.includes('declutter') ||
    asset?.analysis?.retakeRecommended ||
    clutterLevel > 0.5 ||
    /clutter|declutter|distraction|tidy|retake|busy|remove/i.test(summary);
  const declutterPresetKey = clutterLevel >= 0.68 ? 'declutter_medium' : 'declutter_light';

  if (recommendedNextStep?.type === 'save_result') {
    return {
      presetKey: '',
      label: recommendedNextStep.label || 'Save this result',
      reason:
        recommendedNextStep.reason || 'This preview is already reading as listing-ready.',
    };
  }

  if (recommendedNextStep?.presetKey) {
    return {
      presetKey: recommendedNextStep.presetKey,
      label:
        recommendedNextStep.label || getVisionActionLabel(recommendedNextStep.presetKey),
      reason:
        recommendedNextStep.reason ||
        'This is the strongest next step based on the current result.',
    };
  }

  if (listingReadyLabel === 'Listing Ready') {
    return {
      presetKey: '',
      label: 'Save this result',
      reason: 'This preview is already reading as listing-ready.',
    };
  }

  if (!selectedVariant && !asset?.selectedVariant) {
    return {
      presetKey: 'enhance_listing_quality',
      label: getVisionActionLabel('enhance_listing_quality'),
      reason: 'Start with the fast first-impression pass before heavier cleanup or listing polish.',
    };
  }

  if (hasDeclutterSignal) {
    return {
      presetKey: declutterPresetKey,
      label: getVisionActionLabel(declutterPresetKey),
      reason:
        requestedPresetKey === 'combined_listing_refresh' && fallbackApplied
          ? 'The listing-ready pass fell back safely, so the room likely needs a stronger cleanup step first.'
          : 'Cleaning distractions next should create a stronger base for listing-ready polish.',
    };
  }

  if (
    requestedPresetKey === 'combined_listing_refresh' &&
    (executionPresetKey === 'declutter_light' || executionPresetKey === 'declutter_medium')
  ) {
    return {
      presetKey: 'combined_listing_refresh',
      label: getVisionActionLabel('combined_listing_refresh'),
      reason: 'The cleanup path has run, so the next step is the stricter listing-ready pass.',
    };
  }

  if (pipelineStage === 'first_impression' || pipelineStage === 'smart_enhancement') {
    return {
      presetKey: 'combined_listing_refresh',
      label: getVisionActionLabel('combined_listing_refresh'),
      reason: 'The room now has a stable enough baseline for the listing-ready pass.',
    };
  }

  return {
    presetKey: 'enhance_listing_quality',
    label: getVisionActionLabel('enhance_listing_quality'),
    reason: 'Use the fast enhancement pass to re-establish a strong first impression first.',
  };
}

function getRecommendedSection(nextStepKey) {
  switch (nextStepKey) {
    case 'capture_photos':
    case 'capture_core_listing_rooms':
      return 'capture';
    case 'review_listing_photos':
    case 'choose_listing_candidate_photos':
      return 'gallery';
    case 'improve_listing_photos':
    case 'select_preferred_vision_variant':
      return 'vision';
    case 'complete_checklist':
    case 'prepare_home':
    case 'provider_help':
      return 'tasks';
    case 'review_pricing':
    default:
      return 'overview';
  }
}

export function RootScreen() {
  const queryClient = useQueryClient();
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
  const visibleVisionEffects = (selectedVariant?.metadata?.effects || []).slice(0, 2);
  const hiddenVisionEffectCount = Math.max((selectedVariant?.metadata?.effects || []).length - 2, 0);
  const openChecklistItems = checklistItems.filter((task) => task.status !== 'done');
  const completedChecklistItems = checklistItems.filter((task) => task.status === 'done');

  useEffect(() => {
    setListingNoteDraft(selectedAsset?.listingNote || '');
  }, [selectedAsset?.id, selectedAsset?.listingNote]);

  useEffect(() => {
    if (!session?.user?.id) {
      setPropertyId('');
      return;
    }

    if (!properties.length) {
      setPropertyId('');
      return;
    }

    if (properties.some((property) => property.id === propertyId)) {
      return;
    }

    setPropertyId(properties[0]?.id || '');
    setPropertySection('overview');
  }, [session?.user?.id, properties, propertyId]);

  useEffect(() => {
    if (!gallery.length) {
      setSelectedAssetId('');
      return;
    }

    if (gallery.some((asset) => asset.id === selectedAssetId)) {
      return;
    }

    setSelectedAssetId(gallery[0]?.id || '');
  }, [gallery, selectedAssetId]);

  useEffect(() => {
    if (!mediaVariants.length) {
      setSelectedVariantId('');
      return;
    }

    if (mediaVariants.some((variant) => variant.id === selectedVariantId)) {
      return;
    }

    setSelectedVariantId(
      mediaVariants.find((variant) => variant.isSelected)?.id || mediaVariants[0]?.id || '',
    );
  }, [mediaVariants, selectedVariantId]);

  useEffect(() => {
    let active = true;

    async function loadRememberedEmail() {
      try {
        const storedEmail = await AsyncStorage.getItem(LAST_LOGIN_EMAIL_KEY);
        if (active && storedEmail) {
          setRememberedEmail(storedEmail);
          setForm((current) =>
            current.email
              ? current
              : {
                  ...current,
                  email: storedEmail,
                },
          );
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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    setAccountForm({
      firstName: session?.user?.firstName || '',
      lastName: session?.user?.lastName || '',
      mobilePhone: formatPhoneInput(session?.user?.mobilePhone || ''),
      smsOptIn: Boolean(session?.user?.smsOptIn),
    });
  }, [session?.user?.firstName, session?.user?.lastName, session?.user?.mobilePhone, session?.user?.smsOptIn]);

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
      await savePhotoMutation.mutateAsync({
        roomLabel: form.roomLabel,
        source: asset.importSource || 'mobile_capture',
        mimeType: asset.mimeType || 'image/jpeg',
        imageBase64: asset.base64,
        width: asset.width,
        height: asset.height,
      });
      setPhotoAsset(null);
      setPropertySection('gallery');
      setStatus('Photo saved to the selected property.');
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
      }),
  });

  const selectVariantMutation = useMutation({
    mutationFn: async ({ assetId, variantId }) => selectMediaVariant(assetId, variantId),
  });

  const busy =
    busyState ||
    savePhotoMutation.isPending ||
    updateMediaAssetMutation.isPending ||
    updateChecklistStatusMutation.isPending ||
    createChecklistItemMutation.isPending ||
    createVariantMutation.isPending ||
    selectVariantMutation.isPending;
  const refreshing =
    propertiesQuery.isFetching ||
    dashboardQuery.isFetching ||
    checklistQuery.isFetching ||
    galleryQuery.isFetching ||
    variantsQuery.isFetching;

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
        ? 'Creating a declutter preview. This can take a moment.'
        : jobType === 'combined_listing_refresh'
          ? 'Creating a listing-ready preview. This can take a moment.'
        : 'Enhancing the selected photo. This can take a moment.',
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
            ? 'Declutter preview generated.'
            : jobType === 'combined_listing_refresh'
              ? 'Listing-ready path generated.'
            : 'Enhanced listing version generated.'),
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
    setStatus('Creating a custom enhancement preview. This can take a moment.');

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
          : response.job?.warning || 'Custom enhancement preview generated.',
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
      <>
        {workflow ? (
          <View style={styles.workflowGuideCard}>
            <Text style={styles.label}>Your progress</Text>
            <Text style={styles.taskSummaryValue}>{workflow.completionPercent}% complete</Text>
            <Text style={styles.taskSummaryText}>
              {workflow.currentPhaseLabel} · {viewerRole === 'agent' ? 'Realtor guide' : 'Seller guide'}
            </Text>
            <Text style={styles.taskSummaryText}>
              Market-ready {workflow.marketReadyScore}/100
            </Text>
            {workflow.nextStep ? (
              <View style={styles.workflowNextCard}>
                <Text style={styles.workflowNextLabel}>Next step</Text>
                <Text style={styles.taskTitle}>{workflow.nextStep.title}</Text>
                <Text style={styles.taskDetail}>{workflow.nextStep.description}</Text>
                {workflow.nextStep.helperText ? (
                  <Text style={styles.workflowHelperText}>{workflow.nextStep.helperText}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.workflowPhaseRow}>
              {(workflow.phases || []).map((phase) => (
                <View
                  key={phase.key}
                  style={[
                    styles.workflowPhaseChip,
                    phase.status === 'complete'
                      ? styles.workflowPhaseChipComplete
                      : phase.status === 'in_progress'
                        ? styles.workflowPhaseChipActive
                        : null,
                  ]}
                >
                  <Text style={styles.workflowPhaseChipLabel}>{phase.label}</Text>
                  <Text style={styles.workflowPhaseChipMeta}>
                    {phase.completedSteps}/{phase.totalSteps}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
                value !== propertySection && value === recommendedSection ? styles.sectionChipRecommended : null,
                value !== propertySection &&
                ((value === 'overview' && Boolean(dashboard?.pricing)) ||
                  (value === 'capture' && capturedRoomCount >= ROOM_LABEL_OPTIONS.length) ||
                  (value === 'gallery' && gallery.length > 0) ||
                  (value === 'vision' &&
                    (mediaVariants.some((variant) => variant.isSelected) ||
                      gallery.some((asset) => Boolean(asset.selectedVariant)))) ||
                  (value === 'tasks' && checklistItems.length > 0 && openChecklistItems.length === 0))
                  ? styles.sectionChipComplete
                  : null,
                value === propertySection ? styles.sectionChipActive : null,
              ]}
            >
              <Text
                style={
                  propertySection === value
                    ? styles.sectionChipLabelActive
                    : value === recommendedSection
                      ? styles.sectionChipLabelRecommended
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
                <View style={styles.summaryBulletList}>
                  <Text style={styles.summaryBullet}>
                    Midpoint {formatCurrency(dashboard.pricing.mid)} with{' '}
                    {Math.round((dashboard.pricing.confidence || 0) * 100)}% confidence.
                  </Text>
                  <Text style={styles.summaryBullet}>
                    Chosen price stays aligned with your marketing brochure and seller report.
                  </Text>
                </View>
              </View>
            ) : null}

            {pricingHighlights.length ? (
              <View style={styles.overviewInsightCard}>
                <Text style={styles.label}>Latest analysis</Text>
                {pricingHighlights.map((highlight) => (
                  <Text key={highlight} style={styles.summaryBullet}>
                    {`\u2022 ${highlight}`}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {propertySection === 'capture' ? (
          <View style={styles.captureCard}>
            <Text style={styles.label}>Photo capture</Text>
            <Text style={styles.body}>
              {workflow?.nextStep?.key === 'capture_photos'
                ? workflow.nextStep.description
                : 'Capture or select the next room photo and save it to this property.'}
            </Text>
            <View style={styles.taskSummaryCard}>
              <Text style={styles.taskSummaryText}>
                {capturedRoomCount} of {ROOM_LABEL_OPTIONS.length} core rooms complete
              </Text>
              <Text style={styles.taskSummaryText}>
                Next focus: {nextMissingRoom}. {workflow?.nextStep?.helperText || 'Stand in the corner. Keep the camera level.'}
              </Text>
            </View>

            <View style={styles.roomChipRow}>
              {ROOM_LABEL_OPTIONS.map((room) => (
                <Pressable
                  key={room}
                  onPress={() => updateField('roomLabel', room)}
                  style={[
                    styles.roomChip,
                    room === nextMissingRoom && !roomCoverage.find((item) => item.roomLabel === room)?.captured
                      ? styles.roomChipRecommended
                      : null,
                    roomCoverage.find((item) => item.roomLabel === room)?.captured
                      ? styles.roomChipDone
                      : null,
                    form.roomLabel === room ? styles.roomChipActive : null,
                  ]}
                >
                  <Text
                    style={
                      form.roomLabel === room
                        ? styles.roomChipLabelActive
                        : roomCoverage.find((item) => item.roomLabel === room)?.captured
                          ? styles.roomChipLabelDone
                          : styles.roomChipLabel
                    }
                  >
                    {room}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => handlePickImage('camera')}
                style={[styles.button, styles.buttonPrimary, styles.flexButton]}
              >
                <Text style={styles.buttonText}>Use camera</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickImage('library')}
                style={[styles.button, styles.buttonSecondary, styles.flexButton]}
              >
                <Text style={styles.buttonSecondaryText}>Choose from library</Text>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRail}>
                  {gallery.map((asset) => (
                    <Pressable
                      key={asset.id}
                      onPress={() => setSelectedAssetId(asset.id)}
                      style={[styles.galleryTile, asset.id === selectedAsset?.id ? styles.galleryTileActive : null]}
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
                    <Pressable onPress={handleSaveListingNote} style={[styles.button, styles.buttonSecondary]} disabled={busy}>
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
            <Text style={styles.body}>Generate the best listing-ready version of a saved photo.</Text>
            <Pressable onPress={() => setShowVisionDetails((current) => !current)} style={styles.learnMoreButton}>
              <Text style={styles.learnMoreButtonText}>{showVisionDetails ? 'Hide details' : 'Learn more'}</Text>
            </Pressable>
            {showVisionDetails ? (
              <Text style={styles.body}>
                Enhance improves presentation while keeping the room believable. Declutter is best when the room feels busy or distracting.
              </Text>
            ) : null}
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
                {createVariantMutation.isPending ? (
                  <View style={styles.visionJobCard}>
                    <View style={styles.visionJobHeader}>
                      <ActivityIndicator color="#d28859" />
                      <Text style={styles.visionJobTitle}>{getVisionJobLabel(pendingVisionJobType)}</Text>
                    </View>
                    <Text style={styles.variantHint}>
                      Workside is processing this image now. Your updated version will appear below automatically.
                    </Text>
                  </View>
                ) : null}
                {visionActionRecommendation?.reason ? (
                  <View style={styles.summaryBulletList}>
                    <Text style={styles.label}>Recommended next step</Text>
                    <Text style={styles.summaryBullet}>
                      • {visionActionRecommendation.label}
                    </Text>
                    <Text style={styles.summaryBullet}>
                      • {visionActionRecommendation.reason}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.actionRow, styles.visionActionRow]}>
                  <Pressable
                    onPress={() => handleGenerateVariant('enhance_listing_quality')}
                    style={[
                      styles.button,
                      recommendedVisionAction === 'enhance_listing_quality' ? styles.buttonPrimary : styles.buttonSecondary,
                      styles.flexButton,
                      styles.visionActionButton,
                    ]}
                    disabled={busy}
                  >
                    <Text
                      style={[
                        recommendedVisionAction === 'enhance_listing_quality' ? styles.buttonText : styles.buttonSecondaryText,
                        styles.visionActionButtonText,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {pendingVisionJobType === 'enhance_listing_quality' && createVariantMutation.isPending
                        ? 'Enhancing...'
                        : 'Enhance'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleGenerateVariant('combined_listing_refresh')}
                    style={[
                      styles.button,
                      recommendedVisionAction === 'combined_listing_refresh' ? styles.buttonPrimary : styles.buttonSecondary,
                      styles.flexButton,
                      styles.visionActionButton,
                    ]}
                    disabled={busy}
                  >
                    <Text
                      style={[
                        recommendedVisionAction === 'combined_listing_refresh' ? styles.buttonText : styles.buttonSecondaryText,
                        styles.visionActionButtonText,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {pendingVisionJobType === 'combined_listing_refresh' && createVariantMutation.isPending
                        ? 'Refreshing...'
                        : 'Listing ready'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleGenerateVariant(recommendedDeclutterPresetKey)}
                    style={[
                      styles.button,
                      isDeclutterRecommended ? styles.buttonPrimary : styles.buttonSecondary,
                      styles.flexButton,
                      styles.visionActionButton,
                    ]}
                    disabled={busy}
                  >
                    <Text
                      style={[
                        isDeclutterRecommended ? styles.buttonText : styles.buttonSecondaryText,
                        styles.visionActionButtonText,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {(pendingVisionJobType === 'declutter_light' ||
                        pendingVisionJobType === 'declutter_medium' ||
                        pendingVisionJobType === 'declutter_preview') &&
                      createVariantMutation.isPending
                        ? 'Decluttering...'
                        : recommendedDeclutterPresetKey === 'declutter_medium'
                          ? 'Declutter+'
                          : 'Declutter'}
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  placeholder="Describe a custom enhancement request"
                  placeholderTextColor="#7d8a8f"
                  style={[styles.input, styles.noteInput]}
                  value={freeformEnhancementInstructions}
                  onChangeText={setFreeformEnhancementInstructions}
                  multiline
                />
                <Pressable
                  onPress={handleGenerateFreeformVariant}
                  style={[styles.button, styles.buttonSecondary]}
                  disabled={busy || !freeformEnhancementInstructions.trim()}
                >
                  <Text style={styles.buttonSecondaryText}>
                    {pendingVisionJobType === 'freeform' && createVariantMutation.isPending
                      ? 'Generating custom preview...'
                      : 'Generate custom preview'}
                  </Text>
                </Pressable>
                {selectedVariant ? (
                  <>
                    <Text style={styles.label}>Vision output</Text>
                    <Text style={styles.variantSummary}>{getVariantSummary(selectedVariant)}</Text>
                    <Image source={{ uri: selectedVariant.imageUrl }} style={styles.visionImage} />
                    {visibleVisionEffects.length ? (
                      <View style={styles.effectList}>
                        {visibleVisionEffects.map((effect) => (
                          <View key={effect} style={styles.effectChip}>
                            <Text style={styles.effectChipText}>{effect}</Text>
                          </View>
                        ))}
                        {hiddenVisionEffectCount ? (
                          <View style={styles.effectChip}>
                            <Text style={styles.effectChipText}>+{hiddenVisionEffectCount} more</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.differenceHint ? (
                      <Text style={styles.variantHint}>{selectedVariant.metadata.differenceHint}</Text>
                    ) : null}
                    {selectedVariant.metadata?.smartEnhancementPathLabel || selectedVariant.metadata?.smartEnhancementReason ? (
                      <View style={styles.summaryBulletList}>
                        <Text style={styles.label}>Execution path</Text>
                        {selectedVariant.metadata?.smartEnhancementPathLabel ? (
                          <Text style={styles.summaryBullet}>• {selectedVariant.metadata.smartEnhancementPathLabel}</Text>
                        ) : null}
                        {selectedVariant.metadata?.smartEnhancementReason ? (
                          <Text style={styles.summaryBullet}>• {selectedVariant.metadata.smartEnhancementReason}</Text>
                        ) : null}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.confidenceBadge || selectedVariant.metadata?.listingReadyLabel ? (
                      <View style={styles.effectList}>
                        {selectedVariant.metadata?.confidenceBadge ? (
                          <View style={styles.effectChip}>
                            <Text style={styles.effectChipText}>{selectedVariant.metadata.confidenceBadge}</Text>
                          </View>
                        ) : null}
                        {selectedVariant.metadata?.listingReadyLabel ? (
                          <View style={styles.effectChip}>
                            <Text style={styles.effectChipText}>{selectedVariant.metadata.listingReadyLabel}</Text>
                          </View>
                        ) : null}
                        {selectedVariant.metadata?.sourceReadinessScore && selectedVariant.metadata?.renderedReadinessScore ? (
                          <View style={styles.effectChip}>
                            <Text style={styles.effectChipText}>
                              {`Readiness ${selectedVariant.metadata.sourceReadinessScore}->${selectedVariant.metadata.renderedReadinessScore}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.pipelineDescriptor ? (
                      <View style={styles.summaryBulletList}>
                        <Text style={styles.label}>Marketplace status</Text>
                        <Text style={styles.summaryBullet}>
                          • {selectedVariant.metadata.pipelineDescriptor.stageLabel || 'Vision result'} ·{' '}
                          {selectedVariant.metadata.pipelineDescriptor.statusLabel || 'Review pending'}
                        </Text>
                        {selectedVariant.metadata.pipelineDescriptor.reviewMessage ? (
                          <Text style={styles.summaryBullet}>
                            • {selectedVariant.metadata.pipelineDescriptor.reviewMessage}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.improvementsApplied?.length ? (
                      <View style={styles.summaryBulletList}>
                        <Text style={styles.label}>Improvements applied</Text>
                        {selectedVariant.metadata.improvementsApplied.map((item) => (
                          <Text key={item} style={styles.summaryBullet}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.recommendations?.length ? (
                      <View style={styles.summaryBulletList}>
                        <Text style={styles.label}>Top improvements</Text>
                        {selectedVariant.metadata.recommendations.map((item) => (
                          <Text key={item} style={styles.summaryBullet}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.nextActions?.length ? (
                      <View style={styles.summaryBulletList}>
                        <Text style={styles.label}>Next actions</Text>
                        {selectedVariant.metadata.nextActions.map((item) => (
                          <Text key={item} style={styles.summaryBullet}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {selectedVariant.metadata?.warning ? (
                      <Text style={styles.body}>{selectedVariant.metadata.warning}</Text>
                    ) : null}
                    <View style={styles.variantList}>
                      {mediaVariants.map((variant) => (
                        <Pressable
                          key={variant.id}
                          onPress={() => setSelectedVariantId(variant.id)}
                          style={[styles.taskActionChip, variant.id === selectedVariant?.id ? styles.taskActionChipActive : null]}
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
                        {selectedVariant.isSelected ? 'Preferred variant selected' : 'Use this variant in materials'}
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
            <Text style={styles.body}>Shared seller checklist progress now syncs with the web workspace and report.</Text>
            <View style={styles.taskSummaryCard}>
              <Text style={styles.taskSummaryValue}>{checklist?.summary?.progressPercent ?? 0}% ready</Text>
              <Text style={styles.taskSummaryText}>
                {checklist?.summary?.completedCount ?? 0} completed · {checklist?.summary?.openCount ?? 0} open
              </Text>
              <Text style={styles.taskSummaryText}>Next: {checklist?.nextTask?.title || 'No open tasks right now'}</Text>
            </View>
            <View style={styles.taskList}>
              {openChecklistItems.length ? (
                openChecklistItems.map((task) => (
                  <View
                    key={task.id}
                    style={[styles.taskCard, task.status === 'in_progress' ? styles.taskCardWorking : null]}
                  >
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
                      <Text style={styles.taskCategory}>{String(task.category || 'custom').replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskDetail}>{task.detail}</Text>
                    <Pressable
                      onPress={() => handleUpdateChecklistStatus(task.id, getNextChecklistStatus(task.status))}
                      style={[styles.button, styles.buttonSecondary, styles.taskStatusButton]}
                      disabled={busy}
                    >
                      <Text style={styles.buttonSecondaryText}>
                        {task.status === 'todo'
                          ? 'Start task'
                          : task.status === 'in_progress'
                            ? 'Mark done'
                            : 'Reopen task'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.body}>
                  {checklistItems.length
                    ? 'All current checklist items are complete.'
                    : 'No checklist items yet for this property.'}
                </Text>
              )}
            </View>
            {completedChecklistItems.length ? (
              <View style={styles.completedTasksCard}>
                <Pressable
                  onPress={() => setShowCompletedTasks((current) => !current)}
                  style={styles.completedTasksToggle}
                >
                  <Text style={styles.completedTasksTitle}>Completed tasks ({completedChecklistItems.length})</Text>
                  <Text style={styles.completedTasksToggleText}>{showCompletedTasks ? 'Hide' : 'Show'}</Text>
                </Pressable>
                {showCompletedTasks
                  ? completedChecklistItems.map((task) => (
                      <View key={task.id} style={[styles.taskCard, styles.taskCardComplete]}>
                        <View style={styles.taskMetaRow}>
                          <Text style={styles.taskDone}>{formatChecklistStatus(task.status)}</Text>
                          <Text style={styles.taskCategory}>{String(task.category || 'custom').replace(/_/g, ' ')}</Text>
                        </View>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <Text style={styles.taskDetail}>{task.detail}</Text>
                        <Pressable
                          onPress={() => handleUpdateChecklistStatus(task.id, 'todo')}
                          style={[styles.button, styles.buttonSecondary, styles.taskStatusButton]}
                          disabled={busy}
                        >
                          <Text style={styles.buttonSecondaryText}>Reopen task</Text>
                        </Pressable>
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
            <View style={styles.customTaskComposer}>
              <TextInput
                placeholder="Add a custom seller task"
                placeholderTextColor="#7d8a8f"
                style={[styles.input, styles.customTaskInput]}
                value={customTaskTitle}
                onChangeText={setCustomTaskTitle}
              />
              <Pressable
                onPress={handleCreateCustomTask}
                style={[styles.button, styles.buttonPrimary, styles.customTaskButton]}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Add task</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </>
    );
  }

  if (session?.user) {
    return (
      <View style={styles.screen}>
        <View style={styles.mobileContent}>
        <ScrollView contentContainerStyle={styles.mobileShell}>
          <View style={styles.mobileTopBar}>
            <View style={styles.topBarSide}>
              {appScreen === 'home' ? (
                <Pressable onPress={() => setAppScreen('settings')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2699'}</Text>
                </Pressable>
              ) : appScreen === 'property' || appScreen === 'settings' ? (
                <Pressable onPress={() => setAppScreen('home')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2039'}</Text>
                </Pressable>
              ) : (
                <View style={styles.topIconPlaceholder} />
              )}
            </View>
            <View style={styles.mobileHeaderCopy}>
              {appScreen === 'home' ? (
                <>
                  <Text style={styles.mobileTitle}>Home Advisor</Text>
                  <Text style={styles.mobilePoweredBy}>powered by</Text>
                  <Text style={styles.mobileBrand}>Workside Software</Text>
                  <Text style={styles.mobileSubtitle}>{headerSubtitle}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.mobileScreenTitle}>{screenTitle}</Text>
                  {headerSubtitle ? <Text style={styles.mobileScreenSubtitle}>{headerSubtitle}</Text> : null}
                </>
              )}
            </View>
            <View style={styles.topBarSide}>
              {appScreen === 'home' ? (
                <Pressable onPress={handleSignOut} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u21B1'}</Text>
                </Pressable>
              ) : appScreen === 'property' ? (
                <Pressable onPress={() => setAppScreen('settings')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2699'}</Text>
                </Pressable>
              ) : (
                <View style={styles.topIconPlaceholder} />
              )}
            </View>
          </View>

          {appScreen === 'home' ? (
            <View style={styles.mobileCard}>
              <Text style={styles.homeWelcomeTitle}>Welcome, {session.user.firstName || 'there'}</Text>
              <Text style={styles.homeWelcomeMeta}>
                {properties.length} {properties.length === 1 ? 'property' : 'properties'} connected
              </Text>
              {properties.length ? (
                <Text style={styles.homeHintText}>Select a property to begin.</Text>
              ) : null}
              <View style={styles.homePropertyList}>
                {properties.length ? (
                  properties.map((property) => (
                    <Pressable key={property.id} onPress={() => handleSelectProperty(property.id)} style={styles.homePropertyCard}>
                      <View style={styles.homePropertyCopy}>
                        <Text style={styles.homePropertyTitle}>{property.title}</Text>
                        <Text style={styles.homePropertyMeta}>
                          {[property.city, property.state].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      <Text style={styles.homePropertyArrow}>{'\u203A'}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.body}>
                    {propertiesQuery.isLoading ? 'Loading your properties...' : 'No properties were found for this account yet.'}
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {appScreen === 'settings' ? (
            <View style={styles.mobileCard}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Account</Text>
                <TextInput
                  placeholder="First name"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  value={accountForm.firstName}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({ ...current, firstName: value }))
                  }
                />
                <TextInput
                  placeholder="Last name"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  value={accountForm.lastName}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({ ...current, lastName: value }))
                  }
                />
                <View style={styles.settingsInfoCard}>
                  <Text style={styles.settingsInfoLabel}>Email</Text>
                  <Text style={styles.settingsInfoValue} numberOfLines={1}>
                    {truncateMiddle(session.user.email)}
                  </Text>
                </View>
                <TextInput
                  placeholder="Mobile number"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={accountForm.mobilePhone}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({
                      ...current,
                      mobilePhone: formatPhoneInput(value),
                    }))
                  }
                />
                <View style={styles.settingsInfoCard}>
                  <Text style={styles.settingsInfoLabel}>Account Type</Text>
                  <Text style={styles.settingsInfoValue} numberOfLines={1}>
                    {viewerRole === 'agent' ? 'Realtor / Agent' : 'Seller'}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setAccountForm((current) => ({
                      ...current,
                      smsOptIn: !current.smsOptIn,
                    }))
                  }
                  style={styles.settingsRowButton}
                >
                  <Text style={styles.settingsRowTitle}>
                    {accountForm.smsOptIn ? 'SMS updates enabled' : 'SMS updates disabled'}
                  </Text>
                  <Text style={styles.settingsRowMeta}>
                    Receive transactional listing and provider updates by SMS. Reply STOP to opt out.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveAccountSettings}
                  style={[styles.button, styles.buttonPrimary]}
                  disabled={busy}
                >
                  <Text style={styles.buttonText}>Save account settings</Text>
                </Pressable>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>App Info & Legal</Text>
                <Pressable onPress={() => openExternalLink(SUPPORT_URL)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Contact Support</Text>
                  <Text style={styles.settingsRowMeta}>support@worksideadvisor.com</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(PRIVACY_URL)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Privacy Notice</Text>
                  <Text style={styles.settingsRowMeta}>Review how Workside handles your data.</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(TERMS_URL)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Terms of Service</Text>
                  <Text style={styles.settingsRowMeta}>Read the current mobile and web terms.</Text>
                </Pressable>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Danger Zone</Text>
                <Pressable onPress={handleDeleteAccount} style={styles.settingsDangerCard} disabled={busy}>
                  <Text style={styles.settingsDangerTitle}>Delete Account</Text>
                  <Text style={styles.settingsDangerMeta}>Permanently delete your account and all related property data.</Text>
                </Pressable>
                <Pressable onPress={handleSignOut} style={[styles.button, styles.buttonSecondary]}>
                  <Text style={styles.buttonSecondaryText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {appScreen === 'property' && selectedProperty ? (
            <View style={styles.mobileCard}>
              <View style={styles.propertyHeroCard}>
                {workflow ? (
                  <View style={styles.propertyHeroStats}>
                    <View style={styles.propertyHeroStatChip}>
                      <Text style={styles.propertyHeroStatText}>{workflow.marketReadyScore}/100 ready</Text>
                    </View>
                    <View style={styles.propertyHeroStatChip}>
                      <Text style={styles.propertyHeroStatText}>{workflow.completionPercent}% complete</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              {renderPropertyWorkspaceContent()}
            </View>
          ) : null}

          {!session?.user ? null : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy || refreshing ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}
        </ScrollView>
        </View>
        <View style={styles.mobileFooterDock}>
          <Text style={styles.mobileFooter}>Copyright 2026 Workside Software LLC</Text>
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
        </View>
      </View>
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
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    gap: 12,
  },
  authLayout: {
    flex: 1,
  },
  authScroll: {
    flex: 1,
  },
  authScrollContent: {
    paddingBottom: 24,
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingBottom: 96,
  },
  mobileContent: {
    flex: 1,
  },
  mobileShell: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 96,
    gap: 14,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  topBarSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconGlyph: {
    color: '#f8f1e6',
    fontSize: 18,
    fontWeight: '800',
  },
  topIconPlaceholder: {
    width: 40,
    height: 40,
  },
  mobileHeaderCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
    minWidth: 0,
    alignItems: 'center',
  },
  mobileCard: {
    backgroundColor: 'rgba(38, 50, 61, 0.82)',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(126, 145, 160, 0.22)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  mobileTitle: {
    color: '#f8f1e6',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 31,
    textAlign: 'center',
  },
  mobilePoweredBy: {
    color: '#93a982',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  mobileBrand: {
    color: '#d7c6af',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  mobileSubtitle: {
    marginTop: 6,
    color: '#c8b9a7',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  mobileScreenTitle: {
    color: '#f8f1e6',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  mobileScreenSubtitle: {
    marginTop: 4,
    color: '#b9af9f',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  homeWelcomeTitle: {
    color: '#f8f1e6',
    fontSize: 18,
    fontWeight: '800',
  },
  homeWelcomeMeta: {
    color: '#93a982',
    fontSize: 13,
    fontWeight: '700',
  },
  homeHintText: {
    color: '#b9af9f',
    fontSize: 14,
    lineHeight: 20,
  },
  homePropertyList: {
    gap: 10,
  },
  homePropertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  homePropertyCopy: {
    flex: 1,
    gap: 4,
  },
  homePropertyTitle: {
    color: '#f8f1e6',
    fontSize: 17,
    fontWeight: '800',
  },
  homePropertyMeta: {
    color: '#b9af9f',
    fontSize: 13,
    lineHeight: 17,
  },
  homePropertyArrow: {
    color: '#d28859',
    fontSize: 24,
    fontWeight: '700',
  },
  settingsSection: {
    gap: 8,
  },
  settingsSectionLabel: {
    color: '#93a982',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  settingsInfoCard: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#1f2a33',
    borderWidth: 1,
    borderColor: '#34434f',
  },
  settingsInfoLabel: {
    color: '#93a982',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsInfoValue: {
    color: '#f8f1e6',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  settingsRowButton: {
    gap: 4,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  settingsRowTitle: {
    color: '#f8f1e6',
    fontSize: 16,
    fontWeight: '700',
  },
  settingsRowMeta: {
    color: '#b9af9f',
    fontSize: 12,
    lineHeight: 16,
  },
  settingsDangerCard: {
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(131, 33, 33, 0.24)',
    borderWidth: 1,
    borderColor: '#b85d4c',
  },
  settingsDangerTitle: {
    color: '#ffcdc5',
    fontSize: 17,
    fontWeight: '800',
  },
  settingsDangerMeta: {
    color: '#f1c0b7',
    fontSize: 13,
    lineHeight: 18,
  },
  propertyHeroCard: {
    gap: 6,
    paddingBottom: 2,
  },
  propertyHeroTitle: {
    color: '#f8f1e6',
    fontSize: 24,
    fontWeight: '800',
  },
  propertyHeroMeta: {
    color: '#b9af9f',
    fontSize: 13,
    lineHeight: 18,
  },
  propertyHeroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  propertyHeroStatChip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  propertyHeroStatText: {
    color: '#93a982',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: 'rgba(38, 50, 61, 0.78)',
    borderRadius: 24,
    padding: 20,
    gap: 10,
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
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  authPoweredBy: {
    color: '#93a982',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: -2,
    textAlign: 'center',
  },
  authBrand: {
    color: '#d7c6af',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  authTagline: {
    color: '#dbcbb7',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 2,
    textAlign: 'center',
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
  authModeCard: {
    gap: 6,
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  authModeTitle: {
    color: '#f8f1e6',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  authModeCopy: {
    color: '#dbcbb7',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visionActionRow: {
    alignItems: 'stretch',
    flexWrap: 'wrap',
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
  buttonDanger: {
    backgroundColor: '#b85d4c',
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
  authSecondaryActions: {
    gap: 8,
    alignItems: 'center',
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
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  userCardCopy: {
    flex: 1,
    gap: 4,
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
  chipButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  chipButtonActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  chipButtonText: {
    color: '#f8f1e6',
    fontSize: 13,
    fontWeight: '700',
  },
  chipButtonTextActive: {
    color: '#fff7ee',
    fontSize: 13,
    fontWeight: '800',
  },
  settingsCard: {
    gap: 12,
    marginTop: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  settingsActionList: {
    gap: 10,
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
  workflowGuideCard: {
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  workflowNextCard: {
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#3a3128',
    borderWidth: 1,
    borderColor: '#d28859',
  },
  workflowNextLabel: {
    color: '#f0c6a4',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  workflowHelperText: {
    color: '#93a982',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  workflowPhaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  workflowPhaseChip: {
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#1f2a33',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  workflowPhaseChipActive: {
    backgroundColor: '#3f3429',
    borderColor: '#d28859',
  },
  workflowPhaseChipComplete: {
    backgroundColor: '#22342d',
    borderColor: '#4f6b5b',
  },
  workflowPhaseChipLabel: {
    color: '#f8f1e6',
    fontSize: 12,
    fontWeight: '700',
  },
  workflowPhaseChipMeta: {
    color: '#b9af9f',
    fontSize: 11,
  },
  sectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  sectionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  sectionChipActive: {
    backgroundColor: '#d28859',
    borderColor: '#d28859',
  },
  sectionChipRecommended: {
    backgroundColor: '#3d3325',
    borderColor: '#d9a14e',
  },
  sectionChipComplete: {
    backgroundColor: '#22342d',
    borderColor: '#4f6b5b',
  },
  sectionChipLabel: {
    color: '#dbcbb7',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionChipLabelRecommended: {
    color: '#f7d7b7',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionChipLabelActive: {
    color: '#fff7ee',
    fontSize: 12,
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
  overviewInsightCard: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  summaryBulletList: {
    gap: 8,
  },
  summaryBullet: {
    color: '#dbcbb7',
    fontSize: 14,
    lineHeight: 20,
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
  roomChipRecommended: {
    backgroundColor: '#3d3325',
    borderColor: '#d9a14e',
  },
  roomChipDone: {
    backgroundColor: '#22342d',
    borderColor: '#4f6b5b',
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
  roomChipLabelDone: {
    color: '#d8ead8',
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
    paddingVertical: 8,
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
  learnMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  learnMoreButtonText: {
    color: '#93a982',
    fontSize: 13,
    fontWeight: '700',
  },
  visionJobCard: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#31404d',
    borderWidth: 1,
    borderColor: '#425563',
  },
  visionJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visionJobTitle: {
    color: '#f8f1e6',
    fontSize: 15,
    fontWeight: '800',
  },
  visionActionButton: {
    minWidth: 0,
  },
  visionActionButtonText: {
    fontSize: 15,
    textAlign: 'center',
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
    backgroundColor: '#2c3440',
    borderWidth: 1,
    borderColor: '#d28859',
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
  taskCardWorking: {
    borderColor: '#d9a14e',
    borderLeftWidth: 4,
    backgroundColor: '#2d3336',
  },
  taskCardComplete: {
    opacity: 0.76,
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
  taskStatusButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  completedTasksCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#1f2a33',
    borderWidth: 1,
    borderColor: '#34434f',
  },
  completedTasksToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  completedTasksTitle: {
    color: '#f8f1e6',
    fontSize: 15,
    fontWeight: '800',
  },
  completedTasksToggleText: {
    color: '#93a982',
    fontSize: 13,
    fontWeight: '700',
  },
  customTaskComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#24303a',
    borderWidth: 1,
    borderColor: '#3d4e5b',
  },
  customTaskInput: {
    flex: 1,
    backgroundColor: '#31404d',
    marginBottom: 0,
  },
  customTaskButton: {
    minWidth: 108,
  },
  authFooter: {
    gap: 8,
    alignItems: 'center',
    paddingBottom: 2,
  },
  authFooterDock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(126, 145, 160, 0.18)',
    backgroundColor: 'rgba(22, 32, 39, 0.98)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 14 : 8,
  },
  authFooterCopy: {
    color: '#b9af9f',
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '700',
  },
  mobileFooter: {
    color: '#8f9aa0',
    fontSize: 12,
    textAlign: 'center',
  },
  mobileFooterDock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(126, 145, 160, 0.18)',
    backgroundColor: 'rgba(22, 32, 39, 0.98)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

