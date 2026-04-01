'use client';

import { useEffect, useRef, useState } from 'react';

let googleMapsLoaderPromise = null;

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
    const existingScript = document.querySelector('script[data-workside-google-maps="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.worksideGoogleMaps = 'true';
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
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

    async function renderMap() {
      const addressQuery = buildAddressQuery(property);
      if (!mapRef.current || !addressQuery) {
        return;
      }

      setMapError('');

      try {
        const maps = await loadGoogleMapsApi(mapsApiKey);
        if (cancelled || !mapRef.current) {
          return;
        }

        const geocoder = new maps.Geocoder();
        const map = new maps.Map(mapRef.current, {
          center: { lat: 35.3733, lng: -119.0187 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
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
        }
      } catch {
        if (!cancelled) {
          setMapError('The interactive map could not be loaded with the current Google Maps settings.');
        }
      }
    }

    renderMap();

    return () => {
      cancelled = true;
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
