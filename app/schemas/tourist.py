from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

class TouristCreate(BaseModel):
    name: str
    contact: str
    password: str
    emergency_contact: Optional[str] = None
    email: Optional[str] = None
    preferences: Optional[str] = None
    id_proof_number: Optional[str] = None

class TouristResponse(BaseModel):
    id: int
    name: str
    contact: str
    email: Optional[str] = None
    id_proof_number: Optional[str] = None
    digital_id: str
    blockchain_hash: str
    blockchain_block: int
    qr_code_path: Optional[str] = None
    is_active: bool
    is_tracking_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TouristVerifyResponse(BaseModel):
    is_valid: bool
    digital_id: str
    name: str
    contact_masked: str
    blockchain_hash: str
    blockchain_block: int
    issued_at: datetime
    verification_status: str
    message: str
