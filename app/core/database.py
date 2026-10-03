import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from app.core.config import settings

DB_PATH = settings.BASE_DIR / "tourist_safety.db"

# Thread-local storage for sqlite connections
_local = threading.local()

def get_connection():
    if not hasattr(_local, "connection") or _local.connection is None:
        conn = sqlite3.connect(
            str(DB_PATH),
            check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        _local.connection = conn
    return _local.connection

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

def init_db():
    """Create all core database tables with proper indexing."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Tourists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tourists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact TEXT NOT NULL,
                email TEXT,
                id_proof_number TEXT,
                digital_id TEXT UNIQUE NOT NULL,
                blockchain_hash TEXT UNIQUE NOT NULL,
                blockchain_block INTEGER DEFAULT 1049281,
                qr_code_path TEXT,
                emergency_contact TEXT,
                preferences TEXT,
                is_active INTEGER DEFAULT 1,
                is_tracking_enabled INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Zones
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                coordinates_json TEXT NOT NULL,
                color TEXT DEFAULT '#ef4444',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. Incidents
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tourist_id INTEGER NOT NULL,
                zone_id INTEGER,
                type TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
                risk_score INTEGER DEFAULT 50,
                risk_factors TEXT,
                status TEXT DEFAULT 'OPEN',
                details TEXT,
                resolved_by TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                FOREIGN KEY (tourist_id) REFERENCES tourists (id) ON DELETE CASCADE,
                FOREIGN KEY (zone_id) REFERENCES zones (id) ON DELETE SET NULL
            );
        """)

        # 4. Location Logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS location_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tourist_id INTEGER NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL DEFAULT 5.0,
                speed REAL DEFAULT 0.0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tourist_id) REFERENCES tourists (id) ON DELETE CASCADE
            );
        """)

        # 5. Trips
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tourist_id INTEGER NOT NULL,
                destination TEXT NOT NULL,
                budget_limit REAL DEFAULT 0.0,
                status TEXT DEFAULT 'PLANNED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tourist_id) REFERENCES tourists (id) ON DELETE CASCADE
            );
        """)

        # 6. Trip Itineraries & Recommendations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS itineraries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL,
                day_number INTEGER,
                place_name TEXT NOT NULL,
                description TEXT,
                latitude REAL,
                longitude REAL,
                is_visited INTEGER DEFAULT 0,
                FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
            );
        """)

        # 5. Authorities
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS authorities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                badge_number TEXT UNIQUE NOT NULL,
                role TEXT DEFAULT 'Responder',
                assigned_zone TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Indices for high-frequency queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tourists_did ON tourists (digital_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_risk ON incidents (risk_level);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_location_tourist ON location_logs (tourist_id);")
