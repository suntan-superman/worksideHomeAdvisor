'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { PropertyLocationMap } from '../../../components/PropertyLocationMap';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  createBillingCheckoutSession,
  createChecklistItem,
  createImageEnhancementJob,
  generateFlyer,
  generateReport,
  getChecklist,
  getDashboard,
  getFlyerExportUrl,
  getLatestFlyer,
  getLatestPricing,
  getLatestReport,
  getProperty,
  getReportExportUrl,
  listMediaAssets,
  listMediaVariants,
  selectMediaVariant,
  updateChecklistItem,
  updateMediaAsset,
} from '../../../lib/api';
import { getStoredSession, setStoredSession } from '../../../lib/session';

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'photos', label: 'Photos' },
  { id: 'vision', label: 'Vision' },
  { id: 'brochure', label: 'Brochure' },
  { id: 'report', label: 'Report' },
  { id: 'checklist', label: 'Checklist' },
];

const REPORT_SECTION_OPTIONS = [
  { id: 'executive_summary', label: 'Executive Summary' },
  { id: 'pricing_analysis', label: 'Pricing Analysis' },
  { id: 'comparable_properties', label: 'Comparable Properties' },
  { id: 'photo_review', label: 'Photo Review Summary' },
  { id: 'readiness_score', label: 'Readiness Score' },
  { id: 'improvement_recommendations', label: 'Improvement Recommendations' },
  { id: 'seller_checklist', label: 'Seller Checklist' },
  { id: 'marketing_guidance', label: 'Marketing Guidance' },
  { id: 'draft_listing_description', label: 'Draft Listing Description' },
];

function buildAddressQuery(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

function formatChecklistStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To do';
}

function formatChecklistCategory(category) {
  return String(category || 'custom')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatChecklistPriority(priority) {
  return `${String(priority || 'medium').replace(/\b\w/g, (character) => character.toUpperCase())} priority`;
}

function getPreferredVariantLabel(item) {
  return item?.variantLabel || 'Preferred vision variant';
}

function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This prototype variant is available for flyer and report selection once marked preferred.'
  );
}

