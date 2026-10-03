// Admin Geo-Fence Studio Controller
let map;
let activeVertices = [];
let drawingMarkers = [];
let previewPolygon = null;
let savedZoneLayers = [];

// Initialize Map
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([28.6139, 77.2150], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
    }).addTo(map);

    // Map Click Listener for adding polygon points
    map.on('click', (e) => {
        const lat = parseFloat(e.latlng.lat.toFixed(5));
        const lng = parseFloat(e.latlng.lng.toFixed(5));
        addVertex(lat, lng);
    });
}

// Add Vertex to current polygon
function addVertex(lat, lng) {
    activeVertices.push([lat, lng]);

    // Place marker point
    const marker = L.circleMarker([lat, lng], {
        radius: 5,
        color: '#6366f1',
        fillColor: '#ffffff',
        fillOpacity: 1
    }).addTo(map);
    drawingMarkers.push(marker);

    updateDrawingPreview();
}

// Update Preview Polygon
function updateDrawingPreview() {
    const countEl = document.getElementById('vertexCount');
    const previewEl = document.getElementById('vertexCoordsPreview');
    countEl.textContent = activeVertices.length;

    if (activeVertices.length > 0) {
        const last = activeVertices[activeVertices.length - 1];
        previewEl.textContent = `Latest: [${last[0]}, ${last[1]}] (${activeVertices.length} points)`;
    } else {
        previewEl.textContent = "Click on the map to begin drawing...";
    }

    if (previewPolygon) {
        map.removeLayer(previewPolygon);
    }

    if (activeVertices.length >= 2) {
        const type = document.getElementById('zoneType').value;
        const color = type === 'HIGH_RISK' ? '#ef4444' : (type === 'RESTRICTED' ? '#f59e0b' : '#10b981');

        previewPolygon = L.polygon(activeVertices, {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            dashArray: '4, 4'
        }).addTo(map);
    }
}

// Clear Current Drawing
function clearDrawing() {
    activeVertices = [];
    drawingMarkers.forEach(m => map.removeLayer(m));
    drawingMarkers = [];
    if (previewPolygon) {
        map.removeLayer(previewPolygon);
        previewPolygon = null;
    }
    updateDrawingPreview();
}

// Load and Render Existing Saved Zones
async function loadExistingZones() {
    try {
        const res = await fetch('/api/v1/zones');
        const zones = await res.json();

        // Clear existing map layers
        savedZoneLayers.forEach(l => map.removeLayer(l));
        savedZoneLayers = [];

        const tbody = document.getElementById('zonesTableBody');
        tbody.innerHTML = '';

        zones.forEach(z => {
            // Render on Map
            if (z.coordinates && z.coordinates.length > 2) {
                const poly = L.polygon(z.coordinates, {
                    color: z.color,
                    fillColor: z.color,
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(map);

                poly.bindPopup(`
                    <b>${z.name}</b><br>
                    Type: <span class="badge ${z.type === 'HIGH_RISK' ? 'badge-high' : (z.type === 'RESTRICTED' ? 'badge-medium' : 'badge-low')}">${z.type}</span><br>
                    <small>${z.description || ''}</small>
                `);
                savedZoneLayers.push(poly);
            }

            // Render in Table
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>${z.name}</b></td>
                <td>
                    <span class="badge ${z.type === 'HIGH_RISK' ? 'badge-high' : (z.type === 'RESTRICTED' ? 'badge-medium' : 'badge-low')}">
                        ${z.type}
                    </span>
                </td>
                <td>
                    <button onclick="deleteZone(${z.id})" class="btn btn-secondary btn-sm" style="color: #ef4444; padding: 2px 6px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error("Failed to load zones:", e);
    }
}

// Delete Zone Action
window.deleteZone = async function(id) {
    if (!confirm("Are you sure you want to remove this security zone?")) return;
    try {
        const res = await fetch(`/api/v1/zones/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Zone Removed", "Perimeter successfully deleted.", "warning");
            loadExistingZones();
        }
    } catch (e) {
        alert("Failed to delete zone: " + e.message);
    }
};

// Form Submission
async function saveZone(e) {
    e.preventDefault();

    if (activeVertices.length < 3) {
        alert("Please click at least 3 points on the map to define a valid closed polygon.");
        return;
    }

    const type = document.getElementById('zoneType').value;
    const color = type === 'HIGH_RISK' ? '#ef4444' : (type === 'RESTRICTED' ? '#f59e0b' : '#10b981');

    const payload = {
        name: document.getElementById('zoneName').value.trim(),
        type: type,
        coordinates: activeVertices,
        color: color,
        description: document.getElementById('zoneDesc').value.trim()
    };

    try {
        const res = await fetch('/api/v1/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Perimeter Created", `Zone '${payload.name}' is now active and monitored.`, "success");
            clearDrawing();
            document.getElementById('zoneForm').reset();
            loadExistingZones();
        } else {
            const err = await res.json();
            alert("Error creating zone: " + (err.detail || "Server error"));
        }
    } catch (e) {
        alert("Network error: " + e.message);
    }
}

function showToast(title, message, type = "info") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i>
        <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${title}</div>
            <div style="font-size: 0.8rem; color: #cbd5e1;">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadExistingZones();

    document.getElementById('btnClearDraw').addEventListener('click', clearDrawing);
    document.getElementById('zoneForm').addEventListener('submit', saveZone);
    document.getElementById('zoneType').addEventListener('change', updateDrawingPreview);
});
