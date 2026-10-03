from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class IncidentCreate(BaseModel):
    tourist_id: int
    type: str  # SOS, GEOFENCE_BREACH
    latitude: float
    longitude: float
    details: Optional[str] = None
    zone_id: Optional[int] = None

class IncidentStatusUpdate(BaseModel):
    status: str  # ACKNOWLEDGED, RESOLVED
    resolved_by: Optional[str] = None

class IncidentResponse(BaseModel):
    id: int
    tourist_id: int
    zone_id: Optional[int] = None
    type: str
    latitude: float
    longitude: float
    risk_level: str
    risk_score: int
    risk_factors: Optional[str] = None
    status: str
    details: Optional[str] = None
    resolved_by: Optional[str] = None
    timestamp: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
