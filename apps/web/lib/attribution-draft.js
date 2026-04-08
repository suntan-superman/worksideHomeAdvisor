'use client';

import { normalizeLandingAttribution } from '@workside/utils';

const ATTRIBUTION_DRAFT_KEY = 'worksideAttributionDraft';
const LEGACY_AUTH_ATTRIBUTION_DRAFT_KEY = 'worksideAuthAttributionDraft';
const ATTRIBUTION_DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage removal failures in browser-restricted contexts.
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write failures in browser-restricted contexts.
  }
}

function normalizeOptionalMetric(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function normalizeDraftRecord(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const sourceAttribution =
    rawValue.attribution && typeof rawValue.attribution === 'object'
      ? rawValue.attribution
      : rawValue;

  if (!sourceAttribution || typeof sourceAttribution !== 'object') {
    return null;
  }

  const attribution = normalizeLandingAttribution(sourceAttribution);
  const hasAttributionValue = Object.values(attribution).some((value) => Boolean(value));
  if (!hasAttributionValue) {
    return null;
  }

  const capturedAt =
    typeof rawValue.capturedAt === 'string' && rawValue.capturedAt
      ? rawValue.capturedAt
      : new Date().toISOString();
  const expiresAt =
    typeof rawValue.expiresAt === 'string' && rawValue.expiresAt
      ? rawValue.expiresAt
      : new Date(Date.parse(capturedAt) + ATTRIBUTION_DRAFT_TTL_MS).toISOString();

  return {
    attribution,
    previewReadyScore: normalizeOptionalMetric(rawValue.previewReadyScore),
    previewMidPrice: normalizeOptionalMetric(rawValue.previewMidPrice),
    capturedAt,
    expiresAt,
  };
}

function parseDraft(rawJson) {
  if (!rawJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawJson);
    const normalized = normalizeDraftRecord(parsed);
    if (!normalized) {
      return null;
    }

    if (Date.parse(normalized.expiresAt) < Date.now()) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

function getDraftCandidates() {
  if (typeof window === 'undefined') {
    return [];
  }

  const candidates = [
    parseDraft(readStorage(window.sessionStorage, ATTRIBUTION_DRAFT_KEY)),
    parseDraft(readStorage(window.localStorage, ATTRIBUTION_DRAFT_KEY)),
    parseDraft(readStorage(window.sessionStorage, LEGACY_AUTH_ATTRIBUTION_DRAFT_KEY)),
  ].filter(Boolean);

  return candidates.sort(
    (left, right) => Date.parse(right.capturedAt || 0) - Date.parse(left.capturedAt || 0),
  );
}

export function getStoredAttributionDraft() {
  const [latestDraft] = getDraftCandidates();
  return latestDraft || null;
}

export function setStoredAttributionDraft(attribution, options = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!attribution || typeof attribution !== 'object') {
    clearStoredAttributionDraft();
    return null;
  }

  const now = new Date().toISOString();
  const normalized = normalizeLandingAttribution(attribution);
  const payload = {
    attribution: normalized,
    previewReadyScore: normalizeOptionalMetric(options.previewReadyScore ?? attribution.previewReadyScore),
    previewMidPrice: normalizeOptionalMetric(options.previewMidPrice ?? attribution.previewMidPrice),
    capturedAt: now,
    expiresAt: new Date(Date.now() + ATTRIBUTION_DRAFT_TTL_MS).toISOString(),
  };

  const serialized = JSON.stringify(payload);
  writeStorage(window.sessionStorage, ATTRIBUTION_DRAFT_KEY, serialized);
  writeStorage(window.localStorage, ATTRIBUTION_DRAFT_KEY, serialized);
  removeStorage(window.sessionStorage, LEGACY_AUTH_ATTRIBUTION_DRAFT_KEY);

  return payload;
}

export function clearStoredAttributionDraft() {
  if (typeof window === 'undefined') {
    return;
  }

  removeStorage(window.sessionStorage, ATTRIBUTION_DRAFT_KEY);
  removeStorage(window.localStorage, ATTRIBUTION_DRAFT_KEY);
  removeStorage(window.sessionStorage, LEGACY_AUTH_ATTRIBUTION_DRAFT_KEY);
}
