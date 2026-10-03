import json
from app.core.database import get_db, init_db
from app.services.blockchain import BlockchainIdentityService

def seed_initial_demo_data():
    """Seed sample zones, tourists, and location logs if database is empty."""
    init_db()

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if zones exist
        cursor.execute("SELECT COUNT(*) FROM zones")
        if cursor.fetchone()[0] == 0:
            print("[Seeder] Creating initial Geo-Fence Zones...")

            # Zone 1: Safe Zone (Green) - Heritage Plaza & Promenade
            safe_coords = [
                [28.6180, 77.2050],
                [28.6180, 77.2150],
                [28.6100, 77.2150],
                [28.6100, 77.2050]
            ]
            cursor.execute("""
                INSERT INTO zones (name, type, coordinates_json, color, description)
                VALUES (?, ?, ?, ?, ?)
            """, (
                "Heritage Plaza & Promenade",
                "SAFE",
                json.dumps(safe_coords),
                "#10b981",
                "Monitored tourist walkway with CCTV coverage and 24/7 security kiosks."
            ))

            # Zone 2: Restricted Zone (Amber) - Ecological Buffer Area
            restricted_coords = [
                [28.6180, 77.2160],
                [28.6180, 77.2250],
                [28.6120, 77.2250],
                [28.6120, 77.2160]
            ]
            cursor.execute("""
                INSERT INTO zones (name, type, coordinates_json, color, description)
                VALUES (?, ?, ?, ?, ?)
            """, (
                "Restricted Ecological Buffer Area",
                "RESTRICTED",
                json.dumps(restricted_coords),
                "#f59e0b",
                "Protected wilderness buffer. Guided permits required after 18:00."
            ))

            # Zone 3: High Risk Zone (Red) - Steep Ravine & Low-Visibility Terrain
            high_risk_coords = [
                [28.6080, 77.2160],
                [28.6080, 77.2280],
                [28.6000, 77.2280],
                [28.6000, 77.2160]
            ]
            cursor.execute("""
                INSERT INTO zones (name, type, coordinates_json, color, description)
                VALUES (?, ?, ?, ?, ?)
            """, (
                "Steep Ravine & Low-Visibility Terrain",
                "HIGH_RISK",
                json.dumps(high_risk_coords),
                "#ef4444",
                "Unlit steep gradient with sudden drop-offs and poor mobile reception."
            ))

            print("[Seeder] 3 Zones seeded successfully.")

        # Check if tourists exist
        cursor.execute("SELECT COUNT(*) FROM tourists")
        if cursor.fetchone()[0] == 0:
            print("[Seeder] Creating sample tourists with Blockchain IDs...")
            tourists_data = [
                {"name": "Priya Sharma", "contact": "+91 98765 43210", "email": "priya.sharma@example.com", "id_proof": "IND-PASS-789012"},
                {"name": "Alex Johnson", "contact": "+1 415 555 0199", "email": "alex.j@example.com", "id_proof": "US-PASS-334211"},
                {"name": "Carlos Gomez", "contact": "+34 612 345 678", "email": "carlos.g@example.com", "id_proof": "ES-PASS-990182"}
            ]

            initial_coords = [
                (28.6140, 77.2100),
                (28.6160, 77.2180),
                (28.6050, 77.2200)
            ]

            for i, t_info in enumerate(tourists_data):
                d_id = f"TID-2026-00{i+1}-{t_info['name'].split()[0].upper()}"
                b_hash = BlockchainIdentityService.generate_blockchain_hash(t_info["name"], t_info["contact"], d_id)
                qr_file = BlockchainIdentityService.generate_qr_code(d_id, t_info["name"], b_hash)
                block_num = 1049281 + i

                cursor.execute("""
                    INSERT INTO tourists (name, contact, email, id_proof_number, digital_id, blockchain_hash, blockchain_block, qr_code_path, is_active, is_tracking_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
                """, (t_info["name"], t_info["contact"], t_info["email"], t_info["id_proof"], d_id, b_hash, block_num, qr_file))
                t_id = cursor.lastrowid

                # Add initial location
                cursor.execute("""
                    INSERT INTO location_logs (tourist_id, latitude, longitude, accuracy, speed)
                    VALUES (?, ?, ?, 4.5, 1.2)
                """, (t_id, initial_coords[i][0], initial_coords[i][1]))

            print("[Seeder] 3 Tourists seeded with Digital IDs & QR Codes.")
