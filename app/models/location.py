from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class LocationLog:
    id: Optional[int]
    tourist_id: int
    latitude: float
    longitude: float
    accuracy: float = 5.0
    speed: float = 0.0
    timestamp: Optional[datetime] = None

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            id=row["id"],
            tourist_id=row["tourist_id"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            accuracy=row["accuracy"],
            speed=row["speed"],
            timestamp=row["timestamp"]
        )
