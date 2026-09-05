/**
 * Génère le document HTML embarquant Leaflet.js.
 */

function shade(hex, percent) {
  try {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00ff) + percent;
    let b = (num & 0x0000ff) + percent;
    r = Math.max(Math.min(255, r), 0);
    g = Math.max(Math.min(255, g), 0);
    b = Math.max(Math.min(255, b), 0);
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  } catch (e) {
    return hex;
  }
}

export function getLeafletMapHtml(initialRegion = {}, options = {}) {
  const {
    latitude = 48.8566,
    longitude = 2.3522,
    latitudeDelta = 0.08,
  } = initialRegion;

  const primaryColor = options.primaryColor || '#FF4B6E';
  const primaryDark = shade(primaryColor, -35);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef1f5; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

  /* ---------- Masquage du Copyright & Drapeau Leaflet ---------- */
  .leaflet-control-attribution,
  .leaflet-attribution-flag {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  /* ---------- Pin "ma position" ---------- */
  .my-pin { width: 34px; height: 34px; position: relative; }
  .my-pin .pulse {
    position: absolute; top: 3px; left: 3px; width: 28px; height: 28px;
    border-radius: 50%; background: rgba(0,122,255,0.25);
    animation: pulse 1.8s ease-out infinite;
  }
  .my-pin .dot {
    position: absolute; top: 11px; left: 11px; width: 12px; height: 12px;
    border-radius: 50%; background: linear-gradient(135deg, #4FADFF, #007AFF);
    border: 2.5px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
  }
  @keyframes pulse {
    0% { transform: scale(0.5); opacity: 0.9; }
    100% { transform: scale(2); opacity: 0; }
  }

  /* ---------- Pin de profil ---------- */
  .profile-pin { width: 52px; height: 64px; position: relative; }
  .profile-pin .ring {
    position: absolute; top: 0; left: 3px; width: 46px; height: 46px; border-radius: 50%;
    padding: 3px;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryDark});
    box-shadow: 0 3px 8px rgba(0,0,0,0.35);
  }
  .profile-pin .ring-inner {
    width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
    background: #fff; border: 2px solid #fff;
  }
  .profile-pin img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-pin .initial {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryDark});
    color: #fff; font-weight: 800; font-size: 18px;
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  }
  .profile-pin .tail {
    position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 10px solid ${primaryDark};
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));
  }
  .profile-pin.is-active .ring { transform: scale(1.08); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }

  /* ---------- Popup carte de profil ---------- */
  .leaflet-popup-content-wrapper {
    padding: 0; 
    border-radius: 20px; 
    overflow: hidden;
    box-shadow: 0 14px 34px rgba(0,0,0,0.28);
  }
  .leaflet-popup-content { margin: 0 !important; width: 250px !important; }
  .leaflet-popup-tip-container { display: none; }
  .leaflet-popup-close-button { display: none !important; }

  .profile-card {
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
  }
  .profile-card .photo {
    position: relative; 
    width: 100%; 
    height: 160px;
    background-size: cover; 
    background-position: center;
    background-color: #ddd;
  }
  .profile-card .photo.no-avatar {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryDark});
  }
  .profile-card .photo.no-avatar .big-initial {
    color: rgba(255,255,255,0.92); font-size: 56px; font-weight: 800;
  }
  .profile-card .photo-gradient {
    position: absolute; left: 0; right: 0; bottom: 0; height: 85px;
    background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0));
    pointer-events: none;
  }
  .profile-card .close-btn {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%;
    background: rgba(0,0,0,0.45); color: #fff; border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    font-size: 14px; line-height: 1; padding: 0; z-index: 2;
  }
  .profile-card .photo-info {
    position: absolute; 
    left: 12px; 
    right: 12px; 
    bottom: 8px; 
    color: #fff;
    z-index: 1;
  }
  .profile-card .name-row {
    display: flex; align-items: baseline; gap: 5px;
    font-size: 16px; font-weight: 800; text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .profile-card .distance-badge {
    margin-top: 3px; display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; color: #fff;
    background: rgba(0,0,0,0.35); backdrop-filter: blur(4px);
    padding: 2px 8px; border-radius: 12px;
  }
  .profile-card .distance-badge svg { width: 11px; height: 11px; flex-shrink: 0; }

  /* Structure du corps et bouton */
  .profile-card .body { 
    padding: 12px; 
    background: #fff;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
  }
  .profile-card .bio {
    font-size: 12px; color: #666; margin: 0 0 10px; line-height: 16px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .profile-card .bio.empty { display: none; }

  .profile-card .cta {
    width: 100%; border: none; 
    border-radius: 12px; 
    padding: 10px 12px;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    font-size: 13.5px; font-weight: 700; color: #fff; cursor: pointer;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryDark});
    box-shadow: 0 4px 12px -2px ${primaryColor}80;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    position: relative;
    z-index: 2;
  }
  .profile-card .cta svg { width: 15px; height: 15px; pointer-events: none; }
  .profile-card .cta span { pointer-events: none; }
  .profile-card .cta:active { transform: scale(0.97); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>';
  var ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sendToHost(msg) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else if (window.parent) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }

  function deltaToZoom(latDelta) {
    var z = Math.round(Math.log2(360 / (latDelta || 0.08)));
    return Math.max(2, Math.min(18, z));
  }

  // Desactivation du controle d'attribution dans l'option de la carte
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView(
    [${latitude}, ${longitude}],
    deltaToZoom(${latitudeDelta})
  );

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var myMarker = null;
  var markersLayer = L.layerGroup().addTo(map);

  window.setMyLocation = function (lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    var icon = L.divIcon({
      className: '',
      html: '<div class="my-pin"><div class="pulse"></div><div class="dot"></div></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (myMarker) {
      myMarker.setLatLng([lat, lng]);
    } else {
      myMarker = L.marker([lat, lng], { icon: icon, interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(map);
    }
  };

  window.updateMarkers = function (markers) {
    markersLayer.clearLayers();
    (markers || []).forEach(function (p) {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return;

      var initial = esc((p.name || '?').charAt(0).toUpperCase());
      var avatarInnerHtml = p.avatarUrl
        ? '<img src="' + esc(p.avatarUrl) + '" onerror="this.parentNode.innerHTML=\\'<div class=&quot;initial&quot;>' + initial + '</div>\\'" />'
        : '<div class="initial">' + initial + '</div>';

      var pinHtml =
        '<div class="profile-pin">' +
          '<div class="ring"><div class="ring-inner">' + avatarInnerHtml + '</div></div>' +
          '<div class="tail"></div>' +
        '</div>';

      var icon = L.divIcon({
        className: '',
        html: pinHtml,
        iconSize: [52, 64],
        iconAnchor: [26, 64],
        popupAnchor: [0, -60],
      });

      var marker = L.marker([p.latitude, p.longitude], { icon: icon }).addTo(markersLayer);

      var name = esc(p.name || '');
      var age = p.age ? ', ' + esc(p.age) : '';
      var distanceText = p.distance ? 'À ' + esc(p.distance) : '';
      var bioText = esc(p.bio || '');
      var markerId = String(p.id);

      var photoHtml = p.avatarUrl
        ? '<div class="photo" style="background-image:url(\\'' + esc(p.avatarUrl) + '\\')"></div>'
        : '<div class="photo no-avatar"><span class="big-initial">' + initial + '</span></div>';

      var popupHtml =
        '<div class="profile-card">' +
          '<div class="photo-container" style="position:relative;">' +
            photoHtml +
            '<div class="photo-gradient"></div>' +
            '<button class="close-btn" data-close-id="' + markerId + '">✕</button>' +
            '<div class="photo-info">' +
              '<div class="name-row"><span>' + name + age + '</span></div>' +
              (distanceText ? '<div class="distance-badge">' + ICON_PIN + '<span>' + distanceText + '</span></div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="body">' +
            '<p class="bio' + (bioText ? '' : ' empty') + '">' + bioText + '</p>' +
            '<button class="cta" data-profile-id="' + markerId + '"><span>Voir le profil</span>' + ICON_ARROW + '</button>' +
          '</div>' +
        '</div>';

      marker.bindPopup(popupHtml, { className: 'profile-popup', closeButton: false, maxWidth: 250, minWidth: 250 });

      marker.on('click', function () {
        marker.openPopup();
      });
    });
  };

  // Écouteur global pour la fermeture et la redirection de profil
  document.addEventListener('click', function (e) {
    var ctaBtn = e.target ? e.target.closest('.cta[data-profile-id]') : null;
    if (ctaBtn) {
      e.preventDefault();
      var profileId = ctaBtn.getAttribute('data-profile-id');
      if (profileId) {
        sendToHost({ type: 'MARKER_PRESS', id: profileId });
      }
      return;
    }

    var closeBtn = e.target ? e.target.closest('.close-btn[data-close-id]') : null;
    if (closeBtn) {
      e.preventDefault();
      map.closePopup();
      return;
    }

    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) e.preventDefault();
  }, true);

  window.flyToRegion = function (lat, lng, latDelta, lngDelta, duration) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    map.flyTo([lat, lng], deltaToZoom(latDelta), { duration: (duration || 1000) / 1000 });
  };

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch(e){}
    }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'SET_MY_LOCATION') {
      window.setMyLocation(data.lat, data.lng);
    } else if (data.type === 'UPDATE_MARKERS') {
      window.updateMarkers(data.markers);
    } else if (data.type === 'FLY_TO') {
      window.flyToRegion(data.lat, data.lng, data.latDelta, data.duration);
    }
  });

  map.whenReady(function () {
    sendToHost({ type: 'MAP_READY' });
  });
})();
</script>
</body>
</html>`;
}