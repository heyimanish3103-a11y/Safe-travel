import hashlib
import uuid
from datetime import datetime
from pathlib import Path
import qrcode
from app.core.config import settings

class BlockchainIdentityService:
    @staticmethod
    def generate_digital_id() -> str:
        """Generate a structured, unique tourist ID."""
        short_id = uuid.uuid4().hex[:8].upper()
        return f"TID-{datetime.utcnow().year}-{short_id}"

    @staticmethod
    def generate_blockchain_hash(tourist_name: str, contact: str, digital_id: str) -> str:
        """Create a cryptographic SHA-256 hash anchoring identity to the simulated ledger."""
        raw_payload = f"{tourist_name}:{contact}:{digital_id}:{settings.SECRET_KEY}:{datetime.utcnow().isoformat()}"
        return "0x" + hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    @classmethod
    def generate_qr_code(cls, digital_id: str, name: str, blockchain_hash: str) -> str:
        """Generate QR code image for fast field verification."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        # The QR contains verification verification payload
        payload = f"TOURIST_SAFETY_ID:{digital_id}|NAME:{name}|HASH:{blockchain_hash[:16]}..."
        qr.add_data(payload)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        filename = f"{digital_id}.png"
        filepath = settings.QR_DIR / filename
        img.save(filepath)
        
        return f"/static/qrcodes/{filename}"

    @staticmethod
    def mask_contact(contact: str) -> str:
        """Mask contact for privacy preservation: e.g. +91 98*** **321"""
        if len(contact) <= 4:
            return "****"
        return contact[:3] + "*" * (len(contact) - 6) + contact[-3:]
