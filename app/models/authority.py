from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class Authority:
    id: Optional[int]
    username: str
    hashed_password: str
    full_name: str
    badge_number: str
    role: str = "Responder"
    assigned_zone: Optional[str] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            id=row["id"],
            username=row["username"],
            hashed_password=row["hashed_password"],
            full_name=row["full_name"],
            badge_number=row["badge_number"],
            role=row["role"],
            assigned_zone=row["assigned_zone"],
            created_at=row["created_at"]
        )
