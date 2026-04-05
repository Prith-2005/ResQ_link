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
      selectedLevel = btn.getAttribute("data-level") || btn.innerText.trim().toLowerCase();
    });
  });

  // ================= SUBMIT LISTENER =================
  const sendReportBtn = document.getElementById("sendReportBtn");
  if (sendReportBtn) {
    sendReportBtn.addEventListener("click", sendSOS);
  }

});


// ================= GPS =================
const gpsBtn = document.getElementById("gpsBtn");

if (gpsBtn) {
  gpsBtn.addEventListener("click", () => {

    gpsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturing...';

    if (!navigator.geolocation) {
      alert("Geolocation not supported ❌");
      gpsBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Capture Precise Location';
      return;
    }

    navigator.geolocation.getCurrentPosition(position => {

      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      const display = document.getElementById("locationDisplay");

      if (display) {
        display.innerHTML = "✅ Precise location coordinates captured";
        display.classList.add("location-success");
      }

      gpsBtn.innerText = "Location Captured";
      gpsBtn.classList.add("success");

    }, () => {
      alert("Location access denied ❌");
      gpsBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Capture Precise Location';
    }, { enableHighAccuracy: true });

  });
}


// ================= SEND =================
async function sendSOS() {

  const user = JSON.parse(localStorage.getItem("resqlink_user"));
  const disaster = document.querySelector(".disaster-card.active");
  const locationInput = document.getElementById("locationName");
  const sendBtn = document.getElementById("sendReportBtn");

  // USER CHECK
  if (!user) {
    alert("Please login first ❌");
    window.location.href = "login.html";
    return;
  }

  // DISASTER CHECK
  if (!disaster) {
    alert("Please select a disaster type ❌");
    return;
  }

  // GPS CHECK
  if (!userLocation) {
    alert("Please capture your coordinates first ❌");
    return;
  }

  // Visual feedback
  const originalHtml = sendBtn.innerHTML;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatching...';

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
    disasterType: disaster.getAttribute("data-val") || disaster.innerText.trim(),
    locationName: locationName,

    level: selectedLevel,

    coordinates: userLocation
  };

  try {
    const res = await fetch("http://localhost:5000/api/alerts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      alert("✅ Disaster report dispatched successfully. Help is being coordinated.");
      window.location.href = "user.html";
    } else {
      const errData = await res.json();
      alert("❌ Failed to send report: " + (errData.error || "Server error"));
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalHtml;
    }

  } catch (err) {
    console.error(err);
    alert("Server error ❌. Please check your connection.");
    sendBtn.disabled = false;
    sendBtn.innerHTML = originalHtml;
  }
}


// ================= NAV =================
function goToPage(mode) {
  if (mode === "incident") {
    window.location.href = "incident.html";
  }
}