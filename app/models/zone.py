from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class Zone:
    id: Optional[int]
    name: str
    type: str
    coordinates_json: str
    color: str = "#ef4444"
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            type=row["type"],
            coordinates_json=row["coordinates_json"],
            color=row["color"],
            description=row["description"],
            created_at=row["created_at"]
        )
