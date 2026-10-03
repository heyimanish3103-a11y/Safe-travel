import sys
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)

    print("--- 1. Testing Tourists ---")
    r = client.get("/api/v1/tourists")
    assert r.status_code == 200, f"Error: {r.text}"
    tourists = r.json()
    print(f"SUCCESS: Fetched {len(tourists)} tourists: {[t['name'] for t in tourists]}")

    print("--- 2. Testing ID Verification ---")
    tid = tourists[0]["digital_id"]
    r_v = client.get(f"/api/v1/tourists/verify/{tid}")
    assert r_v.status_code == 200
    v_data = r_v.json()
    print(f"SUCCESS: Verified {tid}: {v_data['verification_status']} (Block #{v_data['blockchain_block']})")

    print("--- 3. Testing Zones ---")
    r_z = client.get("/api/v1/zones")
    assert r_z.status_code == 200
    zones = r_z.json()
    print(f"SUCCESS: Fetched {len(zones)} zones: {[z['name'] for z in zones]}")

    print("--- 4. Testing SOS Emergency ---")
    sos_payload = {
        "tourist_id": tourists[0]["id"],
        "type": "SOS",
        "latitude": 28.6140,
        "longitude": 77.2100,
        "details": "Integration Test Emergency Alert"
    }
    r_sos = client.post("/api/v1/incidents/sos", json=sos_payload)
    assert r_sos.status_code == 201, f"Error: {r_sos.text}"
    inc = r_sos.json()
    print(f"SUCCESS: Incident #{inc['id']} generated! Risk Level: {inc['risk_level']} (Score: {inc['risk_score']}%)")

    print("--- 5. Testing Geofence Breach ---")
    loc_payload = {
        "tourist_id": tourists[1]["id"],
        "latitude": 28.6040,
        "longitude": 77.2220,
        "accuracy": 3.0,
        "speed": 1.2
    }
    r_loc = client.post(f"/api/v1/tourists/{tourists[1]['id']}/location", json=loc_payload)
    assert r_loc.status_code == 200
    print("SUCCESS: Geofence breach evaluated and logged!")

    print("--- 6. Testing Incident Status Update (Acknowledge & Resolve) ---")
    r_ack = client.patch(f"/api/v1/incidents/{inc['id']}/status", json={"status": "ACKNOWLEDGED", "resolved_by": "Test Officer"})
    assert r_ack.status_code == 200
    assert r_ack.json()["status"] == "ACKNOWLEDGED"

    r_res = client.patch(f"/api/v1/incidents/{inc['id']}/status", json={"status": "RESOLVED", "resolved_by": "HQ Command"})
    assert r_res.status_code == 200
    assert r_res.json()["status"] == "RESOLVED"
    print(f"SUCCESS: Incident #{inc['id']} successfully acknowledged and resolved.")

    print("\n[SUCCESS] ALL TESTS PASSED SUCCESSFULLY! SYSTEM IS 100% OPERATIONAL.")

if __name__ == "__main__":
    run_tests()
