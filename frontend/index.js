// ================= MAP INITIALIZATION =================
const map = L.map('map', {
    zoomControl: true,
    attributionControl: false
}).setView([23.6833, 86.9833], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

// ================= ICONS =================
const sosIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1055/1055231.png',
    iconSize: [32, 32]
});

const disasterIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/5024/5024467.png',
    iconSize: [32, 32]
});

// ================= LAYERS =================
let servicesLayer = L.layerGroup().addTo(map);

// ================= USER DATA HYDRATION =================
function hydrateUserUI() {
    const user = JSON.parse(localStorage.getItem("resqlink_user"));
    if (!user) {
        // Redir if no user session
        // window.location.href = "trial/landing.html";
        return;
    }

    // Navbar
    const navName = document.getElementById('navUserName');
    if (navName) navName.innerText = user.name.split(' ')[0] || "Profile";

    // Profile Panel
    const panelName = document.getElementById('panelUserName');
    if (panelName) panelName.innerText = user.name;

    const panelMember = document.getElementById('memberSince');
    if (panelMember) panelMember.innerText = `Member since ${user.memberSince || '2025'}`;

    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.innerText = user.name.charAt(0).toUpperCase();

    // 🔥 Dynamic Dashboard Redirection
    const dashboardLink = document.getElementById('dashboardLink');
    if (dashboardLink) {
        if (user.role === "admin") {
            dashboardLink.href = "admin.html";
        } else {
            dashboardLink.href = "user.html";
        }
    }
}

// Ensure hydration runs on load
document.addEventListener("DOMContentLoaded", hydrateUserUI);

// ================= FAST LOCATION =================
function getUserLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => reject(err),
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// ================= OVERPASS =================
async function fetchOverpass(query) {
    const servers = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter"
    ];

    for (let url of servers) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: query
            });
            const data = await res.json();
            if (data.elements?.length > 0) return data;
        } catch (err) {
            console.warn("Server failed:", url);
        }
    }
    throw new Error("All Overpass failed");
}

// ================= MARKERS =================
function createMarker(color, icon) {
    return L.divIcon({
        className: "custom-marker",
        html: `<div class="marker-pin" style="background:${color}">
                <i class="${icon}"></i>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
}

const hospitalIcon = createMarker("#30ed0a", "fas fa-plus");
const policeIcon = createMarker("#3b82f6", "fas fa-shield-alt");
const fireIcon = createMarker("#ff7a00", "fas fa-fire");

// ================= NEARBY SERVICES =================
async function loadNearbyServices(userLat, userLng) {
    const radius = 5000;
    const query = `
    [out:json][timeout:15];
    (
        node["amenity"="hospital"](around:${radius},${userLat},${userLng});
        node["amenity"="police"](around:${radius},${userLat},${userLng});
        node["amenity"="fire_station"](around:${radius},${userLat},${userLng});
    );
    out;
    `;

    try {
        servicesLayer.clearLayers();
        const data = await fetchOverpass(query);
        let places = [];

        data.elements.forEach(place => {
            let lat = place.lat;
            let lon = place.lon;
            if (!lat || !lon) return;
            let type = place.tags?.amenity;
            let name = place.tags?.name || `${type.toUpperCase()} Facility`;
            const dist = map.distance([userLat, userLng], [lat, lon]);
            places.push({ lat, lon, type, name, dist });
        });

        places.sort((a, b) => a.dist - b.dist);
        let hospitals = places.filter(p => p.type === "hospital").slice(0, 3);
        let police = places.filter(p => p.type === "police").slice(0, 3);
        let fire = places.filter(p => p.type === "fire_station").slice(0, 3);
        let finalPlaces = [...hospitals, ...police, ...fire];

        const nearestPlace = places[0];

        finalPlaces.forEach(place => {
            let icon;
            if (place.type === "hospital") icon = hospitalIcon;
            else if (place.type === "police") icon = policeIcon;
            else if (place.type === "fire_station") icon = fireIcon;
            
            if (!icon) return;

            const marker = L.marker([place.lat, place.lon], { icon }).addTo(servicesLayer);
            const distStr = place.dist < 1000 ? `${Math.round(place.dist)} m` : `${(place.dist / 1000).toFixed(2)} km`;
            
            marker.bindPopup(`
                <b>${place.type.toUpperCase()}</b><br>
                ${place.name}<br>
                📏 ${distStr}
            `);

            if (place === nearestPlace) {
                marker.bindPopup(`
                    ⭐ <b>NEAREST ${place.type.toUpperCase()}</b><br>
                    ${place.name}<br>
                    📏 ${(place.dist / 1000).toFixed(2)} km
                `).openPopup();
            }
        });
    } catch (err) {
        console.error("Services error:", err);
    }
}

// ================= USER =================
async function showUserOnMap() {
    try {
        const loc = await getUserLocation();
        map.setView([loc.lat, loc.lng], 14);

        L.marker([loc.lat, loc.lng])
            .addTo(map)
            .bindPopup("📍 You are here")
            .openPopup();

        L.circle([loc.lat, loc.lng], {
            radius: loc.accuracy,
            color: "#3b82f6",
            weight: 2,
            fillOpacity: 0.1
        }).addTo(map);

        loadNearbyServices(loc.lat, loc.lng);
    } catch (err) {
        console.error("Location error:", err);
    }
}

// ================= SOS =================
document.getElementById('sosBtn').addEventListener('click', async () => {
    const user = JSON.parse(localStorage.getItem("resqlink_user"));
    if (!user) {
        alert("Please login first");
        window.location.href = "login.html";
        return;
    }

    try {
        const loc = await getUserLocation();

        // 1. Fetch ALL contacts
        const res = await fetch(`http://localhost:5000/api/contact/all?userName=${encodeURIComponent(user.name)}`);
        const contacts = await res.json();

        if (!contacts || contacts.length === 0) {
            alert("No emergency contacts found. Please add them in your profile.");
            window.location.href = "user.html";
            return;
        }

        // 2. Send SOS alert
        await fetch('http://localhost:5000/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: user.name,
                locationName: "Auto-detected",
                disasterType: "SOS",
                reportType: "SOS",
                level: "high",
                lat: loc.lat,
                lng: loc.lng,
                status: "pending"
            })
        });

        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        map.setView([loc.lat, loc.lng], 16);
        L.circle([loc.lat, loc.lng], {
            radius: 200,
            color: "red",
            fillOpacity: 0.2
        }).addTo(map);

        // 5. Send WhatsApp messages
        const message = `🚨 EMERGENCY SOS! 🚨\nI need help immediately!\n\n📍 My Location:\nhttps://www.google.com/maps?q=${loc.lat},${loc.lng}\n\nPlease respond ASAP!`;

        contacts.forEach((contact, index) => {
            setTimeout(() => {
                let number = contact.number.replace(/\D/g, "");
                if (number.length === 10) number = "91" + number; 
                const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
                window.open(url, "_blank");
            }, index * 1200);
        });

        alert(`🚨 SOS alert sent to ${contacts.length} emergency contacts!`);
    } catch (err) {
        console.error("SOS error:", err);
        alert("Failed to send SOS. Please check your connection.");
    }
});

// ================= PROFILE TOGLE =================
const profileBtn = document.getElementById('profileTrigger');
const profilePanel = document.getElementById('profilePanel');

if (profileBtn && profilePanel) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePanel.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!profilePanel.contains(e.target) && !profileBtn.contains(e.target)) {
            profilePanel.classList.remove('active');
        }
    });

    // Logout handling
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem("resqlink_user");
            localStorage.removeItem("token");
        });
    }
}

// ================= AUTO LOAD =================
showUserOnMap();
