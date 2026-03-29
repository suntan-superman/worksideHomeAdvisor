import mongoose from 'mongoose';

import { demoDashboard } from '../../data/demoData.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { ReportModel } from '../documents/report.model.js';
import { listMediaAssets } from '../media/media.service.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { setPropertyReadinessScore, getPropertyById } from '../properties/property.service.js';
import { ChecklistModel } from './checklist.model.js';

const CORE_ROOM_LABELS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const STATUS_RANK = {
  in_progress: 0,
  todo: 1,
  done: 2,
};
const PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2,
};

function serializeChecklistItem(item) {
  if (!item) {
    return null;
  }

  return {
    id: item._id?.toString?.() || item.id,
    systemKey: item.systemKey || null,
    title: item.title,
    detail: item.detail || '',
    category: item.category || 'custom',
    priority: item.priority || 'medium',
    status: item.status || 'todo',
    source: item.source || 'system',
    providerCategoryKey: item.providerCategoryKey || '',
    providerCategoryLabel: item.providerCategoryLabel || '',
    providerPrompt: item.providerPrompt || '',
    readinessImpact: Number(item.readinessImpact || 0),
    note: item.note || '',
    sortOrder: Number(item.sortOrder || 0),
    updatedByUser: Boolean(item.updatedByUser),
    completedAt: item.completedAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function sortChecklistItems(items) {
  return [...(items || [])].sort((left, right) => {
    if (Number(left.sortOrder || 0) !== Number(right.sortOrder || 0)) {
      return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
    }

    if (STATUS_RANK[left.status] !== STATUS_RANK[right.status]) {
      return STATUS_RANK[left.status] - STATUS_RANK[right.status];
    }

    return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  });
}

function calculateChecklistSummary(items) {
  const totalCount = items.length;
  const completedCount = items.filter((item) => item.status === 'done').length;
  const inProgressCount = items.filter((item) => item.status === 'in_progress').length;
  const openCount = items.filter((item) => item.status !== 'done').length;
  const totalImpact = items.reduce((sum, item) => sum + Math.max(1, Number(item.readinessImpact || 0)), 0);
  const completedImpact = items
    .filter((item) => item.status === 'done')
    .reduce((sum, item) => sum + Math.max(1, Number(item.readinessImpact || 0)), 0);
  const progressPercent = totalImpact ? Math.round((completedImpact / totalImpact) * 100) : 0;

  return {
    totalCount,
    completedCount,
    inProgressCount,
    openCount,
    progressPercent,
  };
}

function getNextChecklistItem(items) {
  return sortChecklistItems(items).find((item) => item.status !== 'done') || null;
}

function serializeChecklist(document) {
  if (!document) {
    return null;
  }

  const items = sortChecklistItems((document.items || []).map(serializeChecklistItem));
  const summary = calculateChecklistSummary(items);

  return {
    id: document._id?.toString?.() || document.id || null,
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    items,
    summary,
    nextTask: getNextChecklistItem(items),
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}

function buildFallbackChecklist(propertyId) {
  const items = (demoDashboard.tasks || []).map((task, index) => {
    const status =
      task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'todo';

    return {
      id: task.id || `demo-task-${index + 1}`,
      systemKey: task.id || `demo-task-${index + 1}`,
      title: task.title || `Task ${index + 1}`,
      detail: 'Complete this checklist step to move the property closer to launch.',
      category: 'preparation',
      priority: 'medium',
      status,
      source: 'system',
      readinessImpact: 10,
      providerCategoryKey: '',
      providerCategoryLabel: '',
      providerPrompt: '',
      note: '',
      sortOrder: index,
      updatedByUser: false,
      completedAt: status === 'done' ? new Date().toISOString() : null,
      createdAt: null,
      updatedAt: null,
    };
  });

  const summary = calculateChecklistSummary(items);

  return {
    id: null,
    propertyId,
    items,
    summary,
    nextTask: getNextChecklistItem(items),
    createdAt: null,
    updatedAt: null,
  };
}

async function buildSuggestedChecklistItems(propertyId) {
  const [property, pricing, mediaAssets, latestFlyer, latestReport] = await Promise.all([
    getPropertyById(propertyId),
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
    FlyerModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean(),
    ReportModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!property) {
    throw new Error('Property not found.');
  }

  const roomCoverageCount = CORE_ROOM_LABELS.filter((roomLabel) =>
    mediaAssets.some((asset) => asset.roomLabel === roomLabel),
  ).length;
  const retakeCount = mediaAssets.filter((asset) => asset.analysis?.retakeRecommended).length;
  const listingCandidateCount = mediaAssets.filter((asset) => asset.listingCandidate).length;

  return [
    {
      systemKey: 'pricing_review',
      title: pricing?.recommendedListMid
        ? 'Review pricing strategy and midpoint'
        : 'Run pricing and confirm the list-price band',
      detail: pricing?.recommendedListMid
        ? `Current midpoint is ${pricing.recommendedListMid}. Re-run pricing after any meaningful prep updates.`
        : 'Run a fresh pricing analysis from the web workspace before going live.',
      category: 'pricing',
      priority: 'high',
      status: pricing?.recommendedListMid ? 'done' : 'todo',
      source: 'system',
      providerCategoryKey: '',
      providerCategoryLabel: '',
      providerPrompt: '',
      readinessImpact: 18,
      sortOrder: 0,
    },
    {
      systemKey: 'core_rooms',
      title:
        roomCoverageCount >= CORE_ROOM_LABELS.length
          ? 'Core listing rooms are covered'
          : 'Capture the core listing rooms',
      detail:
        roomCoverageCount >= CORE_ROOM_LABELS.length
          ? `${roomCoverageCount} of ${CORE_ROOM_LABELS.length} core rooms are already covered for listing prep.`
          : `${roomCoverageCount} of ${CORE_ROOM_LABELS.length} core rooms are covered. Aim for living room, kitchen, primary bedroom, bathroom, and exterior.`,
      category: 'photos',
      priority: 'high',
      status:
        roomCoverageCount >= CORE_ROOM_LABELS.length
          ? 'done'
          : roomCoverageCount >= 3
            ? 'in_progress'
            : 'todo',
      source: 'system',
      providerCategoryKey: '',
      providerCategoryLabel: '',
      providerPrompt: '',
      readinessImpact: 18,
      sortOrder: 1,
    },
    {
      systemKey: 'retake_queue',
      title: retakeCount ? 'Address flagged photo retakes' : 'Retake queue is clear',
      detail: mediaAssets.length
        ? retakeCount
          ? `${retakeCount} saved photo${retakeCount === 1 ? ' is' : 's are'} flagged for improvement. Review them before finalizing listing materials.`
          : 'No saved photos are currently flagged for retakes.'
        : 'Capture a few photos first so the AI review can flag any weak rooms.',
      category: 'photos',
      priority: retakeCount ? 'high' : 'medium',
      status: mediaAssets.length ? (retakeCount ? 'in_progress' : 'done') : 'todo',
      source: 'system',
      providerCategoryKey: 'photographer',
      providerCategoryLabel: 'Photographers',
      providerPrompt: 'A listing photographer can help if key rooms still need stronger capture.',
      readinessImpact: 14,
      sortOrder: 2,
    },
    {
      systemKey: 'listing_candidates',
      title:
        listingCandidateCount >= 3
          ? 'Best listing photos have been selected'
          : 'Choose the best listing candidate photos',
      detail:
        listingCandidateCount >= 3
          ? `${listingCandidateCount} photos have been marked as listing-ready candidates.`
          : `${listingCandidateCount} photo${listingCandidateCount === 1 ? ' is' : 's are'} currently marked as a listing candidate. Aim for at least 3 strong hero photos.`,
      category: 'marketing',
      priority: 'high',
      status:
        listingCandidateCount >= 3
          ? 'done'
          : listingCandidateCount > 0
            ? 'in_progress'
            : 'todo',
      source: 'system',
      providerCategoryKey: 'photographer',
      providerCategoryLabel: 'Photographers',
      providerPrompt: 'Good listing photos often benefit from a local real-estate photographer.',
      readinessImpact: 14,
      sortOrder: 3,
    },
    {
      systemKey: 'pre_listing_clean',
      title: 'Decide if a pre-listing deep clean would help',
      detail:
        mediaAssets.length || roomCoverageCount
          ? 'A cleaner can help the home photograph better and tighten showing readiness before final launch materials.'
          : 'If you plan to capture photos soon, a pre-listing cleaner may improve the first set significantly.',
      category: 'preparation',
      priority: 'medium',
      status: listingCandidateCount >= 3 ? 'in_progress' : 'todo',
      source: 'system',
      providerCategoryKey: 'cleaning_service',
      providerCategoryLabel: 'Cleaning Services',
      providerPrompt: 'Useful before final photos, brochure generation, and early showings.',
      readinessImpact: 8,
      sortOrder: 4,
    },
    {
      systemKey: 'flyer_review',
      title: latestFlyer ? 'Review flyer draft and messaging' : 'Generate and review a flyer draft',
      detail: latestFlyer
        ? 'A flyer exists for this property. Review the copy, photo ordering, and CTA before export.'
        : 'Create a flyer draft once pricing and photo selection are in decent shape.',
      category: 'marketing',
      priority: 'medium',
      status: latestFlyer ? 'done' : 'todo',
      source: 'system',
      providerCategoryKey: '',
      providerCategoryLabel: '',
      providerPrompt: '',
      readinessImpact: 10,
      sortOrder: 5,
    },
    {
      systemKey: 'seller_report',
      title: latestReport ? 'Seller report is ready for review' : 'Generate the seller report PDF',
      detail: latestReport
        ? 'A seller report has already been generated. Refresh it after major pricing, checklist, or photo changes.'
        : 'Generate the premium report once pricing, photos, and prep tasks look strong.',
      category: 'documents',
      priority: 'medium',
      status: latestReport ? 'done' : 'todo',
      source: 'system',
      providerCategoryKey: '',
      providerCategoryLabel: '',
      providerPrompt: '',
      readinessImpact: 10,
      sortOrder: 6,
    },
  ];
}

async function persistChecklistReadiness(propertyId, items) {
  const summary = calculateChecklistSummary(items.map(serializeChecklistItem));
  await setPropertyReadinessScore(propertyId, summary.progressPercent);
  return summary;
}

async function syncChecklistDocument(document, suggestedItems) {
  let changed = false;
  const bySystemKey = new Map();

  for (const item of document.items) {
    if (item.systemKey) {
      bySystemKey.set(item.systemKey, item);
    }
  }

  for (const suggestion of suggestedItems) {
    const existing = bySystemKey.get(suggestion.systemKey);

    if (!existing) {
      document.items.push({
        ...suggestion,
        note: '',
        updatedByUser: false,
      });
      changed = true;
      continue;
    }

    if (!existing.updatedByUser) {
      existing.title = suggestion.title;
      existing.detail = suggestion.detail;
      existing.category = suggestion.category;
      existing.priority = suggestion.priority;
      existing.status = suggestion.status;
      existing.source = suggestion.source;
      existing.providerCategoryKey = suggestion.providerCategoryKey || '';
      existing.providerCategoryLabel = suggestion.providerCategoryLabel || '';
      existing.providerPrompt = suggestion.providerPrompt || '';
      existing.readinessImpact = suggestion.readinessImpact;
      existing.sortOrder = suggestion.sortOrder;
      existing.completedAt = suggestion.status === 'done' ? existing.completedAt || new Date() : null;
      changed = true;
    }
  }

  if (changed) {
    await document.save();
  }

  await persistChecklistReadiness(document.propertyId, document.items);
  return serializeChecklist(document.toObject());
}

export async function getPropertyChecklist(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return buildFallbackChecklist(propertyId);
  }

  const document = await ChecklistModel.findOne({ propertyId }).lean();
  if (!document) {
    return null;
  }

  return serializeChecklist(document);
}

export async function getOrCreatePropertyChecklist(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return buildFallbackChecklist(propertyId);
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  let document = await ChecklistModel.findOne({ propertyId });
  const suggestedItems = await buildSuggestedChecklistItems(propertyId);

  if (!document) {
    document = await ChecklistModel.create({
      propertyId,
      items: suggestedItems.map((item) => ({
        ...item,
        note: '',
        updatedByUser: false,
        completedAt: item.status === 'done' ? new Date() : null,
      })),
    });
    await persistChecklistReadiness(propertyId, document.items);
    return serializeChecklist(document.toObject());
  }

  return syncChecklistDocument(document, suggestedItems);
}

export async function createChecklistItem(propertyId, payload) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create checklist items.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const checklist = (await ChecklistModel.findOne({ propertyId })) || (await ChecklistModel.create({ propertyId, items: [] }));
  const nextSortOrder =
    checklist.items.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), -1) + 1;

  checklist.items.push({
    title: payload.title.trim(),
    detail: payload.detail?.trim?.() || '',
    category: payload.category || 'custom',
    priority: payload.priority || 'medium',
    status: payload.status || 'todo',
    source: 'user',
    readinessImpact: payload.readinessImpact || 8,
    note: payload.note?.trim?.().slice(0, 280) || '',
    sortOrder: nextSortOrder,
    updatedByUser: true,
    completedAt: payload.status === 'done' ? new Date() : null,
  });

  await checklist.save();
  await persistChecklistReadiness(propertyId, checklist.items);
  return serializeChecklist(checklist.toObject());
}

