// Tourist Safety Portal Controller
let map, userMarker, userAccuracyCircle;
let currentTourist = null;
let touristsList = [];
let zonesList = [];
let currentPosition = { lat: 28.6140, lon: 77.2100 }; // Default Safe Zone
let socket = null;
let isWatchingGps = false;
let gpsWatchId = null;

// Initialize Map
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([currentPosition.lat, currentPosition.lon], 15);

    // Dark Tile Layer (CartoDB DarkMatter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
    }).addTo(map);

    // Custom pulsing user icon
    const userIcon = L.divIcon({
        className: 'user-radar-beacon',
        html: `<div style="width: 18px; height: 18px; background: #6366f1; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 15px #6366f1;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    userMarker = L.marker([currentPosition.lat, currentPosition.lon], { icon: userIcon }).addTo(map);
    userMarker.bindPopup("<b>You are here</b><br>Live Telemetry Active");
}

// Load Zones onto Map
async function loadZones() {
    try {
        const res = await fetch('/api/v1/zones');
        zonesList = await res.json();

        zonesList.forEach(zone => {
            if (zone.coordinates && zone.coordinates.length > 2) {
                const polygon = L.polygon(zone.coordinates, {
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: zone.type === 'HIGH_RISK' ? 0.35 : (zone.type === 'RESTRICTED' ? 0.25 : 0.15),
                    weight: 2
                }).addTo(map);

                polygon.bindPopup(`
                    <div style="font-family: 'Outfit', sans-serif;">
                        <span class="badge ${zone.type === 'HIGH_RISK' ? 'badge-high' : (zone.type === 'RESTRICTED' ? 'badge-medium' : 'badge-low')}">
                            ${zone.type}
                        </span>
                        <h4 style="margin: 5px 0; font-weight: 700;">${zone.name}</h4>
                        <p style="font-size: 12px; color: #475569;">${zone.description || ''}</p>
                    </div>
                `);
            }
        });
    } catch (e) {
        console.error("Failed to load zones:", e);
    }
}

// Load Tourists
async function loadTourists() {
    try {
        const res = await fetch('/api/v1/tourists');
        touristsList = await res.json();
        const select = document.getElementById('touristSelect');
        select.innerHTML = '';

        touristsList.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.name} (${t.digital_id})`;
            select.appendChild(opt);
        });

        if (touristsList.length > 0) {
            selectTourist(touristsList[0].id);
        }
    } catch (e) {
        console.error("Failed to load tourists:", e);
    }
}

let isTelemetryEnabled = true;

// Select Active Tourist (Updated for Login)
function selectTourist(touristData) {
    currentTourist = touristData;
    
    // Hide Login, Show Dashboard
    document.getElementById('loginOverlay').style.display = 'none';
    document.querySelector('.tourist-layout').style.display = 'grid';

    // Update Digital ID Card View
    document.getElementById('displayTouristName').textContent = currentTourist.name;
    document.getElementById('idTouristName').textContent = currentTourist.name;
    document.getElementById('idDigitalId').textContent = currentTourist.digital_id;
    document.getElementById('idBlockNumber').textContent = currentTourist.blockchain_block;
    document.getElementById('idLedgerHash').textContent = currentTourist.blockchain_hash;
    // Assuming backend verify returns qr_code_path or we might need to fetch full profile
    // If qr_code_path is missing, we use a placeholder or handle it.
    if(currentTourist.qr_code_path) {
        document.getElementById('idQrImage').src = currentTourist.qr_code_path;
    }

    const verifyLink = document.getElementById('btnVerifyLink');
    if (verifyLink) {
        verifyLink.href = `/verify?id=${encodeURIComponent(currentTourist.digital_id)}`;
    }

    // Connect WebSocket
    connectTouristWebSocket(currentTourist.id || currentTourist.digital_id); // using digital_id if id missing temporarily
}

