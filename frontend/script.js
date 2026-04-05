// ================= MAP INIT =================
const map = L.map('map', {
  zoomControl: false,
  minZoom: 2,
  maxZoom: 19,
  worldCopyJump: true,
  zoomAnimation: true,
  fadeAnimation: true,
  markerZoomAnimation: true,
  inertia: true,
  zoomSnap: 0.25,
  zoomDelta: 0.25
}).setView([22.5726, 88.3639], 5);

// ================= TILE =================
let tileLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19 }
).addTo(map);

// ================= ZOOM =================
L.control.zoom({ position: 'bottomright' }).addTo(map);

// ================= FIX =================
setTimeout(() => map.invalidateSize(), 300);
window.addEventListener('load', () => {
  setTimeout(() => map.invalidateSize(), 500);
});

// ================= LAYERS =================
const userLayer = L.layerGroup().addTo(map);
const liveLayer = L.layerGroup().addTo(map);
const placesLayer = L.layerGroup().addTo(map);

// ================= GLOBAL =================
let currentLat = null;
let currentLng = null;
let mapInitialized = false;
let userMarker = null;
let placesLoaded = false;

// ================= DOT =================
function createDot(lat, lon, color, size = 6) {
  return L.circleMarker([lat, lon], {
    radius: size,
    color: color,
    fillColor: color,
    fillOpacity: 1,
    weight: 2
  }).addTo(liveLayer);
}

// ================= SMOOTH MOVE =================
function smoothMove(marker, newLat, newLng) {
  const start = marker.getLatLng();
  const end = L.latLng(newLat, newLng);
  let progress = 0;

  function animate() {
    progress += 0.08;

    const lat = start.lat + (end.lat - start.lat) * progress;
    const lng = start.lng + (end.lng - start.lng) * progress;

    marker.setLatLng([lat, lng]);

    if (progress < 1) requestAnimationFrame(animate);
  }

  animate();
}

// ================= FETCH REAL PLACES =================
async function fetchNearbyPlaces(lat, lon) {
  const url = `
  https://overpass-api.de/api/interpreter?data=
  [out:json];
  (
    node["amenity"="hospital"](around:3000, ${lat}, ${lon});
    node["amenity"="police"](around:3000, ${lat}, ${lon});
    node["amenity"="fire_station"](around:3000, ${lat}, ${lon});
  );
  out;
  `;

  const res = await fetch(url);
  const data = await res.json();
  return data.elements;
}

// ================= GOOGLE STYLE PIN =================
function addPlaceMarker(place) {

  const lat = place.lat;
  const lon = place.lon;

  let type = place.tags.amenity;

  let svg = "";

  // 🏥 HOSPITAL (RED PREMIUM)
  if (type === "hospital") {
    svg = `
    <div class="pin pin-red">
      <svg viewBox="0 0 24 24">
        <path d="M19 3H5v18h14V3zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z"/>
      </svg>
    </div>`;
  }

  // 🚓 POLICE (BLUE PREMIUM)
  if (type === "police") {
    svg = `
    <div class="pin pin-blue">
      <svg viewBox="0 0 24 24">
        <path d="M12 2L4 5v6c0 5 3.8 9.7 8 11 4.2-1.3 8-6 8-11V5l-8-3z"/>
      </svg>
    </div>`;
  }

  // 🚒 FIRE (ORANGE PREMIUM)
  if (type === "fire_station") {
    svg = `
    <div class="pin pin-orange">
      <svg viewBox="0 0 24 24">
        <path d="M13 3s-1 2-1 3 1 2 1 3-2 2-2 4a4 4 0 008 0c0-2-1-3-2-4s1-2 1-3-1-3-1-3h-4z"/>
      </svg>
    </div>`;
  }

  const marker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: "custom-pin",
      html: svg,
      iconSize: [34, 44],
      iconAnchor: [17, 44]
    })
  }).addTo(placesLayer);

  if (place.tags.name) {
    marker.bindPopup(place.tags.name);
  }
}

