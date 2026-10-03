from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.core.database import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentStatusUpdate, IncidentResponse
from app.services.ai_risk import AIRiskClassifier
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("/sos", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def raise_sos_emergency(payload: IncidentCreate):
    """
    Instant One-Touch Emergency SOS trigger.
    Calculates AI threat level and immediately notifies all active responders.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists WHERE id = ?", (payload.tourist_id,))
        t_row = cursor.fetchone()
        if not t_row:
            raise HTTPException(status_code=404, detail="Tourist not found")
        tourist = dict(t_row)

        cursor.execute("SELECT COUNT(*) FROM incidents WHERE tourist_id = ? AND status = 'OPEN'", (payload.tourist_id,))
        recent_count = cursor.fetchone()[0]

        risk_level, risk_score, risk_factors = AIRiskClassifier.classify_incident(
            incident_type="SOS",
            zone=None,
            recent_incident_count=recent_count,
            incident_time=datetime.utcnow()
        )

        details = payload.details or f"Emergency SOS triggered by {tourist['name']} ({tourist['contact']})"
        cursor.execute("""
            INSERT INTO incidents (tourist_id, zone_id, type, latitude, longitude, risk_level, risk_score, risk_factors, status, details)
            VALUES (?, ?, 'SOS', ?, ?, ?, ?, ?, 'OPEN', ?)
        """, (payload.tourist_id, payload.zone_id, payload.latitude, payload.longitude, risk_level, risk_score, risk_factors, details))
        inc_id = cursor.lastrowid
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (inc_id,))
        incident = dict(cursor.fetchone())

    # Instant tactical emergency broadcast to authorities
    emergency_packet = {
        "event": "SOS_EMERGENCY",
        "incident": {
            "id": incident["id"],
            "tourist_id": tourist["id"],
            "tourist_name": tourist["name"],
            "contact": tourist["contact"],
            "digital_id": tourist["digital_id"],
            "type": incident["type"],
            "risk_level": incident["risk_level"],
            "risk_score": incident["risk_score"],
            "risk_factors": incident["risk_factors"],
            "latitude": incident["latitude"],
            "longitude": incident["longitude"],
            "details": incident["details"],
            "timestamp": str(incident["timestamp"])
        }
    }
    await ws_manager.broadcast_to_authorities(emergency_packet)

    # Send confirmation back to tourist
    await ws_manager.send_to_tourist(payload.tourist_id, {
        "event": "SOS_ACKNOWLEDGED",
        "incident_id": incident["id"],
        "message": "Emergency broadcast dispatched! Responders have been alerted with your live location."
    })

    return incident

@router.get("", response_model=List[IncidentResponse])
def get_incidents(
    risk_level: Optional[str] = Query(None, description="Filter by LOW, MEDIUM, HIGH"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by OPEN, ACKNOWLEDGED, RESOLVED")
):
    """Retrieve list of incidents with optional risk level and status filters."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []
        if risk_level:
            query += " AND risk_level = ?"
            params.append(risk_level.upper())
        if status_filter:
            query += " AND status = ?"
            params.append(status_filter.upper())
        query += " ORDER BY timestamp DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int):
    """Retrieve single incident details."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")
        return dict(row)

@router.patch("/{incident_id}/status", response_model=IncidentResponse)
async def update_incident_status(incident_id: int, payload: IncidentStatusUpdate):
    """Acknowledge or Resolve an incident."""
    new_status = payload.status.upper()
    if new_status not in ("OPEN", "ACKNOWLEDGED", "RESOLVED"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be OPEN, ACKNOWLEDGED, or RESOLVED")

    resolved_at = datetime.utcnow().isoformat() if new_status == "RESOLVED" else None

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")

        cursor.execute("""
            UPDATE incidents 
            SET status = ?, resolved_by = COALESCE(?, resolved_by), resolved_at = COALESCE(?, resolved_at)
            WHERE id = ?
        """, (new_status, payload.resolved_by, resolved_at, incident_id))
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        incident = dict(cursor.fetchone())

    # Broadcast status change to authorities
    await ws_manager.broadcast_to_authorities({
        "event": "INCIDENT_STATUS_CHANGED",
        "incident_id": incident["id"],
        "new_status": incident["status"],
        "resolved_by": incident["resolved_by"]
    })

    return incident
