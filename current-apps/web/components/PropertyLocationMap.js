'use client';

import { useEffect, useRef, useState } from 'react';

import { getProviderMapImageUrl } from '../lib/api';

let googleMapsLoaderPromise = null;
let googleMapsReadyResolver = null;

function waitForNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function buildAddressQuery(property) {
  return [
    property?.addressLine1,
    property?.city,
    property?.state,
    property?.zip,
  ]
    .filter(Boolean)
    .join(', ');
}

export function loadGoogleMapsApi(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error('Missing Google Maps browser key.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const previousAuthFailure = window.gm_authFailure;
    const previousReadyCallback = window.__worksideGoogleMapsReady;
    const handleAuthFailure = () => {
      googleMapsLoaderPromise = null;
      reject(new Error('Google Maps browser key is not authorized for this domain.'));
      if (typeof previousAuthFailure === 'function') {
        previousAuthFailure();
      }
    };
    const handleReady = () => {
      if (window.google?.maps) {
        googleMapsReadyResolver?.(window.google.maps);
        googleMapsReadyResolver = null;
      }
      if (typeof previousReadyCallback === 'function') {
        previousReadyCallback();
      }
    };
    window.gm_authFailure = handleAuthFailure;
    window.__worksideGoogleMapsReady = handleReady;

    const existingScript = document.querySelector('script[data-workside-google-maps="true"]');
    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      googleMapsReadyResolver = resolve;
      existingScript.addEventListener(
        'error',
        () => {
          googleMapsLoaderPromise = null;
          reject(new Error('Google Maps failed to load.'));
        },
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement('script');
    googleMapsReadyResolver = resolve;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__worksideGoogleMapsReady`;
    script.async = true;
    script.defer = true;
    script.dataset.worksideGoogleMaps = 'true';
    script.onerror = () => {
      googleMapsLoaderPromise = null;
      reject(new Error('Google Maps failed to load.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
}

function geocodeAddress(geocoder, address) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        resolve(results[0].geometry.location);
        return;
      }

      reject(new Error(`Geocoding failed for ${address}: ${status}`));
    });
  });
}

function formatCompSummary(comp) {
  const parts = [];

  if (comp.price) {
    parts.push(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(comp.price),
    );
  }

  if (typeof comp.distanceMiles === 'number') {
    parts.push(`${comp.distanceMiles.toFixed(2)} mi`);
  }

  if (comp.beds || comp.baths || comp.sqft) {
    parts.push(`${comp.beds || '--'} bd · ${comp.baths || '--'} ba · ${comp.sqft || '--'} sqft`);
  }

  return parts.join(' • ');
}

function offsetMarkerPosition(position, markerIndex, totalAtPoint) {
  if (!position || totalAtPoint <= 1) {
    return position;
  }

  const angle = (Math.PI * 2 * markerIndex) / totalAtPoint;
  const offsetDistance = 0.01;
  return {
    lat: position.lat + Math.sin(angle) * offsetDistance,
    lng: position.lng + Math.cos(angle) * offsetDistance,
  };
}

function createCoordinateBucketKey(position) {
  if (!position) {
    return '';
  }

  return `${Number(position.lat).toFixed(4)}:${Number(position.lng).toFixed(4)}`;
}

function buildProviderAddressQuery(provider) {
  if (!provider) {
    return '';
  }

  const serviceAreaParts = [
    provider.serviceArea?.zipCodes?.[0],
    provider.serviceArea?.city,
    provider.serviceArea?.state,
  ].filter(Boolean);
  if (serviceAreaParts.length) {
    return serviceAreaParts.join(', ');
  }

  const description = String(provider.description || '').trim();
  if (description && description.includes(',')) {
    return description;
  }

  const fallbackLocationParts = [
    provider.serviceArea?.city,
    provider.serviceArea?.state,
  ].filter(Boolean);
  return fallbackLocationParts.join(', ');
}

function formatProviderMapInfoWindow(provider, markerLabel) {
  const detailParts = [];
  if (typeof provider.rating === 'number' && provider.rating > 0) {
    detailParts.push(
      `Rating: ${provider.rating.toFixed(1)}${provider.reviewCount ? ` (${provider.reviewCount} reviews)` : ''}`,
    );
  }
  if (provider.coverageLabel) {
    detailParts.push(provider.coverageLabel);
  }
  if (provider.turnaroundLabel) {
    detailParts.push(provider.turnaroundLabel);
  }
  if (provider.pricingSummary) {
    detailParts.push(provider.pricingSummary);
  }

  const actionLinks = [];
  if (provider.websiteUrl) {
    actionLinks.push(
      `<a href="${provider.websiteUrl}" target="_blank" rel="noreferrer noopener">Website</a>`,
    );
  }
  if (provider.mapsUrl) {
    actionLinks.push(
      `<a href="${provider.mapsUrl}" target="_blank" rel="noreferrer noopener">Directions</a>`,
    );
  }

  return `
    <div style="max-width:260px;">
      <strong>${markerLabel}. ${provider.businessName || 'Provider'}</strong><br/>
      <span style="color:#5d685f;">${provider.isExternalFallback ? 'Google fallback' : 'Workside marketplace'}</span>
      ${detailParts.length ? `<div style="margin-top:6px;color:#5d685f;">${detailParts.join('<br/>')}</div>` : ''}
      ${actionLinks.length ? `<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;">${actionLinks.join('')}</div>` : ''}
    </div>
  `;
}

function buildMapOptions(maps, zoom = 12) {
  return {
    center: { lat: 35.3733, lng: -119.0187 },
    zoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    ...(maps?.RenderingType?.RASTER ? { renderingType: maps.RenderingType.RASTER } : {}),
  };
}

function scheduleMapPaintCheck(mapRef, onFailure) {
  return window.setTimeout(() => {
    const mapElement = mapRef.current;
    if (!mapElement) {
      return;
    }

    const hasRenderedMap =
      Boolean(mapElement.querySelector('.gm-style')) ||
      Boolean(mapElement.querySelector('canvas')) ||
      Boolean(mapElement.querySelector('img'));

    if (!hasRenderedMap) {
      onFailure();
    }
  }, 2500);
}

export function PropertyLocationMap({
  property,
  comps = [],
  mapsApiKey = '',
  googleMapsUrl = '',
  frameClassName = '',
}) {
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let paintCheckTimer = null;

    async function renderMap() {
      const addressQuery = buildAddressQuery(property);
      if (!mapRef.current || !addressQuery) {
        return;
      }

      setMapError('');

      try {
        await waitForNextPaint();
        const maps = await loadGoogleMapsApi(mapsApiKey);
        if (cancelled || !mapRef.current) {
          return;
        }

        mapRef.current.innerHTML = '';
        const geocoder = new maps.Geocoder();
        const map = new maps.Map(mapRef.current, buildMapOptions(maps, 13));
        paintCheckTimer = scheduleMapPaintCheck(mapRef, () => {
          if (!cancelled) {
            setMapError('The in-app map did not finish rendering. You can still use the external map link.');
          }
        });

        const bounds = new maps.LatLngBounds();
        const infoWindow = new maps.InfoWindow();

        const propertyLocation = await geocodeAddress(geocoder, addressQuery);
        if (cancelled) {
          return;
        }

        const propertyMarker = new maps.Marker({
          map,
          position: propertyLocation,
          title: property.title || addressQuery,
          label: {
            text: 'H',
            color: '#ffffff',
          },
        });

        propertyMarker.addListener('click', () => {
          infoWindow.setContent(
            `<div style="max-width:220px;"><strong>${property.title || 'Subject property'}</strong><br/>${addressQuery}</div>`,
          );
          infoWindow.open({ anchor: propertyMarker, map });
        });

        bounds.extend(propertyLocation);

        const compCandidates = (comps || []).slice(0, 8);
        for (let index = 0; index < compCandidates.length; index += 1) {
          const comp = compCandidates[index];
          const markerLabel = String(index + 1);
          let compPosition = null;

          if (
            typeof comp.latitude === 'number' &&
            Number.isFinite(comp.latitude) &&
            typeof comp.longitude === 'number' &&
            Number.isFinite(comp.longitude)
          ) {
            compPosition = { lat: comp.latitude, lng: comp.longitude };
          } else if (comp.address) {
            try {
              const resolved = await geocodeAddress(geocoder, comp.address);
              compPosition = {
                lat: resolved.lat(),
                lng: resolved.lng(),
              };
            } catch {
              compPosition = null;
            }
          }

          if (!compPosition || cancelled) {
            continue;
          }

          const marker = new maps.Marker({
            map,
            position: compPosition,
            title: comp.address,
            label: {
              text: markerLabel,
              color: '#ffffff',
            },
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: '#c87447',
              fillOpacity: 1,
              strokeColor: '#19212a',
              strokeWeight: 1,
              scale: 11,
            },
          });

          marker.addListener('click', () => {
            infoWindow.setContent(
              `<div style="max-width:240px;"><strong>Comp ${markerLabel}</strong><br/>${comp.address}<br/><span style="color:#5d685f;">${formatCompSummary(
                comp,
              )}</span></div>`,
            );
            infoWindow.open({ anchor: marker, map });
          });

          bounds.extend(compPosition);
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 56);
          maps.event?.trigger?.(map, 'resize');
        }
      } catch (error) {
        if (!cancelled) {
          setMapError(error?.message || 'The interactive map could not be loaded with the current Google Maps settings.');
        }
      }
    }

    renderMap();

    return () => {
      cancelled = true;
      if (paintCheckTimer) {
        window.clearTimeout(paintCheckTimer);
      }
    };
  }, [comps, mapsApiKey, property]);

  return (
    <div className="property-map-shell">
      <div className="property-map-frame-shell">
        <div
          ref={mapRef}
          className={`property-map-frame property-map-frame-js${frameClassName ? ` ${frameClassName}` : ''}`}
        />
      </div>
      {mapError ? (
        <div className="property-map-fallback">
          <p>{mapError}</p>
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
        </div>
      ) : null}
    </div>
  );
}

export function ProviderResultsMap({
  propertyId = '',
  categoryKey = '',
  taskKey = '',
  includeExternal = false,
  limit = 10,
  googleMapsUrl = '',
  frameClassName = '',
}) {
  const imageObjectUrlRef = useRef('');
  const [mapError, setMapError] = useState('');
  const [mapZoomMode, setMapZoomMode] = useState('fit');
  const [zoomOffset, setZoomOffset] = useState(0);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProviderMapImage() {
      if (!propertyId) {
        setMapImageUrl('');
        return;
      }

      setMapError('');
      setIsLoadingMap(true);

      try {
        const requestUrl = getProviderMapImageUrl(propertyId, {
          categoryKey,
          taskKey,
          includeExternal,
          limit,
          zoomOffset,
        });
        const response = await fetch(requestUrl, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          let errorMessage = `Provider map request failed (${response.status}).`;
          if (contentType.includes('application/json')) {
            const payload = await response.json().catch(() => null);
            if (payload?.message) {
              errorMessage = payload.message;
            }
          } else {
            const text = await response.text().catch(() => '');
            if (text.trim()) {
              errorMessage = text.trim();
            }
          }
          throw new Error(errorMessage);
        }

        if (!contentType.startsWith('image/')) {
          let unexpectedBody = '';
          if (contentType.includes('application/json')) {
            const payload = await response.json().catch(() => null);
            unexpectedBody = payload?.message || '';
          } else {
            unexpectedBody = await response.text().catch(() => '');
          }
          throw new Error(
            unexpectedBody || 'The provider map endpoint did not return an image.',
          );
        }

        const blob = await response.blob();
        if (imageObjectUrlRef.current) {
          URL.revokeObjectURL(imageObjectUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(blob);
        imageObjectUrlRef.current = objectUrl;
        setMapImageUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) {
          if (imageObjectUrlRef.current) {
            URL.revokeObjectURL(imageObjectUrlRef.current);
            imageObjectUrlRef.current = '';
          }
          setMapImageUrl('');
          setMapError(
            error?.message ||
              'The in-app provider map could not be loaded. You can still use Open map search.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingMap(false);
        }
      }
    }

    loadProviderMapImage();

    return () => {
      controller.abort();
    };
  }, [categoryKey, includeExternal, limit, propertyId, taskKey, zoomOffset]);

  useEffect(() => {
    return () => {
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
        imageObjectUrlRef.current = '';
      }
    };
  }, []);

  return (
    <div className="property-map-shell">
      <div className="property-map-actions provider-static-map-toolbar">
        <span className="provider-static-map-zoom-label">
          {mapZoomMode === 'fit'
            ? 'Fitted view'
            : mapZoomMode === 'closer'
              ? 'Closer view'
              : 'Wider view'}
        </span>
        <button
          type="button"
          className="button-secondary inline-button"
          onClick={() => {
            setMapZoomMode('wider');
            setZoomOffset((current) => Math.max(-5, current - 1));
          }}
          disabled={mapZoomMode === 'wider'}
        >
          Wider
        </button>
        <button
          type="button"
          className="button-secondary inline-button"
          onClick={() => {
            setMapZoomMode('closer');
            setZoomOffset((current) => Math.min(5, current + 1));
          }}
          disabled={mapZoomMode === 'closer'}
        >
          Closer
        </button>
        <button
          type="button"
          className="button-secondary inline-button"
          onClick={() => {
            setMapZoomMode('fit');
            setZoomOffset(0);
          }}
          disabled={mapZoomMode === 'fit'}
        >
          Reset
        </button>
      </div>
      <div className="provider-static-map-legend">
        <span><strong>H</strong> subject property</span>
        <span><strong>Green</strong> Workside providers</span>
        <span><strong>Blue</strong> Google fallback</span>
      </div>
      <div className="property-map-frame-shell">
        <div className={`property-map-frame provider-static-map-frame${frameClassName ? ` ${frameClassName}` : ''}`}>
          {mapImageUrl ? (
            <img
              src={mapImageUrl}
              alt="Provider map"
              className="provider-static-map-image"
              onError={() => {
                setMapImageUrl('');
                setMapError('The in-app provider map image could not be loaded. You can still use Open map search.');
              }}
            />
          ) : null}
          {isLoadingMap ? <div className="property-map-loading-overlay">Loading provider map…</div> : null}
        </div>
      </div>
      {mapError ? (
        <div className="property-map-fallback">
          <p>{mapError}</p>
          {googleMapsUrl ? (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="button-secondary inline-button"
            >
              Open map search
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
