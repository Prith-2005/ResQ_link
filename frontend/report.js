// ================= GLOBAL =================
let userLocation = null;
let selectedLevel = "high"; // default


// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {

  // ================= DISASTER SELECT =================
  document.querySelectorAll(".disaster-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".disaster-card")
        .forEach(c => c.classList.remove("active"));

      card.classList.add("active");
    });
  });


  // ================= LEVEL SELECT =================
  document.querySelectorAll(".level-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      document.querySelectorAll(".level-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      // store level
      selectedLevel = btn.innerText.trim().toLowerCase();
    });
  });

});


// ================= GPS =================
const gpsBtn = document.getElementById("gpsBtn");

if (gpsBtn) {
  gpsBtn.addEventListener("click", () => {

    if (!navigator.geolocation) {
      alert("Geolocation not supported ❌");
      return;
    }

    navigator.geolocation.getCurrentPosition(position => {

      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      const display = document.getElementById("locationDisplay");

      if (display) {
        display.innerHTML = "✅ Location captured";
        display.classList.add("location-success");
      }

      gpsBtn.innerText = "Location Captured";
      gpsBtn.classList.add("success");

    }, () => {
      alert("Location access denied ❌");
    });

  });
}


// ================= SEND =================
async function sendSOS() {

  console.log("SEND CLICKED");

  const user = JSON.parse(localStorage.getItem("resqlink_user"));

  const disaster = document.querySelector(".disaster-card.active");
  const locationInput = document.getElementById("locationName");

  // USER CHECK
  if (!user) {
    alert("Please login first ❌");
    return;
  }

  // DISASTER CHECK
  if (!disaster) {
    alert("Select disaster type ❌");
    return;
  }

  // GPS CHECK
  if (!userLocation) {
    alert("Please capture location first ❌");
    return;
  }

  // SAFE LOCATION
  let locationName = "Auto-detected";
  if (locationInput && locationInput.value.trim()) {
    locationName = locationInput.value.trim();
  }

  // FINAL DATA
  const data = {
    name: user.name,
    userEmail: user.email,

    reportType: "REPORT",
    disasterType: disaster.innerText,
    locationName: locationName,

    level: selectedLevel, // 🔥 IMPORTANT CHANGE

    coordinates: userLocation
  };

  console.log("DATA:", data);

  try {

    const res = await fetch("http://localhost:5000/api/alerts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {

      alert("✅ Disaster reported successfully");

      // RESET
      document.querySelectorAll(".disaster-card")
        .forEach(c => c.classList.remove("active"));

      document.querySelectorAll(".level-btn")
        .forEach(b => b.classList.remove("active"));

      userLocation = null;
      selectedLevel = "high";

      if (locationInput) locationInput.value = "";

      const display = document.getElementById("locationDisplay");
      if (display) display.innerText = "Not captured yet";

      if (gpsBtn) {
        gpsBtn.classList.remove("success");
        gpsBtn.innerText = "📍 Capture Location";
      }

      window.location.href = "user.html";

    } else {
      alert("❌ Failed to send report");
    }

  } catch (err) {
    console.error(err);
    alert("Server error ❌");
  }
}


// ================= NAV =================
function goToPage(mode) {
  if (mode === "incident") {
    window.location.href = "incident.html";
  }
}