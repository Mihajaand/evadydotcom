import React, { useRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
  MapContainer,
  TileLayer,
  Marker as LeafletMarker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

// ── Injection CSS Leaflet + Masquage du watermark et du drapeau ──
if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  // Style personnalisé pour masquer totalement le watermark/drapeau Leaflet
  const style = document.createElement('style');
  style.id = 'leaflet-custom-hide-attribution';
  style.innerHTML = `
    .leaflet-control-attribution, 
    .leaflet-control-attribution * { 
      display: none !important; 
      visibility: hidden !important; 
      opacity: 0 !important; 
      height: 0 !important; 
      width: 0 !important; 
      pointer-events: none !important; 
    }
  `;
  document.head.appendChild(style);
}

// Correction des icônes Leaflet par défaut sur Web
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Conversion latitudeDelta vers niveau de zoom Leaflet
const latDeltaToZoom = (latDelta) =>
  Math.min(18, Math.max(1, Math.round(Math.log2(180 / (latDelta || 0.1)))));

// ── Contrôleur interne : expose animateToRegion ──
const MapController = React.forwardRef((_props, ref) => {
  const map = useMap();
  useImperativeHandle(ref, () => ({
    animateToRegion: ({ latitude, longitude, latitudeDelta }, durationMs = 500) => {
      const zoom = latDeltaToZoom(latitudeDelta);
      map.flyTo([latitude, longitude], zoom, { duration: durationMs / 1000 });
    },
  }));
  return null;
});

// ── MapView Web ────────────────────────────────────────────────────────────────
const MapView = React.forwardRef(({ style, initialRegion, children }, ref) => {
  const center = initialRegion
    ? [initialRegion.latitude, initialRegion.longitude]
    : [0, 0];
  const zoom = initialRegion ? latDeltaToZoom(initialRegion.latitudeDelta) : 12;

  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style)
    : style || {};
  const containerStyle = {
    width: flatStyle.width ?? '100%',
    height: flatStyle.height ?? '100%',
    flex: flatStyle.flex,
    position: flatStyle.position,
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={containerStyle}
      scrollWheelZoom
      attributionControl={false}
    >
      <MapController ref={ref} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution=""
      />
      {children}
    </MapContainer>
  );
});

// ── Callout Web → Popup Leaflet ──
export const Callout = ({ children, onPress }) => (
  <Popup>
    <div
      onClick={onPress}
      style={{ cursor: onPress ? 'pointer' : 'default', minWidth: 160 }}
    >
      {children}
    </div>
  </Popup>
);

// ── Marker Web avec contenu personnalisé via DivIcon ──
export const Marker = ({ coordinate, children }) => {
  const { latitude: lat, longitude: lng } = coordinate;
  const iconRef = useRef(null);

  if (!iconRef.current && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText = 'width:40px;height:40px;overflow:visible;';
    iconRef.current = {
      el,
      icon: L.divIcon({
        html: el,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    };
  }

  const visualChildren = [];
  let calloutChild = null;
  React.Children.forEach(children, (child) => {
    if (child?.type === Callout) {
      calloutChild = child;
    } else if (child != null) {
      visualChildren.push(child);
    }
  });

  const iconEl = iconRef.current?.el;
  const icon = iconRef.current?.icon;

  if (!icon) return null;

  return (
    <>
      <LeafletMarker position={[lat, lng]} icon={icon}>
        {calloutChild}
      </LeafletMarker>
      {iconEl && visualChildren.length > 0
        ? createPortal(visualChildren, iconEl)
        : null}
    </>
  );
};

export default MapView;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;