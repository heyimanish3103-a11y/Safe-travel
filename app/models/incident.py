from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class Incident:
    id: Optional[int]
    tourist_id: int
    type: str
    latitude: float
    longitude: float
    zone_id: Optional[int] = None
    risk_level: str = "MEDIUM"
    risk_score: int = 50
    risk_factors: Optional[str] = None
    status: str = "OPEN"
    details: Optional[str] = None
    resolved_by: Optional[str] = None
    timestamp: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            id=row["id"],
            tourist_id=row["tourist_id"],
            zone_id=row["zone_id"],
            type=row["type"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            risk_level=row["risk_level"],
            risk_score=row["risk_score"],
            risk_factors=row["risk_factors"],
            status=row["status"],
            details=row["details"],
            resolved_by=row["resolved_by"],
            timestamp=row["timestamp"],
            resolved_at=row["resolved_at"]
        )
