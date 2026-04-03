'use client';

import { useEffect, useRef, useState } from 'react';

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
      <div
        ref={mapRef}
        className={`property-map-frame property-map-frame-js${frameClassName ? ` ${frameClassName}` : ''}`}
      />
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
  buildImageUrl,
  googleMapsUrl = '',
  frameClassName = '',
}) {
  const [mapError, setMapError] = useState('');
  const [zoom, setZoom] = useState(11);
  const [resolvedImageUrl, setResolvedImageUrl] = useState('');
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const imageUrl = typeof buildImageUrl === 'function' ? buildImageUrl(zoom) : '';

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    async function loadMapImage() {
      if (!imageUrl) {
        setResolvedImageUrl('');
        setMapError('The provider map image URL could not be created. You can still use Open map search.');
        return;
      }

      setIsLoadingMap(true);
      setMapError('');
      setResolvedImageUrl('');

      try {
        const response = await fetch(imageUrl, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          let message = text || `Provider map request failed with status ${response.status}.`;
          try {
            const parsed = JSON.parse(text);
            message = parsed?.message || message;
          } catch {
            // leave as text
          }
          throw new Error(message);
        }

        if (!contentType.startsWith('image/')) {
          const text = await response.text().catch(() => '');
          let message = text || 'Provider map request did not return an image.';
          try {
            const parsed = JSON.parse(text);
            message = parsed?.message || message;
          } catch {
            // leave as text
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setResolvedImageUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setMapError(error?.message || 'The in-app provider map image could not be loaded. You can still use Open map search.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMap(false);
        }
      }
    }

    loadMapImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageUrl]);

  return (
    <div className="property-map-shell">
      <div className="property-map-actions provider-static-map-toolbar">
        <span className="provider-static-map-zoom-label">Zoom {zoom}</span>
        <button
          type="button"
          className="button-secondary inline-button"
          onClick={() => setZoom((current) => Math.max(8, current - 1))}
          disabled={zoom <= 8}
        >
          Zoom out
        </button>
        <button
          type="button"
          className="button-secondary inline-button"
          onClick={() => setZoom((current) => Math.min(17, current + 1))}
          disabled={zoom >= 17}
        >
          Zoom in
        </button>
      </div>
      <div className={`property-map-frame provider-static-map-frame${frameClassName ? ` ${frameClassName}` : ''}`}>
        {isLoadingMap ? (
          <div className="property-map-loading">Loading provider map…</div>
        ) : null}
        {resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt="Provider map"
            className="provider-static-map-image"
            onError={() => {
              setMapError('The in-app provider map image could not be loaded. You can still use Open map search.');
            }}
          />
        ) : null}
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