export async function updateChecklistItem(itemId, updates) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update checklist items.');
  }

  const checklist = await ChecklistModel.findOne({ 'items._id': itemId });
  if (!checklist) {
    throw new Error('Checklist item not found.');
  }

  const item = checklist.items.id(itemId);
  if (!item) {
    throw new Error('Checklist item not found.');
  }

  if (typeof updates.status === 'string') {
    item.status = updates.status;
    item.completedAt = updates.status === 'done' ? new Date() : null;
  }

  if (typeof updates.note === 'string') {
    item.note = updates.note.trim().slice(0, 280);
  }

  if (typeof updates.title === 'string' && updates.title.trim()) {
    item.title = updates.title.trim().slice(0, 140);
  }

  if (typeof updates.detail === 'string') {
    item.detail = updates.detail.trim().slice(0, 280);
  }

  if (typeof updates.priority === 'string') {
    item.priority = updates.priority;
  }

  if (typeof updates.category === 'string') {
    item.category = updates.category;
  }

  item.updatedByUser = true;

  await checklist.save();
  await persistChecklistReadiness(checklist.propertyId, checklist.items);

  const serializedChecklist = serializeChecklist(checklist.toObject());
  return {
    checklist: serializedChecklist,
    checklistItem: serializedChecklist.items.find((entry) => entry.id === itemId) || null,
  };
}

export function summarizeChecklistAsImprovements(checklist, limit = 3) {
  return sortChecklistItems(checklist?.items || [])
    .filter((item) => item.status !== 'done')
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      priority: item.priority,
      impact: item.detail,
    }));
}