export function PropertyWorkspaceClient({ propertyId, mapsApiKey = '' }) {
  const flyerPreviewRef = useRef(null);
  const visionCompareRef = useRef(null);
  const visionGalleryRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [mediaVariants, setMediaVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [flyerType, setFlyerType] = useState('sale');
  const [flyerHeadlineDraft, setFlyerHeadlineDraft] = useState('');
  const [flyerSubheadlineDraft, setFlyerSubheadlineDraft] = useState('');
  const [flyerSummaryDraft, setFlyerSummaryDraft] = useState('');
  const [flyerCallToActionDraft, setFlyerCallToActionDraft] = useState('');
  const [flyerSelectedPhotoIds, setFlyerSelectedPhotoIds] = useState([]);
  const [reportTitleDraft, setReportTitleDraft] = useState('');
  const [reportExecutiveSummaryDraft, setReportExecutiveSummaryDraft] = useState('');
  const [reportListingDescriptionDraft, setReportListingDescriptionDraft] = useState('');
  const [reportSelectedPhotoIds, setReportSelectedPhotoIds] = useState([]);
  const [reportIncludedSections, setReportIncludedSections] = useState(
    REPORT_SECTION_OPTIONS.map((section) => section.id),
  );
  const [listingNoteDraft, setListingNoteDraft] = useState('');
  const [customChecklistTitle, setCustomChecklistTitle] = useState('');
  const [customChecklistDetail, setCustomChecklistDetail] = useState('');
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);

  const selectedMediaAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || mediaAssets[0] || null,
    [mediaAssets, selectedMediaAssetId],
  );
  const listingCandidateAssets = useMemo(
    () => mediaAssets.filter((asset) => asset.listingCandidate),
    [mediaAssets],
  );
  const brochurePhotoPool = useMemo(
    () => (listingCandidateAssets.length ? listingCandidateAssets : mediaAssets),
    [listingCandidateAssets, mediaAssets],
  );
  const reportPhotoPool = useMemo(() => mediaAssets, [mediaAssets]);
  const selectedVariant = useMemo(
    () =>
      mediaVariants.find((variant) => variant.id === selectedVariantId) ||
      mediaVariants.find((variant) => variant.isSelected) ||
      mediaVariants[0] ||
      null,
    [mediaVariants, selectedVariantId],
  );
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
  const recentOutputs = useMemo(
    () =>
      [
        latestFlyer
          ? { key: 'brochure', label: 'Brochure', title: latestFlyer.headline, detail: latestFlyer.summary, tab: 'brochure' }
          : null,
        latestReport
          ? { key: 'report', label: 'Report', title: latestReport.title, detail: latestReport.executiveSummary, tab: 'report' }
          : null,
      ].filter(Boolean),
    [latestFlyer, latestReport],
  );
  const nextBestAction = useMemo(() => {
    if (!mediaAssets.length) {
      return { title: 'Review the photo set', detail: 'Use the Photos tab to work from the shared mobile gallery and start building listing picks.', tab: 'photos' };
    }
    if (!listingCandidateAssets.length) {
      return { title: 'Select listing photos', detail: 'Choose the strongest images so brochure and report output prioritize them automatically.', tab: 'photos' };
    }
    if (!selectedVariant && selectedMediaAsset) {
      return { title: 'Generate a vision variant', detail: 'Create an enhanced or decluttered version before final brochure and report generation.', tab: 'vision' };
    }
    if (!latestFlyer) {
      return { title: 'Generate the brochure', detail: 'Turn pricing and photo selection into a seller-facing brochure draft.', tab: 'brochure' };
    }
    if (!latestReport) {
      return { title: 'Generate the report', detail: 'Package pricing, photos, and checklist progress into a premium deliverable.', tab: 'report' };
    }
    if (checklist?.nextTask?.title) {
      return { title: checklist.nextTask.title, detail: checklist.nextTask.detail || 'Keep the checklist moving with the next prep step.', tab: 'checklist' };
    }
    return { title: 'Review the latest outputs', detail: 'Both brochure and report are ready. Use Overview to compare the latest deliverables.', tab: 'overview' };
  }, [checklist?.nextTask?.detail, checklist?.nextTask?.title, latestFlyer, latestReport, listingCandidateAssets.length, mediaAssets.length, selectedMediaAsset, selectedVariant]);

  useEffect(() => {
    setListingNoteDraft(selectedMediaAsset?.listingNote || '');
  }, [selectedMediaAsset?.id, selectedMediaAsset?.listingNote]);

  useEffect(() => {
    const nextSession = { ...(getStoredSession() || {}), lastPropertyId: propertyId };
    setStoredSession(nextSession);
  }, [propertyId]);

  useEffect(() => {
    setActiveTab('overview');
  }, [propertyId]);

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

  async function refreshMediaAssets(preferredAssetId = selectedMediaAssetId) {
    const mediaResponse = await listMediaAssets(propertyId);
    const nextAssets = mediaResponse.assets || [];
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId(preferredAssetId || nextAssets?.[0]?.id || '');
    return nextAssets;
  }

  async function refreshMediaVariants(assetId = selectedMediaAssetId) {
    if (!assetId) {
      setMediaVariants([]);
      setSelectedVariantId('');
      return [];
    }
    const variantsResponse = await listMediaVariants(assetId);
    const nextVariants = variantsResponse.variants || [];
    setMediaVariants(nextVariants);
    setSelectedVariantId(nextVariants.find((variant) => variant.isSelected)?.id || nextVariants[0]?.id || '');
    return nextVariants;
  }

  async function refreshDashboardSnapshot() {
    const dashboardResponse = await getDashboard(propertyId);
    setDashboard(dashboardResponse);
    if (dashboardResponse?.property) {
      setProperty(dashboardResponse.property);
    }
    return dashboardResponse;
  }

  async function refreshChecklist() {
    const checklistResponse = await getChecklist(propertyId);
    setChecklist(checklistResponse.checklist);
    return checklistResponse.checklist;
  }

  useEffect(() => {
    refreshMediaVariants(selectedMediaAsset?.id).catch(() => {
      setMediaVariants([]);
      setSelectedVariantId('');
    });
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    async function loadWorkspace() {
      setStatus('Loading property workspace...');
      setToast(null);
      try {
        const [propertyResponse, dashboardResponse, checklistResponse] = await Promise.all([
          getProperty(propertyId),
          getDashboard(propertyId),
          getChecklist(propertyId),
        ]);
        setProperty(propertyResponse.property);
        setDashboard(dashboardResponse);
        setChecklist(checklistResponse.checklist);
        try {
          const pricingResponse = await getLatestPricing(propertyId);
          setLatestPricing(pricingResponse.analysis);
        } catch {
          setLatestPricing(null);
        }
        try {
          const flyerResponse = await getLatestFlyer(propertyId);
          setLatestFlyer(flyerResponse.flyer);
        } catch {
          setLatestFlyer(null);
        }
        try {
          const reportResponse = await getLatestReport(propertyId);
          setLatestReport(reportResponse.report);
        } catch {
          setLatestReport(null);
        }
        try {
          await refreshMediaAssets();
        } catch {
          setMediaAssets([]);
          setSelectedMediaAssetId('');
        }
      } catch (requestError) {
        setToast({ tone: 'error', title: 'Could not load property', message: requestError.message });
      } finally {
        setStatus('');
      }
    }
    loadWorkspace();
  }, [propertyId]);

  async function handleAnalyzePricing() {
    setStatus('Refreshing RentCast + AI pricing analysis...');
    setToast(null);
    try {
      const analysisResponse = await analyzePricing(propertyId);
      const [dashboardResponse, checklistResponse] = await Promise.all([refreshDashboardSnapshot(), refreshChecklist()]);
      setLatestPricing(analysisResponse.analysis);
      setDashboard(dashboardResponse);
      setChecklist(checklistResponse);
      setToast({ tone: 'success', title: 'Pricing refreshed', message: 'The latest analysis and comp set are ready.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Pricing refresh failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateFlyer() {
    setStatus(`Generating ${flyerType} flyer...`);
    setToast(null);
    try {
      const response = await generateFlyer(propertyId, flyerType, {
        headline: flyerHeadlineDraft,
        subheadline: flyerSubheadlineDraft,
        summary: flyerSummaryDraft,
        callToAction: flyerCallToActionDraft,
        selectedPhotoAssetIds: flyerSelectedPhotoIds,
      });
      setLatestFlyer(response.flyer);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist()]);
      setToast({ tone: 'success', title: 'Flyer generated', message: 'A fresh flyer draft is ready below.' });
      requestAnimationFrame(() => {
        flyerPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (requestError) {
      if (requestError.status === 402 && requestError.details?.suggestedPlan) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');
          try {
            const checkout = await createBillingCheckoutSession({ userId: session.user.id, planKey: requestError.details.suggestedPlan }, session.user.id);
            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({ tone: 'error', title: 'Billing required', message: checkoutError.message });
            setStatus('');
            return;
          }
        }
      }
      setToast({ tone: 'error', title: 'Flyer generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateReport() {
    setStatus('Generating seller intelligence report...');
    setToast(null);
    try {
      const response = await generateReport(propertyId, {
        title: reportTitleDraft,
        executiveSummary: reportExecutiveSummaryDraft,
        listingDescription: reportListingDescriptionDraft,
        selectedPhotoAssetIds: reportSelectedPhotoIds,
        includedSections: reportIncludedSections,
      });
      setLatestReport(response.report);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist()]);
      setToast({ tone: 'success', title: 'Report generated', message: 'A fresh property report preview is ready below.' });
    } catch (requestError) {
      if (requestError.status === 402 && requestError.details?.suggestedPlan) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');
          try {
            const checkout = await createBillingCheckoutSession({ userId: session.user.id, planKey: requestError.details.suggestedPlan }, session.user.id);
            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({ tone: 'error', title: 'Billing required', message: checkoutError.message });
            setStatus('');
            return;
          }
        }
      }
      setToast({ tone: 'error', title: 'Report generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleToggleListingCandidate() {
    if (!selectedMediaAsset) {
      return;
    }
    const nextValue = !selectedMediaAsset.listingCandidate;
    setStatus(nextValue ? 'Marking photo as listing candidate...' : 'Removing listing-candidate mark...');
    setToast(null);
    try {
      await updateMediaAsset(selectedMediaAsset.id, { listingCandidate: nextValue });
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshDashboardSnapshot(), refreshChecklist()]);
      setToast({ tone: 'success', title: nextValue ? 'Listing candidate selected' : 'Listing candidate removed', message: nextValue ? 'This photo will now be prioritized for flyer generation.' : 'This photo will no longer be prioritized for the flyer.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not update photo', message: requestError.message });
    } finally {
      setStatus('');
    }
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

  async function handleSaveListingNote() {
    if (!selectedMediaAsset) {
      return;
    }
    setStatus('Saving photo note...');
    setToast(null);
    try {
      await updateMediaAsset(selectedMediaAsset.id, { listingNote: listingNoteDraft });
      await refreshMediaAssets(selectedMediaAsset.id);
      setToast({ tone: 'success', title: 'Photo note saved', message: 'Your note will stay attached to this photo for listing review.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not save note', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateVariant(jobType) {
    if (!selectedMediaAsset) {
      return;
    }
    setActiveTab('vision');
    setStatus(jobType === 'declutter_preview' ? 'Generating declutter preview...' : 'Generating enhanced listing version...');
    setToast(null);
    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, { jobType });
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id)]);
      setSelectedVariantId(response.variant?.id || '');
      setToast({
        tone: 'success',
        title:
          jobType === 'declutter_preview'
            ? 'Declutter preview ready'
            : 'Enhanced photo ready',
        message:
          response.job?.warning ||
          'The new image is now shown in the Vision compare area and the Generated options panel.',
      });
      requestAnimationFrame(() => {
        visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Variant generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSelectVariant(variantId) {
    if (!selectedMediaAsset) {
      return;
    }
    setStatus('Selecting preferred variant...');
    setToast(null);
    try {
      await selectMediaVariant(selectedMediaAsset.id, variantId);
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id)]);
      setSelectedVariantId(variantId);
      setToast({ tone: 'success', title: 'Preferred variant selected', message: 'Flyer and report generation will now prefer this image variant.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not select variant', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSetChecklistItemStatus(itemId, nextStatus) {
    setStatus(nextStatus === 'done' ? 'Marking checklist item done...' : 'Updating checklist item...');
    setToast(null);
    try {
      const response = await updateChecklistItem(itemId, { status: nextStatus });
      setChecklist(response.checklist);
      await refreshDashboardSnapshot();
      setToast({ tone: 'success', title: 'Checklist updated', message: 'Seller prep progress has been saved.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Checklist update failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleCreateChecklistTask(event) {
    event.preventDefault();
    if (!customChecklistTitle.trim()) {
      setToast({ tone: 'error', title: 'Task title required', message: 'Add a short title before creating a custom checklist task.' });
      return;
    }
    setStatus('Saving custom checklist task...');
    setToast(null);
    try {
      const response = await createChecklistItem(propertyId, { title: customChecklistTitle, detail: customChecklistDetail, category: 'custom', priority: 'medium' });
      setChecklist(response.checklist);
      await refreshDashboardSnapshot();
      setCustomChecklistTitle('');
      setCustomChecklistDetail('');
      setToast({ tone: 'success', title: 'Task added', message: 'The custom checklist task now appears in the shared property workflow.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not add task', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  function handleDownloadFlyerPdf() {
    const exportUrl = getFlyerExportUrl(propertyId, flyerType);
    window.open(exportUrl, '_blank', 'noopener,noreferrer');
  }

  function handleDownloadReportPdf() {
    const exportUrl = getReportExportUrl(propertyId);
    window.open(exportUrl, '_blank', 'noopener,noreferrer');
  }

  const addressQuery = buildAddressQuery(property);
  const googleMapsUrl = addressQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}` : null;

  const renderOverviewTab = () => (
    <div className="workspace-tab-stack">
      <div className="content-card workspace-hero-card">
        <span className="label">Overview</span>
        <h2>Snapshot for this property</h2>
        <p>{latestReport?.executiveSummary || latestPricing?.summary || dashboard?.pricingSummary || 'Use the workspace tabs to move from pricing to photos, brochure, report, and checklist work.'}</p>
        <div className="mini-stats">
          <div className="stat-card">
            <strong>Price band</strong>
            <span>{latestPricing ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}` : 'Run pricing analysis'}</span>
          </div>
          <div className="stat-card">
            <strong>Confidence</strong>
            <span>{latestPricing?.confidenceScore ? `${Math.round(latestPricing.confidenceScore * 100)}%` : 'Pending'}</span>
          </div>
          <div className="stat-card">
            <strong>Readiness</strong>
            <span>{readinessScore}/100</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">AI summary</span>
        <h2>What the workspace is signaling</h2>
        <p>{latestReport?.payload?.marketingGuidance?.shortDescription || latestPricing?.pricingStrategy || 'The strongest next step is to turn pricing and photo selection into brochure and report output.'}</p>
        <ul className="plain-list">
          <li>{listingCandidateAssets.length} seller-selected photo pick(s)</li>
          <li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li>
          <li>{checklist?.summary?.completedCount ?? 0} checklist task(s) complete</li>
        </ul>
      </div>

      <div className="content-card">
        <span className="label">Recent outputs</span>
        <h2>Latest deliverables</h2>
        {recentOutputs.length ? (
          <div className="workspace-output-list">
            {recentOutputs.map((output) => (
              <button key={output.key} type="button" className="workspace-output-card" onClick={() => setActiveTab(output.tab)}>
                <span className="label">{output.label}</span>
                <strong>{output.title}</strong>
                <span>{output.detail}</span>
              </button>
            ))}
          </div>
        ) : (
          <p>No brochure or report output has been generated yet.</p>
        )}
      </div>
    </div>
  );

  const renderPricingTab = () => (
    <div className="workspace-tab-stack">
      <div className="workspace-two-column workspace-pricing-grid">
        <div className="content-card property-map-card">
          <div className="property-map-header">
            <div>
              <span className="label">Pricing map</span>
              <h2>Neighborhood context</h2>
              <p>Review the home and nearby comps side by side instead of in a long stack.</p>
            </div>
            {googleMapsUrl ? (
              <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button button-no-wrap">
                Open in Google Maps
              </a>
            ) : null}
          </div>
          {addressQuery ? (
            <PropertyLocationMap property={property} comps={selectedComps} mapsApiKey={mapsApiKey} googleMapsUrl={googleMapsUrl} />
          ) : (
            <p>No map available until the property address is complete.</p>
          )}
        </div>

        <div className="content-card workspace-side-panel">
          <div className="section-header-tight">
            <div>
              <span className="label">Selected comps</span>
              <h2>Nearby sales</h2>
            </div>
            <span className="section-header-meta">{selectedComps.length} comps shown</span>
          </div>
          <div className="comp-grid comp-grid-scroll workspace-scroll-panel">
            {selectedComps.length ? (
              selectedComps.map((comp) => (
                <article key={comp.externalId || comp._id || comp.address} className="comp-card">
                  <strong>{comp.address}</strong>
                  <span>{formatCurrency(comp.price)}</span>
                  <span>{(comp.distanceMiles || 0).toFixed(2)} mi away</span>
                  <span>{comp.beds || '--'} bd · {comp.baths || '--'} ba · {comp.sqft || '--'} sqft</span>
                  {comp.saleDate ? <span>Sold/listed: {new Date(comp.saleDate).toLocaleDateString()}</span> : null}
                  {typeof comp.score === 'number' ? <span>Comp score: {Math.round(comp.score * 100)}</span> : null}
                </article>
              ))
            ) : (
              <p>No comps are stored yet. Refresh pricing to build the comp set.</p>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Pricing narrative</span>
        <h2>Latest analysis</h2>
        <p>{latestPricing?.summary || dashboard?.pricingSummary || 'No stored narrative yet.'}</p>
        {latestPricing?.pricingStrategy ? <p><strong>Strategy:</strong> {latestPricing.pricingStrategy}</p> : null}
      </div>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="workspace-two-column workspace-photos-grid">
      <div className="content-card">
        <div className="section-header-tight">
          <div>
            <span className="label">Photos</span>
            <h2>Shared property gallery</h2>
          </div>
          <span className="section-header-meta">{mediaAssets.length} saved photo{mediaAssets.length === 1 ? '' : 's'}</span>
        </div>

        {listingCandidateAssets.length ? (
          <div className="property-media-candidate-strip">
            <div className="property-media-candidate-header">
              <div>
                <span className="label">Best listing photos</span>
                <h3>Seller-selected candidates</h3>
              </div>
              <span className="section-header-meta">{listingCandidateAssets.length} chosen</span>
            </div>
            <div className="property-media-candidate-list">
              {listingCandidateAssets.map((asset) => (
                <button key={`candidate-${asset.id}`} type="button" className={asset.id === selectedMediaAsset?.id ? 'property-media-candidate-card active' : 'property-media-candidate-card'} onClick={() => setSelectedMediaAssetId(asset.id)}>
                  <img src={asset.imageUrl} alt={asset.roomLabel || 'Listing candidate'} />
                  <div className="property-media-candidate-meta">
                    <strong>{asset.roomLabel}</strong>
                    <span>{asset.listingNote || 'Ready for flyer and listing materials'}</span>
                    {asset.selectedVariant ? <em className="property-media-candidate-tag">{asset.selectedVariant.label || 'Preferred vision variant ready'}</em> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mediaAssets.length ? (
          <div className="property-media-rail property-photo-grid">
            {mediaAssets.map((asset) => (
              <button key={asset.id} type="button" className={asset.id === selectedMediaAsset?.id ? 'property-media-thumb active' : 'property-media-thumb'} onClick={() => setSelectedMediaAssetId(asset.id)}>
                <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
                <div>
                  <strong>{asset.roomLabel}</strong>
                  {asset.selectedVariant ? <small>{asset.selectedVariant.label || 'Vision preferred'}</small> : asset.listingCandidate ? <small>Seller pick</small> : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p>No photos have been saved for this property yet. Capture them in the mobile app first.</p>
        )}
      </div>

      <div className="content-card workspace-side-panel photo-detail-panel">
        <div className="section-header-tight">
          <div>
            <span className="label">Selected photo</span>
            <h2>{selectedMediaAsset?.roomLabel || 'Choose a photo'}</h2>
          </div>
        </div>
        {selectedMediaAsset ? (
          <div className="workspace-tab-stack">
            <img src={selectedMediaAsset.imageUrl} alt={selectedMediaAsset.roomLabel || 'Selected property photo'} className="property-media-hero" />
            <p>
              Saved {new Date(selectedMediaAsset.createdAt).toLocaleDateString()}
              {selectedMediaAsset.analysis?.roomGuess ? ` · AI sees ${selectedMediaAsset.analysis.roomGuess.toLowerCase()}` : ''}
            </p>
            <p>{selectedMediaAsset.analysis?.summary || 'No AI photo summary is stored for this image yet.'}</p>
            {typeof selectedMediaAsset.analysis?.overallQualityScore === 'number' ? (
              <div className="property-media-badges">
                <span>Quality {selectedMediaAsset.analysis.overallQualityScore}/100</span>
                {typeof selectedMediaAsset.analysis?.lightingScore === 'number' ? <span>Light {selectedMediaAsset.analysis.lightingScore}/100</span> : null}
                {typeof selectedMediaAsset.analysis?.compositionScore === 'number' ? <span>Composition {selectedMediaAsset.analysis.compositionScore}/100</span> : null}
                {selectedMediaAsset.analysis?.retakeRecommended ? <span>Retake suggested</span> : <span>Ready for listing review</span>}
              </div>
            ) : null}
            <div className="workspace-action-column">
              <button type="button" className={selectedMediaAsset.listingCandidate ? 'button-secondary' : 'button-primary'} onClick={handleToggleListingCandidate} disabled={Boolean(status)}>
                {selectedMediaAsset.listingCandidate ? 'Remove from listing picks' : 'Mark as listing candidate'}
              </button>
              <button type="button" className="button-secondary" onClick={() => { setActiveTab('vision'); handleGenerateVariant('enhance_listing_quality'); }} disabled={Boolean(status)}>
                Enhance
              </button>
              <button type="button" className="button-secondary" onClick={() => { setActiveTab('vision'); handleGenerateVariant('declutter_preview'); }} disabled={Boolean(status)}>
                Declutter
              </button>
            </div>
            <label className="property-media-note-field">
              Listing note
              <textarea value={listingNoteDraft} onChange={(event) => setListingNoteDraft(event.target.value)} maxLength={280} placeholder="Why this photo is strong, what it should lead with, or where it belongs in the story." />
            </label>
            <button type="button" className="button-secondary" onClick={handleSaveListingNote} disabled={Boolean(status)}>
              Save photo note
            </button>
          </div>
        ) : (
          <p>Select a photo to review details and take action.</p>
        )}
      </div>
    </div>
  );

  const renderVisionTab = () => (
    <div className="workspace-tab-stack">
      <div ref={visionCompareRef} className="content-card">
        <div className="section-header-tight">
          <div>
            <span className="label">Vision workspace</span>
            <h2>Before and after</h2>
          </div>
          <span className="section-header-meta">{selectedVariant ? selectedVariant.label : 'No variant selected yet'}</span>
        </div>
        {selectedMediaAsset ? (
          <div className="property-media-variant-panel">
            <div className="property-media-variant-compare">
              <div>
                <span className="label">Original</span>
                <p className="property-media-variant-caption">Untouched mobile capture.</p>
                <img src={selectedMediaAsset.imageUrl} alt={selectedMediaAsset.roomLabel || 'Original property photo'} className="property-media-variant-image" />
              </div>
              <div>
                <span className="label">Vision output</span>
                <p className="property-media-variant-caption">{selectedVariant ? getVariantSummary(selectedVariant) : 'Generate a variant to compare the output.'}</p>
                {selectedVariant ? (
                  <img src={selectedVariant.imageUrl} alt={selectedVariant.label || 'Generated image variant'} className="property-media-variant-image" />
                ) : (
                  <div className="property-media-variant-empty">Generate an enhanced version or declutter preview to begin comparison.</div>
                )}
              </div>
            </div>
            {selectedVariant?.metadata?.effects?.length ? (
              <div className="property-media-variant-effects">
                {selectedVariant.metadata.effects.map((effect) => <span key={effect}>{effect}</span>)}
              </div>
            ) : null}
            {selectedVariant?.metadata?.differenceHint ? <p className="property-media-variant-hint">{selectedVariant.metadata.differenceHint}</p> : null}
            {selectedVariant ? <p className="workspace-control-note">The generated version appears here. The Generated options panel below is where you switch between saved variants.</p> : null}
          </div>
        ) : (
          <p>Select a photo in the Photos tab first to use the Vision workspace.</p>
        )}
      </div>

      <div className="workspace-two-column">
        <div className="content-card">
          <span className="label">Action presets</span>
          <h2>Generate a stronger version</h2>
          {selectedMediaAsset ? (
            <>
              <p>Current source photo: <strong>{selectedMediaAsset.roomLabel}</strong></p>
              <div className="workspace-action-column">
                <button type="button" className="button-primary" onClick={() => handleGenerateVariant('enhance_listing_quality')} disabled={Boolean(status)}>
                  Generate enhanced version
                </button>
                <button type="button" className="button-secondary" onClick={() => handleGenerateVariant('declutter_preview')} disabled={Boolean(status)}>
                  Create declutter preview
                </button>
              </div>
              <div className="property-media-rail property-photo-grid compact">
                {mediaAssets.map((asset) => (
                  <button key={`vision-source-${asset.id}`} type="button" className={asset.id === selectedMediaAsset?.id ? 'property-media-thumb active' : 'property-media-thumb'} onClick={() => setSelectedMediaAssetId(asset.id)}>
                    <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
                    <div><strong>{asset.roomLabel}</strong></div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>No photo is selected yet.</p>
          )}
        </div>

        <div ref={visionGalleryRef} className="content-card workspace-side-panel">
          <span className="label">Variant gallery</span>
          <h2>Generated options</h2>
          {mediaVariants.length ? (
            <div className="workspace-tab-stack">
              {selectedVariant ? (
                <div className="property-media-variant-selected-card">
                  <img
                    src={selectedVariant.imageUrl}
                    alt={selectedVariant.label || 'Selected generated variant'}
                    className="property-media-variant-selected-image"
                  />
                  <div className="property-media-variant-selected-copy">
                    <strong>{selectedVariant.label}</strong>
                    <span>
                      {selectedVariant.isSelected
                        ? 'Currently selected for flyer and report materials'
                        : 'Preview this version, then select it for materials if you want to use it'}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="property-media-variant-list">
                {mediaVariants.map((variant) => (
                  <button key={variant.id} type="button" className={variant.id === selectedVariant?.id ? 'property-media-variant-chip active' : 'property-media-variant-chip'} onClick={() => setSelectedVariantId(variant.id)}>
                    {variant.label}
                    {variant.isSelected ? ' · Preferred' : ''}
                  </button>
                ))}
              </div>
              {selectedVariant?.metadata?.warning ? <p>{selectedVariant.metadata.warning}</p> : null}
              {selectedVariant ? (
                <button type="button" className="button-secondary" onClick={() => handleSelectVariant(selectedVariant.id)} disabled={Boolean(status) || selectedVariant.isSelected}>
                  {selectedVariant.isSelected ? 'Preferred variant selected' : 'Use this variant in materials'}
                </button>
              ) : null}
            </div>
          ) : (
            <p>No variants exist for this photo yet. Generate one from the action presets.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderBrochureTab = () => (
    <div className="workspace-two-column">
      <div className="content-card flyer-generator-card">
        <div className="workspace-tab-stack">
          <span className="label">Brochure controls</span>
          <h2>AI flyer draft</h2>
          <p>Generate a brochure-style flyer from live pricing, selected photos, and the strongest seller-ready language.</p>
          <div className="mode-switch">
            <button type="button" className={flyerType === 'sale' ? 'mode-chip active' : 'mode-chip'} onClick={() => setFlyerType('sale')}>Sale flyer</button>
            <button type="button" className={flyerType === 'rental' ? 'mode-chip active' : 'mode-chip'} onClick={() => setFlyerType('rental')}>Rental flyer</button>
          </div>
          <div className="mini-stats">
            <div className="stat-card"><strong>Listing picks</strong><span>{listingCandidateAssets.length} chosen</span></div>
            <div className="stat-card"><strong>Vision-ready</strong><span>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred variants</span></div>
            <div className="stat-card"><strong>Price source</strong><span>{latestPricing ? 'Live pricing attached' : 'Using latest saved pricing'}</span></div>
          </div>
          <div className="workspace-inner-card brochure-control-card">
            <span className="label">Headline + copy plan</span>
            <div className="brochure-control-grid brochure-control-grid-form">
              <label className="workspace-control-field">
                <span>Headline</span>
                <input
                  type="text"
                  value={flyerHeadlineDraft}
                  onChange={(event) => setFlyerHeadlineDraft(event.target.value)}
                  placeholder="Seller-ready headline"
                  maxLength={140}
                />
              </label>
              <label className="workspace-control-field">
                <span>Subheadline</span>
                <input
                  type="text"
                  value={flyerSubheadlineDraft}
                  onChange={(event) => setFlyerSubheadlineDraft(event.target.value)}
                  placeholder="Short positioning line"
                  maxLength={220}
                />
              </label>
              <label className="workspace-control-field workspace-control-field-full">
                <span>Summary</span>
                <textarea
                  value={flyerSummaryDraft}
                  onChange={(event) => setFlyerSummaryDraft(event.target.value)}
                  placeholder="How should this brochure frame the property?"
                  maxLength={600}
                />
              </label>
              <label className="workspace-control-field workspace-control-field-full">
                <span>Call to action</span>
                <input
                  type="text"
                  value={flyerCallToActionDraft}
                  onChange={(event) => setFlyerCallToActionDraft(event.target.value)}
                  placeholder="What should the seller or buyer do next?"
                  maxLength={180}
                />
              </label>
            </div>
          </div>
          <div className="workspace-inner-card brochure-control-card">
            <span className="label">Image selection</span>
            {brochurePhotoPool.length ? (
              <div className="brochure-photo-plan">
                {brochurePhotoPool.slice(0, 6).map((asset) => (
                    <button
                      key={`brochure-photo-${asset.id}`}
                      type="button"
                      className={
                        flyerSelectedPhotoIds.includes(asset.id)
                          ? 'brochure-photo-plan-card active'
                          : 'brochure-photo-plan-card'
                      }
                      onClick={() => toggleFlyerPhotoSelection(asset.id)}
                    >
                      <img src={asset.imageUrl} alt={asset.roomLabel || 'Brochure candidate'} />
                      <div>
                        <strong>{asset.roomLabel}</strong>
                        <span>
                          {asset.listingNote ||
                            (asset.selectedVariant
                              ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                              : 'Available for brochure use')}
                        </span>
                        <em>{flyerSelectedPhotoIds.includes(asset.id) ? 'Included in brochure' : 'Click to include'}</em>
                      </div>
                    </button>
                  ))}
              </div>
            ) : (
              <p>No photos are available yet. Add them in mobile, then return here to shape the brochure.</p>
            )}
            <p className="workspace-control-note">
              Up to 4 photos are used. Seller picks stay prioritized, and preferred vision variants still flow through automatically.
            </p>
          </div>
          <div className="button-stack flyer-generator-actions">
            <button type="button" className={status.includes('Generating') ? 'button-primary button-busy' : 'button-primary'} onClick={handleGenerateFlyer} disabled={Boolean(status)}>
              {status.includes('Generating') ? 'Generating flyer...' : 'Generate flyer'}
            </button>
            <button type="button" className="button-secondary" onClick={handleDownloadFlyerPdf} disabled={Boolean(status)}>Download PDF</button>
          </div>
        </div>
      </div>

      <div ref={flyerPreviewRef} className="content-card">
        <span className="label">Live preview</span>
        {latestFlyer ? (
          <div className="flyer-preview">
            <div className="flyer-hero">
              <span className="label">{latestFlyer.flyerType} flyer</span>
              <h2>{latestFlyer.headline}</h2>
              <p>{latestFlyer.subheadline}</p>
              <div className="mini-stats">
                <div className="stat-card"><strong>Price</strong><span>{latestFlyer.priceText}</span></div>
                <div className="stat-card"><strong>Location</strong><span>{latestFlyer.locationLine}</span></div>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                <span>{latestFlyer.customizations?.selectedPhotoAssetIds?.length || latestFlyer.selectedPhotos?.length || 0} selected photos</span>
                <span>{latestFlyer.customizations?.headline ? 'Custom headline' : 'AI headline'}</span>
                <span>{latestFlyer.customizations?.summary ? 'Custom summary' : 'AI summary'}</span>
              </div>
            </div>
            {latestFlyer.selectedPhotos?.length ? (
              <div className="flyer-photo-grid">
                {latestFlyer.selectedPhotos.slice(0, 4).map((photo) => (
                  <div key={photo.assetId || photo.imageUrl} className="flyer-photo-card">
                    {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Property photo'} /> : null}
                    <span>{photo.roomLabel || 'Selected photo'}</span>
                    <div className="flyer-photo-badges">
                      {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                      {photo.usesPreferredVariant ? <strong className="flyer-photo-badge flyer-photo-badge-vision">{getPreferredVariantLabel(photo)}</strong> : null}
                    </div>
                    {photo.listingNote ? <em className="flyer-photo-note">{photo.listingNote}</em> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p>{latestFlyer.summary}</p>
            <ul className="plain-list">{(latestFlyer.highlights || []).map((item) => <li key={item}>{item}</li>)}</ul>
            <p><strong>CTA:</strong> {latestFlyer.callToAction}</p>
            <div className="brochure-preview-sections">
              <div className="brochure-preview-card">
                <span className="label">Headline</span>
                <strong>{latestFlyer.headline}</strong>
                <p>{latestFlyer.subheadline}</p>
              </div>
              <div className="brochure-preview-card">
                <span className="label">Highlights</span>
                <ul className="plain-list">
                  {(latestFlyer.highlights || []).slice(0, 4).map((item) => <li key={`highlight-${item}`}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p>No flyer draft yet. Generate one to preview brochure output.</p>
        )}
      </div>
    </div>
  );

  const renderReportTab = () => (
    <div className="workspace-two-column">
      <div className="content-card report-generator-card">
        <div className="workspace-tab-stack">
          <span className="label">Report builder</span>
          <h2>Seller intelligence report</h2>
          <p>Make the report feel premium by combining pricing, comps, photos, checklist progress, and marketing guidance into one place.</p>
          <div className="workspace-action-column">
            <button type="button" className={status.includes('report') ? 'button-primary button-busy' : 'button-primary'} onClick={handleGenerateReport} disabled={Boolean(status)}>
              {status.includes('report') ? 'Generating report...' : 'Generate report'}
            </button>
            <button type="button" className="button-secondary" onClick={handleDownloadReportPdf} disabled={Boolean(status)}>Download report PDF</button>
          </div>
          <div className="mini-stats">
            <div className="stat-card"><strong>Status</strong><span>{latestReport ? (latestReport.freshness?.isStale ? 'Refresh recommended' : 'Current report ready') : 'No report generated yet'}</span></div>
            <div className="stat-card"><strong>Photos</strong><span>{latestReport?.selectedPhotos?.length ? `${latestReport.selectedPhotos.length} in latest report` : `${listingCandidateAssets.length || mediaAssets.length} available`}</span></div>
            <div className="stat-card"><strong>Checklist</strong><span>{checklist?.summary?.completedCount ?? 0} complete</span></div>
            <div className="stat-card"><strong>Comps</strong><span>{selectedComps.length} included</span></div>
          </div>
          <div className="workspace-inner-card report-outline-card">
            <span className="label">Title + summary</span>
            <div className="brochure-control-grid brochure-control-grid-form">
              <label className="workspace-control-field workspace-control-field-full">
                <span>Report title</span>
                <input
                  type="text"
                  value={reportTitleDraft}
                  onChange={(event) => setReportTitleDraft(event.target.value)}
                  placeholder="Seller-facing report title"
                  maxLength={180}
                />
              </label>
              <label className="workspace-control-field workspace-control-field-full">
                <span>Executive summary</span>
                <textarea
                  value={reportExecutiveSummaryDraft}
                  onChange={(event) => setReportExecutiveSummaryDraft(event.target.value)}
                  placeholder="Lead with the main pricing, readiness, and launch story."
                  maxLength={1200}
                />
              </label>
              <label className="workspace-control-field workspace-control-field-full">
                <span>Draft listing description</span>
                <textarea
                  value={reportListingDescriptionDraft}
                  onChange={(event) => setReportListingDescriptionDraft(event.target.value)}
                  placeholder="Optional seller-facing listing-description draft."
                  maxLength={1200}
                />
              </label>
            </div>
          </div>
          <div className="workspace-inner-card report-outline-card">
            <span className="label">Section toggles</span>
            <div className="report-outline-grid">
              {REPORT_SECTION_OPTIONS.map((section) => (
                <button
                  key={`outline-${section.id}`}
                  type="button"
                  className={
                    reportIncludedSections.includes(section.id)
                      ? 'report-outline-item active'
                      : 'report-outline-item'
                  }
                  onClick={() => toggleReportSection(section.id)}
                >
                  <strong>{section.label}</strong>
                  <span>
                    {reportIncludedSections.includes(section.id)
                      ? 'Included in the generated report'
                      : 'Click to include this section'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="workspace-inner-card brochure-control-card">
            <span className="label">Photo set</span>
            {reportPhotoPool.length ? (
              <div className="brochure-photo-plan">
                {reportPhotoPool.slice(0, 6).map((asset) => (
                  <button
                    key={`report-photo-${asset.id}`}
                    type="button"
                    className={
                      reportSelectedPhotoIds.includes(asset.id)
                        ? 'brochure-photo-plan-card active'
                        : 'brochure-photo-plan-card'
                    }
                    onClick={() => toggleReportPhotoSelection(asset.id)}
                  >
                    <img src={asset.imageUrl} alt={asset.roomLabel || 'Report candidate'} />
                    <div>
                      <strong>{asset.roomLabel}</strong>
                      <span>
                        {asset.listingNote ||
                          (asset.selectedVariant
                            ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                            : 'Available for report use')}
                      </span>
                      <em>{reportSelectedPhotoIds.includes(asset.id) ? 'Included in report' : 'Click to include'}</em>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p>No photos are available yet for report review.</p>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Report preview</span>
        {latestReport ? (
          <div className="report-preview">
            <div className="flyer-hero">
              <span className="label">{latestReport.reportType}</span>
              <h2>{latestReport.title}</h2>
              <p>{latestReport.executiveSummary}</p>
              <div className="tag-row">
                <span>{latestReport.freshness?.isStale ? 'Stale report' : 'Current report'}</span>
                <span>Version {latestReport.reportVersion || 1}</span>
                <span>{latestReport.payload?.readinessSummary?.label || 'Readiness summary pending'}</span>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                {(latestReport.payload?.sectionOutline || []).map((item) => <span key={`section-${item}`}>{item}</span>)}
                <span>{latestReport.selectedPhotos?.length || 0} selected photos</span>
              </div>
            </div>
            <div className="mini-stats">
              <div className="stat-card"><strong>Price band</strong><span>{latestReport.pricingSummary?.low ? `${formatCurrency(latestReport.pricingSummary.low)} to ${formatCurrency(latestReport.pricingSummary.high)}` : 'Pricing pending'}</span></div>
              <div className="stat-card"><strong>Readiness</strong><span>{latestReport.payload?.readinessSummary?.overallScore ? `${latestReport.payload.readinessSummary.overallScore}/100` : 'Not included'}</span></div>
            </div>
            {latestReport.freshness?.isStale ? <div className="report-preview-section"><strong>Refresh recommended</strong><ul className="plain-list">{(latestReport.freshness.staleReasons || []).map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            {latestReport.payload?.photoSummary ? <div className="report-preview-section"><strong>Photo review summary</strong><p>{latestReport.payload.photoSummary.summary || 'No photo-review summary is available yet.'}</p></div> : null}
            {latestReport.selectedPhotos?.length ? (
              <div className="report-preview-section">
                <strong>Selected photo set</strong>
                <div className="flyer-photo-grid">
                  {latestReport.selectedPhotos.slice(0, 4).map((photo) => (
                    <div key={`report-preview-photo-${photo.assetId || photo.imageUrl}`} className="flyer-photo-card">
                      {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Report photo'} /> : null}
                      <span>{photo.roomLabel || 'Selected report photo'}</span>
                      <div className="flyer-photo-badges">
                        {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                        {photo.usesPreferredVariant ? <strong className="flyer-photo-badge flyer-photo-badge-vision">{getPreferredVariantLabel(photo)}</strong> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="report-preview-grid">
              {(latestReport.marketingHighlights || []).length ? (
                <div className="report-preview-section">
                  <strong>Marketing highlights</strong>
                  <div className="tag-row">
                    {(latestReport.marketingHighlights || []).slice(0, 6).map((item) => <span key={`marketing-${item}`}>{item}</span>)}
                  </div>
                </div>
              ) : null}
              {(latestReport.checklistItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top checklist items</strong>
                  <ul className="plain-list">
                    {(latestReport.checklistItems || []).slice(0, 4).map((item) => <li key={`task-${item}`}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
              {(latestReport.improvementItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top improvements</strong>
                  <ul className="plain-list">
                    {(latestReport.improvementItems || []).slice(0, 4).map((item) => <li key={`improvement-${item}`}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
              {latestReport.payload?.listingDescriptions?.shortDescription || latestReport.payload?.marketingGuidance?.shortDescription ? (
                <div className="report-preview-section">
                  <strong>Draft listing description</strong>
                  <p>{latestReport.payload?.listingDescriptions?.shortDescription || latestReport.payload?.marketingGuidance?.shortDescription}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p>No seller report has been generated yet. Create one to preview the premium report flow.</p>
        )}
      </div>
    </div>
  );

  const renderChecklistTab = () => (
    <div className="workspace-two-column">
      <div className="content-card checklist-card">
        <div className="section-header-tight">
          <div>
            <span className="label">Checklist workflow</span>
            <h2>Listing-prep phases</h2>
          </div>
          <span className="section-header-meta">{checklist?.summary?.progressPercent ?? 0}% ready</span>
        </div>
        {checklistGroups.length ? (
          <div className="workspace-accordion-list">
            {checklistGroups.map(([groupName, items]) => (
              <details key={groupName} className="workspace-accordion" open>
                <summary><span>{groupName}</span><span>{items.length} task(s)</span></summary>
                <div className="checklist-list">
                  {items.map((item) => (
                    <article key={item.id} className="checklist-item-card">
                      <div className="checklist-item-meta">
                        <span className={`checklist-status checklist-status-${item.status}`}>{formatChecklistStatus(item.status)}</span>
                        <span className={`checklist-chip checklist-chip-${item.priority}`}>{formatChecklistPriority(item.priority)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.detail || 'No additional guidance is attached to this task yet.'}</p>
                      <div className="checklist-action-row">
                        {['todo', 'in_progress', 'done'].map((nextStatus) => (
                          <button key={`${item.id}-${nextStatus}`} type="button" className={item.status === nextStatus ? 'checklist-action-chip active' : 'checklist-action-chip'} onClick={() => handleSetChecklistItemStatus(item.id, nextStatus)} disabled={Boolean(status)}>{formatChecklistStatus(nextStatus)}</button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p>No checklist items yet. The shared seller-prep workflow will appear here.</p>
        )}
      </div>

      <div className="workspace-tab-stack">
        <div className="content-card workspace-side-panel">
          <span className="label">Progress summary</span>
          <h2>{readinessScore}/100 readiness</h2>
          <div className="mini-stats">
            <div className="stat-card"><strong>Completed</strong><span>{checklist?.summary?.completedCount ?? 0}</span></div>
            <div className="stat-card"><strong>Open</strong><span>{checklist?.summary?.openCount ?? 0}</span></div>
          </div>
          <p><strong>Next task:</strong> {checklist?.nextTask?.title || 'No open tasks right now'}</p>
        </div>

        <form className="content-card checklist-form" onSubmit={handleCreateChecklistTask}>
          <span className="label">Add custom task</span>
          <input type="text" value={customChecklistTitle} onChange={(event) => setCustomChecklistTitle(event.target.value)} placeholder="Example: book pre-listing cleaner" maxLength={80} />
          <input type="text" value={customChecklistDetail} onChange={(event) => setCustomChecklistDetail(event.target.value)} placeholder="Optional context or reminder" maxLength={180} />
          <button type="submit" className="button-secondary" disabled={Boolean(status)}>Save task</button>
        </form>

        <div className="content-card workspace-side-panel">
          <span className="label">Provider suggestions</span>
          <h2>Future add-on panel</h2>
          <p>This right rail is ready for provider recommendations later without pushing the main task workflow farther down the page.</p>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    if (activeTab === 'pricing') return renderPricingTab();
    if (activeTab === 'photos') return renderPhotosTab();
    if (activeTab === 'vision') return renderVisionTab();
    if (activeTab === 'brochure') return renderBrochureTab();
    if (activeTab === 'report') return renderReportTab();
    if (activeTab === 'checklist') return renderChecklistTab();
    return renderOverviewTab();
  };

  return (
    <AppFrame busy={Boolean(status)}>
      <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />

      <section className="workspace-shell">
        <section className="workspace-page-header">
          <div className="workspace-page-header-copy">
            <span className="label">Property workspace</span>
            <h1>{property?.title || 'Property'}</h1>
            <p className="workspace-address-line">{[property?.addressLine1, property?.city, property?.state, property?.zip].filter(Boolean).join(', ')}</p>
            <div className="tag-row">
              <span>{latestPricing ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}` : 'Pricing pending'}</span>
              <span>{readinessScore}/100 readiness</span>
              <span>{mediaAssets.length} photo{mediaAssets.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="workspace-page-header-actions">
            <button type="button" className={status.includes('Refreshing') ? 'button-primary button-busy' : 'button-primary'} onClick={handleAnalyzePricing} disabled={Boolean(status)}>{status.includes('Refreshing') ? 'Refreshing analysis...' : 'Refresh pricing'}</button>
            <button type="button" className={status.includes('report') ? 'button-secondary button-busy' : 'button-secondary'} onClick={() => { setActiveTab('report'); handleGenerateReport(); }} disabled={Boolean(status)}>{status.includes('report') ? 'Generating report...' : 'Generate report'}</button>
            <Link href="/dashboard" className="button-secondary inline-button">Back to dashboard</Link>
          </div>
        </section>

        <section className="workspace-action-bar">
          <button type="button" className="workspace-action-pill" onClick={() => setActiveTab('photos')}>Add photos</button>
          <button type="button" className="workspace-action-pill" onClick={() => setActiveTab('photos')}>Select photos</button>
          <button type="button" className="workspace-action-pill workspace-action-pill-primary" onClick={() => { setActiveTab('vision'); if (selectedMediaAsset) { handleGenerateVariant('enhance_listing_quality'); } }} disabled={Boolean(status)}>Enhance</button>
          <button type="button" className="workspace-action-pill" onClick={() => { setActiveTab('brochure'); handleGenerateFlyer(); }} disabled={Boolean(status)}>Generate flyer</button>
          <button type="button" className="workspace-action-pill workspace-action-pill-primary" onClick={() => { setActiveTab('report'); handleGenerateReport(); }} disabled={Boolean(status)}>Generate report</button>
        </section>

        <section className="workspace-tab-bar" aria-label="Workspace tabs">
          {WORKSPACE_TABS.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </section>

        {status ? <p className="status-copy">{status}</p> : null}

        <section className="workspace-tab-layout">
          <div className="workspace-tab-main">{renderActiveTab()}</div>
          <aside className="workspace-quick-rail">
            <div className="content-card workspace-quick-card"><span className="label">Readiness score</span><h2>{readinessScore}/100</h2><p>{readinessLabel}</p></div>
            <div className="content-card workspace-quick-card"><span className="label">Next best action</span><h3>{nextBestAction.title}</h3><p>{nextBestAction.detail}</p><button type="button" className="button-primary" onClick={() => setActiveTab(nextBestAction.tab)} disabled={Boolean(status)}>Open {WORKSPACE_TABS.find((tab) => tab.id === nextBestAction.tab)?.label || 'workspace'}</button></div>
            <div className="content-card workspace-quick-card"><span className="label">Quick stats</span><ul className="plain-list"><li>{selectedComps.length} comp(s) loaded</li><li>{listingCandidateAssets.length} listing photo pick(s)</li><li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li><li>{checklist?.summary?.completedCount ?? 0} task(s) complete</li></ul></div>
          </aside>
        </section>
      </section>
    </AppFrame>
  );
}
