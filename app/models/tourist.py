from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class Tourist:
    id: Optional[int]
    name: str
    contact: str
    digital_id: str
    blockchain_hash: str
    email: Optional[str] = None
    id_proof_number: Optional[str] = None
    blockchain_block: int = 1049281
    qr_code_path: Optional[str] = None
    emergency_contact: Optional[str] = None
    preferences: Optional[str] = None
    is_active: bool = True
    is_tracking_enabled: bool = True
    created_at: Optional[datetime] = None

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            contact=row["contact"],
            email=row["email"],
            id_proof_number=row["id_proof_number"],
            digital_id=row["digital_id"],
            blockchain_hash=row["blockchain_hash"],
            blockchain_block=row["blockchain_block"],
            qr_code_path=row["qr_code_path"],
            emergency_contact=row["emergency_contact"] if "emergency_contact" in row.keys() else None,
            preferences=row["preferences"] if "preferences" in row.keys() else None,
            is_active=bool(row["is_active"]),
            is_tracking_enabled=bool(row["is_tracking_enabled"]),
            created_at=row["created_at"]
        )
