'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { PropertyLocationMap, ProviderResultsMap } from '../../../components/PropertyLocationMap';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  cancelImageEnhancementJob,
  createBillingCheckoutSession,
  createChecklistItem,
  createImageEnhancementJob,
  createProviderLead,
  createProviderReference,
  deleteProperty as deletePropertyRequest,
  deleteMediaAsset as deleteMediaAssetRequest,
  deleteMediaVariant as deleteMediaVariantRequest,
  deleteProviderReference,
  downloadFile,
  generateFlyer,
  generateReport,
  generateSocialPack,
  getBillingSummary,
  getImageEnhancementJob,
  getFlyerExportUrl,
  getLatestFlyer,
  getLatestReport,
  getLatestSocialPack,
  getPropertyFull,
  getProviderReferenceSheetExportUrl,
  getReportExportUrl,
  getWorkflow,
  listProviderLeads,
  listProviderReferences,
  listProviders,
  listImageEnhancementJobs,
  listMediaVariants,
  listVisionPresets,
  pruneVisionDrafts,
  savePhoto,
  saveVariantToPhotos,
  saveProvider,
  selectMediaVariant,
  suggestFlyerCopy,
  setPropertyPricingDecision,
  updateChecklistItem,
  updateMediaAsset,
} from '../../../lib/api';
import { getStoredSession, setStoredSession } from '../../../lib/session';
import {
  ASYNC_DOCUMENT_JOB_TIMEOUT_MS,
  waitForDuration,
  pollAsyncDocumentJobUntilSettled,
} from './asyncJobPolling';
import {
  VISION_WORKFLOW_STAGES,
  PHOTO_LIBRARY_CATEGORY_DEFINITIONS,
  buildPhotoCategoryGroups,
  buildVisionWorkflowRecommendation,
  formatFreeformPlanHighlights,
  getAssetGenerationStageKey,
  getDefaultVisionPresetKeyForStage,
  getDefaultVisionStageForAsset,
  getMediaAssetPrimaryLabel,
  getMediaAssetBadges,
  getMediaAssetCreatedAtTimestamp,
  getMediaAssetSummary,
  getNewestVisionVariants,
  getNextVisionWorkflowStageKey,
  getVariantCreatedAtTimestamp,
  getVariantDisclaimer,
  getVariantReviewScore,
  getVariantSummary,
  getVisionPipelinePackageSummary,
  getVisionRecommendationLabel,
  getVisionSaveDefaults,
  getVisionWorkflowStage,
  getVisionWorkflowStageForPreset,
  getVisionWorkflowStageKeyForVariant,
  groupMediaAssetsByRoom,
  pickVisionWorkspaceVariantId,
} from './workspaceVisionHelpers';
import {
  buildAddressQuery,
  buildDashboardFromSnapshot,
  buildGoogleMapsRouteUrl,
  buildPropertyAddressLabel,
  buildProviderCoverageGuidance,
  buildProviderFallbackQuery,
  buildSocialPackVariantDetails,
  formatChecklistCategory,
  formatDateTimeLabel,
  formatWorkflowStatus,
  getSocialPackVariantKey,
  readBooleanWorkspacePreference,
  readFileAsDataUrl,
  readWorkspaceSectionState,
} from './workspaceClientHelpers';
import { WorkspaceChecklistTab } from './workspaceChecklistTab';
import { WorkspaceBrochureTab } from './workspaceBrochureTab';
import { WorkspaceOverviewTab } from './workspaceOverviewTab';
import { WorkspacePhotosTab } from './workspacePhotosTab';
import { WorkspacePricingTab } from './workspacePricingTab';
import { WorkspaceReportTab } from './workspaceReportTab';
import { WorkspaceSellerPicksTab } from './workspaceSellerPicksTab';

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'photos', label: 'Photos' },
  { id: 'seller_picks', label: 'Seller Picks' },
  { id: 'brochure', label: 'Flyer' },
  { id: 'report', label: 'Report' },
  { id: 'checklist', label: 'Checklist' },
];
const HIDDEN_WORKSPACE_TABS = [{ id: 'vision', label: 'Vision workspace' }];

const PHOTO_IMPORT_SOURCE_OPTIONS = [
  { value: 'web_upload', label: 'Web upload' },
  { value: 'third_party_import', label: 'Third-party import' },
];
const PHOTO_IMPORT_ROOM_LABEL_OPTIONS = [
  ...PHOTO_LIBRARY_CATEGORY_DEFINITIONS.filter((category) => category.key !== 'other').map(
    (category) => category.label,
  ),
  'Other',
];

const PHOTO_VARIATIONS_PAGE_SIZE = 12;
const INITIAL_PHOTO_VARIATIONS_STATE = {
  assetId: '',
  variants: [],
  totalCount: 0,
  loadedCount: 0,
  isLoading: false,
  hasMore: false,
  error: '',
};

const PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS = new Set([
  'account_created',
  'profile_complete',
  'property_added',
]);
const DASHBOARD_FLASH_TOAST_KEY = 'worksideDashboardFlashToast';
const HOME_ADVISOR_GUIDE_STORAGE_KEY_PREFIX = 'workside.homeAdvisorGuide.hidden';

const REPORT_SECTION_OPTIONS = [
  { id: 'executive_summary', label: 'Executive Summary' },
  { id: 'pricing_analysis', label: 'Pricing Analysis' },
  { id: 'comparable_properties', label: 'Comparable Properties' },
  { id: 'photo_review', label: 'Photo Review Summary' },
  { id: 'visual_improvement_previews', label: 'Visual Improvement Previews' },
  { id: 'readiness_score', label: 'Readiness Score' },
  { id: 'improvement_recommendations', label: 'Improvement Recommendations' },
  { id: 'seller_checklist', label: 'Seller Checklist' },
  { id: 'marketing_guidance', label: 'Marketing Guidance' },
  { id: 'draft_listing_description', label: 'Draft Listing Description' },
];

const VISION_COMPLETION_SOUND_MIN_SECONDS = 15;
const VISION_JOB_RECOVERY_LOOKBACK_MS = 90 * 1000;
const VISION_JOB_RECOVERY_POLL_INTERVAL_MS = 4000;
const VISION_JOB_RECOVERY_TIMEOUT_MS = 45 * 1000;
const VISION_JOB_BACKGROUND_RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_WORKSPACE_SECTION_STATE = {
  photos_import: true,
  photos_room_kitchen: true,
  photos_room_living_room: true,
  photos_room_master_bedroom: true,
  photos_room_master_bathroom: true,
  photos_room_other: false,
  photos_room_exterior: true,
  seller_picks_summary: true,
  brochure_controls: true,
  brochure_preview: true,
  brochure_social: false,
  report_builder: true,
  report_preview: true,
  checklist_tasks: true,
  checklist_summary: true,
  checklist_custom: false,
  checklist_providers: false,
};

