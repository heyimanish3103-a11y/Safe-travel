import json
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.core.database import get_db
from app.schemas.zone import ZoneCreate, ZoneResponse

router = APIRouter(prefix="/zones", tags=["Zones"])

@router.post("", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(payload: ZoneCreate):
    """Create a new Geo-Fence zone (SAFE, RESTRICTED, HIGH_RISK)."""
    zone_type = payload.type.upper()
    if zone_type not in ("SAFE", "RESTRICTED", "HIGH_RISK"):
        raise HTTPException(status_code=400, detail="Invalid zone type. Must be SAFE, RESTRICTED, or HIGH_RISK")

    color = payload.color
    if not color:
        color = "#10b981" if zone_type == "SAFE" else ("#f59e0b" if zone_type == "RESTRICTED" else "#ef4444")

    coords_json = json.dumps(payload.coordinates)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO zones (name, type, coordinates_json, color, description)
            VALUES (?, ?, ?, ?, ?)
        """, (payload.name, zone_type, coords_json, color, payload.description))
        zone_id = cursor.lastrowid
        cursor.execute("SELECT * FROM zones WHERE id = ?", (zone_id,))
        row = cursor.fetchone()

        return ZoneResponse(
            id=row["id"],
            name=row["name"],
            type=row["type"],
            coordinates=json.loads(row["coordinates_json"]),
            color=row["color"],
            description=row["description"],
            created_at=row["created_at"]
        )

@router.get("", response_model=List[ZoneResponse])
def get_zones():
    """List all configured geo-fence perimeters."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM zones ORDER BY id ASC")
        rows = cursor.fetchall()
        results = []
        for r in rows:
            try:
                coords = json.loads(r["coordinates_json"])
            except Exception:
                coords = []
            results.append(ZoneResponse(
                id=r["id"],
                name=r["name"],
                type=r["type"],
                coordinates=coords,
                color=r["color"],
                description=r["description"],
                created_at=r["created_at"]
            ))
        return results

@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: int):
    """Remove a geo-fence zone."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM zones WHERE id = ?", (zone_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Zone not found")
        cursor.execute("DELETE FROM zones WHERE id = ?", (zone_id,))
    return None
