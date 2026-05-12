import { PHOTO_LIBRARY_CATEGORY_DEFINITIONS } from './workspaceVisionHelpers';

export const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'photos', label: 'Photos' },
  { id: 'seller_picks', label: 'Seller Picks' },
  { id: 'brochure', label: 'Flyer' },
  { id: 'report', label: 'Report' },
  { id: 'checklist', label: 'Checklist' },
];

export const HIDDEN_WORKSPACE_TABS = [{ id: 'vision', label: 'Vision workspace' }];

export const PHOTO_IMPORT_SOURCE_OPTIONS = [
  { value: 'web_upload', label: 'Web upload' },
  { value: 'third_party_import', label: 'Third-party import' },
];

export const PHOTO_IMPORT_ROOM_LABEL_OPTIONS = [
  ...PHOTO_LIBRARY_CATEGORY_DEFINITIONS.filter((category) => category.key !== 'other').map(
    (category) => category.label,
  ),
  'Other',
];

export const PHOTO_VARIATIONS_PAGE_SIZE = 12;

export const INITIAL_PHOTO_VARIATIONS_STATE = {
  assetId: '',
  variants: [],
  totalCount: 0,
  loadedCount: 0,
  isLoading: false,
  hasMore: false,
  error: '',
};

export const PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS = new Set([
  'account_created',
  'profile_complete',
  'property_added',
]);

export const DASHBOARD_FLASH_TOAST_KEY = 'worksideDashboardFlashToast';
export const HOME_ADVISOR_GUIDE_STORAGE_KEY_PREFIX = 'workside.homeAdvisorGuide.hidden';

export const REPORT_SECTION_OPTIONS = [
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

export const VISION_COMPLETION_SOUND_MIN_SECONDS = 15;
export const VISION_JOB_RECOVERY_LOOKBACK_MS = 90 * 1000;
export const VISION_JOB_RECOVERY_POLL_INTERVAL_MS = 4000;
export const VISION_JOB_RECOVERY_TIMEOUT_MS = 45 * 1000;
export const VISION_JOB_BACKGROUND_RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;

export const DEFAULT_WORKSPACE_SECTION_STATE = {
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