// Login Logic
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (!email || !password) return;

    try {
        const res = await fetch('/api/v1/tourists/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast("Login Successful", `Welcome back, ${data.name}!`, "success");
            selectTourist(data);
        } else {
            const errData = await res.json();
            showToast("Login Failed", errData.detail || "Invalid credentials.", "danger");
        }
    } catch (err) {
        showToast("Error", "Could not connect to server.", "danger");
    }
});

// Google Login Logic
document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
    const mockEmail = prompt("Enter Google Email for mock login:");
    if (!mockEmail) return;
    try {
        const res = await fetch('/api/v1/tourists/google-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: mockEmail, name: "Google User" })
        });
        if (res.ok) {
            const data = await res.json();
            showToast("Login Successful", `Welcome back, ${data.name}!`, "success");
            selectTourist(data);
        } else {
            showToast("Login Failed", "Google login failed.", "danger");
        }
    } catch (err) {
        showToast("Error", "Could not connect to server.", "danger");
    }
});

// Logout Logic
document.getElementById('btnLogout').addEventListener('click', () => {
    if (socket) socket.close();
    currentTourist = null;
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginOverlay').style.display = 'flex';
    document.querySelector('.tourist-layout').style.display = 'none';
});

// WebSocket Connection
function connectTouristWebSocket(touristId) {
    if (socket) {
        socket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tourist/${touristId}`;
    socket = new WebSocket(wsUrl);

    socket.onmessage = function (event) {
        try {
            const data = JSON.parse(event.data);
            if (data.event === "HAZARD_WARNING") {
                showToast(data.title, data.message, "danger");
                updateStatusBanner(data.zone_type, data.message);
                playAlertSound();
            } else if (data.event === "SOS_ACKNOWLEDGED") {
                showToast("🚨 SOS Dispatched!", data.message, "danger");
                const sosState = document.getElementById('sosEmergencyState');
                if (sosState) sosState.style.display = 'block';
            }
        } catch (e) {
            console.error("WebSocket message parse error:", e);
        }
    };
}

// Update Tourist Live Position
async function updatePosition(lat, lon, zoneHint = null) {
    currentPosition = { lat, lon };
    userMarker.setLatLng([lat, lon]);
    map.panTo([lat, lon]);

    if (!currentTourist) return;

    if (!isTelemetryEnabled) {
        showToast("Telemetry Paused", "Location sharing is currently paused by tourist consent controls.", "warning");
        return;
    }

    try {
        const res = await fetch(`/api/v1/tourists/${currentTourist.id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tourist_id: currentTourist.id,
                latitude: lat,
                longitude: lon,
                accuracy: 3.5,
                speed: 1.5
            })
        });
        
        if (zoneHint === "SAFE") {
            updateStatusBanner("SAFE", "Location Secure (Inside Safe Heritage Promenade)");
            showToast("Navigation", "You have entered the Safe Heritage Zone", "success");
        }
    } catch (e) {
        console.error("Location update failed:", e);
    }
}

// Status Banner Update
function updateStatusBanner(type, message) {
    const banner = document.getElementById('statusBanner');
    const text = document.getElementById('statusBannerText');
    banner.className = 'status-banner';

    if (type === "HIGH_RISK") {
        banner.classList.add('danger');
        text.innerHTML = `⚠️ <b>CRITICAL HAZARD:</b> ${message}`;
    } else if (type === "RESTRICTED") {
        banner.classList.add('warning');
        text.innerHTML = `⚠️ <b>CAUTION:</b> ${message}`;
    } else {
        text.innerHTML = `✅ <b>SAFE:</b> ${message}`;
    }
}