// ================= LIVE LOCATION =================
if (navigator.geolocation) {

  navigator.geolocation.watchPosition(
    (position) => {

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      currentLat = lat;
      currentLng = lon;

      if (!mapInitialized) {
        map.setView([lat, lon], 15);
        mapInitialized = true;
      }

      // USER
      if (userMarker) {
        smoothMove(userMarker, lat, lon);
      } else { 
        userMarker = L.circleMarker([lat, lon], {
          radius: 7,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 2
        }).addTo(userLayer);
      }

      // CLEAR ONLY LIVE
      liveLayer.clearLayers();

      // USER ZONE
      L.circle([lat, lon], {
        radius: 800,
        color: '#3b82f6',
        weight: 2,
        opacity: 0.4,
        fillColor: '#3b82f6',
        fillOpacity: 0.08
      }).addTo(liveLayer);

      // DANGER
      L.circle([lat + 0.002, lon - 0.002], {
        radius: 400,
        color: '#ff3b3b',
        weight: 2,
        opacity: 0.3,
        fillColor: '#ff3b3b',
        fillOpacity: 0.08
      }).addTo(liveLayer);

      // SOS
      const sosLocations = [
        [lat + 0.001, lon],
        [lat - 0.002, lon - 0.001],
        [lat - 0.003, lon - 0.002]
      ];

      sosLocations.forEach(loc => {
        createDot(loc[0], loc[1], "#ff3b3b", 7);
      });


      // REAL PLACES
      if (!placesLoaded) {
        fetchNearbyPlaces(lat, lon).then(places => {
          places.forEach(place => addPlaceMarker(place));
        });
        placesLoaded = true;
      }

    },
    (err) => {
      alert("Allow location access");
      console.log(err);
    },
    {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 15000
    }
  );

} else {
  alert("Geolocation not supported");
}

// ================= THEME =================
const themeSwitch = document.getElementById("themeSwitch");

themeSwitch.addEventListener("change", () => {

  map.removeLayer(tileLayer);

  if (themeSwitch.checked) {
    tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    ).addTo(map);
  } else {
    tileLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    ).addTo(map);
  }

});

// ================= SOS FEATURE =================
const sosBtn = document.getElementById("sosBtn");

sosBtn.addEventListener("click", async () => {

  const user = JSON.parse(localStorage.getItem("resqlink_user"));
  if (!user) {
    alert("Please login first");
    window.location.href = "login.html";
    return;
  }

  if (!currentLat || !currentLng) {
    alert("📡 Getting your location... please wait");
    return;
  }

  try {
    // 1. Fetch ALL contacts for the current user
    const res = await fetch(`http://localhost:5000/api/contact/all?userName=${encodeURIComponent(user.name)}`);
    const contacts = await res.json();

    if (!contacts || contacts.length === 0) {
      alert("No emergency contacts found. Please add them in your profile.");
      window.location.href = "user.html";
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    const confirmSOS = confirm(`🚨 Send SOS alert to ${contacts.length} emergency contacts?`);
    if (!confirmSOS) return;

    sosBtn.innerText = "Sending...";

    // 2. Send SOS alert to backend
    await fetch('http://localhost:5000/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        locationName: "Auto-detected",
        disasterType: "SOS",
        reportType: "SOS",
        level: "high",
        lat: currentLat,
        lng: currentLng,
        status: "pending"
      })
    });

    const message = `🚨 EMERGENCY SOS! 🚨
I need help immediately!

📍 My Location:
https://www.google.com/maps?q=${currentLat},${currentLng}

Please respond ASAP!`;

    // 3. Staggered WhatsApp messages
    contacts.forEach((contact, index) => {
      setTimeout(() => {
        let number = contact.number.replace(/\D/g, "");
        if (number.length === 10) number = "91" + number;
        
        const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
      }, index * 1200);
    });

    setTimeout(() => {
      sosBtn.innerText = "🚨 SOS";
      alert(`🚨 SOS alert sent to ${contacts.length} contacts!`);
    }, 3000);

  } catch (err) {
    console.error("SOS error:", err);
    alert("Failed to send SOS. Please try again.");
    sosBtn.innerText = "🚨 SOS";
  }
});