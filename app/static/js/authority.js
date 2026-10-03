// Authority Tactical Command Center Controller
let map;
let touristMarkers = {};
let incidentMarkers = {};
let zonesList = [];
let allIncidents = [];
let activeFilter = "ALL";
let socket = null;

// Initialize Map
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([28.6139, 77.2150], 14);

    // Dark tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
    }).addTo(map);
}

// Load Zones
async function loadZones() {
    try {
        const res = await fetch('/api/v1/zones');
        zonesList = await res.json();
        document.getElementById('statZones').textContent = zonesList.length;

        zonesList.forEach(zone => {
            if (zone.coordinates && zone.coordinates.length > 2) {
                const polygon = L.polygon(zone.coordinates, {
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: zone.type === 'HIGH_RISK' ? 0.35 : (zone.type === 'RESTRICTED' ? 0.22 : 0.12),
                    weight: 2,
                    dashArray: zone.type === 'RESTRICTED' ? '5, 5' : null
                }).addTo(map);

                polygon.bindPopup(`
                    <div style="font-family: 'Outfit', sans-serif;">
                        <span class="badge ${zone.type === 'HIGH_RISK' ? 'badge-high' : (zone.type === 'RESTRICTED' ? 'badge-medium' : 'badge-low')}">
                            ${zone.type}
                        </span>
                        <h4 style="margin: 5px 0 2px 0; font-weight: 700; color: #f8fafc;">${zone.name}</h4>
                        <p style="font-size: 11px; color: #94a3b8;">${zone.description || ''}</p>
                    </div>
                `);
            }
        });
    } catch (e) {
        console.error("Failed to load zones:", e);
    }
}

// Load Tourists & Mark on Map
async function loadTourists() {
    try {
        const res = await fetch('/api/v1/tourists');
        const tourists = await res.json();
        document.getElementById('statTourists').textContent = tourists.length;

        // Clear existing
        Object.values(touristMarkers).forEach(m => map.removeLayer(m));
        touristMarkers = {};

        // In a real app we'd fetch latest coordinates; for now place default coordinates or update via WS
        tourists.forEach((t, i) => {
            const defaultCoords = [
                [28.6140, 77.2100],
                [28.6160, 77.2180],
                [28.6050, 77.2200]
            ];
            const coords = defaultCoords[i % defaultCoords.length];
            updateTouristMarker(t.id, t.name, t.digital_id, coords[0], coords[1]);
        });
    } catch (e) {
        console.error("Failed to load tourists:", e);
    }
}