export function PropertyWorkspaceClient({ propertyId, mapsApiKey = '' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const flyerPreviewRef = useRef(null);
  const reportPreviewRef = useRef(null);
  const visionCompareRef = useRef(null);
  const visionCurrentActionRef = useRef(null);
  const lastVisionAssetResetRef = useRef('');
  const firstImpressionAutoStartedAssetIdsRef = useRef(new Set());
  const propertySnapshotRefreshPromiseRef = useRef(null);
  const workspaceBodyMainRef = useRef(null);
  const providerSuggestionsRef = useRef(null);
  const visionCompletionAudioContextRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [latestSocialPack, setLatestSocialPack] = useState(null);
  const [activeSocialPackVariantKey, setActiveSocialPackVariantKey] = useState('');
  const [mediaAssets, setMediaAssets] = useState([]);
  const [mediaVariants, setMediaVariants] = useState([]);
  const [visionPresets, setVisionPresets] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [latestGeneratedVariantId, setLatestGeneratedVariantId] = useState('');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [workflowSourceVariantId, setWorkflowSourceVariantId] = useState('');
  const [activeVisionWorkflowStageKey, setActiveVisionWorkflowStageKey] = useState('clean');
  const [activeVisionPresetKey, setActiveVisionPresetKey] = useState('enhance_listing_quality');
  const [flyerType, setFlyerType] = useState('sale');
  const [flyerHeadlineDraft, setFlyerHeadlineDraft] = useState('');
  const [flyerSubheadlineDraft, setFlyerSubheadlineDraft] = useState('');
  const [flyerSummaryDraft, setFlyerSummaryDraft] = useState('');
  const [flyerCallToActionDraft, setFlyerCallToActionDraft] = useState('');
  const [flyerSelectedPhotoIds, setFlyerSelectedPhotoIds] = useState([]);
  const [flyerCopySuggestions, setFlyerCopySuggestions] = useState([]);
  const [flyerCopySuggestionSource, setFlyerCopySuggestionSource] = useState('');
  const [isSuggestingFlyerCopy, setIsSuggestingFlyerCopy] = useState(false);
  const [reportTitleDraft, setReportTitleDraft] = useState('');
  const [reportExecutiveSummaryDraft, setReportExecutiveSummaryDraft] = useState('');
  const [reportListingDescriptionDraft, setReportListingDescriptionDraft] = useState('');
  const [reportSelectedPhotoIds, setReportSelectedPhotoIds] = useState([]);
  const [reportIncludedSections, setReportIncludedSections] = useState(
    REPORT_SECTION_OPTIONS.map((section) => section.id),
  );
  const [selectedListPriceDraft, setSelectedListPriceDraft] = useState('');
  const [selectedListPriceSourceDraft, setSelectedListPriceSourceDraft] = useState('recommended_mid');
  const [photoImportSource, setPhotoImportSource] = useState('web_upload');
  const [photoImportRoomLabel, setPhotoImportRoomLabel] = useState('Living Room');
  const [photoImportNotes, setPhotoImportNotes] = useState('');
  const [photoImportProgress, setPhotoImportProgress] = useState(null);
  const [freeformEnhancementInstructions, setFreeformEnhancementInstructions] = useState('');
  const [customChecklistTitle, setCustomChecklistTitle] = useState('');
  const [customChecklistDetail, setCustomChecklistDetail] = useState('');
  const [providerRecommendations, setProviderRecommendations] = useState([]);
  const [unavailableProviderRecommendations, setUnavailableProviderRecommendations] = useState([]);
  const [externalProviderRecommendations, setExternalProviderRecommendations] = useState([]);
  const [providerReferences, setProviderReferences] = useState([]);
  const [providerLeads, setProviderLeads] = useState([]);
  const [providerSource, setProviderSource] = useState(null);
  const [showExternalProviderFallback, setShowExternalProviderFallback] = useState(false);
  const [activeProviderDetails, setActiveProviderDetails] = useState(null);
  const [showProviderMap, setShowProviderMap] = useState(false);
  const [providerMapScope, setProviderMapScope] = useState('internal');
  const [providerMapDensity, setProviderMapDensity] = useState('compact');
  const [activeProviderTaskKey, setActiveProviderTaskKey] = useState('');
  const [providerSearchStatus, setProviderSearchStatus] = useState('');
  const [showMoreVisionVariants, setShowMoreVisionVariants] = useState(false);
  const [showVisionHistory, setShowVisionHistory] = useState(false);
  const [showVisionPhotoPicker, setShowVisionPhotoPicker] = useState(false);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState(null);
  const [pendingDeleteVisionVariant, setPendingDeleteVisionVariant] = useState(null);
  const [pendingPruneVisionDrafts, setPendingPruneVisionDrafts] = useState(null);
  const [showExpandedMap, setShowExpandedMap] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState(null);
  const [documentGenerationState, setDocumentGenerationState] = useState(null);
  const [pendingDeleteProperty, setPendingDeleteProperty] = useState(null);
  const [activePhotoDetailsAsset, setActivePhotoDetailsAsset] = useState(null);
  const [activePhotoVariationsAssetId, setActivePhotoVariationsAssetId] = useState('');
  const [photoVariationsState, setPhotoVariationsState] = useState(INITIAL_PHOTO_VARIATIONS_STATE);
  const [isSelectingPhotoVariations, setIsSelectingPhotoVariations] = useState(false);
  const [selectedPhotoVariationIds, setSelectedPhotoVariationIds] = useState([]);
  const [pendingDeletePhotoVariationIds, setPendingDeletePhotoVariationIds] = useState([]);
  const [photoVariationSortKey, setPhotoVariationSortKey] = useState('date');
  const [photoVariationSortDirection, setPhotoVariationSortDirection] = useState('desc');
  const [guidedWorkflow, setGuidedWorkflow] = useState(null);
  const [workflowPreviewStepKey, setWorkflowPreviewStepKey] = useState('');
  const [checklistSummaryMode, setChecklistSummaryMode] = useState('open');
  const [workspaceSectionState, setWorkspaceSectionState] = useState({});
  const [isHomeAdvisorGuideHidden, setIsHomeAdvisorGuideHidden] = useState(false);
  const [pendingWorkspaceScrollTarget, setPendingWorkspaceScrollTarget] = useState('');
  const [pendingChecklistFocusTarget, setPendingChecklistFocusTarget] = useState('');
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);
  const [visionGenerationState, setVisionGenerationState] = useState(null);
  const [visionGenerationElapsedSeconds, setVisionGenerationElapsedSeconds] = useState(0);
  const [visionRecoveryState, setVisionRecoveryState] = useState(null);
  const [visionCancellationPending, setVisionCancellationPending] = useState(false);

  function resolveDocumentGenerationPhase(kind, job = null) {
    const kindLabel = kind === 'report' ? 'Report' : 'Flyer';
    const message = String(job?.message || '').trim();
    if (message) {
      return message;
    }

    const stage = String(job?.currentStage || '').toLowerCase();
    if (stage === 'queued') {
      return `${kindLabel} queued. Starting shortly...`;
    }
    if (stage === 'generating_flyer') {
      return 'Generating flyer content...';
    }
    if (stage === 'generating_report') {
      return 'Generating seller report content...';
    }
    if (stage === 'running') {
      return `${kindLabel} generation is running...`;
    }

    return `${kindLabel} generation is in progress...`;
  }

  function beginDocumentGeneration(kind, initialPhase = '') {
    setDocumentGenerationState({
      kind,
      startedAtMs: Date.now(),
      elapsedSeconds: 0,
      progressPercent: 0,
      phase: initialPhase || resolveDocumentGenerationPhase(kind, null),
    });
  }

  function updateDocumentGeneration(kind, job, elapsedMs = 0) {
    const nextProgress = Number.isFinite(Number(job?.progressPercent))
      ? Number(job.progressPercent)
      : 0;
    setDocumentGenerationState((current) => {
      if (!current || current.kind !== kind) {
        return current;
      }

      return {
        ...current,
        elapsedSeconds: Math.max(
          current.elapsedSeconds || 0,
          Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000),
        ),
        progressPercent: Math.max(current.progressPercent || 0, nextProgress),
        phase: resolveDocumentGenerationPhase(kind, job),
      };
    });
  }

  function clearDocumentGeneration(kind) {
    setDocumentGenerationState((current) => {
      if (!current) {
        return current;
      }
      if (kind && current.kind !== kind) {
        return current;
      }
      return null;
    });
  }
  const viewerRole = useMemo(() => {
    const session = getStoredSession();
    return session?.user?.role === 'agent' ? 'agent' : 'seller';
  }, []);
  const viewerUserId = useMemo(() => {
    const session = getStoredSession();
    return session?.user?.id || '';
  }, []);
  const recommendedVisionUpgradePlanKey = viewerRole === 'agent' ? 'agent_starter' : 'seller_pro';
  const viewerIdentityKey = useMemo(() => {
    const session = getStoredSession();
    return (
      session?.user?.id ||
      session?.user?.email ||
      session?.user?.phone ||
      viewerRole
    );
  }, [viewerRole]);
  const workspaceSectionStorageKey = useMemo(
    () => `workside.workspace.sections.${viewerIdentityKey}.${propertyId}`,
    [propertyId, viewerIdentityKey],
  );
  const homeAdvisorGuideStorageKey = useMemo(
    () => `${HOME_ADVISOR_GUIDE_STORAGE_KEY_PREFIX}.${viewerIdentityKey}.${propertyId}`,
    [propertyId, viewerIdentityKey],
  );

  const billingSummaryQuery = useQuery({
    queryKey: ['billing-summary', viewerUserId || 'workspace-user'],
    enabled: Boolean(viewerUserId),
    queryFn: async () => getBillingSummary(viewerUserId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const billingAccess = billingSummaryQuery.data?.access || null;
  const canAccessVisionWorkspace =
    billingAccess?.planKey &&
    billingAccess.planKey !== 'free';

  useEffect(() => {
    if (canAccessVisionWorkspace) {
      return;
    }

    if (activeTab === 'vision') {
      setActiveTab('photos');
    }
    if (visionRecoveryState) {
      setVisionRecoveryState(null);
    }
    if (visionGenerationState) {
      setVisionGenerationState(null);
    }
    if (visionCancellationPending) {
      setVisionCancellationPending(false);
    }
    if (
      status === 'Recovering vision job...' ||
      status.startsWith('Generating ') ||
      status.includes('vision')
    ) {
      setStatus('');
    }
  }, [
    activeTab,
    canAccessVisionWorkspace,
    status,
    visionCancellationPending,
    visionGenerationState,
    visionRecoveryState,
  ]);

  useEffect(() => {
    setWorkspaceSectionState(readWorkspaceSectionState(workspaceSectionStorageKey));
  }, [workspaceSectionStorageKey]);

  useEffect(() => {
    setIsHomeAdvisorGuideHidden(
      readBooleanWorkspacePreference(homeAdvisorGuideStorageKey, false),
    );
  }, [homeAdvisorGuideStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !workspaceSectionStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(
        workspaceSectionStorageKey,
        JSON.stringify(workspaceSectionState),
      );
    } catch {}
  }, [workspaceSectionState, workspaceSectionStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !homeAdvisorGuideStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(
        homeAdvisorGuideStorageKey,
        String(isHomeAdvisorGuideHidden),
      );
    } catch {}
  }, [homeAdvisorGuideStorageKey, isHomeAdvisorGuideHidden]);

  function isWorkspaceSectionOpen(sectionKey, defaultOpen = true) {
    if (Object.prototype.hasOwnProperty.call(workspaceSectionState, sectionKey)) {
      return Boolean(workspaceSectionState[sectionKey]);
    }
    return defaultOpen;
  }

  function setWorkspaceSectionOpen(sectionKey, nextValue, defaultOpen = true) {
    setWorkspaceSectionState((current) => ({
      ...current,
      [sectionKey]:
        typeof nextValue === 'function'
          ? nextValue(
              Object.prototype.hasOwnProperty.call(current, sectionKey)
                ? Boolean(current[sectionKey])
                : defaultOpen,
            )
          : Boolean(nextValue),
    }));
  }

  useEffect(() => {
    if (!visionGenerationState?.startedAt) {
      setVisionGenerationElapsedSeconds(0);
      return undefined;
    }

    const updateElapsedSeconds = () => {
      setVisionGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - visionGenerationState.startedAt) / 1000)),
      );
    };

    updateElapsedSeconds();
    const timer = window.setInterval(updateElapsedSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [visionGenerationState]);

  useEffect(() => {
    if (!visionRecoveryState?.jobId || !visionRecoveryState.assetId) {
      return undefined;
    }

    let cancelled = false;

    async function pollRecoveredVisionJob() {
      const deadline = Date.now() + VISION_JOB_BACKGROUND_RECOVERY_TIMEOUT_MS;

      while (!cancelled && Date.now() < deadline) {
        await waitForDuration(VISION_JOB_RECOVERY_POLL_INTERVAL_MS);
        if (cancelled) {
          return;
        }

        try {
          const jobResponse = await getImageEnhancementJob(visionRecoveryState.jobId);
          const latestJob = jobResponse.job;
          if (!latestJob) {
            continue;
          }

          if (
            latestJob.status !== 'completed' &&
            latestJob.status !== 'failed' &&
            latestJob.status !== 'cancelled'
          ) {
            continue;
          }

          try {
            const settledJob = await reconcileRecoveredVisionJob(
              latestJob,
              visionRecoveryState.assetId,
            );

            if (cancelled) {
              return;
            }

            if (visionRecoveryState.mode === 'freeform') {
              setShowMoreVisionVariants(true);
              setActiveVisionPresetKey(
                settledJob?.presetKey ||
                  settledJob?.variants?.[0]?.metadata?.presetKey ||
                  settledJob?.variants?.[0]?.variantType ||
                  'combined_listing_refresh',
              );
            } else if (visionRecoveryState.presetKey) {
              setActiveVisionPresetKey(visionRecoveryState.presetKey);
              setActiveVisionWorkflowStageKey(
                visionRecoveryState.workflowStageKey ||
                  getVisionWorkflowStageForPreset(visionRecoveryState.presetKey),
              );
            }

            const completionToast = buildVisionCompletionToast({
              job: settledJob,
              successTitle: visionRecoveryState.successTitle,
              successMessage: visionRecoveryState.successMessage,
              warningTitle: 'Preview ready with warning',
            });
            setToast(completionToast);
            if (completionToast.nextVariantId) {
              setLatestGeneratedVariantId(completionToast.nextVariantId);
            }
            if (completionToast.shouldScroll) {
              requestAnimationFrame(() => {
                visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            }
            void playVisionCompletionSound({
              tone: 'success',
              elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
            });
          } catch (recoveryError) {
            if (cancelled) {
              return;
            }
            setToast({
              tone: 'error',
              title: visionRecoveryState.failureTitle,
              message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
              autoDismissMs: 0,
            });
            void playVisionCompletionSound({
              tone: 'error',
              elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
            });
          } finally {
            if (!cancelled) {
              setVisionRecoveryState(null);
              setVisionGenerationState(null);
              setVisionCancellationPending(false);
              setStatus('');
            }
          }

          return;
        } catch (pollError) {
          if (cancelled) {
            return;
          }
        }
      }

      if (!cancelled) {
        setToast({
          tone: 'error',
          title: visionRecoveryState.failureTitle,
          message:
            'The browser request disconnected and the vision job did not finish within the recovery window. No new variant was selected, so the compare view is still showing the last successful preview.',
          autoDismissMs: 0,
        });
        void playVisionCompletionSound({
          tone: 'error',
          elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
        });
        setVisionRecoveryState(null);
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }

    void pollRecoveredVisionJob();

    return () => {
      cancelled = true;
    };
  }, [visionRecoveryState]);

  useEffect(() => {
    if (!selectedMediaAssetId) {
      lastVisionAssetResetRef.current = '';
      setMediaVariants([]);
      return;
    }
    if (lastVisionAssetResetRef.current === selectedMediaAssetId) {
      return;
    }
    const nextSelectedAsset =
      mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || null;
    const nextStageKey = getDefaultVisionStageForAsset(nextSelectedAsset);
    lastVisionAssetResetRef.current = selectedMediaAssetId;
    setMediaVariants([]);
    setSelectedVariantId('');
    setWorkflowSourceVariantId('');
    setActiveVisionWorkflowStageKey(nextStageKey);
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    setShowVisionHistory(false);
    setShowVisionPhotoPicker(false);
    setShowMoreVisionVariants(false);
    setLatestGeneratedVariantId('');
    setVisionRecoveryState(null);
    setVisionGenerationState(null);
    setVisionCancellationPending(false);
  }, [mediaAssets, selectedMediaAssetId]);

  useEffect(() => {
    if (
      workflowSourceVariantId &&
      !mediaVariants.some((variant) => variant.id === workflowSourceVariantId)
    ) {
      setWorkflowSourceVariantId('');
    }
  }, [mediaVariants, workflowSourceVariantId]);

  useEffect(() => {
    if (
      latestGeneratedVariantId &&
      !mediaVariants.some((variant) => variant.id === latestGeneratedVariantId)
    ) {
      setLatestGeneratedVariantId('');
    }
  }, [latestGeneratedVariantId, mediaVariants]);

  useEffect(() => {
    const stagePresetKeys = getVisionWorkflowStage(activeVisionWorkflowStageKey).groups.flatMap(
      (group) => group.items,
    );
    if (!stagePresetKeys.length) {
      return;
    }

    if (!stagePresetKeys.includes(activeVisionPresetKey)) {
      setActiveVisionPresetKey(stagePresetKeys[0]);
    }
  }, [activeVisionPresetKey, activeVisionWorkflowStageKey]);

  useEffect(
    () => () => {
      const audioContext = visionCompletionAudioContextRef.current;
      if (audioContext && typeof audioContext.close === 'function') {
        audioContext.close().catch(() => {});
      }
    },
    [],
  );

  async function primeVisionCompletionAudio() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    let audioContext = visionCompletionAudioContextRef.current;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContextConstructor();
      visionCompletionAudioContextRef.current = audioContext;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        return audioContext;
      }
    }

    return audioContext;
  }

  function getVisionGenerationDurationSeconds(startedAt) {
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }

  function matchesVisionJobRequest(job, { presetKey = '', mode = 'preset', startedAt = 0 } = {}) {
    const jobCreatedAt = new Date(job?.createdAt || 0).getTime();
    if (!jobCreatedAt || jobCreatedAt < startedAt - VISION_JOB_RECOVERY_LOOKBACK_MS) {
      return false;
    }

    if (mode === 'freeform') {
      return job?.mode === 'freeform';
    }

    return String(job?.presetKey || job?.jobType || '') === String(presetKey || '');
  }

  async function recoverVisionJobAfterDisconnect({
    assetId,
    presetKey = '',
    mode = 'preset',
    startedAt = 0,
  }) {
    const jobListResponse = await listImageEnhancementJobs(assetId, 8);
    const matchingJob = (jobListResponse.jobs || []).find((job) =>
      matchesVisionJobRequest(job, { presetKey, mode, startedAt }),
    );

    if (!matchingJob) {
      return null;
    }

    if (matchingJob.status === 'completed' || matchingJob.status === 'failed') {
      return matchingJob;
    }

    const deadline = Date.now() + VISION_JOB_RECOVERY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await waitForDuration(VISION_JOB_RECOVERY_POLL_INTERVAL_MS);
      const jobResponse = await getImageEnhancementJob(matchingJob.id);
      const latestJob = jobResponse.job;
      if (!latestJob) {
        continue;
      }
      if (latestJob.status === 'completed' || latestJob.status === 'failed') {
        return latestJob;
      }
    }

    return matchingJob;
  }

  function resolveVisionResultVariantId(job, variant = null) {
    return variant?.id || job?.selectedVariantId || job?.variants?.[0]?.id || '';
  }

  function buildVisionCompletionToast({
    job,
    variant = null,
    successTitle,
    successMessage,
    warningTitle = 'Preview ready with warning',
  }) {
    const nextVariantId = resolveVisionResultVariantId(job, variant);
    const isAdvisorOnly = job?.fallbackMode === 'advisor_only' || !nextVariantId;
    const deliveryMode = job?.input?.orchestrationDeliveryMode || '';
    const isSafeMarketplaceFallback = deliveryMode === 'safe_marketplace_fallback';

    if (isAdvisorOnly) {
      return {
        tone: 'warning',
        title: 'No strong visual change detected',
        message:
          job?.warning ||
          job?.message ||
          'The room may already present well, or the requested change was too subtle to preview reliably.',
        autoDismissMs: 0,
        shouldScroll: false,
        nextVariantId: '',
      };
    }

    return {
      tone: isSafeMarketplaceFallback || job?.warning ? 'warning' : 'success',
      title: isSafeMarketplaceFallback
        ? 'Safe fallback preview ready'
        : job?.warning
          ? warningTitle
          : successTitle,
      message:
        job?.warning ||
        job?.message ||
        (isSafeMarketplaceFallback
          ? 'A reliable deterministic preview was returned because the advanced pass did not produce a trustworthy result.'
          : successMessage),
      autoDismissMs: isSafeMarketplaceFallback || job?.warning ? 0 : 9000,
      shouldScroll: true,
      nextVariantId,
    };
  }

  async function reconcileRecoveredVisionJob(job, fallbackAssetId) {
    if (!job) {
      return null;
    }

    if (job.status === 'completed') {
      const nextAssetId = fallbackAssetId || selectedMediaAsset?.id || selectedMediaAssetId;
      await Promise.all([
        refreshMediaAssets(nextAssetId),
        refreshMediaVariants(nextAssetId),
        refreshWorkflow(),
      ]);
      const nextVariantId = resolveVisionResultVariantId(job);
      if (nextVariantId) {
        setSelectedVariantId(nextVariantId);
      }
      return job;
    }

    if (job.status === 'failed') {
      const failureMessage = job.warning || job.message || 'The vision job failed before producing a usable variant.';
      throw new Error(failureMessage);
    }

    if (job.status === 'cancelled') {
      throw new Error(job.message || 'The vision job was cancelled before a new preview was saved.');
    }

    throw new Error(
      'The request disconnected before the vision job finished. Please retry once the current generation has cleared.',
    );
  }

  async function playVisionCompletionSound({ tone = 'success', elapsedSeconds = 0 } = {}) {
    if (elapsedSeconds < VISION_COMPLETION_SOUND_MIN_SECONDS) {
      return;
    }

    const audioContext = await primeVisionCompletionAudio();
    if (!audioContext || audioContext.state !== 'running') {
      return;
    }

    const notePattern =
      tone === 'error'
        ? [
            { frequency: 415.3, duration: 0.08, gain: 0.028, delay: 0 },
            { frequency: 329.6, duration: 0.12, gain: 0.026, delay: 0.13 },
          ]
        : [
            { frequency: 659.3, duration: 0.08, gain: 0.03, delay: 0 },
            { frequency: 783.99, duration: 0.12, gain: 0.032, delay: 0.13 },
          ];

    for (const note of notePattern) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startTime = audioContext.currentTime + note.delay;
      const endTime = startTime + note.duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, startTime);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    }
  }

  function beginVisionRecovery({
    job,
    assetId,
    mode = 'preset',
    presetKey = '',
    workflowStageKey = '',
    startedAt = 0,
    successTitle = 'Vision job recovered',
    successMessage = 'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
    failureTitle = 'Variant generation failed',
  }) {
    if (!job?.id || !assetId) {
      return;
    }

    setVisionRecoveryState({
      jobId: job.id,
      assetId,
      mode,
      presetKey,
      workflowStageKey,
      startedAt,
      successTitle,
      successMessage,
      failureTitle,
    });
    setStatus('Recovering vision job...');
    setVisionGenerationState((current) =>
      current
        ? {
            ...current,
            detail:
              'The browser connection dropped, but the server job is still running. We are checking for the finished result now.',
          }
        : current,
    );
    setToast({
      tone: 'info',
      title: 'Recovering vision job',
      message:
        'The browser connection dropped, but the server job is still running. This workspace will update as soon as the result is ready.',
      autoDismissMs: 9000,
    });
  }

  async function handleCancelVisionGeneration() {
    const activeJobId = visionRecoveryState?.jobId;
    if (!activeJobId || visionCancellationPending) {
      return;
    }

    setVisionCancellationPending(true);
    try {
      const response = await cancelImageEnhancementJob(activeJobId);
      setVisionRecoveryState(null);
      setVisionGenerationState(null);
      setStatus('');
      setToast({
        tone: 'warning',
        title: 'Generation cancelled',
        message:
          response.job?.message ||
          'The background vision job was cancelled before a new preview was selected.',
        autoDismissMs: 7000,
      });
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Cancel failed',
        message: error.message || 'We could not cancel the running vision job.',
        autoDismissMs: 0,
      });
    } finally {
      setVisionCancellationPending(false);
    }
  }

  const propertyFullQuery = useQuery({
    queryKey: ['property-full', propertyId],
    enabled: Boolean(propertyId),
    queryFn: async () => getPropertyFull(propertyId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const liveMediaVariantsQuery = useQuery({
    queryKey: ['property-media-variants', selectedMediaAssetId || ''],
    enabled: Boolean(selectedMediaAssetId),
    queryFn: async () => {
      const response = await listMediaVariants(selectedMediaAssetId);
      return response.variants || [];
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const workflowQuery = useQuery({
    queryKey: ['property-workflow', propertyId, viewerRole],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const response = await getWorkflow(propertyId, viewerRole);
      return response.workflow;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const selectedMediaAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || mediaAssets[0] || null,
    [mediaAssets, selectedMediaAssetId],
  );
  const resolvedActivePhotoDetailsAsset = useMemo(() => {
    if (!activePhotoDetailsAsset?.id) {
      return null;
    }

    return (
      mediaAssets.find((asset) => asset.id === activePhotoDetailsAsset.id) ||
      activePhotoDetailsAsset
    );
  }, [activePhotoDetailsAsset, mediaAssets]);
  const resolvedActivePhotoVariationsAsset = useMemo(() => {
    if (!activePhotoVariationsAssetId) {
      return null;
    }

    return mediaAssets.find((asset) => asset.id === activePhotoVariationsAssetId) || null;
  }, [activePhotoVariationsAssetId, mediaAssets]);
  const listingCandidateAssets = useMemo(
    () => mediaAssets.filter((asset) => asset.listingCandidate),
    [mediaAssets],
  );
  const photoCategoryGroups = useMemo(() => buildPhotoCategoryGroups(mediaAssets), [mediaAssets]);
  const sellerPickCategoryGroups = useMemo(
    () => buildPhotoCategoryGroups(listingCandidateAssets).filter((group) => group.assets.length),
    [listingCandidateAssets],
  );
  const selectedMediaAssetPhotoCategory = useMemo(
    () =>
      photoCategoryGroups.find((group) =>
        group.assets.some((asset) => asset.id === selectedMediaAsset?.id),
      ) || null,
    [photoCategoryGroups, selectedMediaAsset?.id],
  );
  const firstPopulatedPhotoCategoryKey = useMemo(
    () => photoCategoryGroups.find((group) => group.assets.length)?.key || photoCategoryGroups[0]?.key || '',
    [photoCategoryGroups],
  );
  const mediaAssetGroups = useMemo(() => groupMediaAssetsByRoom(mediaAssets), [mediaAssets]);
  const brochurePhotoPool = useMemo(
    () => (listingCandidateAssets.length ? listingCandidateAssets : mediaAssets),
    [listingCandidateAssets, mediaAssets],
  );
  const reportPhotoPool = useMemo(() => mediaAssets, [mediaAssets]);
  const preferredVisionVariant = useMemo(
    () => mediaVariants.find((variant) => variant.isSelected) || null,
    [mediaVariants],
  );
  const stageScopedVisionVariants = useMemo(() => {
    const stageVariants = mediaVariants.filter(
      (variant) => getVisionWorkflowStageKeyForVariant(variant) === activeVisionWorkflowStageKey,
    );
    return getNewestVisionVariants(stageVariants.length ? stageVariants : mediaVariants);
  }, [activeVisionWorkflowStageKey, mediaVariants]);
  const defaultVisionWorkspaceVariantId = useMemo(
    () =>
      pickVisionWorkspaceVariantId(mediaVariants, {
        currentVariantId: selectedVariantId,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      }),
    [activeVisionWorkflowStageKey, mediaVariants, selectedVariantId, workflowSourceVariantId],
  );
  const resolvedSelectedVariantId = useMemo(() => {
    if (selectedVariantId && mediaVariants.some((variant) => variant.id === selectedVariantId)) {
      return selectedVariantId;
    }
    return defaultVisionWorkspaceVariantId;
  }, [defaultVisionWorkspaceVariantId, mediaVariants, selectedVariantId]);
  const selectedVariant = useMemo(
    () =>
      mediaVariants.find(
        (variant) => variant.id === resolvedSelectedVariantId,
      ) || null,
    [mediaVariants, resolvedSelectedVariantId],
  );
  const latestGeneratedVariant = useMemo(
    () => mediaVariants.find((variant) => variant.id === latestGeneratedVariantId) || null,
    [latestGeneratedVariantId, mediaVariants],
  );
  const workflowSourceVariant = useMemo(
    () =>
      mediaVariants.find((variant) => variant.id === workflowSourceVariantId) ||
      null,
    [mediaVariants, workflowSourceVariantId],
  );
  const selectedVariantSourceVariant = useMemo(
    () =>
      mediaVariants.find(
        (variant) => variant.id === String(selectedVariant?.metadata?.sourceVariantId || ''),
      ) || null,
    [mediaVariants, selectedVariant?.metadata?.sourceVariantId],
  );
  const savedAssetForSelectedVariant = useMemo(
    () =>
      mediaAssets.find(
        (asset) => String(asset?.sourceVariantId || '') === String(selectedVariant?.id || ''),
      ) || null,
    [mediaAssets, selectedVariant?.id],
  );
  const currentVisionSaveDefaults = useMemo(
    () => getVisionSaveDefaults(selectedVariant, activeVisionWorkflowStageKey),
    [activeVisionWorkflowStageKey, selectedVariant],
  );
  const currentVisionPipelinePackage = useMemo(
    () => getVisionPipelinePackageSummary(selectedVariant, currentVisionSaveDefaults),
    [currentVisionSaveDefaults, selectedVariant],
  );
  const selectedMediaAssetSourceAsset = useMemo(
    () =>
      mediaAssets.find(
        (asset) => String(asset?.id || '') === String(selectedMediaAsset?.sourceMediaId || ''),
      ) || null,
    [mediaAssets, selectedMediaAsset?.sourceMediaId],
  );
  const activeVisionWorkflowStage = useMemo(
    () => getVisionWorkflowStage(activeVisionWorkflowStageKey),
    [activeVisionWorkflowStageKey],
  );
  const photoVariations = useMemo(() => {
    if (
      !activePhotoVariationsAssetId ||
      String(photoVariationsState.assetId || '') !== String(activePhotoVariationsAssetId)
    ) {
      return [];
    }

    return photoVariationsState.variants;
  }, [activePhotoVariationsAssetId, photoVariationsState]);
  const sortedPhotoVariations = useMemo(() => {
    const variants = [...photoVariations];
    const compareDirection = photoVariationSortDirection === 'asc' ? 1 : -1;

    variants.sort((left, right) => {
      if (photoVariationSortKey === 'name') {
        const leftLabel = String(left?.label || '').trim().toLowerCase();
        const rightLabel = String(right?.label || '').trim().toLowerCase();
        const labelComparison = leftLabel.localeCompare(rightLabel);
        if (labelComparison !== 0) {
          return labelComparison * compareDirection;
        }
      } else {
        const leftDate = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightDate = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
        const dateComparison = leftDate - rightDate;
        if (dateComparison !== 0) {
          return dateComparison * compareDirection;
        }
      }

      const leftFallback = String(left?.label || '').trim().toLowerCase();
      const rightFallback = String(right?.label || '').trim().toLowerCase();
      return leftFallback.localeCompare(rightFallback);
    });

    return variants;
  }, [photoVariations, photoVariationSortDirection, photoVariationSortKey]);
  const isLoadingPhotoVariations =
    Boolean(activePhotoVariationsAssetId) &&
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId) &&
    photoVariationsState.isLoading;
  const photoVariationsTotalCount =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.totalCount
      : 0;
  const photoVariationsLoadedCount =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.loadedCount
      : 0;
  const photoVariationsError =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.error
      : '';
  const photoVariationsProgressPercent =
    photoVariationsTotalCount > 0
      ? Math.min(100, Math.round((photoVariationsLoadedCount / photoVariationsTotalCount) * 100))
      : 0;
  const activeVisionWorkflowPresetGroups = useMemo(() => {
    const presetByKey = new Map(visionPresets.map((preset) => [preset.key, preset]));
    return activeVisionWorkflowStage.groups
      .map((group) => ({
        ...group,
        items: group.items
          .map((itemKey) => presetByKey.get(itemKey))
          .filter(Boolean),
      }))
      .filter((group) => group.items.length);
  }, [activeVisionWorkflowStage, visionPresets]);
  const compareSourceVariant =
    selectedVariantSourceVariant ||
    (workflowSourceVariant && workflowSourceVariant.id !== selectedVariant?.id
      ? workflowSourceVariant
      : null);
  const selectedGeneratedAssetAsResult =
    !selectedVariant && selectedMediaAsset?.assetType === 'generated'
      ? selectedMediaAsset
      : null;
  const compareSourceImageUrl = selectedGeneratedAssetAsResult
    ? selectedMediaAssetSourceAsset?.imageUrl || selectedMediaAsset?.imageUrl || ''
    : compareSourceVariant?.imageUrl || selectedMediaAsset?.imageUrl || '';
  const compareSourceLabel = selectedGeneratedAssetAsResult
    ? selectedMediaAssetSourceAsset?.roomLabel || 'Original photo'
    : compareSourceVariant?.label || selectedMediaAsset?.roomLabel || 'Original photo';
  const effectiveVisionResultImageUrl =
    selectedVariant?.imageUrl || selectedGeneratedAssetAsResult?.imageUrl || '';
  const effectiveVisionResultLabel =
    selectedVariant?.label ||
    selectedGeneratedAssetAsResult?.generationLabel ||
    (selectedGeneratedAssetAsResult ? getMediaAssetPrimaryLabel(selectedGeneratedAssetAsResult) : '') ||
    'No result yet';
  const effectiveVisionResultSummary = selectedVariant
    ? getVariantSummary(selectedVariant)
    : selectedGeneratedAssetAsResult
    ? getMediaAssetSummary(selectedGeneratedAssetAsResult)
    : 'Generate the next stage action to compare the current source with a new result.';
  const selectedVariantFreeformHighlights = useMemo(
    () => formatFreeformPlanHighlights(selectedVariant?.metadata?.normalizedPlan),
    [selectedVariant?.metadata?.normalizedPlan],
  );
  const activeSocialPackVariant = useMemo(() => {
    const variants = latestSocialPack?.variants || [];
    if (!variants.length) {
      return null;
    }

    return (
      variants.find((variant, index) => getSocialPackVariantKey(variant, index) === activeSocialPackVariantKey) ||
      variants[0]
    );
  }, [activeSocialPackVariantKey, latestSocialPack]);
  const activeSocialPackVariantDetails = useMemo(
    () => buildSocialPackVariantDetails(latestSocialPack, activeSocialPackVariant),
    [activeSocialPackVariant, latestSocialPack],
  );
  const visibleVisionVariants = useMemo(() => {
    const historyVariants = stageScopedVisionVariants;
    if (showMoreVisionVariants) {
      return historyVariants;
    }

    const preferredVariants = historyVariants.filter(
      (variant) => !variant?.metadata?.review?.shouldHideByDefault,
    );
    const defaultVariants = (preferredVariants.length ? preferredVariants : historyVariants).slice(0, 3);
    if (
      selectedVariant &&
      !defaultVariants.some((variant) => variant.id === selectedVariant.id)
    ) {
      return [...defaultVariants, selectedVariant];
    }

    return defaultVariants;
  }, [selectedVariant, showMoreVisionVariants, stageScopedVisionVariants]);
  const hiddenVisionVariantCount = useMemo(
    () =>
      stageScopedVisionVariants.filter((variant) => variant?.metadata?.review?.shouldHideByDefault)
        .length,
    [stageScopedVisionVariants],
  );
  const activeVisionPreset = useMemo(
    () => visionPresets.find((preset) => preset.key === activeVisionPresetKey) || null,
    [activeVisionPresetKey, visionPresets],
  );
  const visionWorkflowRecommendation = useMemo(
    () => buildVisionWorkflowRecommendation(selectedMediaAsset, selectedVariant, visionPresets),
    [selectedMediaAsset, selectedVariant, visionPresets],
  );
  const activeVisionPresetTooltip = useMemo(() => {
    if (!activeVisionPreset) {
      return '';
    }

    return [
      activeVisionPreset.displayName,
      activeVisionPreset.helperText,
      activeVisionPreset.category === 'concept_preview'
        ? 'Concept preview for planning and discussion.'
        : 'Listing enhancement for stronger presentation.',
      activeVisionPreset.upgradeTier === 'premium'
        ? 'Premium workflow step.'
        : 'Included workflow step.',
    ]
      .filter(Boolean)
      .join(' ');
  }, [activeVisionPreset]);
  useEffect(() => {
    if (!activePhotoVariationsAssetId) {
      setPhotoVariationsState(INITIAL_PHOTO_VARIATIONS_STATE);
      return undefined;
    }

    let cancelled = false;

    async function loadPhotoVariationsInBatches() {
      setPhotoVariationsState({
        assetId: activePhotoVariationsAssetId,
        variants: [],
        totalCount: 0,
        loadedCount: 0,
        isLoading: true,
        hasMore: false,
        error: '',
      });

      try {
        const firstBatch = await listMediaVariants(activePhotoVariationsAssetId, {
          offset: 0,
          limit: PHOTO_VARIATIONS_PAGE_SIZE,
          includeTotalCount: true,
        });
        if (cancelled) {
          return;
        }

        let loadedVariants = firstBatch.variants || [];
        const totalCount = Number(firstBatch.totalCount || loadedVariants.length || 0);
        let hasMore = loadedVariants.length < totalCount;

        setPhotoVariationsState({
          assetId: activePhotoVariationsAssetId,
          variants: loadedVariants,
          totalCount,
          loadedCount: loadedVariants.length,
          isLoading: hasMore,
          hasMore,
          error: '',
        });

        while (!cancelled && hasMore) {
          const nextBatch = await listMediaVariants(activePhotoVariationsAssetId, {
            offset: loadedVariants.length,
            limit: PHOTO_VARIATIONS_PAGE_SIZE,
          });
          if (cancelled) {
            return;
          }

          const nextVariants = nextBatch.variants || [];
          if (!nextVariants.length) {
            hasMore = false;
          } else {
            loadedVariants = [...loadedVariants, ...nextVariants];
            hasMore = loadedVariants.length < totalCount;
          }

          setPhotoVariationsState({
            assetId: activePhotoVariationsAssetId,
            variants: loadedVariants,
            totalCount,
            loadedCount: loadedVariants.length,
            isLoading: hasMore,
            hasMore,
            error: '',
          });
        }
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setPhotoVariationsState({
          assetId: activePhotoVariationsAssetId,
          variants: [],
          totalCount: 0,
          loadedCount: 0,
          isLoading: false,
          hasMore: false,
          error: requestError.message || 'Could not load photo variations.',
        });
      }
    }

    void loadPhotoVariationsInBatches();

    return () => {
      cancelled = true;
    };
  }, [activePhotoVariationsAssetId]);
  const selectedComps = useMemo(
    () => (latestPricing?.selectedComps || dashboard?.comps || []).slice(0, 8),
    [dashboard?.comps, latestPricing?.selectedComps],
  );
  const readinessScore = useMemo(
    () => latestReport?.payload?.readinessSummary?.overallScore || checklist?.summary?.progressPercent || 0,
    [checklist?.summary?.progressPercent, latestReport?.payload?.readinessSummary?.overallScore],
  );
  const readinessLabel = useMemo(() => {
    if (latestReport?.payload?.readinessSummary?.label) {
      return latestReport.payload.readinessSummary.label;
    }
    if (readinessScore >= 80) {
      return 'Listing Ready';
    }
    if (readinessScore >= 60) {
      return 'Almost Ready';
    }
    return 'Needs Work';
  }, [latestReport?.payload?.readinessSummary?.label, readinessScore]);
  const pricingQuickPickOptions = useMemo(
    () =>
      latestPricing
        ? [
            {
              key: 'recommended_low',
              label: 'Low',
              value: latestPricing.recommendedListLow,
            },
            {
              key: 'recommended_mid',
              label: 'Mid',
              value: latestPricing.recommendedListMid,
            },
            {
              key: 'recommended_high',
              label: 'High',
              value: latestPricing.recommendedListHigh,
            },
          ].filter((option) => Number(option.value) > 0)
        : [],
    [latestPricing],
  );
  const checklistGroups = useMemo(() => {
    const groups = new Map();
    for (const item of checklist?.items || []) {
      const groupKey = formatChecklistCategory(item.category);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    }
    return [...groups.entries()];
  }, [checklist?.items]);
  const completedChecklistItems = useMemo(
    () => (checklist?.items || []).filter((item) => item.status === 'done'),
    [checklist?.items],
  );
  const openChecklistItems = useMemo(
    () => (checklist?.items || []).filter((item) => item.status !== 'done'),
    [checklist?.items],
  );
  const providerSuggestionTask = useMemo(() => {
    const tasksWithProviders = (checklist?.items || []).filter((item) => item.providerCategoryKey);
    if (!tasksWithProviders.length) {
      return null;
    }

    if (activeProviderTaskKey) {
      const matchingTask = tasksWithProviders.find(
        (item) => item.id === activeProviderTaskKey || item.systemKey === activeProviderTaskKey,
      );
      if (matchingTask) {
        return matchingTask;
      }
    }

    return tasksWithProviders.find((item) => item.status !== 'done') || tasksWithProviders[0];
  }, [activeProviderTaskKey, checklist?.items]);
  const providerReferenceIds = useMemo(
    () => new Set(providerReferences.map((reference) => `${reference.source}:${reference.sourceRefId}`)),
    [providerReferences],
  );
  const providerGoogleSearchUrl = useMemo(() => {
    if (!providerSuggestionTask) {
      return '';
    }

    const query = buildProviderFallbackQuery(providerSuggestionTask, property);
    if (!query) {
      return '';
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }, [property, providerSuggestionTask]);
  const providerMapProviders = useMemo(() => {
    const internalProviders = (providerRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    const unavailableProviders = (unavailableProviderRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    const externalProviders = (externalProviderRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    return [...internalProviders, ...unavailableProviders, ...externalProviders];
  }, [
    externalProviderRecommendations,
    providerRecommendations,
    providerSource?.categoryLabel,
    unavailableProviderRecommendations,
  ]);
  const providerMapViewportProviders = useMemo(() => {
    if (providerMapScope === 'all' && providerMapProviders.length) {
      return providerMapProviders;
    }

    const internalAndSetupProviders = providerMapProviders.filter(
      (provider) => !provider.isExternalFallback,
    );
    if (internalAndSetupProviders.length) {
      return internalAndSetupProviders;
    }

    return providerMapProviders;
  }, [providerMapProviders, providerMapScope]);
  const providerMapResultLimit = providerMapDensity === 'expanded' ? 10 : 6;
  const providerMapDisplayedProviders = useMemo(
    () => providerMapViewportProviders.slice(0, providerMapResultLimit),
    [providerMapResultLimit, providerMapViewportProviders],
  );
  const hasInternalProviderResults =
    providerRecommendations.length > 0 || unavailableProviderRecommendations.length > 0;
  const providerMapInternalCount = providerMapViewportProviders.filter((provider) => !provider.isExternalFallback).length;
  const providerMapExternalCount = providerMapViewportProviders.filter((provider) => provider.isExternalFallback).length;
  const hiddenProviderMapCount = Math.max(0, providerMapViewportProviders.length - providerMapDisplayedProviders.length);
  const shouldShowExternalProviderSection =
    Boolean(externalProviderRecommendations.length) &&
    (showExternalProviderFallback || !hasInternalProviderResults);
  const providerCoverageGuidance = useMemo(
    () => buildProviderCoverageGuidance(providerSuggestionTask, providerSource),
    [providerSuggestionTask, providerSource],
  );

  useEffect(() => {
    if (hasInternalProviderResults) {
      setProviderMapScope('internal');
      return;
    }

    if (providerMapProviders.length) {
      setProviderMapScope('all');
    }
  }, [hasInternalProviderResults, providerMapProviders.length]);

  useEffect(() => {
    if (providerMapViewportProviders.length <= 6 && providerMapDensity !== 'compact') {
      setProviderMapDensity('compact');
    }
  }, [providerMapDensity, providerMapViewportProviders.length]);

  const recentOutputs = useMemo(
    () =>
      [
        latestFlyer
          ? { key: 'brochure', label: 'Flyer', title: latestFlyer.headline, detail: latestFlyer.summary, tab: 'brochure' }
          : null,
        latestReport
          ? { key: 'report', label: 'Report', title: latestReport.title, detail: latestReport.executiveSummary, tab: 'report' }
          : null,
      ].filter(Boolean),
    [latestFlyer, latestReport],
  );
  const nextBestAction = useMemo(() => {
    if (property?.status === 'archived') {
      return { title: 'Restore this property from the dashboard', detail: 'Archived properties stay viewable, but edits and new outputs are blocked until the property is restored.', tab: 'overview' };
    }
    if (!mediaAssets.length) {
      return { title: 'Review the photo set', detail: 'Use the Photos tab to work from the shared mobile gallery and start building listing picks.', tab: 'photos' };
    }
    if (!listingCandidateAssets.length) {
      return { title: 'Select listing photos', detail: 'Choose the strongest images so flyer and report output prioritize them automatically.', tab: 'photos' };
    }
    if (!selectedVariant && selectedMediaAsset) {
      return { title: 'Generate a vision variant', detail: 'Create an enhanced or decluttered version before final flyer and report generation.', tab: 'vision' };
    }
    if (!latestFlyer) {
      return { title: 'Generate the flyer', detail: 'Turn pricing and photo selection into a seller-facing flyer draft.', tab: 'brochure' };
    }
    if (!latestReport) {
      return { title: 'Generate the report', detail: 'Package pricing, photos, and checklist progress into a premium deliverable.', tab: 'report' };
    }
    if (checklist?.nextTask?.title) {
      return { title: checklist.nextTask.title, detail: checklist.nextTask.detail || 'Keep the checklist moving with the next prep step.', tab: 'checklist' };
    }
    return { title: 'Review the latest outputs', detail: 'Both flyer and report are ready. Use Overview to compare the latest deliverables.', tab: 'overview' };
  }, [checklist?.nextTask?.detail, checklist?.nextTask?.title, latestFlyer, latestReport, listingCandidateAssets.length, mediaAssets.length, property?.status, selectedMediaAsset, selectedVariant]);
  const workflowNextStep = guidedWorkflow?.nextStep || null;
  const homeAdvisorGuide = useMemo(() => {
    if (isHomeAdvisorGuideHidden) {
      return null;
    }

    if (!property?.id) {
      return {
        title: 'Home Advisor Agent',
        body: 'Start by creating a property so pricing, photos, and seller-facing materials have somewhere to live.',
        ctaLabel: 'Open Overview',
        ctaAction: () => setActiveTab('overview'),
        highlights: ['Property setup first', 'Everything else builds from there'],
      };
    }

    if (!latestPricing) {
      return {
        title: 'Home Advisor Agent',
        body: 'Run pricing first so flyer, report, and seller guidance all have a live comp-backed foundation.',
        ctaLabel: 'Open Pricing',
        ctaAction: () => setActiveTab('pricing'),
        highlights: ['Review comps', 'Confirm pricing direction'],
      };
    }

    if (!mediaAssets.length) {
      return {
        title: 'Home Advisor Agent',
        body: 'Bring in photos next. One strong room photo is enough to start the Vision workflow and seller picks.',
        ctaLabel: 'Open Photos',
        ctaAction: () => setActiveTab('photos'),
        highlights: ['Import photos', 'Start with strongest rooms'],
      };
    }

    if (!listingCandidateAssets.length) {
      return {
        title: 'Home Advisor Agent',
        body: 'Mark a few seller picks so the flyer and report use the right photos by default.',
        ctaLabel: 'Open Seller Picks',
        ctaAction: () => setActiveTab('seller_picks'),
        highlights: ['Choose strongest rooms', 'Keep the story focused'],
      };
    }

    if (!latestFlyer) {
      return {
        title: 'Home Advisor Agent',
        body: 'You have pricing and photo picks. The fastest next win is generating the flyer draft.',
        ctaLabel: 'Open Flyer',
        ctaAction: () => setActiveTab('brochure'),
        highlights: ['Generate flyer draft', 'Check headline and selected photos'],
      };
    }

    if (!latestReport) {
      return {
        title: 'Home Advisor Agent',
        body: 'With pricing and photos in place, create the report so the seller sees the full strategy and readiness story.',
        ctaLabel: 'Open Report',
        ctaAction: () => setActiveTab('report'),
        highlights: ['Package pricing and photos', 'Share a premium seller deliverable'],
      };
    }

    if (workflowNextStep) {
      return {
        title: 'Home Advisor Agent',
        body: workflowNextStep.description || 'Keep moving through the recommended workflow step.',
        ctaLabel: workflowNextStep.ctaLabel || 'Open next step',
        ctaAction: () => openWorkflowStep(workflowNextStep),
        highlights: [workflowNextStep.title, workflowNextStep.helperText].filter(Boolean),
      };
    }

    return {
      title: 'Home Advisor Agent',
      body: 'The essentials are in place. Use Seller Picks, Flyer, and Report to review the final presentation package.',
      ctaLabel: 'Open Seller Picks',
      ctaAction: () => setActiveTab('seller_picks'),
      highlights: ['Review deliverables', 'Fine-tune presentation'],
    };
  }, [
    isHomeAdvisorGuideHidden,
    listingCandidateAssets.length,
    latestFlyer,
    latestPricing,
    latestReport,
    mediaAssets.length,
    property?.id,
    workflowNextStep,
  ]);
  const workflowSteps = (guidedWorkflow?.steps || []).filter(
    (step) => !PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS.has(step.key),
  );
  const workflowPreviewStep =
    workflowSteps.find((step) => step.key === workflowPreviewStepKey) ||
    (workflowNextStep && !PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS.has(workflowNextStep.key)
      ? workflowNextStep
      : null) ||
    workflowSteps[0] ||
    null;

  const isArchivedProperty = property?.status === 'archived';

  function scrollWorkspaceBodyToTop() {
    if (!workspaceBodyMainRef.current || typeof window === 'undefined') {
      return;
    }

    const stickyOffset = 104;
    const top =
      workspaceBodyMainRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  function scrollWorkspaceSectionIntoView(targetRef) {
    if (!targetRef?.current || typeof window === 'undefined') {
      scrollWorkspaceBodyToTop();
      return;
    }

    const stickyOffset = 132;
    const top = targetRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  function openWorkflowStep(step) {
    if (!step || (!step.actionTarget && !step.actionHref)) {
      return;
    }

    if (step.actionHref) {
      setActiveTab('overview');
      setPendingWorkspaceScrollTarget('top');
      return;
    }

    if (step.actionTarget) {
      setActiveTab(step.actionTarget);
      setPendingWorkspaceScrollTarget('top');
    }
  }

  useEffect(() => {
    if (!propertyFullQuery.data) {
      return;
    }

    const snapshot = propertyFullQuery.data;
    const nextAssets = snapshot.mediaAssets || [];
    const nextPricing = snapshot.pricingAnalyses?.latest || null;
    const nextFlyer = snapshot.reports?.latestFlyer || null;
    const nextReport = snapshot.reports?.latestReport || null;
    const nextDashboard = buildDashboardFromSnapshot(snapshot);

    setProperty(snapshot.property || null);
    setDashboard(nextDashboard);
    setChecklist(snapshot.checklist || null);
    setLatestPricing(nextPricing);
    setLatestFlyer(nextFlyer);
    setLatestReport(nextReport);
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId((current) => {
      if (nextAssets.some((asset) => asset.id === current)) {
        return current;
      }
      return nextAssets[0]?.id || '';
    });
  }, [propertyFullQuery.data]);

  useEffect(() => {
    if (!activePhotoDetailsAsset?.id) {
      return;
    }

    const refreshedAsset =
      mediaAssets.find((asset) => asset.id === activePhotoDetailsAsset.id) || null;

    if (refreshedAsset) {
      setActivePhotoDetailsAsset(refreshedAsset);
      return;
    }

    setActivePhotoDetailsAsset(null);
  }, [activePhotoDetailsAsset?.id, mediaAssets]);

  useEffect(() => {
    if (!liveMediaVariantsQuery.data) {
      return;
    }

    const nextVariants = liveMediaVariantsQuery.data || [];
    setMediaVariants(nextVariants);
    setSelectedVariantId((current) => {
      return pickVisionWorkspaceVariantId(nextVariants, {
        currentVariantId: current,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      });
    });
  }, [activeVisionWorkflowStageKey, liveMediaVariantsQuery.data, workflowSourceVariantId]);

  useEffect(() => {
    if (!workflowQuery.data) {
      return;
    }

    setGuidedWorkflow(workflowQuery.data);
  }, [workflowQuery.data]);

  useEffect(() => {
    if (!workflowSteps.length) {
      setWorkflowPreviewStepKey('');
      return;
    }

    setWorkflowPreviewStepKey((current) => {
      if (current && workflowSteps.some((step) => step.key === current)) {
        return current;
      }

      return workflowNextStep?.key || workflowSteps[0]?.key || '';
    });
  }, [workflowNextStep?.key, workflowSteps]);

  useEffect(() => {
    if (!pendingWorkspaceScrollTarget) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pendingWorkspaceScrollTarget === 'flyer-preview') {
          scrollWorkspaceSectionIntoView(flyerPreviewRef);
        } else if (pendingWorkspaceScrollTarget === 'report-preview') {
          scrollWorkspaceSectionIntoView(reportPreviewRef);
        } else {
          scrollWorkspaceBodyToTop();
        }
        setPendingWorkspaceScrollTarget('');
      });
    });
  }, [activeTab, pendingWorkspaceScrollTarget]);

  useEffect(() => {
    if (activeTab !== 'checklist' || pendingChecklistFocusTarget !== 'providers') {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (providerSuggestionsRef.current) {
          const stickyOffset = 150;
          const top = providerSuggestionsRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;
          window.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth',
          });
        }
        setPendingChecklistFocusTarget('');
      });
    });
  }, [activeTab, activeProviderTaskKey, pendingChecklistFocusTarget]);

  useEffect(() => {
    if (property?.selectedListPrice) {
      setSelectedListPriceDraft(String(property.selectedListPrice));
      setSelectedListPriceSourceDraft(property.selectedListPriceSource || 'custom');
      return;
    }

    if (latestPricing?.recommendedListMid) {
      setSelectedListPriceDraft(String(latestPricing.recommendedListMid));
      setSelectedListPriceSourceDraft('recommended_mid');
      return;
    }

    setSelectedListPriceDraft('');
    setSelectedListPriceSourceDraft('recommended_mid');
  }, [
    property?.selectedListPrice,
    property?.selectedListPriceSource,
    latestPricing?.recommendedListMid,
  ]);

  useEffect(() => {
    const nextSession = { ...(getStoredSession() || {}), lastPropertyId: propertyId };
    setStoredSession(nextSession);
  }, [propertyId]);

  useEffect(() => {
    const nextPresetKey =
      selectedVariant?.metadata?.requestedPresetKey ||
      selectedVariant?.metadata?.presetKey ||
      selectedVariant?.variantType;
    if (nextPresetKey) {
      setActiveVisionPresetKey(nextPresetKey);
    }
  }, [selectedVariant?.metadata?.presetKey, selectedVariant?.metadata?.requestedPresetKey, selectedVariant?.variantType]);

  useEffect(() => {
    const nextPresetKey =
      selectedVariant?.metadata?.requestedPresetKey ||
      selectedVariant?.metadata?.presetKey ||
      selectedVariant?.variantType;
    if (!nextPresetKey) {
      return;
    }

    setActiveVisionWorkflowStageKey(getVisionWorkflowStageForPreset(nextPresetKey));
  }, [selectedVariant?.id]);

  useEffect(() => {
    const variants = latestSocialPack?.variants || [];
    if (!variants.length) {
      setActiveSocialPackVariantKey('');
      return;
    }

    setActiveSocialPackVariantKey((current) => {
      if (
        current &&
        variants.some((variant, index) => getSocialPackVariantKey(variant, index) === current)
      ) {
        return current;
      }
      return getSocialPackVariantKey(variants[0], 0);
    });
  }, [latestSocialPack]);

  useEffect(() => {
    setActiveTab('overview');
    setDocumentGenerationState(null);
  }, [propertyId]);

  useEffect(() => {
    setShowMoreVisionVariants(false);
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    if (!pendingDeleteAsset) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setPendingDeleteAsset(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDeleteAsset]);

  useEffect(() => {
    const fallbackPhotoIds = brochurePhotoPool.slice(0, 4).map((asset) => asset.id);
    const flyerCustomizations =
      latestFlyer?.flyerType === flyerType ? latestFlyer.customizations || {} : {};
    setFlyerHeadlineDraft(flyerCustomizations.headline || (latestFlyer?.flyerType === flyerType ? latestFlyer.headline || '' : property?.title || ''));
    setFlyerSubheadlineDraft(
      flyerCustomizations.subheadline ||
        (latestFlyer?.flyerType === flyerType ? latestFlyer.subheadline || '' : ''),
    );
    setFlyerSummaryDraft(
      flyerCustomizations.summary ||
        (latestFlyer?.flyerType === flyerType
          ? latestFlyer.summary || ''
          : latestReport?.payload?.marketingGuidance?.shortDescription || ''),
    );
    setFlyerCallToActionDraft(
      flyerCustomizations.callToAction ||
        (latestFlyer?.flyerType === flyerType ? latestFlyer.callToAction || '' : ''),
    );
    setFlyerSelectedPhotoIds(
      flyerCustomizations.selectedPhotoAssetIds?.length
        ? flyerCustomizations.selectedPhotoAssetIds
        : latestFlyer?.flyerType === flyerType && latestFlyer?.selectedPhotos?.length
          ? latestFlyer.selectedPhotos.map((photo) => photo.assetId).filter(Boolean)
          : fallbackPhotoIds,
    );
  }, [
    brochurePhotoPool,
    flyerType,
    latestFlyer,
    latestReport?.payload?.marketingGuidance?.shortDescription,
    property?.title,
  ]);

  useEffect(() => {
    const reportCustomizations = latestReport?.customizations || {};
    setReportTitleDraft(reportCustomizations.title || latestReport?.title || `${property?.title || 'Property'} Seller Intelligence Report`);
    setReportExecutiveSummaryDraft(
      reportCustomizations.executiveSummary || latestReport?.executiveSummary || '',
    );
    setReportListingDescriptionDraft(
      reportCustomizations.listingDescription ||
        latestReport?.payload?.listingDescriptions?.shortDescription ||
        '',
    );
    setReportSelectedPhotoIds(
      reportCustomizations.selectedPhotoAssetIds?.length
        ? reportCustomizations.selectedPhotoAssetIds
        : latestReport?.selectedPhotos?.length
          ? latestReport.selectedPhotos.map((photo) => photo.assetId).filter(Boolean)
          : reportPhotoPool.slice(0, 4).map((asset) => asset.id),
    );
    setReportIncludedSections(
      reportCustomizations.includedSections?.length
        ? reportCustomizations.includedSections
        : REPORT_SECTION_OPTIONS.map((section) => section.id),
    );
  }, [
    latestReport,
    property?.title,
    reportPhotoPool,
  ]);

  useEffect(() => {
    setFlyerCopySuggestions([]);
    setFlyerCopySuggestionSource('');
  }, [propertyId, flyerType]);

  function applyPropertySnapshot(snapshot, preferredAssetId = selectedMediaAssetId) {
    const nextAssets = snapshot?.mediaAssets || [];
    const nextPricing = snapshot?.pricingAnalyses?.latest || null;
    const nextFlyer = snapshot?.reports?.latestFlyer || null;
    const nextReport = snapshot?.reports?.latestReport || null;
    const nextChecklist = snapshot?.checklist || null;
    const nextProperty = snapshot?.property || null;
    const nextDashboard = buildDashboardFromSnapshot(snapshot);

    queryClient.setQueryData(['property-full', propertyId], snapshot);
    setProperty(nextProperty);
    setDashboard(nextDashboard);
    setChecklist(nextChecklist);
    setLatestPricing(nextPricing);
    setLatestFlyer(nextFlyer);
    setLatestReport(nextReport);
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId(() => {
      if (preferredAssetId && nextAssets.some((asset) => asset.id === preferredAssetId)) {
        return preferredAssetId;
      }
      return nextAssets[0]?.id || '';
    });

    return {
      dashboard: nextDashboard,
      checklist: nextChecklist,
      mediaAssets: nextAssets,
      property: nextProperty,
      latestPricing: nextPricing,
      latestFlyer: nextFlyer,
      latestReport: nextReport,
    };
  }

  async function refreshPropertySnapshot(preferredAssetId = selectedMediaAssetId) {
    if (propertySnapshotRefreshPromiseRef.current) {
      return propertySnapshotRefreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const snapshot = await getPropertyFull(propertyId);
      return applyPropertySnapshot(snapshot, preferredAssetId);
    })();

    propertySnapshotRefreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      propertySnapshotRefreshPromiseRef.current = null;
    }
  }

  async function refreshMediaAssets(preferredAssetId = selectedMediaAssetId) {
    const snapshot = await refreshPropertySnapshot(preferredAssetId);
    return snapshot.mediaAssets;
  }

  async function refreshMediaVariants(assetId = selectedMediaAssetId) {
    if (!assetId) {
      queryClient.setQueryData(['property-media-variants', ''], []);
      setMediaVariants([]);
      setSelectedVariantId('');
      return [];
    }
    const variantsResponse = await listMediaVariants(assetId);
    const nextVariants = variantsResponse.variants || [];
    queryClient.setQueryData(['property-media-variants', assetId], nextVariants);
    setMediaVariants(nextVariants);
    setSelectedVariantId((current) =>
      pickVisionWorkspaceVariantId(nextVariants, {
        currentVariantId: current,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      }),
    );
    return nextVariants;
  }

  async function refreshDashboardSnapshot() {
    const snapshot = await refreshPropertySnapshot(selectedMediaAssetId);
    return snapshot.dashboard;
  }

  async function refreshChecklist() {
    const snapshot = await refreshPropertySnapshot(selectedMediaAssetId);
    return snapshot.checklist;
  }

  async function refreshWorkflow() {
    const response = await getWorkflow(propertyId, viewerRole);
    queryClient.setQueryData(['property-workflow', propertyId, viewerRole], response.workflow);
    setGuidedWorkflow(response.workflow);
    return response.workflow;
  }

  async function refreshSocialPack() {
    try {
      const response = await getLatestSocialPack(propertyId);
      setLatestSocialPack(response.socialPack || null);
      return response.socialPack || null;
    } catch {
      setLatestSocialPack(null);
      return null;
    }
  }

  async function handleBrowseGoogleFallback() {
    try {
      setProviderSearchStatus('Searching Google fallback providers...');
      const response = await listProviders(propertyId, {
        taskKey: providerSuggestionTask?.systemKey || providerSuggestionTask?.id,
        limit: 5,
        includeExternal: true,
      });
      const results = response.providers?.externalItems || [];
      const fallbackDiagnostic = response.providers?.source?.googleFallbackDiagnostic || '';
      setUnavailableProviderRecommendations(response.providers?.unavailableItems || []);
      setExternalProviderRecommendations(results);
      setShowExternalProviderFallback(true);
      setProviderSource((current) =>
        ({
          ...(current || {}),
          ...(response.providers?.source || {}),
          externalProviders: results.length,
        })
      );
      if (results.length) {
        setShowProviderMap(true);
      }
      if (!results.length) {
        setToast({
          tone: fallbackDiagnostic ? 'error' : 'info',
          title: fallbackDiagnostic ? 'Could not load Google fallback' : 'No Google fallback results',
          message:
            fallbackDiagnostic ||
            'Google did not return structured fallback results for this category near the property. You can still open the live Google Maps search below.',
        });
      }
      return results;
    } catch (error) {
      setShowExternalProviderFallback(true);
      setExternalProviderRecommendations([]);
      setToast({
        tone: 'error',
        title: 'Could not load Google fallback',
        message: error.message || 'Google fallback search could not be completed.',
      });
      return [];
    } finally {
      setProviderSearchStatus('');
    }
  }

  async function refreshProviders(task = providerSuggestionTask) {
    if (!task?.providerCategoryKey) {
      setProviderRecommendations([]);
      setUnavailableProviderRecommendations([]);
      setExternalProviderRecommendations([]);
      setProviderSource(null);
      return [];
    }

    const response = await listProviders(propertyId, {
      taskKey: task.systemKey || task.id,
      limit: 4,
    });
    const nextProviders = response.providers?.items || [];
    const nextUnavailableProviders = response.providers?.unavailableItems || [];
    const externalResultsFromApi = response.providers?.externalItems || [];
    setProviderRecommendations(nextProviders);
    setUnavailableProviderRecommendations(nextUnavailableProviders);
    setExternalProviderRecommendations(externalResultsFromApi);
    setShowExternalProviderFallback(Boolean(externalResultsFromApi.length && !nextProviders.length));
    setProviderSource({
      ...(response.providers?.source || {}),
      externalProviders: externalResultsFromApi.length,
    });
    return nextProviders;
  }

  function focusProviderSuggestions(taskKey = '') {
    if (taskKey) {
      setActiveProviderTaskKey(taskKey);
    }
    setActiveTab('checklist');
    setPendingChecklistFocusTarget('providers');
  }

  async function refreshProviderLeads() {
    const response = await listProviderLeads(propertyId);
    const nextLeads = response.leads?.items || [];
    setProviderLeads(nextLeads);
    return nextLeads;
  }

  async function refreshProviderReferences() {
    const response = await listProviderReferences(propertyId);
    const nextReferences = response.references?.items || [];
    setProviderReferences(nextReferences);
    return nextReferences;
  }

  useEffect(() => {
    refreshMediaVariants(selectedMediaAsset?.id).catch(() => {
      setMediaVariants([]);
      setSelectedVariantId('');
    });
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    if (!activeProviderTaskKey && providerSuggestionTask?.id) {
      setActiveProviderTaskKey(providerSuggestionTask.id);
    }
  }, [activeProviderTaskKey, providerSuggestionTask?.id]);

  useEffect(() => {
    refreshProviders(providerSuggestionTask).catch(() => {
      setProviderRecommendations([]);
      setUnavailableProviderRecommendations([]);
      setExternalProviderRecommendations([]);
      setProviderSource(null);
      setProviderSearchStatus('');
    });
  }, [propertyId, providerSuggestionTask?.id, providerSuggestionTask?.providerCategoryKey]);

  useEffect(() => {
    refreshProviderLeads().catch(() => {
      setProviderLeads([]);
    });
  }, [propertyId]);

  useEffect(() => {
    refreshProviderReferences().catch(() => {
      setProviderReferences([]);
    });
  }, [propertyId]);

  useEffect(() => {
    async function loadWorkspace() {
      setStatus('Loading property workspace...');
      setToast(null);
      try {
        const [snapshotResponse, presetsResponse] = await Promise.all([
          getPropertyFull(propertyId),
          listVisionPresets(),
        ]);
        applyPropertySnapshot(snapshotResponse);
        setVisionPresets(presetsResponse.presets || []);
        await refreshSocialPack();
        try {
          await refreshProviderLeads();
        } catch {
          setProviderLeads([]);
        }
      } catch (requestError) {
        try {
          setVisionPresets([]);
        } catch {}
        setToast({ tone: 'error', title: 'Could not load property', message: requestError.message });
      } finally {
        setStatus('');
      }
    }
    loadWorkspace();
  }, [propertyId]);

  function blockArchivedMutation() {
    if (!isArchivedProperty) {
      return false;
    }

    setToast({
      tone: 'error',
      title: 'Property is archived',
      message: 'Restore this property from the dashboard before making new changes.',
    });
    return true;
  }

  function blockVisionAccessIfUnavailable() {
    if (canAccessVisionWorkspace) {
      return false;
    }

    if (billingSummaryQuery.isLoading && !billingAccess?.planKey) {
      setToast({
        tone: 'info',
        title: 'Checking Vision access',
        message:
          'We are still loading your plan details. Try Vision again in a moment.',
        autoDismissMs: 5000,
      });
      return true;
    }

    setToast({
      tone: 'warning',
      title: 'Upgrade required for Vision',
      message:
        'Photo import and starter pricing are available now. Upgrade to unlock Vision enhancements and advanced photo-variation workflows.',
      actionLabel: 'View upgrade options',
      onAction: () =>
        router.push(
          `/dashboard?upgrade=${encodeURIComponent(recommendedVisionUpgradePlanKey)}`,
        ),
      autoDismissMs: 0,
    });
    return true;
  }

  async function handleAnalyzePricing() {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus('Refreshing RentCast + AI pricing analysis...');
    setToast(null);
    try {
      const analysisResponse = await analyzePricing(propertyId);
      const [dashboardResponse, checklistResponse] = await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      setLatestPricing(analysisResponse.analysis);
      setDashboard(dashboardResponse);
      setChecklist(checklistResponse);
      const pricingMetadata = analysisResponse.metadata || {};
      const pricingPolicy = pricingMetadata.policy || {};
      if (pricingMetadata.servedFromCache && pricingMetadata.cacheReason === 'COOLDOWN_ACTIVE') {
        setToast({
          tone: 'info',
          title: 'Recent comps already available',
          message: pricingMetadata.cachedAt
            ? `Last live comps were run ${formatDateTimeLabel(pricingMetadata.cachedAt)}. Showing the saved analysis because the ${pricingPolicy.pricingCooldownHours || 24}-hour cooldown is still active.`
            : `Showing the saved analysis because the ${pricingPolicy.pricingCooldownHours || 24}-hour cooldown is still active.`,
        });
      } else if (
        pricingMetadata.servedFromCache &&
        pricingMetadata.cacheReason === 'PROPERTY_QUERY_LIMIT_REACHED'
      ) {
        setToast({
          tone: 'warning',
          title: 'Pricing query limit reached',
          message: pricingMetadata.cachedAt
            ? `This property has already used ${pricingPolicy.runsUsedForProperty || 0} live RentCast pricing runs. Showing the latest saved analysis from ${formatDateTimeLabel(pricingMetadata.cachedAt)}.`
            : `This property has already used ${pricingPolicy.runsUsedForProperty || 0} live RentCast pricing runs, so the latest saved analysis is being shown instead.`,
        });
      } else {
        setToast({ tone: 'success', title: 'Pricing refreshed', message: 'The latest analysis and comp set are ready.' });
      }
    } catch (requestError) {
      if (requestError.status === 402) {
        const suggestedPlan = requestError.details?.suggestedPlan || '';
        const starterPricingUsed = requestError.details?.reason === 'FREE_PRICING_STARTER_USED';
        const upgradeMessage = starterPricingUsed
          ? 'Free access includes one starter pricing analysis. Upgrade to run additional live pricing refreshes and unlock the full listing workflow.'
          : requestError.message;

        if (suggestedPlan) {
          const session = getStoredSession();
          if (session?.user?.id) {
            setStatus('Opening Stripe checkout...');
            try {
              const checkout = await createBillingCheckoutSession(
                { userId: session.user.id, planKey: suggestedPlan },
                session.user.id,
              );
              if (checkout.url) {
                window.location.href = checkout.url;
                return;
              }
            } catch (checkoutError) {
              setToast({
                tone: 'warning',
                title: 'Upgrade required',
                message: `${upgradeMessage} ${checkoutError.message}`,
                actionLabel: 'Open upgrade options',
                onAction: () =>
                  router.push(`/dashboard?upgrade=${encodeURIComponent(suggestedPlan)}`),
                autoDismissMs: 0,
              });
              setStatus('');
              return;
            }
          }
        }

        setToast({
          tone: 'warning',
          title: 'Upgrade required',
          message: upgradeMessage,
          actionLabel: 'Open upgrade options',
          onAction: () =>
            router.push(
              suggestedPlan
                ? `/dashboard?upgrade=${encodeURIComponent(suggestedPlan)}`
                : '/dashboard',
            ),
          autoDismissMs: 0,
        });
        return;
      }

      setToast({ tone: 'error', title: 'Pricing refresh failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveSelectedListPrice() {
    if (blockArchivedMutation()) {
      return;
    }

    const session = getStoredSession();
    if (!session?.user?.id) {
      setToast({
        tone: 'error',
        title: 'Sign in required',
        message: 'Sign in again before saving a selected list price.',
      });
      return;
    }

    const parsedPrice = Number(selectedListPriceDraft);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setToast({
        tone: 'error',
        title: 'Enter a valid price',
        message: 'Choose one of the suggested prices or enter a custom list price.',
      });
      return;
    }

    setStatus('Saving selected list price...');
    setToast(null);
    try {
      const response = await setPropertyPricingDecision(
        propertyId,
        {
          selectedListPrice: Math.round(parsedPrice),
          selectedListPriceSource: selectedListPriceSourceDraft || 'custom',
        },
        session.user.id,
      );
      setProperty(response.property);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setToast({
        tone: 'success',
        title: 'List price saved',
        message: 'Your chosen list price will be used the next time you generate flyer and report materials.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save list price',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleSuggestFlyerCopy() {
    if (blockArchivedMutation()) {
      return;
    }

    setIsSuggestingFlyerCopy(true);
    setToast(null);
    try {
      const response = await suggestFlyerCopy(propertyId, {
        flyerType,
        headline: flyerHeadlineDraft,
        count: 3,
      });
      const suggestions = Array.isArray(response?.suggestions)
        ? response.suggestions
            .filter((option) => option?.subheadline && option?.summary)
            .slice(0, 3)
            .map((option, index) => ({
              id: option.id || `suggestion-${index + 1}`,
              subheadline: String(option.subheadline || '').trim(),
              summary: String(option.summary || '').trim(),
            }))
        : [];

      if (!suggestions.length) {
        throw new Error('No copy suggestions were generated.');
      }

      setFlyerCopySuggestions(suggestions);
      setFlyerCopySuggestionSource(response?.source || '');
      setToast({
        tone: 'success',
        title: 'Copy ideas ready',
        message:
          'Select a suggestion to populate the subheadline and summary fields.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not generate copy ideas',
        message: requestError.message,
      });
    } finally {
      setIsSuggestingFlyerCopy(false);
    }
  }

  function handleUseFlyerCopySuggestion(suggestion) {
    if (!suggestion) {
      return;
    }

    setFlyerSubheadlineDraft(String(suggestion.subheadline || '').trim());
    setFlyerSummaryDraft(String(suggestion.summary || '').trim());
    setToast({
      tone: 'success',
      title: 'Suggestion applied',
      message: 'You can edit the suggested copy before generating the flyer.',
    });
  }

  async function handleGenerateFlyer() {
    if (blockArchivedMutation()) {
      return;
    }
    beginDocumentGeneration('flyer', 'Preparing flyer generation...');
    setStatus(`Generating ${flyerType} flyer...`);
    setToast({
      tone: 'info',
      title: 'Flyer generation started',
      message: 'We are preparing your flyer now. This can take a little time.',
    });
    setGenerationPrompt(null);
    try {
      const isFreeTeaserAccess = billingAccess?.planKey === 'free';
      const response = await generateFlyer(propertyId, flyerType, {
        headline: flyerHeadlineDraft,
        subheadline: flyerSubheadlineDraft,
        summary: flyerSummaryDraft,
        callToAction: flyerCallToActionDraft,
        selectedPhotoAssetIds: flyerSelectedPhotoIds,
      });

      if (response.flyer) {
        setLatestFlyer(response.flyer);
        await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
        clearDocumentGeneration('flyer');
        setToast({
          tone: isFreeTeaserAccess ? 'warning' : 'success',
          title: isFreeTeaserAccess ? 'Teaser flyer ready' : 'Flyer generated',
          message: isFreeTeaserAccess
            ? 'Your teaser flyer is ready using the uploaded photos. Upgrade to unlock Vision-enhanced photo selection and additional flyer attempts.'
            : 'The flyer is ready. You can review it here or download the latest saved flyer PDF now.',
          autoDismissMs: isFreeTeaserAccess ? 0 : undefined,
        });
        openGenerationPrompt('flyer');
        return;
      }

      if (!response.job?.id) {
        throw new Error('Flyer generation did not return a result or a background job.');
      }

      setStatus('Generating flyer in the background...');
      updateDocumentGeneration('flyer', response.job, 0);
      const settledJob = await pollAsyncDocumentJobUntilSettled(response.job.id, {
        onProgress: ({ job, elapsedMs }) => {
          updateDocumentGeneration('flyer', job, elapsedMs);
        },
      });
      if (settledJob.status !== 'completed') {
        throw new Error(
          settledJob.warning ||
            settledJob.message ||
            'The flyer job did not complete successfully.',
        );
      }

      const latestFlyerResponse = await getLatestFlyer(propertyId);
      setLatestFlyer(latestFlyerResponse.flyer || settledJob.result?.flyer || null);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      clearDocumentGeneration('flyer');
      setToast({
        tone: isFreeTeaserAccess ? 'warning' : 'success',
        title: isFreeTeaserAccess ? 'Teaser flyer ready' : 'Flyer generated',
        message: isFreeTeaserAccess
          ? 'Your teaser flyer is ready using the uploaded photos. Upgrade to unlock Vision-enhanced photo selection and additional flyer attempts.'
          : 'The flyer is ready. You can review it here or download the latest saved flyer PDF now.',
        autoDismissMs: isFreeTeaserAccess ? 0 : undefined,
      });
      openGenerationPrompt('flyer');
    } catch (requestError) {
      clearDocumentGeneration('flyer');
      if (requestError.status === 402) {
        const isTeaserLimitReason =
          requestError.details?.reason === 'FREE_FLYER_TEASER_USED';
        const suggestedPlan = requestError.details?.suggestedPlan || '';
        setToast({
          tone: 'warning',
          title: isTeaserLimitReason
            ? 'Free teaser flyer already used'
            : 'Upgrade required for flyer generation',
          message: isTeaserLimitReason
            ? 'Your free teaser flyer is ready with your uploaded photos. Upgrade to unlock Vision-enhanced selections and additional flyer attempts.'
            : requestError.message,
          actionLabel: suggestedPlan ? 'View upgrade options' : '',
          onAction: suggestedPlan
            ? () =>
                router.push(
                  `/dashboard?upgrade=${encodeURIComponent(suggestedPlan)}`,
                )
            : null,
          autoDismissMs: 0,
        });
        return;
      }
      setToast({ tone: 'error', title: 'Flyer generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateReport() {
    if (blockArchivedMutation()) {
      return;
    }
    beginDocumentGeneration('report', 'Preparing seller report generation...');
    setStatus('Generating seller intelligence report...');
    setToast({
      tone: 'info',
      title: 'Report generation started',
      message: 'We are preparing your seller report now. This can take a little time.',
    });
    setGenerationPrompt(null);
    try {
      const isFreeTeaserAccess = billingAccess?.planKey === 'free';
      const response = await generateReport(propertyId, {
        title: reportTitleDraft,
        executiveSummary: reportExecutiveSummaryDraft,
        listingDescription: reportListingDescriptionDraft,
        selectedPhotoAssetIds: reportSelectedPhotoIds,
        includedSections: reportIncludedSections,
      });

      if (response.report) {
        setLatestReport(response.report);
        await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
        clearDocumentGeneration('report');
        setToast({
          tone: isFreeTeaserAccess ? 'warning' : 'success',
          title: isFreeTeaserAccess ? 'Teaser report ready' : 'Report generated',
          message: isFreeTeaserAccess
            ? 'Your teaser seller report is ready using the uploaded photos. Upgrade to unlock Vision-enhanced photo selection and additional report attempts.'
            : 'The seller intelligence report is ready. You can review it here or download the latest saved report PDF now.',
          autoDismissMs: isFreeTeaserAccess ? 0 : undefined,
        });
        openGenerationPrompt('report');
        return;
      }

      if (!response.job?.id) {
        throw new Error('Report generation did not return a result or a background job.');
      }

      setStatus('Generating seller intelligence report in the background...');
      updateDocumentGeneration('report', response.job, 0);
      const settledJob = await pollAsyncDocumentJobUntilSettled(response.job.id, {
        onProgress: ({ job, elapsedMs }) => {
          updateDocumentGeneration('report', job, elapsedMs);
        },
      });
      if (settledJob.status !== 'completed') {
        throw new Error(
          settledJob.warning ||
            settledJob.message ||
            'The report job did not complete successfully.',
        );
      }

      const latestReportResponse = await getLatestReport(propertyId);
      setLatestReport(latestReportResponse.report || settledJob.result?.report || null);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      clearDocumentGeneration('report');
      setToast({
        tone: isFreeTeaserAccess ? 'warning' : 'success',
        title: isFreeTeaserAccess ? 'Teaser report ready' : 'Report generated',
        message: isFreeTeaserAccess
          ? 'Your teaser seller report is ready using the uploaded photos. Upgrade to unlock Vision-enhanced photo selection and additional report attempts.'
          : 'The seller intelligence report is ready. You can review it here or download the latest saved report PDF now.',
        autoDismissMs: isFreeTeaserAccess ? 0 : undefined,
      });
      openGenerationPrompt('report');
    } catch (requestError) {
      clearDocumentGeneration('report');
      if (requestError.status === 402) {
        const isTeaserLimitReason =
          requestError.details?.reason === 'FREE_REPORT_TEASER_USED';
        const suggestedPlan = requestError.details?.suggestedPlan || '';
        setToast({
          tone: 'warning',
          title: isTeaserLimitReason
            ? 'Free teaser report already used'
            : 'Upgrade required for report generation',
          message: isTeaserLimitReason
            ? 'Your free teaser seller report is ready with your uploaded photos. Upgrade to unlock Vision-enhanced selections and additional report attempts.'
            : requestError.message,
          actionLabel: suggestedPlan ? 'View upgrade options' : '',
          onAction: suggestedPlan
            ? () =>
                router.push(
                  `/dashboard?upgrade=${encodeURIComponent(suggestedPlan)}`,
                )
            : null,
          autoDismissMs: 0,
        });
        return;
      }
      setToast({ tone: 'error', title: 'Report generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleToggleListingCandidateForAsset(asset, explicitValue) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!asset) {
      return;
    }
    const nextValue =
      typeof explicitValue === 'boolean' ? explicitValue : !Boolean(asset.listingCandidate);
    const previousValue = Boolean(asset.listingCandidate);
    setStatus(nextValue ? 'Marking photo as listing candidate...' : 'Removing listing-candidate mark...');
    setToast(null);
    try {
      setMediaAssets((current) =>
        current.map((currentAsset) =>
          currentAsset.id === asset.id
            ? { ...currentAsset, listingCandidate: nextValue }
            : currentAsset,
        ),
      );
      setActivePhotoDetailsAsset((current) =>
        current?.id === asset.id ? { ...current, listingCandidate: nextValue } : current,
      );
      await updateMediaAsset(asset.id, { listingCandidate: nextValue });
      await Promise.all([
        refreshMediaAssets(asset.id),
        refreshDashboardSnapshot(),
        refreshChecklist(),
        refreshWorkflow(),
      ]);
      setToast({
        tone: 'success',
        title: nextValue ? 'Listing candidate selected' : 'Listing candidate removed',
        message: nextValue
          ? 'This photo will now be prioritized for flyer generation.'
          : 'This photo will no longer be prioritized for the flyer.',
      });
    } catch (requestError) {
      setMediaAssets((current) =>
        current.map((currentAsset) =>
          currentAsset.id === asset.id
            ? { ...currentAsset, listingCandidate: previousValue }
            : currentAsset,
        ),
      );
      setActivePhotoDetailsAsset((current) =>
        current?.id === asset.id ? { ...current, listingCandidate: previousValue } : current,
      );
      setToast({ tone: 'error', title: 'Could not update photo', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  function handleOpenAssetInVision(asset, nextStageKey = '') {
    if (!asset) {
      return;
    }
    if (blockVisionAccessIfUnavailable()) {
      return;
    }

    const resolvedStageKey = nextStageKey || getDefaultVisionStageForAsset(asset);
    if (asset.id !== selectedMediaAssetId) {
      setMediaVariants([]);
    }
    setSelectedMediaAssetId(asset.id);
    setSelectedVariantId('');
    setWorkflowSourceVariantId('');
    setActiveTab('vision');
    setActiveVisionWorkflowStageKey(resolvedStageKey);
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(resolvedStageKey));
    setShowVisionPhotoPicker(false);
    setShowVisionHistory(false);
    setPendingWorkspaceScrollTarget('vision-top');
  }

  function handleOpenPhotoVariations(asset) {
    if (!asset) {
      return;
    }

    setActivePhotoVariationsAssetId(asset.id);
    setIsSelectingPhotoVariations(false);
    setSelectedPhotoVariationIds([]);
    setPendingDeletePhotoVariationIds([]);
    setActivePhotoDetailsAsset(null);
    setToast(null);
  }

  function handleUseVariantAsVisionBaseline(asset, variant) {
    if (!asset || !variant) {
      return;
    }
    if (blockVisionAccessIfUnavailable()) {
      return;
    }

    const sourceStageKey = getVisionWorkflowStageKeyForVariant(variant);
    const nextStageKey = getNextVisionWorkflowStageKey(sourceStageKey);

    setSelectedMediaAssetId(asset.id);
    setSelectedVariantId(variant.id);
    setWorkflowSourceVariantId(variant.id);
    setActiveTab('vision');
    setActiveVisionWorkflowStageKey(nextStageKey);
    if (nextStageKey !== 'final') {
      setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    }
    setShowVisionPhotoPicker(false);
    setShowVisionHistory(false);
    setShowMoreVisionVariants(false);
    setActivePhotoVariationsAssetId('');
    setPendingWorkspaceScrollTarget('vision-top');
    setToast({
      tone: 'success',
      title: 'Vision baseline updated',
      message:
        nextStageKey === 'final'
          ? `${variant.label || 'This variation'} is now the final review source in Vision.`
          : `${variant.label || 'This variation'} is now the source for ${getVisionWorkflowStage(nextStageKey).title.toLowerCase()}.`,
    });
  }

  function renderCollapsibleSection({
    sectionKey,
    label,
    title,
    meta = '',
    defaultOpen = true,
    className = 'content-card',
    children,
  }) {
    const isOpen = isWorkspaceSectionOpen(sectionKey, defaultOpen);
    return (
      <section
        className={`${className} workspace-collapsible-section${isOpen ? ' open' : ' collapsed'}`}
      >
        <button
          type="button"
          className="workspace-collapsible-section-toggle"
          onClick={() =>
            setWorkspaceSectionOpen(sectionKey, (current) => !current, defaultOpen)
          }
          aria-expanded={isOpen}
        >
          <div>
            {label ? <span className="label">{label}</span> : null}
            <h2>{title}</h2>
          </div>
          <div className="workspace-collapsible-section-meta">
            {meta ? <span>{meta}</span> : null}
            <strong>{isOpen ? 'Hide' : 'Show'}</strong>
          </div>
        </button>
        {isOpen ? <div className="workspace-collapsible-section-body">{children}</div> : null}
      </section>
    );
  }

  function getWorkspaceTabLabel(tabId) {
    return [...WORKSPACE_TABS, ...HIDDEN_WORKSPACE_TABS].find((tab) => tab.id === tabId)?.label || 'Workspace';
  }

  function closePhotoVariationsModal() {
    setActivePhotoVariationsAssetId('');
    setIsSelectingPhotoVariations(false);
    setSelectedPhotoVariationIds([]);
    setPendingDeletePhotoVariationIds([]);
  }

  function togglePhotoVariationSelection(variantId) {
    setSelectedPhotoVariationIds((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  }

  function applyDeletedVariantToPhotoVariationsState(assetId, variantId) {
    if (
      String(activePhotoVariationsAssetId || '') !== String(assetId || '') ||
      String(photoVariationsState.assetId || '') !== String(assetId || '')
    ) {
      return;
    }

    setPhotoVariationsState((current) => {
      const nextVariants = current.variants.filter(
        (variant) => String(variant.id || '') !== String(variantId || ''),
      );
      const deletedFromLoadedCount =
        nextVariants.length === current.variants.length ? 0 : 1;
      const nextLoadedCount = Math.max(0, current.loadedCount - deletedFromLoadedCount);
      const nextTotalCount = Math.max(0, current.totalCount - deletedFromLoadedCount);

      return {
        ...current,
        variants: nextVariants,
        loadedCount: nextLoadedCount,
        totalCount: nextTotalCount,
        hasMore: nextLoadedCount < nextTotalCount,
      };
    });
  }

  async function deleteVisionVariantByDescriptor(
    variantToDelete,
    { showSuccessToast = true, refreshAfterDelete = true } = {},
  ) {
    const selectedAssetId = String(selectedMediaAsset?.id || '');
    const assetIdForDelete = String(variantToDelete?.assetId || variantToDelete?.mediaId || selectedAssetId);
    if (!variantToDelete?.id || !assetIdForDelete) {
      throw new Error('The source photo for this attempt could not be determined.');
    }

    const deletingCurrentWorkspaceVariant =
      Boolean(selectedAssetId) && assetIdForDelete === selectedAssetId;
    const optimisticNextVariants = mediaVariants.filter(
      (variant) => variant.id !== variantToDelete.id,
    );
    const replacementStageVariant =
      optimisticNextVariants.find(
        (candidate) =>
          getVisionWorkflowStageKeyForVariant(candidate) === activeVisionWorkflowStageKey,
      ) || optimisticNextVariants[0];
    const nextWorkflowSourceVariantId =
      deletingCurrentWorkspaceVariant && workflowSourceVariantId === variantToDelete.id
        ? replacementStageVariant?.id || ''
        : workflowSourceVariantId;
    const nextLatestGeneratedVariantId =
      deletingCurrentWorkspaceVariant && latestGeneratedVariantId === variantToDelete.id
        ? ''
        : latestGeneratedVariantId;
    const nextSelectedVariantId =
      deletingCurrentWorkspaceVariant && selectedVariantId === variantToDelete.id
        ? replacementStageVariant?.id || ''
        : selectedVariantId;

    await deleteMediaVariantRequest(assetIdForDelete, variantToDelete.id);

    if (deletingCurrentWorkspaceVariant) {
      queryClient.setQueryData(
        ['property-media-variants', selectedAssetId],
        optimisticNextVariants,
      );
      setMediaVariants(optimisticNextVariants);
      setWorkflowSourceVariantId(nextWorkflowSourceVariantId);
      setLatestGeneratedVariantId(nextLatestGeneratedVariantId);
      setSelectedVariantId(nextSelectedVariantId);

      if (!optimisticNextVariants.length) {
        setShowVisionHistory(false);
        setShowMoreVisionVariants(false);
      }
    }

    applyDeletedVariantToPhotoVariationsState(assetIdForDelete, variantToDelete.id);
    setSelectedPhotoVariationIds((current) =>
      current.filter((id) => String(id) !== String(variantToDelete.id)),
    );

    if (deletingCurrentWorkspaceVariant && selectedVariantId === variantToDelete.id) {
      requestAnimationFrame(() => {
        scrollWorkspaceSectionIntoView(visionCompareRef);
      });
    }

    if (showSuccessToast) {
      setToast({
        tone: 'success',
        title: 'Vision attempt deleted',
        message: `"${variantToDelete.label || 'Selected attempt'}" was removed permanently from this photo's Vision history.`,
      });
    }

    if (refreshAfterDelete) {
      void Promise.all([
        refreshMediaVariants(assetIdForDelete),
        refreshMediaAssets(assetIdForDelete),
        refreshWorkflow(),
      ]).catch(() => {});
    }

    return {
      assetIdForDelete,
      deletingCurrentWorkspaceVariant,
    };
  }

  function toggleFlyerPhotoSelection(assetId) {
    setFlyerSelectedPhotoIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }
      return [...current, assetId].slice(0, 4);
    });
  }

  function toggleReportPhotoSelection(assetId) {
    setReportSelectedPhotoIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }
      return [...current, assetId].slice(0, 4);
    });
  }

  function toggleReportSection(sectionId) {
    setReportIncludedSections((current) => {
      if (current.includes(sectionId)) {
        const nextSections = current.filter((id) => id !== sectionId);
        return nextSections.length ? nextSections : current;
      }
      return [...current, sectionId];
    });
  }

  async function handleDeleteSelectedPhoto() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    const assetToDelete = pendingDeleteAsset || selectedMediaAsset;

    setStatus('Deleting photo...');
    setToast(null);
    try {
      await deleteMediaAssetRequest(assetToDelete.id);
      queryClient.removeQueries({
        queryKey: ['property-media-variants', assetToDelete.id],
        exact: true,
      });
      const nextAssets = await refreshMediaAssets('');
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      const nextSelectedAssetId = nextAssets[0]?.id || '';
      if (nextSelectedAssetId) {
        await refreshMediaVariants(nextSelectedAssetId);
      } else {
        queryClient.setQueryData(['property-media-variants', assetToDelete.id], []);
        setMediaVariants([]);
        setSelectedVariantId('');
      }
      setToast({
        tone: 'success',
        title: 'Photo deleted',
        message: 'The photo and any generated variants were removed from this property.',
      });
      setPendingDeleteAsset(null);
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not delete photo', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleDeleteArchivedProperty() {
    const storedSession = getStoredSession();
    const actorUserId = storedSession?.user?.id || '';
    if (!pendingDeleteProperty?.id || !actorUserId) {
      return;
    }

    setStatus('Deleting property...');
    setToast(null);

    try {
      await deletePropertyRequest(pendingDeleteProperty.id, actorUserId);
      const nextSession = {
        ...(storedSession || {}),
        lastPropertyId: '',
      };

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          DASHBOARD_FLASH_TOAST_KEY,
          JSON.stringify({
            tone: 'success',
            title: 'Property deleted',
            message: `${pendingDeleteProperty.title || 'The property'} and its linked outputs were removed permanently.`,
          }),
        );
      }

      setStoredSession(nextSession);
      router.push('/dashboard');
      router.refresh();
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete property',
        message: requestError.message,
      });
      setStatus('');
    }
  }

  async function handleGenerateVariant(presetKey = activeVisionPresetKey) {
    if (blockArchivedMutation()) {
      return;
    }
    if (blockVisionAccessIfUnavailable()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    setActiveTab('vision');
    const stageKey = getVisionWorkflowStageForPreset(presetKey);
    setActiveVisionWorkflowStageKey(stageKey);
    setActiveVisionPresetKey(presetKey);
    const generationStartedAt = Date.now();
    let keepVisionGenerationState = false;
    const isDeclutterPreset = String(presetKey).includes('declutter');
    const isFurnitureRemovalPreset = presetKey === 'remove_furniture';
    const isCleanupPreset = presetKey === 'cleanup_empty_room';
    setVisionRecoveryState(null);
    setVisionCancellationPending(false);
    setStatus(
      isFurnitureRemovalPreset
        ? 'Generating furniture-removal preview...'
        : isCleanupPreset
        ? 'Generating cleanup pass...'
        : isDeclutterPreset
        ? 'Generating smart-enhancement cleanup...'
        : presetKey === 'combined_listing_refresh'
          ? 'Generating listing-ready pass...'
          : 'Generating first-impression pass...',
    );
    setVisionGenerationState({
      kind: isFurnitureRemovalPreset
        ? 'furniture'
        : isCleanupPreset
        ? 'cleanup'
        : isDeclutterPreset
        ? 'declutter'
        : 'preset',
      title: isFurnitureRemovalPreset
        ? 'Furniture removal preview'
        : isCleanupPreset
        ? 'Empty-room cleanup pass'
        : isDeclutterPreset
        ? 'Smart cleanup pass'
        : presetKey === 'combined_listing_refresh'
          ? 'Listing Ready pass'
          : 'First Impression pass',
      detail: isFurnitureRemovalPreset
        ? 'Generating a concept preview and checking whether fallback providers are needed.'
        : isCleanupPreset
        ? 'Refining the currently selected clean-room source and smoothing leftover artifacts.'
        : isDeclutterPreset
        ? 'Cleaning the photo up and reviewing the strongest targeted enhancement.'
        : presetKey === 'combined_listing_refresh'
          ? 'Running the stricter publish-confidence pass and checking whether the result is trustworthy enough to keep.'
          : 'Generating the fast baseline improvement that should make the room read better immediately.',
      startedAt: generationStartedAt,
    });
    setToast(null);
    await primeVisionCompletionAudio();
    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, {
        presetKey,
        roomType: selectedMediaAsset.roomLabel,
        forceRegenerate: true,
        sourceVariantId: workflowSourceVariantId || undefined,
        workflowStageKey: stageKey,
      });

      if (
        response.job &&
        response.job.status !== 'completed' &&
        response.job.status !== 'failed' &&
        response.job.status !== 'cancelled'
      ) {
        beginVisionRecovery({
          job: response.job,
          assetId: selectedMediaAsset.id,
          mode: 'preset',
          presetKey,
          workflowStageKey: stageKey,
          startedAt: generationStartedAt,
          successTitle: 'Vision job completed',
          successMessage:
            'The new image is now shown in the Vision compare area and the Generated options panel.',
          failureTitle: 'Variant generation failed',
        });
        keepVisionGenerationState = true;
        return;
      }

      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id), refreshWorkflow()]);
      const completionToast = buildVisionCompletionToast({
        job: response.job,
        variant: response.variant,
        successTitle: isFurnitureRemovalPreset
          ? 'Furniture removal preview ready'
        : isCleanupPreset
          ? 'Cleanup pass ready'
        : isDeclutterPreset
          ? 'Smart enhancement ready'
        : presetKey === 'combined_listing_refresh'
          ? 'Listing-ready pass ready'
          : 'First impression ready',
        successMessage:
          'The new image is now shown in the Vision compare area and the Generated options panel.',
      });
      if (completionToast.nextVariantId) {
        setLatestGeneratedVariantId(completionToast.nextVariantId);
        setSelectedVariantId(completionToast.nextVariantId);
      }
      setToast(completionToast);
      if (completionToast.shouldScroll) {
        requestAnimationFrame(() => {
          visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      void playVisionCompletionSound({
        tone: 'success',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } catch (requestError) {
      if (requestError?.message === 'Failed to fetch') {
        try {
          const recoveredJob = await recoverVisionJobAfterDisconnect({
            assetId: selectedMediaAsset.id,
            presetKey,
            mode: 'preset',
            startedAt: generationStartedAt,
          });

          if (recoveredJob) {
            if (recoveredJob.status === 'completed' || recoveredJob.status === 'failed') {
              const settledJob = await reconcileRecoveredVisionJob(recoveredJob, selectedMediaAsset.id);
              const completionToast = buildVisionCompletionToast({
                job: settledJob,
                successTitle: 'Vision job recovered',
                successMessage:
                  'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
                warningTitle: 'Recovered with warning',
              });
              setToast(completionToast);
              if (completionToast.nextVariantId) {
                setLatestGeneratedVariantId(completionToast.nextVariantId);
              }
              void playVisionCompletionSound({
                tone: 'success',
                elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
              });
              return;
            }

            beginVisionRecovery({
              job: recoveredJob,
              assetId: selectedMediaAsset.id,
              mode: 'preset',
              presetKey,
              workflowStageKey: stageKey,
              startedAt: generationStartedAt,
              successTitle: 'Vision job recovered',
              successMessage:
                'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
              failureTitle: 'Variant generation failed',
            });
            keepVisionGenerationState = true;
            return;
          }
        } catch (recoveryError) {
          setToast({
            tone: 'error',
            title: 'Variant generation failed',
            message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
            autoDismissMs: 0,
          });
          void playVisionCompletionSound({
            tone: 'error',
            elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
          });
          return;
        }
      }

      setToast({
        tone: 'error',
        title: 'Variant generation failed',
        message: `${requestError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
        autoDismissMs: 0,
      });
      void playVisionCompletionSound({
        tone: 'error',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } finally {
      if (!keepVisionGenerationState) {
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }
  }

  useEffect(() => {
    if (
      !canAccessVisionWorkspace ||
      activeTab !== 'vision' ||
      !selectedMediaAsset?.id ||
      selectedMediaAsset.assetType === 'generated' ||
      selectedMediaAsset.selectedVariant ||
      liveMediaVariantsQuery.isLoading ||
      mediaVariants.length ||
      selectedVariant ||
      workflowSourceVariant ||
      visionGenerationState ||
      isArchivedProperty
    ) {
      return;
    }

    if (firstImpressionAutoStartedAssetIdsRef.current.has(selectedMediaAsset.id)) {
      return;
    }

    firstImpressionAutoStartedAssetIdsRef.current.add(selectedMediaAsset.id);
    setActiveVisionWorkflowStageKey('clean');
    setActiveVisionPresetKey('enhance_listing_quality');
    void handleGenerateVariant('enhance_listing_quality');
  }, [
    activeTab,
    canAccessVisionWorkspace,
    handleGenerateVariant,
    isArchivedProperty,
    liveMediaVariantsQuery.isLoading,
    mediaVariants.length,
    selectedMediaAsset,
    selectedVariant,
    visionGenerationState,
    workflowSourceVariant,
  ]);

  function handleSelectVisionPreset(presetKey) {
    setActiveVisionWorkflowStageKey(getVisionWorkflowStageForPreset(presetKey));
    setActiveVisionPresetKey(presetKey);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        visionCurrentActionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 60);
    }
  }

  async function handleGenerateFreeformVariant() {
    if (blockArchivedMutation()) {
      return;
    }
    if (blockVisionAccessIfUnavailable()) {
      return;
    }
    if (!selectedMediaAsset || !freeformEnhancementInstructions.trim()) {
      setToast({
        tone: 'error',
        title: 'Instructions required',
        message: 'Describe the enhancement you want before generating a custom preview.',
      });
      return;
    }

    setActiveTab('vision');
    setActiveVisionWorkflowStageKey('finish');
    const generationStartedAt = Date.now();
    let keepVisionGenerationState = false;
    setVisionRecoveryState(null);
    setVisionCancellationPending(false);
    setStatus('Generating custom smart-enhancement preview...');
    setVisionGenerationState({
      kind: 'freeform',
      title: 'Custom smart-enhancement preview',
      detail: 'Applying your natural-language request inside the smart-enhancement stage and reviewing the generated result.',
      startedAt: generationStartedAt,
    });
    setToast(null);
    await primeVisionCompletionAudio();
    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, {
        mode: 'freeform',
        instructions: freeformEnhancementInstructions.trim(),
        roomType: selectedMediaAsset.roomLabel,
        forceRegenerate: true,
        sourceVariantId: workflowSourceVariantId || undefined,
        workflowStageKey: 'finish',
      });

      if (
        response.job &&
        response.job.status !== 'completed' &&
        response.job.status !== 'failed' &&
        response.job.status !== 'cancelled'
      ) {
        beginVisionRecovery({
          job: response.job,
          assetId: selectedMediaAsset.id,
          mode: 'freeform',
          presetKey:
            response.job?.requestedPresetKey ||
            response.job?.input?.requestedPresetKey ||
            response.job?.presetKey ||
            'combined_listing_refresh',
          workflowStageKey: 'finish',
          startedAt: generationStartedAt,
          successTitle: 'Custom enhancement ready',
          successMessage:
            'The new image is now shown in the Vision compare area and the Generated options panel.',
          failureTitle: 'Custom enhancement failed',
        });
        keepVisionGenerationState = true;
        return;
      }

      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshMediaVariants(selectedMediaAsset.id),
        refreshWorkflow(),
      ]);
      setShowMoreVisionVariants(true);
      setActiveVisionPresetKey(
        response.job?.requestedPresetKey ||
          response.job?.input?.requestedPresetKey ||
          response.job?.presetKey ||
          response.variant?.metadata?.presetKey ||
          response.variant?.variantType ||
          'combined_listing_refresh',
      );
      const completionToast = buildVisionCompletionToast({
        job: response.job,
        variant: response.variant,
        successTitle: 'Custom enhancement ready',
        successMessage:
          'Your freeform enhancement request was processed and the generated result is now selected in the Vision compare area.',
        warningTitle: 'Custom enhancement ready with warning',
      });
      if (completionToast.nextVariantId) {
        setLatestGeneratedVariantId(completionToast.nextVariantId);
        setSelectedVariantId(completionToast.nextVariantId);
      }
      setToast(completionToast);
      if (completionToast.shouldScroll) {
        requestAnimationFrame(() => {
          visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      void playVisionCompletionSound({
        tone: 'success',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } catch (requestError) {
      if (requestError?.message === 'Failed to fetch') {
        try {
          const recoveredJob = await recoverVisionJobAfterDisconnect({
            assetId: selectedMediaAsset.id,
            mode: 'freeform',
            startedAt: generationStartedAt,
          });

          if (recoveredJob) {
            if (recoveredJob.status === 'completed' || recoveredJob.status === 'failed') {
              const settledJob = await reconcileRecoveredVisionJob(recoveredJob, selectedMediaAsset.id);
              setShowMoreVisionVariants(true);
              setActiveVisionPresetKey(
                settledJob?.requestedPresetKey ||
                  settledJob?.input?.requestedPresetKey ||
                  settledJob?.presetKey ||
                  settledJob?.variants?.[0]?.metadata?.presetKey ||
                  settledJob?.variants?.[0]?.variantType ||
                  'combined_listing_refresh',
              );
              const completionToast = buildVisionCompletionToast({
                job: settledJob,
                successTitle: 'Custom enhancement recovered',
                successMessage:
                  'The browser lost the original request, but the custom enhancement finished and the generated variant has been recovered.',
                warningTitle: 'Custom enhancement recovered with warning',
              });
              setToast(completionToast);
              if (completionToast.nextVariantId) {
                setLatestGeneratedVariantId(completionToast.nextVariantId);
              }
              void playVisionCompletionSound({
                tone: 'success',
                elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
              });
              return;
            }

            beginVisionRecovery({
              job: recoveredJob,
              assetId: selectedMediaAsset.id,
              mode: 'freeform',
              startedAt: generationStartedAt,
              successTitle: 'Custom enhancement recovered',
              successMessage:
                'The browser lost the original request, but the custom enhancement finished and the generated variant has been recovered.',
              failureTitle: 'Custom enhancement failed',
            });
            keepVisionGenerationState = true;
            return;
          }
        } catch (recoveryError) {
          setToast({
            tone: 'error',
            title: 'Custom enhancement failed',
            message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
            autoDismissMs: 0,
          });
          void playVisionCompletionSound({
            tone: 'error',
            elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
          });
          return;
        }
      }

      setToast({
        tone: 'error',
        title: 'Custom enhancement failed',
        message: `${requestError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
        autoDismissMs: 0,
      });
      void playVisionCompletionSound({
        tone: 'error',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } finally {
      if (!keepVisionGenerationState) {
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }
  }

  async function handleSaveCurrentVisionResultToPhotos() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedVariant || !selectedMediaAsset) {
      return;
    }

    setStatus('Saving generated result to Photos...');
    setToast(null);
    try {
      const { generationStage, listingCandidate, qualityLabel } =
        getVisionSaveDefaults(selectedVariant, activeVisionWorkflowStageKey);
      const response = await saveVariantToPhotos(selectedVariant.id, {
        propertyId,
        roomLabel: selectedMediaAsset.roomLabel,
        generationStage,
        generationLabel: selectedVariant.label,
        listingCandidate,
      });

      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshDashboardSnapshot(),
        refreshChecklist(),
        refreshWorkflow(),
      ]);

      const savedAsset = response.asset || null;
      const shouldAdvanceToFinalize =
        activeVisionWorkflowStageKey === 'style' || listingCandidate;
      if (shouldAdvanceToFinalize) {
        setWorkflowSourceVariantId(selectedVariant.id);
        setActiveVisionWorkflowStageKey('final');
      }
      setToast({
        tone: 'success',
        title: 'Saved to Photos',
        message:
          response.created === false
            ? listingCandidate
              ? 'This AI-generated version was already in your photo library and is already marked as a listing candidate.'
              : 'This AI-generated version was already in your photo library and remains saved there as a review draft.'
            : listingCandidate
              ? 'This AI-generated version has been added to your photo library and marked as a listing candidate.'
              : `This AI-generated version has been added to your photo library as a review draft${qualityLabel ? ` (${qualityLabel})` : ''}.`,
        actionLabel: savedAsset ? 'View in Photos' : '',
        onAction: savedAsset
          ? () => {
              setSelectedMediaAssetId(savedAsset.id);
              setActiveTab('photos');
              setToast(null);
            }
          : null,
        autoDismissMs: 9000,
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save to Photos',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setStatus('');
    }
  }

  function handlePromoteVariantToNextStage() {
    if (!selectedVariant) {
      return;
    }

    const nextStageKey = getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey);
    setWorkflowSourceVariantId(selectedVariant.id);
    setActiveVisionWorkflowStageKey(nextStageKey);
    if (nextStageKey !== 'final') {
      setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    }
    setShowVisionHistory(false);
    setToast({
      tone: 'success',
      title: 'Workflow source updated',
      message:
        nextStageKey === 'final'
          ? 'The selected result is now your final-review source. You can keep it as the winner and delete earlier drafts when ready.'
          : `${selectedVariant.label || 'The selected result'} is now the source for ${getVisionWorkflowStage(nextStageKey).title.toLowerCase()}.`,
    });
  }

  function handleResetVisionWorkflowSource() {
    setWorkflowSourceVariantId('');
    setActiveVisionWorkflowStageKey('clean');
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage('clean'));
    setShowVisionHistory(false);
    setToast({
      tone: 'success',
      title: 'Workflow reset',
      message: 'Vision is back on the original photo so you can restart the staged workflow cleanly.',
    });
  }

  async function handlePruneVisionDraftHistory() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset || !selectedVariant) {
      return;
    }
    setPendingPruneVisionDrafts({
      assetId: selectedMediaAsset.id,
      roomLabel: selectedMediaAsset.roomLabel || 'this photo',
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.label || 'the selected version',
    });
  }

  async function handleConfirmPruneVisionDraftHistory() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingPruneVisionDrafts?.assetId || !pendingPruneVisionDrafts?.variantId) {
      return;
    }

    setStatus('Deleting earlier vision drafts...');
    try {
      const response = await pruneVisionDrafts(
        pendingPruneVisionDrafts.assetId,
        pendingPruneVisionDrafts.variantId,
      );
      const nextVariants = await refreshMediaVariants(pendingPruneVisionDrafts.assetId);
      setSelectedVariantId(
        nextVariants.find((variant) => variant.id === pendingPruneVisionDrafts.variantId)?.id ||
          nextVariants[0]?.id ||
          '',
      );
      setWorkflowSourceVariantId(pendingPruneVisionDrafts.variantId);
      setShowVisionHistory(false);
      setShowMoreVisionVariants(false);
      setToast({
        tone: 'success',
        title: 'Earlier drafts deleted',
        message:
          response.deletedCount > 0
            ? `${response.deletedCount} older vision draft${response.deletedCount === 1 ? '' : 's'} were removed.`
            : 'There were no earlier drafts to delete.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete drafts',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setPendingPruneVisionDrafts(null);
      setStatus('');
    }
  }

  async function handleDeleteVisionVariant(variant) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!variant?.id) {
      return;
    }

    const savedPhotoForVariant = mediaAssets.find(
      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
    );
    setPendingDeleteVisionVariant({
      id: variant.id,
      assetId: String(variant.mediaId || selectedMediaAsset?.id || ''),
      label: variant.label || 'Selected attempt',
      imageUrl: variant.imageUrl,
      summary: getVariantSummary(variant),
      reviewScore: getVariantReviewScore(variant),
      savedPhotoLabel:
        savedPhotoForVariant?.roomLabel || savedPhotoForVariant?.generationLabel || '',
    });
  }

  async function handleConfirmDeleteSelectedPhotoVariations() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingDeletePhotoVariationIds.length) {
      return;
    }

    const variantsToDelete = photoVariations.filter((variant) =>
      pendingDeletePhotoVariationIds.includes(variant.id),
    );
    if (!variantsToDelete.length) {
      setPendingDeletePhotoVariationIds([]);
      setSelectedPhotoVariationIds([]);
      setIsSelectingPhotoVariations(false);
      return;
    }

    setPendingDeletePhotoVariationIds([]);
    setStatus(
      `Deleting ${variantsToDelete.length} variation${variantsToDelete.length === 1 ? '' : 's'}...`,
    );
    setToast(null);

    let deletedCount = 0;
    const failedLabels = [];

    try {
      for (const variant of variantsToDelete) {
        try {
          await deleteVisionVariantByDescriptor(variant, {
            showSuccessToast: false,
            refreshAfterDelete: false,
          });
          deletedCount += 1;
        } catch (error) {
          failedLabels.push(variant.label || 'Selected variation');
        }
      }

      const refreshAssetId =
        String(resolvedActivePhotoVariationsAsset?.id || '') ||
        String(variantsToDelete[0]?.mediaId || '');
      if (refreshAssetId) {
        void Promise.all([
          refreshMediaVariants(refreshAssetId),
          refreshMediaAssets(refreshAssetId),
          refreshWorkflow(),
        ]).catch(() => {});
      }

      setSelectedPhotoVariationIds([]);
      setIsSelectingPhotoVariations(false);

      if (failedLabels.length) {
        setToast({
          tone: deletedCount ? 'warning' : 'error',
          title: deletedCount ? 'Some variations deleted' : 'Could not delete selected variations',
          message: deletedCount
            ? `${deletedCount} variation${deletedCount === 1 ? '' : 's'} deleted. ${failedLabels.length} could not be removed.`
            : `None of the selected variations could be removed.`,
          autoDismissMs: 0,
        });
      } else {
        setToast({
          tone: 'success',
          title: 'Selected variations deleted',
          message: `${deletedCount} variation${deletedCount === 1 ? '' : 's'} were removed permanently from this photo's Vision history.`,
        });
      }
    } finally {
      setStatus('');
    }
  }

  function handleViewVisionVariant(variant, { closeHistory = false } = {}) {
    if (!variant?.id) {
      return;
    }
    setSelectedVariantId(variant.id);
    setActiveVisionWorkflowStageKey(
      variant.metadata?.workflowStageKey ||
        getVisionWorkflowStageForPreset(
          variant.metadata?.presetKey || variant.variantType,
        ),
    );
    if (closeHistory) {
      setShowVisionHistory(false);
    }
    requestAnimationFrame(() => {
      scrollWorkspaceSectionIntoView(visionCompareRef);
    });
  }

  async function handleConfirmDeleteVisionVariant() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingDeleteVisionVariant?.id) {
      return;
    }

    const variantToDelete = pendingDeleteVisionVariant;

    setPendingDeleteVisionVariant(null);
    setStatus('Deleting vision attempt...');
    setToast(null);
    try {
      await deleteVisionVariantByDescriptor(variantToDelete);
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete attempt',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleExportSocialPack() {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Preparing social ad pack export...');
    setToast(null);
    try {
      const response = await generateSocialPack(propertyId);
      const socialPack = response.socialPack;
      setLatestSocialPack(socialPack);
      const blob = new Blob([socialPack?.markdown || ''], {
        type: 'text/markdown;charset=utf-8',
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${property?.title || 'property'}-social-ad-pack.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setToast({
        tone: 'success',
        title: 'Social ad pack exported',
        message: 'The latest social ad pack was refreshed and the markdown export download has started.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Social pack failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleImportPhotoFiles(fileList) {
    if (blockArchivedMutation()) {
      return;
    }

    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) {
      return;
    }

    setPhotoImportProgress({
      total: files.length,
      completed: 0,
      currentIndex: 1,
      currentFileName: files[0]?.name || '',
      phase: 'reading',
    });
    setStatus(`Importing photo 1 of ${files.length}...`);
    setToast(null);
    const normalizedRoomLabel = PHOTO_IMPORT_ROOM_LABEL_OPTIONS.includes(photoImportRoomLabel)
      ? photoImportRoomLabel
      : 'Other';
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];
        const currentIndex = fileIndex + 1;
        setPhotoImportProgress({
          total: files.length,
          completed: fileIndex,
          currentIndex,
          currentFileName: file?.name || '',
          phase: 'reading',
        });
        setStatus(`Importing photo ${currentIndex} of ${files.length}...`);
        const dataUrl = await readFileAsDataUrl(file);
        const [, imageBase64 = ''] = dataUrl.split(',');

        setPhotoImportProgress({
          total: files.length,
          completed: fileIndex,
          currentIndex,
          currentFileName: file?.name || '',
          phase: 'uploading',
        });

        await savePhoto(propertyId, {
          roomLabel: normalizedRoomLabel,
          source: photoImportSource,
          notes: photoImportNotes,
          mimeType: file.type || 'image/jpeg',
          imageBase64,
        });

        setPhotoImportProgress({
          total: files.length,
          completed: currentIndex,
          currentIndex,
          currentFileName: file?.name || '',
          phase: 'saved',
        });
      }

      setStatus('Refreshing photo library...');
      setPhotoImportProgress({
        total: files.length,
        completed: files.length,
        currentIndex: files.length,
        currentFileName: '',
        phase: 'refreshing',
      });
      const nextAssets = await refreshMediaAssets();
      if (nextAssets[0]?.id) {
        setSelectedMediaAssetId((current) => current || nextAssets[0].id);
      }
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setPhotoImportNotes('');
      setToast({
        tone: 'success',
        title: 'Photos imported',
        message: `${files.length} photo${files.length === 1 ? '' : 's'} added to this property.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Photo import failed', message: requestError.message });
    } finally {
      setPhotoImportProgress(null);
      setStatus('');
    }
  }

  async function handleSelectVariant(variantId) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    setStatus('Selecting preferred variant...');
    setToast(null);
    try {
      await selectMediaVariant(selectedMediaAsset.id, variantId);
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id), refreshWorkflow()]);
      setSelectedVariantId(variantId);
      requestAnimationFrame(() => {
        scrollWorkspaceSectionIntoView(visionCompareRef);
      });
      setToast({ tone: 'success', title: 'Preferred variant selected', message: 'Flyer and report generation will now prefer this image variant.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not select variant', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSetChecklistItemStatus(itemId, nextStatus) {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus(nextStatus === 'done' ? 'Marking checklist item done...' : 'Updating checklist item...');
    setToast(null);
    try {
      const response = await updateChecklistItem(itemId, { status: nextStatus });
      queryClient.setQueryData(['property-checklist', propertyId], response.checklist);
      setChecklist(response.checklist);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setToast({ tone: 'success', title: 'Checklist updated', message: 'Seller prep progress has been saved.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Checklist update failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleCreateChecklistTask(event) {
    event.preventDefault();
    if (blockArchivedMutation()) {
      return;
    }
    if (!customChecklistTitle.trim()) {
      setToast({ tone: 'error', title: 'Task title required', message: 'Add a short title before creating a custom checklist task.' });
      return;
    }
    setStatus('Saving custom checklist task...');
    setToast(null);
    try {
      const response = await createChecklistItem(propertyId, { title: customChecklistTitle, detail: customChecklistDetail, category: 'custom', priority: 'medium' });
      queryClient.setQueryData(['property-checklist', propertyId], response.checklist);
      setChecklist(response.checklist);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setCustomChecklistTitle('');
      setCustomChecklistDetail('');
      setToast({ tone: 'success', title: 'Task added', message: 'The custom checklist task now appears in the shared property workflow.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not add task', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveProvider(providerId) {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus('Saving provider...');
    setToast(null);
    try {
      await saveProvider(propertyId, providerId);
      setProviderRecommendations((current) =>
        current.map((provider) =>
          provider.id === providerId ? { ...provider, saved: true } : provider,
        ),
      );
      setToast({
        tone: 'success',
        title: 'Provider saved',
        message: 'This provider is now attached to the property workflow for later follow-up.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not save provider', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveProviderReference(provider, source = 'internal') {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Saving provider reference...');
    setToast(null);
    try {
      await createProviderReference(propertyId, {
        source,
        sourceRefId:
          source === 'google_maps'
            ? provider.sourceRefId || provider.id
            : provider.id,
        providerId: source === 'internal' ? provider.id : undefined,
        categoryKey: provider.categoryKey,
        categoryLabel: providerSuggestionTask?.providerCategoryLabel || provider.categoryLabel || '',
        businessName: provider.businessName,
        description: provider.description,
        coverageLabel: provider.coverageLabel,
        city: provider.city,
        state: provider.state,
        email: provider.email,
        phone: provider.phone,
        websiteUrl: provider.websiteUrl,
        mapsUrl: provider.mapsUrl,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
      });
      await refreshProviderReferences();
      setToast({
        tone: 'success',
        title: 'Added to reference sheet',
        message: `${provider.businessName} is now saved for the printable provider reference sheet.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not save provider reference', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleRemoveProviderReference(referenceId) {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Removing provider reference...');
    setToast(null);
    try {
      await deleteProviderReference(referenceId);
      await refreshProviderReferences();
      setToast({
        tone: 'success',
        title: 'Reference removed',
        message: 'The provider reference has been removed from the printable shortlist.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not remove provider reference', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleRequestProviderLead(provider) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!providerSuggestionTask) {
      return;
    }

    setStatus('Requesting provider contact...');
    setToast(null);
    try {
      await createProviderLead(propertyId, {
        categoryKey: provider.categoryKey,
        source: 'checklist_task',
        sourceRefId: providerSuggestionTask.systemKey || providerSuggestionTask.id,
        deliveryMode: 'sms_and_email',
        message:
          providerSuggestionTask.providerPrompt ||
          providerSuggestionTask.detail ||
          `Seller requested ${providerSuggestionTask.providerCategoryLabel || provider.categoryKey} support.`,
        maxProviders: 3,
      });
      await refreshProviderLeads();
      await refreshWorkflow();
      setToast({
        tone: 'success',
        title: 'Lead request created',
        message: `The ${provider.categoryKey.replace(/_/g, ' ')} request is now queued for provider outreach.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not request provider', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  function handleDownloadFlyerPdf() {
    return handleFileDownload(
      getFlyerExportUrl(propertyId, flyerType),
      `${property?.slug || property?.title || 'property'}-flyer.pdf`,
      'Latest flyer PDF downloaded',
    );
  }

  function handleDownloadReportPdf() {
    return handleFileDownload(
      getReportExportUrl(propertyId),
      `${property?.slug || property?.title || 'property'}-seller-report.pdf`,
      'Latest seller report PDF downloaded',
    );
  }

  function openGenerationPrompt(kind) {
    if (kind === 'flyer') {
      setGenerationPrompt({
        kind,
        title: 'Flyer ready',
        message:
          'Your flyer finished generating. View opens the latest saved flyer in a new tab, and download exports that same latest saved version.',
        downloadLabel: 'Download latest flyer PDF',
      });
      return;
    }

    setGenerationPrompt({
      kind,
      title: 'Seller report ready',
      message:
        'Your seller intelligence report finished generating. View opens the latest saved report in a new tab, and download exports that same latest saved version.',
      downloadLabel: 'Download latest report PDF',
    });
  }

  function getGeneratedDocumentExportUrl(kind, { disposition } = {}) {
    if (kind === 'flyer') {
      return getFlyerExportUrl(propertyId, flyerType, { disposition });
    }

    return getReportExportUrl(propertyId, { disposition });
  }

  async function handleDownloadGeneratedDocument() {
    if (!generationPrompt) {
      return;
    }

    if (generationPrompt.kind === 'flyer') {
      await handleDownloadFlyerPdf();
    } else {
      await handleDownloadReportPdf();
    }

    setGenerationPrompt(null);
  }

  function handleViewGeneratedDocument() {
    if (!generationPrompt) {
      return;
    }

    const viewUrl = getGeneratedDocumentExportUrl(generationPrompt.kind, { disposition: 'inline' });
    const previewWindow = window.open(viewUrl, '_blank');
    if (!previewWindow) {
      setToast({
        tone: 'error',
        title: 'Could not open PDF preview',
        message: 'Your browser blocked the new tab. Allow pop-ups and try again.',
      });
      return;
    }

    try {
      previewWindow.opener = null;
      if (typeof previewWindow.focus === 'function') {
        previewWindow.focus();
      }
    } catch {}

    setGenerationPrompt(null);
  }

  function handleDownloadProviderReferenceSheet() {
    return handleFileDownload(
      getProviderReferenceSheetExportUrl(propertyId),
      `${property?.slug || property?.title || 'property'}-provider-reference-sheet.pdf`,
      'Reference sheet PDF downloaded',
    );
  }

  async function handleFileDownload(downloadUrl, fallbackFileName, successTitle) {
    setStatus('Preparing PDF download...');
    setToast(null);
    try {
      const { blob, fileName } = await downloadFile(downloadUrl, fallbackFileName);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName || fallbackFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setToast({
        tone: 'success',
        title: successTitle,
        message: 'Your file download has started.',
      });
    } catch (downloadError) {
      setToast({
        tone: 'error',
        title: 'Could not download PDF',
        message: downloadError.message,
      });
    } finally {
      setStatus('');
    }
  }

  const addressQuery = buildAddressQuery(property);
  const googleMapsUrl = useMemo(
    () => buildGoogleMapsRouteUrl(property, selectedComps),
    [property, selectedComps],
  );

  const renderOverviewTab = () => (
    <WorkspaceOverviewTab
      property={property}
      latestReport={latestReport}
      latestPricing={latestPricing}
      dashboard={dashboard}
      readinessScore={readinessScore}
      listingCandidateAssets={listingCandidateAssets}
      mediaAssets={mediaAssets}
      checklist={checklist}
      recentOutputs={recentOutputs}
      setActiveTab={setActiveTab}
    />
  );

  const renderPricingTab = () => (
    <WorkspacePricingTab
      addressQuery={addressQuery}
      setShowExpandedMap={setShowExpandedMap}
      googleMapsUrl={googleMapsUrl}
      property={property}
      selectedComps={selectedComps}
      mapsApiKey={mapsApiKey}
      latestPricing={latestPricing}
      dashboard={dashboard}
      pricingQuickPickOptions={pricingQuickPickOptions}
      selectedListPriceSourceDraft={selectedListPriceSourceDraft}
      setSelectedListPriceDraft={setSelectedListPriceDraft}
      setSelectedListPriceSourceDraft={setSelectedListPriceSourceDraft}
      selectedListPriceDraft={selectedListPriceDraft}
      handleSaveSelectedListPrice={handleSaveSelectedListPrice}
      status={status}
      isArchivedProperty={isArchivedProperty}
    />
  );

  const renderPhotosTab = () => (
    <WorkspacePhotosTab
      renderCollapsibleSection={renderCollapsibleSection}
      defaultSectionState={DEFAULT_WORKSPACE_SECTION_STATE}
      mediaAssets={mediaAssets}
      handleImportPhotoFiles={handleImportPhotoFiles}
      photoImportSource={photoImportSource}
      setPhotoImportSource={setPhotoImportSource}
      photoImportRoomLabel={photoImportRoomLabel}
      setPhotoImportRoomLabel={setPhotoImportRoomLabel}
      photoImportRoomLabelOptions={PHOTO_IMPORT_ROOM_LABEL_OPTIONS}
      photoImportNotes={photoImportNotes}
      setPhotoImportNotes={setPhotoImportNotes}
      photoImportProgress={photoImportProgress}
      canAccessVisionWorkspace={canAccessVisionWorkspace}
      photoImportSourceOptions={PHOTO_IMPORT_SOURCE_OPTIONS}
      photoCategoryGroups={photoCategoryGroups}
      selectedMediaAssetPhotoCategory={selectedMediaAssetPhotoCategory}
      firstPopulatedPhotoCategoryKey={firstPopulatedPhotoCategoryKey}
      selectedMediaAsset={selectedMediaAsset}
      setSelectedMediaAssetId={setSelectedMediaAssetId}
      setActivePhotoDetailsAsset={setActivePhotoDetailsAsset}
      handleToggleListingCandidateForAsset={handleToggleListingCandidateForAsset}
      status={status}
      isArchivedProperty={isArchivedProperty}
      handleOpenPhotoVariations={handleOpenPhotoVariations}
    />
  );

  const renderSellerPicksTab = () => (
    <WorkspaceSellerPicksTab
      renderCollapsibleSection={renderCollapsibleSection}
      listingCandidateAssets={listingCandidateAssets}
      sellerPickCategoryGroups={sellerPickCategoryGroups}
      selectedMediaAsset={selectedMediaAsset}
      setSelectedMediaAssetId={setSelectedMediaAssetId}
      setActivePhotoDetailsAsset={setActivePhotoDetailsAsset}
      handleOpenAssetInVision={handleOpenAssetInVision}
      setActiveTab={setActiveTab}
    />
  );

  const renderVisionTab = () => (
    <div className="workspace-tab-stack">
      <div ref={visionCompareRef} className="content-card">
        <div className="section-header-tight">
          <div>
            <span className="label">Single-photo vision workspace</span>
            <h2>Before and after</h2>
          </div>
          <span className="section-header-meta">
            {selectedVariant ? `Current workflow draft: ${selectedVariant.label}` : 'No draft selected yet'}
          </span>
        </div>
        {selectedMediaAsset ? (
          <div className="property-media-variant-panel">
            <div className="vision-context-header">
              <div className="vision-context-item">
                <span className="label">Editing</span>
                <strong>
                  {selectedMediaAsset.assetType === 'generated'
                    ? `${selectedMediaAsset.roomLabel || 'Selected photo'} · ${selectedMediaAsset.generationLabel || getMediaAssetPrimaryLabel(selectedMediaAsset)}`
                    : selectedMediaAsset.roomLabel || 'Selected photo'}
                </strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Source</span>
                <strong>
                  {workflowSourceVariant
                    ? workflowSourceVariant.label
                    : selectedGeneratedAssetAsResult
                    ? selectedMediaAssetSourceAsset?.roomLabel || 'Original photo'
                    : 'Original photo'}
                </strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Current stage</span>
                <strong>{activeVisionWorkflowStage.title}</strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Current result</span>
                <strong>{effectiveVisionResultLabel}</strong>
              </div>
            </div>
            {selectedVariant || selectedGeneratedAssetAsResult ? (
              <div className="property-media-slider-card">
                <span className="label">Before / after slider</span>
                <p className="property-media-variant-caption">{effectiveVisionResultSummary}</p>
                <div className="property-media-slider-shell">
                  <ReactCompareSlider
                    itemOne={
                      <ReactCompareSliderImage
                        src={compareSourceImageUrl}
                        alt={compareSourceLabel || 'Current workflow source'}
                      />
                    }
                    itemTwo={
                      <ReactCompareSliderImage
                        src={effectiveVisionResultImageUrl}
                        alt={effectiveVisionResultLabel || 'Generated image variant'}
                      />
                    }
                  />
                </div>
                <div className="tag-row">
                  <span>{compareSourceVariant || selectedGeneratedAssetAsResult ? 'Stage source' : 'Original'}</span>
                  <span>{selectedVariant?.variantCategory === 'concept_preview' ? 'Concept Preview' : 'Enhanced'}</span>
                  <span>{activeVisionWorkflowStage.title}</span>
                </div>
              </div>
            ) : null}
            <div className="property-media-variant-compare">
              <div>
                <span className="label">{compareSourceVariant ? 'Current stage input' : 'Original'}</span>
                <p className="property-media-variant-caption">
                  {compareSourceVariant
                    ? `The selected output was generated from ${compareSourceLabel}.`
                    : 'Untouched mobile capture.'}
                </p>
                <img src={compareSourceImageUrl} alt={compareSourceLabel || 'Original property photo'} className="property-media-variant-image" />
              </div>
              <div>
                <span className="label">Vision output</span>
                <p className="property-media-variant-caption">
                  {effectiveVisionResultSummary}
                </p>
                {effectiveVisionResultImageUrl ? (
                  <img src={effectiveVisionResultImageUrl} alt={effectiveVisionResultLabel || 'Generated image result'} className="property-media-variant-image" />
                ) : (
                  <div className="property-media-variant-empty">Generate your first stage action to start the workspace history for this photo.</div>
                )}
              </div>
            </div>
            {selectedVariant?.metadata?.effects?.length ? (
              <div className="property-media-variant-effects">
                {selectedVariant.metadata.effects.map((effect) => <span key={effect}>{effect}</span>)}
              </div>
            ) : null}
            {selectedVariant?.metadata?.confidenceBadge || selectedVariant?.metadata?.listingReadyLabel ? (
              <div className="property-media-variant-effects">
                {selectedVariant.metadata?.confidenceBadge ? (
                  <span>{selectedVariant.metadata.confidenceBadge}</span>
                ) : null}
                {selectedVariant.metadata?.listingReadyLabel ? (
                  <span>{selectedVariant.metadata.listingReadyLabel}</span>
                ) : null}
                {selectedVariant.metadata?.sourceReadinessScore && selectedVariant.metadata?.renderedReadinessScore ? (
                  <span>{`Readiness ${selectedVariant.metadata.sourceReadinessScore} -> ${selectedVariant.metadata.renderedReadinessScore}`}</span>
                ) : null}
                {selectedVariant.metadata?.readinessDelta ? (
                  <span>{`Estimated +${selectedVariant.metadata.readinessDelta} readiness`}</span>
                ) : null}
              </div>
            ) : null}
            {selectedVariant?.metadata?.pipelineDescriptor ? (
              <div className="workspace-inner-card">
                <span className="label">Marketplace status</span>
                <p>
                  {selectedVariant.metadata.pipelineDescriptor.stageLabel || 'Vision result'} ·{' '}
                  {selectedVariant.metadata.pipelineDescriptor.statusLabel || 'Review pending'}
                </p>
                {selectedVariant.metadata.pipelineDescriptor.reviewMessage ? (
                  <p className="workspace-control-note">
                    {selectedVariant.metadata.pipelineDescriptor.reviewMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
            {currentVisionPipelinePackage ? (
              <div className="workspace-inner-card">
                <span className="label">Pipeline package</span>
                <p>
                  {currentVisionPipelinePackage.stageLabel} · {currentVisionPipelinePackage.statusLabel}
                </p>
                <p className="workspace-control-note">
                  {currentVisionPipelinePackage.reviewMessage}
                </p>
                <p className="workspace-control-note">
                  {currentVisionPipelinePackage.deliveryMessage}
                </p>
              </div>
            ) : null}
            {selectedVariant?.metadata?.differenceHint ? <p className="property-media-variant-hint">{selectedVariant.metadata.differenceHint}</p> : null}
            {selectedVariant?.metadata?.smartEnhancementPathLabel || selectedVariant?.metadata?.smartEnhancementReason ? (
              <div className="workspace-inner-card">
                <span className="label">Execution Path</span>
                <p>
                  {selectedVariant.metadata?.smartEnhancementPathLabel || 'Direct execution'}
                </p>
                {selectedVariant.metadata?.smartEnhancementReason ? (
                  <p className="workspace-control-note">{selectedVariant.metadata.smartEnhancementReason}</p>
                ) : null}
              </div>
            ) : null}
            {selectedVariant?.metadata?.improvementsApplied?.length ? (
              <div className="workspace-inner-card">
                <span className="label">Improvements Applied</span>
                <ul className="plain-list">
                  {selectedVariant.metadata.improvementsApplied.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selectedVariant?.metadata?.recommendations?.length ? (
              <div className="workspace-inner-card">
                <span className="label">Top Improvements</span>
                <ul className="plain-list">
                  {selectedVariant.metadata.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selectedVariant?.metadata?.nextActions?.length ? (
              <div className="workspace-inner-card">
                <span className="label">Next Actions</span>
                <ul className="plain-list">
                  {selectedVariant.metadata.nextActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selectedVariant?.metadata?.review?.shouldHideByDefault ? (
              <div className="property-media-review-note">
                <strong>Needs extra review</strong>
                <p>{selectedVariant.metadata.review.summary || 'This output ranked lower due to realism or artifact risk.'}</p>
              </div>
            ) : null}
            {selectedVariant ? <p className="workspace-control-note">{getVariantDisclaimer(selectedVariant)}</p> : null}
            {selectedVariant ? (
              <div className="mini-stats">
                <div className="stat-card">
                  <strong>Stage</strong>
                  <span>{getVisionWorkflowStage(selectedVariant.metadata?.workflowStageKey || getVisionWorkflowStageForPreset(selectedVariant.metadata?.presetKey || selectedVariant.variantType)).title}</span>
                </div>
                <div className="stat-card">
                  <strong>Source</strong>
                  <span>{selectedVariant.metadata?.sourceLabel || compareSourceLabel}</span>
                </div>
                <div className="stat-card">
                  <strong>Quality review</strong>
                  <span>{getVariantReviewScore(selectedVariant) ? `${getVariantReviewScore(selectedVariant)}/100` : 'Pending'}</span>
                </div>
                <div className="stat-card">
                  <strong>Confidence</strong>
                  <span>{selectedVariant.metadata?.confidenceBadge || selectedVariant.metadata?.listingReadyLabel || 'Pending'}</span>
                </div>
                <div className="stat-card">
                  <strong>Readiness</strong>
                  <span>
                    {selectedVariant.metadata?.sourceReadinessScore && selectedVariant.metadata?.renderedReadinessScore
                      ? `${selectedVariant.metadata.sourceReadinessScore} -> ${selectedVariant.metadata.renderedReadinessScore}`
                      : selectedVariant.metadata?.listingReadyScore
                        ? `${selectedVariant.metadata.listingReadyScore}/100`
                        : selectedVariant.metadata?.readinessDelta
                          ? `+${selectedVariant.metadata.readinessDelta}`
                          : 'Pending'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Applied</strong>
                  <span>
                    {selectedVariant.metadata?.improvementsApplied?.length
                      ? `${selectedVariant.metadata.improvementsApplied.length} updates`
                      : selectedVariant.metadata?.readinessDelta
                        ? 'Readiness shift tracked'
                        : 'Pending'}
                  </span>
                </div>
                <div className="stat-card">
                  <strong>Structural realism</strong>
                  <span>{selectedVariant.metadata?.review?.structuralIntegrityScore ? `${selectedVariant.metadata.review.structuralIntegrityScore}/100` : 'Pending'}</span>
                </div>
                <div className="stat-card">
                  <strong>Preset</strong>
                  <span>{selectedVariant.metadata?.presetKey || selectedVariant.variantType}</span>
                </div>
                <div className="stat-card">
                  <strong>Created</strong>
                  <span>{selectedVariant.createdAt ? new Date(selectedVariant.createdAt).toLocaleString() : 'Just now'}</span>
                </div>
              </div>
            ) : null}
            {selectedVariant ? (
              <div className="vision-result-actions-card">
                <div className="workspace-tab-stack">
                  <span className="label">Current result</span>
                  <strong>{selectedVariant.label || 'Generated result'}</strong>
                  <p>
                    {getVariantSummary(selectedVariant)}
                  </p>
                  {savedAssetForSelectedVariant ? (
                    <p className="workspace-control-note">
                      This result is already saved in Photos as <strong>{savedAssetForSelectedVariant.roomLabel}</strong>.
                    </p>
                  ) : selectedVariant ? (
                    <p className="workspace-control-note">
                      {currentVisionSaveDefaults.listingCandidate
                        ? 'Saving this result to Photos will also mark it as a listing candidate.'
                        : 'Saving this result to Photos will keep it as a review draft until you explicitly mark it as a seller pick.'}
                    </p>
                  ) : null}
                  {currentVisionPipelinePackage ? (
                    <p className="workspace-control-note">
                      {currentVisionPipelinePackage.publishable
                        ? 'This result is ready to flow into flyer and report materials once you keep it.'
                        : currentVisionPipelinePackage.deliveryMessage}
                    </p>
                  ) : null}
                </div>
                <div className="vision-result-actions">
                  <button
                    type="button"
                    className={savedAssetForSelectedVariant ? 'button-secondary' : 'button-primary'}
                    onClick={savedAssetForSelectedVariant ? () => {
                      setSelectedMediaAssetId(savedAssetForSelectedVariant.id);
                      setActiveTab('photos');
                    } : handleSaveCurrentVisionResultToPhotos}
                    disabled={Boolean(status) || isArchivedProperty}
                  >
                    {savedAssetForSelectedVariant
                      ? 'View in Photos'
                      : currentVisionSaveDefaults.listingCandidate
                        ? 'Save as Listing Photo'
                        : 'Save Draft to Photos'}
                  </button>
                  {activeVisionWorkflowStage.key !== 'final' ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={handlePromoteVariantToNextStage}
                      disabled={Boolean(status) || isArchivedProperty}
                    >
                      {`Use this result for ${getVisionWorkflowStage(getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey)).title.toLowerCase()}`}
                    </button>
                  ) : null}
                  {(currentVisionSaveDefaults.publishable ||
                    savedAssetForSelectedVariant ||
                    activeVisionWorkflowStage.key === 'final') ? (
                    <>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setActiveTab('brochure')}
                      >
                        Open Flyer
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setActiveTab('report')}
                      >
                        Open Report
                      </button>
                    </>
                  ) : null}
                  {latestGeneratedVariant && selectedVariant && latestGeneratedVariant.id !== selectedVariant.id ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setSelectedVariantId(latestGeneratedVariant.id);
                        requestAnimationFrame(() => {
                          scrollWorkspaceSectionIntoView(visionCompareRef);
                        });
                      }}
                    >
                      Return to latest generated result
                    </button>
                  ) : null}
                </div>
              </div>
            ) : selectedGeneratedAssetAsResult ? (
              <div className="vision-result-actions-card">
                <div className="workspace-tab-stack">
                  <span className="label">Current result</span>
                  <strong>{effectiveVisionResultLabel}</strong>
                  <p>{effectiveVisionResultSummary}</p>
                  <p className="workspace-control-note">
                    This saved Vision result is the current source for the next stage. Generate the next step when you are ready, or reopen the original photo if you want to branch from the beginning.
                  </p>
                </div>
                <div className="vision-result-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setActiveTab('photos')}
                  >
                    View in Photos
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setActivePhotoDetailsAsset(selectedMediaAsset)}
                  >
                    View details
                  </button>
                </div>
              </div>
            ) : null}
            {selectedVariant || selectedGeneratedAssetAsResult ? (
              <p className="workspace-control-note">
                Work on one photo at a time here. The current result stays in focus, and older drafts live in the workflow history drawer below.
              </p>
            ) : null}
          </div>
        ) : (
          <p>Select a photo in the Photos tab first to use the Vision workspace.</p>
        )}
      </div>

      <div className="workspace-two-column vision-workflow-layout">
        <div className="content-card vision-workspace-card">
          <span className="label">Workspace steps</span>
          <h2>Guide this photo stage by stage</h2>
          {selectedMediaAsset ? (
            <>
              <div className="workspace-tab-stack">
                <div className="workspace-inner-card brochure-control-card vision-source-card">
                  <span className="label">Editing photo</span>
                  <strong>{selectedMediaAsset.roomLabel || 'Property photo'}</strong>
                  <p>
                    Work on one source photo at a time. Other property photos stay hidden unless you open the photo picker.
                  </p>
                  <div className="tag-row">
                    <span>{workflowSourceVariant ? `Current source: ${workflowSourceVariant.label}` : 'Current source: Original photo'}</span>
                    <span>{activeVisionWorkflowStage.title}</span>
                  </div>
                  <div className="workspace-action-column vision-workflow-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setShowVisionPhotoPicker((current) => !current)}
                    >
                      {showVisionPhotoPicker ? 'Hide photo picker' : 'Choose a different photo'}
                    </button>
                    {selectedVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={handlePromoteVariantToNextStage}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        {activeVisionWorkflowStage.key === 'final'
                          ? 'Keep selected result for final review'
                          : `Use this result for ${getVisionWorkflowStage(getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey)).title.toLowerCase()}`}
                      </button>
                    ) : null}
                    {workflowSourceVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={handleResetVisionWorkflowSource}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        Reset to original photo
                      </button>
                    ) : null}
                  </div>
                  {showVisionPhotoPicker ? (
                    <div className="vision-photo-picker property-media-rail property-photo-grid compact">
                      {mediaAssets.map((asset) => (
                        <button
                          key={`vision-source-${asset.id}`}
                          type="button"
                          className={asset.id === selectedMediaAsset?.id ? 'property-media-thumb active' : 'property-media-thumb'}
                          onClick={() => setSelectedMediaAssetId(asset.id)}
                        >
                          <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
                          <div>
                            <strong>{asset.roomLabel}</strong>
                            <small>{asset.generationLabel || getMediaAssetPrimaryLabel(asset)}</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="vision-stage-rail">
                  {VISION_WORKFLOW_STAGES.map((stage) => (
                    <button
                      key={stage.key}
                      type="button"
                      className={
                        stage.key === activeVisionWorkflowStageKey
                          ? 'vision-stage-chip active'
                          : 'vision-stage-chip'
                      }
                      onClick={() => {
                        setActiveVisionWorkflowStageKey(stage.key);
                        if (stage.key !== 'final') {
                          setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(stage.key));
                        }
                      }}
                    >
                      <strong>{stage.label}</strong>
                      <span>{stage.title}</span>
                    </button>
                  ))}
                </div>
                {activeVisionWorkflowStage.key !== 'final'
                  ? activeVisionWorkflowPresetGroups.map((group) => (
                  <div key={group.key} className="workspace-inner-card brochure-control-card">
                    <span className="label">{group.label}</span>
                    <div className="property-media-variant-list">
                      {group.items.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          className={
                            activeVisionPresetKey === preset.key
                              ? 'property-media-variant-chip active'
                              : 'property-media-variant-chip'
                          }
                          onClick={() => handleSelectVisionPreset(preset.key)}
                          title={[
                            preset.displayName,
                            preset.helperText,
                            preset.upgradeTier === 'premium' ? 'Premium workflow step.' : 'Included workflow step.',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {preset.displayName}
                          {preset.upgradeTier === 'premium' ? ' · Premium' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                    ))
                  : null}
                <div className="workspace-inner-card brochure-control-card">
                  <span className="label">Stage guidance</span>
                  <strong>{activeVisionWorkflowStage.title}</strong>
                  <p>{activeVisionWorkflowStage.description}</p>
                  <div className="tag-row">
                    <span>{workflowSourceVariant ? 'Using selected draft as the source' : 'Using the original photo as the source'}</span>
                    {selectedVariant || selectedGeneratedAssetAsResult ? <span>Current result: {effectiveVisionResultLabel}</span> : null}
                    {latestGeneratedVariant ? <span>Latest generated: {latestGeneratedVariant.label}</span> : null}
                  </div>
                  {preferredVisionVariant && selectedVariant && preferredVisionVariant.id !== selectedVariant.id ? (
                    <p className="workspace-control-note">
                      Marketing-preferred output: <strong>{preferredVisionVariant.label}</strong>. The workspace is keeping <strong>{selectedVariant.label}</strong> in focus for this step so you can continue editing without losing the preferred pick.
                    </p>
                  ) : null}
                  {latestGeneratedVariant && selectedVariant && latestGeneratedVariant.id !== selectedVariant.id ? (
                    <p className="workspace-control-note">
                      You are viewing an older attempt right now. The newest generated result is <strong>{latestGeneratedVariant.label}</strong> from {formatDateTimeLabel(latestGeneratedVariant.createdAt)}.
                    </p>
                  ) : null}
                  <p className="workspace-control-note">
                    This stage currently has {stageScopedVisionVariants.length} previous attempt{stageScopedVisionVariants.length === 1 ? '' : 's'} for this photo. Open attempt history only when you want to compare, keep, or permanently delete them.
                  </p>
                </div>
              </div>
              {activeVisionWorkflowStage.key !== 'final' ? (
                <>
                  <div
                    ref={visionCurrentActionRef}
                    className="workspace-inner-card brochure-control-card vision-current-action-card"
                  >
                    <span className="label">Current action</span>
                    <strong>{activeVisionPreset?.displayName || 'Select a preset'}</strong>
                    <p>
                      {activeVisionPreset?.helperText ||
                        'Choose the next step for this photo and keep the workspace moving forward one stage at a time.'}
                    </p>
                    <div className="tag-row vision-status-badge-row">
                      <span
                        className="vision-status-badge"
                        title={
                          activeVisionPreset?.category === 'concept_preview'
                            ? 'Concept preview: intended for planning and discussion, not as a representation of completed work.'
                            : 'Listing enhancement: intended as a stronger presentation-oriented improvement.'
                        }
                      >
                        {activeVisionPreset?.category === 'concept_preview'
                          ? 'Concept Preview'
                          : 'Listing Enhancement'}
                      </span>
                      <span
                        className="vision-status-badge"
                        title={
                          activeVisionPreset?.upgradeTier === 'premium'
                            ? 'Premium workflow step. This preset uses the premium vision path when available.'
                            : 'Included workflow step.'
                        }
                      >
                        {activeVisionPreset?.upgradeTier === 'premium'
                          ? 'Premium workflow step'
                          : 'Included workflow'}
                      </span>
                    </div>
                    <div className="vision-current-action-buttons vision-current-action-buttons-primary">
                      <button
                        type="button"
                        className={
                          visionGenerationState
                            ? 'button-primary button-busy vision-generate-button'
                            : 'button-primary vision-generate-button'
                        }
                        onClick={() => handleGenerateVariant(activeVisionPresetKey)}
                        disabled={Boolean(status) || isArchivedProperty || !activeVisionPreset}
                        title={activeVisionPresetTooltip}
                      >
                        {visionGenerationState
                          ? `Generating... ${visionGenerationElapsedSeconds}s`
                          : `Generate ${activeVisionPreset?.displayName || 'enhancement'}`}
                      </button>
                    </div>
                    <p className="workspace-control-note">
                      Generate the next result here. Open attempt history only when you want to compare, keep, or permanently delete older attempts.
                    </p>
                    {visionWorkflowRecommendation ? (
                      <div className="workspace-inner-card">
                        <span className="label">Recommended next step</span>
                        <strong>{visionWorkflowRecommendation.label}</strong>
                        <p>{visionWorkflowRecommendation.reason}</p>
                        <div className="workspace-action-row">
                          {visionWorkflowRecommendation.type === 'generate' ? (
                            <button
                              type="button"
                              className={
                                visionWorkflowRecommendation.presetKey === activeVisionPresetKey
                                  ? 'button-secondary'
                                  : 'button-primary'
                              }
                              onClick={() =>
                                handleSelectVisionPreset(visionWorkflowRecommendation.presetKey)
                              }
                              disabled={!visionWorkflowRecommendation.presetKey}
                            >
                              {visionWorkflowRecommendation.presetKey === activeVisionPresetKey
                                ? 'Recommended preset selected'
                                : `Use ${visionWorkflowRecommendation.label}`}
                            </button>
                          ) : null}
                          {visionWorkflowRecommendation.type === 'save_result' &&
                          selectedVariant &&
                          !savedAssetForSelectedVariant ? (
                            <button
                              type="button"
                              className="button-primary"
                              onClick={handleSaveCurrentVisionResultToPhotos}
                            >
                              {currentVisionSaveDefaults.listingCandidate
                                ? 'Save this result as a listing photo'
                                : 'Save this result as a draft'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="vision-current-action-buttons vision-current-action-buttons-secondary">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setShowVisionHistory(true)}
                        disabled={!stageScopedVisionVariants.length}
                      >
                        {`View attempt history (${stageScopedVisionVariants.length})`}
                      </button>
                    </div>
                  </div>
                  {visionGenerationState ? (
                    <div className="vision-generation-status" role="status" aria-live="polite">
                      <div className="vision-generation-status-header">
                        <div>
                          <span className="label">Vision generation in progress</span>
                          <strong>{visionGenerationState.title}</strong>
                        </div>
                        <span className="vision-generation-status-time">{visionGenerationElapsedSeconds}s elapsed</span>
                      </div>
                      <div className="vision-generation-progress" aria-hidden="true">
                        <span className="vision-generation-progress-bar" />
                      </div>
                      <p>{visionGenerationState.detail}</p>
                      <p className="workspace-control-note">
                        Timing varies by preset and whether the job needs a stronger AI fallback, so this indicator tracks elapsed time rather than pretending to know an exact percent complete. A short chime will play when longer runs finish.
                      </p>
                      {visionRecoveryState?.jobId ? (
                        <div className="workspace-action-row">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={handleCancelVisionGeneration}
                            disabled={visionCancellationPending}
                          >
                            {visionCancellationPending ? 'Cancelling...' : 'Cancel generation'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {activeVisionWorkflowStage.allowFreeform ? (
                    <div className="workspace-inner-card brochure-control-card">
                      <span className="label">Natural-language enhancement</span>
                      <textarea
                        value={freeformEnhancementInstructions}
                        onChange={(event) => setFreeformEnhancementInstructions(event.target.value)}
                        placeholder="Please make this cleaned room feel modern and bright while preserving the architecture."
                        maxLength={600}
                      />
                      <div className="workspace-action-column">
                        <button
                          type="button"
                          className={visionGenerationState?.kind === 'freeform' ? 'button-secondary button-busy' : 'button-secondary'}
                          onClick={handleGenerateFreeformVariant}
                          disabled={Boolean(status) || isArchivedProperty || !freeformEnhancementInstructions.trim()}
                        >
                          {visionGenerationState?.kind === 'freeform'
                            ? `Generating... ${visionGenerationElapsedSeconds}s`
                            : 'Generate custom preview'}
                        </button>
                      </div>
                      <p className="workspace-control-note">
                        Use this after the room is cleaned and the major finish changes are in place. It works best inside Smart Enhancement for directed styling, not as a substitute for cleanup.
                      </p>
                      {selectedVariant?.metadata?.mode === 'freeform' ? (
                        <div className="vision-freeform-result-card">
                          <div className="section-header-tight">
                            <div>
                              <span className="label">Latest custom result</span>
                              <strong>{selectedVariant.label || 'Custom enhancement preview'}</strong>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            >
                              Show compare view
                            </button>
                          </div>
                          <div className="vision-freeform-result-grid">
                            <img
                              src={selectedVariant.imageUrl}
                              alt={selectedVariant.label || 'Generated custom enhancement'}
                              className="vision-freeform-result-thumb"
                            />
                            <div className="workspace-tab-stack">
                              <p className="workspace-control-note">
                                This result is now loaded in the compare view above.
                              </p>
                              {selectedVariant.metadata?.instructions ? (
                                <p>
                                  <strong>Request:</strong> {selectedVariant.metadata.instructions}
                                </p>
                              ) : null}
                              {selectedVariantFreeformHighlights.length ? (
                                <div className="tag-row">
                                  {selectedVariantFreeformHighlights.map((item) => (
                                    <span key={`freeform-highlight-${item}`}>{item}</span>
                                  ))}
                                </div>
                              ) : null}
                              {selectedVariant.metadata?.differenceHint ? (
                                <p className="workspace-control-note">
                                  <strong>What to look for:</strong> {selectedVariant.metadata.differenceHint}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="workspace-inner-card brochure-control-card">
                      <span className="label">Advanced requests</span>
                      <p>
                        Natural-language styling unlocks in Smart Enhancement, after the room has been cleaned and the major finish changes are in place.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="workspace-inner-card brochure-control-card">
                  <span className="label">Finalize this photo</span>
                  <strong>{selectedVariant?.label || 'Select the result you want to keep'}</strong>
                  <p>
                    Once this version is the winner, keep it as the preferred output and remove earlier drafts for a clean final workspace.
                  </p>
                  <div className="workspace-action-column">
                    {selectedVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleSelectVariant(selectedVariant.id)}
                        disabled={Boolean(status) || isArchivedProperty || selectedVariant.isSelected}
                      >
                        {selectedVariant.isSelected ? 'Preferred variant selected' : 'Set as preferred variant'}
                      </button>
                    ) : null}
                    {savedAssetForSelectedVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setSelectedMediaAssetId(savedAssetForSelectedVariant.id);
                          setActiveTab('photos');
                        }}
                      >
                        View saved photo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setActiveTab('brochure')}
                    >
                      Open Flyer
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setActiveTab('report')}
                    >
                      Open Report
                    </button>
                    <button
                      type="button"
                      className="button-secondary button-danger"
                      onClick={handlePruneVisionDraftHistory}
                      disabled={Boolean(status) || isArchivedProperty || !selectedVariant}
                    >
                      Delete earlier saved versions
                    </button>
                  </div>
                  <p className="workspace-control-note">
                    This keeps the selected result and permanently removes the other saved image versions for this photo.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p>No photo is selected yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderBrochureTab = () => (
    <WorkspaceBrochureTab
      renderCollapsibleSection={renderCollapsibleSection}
      defaultSectionState={DEFAULT_WORKSPACE_SECTION_STATE}
      latestFlyer={latestFlyer}
      flyerType={flyerType}
      setFlyerType={setFlyerType}
      listingCandidateAssets={listingCandidateAssets}
      mediaAssets={mediaAssets}
      latestPricing={latestPricing}
      flyerHeadlineDraft={flyerHeadlineDraft}
      setFlyerHeadlineDraft={setFlyerHeadlineDraft}
      flyerSubheadlineDraft={flyerSubheadlineDraft}
      setFlyerSubheadlineDraft={setFlyerSubheadlineDraft}
      flyerSummaryDraft={flyerSummaryDraft}
      setFlyerSummaryDraft={setFlyerSummaryDraft}
      flyerCallToActionDraft={flyerCallToActionDraft}
      setFlyerCallToActionDraft={setFlyerCallToActionDraft}
      flyerCopySuggestions={flyerCopySuggestions}
      flyerCopySuggestionSource={flyerCopySuggestionSource}
      isSuggestingFlyerCopy={isSuggestingFlyerCopy}
      handleSuggestFlyerCopy={handleSuggestFlyerCopy}
      handleUseFlyerCopySuggestion={handleUseFlyerCopySuggestion}
      brochurePhotoPool={brochurePhotoPool}
      flyerSelectedPhotoIds={flyerSelectedPhotoIds}
      toggleFlyerPhotoSelection={toggleFlyerPhotoSelection}
      status={status}
      documentGenerationState={documentGenerationState}
      isArchivedProperty={isArchivedProperty}
      handleGenerateFlyer={handleGenerateFlyer}
      handleDownloadFlyerPdf={handleDownloadFlyerPdf}
      flyerPreviewRef={flyerPreviewRef}
      handleExportSocialPack={handleExportSocialPack}
      latestSocialPack={latestSocialPack}
      activeSocialPackVariantKey={activeSocialPackVariantKey}
      setActiveSocialPackVariantKey={setActiveSocialPackVariantKey}
      activeSocialPackVariantDetails={activeSocialPackVariantDetails}
    />
  );

  const renderReportTab = () => (
    <WorkspaceReportTab
      renderCollapsibleSection={renderCollapsibleSection}
      defaultSectionState={DEFAULT_WORKSPACE_SECTION_STATE}
      latestReport={latestReport}
      status={status}
      documentGenerationState={documentGenerationState}
      isArchivedProperty={isArchivedProperty}
      handleGenerateReport={handleGenerateReport}
      handleDownloadReportPdf={handleDownloadReportPdf}
      listingCandidateAssets={listingCandidateAssets}
      mediaAssets={mediaAssets}
      checklist={checklist}
      selectedComps={selectedComps}
      reportTitleDraft={reportTitleDraft}
      setReportTitleDraft={setReportTitleDraft}
      reportExecutiveSummaryDraft={reportExecutiveSummaryDraft}
      setReportExecutiveSummaryDraft={setReportExecutiveSummaryDraft}
      reportListingDescriptionDraft={reportListingDescriptionDraft}
      setReportListingDescriptionDraft={setReportListingDescriptionDraft}
      reportSectionOptions={REPORT_SECTION_OPTIONS}
      reportIncludedSections={reportIncludedSections}
      toggleReportSection={toggleReportSection}
      reportPhotoPool={reportPhotoPool}
      reportSelectedPhotoIds={reportSelectedPhotoIds}
      toggleReportPhotoSelection={toggleReportPhotoSelection}
      reportPreviewRef={reportPreviewRef}
      property={property}
    />
  );

  const renderChecklistTab = () => (
    <WorkspaceChecklistTab
      renderCollapsibleSection={renderCollapsibleSection}
      defaultSectionState={DEFAULT_WORKSPACE_SECTION_STATE}
      isWorkspaceSectionOpen={isWorkspaceSectionOpen}
      setWorkspaceSectionOpen={setWorkspaceSectionOpen}
      checklist={checklist}
      checklistGroups={checklistGroups}
      checklistSummaryMode={checklistSummaryMode}
      setChecklistSummaryMode={setChecklistSummaryMode}
      completedChecklistItems={completedChecklistItems}
      openChecklistItems={openChecklistItems}
      readinessScore={readinessScore}
      customChecklistTitle={customChecklistTitle}
      setCustomChecklistTitle={setCustomChecklistTitle}
      customChecklistDetail={customChecklistDetail}
      setCustomChecklistDetail={setCustomChecklistDetail}
      handleCreateChecklistTask={handleCreateChecklistTask}
      handleSetChecklistItemStatus={handleSetChecklistItemStatus}
      status={status}
      isArchivedProperty={isArchivedProperty}
      focusProviderSuggestions={focusProviderSuggestions}
      providerSuggestionsRef={providerSuggestionsRef}
      providerSuggestionTask={providerSuggestionTask}
      providerSearchStatus={providerSearchStatus}
      providerRecommendations={providerRecommendations}
      unavailableProviderRecommendations={unavailableProviderRecommendations}
      providerSource={providerSource}
      providerGoogleSearchUrl={providerGoogleSearchUrl}
      providerMapProviders={providerMapProviders}
      setProviderMapScope={setProviderMapScope}
      setShowProviderMap={setShowProviderMap}
      handleBrowseGoogleFallback={handleBrowseGoogleFallback}
      externalProviderRecommendations={externalProviderRecommendations}
      showExternalProviderFallback={showExternalProviderFallback}
      providerCoverageGuidance={providerCoverageGuidance}
      shouldShowExternalProviderSection={shouldShowExternalProviderSection}
      hasInternalProviderResults={hasInternalProviderResults}
      handleSaveProvider={handleSaveProvider}
      handleSaveProviderReference={handleSaveProviderReference}
      handleRequestProviderLead={handleRequestProviderLead}
      providerReferenceIds={providerReferenceIds}
      providerReferences={providerReferences}
      setActiveProviderDetails={setActiveProviderDetails}
      handleRemoveProviderReference={handleRemoveProviderReference}
      handleDownloadProviderReferenceSheet={handleDownloadProviderReferenceSheet}
      providerLeads={providerLeads}
    />
  );

  const renderActiveTab = () => {
    if (activeTab === 'pricing') return renderPricingTab();
    if (activeTab === 'photos') return renderPhotosTab();
    if (activeTab === 'seller_picks') return renderSellerPicksTab();
    if (activeTab === 'vision') {
      return canAccessVisionWorkspace ? renderVisionTab() : renderPhotosTab();
    }
    if (activeTab === 'brochure') return renderBrochureTab();
    if (activeTab === 'report') return renderReportTab();
    if (activeTab === 'checklist') return renderChecklistTab();
    return renderOverviewTab();
  };

  const visibleWorkspaceTabs =
    activeTab === 'vision' && canAccessVisionWorkspace
      ? [...WORKSPACE_TABS.slice(0, 3), ...HIDDEN_WORKSPACE_TABS, ...WORKSPACE_TABS.slice(3)]
      : WORKSPACE_TABS;

  return (
    <AppFrame busy={Boolean(status)}>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        autoDismissMs={toast?.autoDismissMs}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
        onClose={() => setToast(null)}
      />
      {resolvedActivePhotoDetailsAsset ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setActivePhotoDetailsAsset(null)}>
          <div
            className="workspace-modal-card photo-details-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Photo details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header-tight">
              <div>
                <span className="label">Photo details</span>
                <h2>{resolvedActivePhotoDetailsAsset.roomLabel || 'Selected photo'}</h2>
              </div>
              <button
                type="button"
                className="button-secondary inline-button"
                onClick={() => setActivePhotoDetailsAsset(null)}
              >
                Close
              </button>
            </div>
            <div className="workspace-modal-preview-row photo-details-modal-preview">
              <img
                src={resolvedActivePhotoDetailsAsset.imageUrl}
                alt={resolvedActivePhotoDetailsAsset.roomLabel || 'Selected property photo'}
                className="workspace-modal-preview-image"
              />
              <div className="workspace-modal-preview-copy">
                <div className="photo-card-badge-row photo-card-badge-row-large">
                  <span className="photo-card-status-pill">{getMediaAssetPrimaryLabel(resolvedActivePhotoDetailsAsset)}</span>
                  {resolvedActivePhotoDetailsAsset.savedFromVision ? <span className="photo-card-status-pill">Saved from Vision</span> : null}
                  <button
                    type="button"
                    className={resolvedActivePhotoDetailsAsset.listingCandidate ? 'photo-card-action-pill active' : 'photo-card-action-pill'}
                    onClick={() => handleToggleListingCandidateForAsset(resolvedActivePhotoDetailsAsset)}
                    disabled={Boolean(status) || isArchivedProperty}
                  >
                    {resolvedActivePhotoDetailsAsset.listingCandidate ? 'Seller Pick' : 'Add Seller Pick'}
                  </button>
                </div>
                <strong>
                  {resolvedActivePhotoDetailsAsset.assetType === 'generated'
                    ? resolvedActivePhotoDetailsAsset.generationLabel || getMediaAssetPrimaryLabel(resolvedActivePhotoDetailsAsset)
                    : resolvedActivePhotoDetailsAsset.roomLabel || 'Original photo'}
                </strong>
                <span>{getMediaAssetSummary(resolvedActivePhotoDetailsAsset)}</span>
                <span>
                  Saved {new Date(resolvedActivePhotoDetailsAsset.createdAt).toLocaleString()}
                  {resolvedActivePhotoDetailsAsset.assetType === 'generated'
                    ? ' · Added from Vision'
                    : resolvedActivePhotoDetailsAsset.analysis?.roomGuess
                    ? ` · AI sees ${resolvedActivePhotoDetailsAsset.analysis.roomGuess.toLowerCase()}`
                    : ''}
                </span>
                {resolvedActivePhotoDetailsAsset.assetType === 'generated' ? (
                  <span>
                    Stage:{' '}
                    {resolvedActivePhotoDetailsAsset.generationStage === 'clean_room'
                      ? 'Clean room'
                      : resolvedActivePhotoDetailsAsset.generationStage === 'finishes'
                      ? 'Buyer appeal previews'
                      : resolvedActivePhotoDetailsAsset.generationStage === 'style'
                      ? 'Style concept'
                      : 'Saved image version'}
                  </span>
                ) : null}
                {resolvedActivePhotoDetailsAsset.assetType !== 'generated' &&
                typeof resolvedActivePhotoDetailsAsset.analysis?.overallQualityScore === 'number' ? (
                  <div className="property-media-badges">
                    <span>Quality {resolvedActivePhotoDetailsAsset.analysis.overallQualityScore}/100</span>
                    {typeof resolvedActivePhotoDetailsAsset.analysis?.lightingScore === 'number' ? <span>Light {resolvedActivePhotoDetailsAsset.analysis.lightingScore}/100</span> : null}
                    {typeof resolvedActivePhotoDetailsAsset.analysis?.compositionScore === 'number' ? <span>Composition {resolvedActivePhotoDetailsAsset.analysis.compositionScore}/100</span> : null}
                    {resolvedActivePhotoDetailsAsset.analysis?.retakeRecommended ? <span>Retake suggested</span> : <span>Ready for listing review</span>}
                  </div>
                ) : null}
                {resolvedActivePhotoDetailsAsset.selectedVariant ? (
                  <span>
                    Marketing-preferred Vision output: {resolvedActivePhotoDetailsAsset.selectedVariant.label || 'Preferred result'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => handleOpenPhotoVariations(resolvedActivePhotoDetailsAsset)}
              >
                Variations
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  handleOpenAssetInVision(resolvedActivePhotoDetailsAsset);
                  if (canAccessVisionWorkspace) {
                    setActivePhotoDetailsAsset(null);
                  }
                }}
                disabled={Boolean(status) || isArchivedProperty}
              >
                {canAccessVisionWorkspace ? 'Open in Vision' : 'Upgrade for Vision'}
              </button>
              {resolvedActivePhotoDetailsAsset.assetType === 'generated' && resolvedActivePhotoDetailsAsset.sourceMediaId ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setSelectedMediaAssetId(resolvedActivePhotoDetailsAsset.sourceMediaId);
                    setActivePhotoDetailsAsset(null);
                    setActiveTab('photos');
                  }}
                >
                  View original photo
                </button>
              ) : null}
              <button
                type="button"
                className="button-secondary button-danger"
                onClick={() => {
                  setPendingDeleteAsset(resolvedActivePhotoDetailsAsset);
                  setActivePhotoDetailsAsset(null);
                }}
                disabled={Boolean(status) || isArchivedProperty}
              >
                {resolvedActivePhotoDetailsAsset.assetType === 'generated' ? 'Delete saved version' : 'Delete original photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resolvedActivePhotoVariationsAsset ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={closePhotoVariationsModal}
        >
          <div
            className="workspace-modal-card photo-variations-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Photo variations"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="photo-variations-modal-header">
              <div className="photo-variations-modal-topbar">
                <div className="photo-variations-modal-title">
                  <span className="label">Photo variations</span>
                  <h2>{resolvedActivePhotoVariationsAsset.roomLabel || 'Selected photo'}</h2>
                </div>
                <div className="workspace-modal-actions photo-variations-modal-actions">
                  <button
                    type="button"
                    className={
                      selectedPhotoVariationIds.length
                        ? 'button-secondary button-danger'
                        : 'button-secondary'
                    }
                    onClick={() => {
                      if (selectedPhotoVariationIds.length) {
                        setPendingDeletePhotoVariationIds([...selectedPhotoVariationIds]);
                        return;
                      }
                      setIsSelectingPhotoVariations((current) => !current);
                      setSelectedPhotoVariationIds([]);
                    }}
                    disabled={Boolean(status) || isArchivedProperty || !photoVariations.length}
                  >
                    {selectedPhotoVariationIds.length
                      ? `Delete Selected (${selectedPhotoVariationIds.length})`
                      : 'Select'}
                  </button>
                  <button
                    type="button"
                    className="button-secondary inline-button"
                    onClick={closePhotoVariationsModal}
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="workspace-control-note">
                Review every generated variation for this source photo. Use the best one as the
                baseline for Vision, or permanently delete the variations you do not need.
              </p>
              <div className="photo-variations-sort-row">
                <label className="photo-variations-sort-control">
                  <span>Sort by</span>
                  <select
                    className="select-input"
                    value={photoVariationSortKey}
                    onChange={(event) => setPhotoVariationSortKey(event.target.value)}
                    disabled={!photoVariations.length}
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </select>
                </label>
                <label className="photo-variations-sort-control">
                  <span>Order</span>
                  <select
                    className="select-input"
                    value={photoVariationSortDirection}
                    onChange={(event) => setPhotoVariationSortDirection(event.target.value)}
                    disabled={!photoVariations.length}
                  >
                    {photoVariationSortKey === 'date' ? (
                      <>
                        <option value="desc">Newest first</option>
                        <option value="asc">Oldest first</option>
                      </>
                    ) : (
                      <>
                        <option value="asc">A to Z</option>
                        <option value="desc">Z to A</option>
                      </>
                    )}
                  </select>
                </label>
              </div>
              {isSelectingPhotoVariations ? (
                <p className="workspace-control-note">
                  Select one or more variations, then use <strong>Delete Selected</strong>. This action cannot be reversed.
                </p>
              ) : null}
              {photoVariationsError ? (
                <div className="workspace-tab-stack">
                  <p>{photoVariationsError}</p>
                  <p className="workspace-control-note">
                    The modal did not lock up, but the variations request did not complete successfully.
                  </p>
                </div>
              ) : photoVariations.length || isLoadingPhotoVariations ? (
                <div className="vision-variation-loading-card">
                  <div className="vision-variation-loading-header">
                    <strong>
                      {photoVariationsTotalCount
                        ? `Loaded ${photoVariationsLoadedCount} of ${photoVariationsTotalCount} variations`
                        : isLoadingPhotoVariations
                          ? 'Loading variations'
                          : 'Variations ready'}
                    </strong>
                    {photoVariationsTotalCount ? <span>{photoVariationsProgressPercent}%</span> : null}
                  </div>
                  <div className="vision-variation-loading-progress" aria-hidden="true">
                    <span
                      className="vision-variation-loading-progress-bar"
                      style={{ width: `${photoVariationsProgressPercent || 8}%` }}
                    />
                  </div>
                  <p className="workspace-control-note">
                    {isLoadingPhotoVariations
                      ? 'We are loading saved variations in batches so you can start reviewing them without waiting for the entire history to finish.'
                      : 'All currently saved variations for this photo are loaded below.'}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="photo-variations-modal-body">
              {photoVariationsError ? null : photoVariations.length || isLoadingPhotoVariations ? (
                <div className="vision-attempt-grid">
                  {sortedPhotoVariations.map((variant) => {
                    const savedPhotoForVariant = mediaAssets.find(
                      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
                    );
                    const isCurrentVariant = variant.id === selectedVariant?.id;
                    const isMarkedForDelete = selectedPhotoVariationIds.includes(variant.id);
                    return (
                      <article
                        key={`photo-variation-${variant.id}`}
                        className={isCurrentVariant ? 'vision-attempt-card active' : 'vision-attempt-card'}
                      >
                        <img
                          src={variant.imageUrl}
                          alt={variant.label || 'Photo variation'}
                          className="vision-attempt-card-image"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="vision-attempt-card-copy">
                          <div className="vision-attempt-card-header">
                            <strong>{variant.label || 'Saved variation'}</strong>
                            {isSelectingPhotoVariations ? (
                              <label
                                className="vision-attempt-select-toggle"
                                aria-label={`Select ${variant.label || 'variation'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isMarkedForDelete}
                                  onChange={() => togglePhotoVariationSelection(variant.id)}
                                  disabled={Boolean(status) || isArchivedProperty}
                                />
                              </label>
                            ) : null}
                          </div>
                          <div className="tag-row compact">
                            <span>{getVisionWorkflowStage(getVisionWorkflowStageKeyForVariant(variant)).title}</span>
                            {isCurrentVariant ? <span>Viewing now</span> : null}
                            {variant.isSelected ? <span>Kept</span> : null}
                            {savedPhotoForVariant ? <span>Saved in Photos</span> : null}
                            {getVariantReviewScore(variant) ? <span>{getVariantReviewScore(variant)}/100</span> : null}
                          </div>
                          <p className="workspace-control-note vision-attempt-card-timestamp">
                            {formatDateTimeLabel(variant.createdAt)}
                          </p>
                          <p className="workspace-control-note">{getVariantSummary(variant)}</p>
                          <div className="vision-attempt-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() =>
                                handleUseVariantAsVisionBaseline(
                                  resolvedActivePhotoVariationsAsset,
                                  variant,
                                )
                              }
                            >
                              Use as Vision baseline
                            </button>
                            <button
                              type="button"
                              className="button-secondary button-danger"
                              onClick={() => handleDeleteVisionVariant(variant)}
                              disabled={Boolean(status) || isArchivedProperty}
                            >
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="workspace-tab-stack">
                  <p>No generated variations exist for this photo yet.</p>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      handleOpenAssetInVision(resolvedActivePhotoVariationsAsset);
                      closePhotoVariationsModal();
                    }}
                  >
                    Open in Vision
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeletePhotoVariationIds.length ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDeletePhotoVariationIds([])}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-variations-title"
            aria-describedby="delete-photo-variations-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete selected variations</span>
            <h2 id="delete-photo-variations-title">
              Delete {pendingDeletePhotoVariationIds.length} selected variation{pendingDeletePhotoVariationIds.length === 1 ? '' : 's'} permanently?
            </h2>
            <p id="delete-photo-variations-description">
              This action cannot be reversed. The selected variations will be removed from this photo&apos;s saved variation history.
            </p>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingDeletePhotoVariationIds([])}
                disabled={Boolean(status)}
              >
                Keep selected
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmDeleteSelectedPhotoVariations}
                disabled={Boolean(status)}
              >
                {status?.startsWith('Deleting ')
                  ? status
                  : 'Delete selected permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showVisionHistory ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setShowVisionHistory(false)}
        >
          <div
            className="workspace-modal-card vision-history-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Vision attempt history"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header-tight">
              <div>
                <span className="label">Previous attempts</span>
                <h2>Attempt history</h2>
              </div>
              <button
                type="button"
                className="button-secondary inline-button"
                onClick={() => setShowVisionHistory(false)}
              >
                Close
              </button>
            </div>
            {stageScopedVisionVariants.length ? (
              <div className="workspace-tab-stack">
                <p className="workspace-control-note">
                  These are the saved attempts for this stage. View one in the compare area, keep a winner, or permanently delete the ones you do not need.
                </p>
                {stageScopedVisionVariants.length > visibleVisionVariants.length ? (
                  <div className="workspace-action-column">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setShowMoreVisionVariants((current) => !current)}
                    >
                      {showMoreVisionVariants
                        ? 'Show fewer attempts'
                        : hiddenVisionVariantCount
                          ? `Show more attempts (${hiddenVisionVariantCount} lower-confidence hidden in this stage)`
                          : 'Show more attempts'}
                    </button>
                  </div>
                ) : null}
                <div className="vision-attempt-grid">
                  {visibleVisionVariants.map((variant) => {
                    const savedPhotoForVariant = mediaAssets.find(
                      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
                    );
                    const isCurrentVariant = variant.id === selectedVariant?.id;
                    return (
                      <article
                        key={`vision-history-${variant.id}`}
                        className={isCurrentVariant ? 'vision-attempt-card active' : 'vision-attempt-card'}
                      >
                        <img
                          src={variant.imageUrl}
                          alt={variant.label || 'Vision attempt'}
                          className="vision-attempt-card-image"
                        />
                        <div className="vision-attempt-card-copy">
                          <strong>{variant.label}</strong>
                          <div className="tag-row compact">
                            {isCurrentVariant ? <span>Viewing now</span> : null}
                            {latestGeneratedVariant?.id === variant.id ? <span>Latest generated</span> : null}
                            {variant.isSelected ? <span>Kept</span> : null}
                            {savedPhotoForVariant ? <span>Saved in Photos</span> : null}
                            {getVariantReviewScore(variant) ? <span>{getVariantReviewScore(variant)}/100</span> : null}
                            {variant.metadata?.review?.shouldHideByDefault ? <span>Lower confidence</span> : null}
                          </div>
                          <p className="workspace-control-note vision-attempt-card-timestamp">
                            {formatDateTimeLabel(variant.createdAt)}
                          </p>
                          <p className="workspace-control-note">
                            {getVariantSummary(variant)}
                          </p>
                          <div className="vision-attempt-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => handleViewVisionVariant(variant, { closeHistory: true })}
                            >
                              {isCurrentVariant ? 'Viewing' : 'View in compare'}
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => handleSelectVariant(variant.id)}
                              disabled={Boolean(status) || isArchivedProperty || variant.isSelected}
                            >
                              {variant.isSelected ? 'Kept' : 'Keep'}
                            </button>
                            <button
                              type="button"
                              className="button-secondary button-danger"
                              onClick={() => handleDeleteVisionVariant(variant)}
                              disabled={Boolean(status) || isArchivedProperty}
                            >
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p>No attempts exist for this stage yet. Generate the first result and it will appear here.</p>
            )}
          </div>
        </div>
      ) : null}

      {pendingDeleteAsset ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setPendingDeleteAsset(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-title"
            aria-describedby="delete-photo-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete photo</span>
            <h2 id="delete-photo-title">Remove {pendingDeleteAsset.roomLabel || 'this photo'}?</h2>
            <p id="delete-photo-description">
              This will permanently remove the photo from the property gallery and also delete any generated vision variants tied to it.
            </p>
            <div className="workspace-modal-preview-row">
              <img src={pendingDeleteAsset.imageUrl} alt={pendingDeleteAsset.roomLabel || 'Selected property photo'} className="workspace-modal-preview-image" />
              <div className="workspace-modal-preview-copy">
                <strong>{pendingDeleteAsset.roomLabel || 'Property photo'}</strong>
                <span>{pendingDeleteAsset.listingCandidate ? 'Currently marked as a listing candidate.' : 'This photo is part of the shared property gallery.'}</span>
                <span>{pendingDeleteAsset.selectedVariant ? 'A preferred vision variant is attached and will also be removed.' : 'No preferred vision variant is attached.'}</span>
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setPendingDeleteAsset(null)} disabled={Boolean(status)}>
                Keep photo
              </button>
              <button type="button" className="button-secondary button-danger" onClick={handleDeleteSelectedPhoto} disabled={Boolean(status)}>
                {status === 'Deleting photo...' ? 'Deleting...' : 'Delete photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteProperty ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setPendingDeleteProperty(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-property-title"
            aria-describedby="delete-property-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete property</span>
            <h2 id="delete-property-title">Delete {pendingDeleteProperty.title || 'this property'} permanently?</h2>
            <p id="delete-property-description">
              This action is irreversible. The property, pricing history, photos, flyers, reports, social pack, saved providers, provider outreach, and linked activity records will be removed permanently.
            </p>
            <div className="workspace-modal-preview-copy">
              <strong>{pendingDeleteProperty.title || 'Archived property'}</strong>
              <span>{buildPropertyAddressLabel(pendingDeleteProperty) || 'Address not listed'}</span>
              <span>Only archived properties can be deleted permanently.</span>
            </div>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setPendingDeleteProperty(null)} disabled={Boolean(status)}>
                Cancel
              </button>
              <button type="button" className="button-danger" onClick={handleDeleteArchivedProperty} disabled={Boolean(status)}>
                {status === 'Deleting property...' ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteVisionVariant ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDeleteVisionVariant(null)}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-vision-variant-title"
            aria-describedby="delete-vision-variant-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete attempt</span>
            <h2 id="delete-vision-variant-title">
              Delete {pendingDeleteVisionVariant.label || 'this vision attempt'} permanently?
            </h2>
            <p id="delete-vision-variant-description">
              This will remove the attempt from Vision history for this photo.
              {pendingDeleteVisionVariant.savedPhotoLabel
                ? ` The saved Photos copy for ${pendingDeleteVisionVariant.savedPhotoLabel} will stay in the library.`
                : ''}
            </p>
            <div className="workspace-modal-preview-row">
              <img
                src={pendingDeleteVisionVariant.imageUrl}
                alt={pendingDeleteVisionVariant.label || 'Vision attempt'}
                className="workspace-modal-preview-image"
              />
              <div className="workspace-modal-preview-copy">
                <strong>{pendingDeleteVisionVariant.label || 'Vision attempt'}</strong>
                {pendingDeleteVisionVariant.reviewScore ? (
                  <span>{pendingDeleteVisionVariant.reviewScore}/100 reviewed</span>
                ) : null}
                <span>{pendingDeleteVisionVariant.summary || 'This generated attempt is no longer needed.'}</span>
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingDeleteVisionVariant(null)}
                disabled={Boolean(status)}
              >
                Keep attempt
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmDeleteVisionVariant}
                disabled={Boolean(status)}
              >
                {status === 'Deleting vision attempt...' ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingPruneVisionDrafts ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingPruneVisionDrafts(null)}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prune-vision-drafts-title"
            aria-describedby="prune-vision-drafts-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete earlier drafts</span>
            <h2 id="prune-vision-drafts-title">
              Keep only {pendingPruneVisionDrafts.variantLabel || 'the selected version'}?
            </h2>
            <p id="prune-vision-drafts-description">
              Every earlier Vision draft for {pendingPruneVisionDrafts.roomLabel || 'this photo'} will be removed permanently.
              The current selected version will stay in place.
            </p>
            <div className="workspace-modal-preview-copy">
              <strong>{pendingPruneVisionDrafts.roomLabel || 'Selected photo'}</strong>
              <span>{pendingPruneVisionDrafts.variantLabel || 'Selected version'} will remain as the kept draft.</span>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingPruneVisionDrafts(null)}
                disabled={Boolean(status)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmPruneVisionDraftHistory}
                disabled={Boolean(status)}
              >
                {status === 'Deleting earlier vision drafts...' ? 'Deleting...' : 'Delete earlier drafts'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {generationPrompt ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setGenerationPrompt(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="generation-prompt-title"
            aria-describedby="generation-prompt-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">{generationPrompt.kind === 'flyer' ? 'Flyer output' : 'Seller report'}</span>
            <h2 id="generation-prompt-title">{generationPrompt.title}</h2>
            <p id="generation-prompt-description">{generationPrompt.message}</p>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setGenerationPrompt(null)}>
                Stay here
              </button>
              <button type="button" className="button-secondary" onClick={handleViewGeneratedDocument}>
                View PDF
              </button>
              <button type="button" className="button-primary" onClick={handleDownloadGeneratedDocument}>
                {generationPrompt.downloadLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showProviderMap ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setShowProviderMap(false)}>
          <div
            className="workspace-modal-card workspace-map-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-map-title"
            aria-describedby="provider-map-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-map-modal-header">
              <div>
                <span className="label">Provider map</span>
                <h2 id="provider-map-title">
                  {providerSource?.categoryLabel || providerSuggestionTask?.providerCategoryLabel || 'Provider coverage'}
                </h2>
                <p id="provider-map-description">
                  {hasInternalProviderResults
                    ? 'Review matched Workside marketplace providers around the property in a controlled map view.'
                    : 'Review Google fallback providers around the property in a controlled map view.'}
                </p>
                {providerMapProviders.some((provider) => provider.isExternalFallback) && hasInternalProviderResults ? (
                  <div className="workspace-map-scope-toggle" role="group" aria-label="Provider map coverage scope">
                    <button
                      type="button"
                      className={providerMapScope === 'internal' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapScope('internal')}
                    >
                      Workside only
                    </button>
                    <button
                      type="button"
                      className={providerMapScope === 'all' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapScope('all')}
                    >
                      Include Google
                    </button>
                  </div>
                ) : null}
                {providerMapViewportProviders.length > 6 ? (
                  <div className="workspace-map-scope-toggle" role="group" aria-label="Provider map density">
                    <button
                      type="button"
                      className={providerMapDensity === 'compact' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapDensity('compact')}
                    >
                      Top matches
                    </button>
                    <button
                      type="button"
                      className={providerMapDensity === 'expanded' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapDensity('expanded')}
                    >
                      Expanded view
                    </button>
                  </div>
                ) : null}
                <div className="mini-stats provider-map-metrics">
                  <div className="stat-card">
                    <strong>Shown on map</strong>
                    <span>{providerMapDisplayedProviders.length}</span>
                  </div>
                  <div className="stat-card">
                    <strong>Workside</strong>
                    <span>{providerMapInternalCount}</span>
                  </div>
                  {providerMapExternalCount ? (
                    <div className="stat-card">
                      <strong>Google</strong>
                      <span>{providerMapExternalCount}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="workspace-modal-actions">
                {providerGoogleSearchUrl ? (
                  <a
                    href={providerGoogleSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button"
                  >
                    Open map search
                  </a>
                ) : null}
                <button type="button" className="button-secondary" onClick={() => setShowProviderMap(false)}>
                  Close map
                </button>
              </div>
            </div>
            <ProviderResultsMap
              propertyId={property?.id}
              categoryKey={providerSuggestionTask?.providerCategoryKey || providerSource?.categoryKey || ''}
              taskKey={providerSuggestionTask?.systemKey || providerSuggestionTask?.id || ''}
              includeExternal={providerMapScope === 'all'}
              limit={providerMapResultLimit}
              googleMapsUrl={providerGoogleSearchUrl}
              frameClassName="property-map-frame-expanded"
            />
            {providerMapDisplayedProviders.length ? (
              <div className="provider-map-summary-list">
                {providerMapScope === 'internal' && providerMapViewportProviders.length !== providerMapProviders.length ? (
                  <p className="workspace-control-note provider-map-summary-note">
                    The map is focused on matched Workside providers so the view stays local. Google fallback results remain available in the checklist list and through Google Maps.
                  </p>
                ) : null}
                {hiddenProviderMapCount ? (
                  <p className="workspace-control-note provider-map-summary-note">
                    Showing the top {providerMapDisplayedProviders.length} provider markers to keep the map readable. Switch to Expanded view to include {hiddenProviderMapCount} more.
                  </p>
                ) : null}
                {providerMapDisplayedProviders.map((provider) => (
                  <article key={`provider-map-summary-${provider.id}`} className="provider-map-summary-item">
                    <div>
                      <strong>{provider.businessName}</strong>
                      <span>
                        {provider.isExternalFallback ? 'Google fallback' : 'Workside marketplace'}
                        {provider.coverageLabel ? ` · ${provider.coverageLabel}` : ''}
                        {!provider.isExternalFallback && provider.status ? ` · ${provider.status.replace(/_/g, ' ')}` : ''}
                      </span>
                    </div>
                    <div className="provider-map-summary-meta">
                      {provider.turnaroundLabel ? <span>{provider.turnaroundLabel}</span> : null}
                      {provider.pricingSummary ? <span>{provider.pricingSummary}</span> : null}
                      {provider.phone ? <span>{provider.phone}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {activeProviderDetails ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setActiveProviderDetails(null)}>
          <div
            className="workspace-modal-card provider-details-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Provider details</span>
            <h2 id="provider-details-title">{activeProviderDetails.businessName}</h2>
            <p>
              {activeProviderDetails.description || 'No additional description is available for this provider yet.'}
            </p>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Category</strong>
                <span>{activeProviderDetails.categoryLabel || activeProviderDetails.categoryKey?.replace(/_/g, ' ') || 'Provider'}</span>
              </div>
              <div className="stat-card">
                <strong>Coverage</strong>
                <span>{activeProviderDetails.coverageLabel || 'Coverage not listed'}</span>
              </div>
              <div className="stat-card">
                <strong>Contact</strong>
                <span>{activeProviderDetails.phone || activeProviderDetails.email || 'Not listed'}</span>
              </div>
              <div className="stat-card">
                <strong>Source</strong>
                <span>{activeProviderDetails.isExternalFallback ? 'Google fallback' : 'Workside marketplace'}</span>
              </div>
            </div>
            <div className="provider-quality-row">
              {activeProviderDetails.turnaroundLabel ? <span>{activeProviderDetails.turnaroundLabel}</span> : null}
              {activeProviderDetails.pricingSummary ? <span>{activeProviderDetails.pricingSummary}</span> : null}
              {typeof activeProviderDetails.rating === 'number' && activeProviderDetails.rating > 0 ? (
                <span>
                  {activeProviderDetails.rating.toFixed(1)} stars
                  {activeProviderDetails.reviewCount ? ` · ${activeProviderDetails.reviewCount} reviews` : ''}
                </span>
              ) : null}
              {activeProviderDetails.serviceArea?.radiusMiles ? (
                <span>{activeProviderDetails.serviceArea.radiusMiles} mile radius</span>
              ) : null}
            </div>
            {activeProviderDetails.serviceHighlights?.length ? (
              <div className="tag-row">
                {activeProviderDetails.serviceHighlights.map((highlight) => (
                  <span key={`${activeProviderDetails.id}-${highlight}`}>{highlight}</span>
                ))}
              </div>
            ) : null}
            {!activeProviderDetails.isExternalFallback && activeProviderDetails.verification?.disclaimer ? (
              <p className="workspace-control-note provider-disclaimer">
                {activeProviderDetails.verification.disclaimer}
              </p>
            ) : null}
            <div className="workspace-modal-actions">
              {activeProviderDetails.websiteUrl ? (
                <a href={activeProviderDetails.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                  Visit website
                </a>
              ) : null}
              {activeProviderDetails.mapsUrl ? (
                <a href={activeProviderDetails.mapsUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                  Open in Maps
                </a>
              ) : null}
              <button type="button" className="button-secondary" onClick={() => setActiveProviderDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showExpandedMap ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setShowExpandedMap(false)}>
          <div
            className="workspace-modal-card workspace-map-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-map-title"
            aria-describedby="expanded-map-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-map-modal-header">
              <div>
                <span className="label">Expanded map</span>
                <h2 id="expanded-map-title">Neighborhood context</h2>
                <p id="expanded-map-description">
                  Review the subject property and nearby comps in a larger map view without leaving the workspace.
                </p>
              </div>
              <div className="workspace-modal-actions">
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button"
                  >
                    View comps in Maps
                  </a>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowExpandedMap(false)}
                >
                  Close map
                </button>
              </div>
            </div>
            <PropertyLocationMap
              property={property}
              comps={selectedComps}
              mapsApiKey={mapsApiKey}
              googleMapsUrl={googleMapsUrl}
              frameClassName="property-map-frame-expanded"
            />
          </div>
        </div>
      ) : null}

      <section className="workspace-shell">
        <section className="workspace-page-header">
          <div className="workspace-page-header-copy">
            <span className="label">Property workspace</span>
            <h1>{property?.title || 'Property'}</h1>
            <p className="workspace-address-line">{[property?.addressLine1, property?.city, property?.state, property?.zip].filter(Boolean).join(', ')}</p>
          <div className="tag-row">
            <span>{latestPricing ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}` : 'Pricing pending'}</span>
            {property?.selectedListPrice ? <span>Chosen {formatCurrency(property.selectedListPrice)}</span> : null}
            <span>{readinessScore}/100 readiness</span>
            <span>{mediaAssets.length} photo{mediaAssets.length === 1 ? '' : 's'}</span>
            {isArchivedProperty ? <span>Archived · read-only</span> : null}
          </div>
          </div>

          <div className="workspace-page-header-actions">
            <button type="button" className={status.includes('Refreshing') ? 'button-primary button-busy' : 'button-primary'} onClick={handleAnalyzePricing} disabled={Boolean(status) || isArchivedProperty}>{status.includes('Refreshing') ? 'Refreshing analysis...' : 'Refresh pricing'}</button>
            <Link href="/dashboard" className="button-secondary inline-button">Back to dashboard</Link>
          </div>
        </section>

        <section className="workspace-body-layout">
          <aside className="workspace-workflow-nav">
            <div className="content-card workspace-workflow-card">
              <span className="label">Workflow navigator</span>
              <h2>{guidedWorkflow?.completionPercent ?? 0}% complete</h2>
              <p>
                {guidedWorkflow?.currentPhaseLabel || 'Workflow'} ·{' '}
                {guidedWorkflow?.role === 'agent' ? 'Realtor guide' : 'Seller guide'}
              </p>
              <div className="mini-stats">
                <div className="stat-card">
                  <strong>Market-ready</strong>
                  <span>{guidedWorkflow?.marketReadyScore ?? readinessScore}/100</span>
                </div>
                <div className="stat-card">
                  <strong>Active step</strong>
                  <span>{workflowPreviewStep?.title || workflowNextStep?.title || 'Ready to review'}</span>
                </div>
              </div>
            </div>
            <div className="content-card workspace-workflow-card workspace-wizard-card workspace-workflow-nav-card">
              <span className="label">Guided steps</span>
              <div className="workspace-step-list workspace-step-list-compact">
                {workflowSteps.map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    className={`workspace-step-item workspace-step-item-${step.status}${workflowNextStep?.key === step.key ? ' active' : ''}${workflowPreviewStep?.key === step.key ? ' preview' : ''}${(!step.actionTarget && !step.actionHref) ? ' noninteractive' : ''}`}
                    onClick={() => {
                      setWorkflowPreviewStepKey(step.key);
                      openWorkflowStep(step);
                    }}
                    onMouseEnter={() => setWorkflowPreviewStepKey(step.key)}
                    onFocus={() => setWorkflowPreviewStepKey(step.key)}
                    aria-disabled={Boolean(status) || (!step.actionTarget && !step.actionHref)}
                  >
                    <div className="workspace-step-copy">
                      <strong>{step.title}</strong>
                      <span>{step.actionTarget ? getWorkspaceTabLabel(step.actionTarget) : 'Not ready yet'}</span>
                    </div>
                    <em className={`workspace-workflow-status workspace-workflow-status-${step.status}`}>{formatWorkflowStatus(step.status)}</em>
                  </button>
                ))}
              </div>
              <div className="workspace-workflow-hover-card">
                <strong>{workflowPreviewStep?.title || 'Hover over a step'}</strong>
                <p>{workflowPreviewStep?.description || 'Each workflow step explains what to do next and can jump you to the right part of the workspace.'}</p>
                {workflowPreviewStep?.status === 'locked' ? (
                  <p className="workspace-control-note">
                    Locked means an earlier required step still needs attention before this one opens.
                    {workflowPreviewStep?.lockedReason ? ` ${workflowPreviewStep.lockedReason}` : ''}
                  </p>
                ) : null}
                {workflowPreviewStep?.helperText ? (
                  <p className="workspace-control-note">{workflowPreviewStep.helperText}</p>
                ) : null}
                {workflowPreviewStep ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => openWorkflowStep(workflowPreviewStep)}
                    disabled={Boolean(status) || (!workflowPreviewStep.actionTarget && !workflowPreviewStep.actionHref)}
                  >
                    {workflowPreviewStep?.ctaLabel || 'Open this step'}
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
          <div ref={workspaceBodyMainRef} className="workspace-body-main">
            <section className="workspace-tab-bar" aria-label="Workspace tabs">
              {visibleWorkspaceTabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </section>

            {status ? <p className="status-copy">{status}</p> : null}
            {isArchivedProperty ? (
              <section className="workspace-archive-banner">
                <strong>Archived property</strong>
                <p>
                  This workspace remains viewable, but new pricing runs, media updates, checklist edits, provider actions,
                  and fresh flyer/report generation are disabled until the property is restored from the dashboard.
                </p>
                <p className="workspace-archive-detail">
                  Archiving frees an active-property slot. Restoring this workspace will use a slot again, and permanent delete will remove all linked outputs, providers, and activity records tied to this property.
                </p>
                <div className="workspace-archive-actions">
                  <Link href="/dashboard" className="button-secondary inline-button">
                    Manage on dashboard
                  </Link>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => setPendingDeleteProperty(property)}
                    disabled={Boolean(status)}
                  >
                    Delete permanently
                  </button>
                </div>
              </section>
            ) : null}

            <section className="workspace-content-layout">
              <div className="workspace-tab-main">{renderActiveTab()}</div>
              <aside className="workspace-quick-rail">
                {homeAdvisorGuide ? (
                  <div className="content-card workspace-quick-card workspace-guide-card">
                    <div className="workspace-guide-header">
                      <span className="label">Home Advisor Agent</span>
                      <button
                        type="button"
                        className="button-ghost workspace-guide-dismiss"
                        onClick={() => setIsHomeAdvisorGuideHidden(true)}
                        aria-label="Dismiss Home Advisor guide"
                      >
                        Hide
                      </button>
                    </div>
                    <h3>{homeAdvisorGuide.title}</h3>
                    <p>{homeAdvisorGuide.body}</p>
                    {homeAdvisorGuide.highlights?.length ? (
                      <div className="workspace-guide-chip-list">
                        {homeAdvisorGuide.highlights.map((highlight) => (
                          <span key={highlight} className="metric-pill">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="button-primary"
                      onClick={homeAdvisorGuide.ctaAction}
                      disabled={Boolean(status)}
                    >
                      {homeAdvisorGuide.ctaLabel}
                    </button>
                  </div>
                ) : (
                  <div className="content-card workspace-quick-card workspace-guide-card workspace-guide-card-muted">
                    <span className="label">Home Advisor Agent</span>
                    <p>The guide is hidden for this property. Bring it back any time if you want a simpler next-step prompt.</p>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setIsHomeAdvisorGuideHidden(false)}
                    >
                      Show guide
                    </button>
                  </div>
                )}
                <div className="content-card workspace-quick-card">
                  <span className="label">Next step</span>
                  <h3>{workflowNextStep?.title || nextBestAction.title}</h3>
                  <p>{workflowNextStep?.description || nextBestAction.detail}</p>
                  {workflowNextStep?.helperText ? (
                    <p className="workspace-control-note">{workflowNextStep.helperText}</p>
                  ) : null}
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => (workflowNextStep ? openWorkflowStep(workflowNextStep) : setActiveTab(nextBestAction.tab))}
                    disabled={Boolean(status)}
                  >
                    {workflowNextStep?.ctaLabel || `Open ${getWorkspaceTabLabel(nextBestAction.tab)}`}
                  </button>
                </div>
                <div className="content-card workspace-quick-card"><span className="label">Quick stats</span><ul className="plain-list"><li>{selectedComps.length} comp(s) loaded</li><li>{listingCandidateAssets.length} listing photo pick(s)</li><li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li><li>{checklist?.summary?.completedCount ?? 0} task(s) complete</li><li>{providerRecommendations.length} provider recommendation(s)</li></ul></div>
              </aside>
            </section>
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
