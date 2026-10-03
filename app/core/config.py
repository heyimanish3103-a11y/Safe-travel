import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings:
    PROJECT_NAME: str = "Smart Tourist Safety Monitoring & Incident Response System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database URL: Defaults to SQLite for zero-config immediate portability.
    # Set environment variable DATABASE_URL to MySQL connection string if desired:
    # e.g., mysql+pymysql://root:password@localhost:3306/tourist_safety_db
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'tourist_safety.db'}")
    
    BASE_DIR: Path = BASE_DIR
    SECRET_KEY: str = os.getenv("SECRET_KEY", "tourist-safety-secret-key-blockchain-2026")
    QR_DIR: Path = BASE_DIR / "app" / "static" / "qrcodes"
    
settings = Settings()
settings.QR_DIR.mkdir(parents=True, exist_ok=True)
