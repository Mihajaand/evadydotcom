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

// ── CSS Leaflet (injection dynamique, une seule fois) ──────────────────────
if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

// Corrige le chemin des icônes Leaflet par défaut (problème connu avec webpack/metro)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Convertit latitudeDelta en niveau de zoom Leaflet
const latDeltaToZoom = (latDelta) =>
  Math.min(18, Math.max(1, Math.round(Math.log2(180 / (latDelta || 0.1)))));

// ── Contrôleur interne : expose animateToRegion via ref ────────────────────
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

// ── MapView ────────────────────────────────────────────────────────────────
const MapView = React.forwardRef(({ style, initialRegion, children }, ref) => {
  const center = initialRegion
    ? [initialRegion.latitude, initialRegion.longitude]
    : [0, 0];
  const zoom = initialRegion ? latDeltaToZoom(initialRegion.latitudeDelta) : 12;

  // Normalise le style RN (objet ou tableau) en style HTML
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
    >
      <MapController ref={ref} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
});

// ── Callout → Popup Leaflet ────────────────────────────────────────────────
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

// ── Marker avec contenu visuel personnalisé via DivIcon + portail ──────────
export const Marker = ({ coordinate, children }) => {
  const { latitude: lat, longitude: lng } = coordinate;
  const iconRef = useRef(null);

  // Crée l'icône DivIcon avec un conteneur DOM une seule fois
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

  // Sépare le contenu visuel du Callout
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
