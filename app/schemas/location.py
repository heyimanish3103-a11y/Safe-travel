from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class LocationUpdate(BaseModel):
    tourist_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = 5.0
    speed: Optional[float] = 0.0

class LocationResponse(BaseModel):
    id: int
    tourist_id: int
    latitude: float
    longitude: float
    accuracy: float
    speed: float
    timestamp: datetime

    class Config:
        from_attributes = True
