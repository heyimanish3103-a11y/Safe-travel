import json
from datetime import datetime
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status

from app.core.database import get_db
from app.models.tourist import Tourist
from app.models.location import LocationLog
from app.models.zone import Zone
from app.models.incident import Incident
from app.schemas.tourist import TouristCreate, TouristResponse, TouristVerifyResponse
from app.schemas.location import LocationUpdate, LocationResponse
from app.services.blockchain import BlockchainIdentityService
from app.services.geofence import GeoFenceService
from app.services.ai_risk import AIRiskClassifier
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/tourists", tags=["Tourists"])

@router.post("/register", response_model=TouristResponse, status_code=status.HTTP_201_CREATED)
def register_tourist(payload: TouristCreate):
    """Register a new tourist, generate blockchain hash and QR code pass."""
    digital_id = BlockchainIdentityService.generate_digital_id()
    bc_hash = BlockchainIdentityService.generate_blockchain_hash(payload.name, payload.contact, digital_id)
    qr_path = BlockchainIdentityService.generate_qr_code(digital_id, payload.name, bc_hash)

    # Note: In production, password should be hashed. Using plain text for demo.
    password_hash = payload.password 

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM tourists")
        count = cursor.fetchone()[0]
        block_num = 1049280 + count + 1

        cursor.execute("""
            INSERT INTO tourists (name, contact, email, id_proof_number, emergency_contact, preferences, digital_id, blockchain_hash, blockchain_block, qr_code_path, is_active, is_tracking_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        """, (payload.name, payload.contact, payload.email, payload.id_proof_number, payload.emergency_contact, payload.preferences, digital_id, bc_hash, block_num, qr_path))
        
        # We need to store password somewhere. Let's hijack id_proof_number if schema isn't easily altered, 
        # or better yet, since this is a demo, let's just create the column if it doesn't exist, but since schema is set,
        # let's just use email check and assume password is correct for demo or use id_proof_number to store password.
        # Actually, let's just alter table if not exists.
        try:
            cursor.execute("ALTER TABLE tourists ADD COLUMN password TEXT")
        except:
            pass # column exists
            
        cursor.execute("UPDATE tourists SET password = ? WHERE id = ?", (password_hash, cursor.lastrowid))
        
        tourist_id = cursor.lastrowid

        cursor.execute("SELECT * FROM tourists WHERE id = ?", (tourist_id,))
        row = cursor.fetchone()
        return dict(row)

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login", response_model=TouristResponse)
def login_tourist(payload: LoginRequest):
    """Login with Email and Password."""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("ALTER TABLE tourists ADD COLUMN password TEXT")
        except:
            pass
        
        cursor.execute("SELECT * FROM tourists WHERE email = ?", (payload.email,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        row_dict = dict(row)
        
        # Check password only if it is set in the database, otherwise allow for older users
        db_password = row_dict.get("password")
        if db_password and db_password != payload.password:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        return row_dict

@router.post("/google-login", response_model=TouristResponse)
def google_login_tourist(payload: dict):
    """Mock Google Login. Uses email to find or create."""
    email = payload.get("email")
    name = payload.get("name", "Google User")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        
        # Auto register
        digital_id = BlockchainIdentityService.generate_digital_id()
        bc_hash = BlockchainIdentityService.generate_blockchain_hash(name, "0000000000", digital_id)
        qr_path = BlockchainIdentityService.generate_qr_code(digital_id, name, bc_hash)
        
        cursor.execute("SELECT COUNT(*) FROM tourists")
        block_num = 1049280 + cursor.fetchone()[0] + 1
        
        cursor.execute("""
            INSERT INTO tourists (name, contact, email, digital_id, blockchain_hash, blockchain_block, qr_code_path, is_active, is_tracking_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
        """, (name, "0000000000", email, digital_id, bc_hash, block_num, qr_path))
        tourist_id = cursor.lastrowid
        cursor.execute("SELECT * FROM tourists WHERE id = ?", (tourist_id,))
        return dict(cursor.fetchone())

@router.get("", response_model=List[TouristResponse])
def get_all_tourists():
    """List all registered tourists."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@router.get("/{tourist_id}", response_model=TouristResponse)
def get_tourist(tourist_id: int):
    """Get tourist profile by database ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists WHERE id = ?", (tourist_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tourist not found")
        return dict(row)

@router.get("/verify/{digital_id}", response_model=TouristVerifyResponse)
def verify_tourist_identity(digital_id: str):
    """Field officer QR/digital_id lookup to verify identity against blockchain records."""
    clean_id = digital_id.strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists WHERE digital_id = ?", (clean_id,))
        row = cursor.fetchone()
        if not row:
            return TouristVerifyResponse(
                is_valid=False,
                digital_id=clean_id,
                name="Unknown",
                contact_masked="N/A",
                blockchain_hash="N/A",
                blockchain_block=0,
                issued_at=datetime.utcnow(),
                verification_status="INVALID_CREDENTIAL",
                message="No matching blockchain identity record exists."
            )

        issued_at = datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"]
        return TouristVerifyResponse(
            is_valid=True,
            digital_id=row["digital_id"],
            name=row["name"],
            contact_masked=BlockchainIdentityService.mask_contact(row["contact"]),
            blockchain_hash=row["blockchain_hash"],
            blockchain_block=row["blockchain_block"],
            issued_at=issued_at,
            verification_status="VERIFIED_TAMPER_PROOF",
            message="Digital Tourist Identity Verified On Simulated Polygon Ledger"
        )

@router.post("/{tourist_id}/location", response_model=LocationResponse)
async def update_tourist_location(tourist_id: int, payload: LocationUpdate):
    """
    Ingest live GPS location telemetry, evaluate against Geo-Fences, and broadcast alerts.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tourists WHERE id = ?", (tourist_id,))
        t_row = cursor.fetchone()
        if not t_row:
            raise HTTPException(status_code=404, detail="Tourist not found")
        tourist = dict(t_row)

        # Record location log
        cursor.execute("""
            INSERT INTO location_logs (tourist_id, latitude, longitude, accuracy, speed)
            VALUES (?, ?, ?, ?, ?)
        """, (tourist_id, payload.latitude, payload.longitude, payload.accuracy or 5.0, payload.speed or 0.0))
        loc_id = cursor.lastrowid
        cursor.execute("SELECT * FROM location_logs WHERE id = ?", (loc_id,))
        loc_row = dict(cursor.fetchone())

        # Retrieve all zones
        cursor.execute("SELECT * FROM zones")
        zones_rows = cursor.fetchall()
        active_zones = [Zone.from_row(r) for r in zones_rows]

    # Broadcast location update to Authorities tactical map
    telemetry_packet = {
        "event": "LOCATION_UPDATE",
        "tourist_id": tourist["id"],
        "name": tourist["name"],
        "digital_id": tourist["digital_id"],
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "timestamp": loc_row["timestamp"]
    }
    await ws_manager.broadcast_to_authorities(telemetry_packet)

    # Evaluate Geofence perimeters
    matched_zone, breach_status = GeoFenceService.evaluate_location(
        payload.latitude, payload.longitude, active_zones
    )

    if breach_status in ("HIGH_RISK_BREACH", "RESTRICTED_BREACH") and matched_zone:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM incidents 
                WHERE tourist_id = ? AND zone_id = ? AND status = 'OPEN'
                ORDER BY timestamp DESC LIMIT 1
            """, (tourist_id, matched_zone.id))
            recent_incident = cursor.fetchone()

            if not recent_incident:
                cursor.execute("SELECT COUNT(*) FROM incidents WHERE tourist_id = ? AND status = 'OPEN'", (tourist_id,))
                recent_count = cursor.fetchone()[0]

                risk_level, risk_score, risk_factors = AIRiskClassifier.classify_incident(
                    incident_type="GEOFENCE_BREACH",
                    zone=matched_zone,
                    recent_incident_count=recent_count,
                    incident_time=datetime.utcnow()
                )

                details = f"Unauthorized entry into {matched_zone.name} ({matched_zone.type})"
                cursor.execute("""
                    INSERT INTO incidents (tourist_id, zone_id, type, latitude, longitude, risk_level, risk_score, risk_factors, status, details)
                    VALUES (?, ?, 'GEOFENCE_BREACH', ?, ?, ?, ?, ?, 'OPEN', ?)
                """, (tourist_id, matched_zone.id, payload.latitude, payload.longitude, risk_level, risk_score, risk_factors, details))
                inc_id = cursor.lastrowid
                cursor.execute("SELECT * FROM incidents WHERE id = ?", (inc_id,))
                incident = dict(cursor.fetchone())

                # Broadcast incident to authorities
                incident_alert = {
                    "event": "INCIDENT_ALERT",
                    "incident": {
                        "id": incident["id"],
                        "tourist_id": tourist["id"],
                        "tourist_name": tourist["name"],
                        "digital_id": tourist["digital_id"],
                        "type": incident["type"],
                        "zone_name": matched_zone.name,
                        "risk_level": incident["risk_level"],
                        "risk_score": incident["risk_score"],
                        "risk_factors": incident["risk_factors"],
                        "latitude": incident["latitude"],
                        "longitude": incident["longitude"],
                        "details": incident["details"],
                        "timestamp": str(incident["timestamp"])
                    }
                }
                await ws_manager.broadcast_to_authorities(incident_alert)

                # Send warning notification directly to the tourist
                await ws_manager.send_to_tourist(tourist_id, {
                    "event": "HAZARD_WARNING",
                    "title": f"⚠️ Perimeter Warning: {matched_zone.name}",
                    "message": f"You have entered a {matched_zone.type} area. Please return to safe zones.",
                    "zone_type": matched_zone.type
                })

    return loc_row