// One-Touch SOS Trigger (PRD Section 5.5 & Workflow Diagram 1)
async function triggerSos() {
    if (!currentTourist) {
        alert("Please select or register a tourist first.");
        return;
    }

    const btn = document.getElementById('btnSos');
    btn.style.opacity = '0.5';

    try {
        const res = await fetch('/api/v1/incidents/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tourist_id: currentTourist.id,
                latitude: currentPosition.lat,
                longitude: currentPosition.lon,
                details: `Distress beacon triggered manually by ${currentTourist.name}`
            })
        });

        if (res.ok) {
            showToast("🚨 SOS TRANSMITTED", "Authorities have received your live coordinates. Help is on the way!", "danger");
            playAlertSound();
            
            // Render persistent emergency state per Workflow Diagram 1
            const sosState = document.getElementById('sosEmergencyState');
            if (sosState) sosState.style.display = 'block';

            updateStatusBanner("HIGH_RISK", "SOS PANIC BEACON ACTIVE — Responders Dispatched");
        } else {
            showToast("SOS Error", "Failed to dispatch SOS beacon. Please try again.", "danger");
        }
    } catch (e) {
        showToast("Network Error", "Unable to contact emergency server.", "danger");
    } finally {
        setTimeout(() => { btn.style.opacity = '1'; }, 1000);
    }
}

// Audio Alert Trigger
function playAlertSound() {
    const audio = document.getElementById('sirenAudio');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio autoplay prevented."));
    }
}

