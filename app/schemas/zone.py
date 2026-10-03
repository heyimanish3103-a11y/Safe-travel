from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class ZoneCreate(BaseModel):
    name: str
    type: str  # SAFE, RESTRICTED, HIGH_RISK
    coordinates: List[List[float]]  # [[lat, lng], [lat, lng], ...]
    color: Optional[str] = "#ef4444"
    description: Optional[str] = None

class ZoneResponse(BaseModel):
    id: int
    name: str
    type: str
    coordinates: List[List[float]]
    color: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