// Update or create tourist beacon marker
function updateTouristMarker(id, name, digitalId, lat, lon) {
    if (touristMarkers[id]) {
        touristMarkers[id].setLatLng([lat, lon]);
    } else {
        const icon = L.divIcon({
            className: 'tourist-beacon',
            html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="width: 14px; height: 14px; background: #38bdf8; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px #38bdf8;"></div>
                    <div style="position: absolute; top: -18px; white-space: nowrap; font-size: 10px; font-weight: 700; background: rgba(15, 23, 42, 0.85); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                        ${name.split(' ')[0]}
                    </div>
                </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([lat, lon], { icon }).addTo(map);
        marker.bindPopup(`
            <div style="font-family: 'Outfit', sans-serif;">
                <h4 style="margin: 0 0 4px 0; font-weight: 700;">${name}</h4>
                <div style="font-family: monospace; font-size: 11px; color: #38bdf8;">${digitalId}</div>
                <button onclick="quickVerify('${digitalId}')" class="btn btn-secondary btn-sm" style="margin-top: 8px; width: 100%;">
                    <i class="fa-solid fa-shield-halved"></i> Verify Digital Pass
                </button>
            </div>
        `);
        touristMarkers[id] = marker;
    }
}

// Load Incidents
async function loadIncidents() {
    try {
        const res = await fetch('/api/v1/incidents');
        allIncidents = await res.json();
        renderIncidentFeed();
        updateMetrics();
        plotIncidentMarkers();
    } catch (e) {
        console.error("Failed to load incidents:", e);
    }
}

// Plot active incidents on Map
function plotIncidentMarkers() {
    Object.values(incidentMarkers).forEach(m => map.removeLayer(m));
    incidentMarkers = {};

    allIncidents.filter(inc => inc.status !== 'RESOLVED').forEach(inc => {
        const isHigh = inc.risk_level === 'HIGH';
        const icon = L.divIcon({
            className: 'incident-beacon',
            html: `
                <div style="width: 24px; height: 24px; background: ${isHigh ? '#ef4444' : '#f59e0b'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; box-shadow: 0 0 15px ${isHigh ? '#ef4444' : '#f59e0b'}; animation: pulse-sos 1.5s infinite;">
                    <i class="fa-solid fa-${inc.type === 'SOS' ? 'triangle-exclamation' : 'skull-crossbones'}"></i>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([inc.latitude, inc.longitude], { icon }).addTo(map);
        marker.bindPopup(`
            <div style="font-family: 'Outfit', sans-serif;">
                <span class="badge ${isHigh ? 'badge-high' : 'badge-medium'}">${inc.risk_level} RISK (${inc.risk_score}%)</span>
                <h4 style="margin: 6px 0 2px 0;">${inc.type}</h4>
                <p style="font-size: 12px; color: #94a3b8;">${inc.details || ''}</p>
                <button onclick="resolveIncident(${inc.id})" class="btn btn-primary btn-sm" style="margin-top: 8px; width: 100%;">
                    Mark Resolved
                </button>
            </div>
        `);
        incidentMarkers[inc.id] = marker;
    });
}

// Update Metrics Counters
function updateMetrics() {
    const openIncidents = allIncidents.filter(i => i.status !== 'RESOLVED');
    const highThreats = openIncidents.filter(i => i.risk_level === 'HIGH');

    document.getElementById('statOpenIncidents').textContent = openIncidents.length;
    document.getElementById('statHighThreat').textContent = highThreats.length;
    document.getElementById('countAll').textContent = allIncidents.length;
}

// Render Incident Feed
function renderIncidentFeed() {
    const feed = document.getElementById('incidentFeed');
    feed.innerHTML = '';

    let filtered = allIncidents;
    if (activeFilter === "HIGH") {
        filtered = allIncidents.filter(i => i.risk_level === 'HIGH');
    } else if (activeFilter === "OPEN") {
        filtered = allIncidents.filter(i => i.status !== 'RESOLVED');
    } else if (activeFilter === "RESOLVED") {
        filtered = allIncidents.filter(i => i.status === 'RESOLVED');
    }

    if (filtered.length === 0) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
                <i class="fa-solid fa-circle-check" style="font-size: 2rem; margin-bottom: 0.5rem; color: #34d399;"></i>
                <div>No active incidents found in this filter view.</div>
            </div>
        `;
        return;
    }

    filtered.forEach(inc => {
        const card = document.createElement('div');
        const threatClass = inc.risk_level === 'HIGH' ? 'high-threat' : (inc.risk_level === 'MEDIUM' ? 'medium-threat' : 'low-threat');
        card.className = `incident-card ${threatClass}`;

        const isResolved = inc.status === 'RESOLVED';
        const isAck = inc.status === 'ACKNOWLEDGED';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div>
                    <span class="badge ${inc.risk_level === 'HIGH' ? 'badge-high' : (inc.risk_level === 'MEDIUM' ? 'badge-medium' : 'badge-low')}">
                        ${inc.risk_level} RISK (${inc.risk_score}%)
                    </span>
                    <span class="badge ${isResolved ? 'badge-resolved' : (isAck ? 'badge-acknowledged' : 'badge-open')}" style="margin-left: 4px;">
                        ${inc.status}
                    </span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
                    ${new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem;">
                <i class="fa-solid fa-${inc.type === 'SOS' ? 'triangle-exclamation' : 'shield-halved'}"></i>
                ${inc.type} — Incident #${inc.id}
            </div>

            <p style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 0.5rem;">
                ${inc.details || 'Distress signal received.'}
            </p>

            <div style="background: rgba(0,0,0,0.25); padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.75rem;">
                <b style="color: #6366f1;">AI Risk Breakdown:</b> ${inc.risk_factors || 'Standard rule factors'}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <button onclick="panToIncident(${inc.latitude}, ${inc.longitude})" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">
                    <i class="fa-solid fa-crosshairs"></i> Pan to Target
                </button>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                    ${!isResolved ? `
                        <button onclick="openDispatchModal(${inc.id})" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; color: #f87171; border-color: rgba(239, 68, 68, 0.4);">
                            <i class="fa-solid fa-truck-medical"></i> Dispatch
                        </button>
                    ` : ''}
                    ${!isResolved && !isAck ? `
                        <button onclick="acknowledgeIncident(${inc.id})" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; color: #fbbf24;">
                            Acknowledge
                        </button>
                    ` : ''}
                    ${!isResolved ? `
                        <button onclick="resolveIncident(${inc.id})" class="btn btn-primary btn-sm" style="font-size: 0.75rem;">
                            Resolve
                        </button>
                    ` : `
                        <span style="font-size: 0.75rem; color: #34d399;"><i class="fa-solid fa-check"></i> Closed</span>
                    `}
                </div>
            </div>
        `;
        feed.appendChild(card);
    });
}

function panToIncident(lat, lon) {
    map.flyTo([lat, lon], 16, { duration: 1.2 });
}

// Acknowledge Incident Action
async function acknowledgeIncident(id) {
    try {
        const res = await fetch(`/api/v1/incidents/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACKNOWLEDGED', resolved_by: 'Officer On Duty' })
        });
        if (res.ok) {
            await loadIncidents();
            showToast("Status Updated", `Incident #${id} set to ACKNOWLEDGED.`, "warning");
        }
    } catch (e) {
        console.error(e);
    }
}

// Resolve Incident Action
async function resolveIncident(id) {
    try {
        const res = await fetch(`/api/v1/incidents/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RESOLVED', resolved_by: 'HQ Command Desk' })
        });
        if (res.ok) {
            await loadIncidents();
            showToast("Incident Resolved", `Incident #${id} marked as RESOLVED.`, "success");
        }
    } catch (e) {
        console.error(e);
    }
}

// WebSocket Connection to Real-Time Command Stream
function initAuthorityWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/authority`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        document.getElementById('wsStatusBadge').className = 'badge badge-low';
        document.getElementById('wsStatusBadge').innerHTML = '<i class="fa-solid fa-wifi"></i> TELEMETRY LIVE';
    };

    socket.onclose = () => {
        document.getElementById('wsStatusBadge').className = 'badge badge-high';
        document.getElementById('wsStatusBadge').innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> RECONNECTING';
        setTimeout(initAuthorityWebSocket, 3000);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.event === "LOCATION_UPDATE") {
                updateTouristMarker(data.tourist_id, data.name, data.digital_id, data.latitude, data.longitude);
            } 
            else if (data.event === "SOS_EMERGENCY") {
                playAlertSiren();
                showToast("🚨 PRIORITY SOS DISPATCH", `Distress alert from ${data.incident.tourist_name} (${data.incident.digital_id})`, "danger");
                loadIncidents();
                map.flyTo([data.incident.latitude, data.incident.longitude], 16);
            } 
            else if (data.event === "INCIDENT_ALERT") {
                playAlertSiren();
                showToast("⚠️ PERIMETER BREACH", `${data.incident.tourist_name} breached ${data.incident.zone_name}`, "warning");
                loadIncidents();
            } 
            else if (data.event === "INCIDENT_STATUS_CHANGED") {
                loadIncidents();
            }
        } catch (e) {
            console.error("WS error:", e);
        }
    };
}

function playAlertSiren() {
    const audio = document.getElementById('sirenAudio');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio autoplay prevented."));
    }
}

function showToast(title, message, type = "info") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'danger' ? 'triangle-exclamation' : (type === 'warning' ? 'circle-exclamation' : 'circle-check')}"></i>
        <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${title}</div>
            <div style="font-size: 0.8rem; color: #cbd5e1;">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}

// Verification Modal Logic
window.quickVerify = function(digitalId) {
    document.getElementById('verifyInputId').value = digitalId;
    document.getElementById('verifyModal').classList.add('active');
    executeVerification(digitalId);
};

async function executeVerification(digitalId) {
    const container = document.getElementById('verifyResultContainer');
    container.style.display = 'block';
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Querying Blockchain Nodes...</div>';

    try {
        const res = await fetch(`/api/v1/tourists/verify/${encodeURIComponent(digitalId)}`);
        const data = await res.json();

        if (data.is_valid) {
            container.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #34d399; font-weight: 700; font-size: 1.05rem; margin-bottom: 0.75rem;">
                        <i class="fa-solid fa-circle-check"></i> ${data.verification_status}
                    </div>
                    <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
                        <span style="color: var(--text-muted);">Verified Name:</span> <b>${data.name}</b>
                    </div>
                    <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
                        <span style="color: var(--text-muted);">Digital Pass ID:</span> <span style="font-family: monospace; color: #38bdf8;">${data.digital_id}</span>
                    </div>
                    <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
                        <span style="color: var(--text-muted);">Ledger Block #:</span> <b>${data.blockchain_block}</b>
                    </div>
                    <div style="font-size: 0.75rem; color: #94a3b8; word-break: break-all; margin-top: 0.5rem; background: rgba(0,0,0,0.3); padding: 0.4rem; border-radius: 4px;">
                        <b>Ledger Signature:</b> ${data.blockchain_hash}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 1.25rem; color: #f87171;">
                    <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.4rem;">
                        <i class="fa-solid fa-triangle-exclamation"></i> INVALID CREDENTIAL
                    </div>
                    <p style="font-size: 0.85rem;">No matching record found on the tourist ledger.</p>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = `<div style="color: #ef4444;">Verification service unavailable.</div>`;
    }
}

// Dispatch Modal Workflow (Workflow Diagram 2)
let currentDispatchIncidentId = null;
function openDispatchModal(incidentId) {
    currentDispatchIncidentId = incidentId;
    document.getElementById('dispatchIncidentId').value = incidentId;
    document.getElementById('dispatchModal').classList.add('active');
}

// Camera Scanner state for Authority
let authQrScanner = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadZones();
    loadTourists();
    loadIncidents();
    initAuthorityWebSocket();

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.dataset.filter;
            renderIncidentFeed();
        });
    });

    document.getElementById('btnRefreshIncidents').addEventListener('click', loadIncidents);

    // Verify Modal
    const modal = document.getElementById('verifyModal');
    document.getElementById('btnOpenVerifyModal').addEventListener('click', () => {
        modal.classList.add('active');
    });
    document.getElementById('btnCloseVerifyModal').addEventListener('click', () => {
        modal.classList.remove('active');
        if (authQrScanner && authQrScanner.isScanning) {
            authQrScanner.stop();
            document.getElementById('authQrReader').style.display = 'none';
        }
    });
    document.getElementById('btnExecuteVerify').addEventListener('click', () => {
        const id = document.getElementById('verifyInputId').value.trim();
        if (id) executeVerification(id);
    });

    // Camera QR Scanner in Authority Modal
    const btnAuthScanCamera = document.getElementById('btnAuthScanCamera');
    const authQrReader = document.getElementById('authQrReader');
    if (btnAuthScanCamera && authQrReader) {
        btnAuthScanCamera.addEventListener('click', () => {
            if (authQrScanner && authQrScanner.isScanning) {
                authQrScanner.stop().then(() => {
                    authQrReader.style.display = 'none';
                });
                return;
            }

            authQrReader.style.display = 'block';
            if (!authQrScanner) {
                authQrScanner = new Html5Qrcode("authQrReader");
            }

            authQrScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
                    let parsedId = decodedText;
                    if (decodedText.includes("TOURIST_SAFETY_ID:")) {
                        const parts = decodedText.split("|");
                        parsedId = parts[0].replace("TOURIST_SAFETY_ID:", "").trim();
                    }
                    document.getElementById('verifyInputId').value = parsedId;
                    authQrScanner.stop().then(() => {
                        authQrReader.style.display = 'none';
                        executeVerification(parsedId);
                    });
                },
                (err) => {}
            ).catch(err => {
                alert("Camera permission denied or camera unavailable: " + err);
                authQrReader.style.display = 'none';
            });
        });
    }

    // Dispatch Modal Handlers
    const dispatchModal = document.getElementById('dispatchModal');
    const btnCloseDispatch = document.getElementById('btnCloseDispatchModal');
    const btnCancelDispatch = document.getElementById('btnCancelDispatch');
    const btnConfirmDispatch = document.getElementById('btnConfirmDispatch');

    if (btnCloseDispatch) btnCloseDispatch.addEventListener('click', () => dispatchModal.classList.remove('active'));
    if (btnCancelDispatch) btnCancelDispatch.addEventListener('click', () => dispatchModal.classList.remove('active'));

    if (btnConfirmDispatch) {
        btnConfirmDispatch.addEventListener('click', async () => {
            const team = document.getElementById('dispatchUnitSelect').value;
            const notes = document.getElementById('dispatchNotes').value.trim();
            const id = currentDispatchIncidentId;

            if (!id) return;

            try {
                const res = await fetch(`/api/v1/incidents/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'ACKNOWLEDGED',
                        resolved_by: `${team} (${notes || 'Immediate Response'})`
                    })
                });

                if (res.ok) {
                    dispatchModal.classList.remove('active');
                    await loadIncidents();
                    showToast("Tactical Unit Deployed", `${team} dispatched to Incident #${id}.`, "danger");
                }
            } catch (err) {
                alert("Failed to record dispatch: " + err.message);
            }
        });
    }
});