// Toast Helper
function showToast(title, message, type = "info") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'danger' ? 'circle-exclamation' : (type === 'warning' ? 'triangle-exclamation' : 'circle-check')}"></i>
        <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${title}</div>
            <div style="font-size: 0.8rem; color: #cbd5e1;">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadZones();
    loadZones();
    // loadTourists(); is no longer needed since we aren't populating a dropdown

    // Registration Modal
    const regModal = document.getElementById('regModal');
    document.getElementById('btnOpenRegFromLogin').addEventListener('click', () => {
        document.getElementById('loginOverlay').style.display = 'none';
        regModal.classList.add('active');
    });

    document.getElementById('btnCancelReg').addEventListener('click', () => {
        regModal.classList.remove('active');
        document.getElementById('loginOverlay').style.display = 'flex';
    });

    document.getElementById('regForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('regName').value.trim(),
            contact: document.getElementById('regContact').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            password: document.getElementById('regPassword').value.trim(),
            id_proof_number: document.getElementById('regIdProof').value.trim(),
            is_tracking_enabled: true
        };

        try {
            const res = await fetch("/api/v1/tourists/register", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                const data = await res.json();
                showToast("Registration Successful", `Your Digital ID: ${data.digital_id}`, "success");
                regModal.classList.remove('active');
                document.getElementById('loginOverlay').style.display = 'flex';
                document.getElementById('loginEmail').value = payload.email;
            } else {
                const errData = await res.json();
                showToast("Registration Failed", errData.detail || "Error during registration", "danger");
            }
        } catch(e) {
            showToast("Error", "Unable to connect to server.", "danger");
        }
    });

    document.getElementById('btnSos').addEventListener('click', triggerSos);

    // Simulation Walk Buttons
    document.getElementById('btnSimSafe').addEventListener('click', () => {
        updatePosition(28.6140, 77.2100, "SAFE");
    });

    document.getElementById('btnSimRestricted').addEventListener('click', () => {
        updatePosition(28.6150, 77.2200); // Ecological buffer area
    });

    document.getElementById('btnSimHighRisk').addEventListener('click', () => {
        updatePosition(28.6040, 77.2220); // Steep Ravine danger zone
    });

    // Device GPS Toggle
    document.getElementById('btnLiveGpsToggle').addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        if (!isWatchingGps) {
            gpsWatchId = navigator.geolocation.watchPosition(
                (pos) => {
                    updatePosition(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    alert("Unable to retrieve GPS location: " + err.message);
                },
                { enableHighAccuracy: true }
            );
            isWatchingGps = true;
            document.getElementById('btnLiveGpsToggle').innerHTML = '<i class="fa-solid fa-stop"></i> Stop GPS';
            document.getElementById('btnLiveGpsToggle').classList.remove('btn-primary');
            document.getElementById('btnLiveGpsToggle').classList.add('btn-danger');
        } else {
            navigator.geolocation.clearWatch(gpsWatchId);
            isWatchingGps = false;
            document.getElementById('btnLiveGpsToggle').innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use Device GPS';
            document.getElementById('btnLiveGpsToggle').classList.remove('btn-danger');
            document.getElementById('btnLiveGpsToggle').classList.add('btn-primary');
        }
    });


    document.getElementById('regForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('regName').value,
            contact: document.getElementById('regContact').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
            id_proof_number: document.getElementById('regIdProof').value
        };

        try {
            const res = await fetch('/api/v1/tourists/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const newTourist = await res.json();
                regModal.classList.remove('active');
                e.target.reset();
                showToast("Identity Minted", `Digital ID ${newTourist.digital_id} anchored to blockchain. Logging you in...`, "success");
                
                // Automatically log them in after registration
                setTimeout(() => {
                    selectTourist(newTourist);
                }, 1500);
            }

        } catch (err) {
            alert("Registration failed: " + err.message);
        }
    });

    // Cancel Emergency SOS state
    const btnCancelSos = document.getElementById('btnCancelSos');
    if (btnCancelSos) {
        btnCancelSos.addEventListener('click', () => {
            const sosState = document.getElementById('sosEmergencyState');
            if (sosState) sosState.style.display = 'none';
            updateStatusBanner("SAFE", "Location Secure (Perimeter Active)");
            showToast("SOS Cleared", "Distress mode deactivated. Responders stood down.", "success");
        });
    }

    // Telemetry Sharing Consent Toggle (PRD Section 5.2)
    const btnConsentToggle = document.getElementById('btnConsentToggle');
    if (btnConsentToggle) {
        btnConsentToggle.addEventListener('click', () => {
            isTelemetryEnabled = !isTelemetryEnabled;
            if (isTelemetryEnabled) {
                btnConsentToggle.className = 'badge badge-low';
                btnConsentToggle.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> SHARING ACTIVE';
                showToast("Telemetry Resumed", "Real-time location sharing is now active.", "success");
            } else {
                btnConsentToggle.className = 'badge badge-high';
                btnConsentToggle.innerHTML = '<i class="fa-solid fa-pause"></i> SHARING PAUSED';
                showToast("Telemetry Paused", "Location sharing has been paused by user consent.", "warning");
            }
        });
    }

    // Download / Save Digital Pass (PRD Section 5.1)
    const btnDownloadPass = document.getElementById('btnDownloadPass');
    if (btnDownloadPass) {
        btnDownloadPass.addEventListener('click', () => {
            if (!currentTourist) return;
            const printWindow = window.open('', '_blank', 'width=600,height=700');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Digital Tourist Pass — ${currentTourist.name}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #fff; padding: 2rem; }
                        .card { border: 2px solid #6366f1; border-radius: 12px; padding: 2rem; background: #1e293b; max-width: 450px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1rem; }
                        .qr { text-align: center; margin: 1.5rem 0; }
                        .qr img { width: 180px; height: 180px; border-radius: 8px; border: 4px solid #fff; }
                        .meta { font-size: 0.85rem; color: #94a3b8; }
                        .val { font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 0.5rem; }
                        .hash { font-family: monospace; font-size: 0.75rem; word-break: break-all; color: #38bdf8; background: #0f172a; padding: 0.5rem; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="header">
                            <div>
                                <h2 style="margin:0; font-size: 1.25rem;">SMART TOURIST SHIELD</h2>
                                <span style="font-size: 0.75rem; color: #38bdf8;">OFFICIAL DIGITAL CREDENTIAL</span>
                            </div>
                            <div style="font-family: monospace; font-size: 0.8rem; color: #a5b4fc;">BLOCK #${currentTourist.blockchain_block}</div>
                        </div>
                        <div class="meta">Tourist Full Name</div>
                        <div class="val">${currentTourist.name}</div>
                        <div class="meta">Digital Pass ID</div>
                        <div class="val" style="color: #38bdf8; font-family: monospace;">${currentTourist.digital_id}</div>
                        <div class="meta">ID Proof Reference</div>
                        <div class="val" style="font-size: 0.95rem;">${currentTourist.id_proof_number || 'IND-PASS-789012'}</div>
                        <div class="qr">
                            <img src="${currentTourist.qr_code_path}" alt="QR Pass">
                        </div>
                        <div class="meta">SHA-256 Ledger Signature</div>
                        <div class="hash">${currentTourist.blockchain_hash}</div>
                    </div>
                    <script>window.onload = function() { window.print(); }<\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

    // AI Trip Planner Logic
    const btnPlanTrip = document.getElementById('btnPlanTrip');
    if (btnPlanTrip) {
        btnPlanTrip.addEventListener('click', async () => {
            const dest = document.getElementById('tripDestination').value;
            if (!dest) return alert("Please enter a destination");

            btnPlanTrip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Planning...';
            try {
                const res = await fetch('/api/v1/trip/plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: dest })
                });
                const data = await res.json();
                
                const detailsDiv = document.getElementById('tripDetails');
                detailsDiv.style.display = 'block';
                detailsDiv.innerHTML = `
                    <h4 style="color:#fff; margin-bottom:0.5rem;">Trip to ${data.destination}</h4>
                    <p><strong>Route & Cost:</strong> ${data.route_and_cost}</p>
                    <p><strong>Packing Guide:</strong> ${data.packing_guide.join(", ")}</p>
                    <p><strong>Famous Places:</strong> ${data.famous_places.join(", ")}</p>
                    <p><strong>Itinerary:</strong><br>${data.itinerary.join("<br>")}</p>
                    <p style="margin-top:0.5rem; color:#f87171;"><strong>Real-Time Alerts:</strong> ${data.real_time_incidents.map(i => i.type + ": " + i.details).join(" | ")}</p>
                `;
            } catch (err) {
                showToast("Trip Planner", "Failed to fetch trip details.", "danger");
            } finally {
                btnPlanTrip.innerHTML = '<i class="fa-solid fa-magic"></i> Plan Trip';
            }
        });
    }

    // Signal / Network Loss Logic (PRD: Precaution and SOS)
    window.addEventListener('offline', () => {
        showToast("SIGNAL LOST", "Network disconnected. Storing last location and triggering emergency sequence.", "danger");
        updateStatusBanner("HIGH_RISK", "CRITICAL: NO SIGNAL DETECTED. AUTO-SOS INITIATED.");
        
        // Auto SOS Simulation on Disconnect
        setTimeout(() => {
            alert("EMERGENCY: SIGNAL LOST. Dialing 112...");
            window.location.href = "tel:112";
        }, 3000);
    });

    window.addEventListener('online', () => {
        showToast("SIGNAL RESTORED", "Network connected. Resuming live telemetry.", "success");
        updateStatusBanner("SAFE", "Location Secure (Perimeter Active)");
        if (isWatchingGps) {
            // Force a location update to sync
            navigator.geolocation.getCurrentPosition((pos) => {
                updatePosition(pos.coords.latitude, pos.coords.longitude);
            });
        }
    });

    // Check for weak signal using navigator.connection (simulated precaution)
    if (navigator.connection) {
        navigator.connection.addEventListener('change', () => {
            if (navigator.connection.effectiveType === '2g' || navigator.connection.downlink < 1.0) {
                updateStatusBanner("RESTRICTED", "WEAK SIGNAL: Entered Precaution Zone automatically.");
                showToast("Weak Signal", "Poor connectivity detected. Switching to Precaution Mode.", "warning");
            } else if (navigator.connection.effectiveType === '4g' || navigator.connection.effectiveType === '3g') {
                // Return to normal
                if (document.getElementById('statusBannerText').innerHTML.includes("WEAK SIGNAL")) {
                    updateStatusBanner("SAFE", "Location Secure (Perimeter Active)");
                }
            }
        });
    }
});
