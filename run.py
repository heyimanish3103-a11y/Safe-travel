import sys
import uvicorn

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print("=" * 65)
    print("Smart Tourist Safety Monitoring & Incident Response System")
    print("Mission Control Gateway:  http://localhost:8080/")
    print("Home Dashboard (New):     http://localhost:8080/dashboard")
    print("Tourist Portal:           http://localhost:8080/tourist")
    print("Authority Dashboard:      http://localhost:8080/authority")
    print("Admin Geo-Fence Studio:   http://localhost:8080/admin")
    print("Digital ID Verifier:      http://localhost:8080/verify")
    print("API Documentation:        http://localhost:8080/docs")
    print("=" * 65)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
