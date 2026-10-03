# 🛡️ Smart Tourist Safety Monitoring and Incident Response System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![Python](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A web-based portal engineered to safeguard tourists in unfamiliar and remote destinations through **real-time GPS telemetry, intelligent geo-fencing, AI-driven risk classification, blockchain-anchored digital identity, and one-touch SOS emergency dispatch**.

---

## 🌟 Key Features

### 1. 🪪 Blockchain-Backed Digital Tourist ID
* **Tamper-Proof Verification:** Every tourist receives a cryptographically generated Digital ID with SHA-256 block ledger hashing (Polygon testnet / cryptographic ledger).
* **QR Code Generation:** Seamless verification for local authorities and checkpoints via scanning.
* **Privacy-First:** Responders only view authorized verification data without exposing sensitive personal documents.

### 2. 📍 Real-Time GPS Tracking & Privacy Control
* **Opt-In Telemetry:** Tourists have complete granular control to start, pause, or terminate live location sharing at any time.
* **Live Beacon:** Transmits latitude, longitude, heading, and accuracy to the backend with sub-second responsiveness.

### 3. 🚧 Dynamic Geo-Fencing Engine
* **Zone Classification:** Safe Zones (Green), Caution/Restricted Zones (Yellow/Orange), and High-Risk Danger Zones (Red).
* **Automated Breach Detection:** Real-time point-in-polygon ray-casting algorithm detects unauthorized boundary entry and immediately dispatches alerts to both the tourist and the police dashboard.

### 4. 🧠 AI-Powered Risk Classification
* Evaluates incoming incidents (Geo-fence breaches, SOS alarms, sudden route deviations) using a multi-factor risk scoring engine.
* Calculates risk scores based on:
  - **Zone Hazard Level** (Safe, Caution, Danger)
  - **Temporal Risk Factor** (Late night vs. daylight hours)
  - **Incident Type** (Manual SOS trigger vs. perimeter violation)
  - **Proximity to nearest emergency response units**
* Categorizes alerts into **LOW**, **MEDIUM**, and **HIGH** priority queues for rapid triage.

### 5. 🚨 One-Touch SOS Emergency Reporting
* Prominent, one-tap emergency panic button accessible from every tourist screen.
* Dispatches instant emergency telemetry packets (Tourist ID, exact coordinates, altitude/accuracy, timestamp) directly to active responders over WebSockets.

### 6. 🛰️ Authority Command Center Dashboard
* **Unified Tactical Map:** Real-time visualization of all active tourists, designated security perimeters, and active incidents.
* **Triage Feed:** Filter incidents by risk level, status (Open, In Progress, Resolved), and zone.
* **Identity Verification Portal:** Built-in QR scanner and ID lookup tool for field officers.
* **Incident Dispatch Workflow:** Acknowledge incidents, assign responders, and mark incidents as resolved with audit logs.

---

## 🏗️ Architecture & Technology Stack

```mermaid
graph TD
    subgraph Client Layer
        T[Tourist Web Portal<br/>Mobile-First UI]
        A[Authority Command Center<br/>Tactical Dashboard]
        AD[Admin Geo-Fence Editor]
    end

    subgraph API & Realtime Layer
        API[FastAPI Application Server]
        WS[WebSocket Manager<br/>Live Telemetry & Alerts]
    end

    subgraph Core Engines
        GEO[Geo-Fencing Engine<br/>Ray-Casting Boundary Detection]
        AI[AI Risk Classifier<br/>Multi-Factor Scoring Matrix]
        BC[Blockchain Ledger & QR Engine<br/>Cryptographic Identity]
    end

    subgraph Data Layer
        DB[(Database<br/>MySQL 8.0 / SQLite)]
    end

    T <-->|Live Location & SOS| WS
    A <-->|Live Incident Stream| WS
    T -->|REST API| API
    A -->|REST API| API
    AD -->|Zone Management| API

    API --> GEO
    API --> AI
    API --> BC

    GEO --> DB
    AI --> DB
    BC --> DB
    API --> DB
```

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python 3.14 / FastAPI | High-throughput asynchronous REST API & WebSockets |
| **Realtime Engine** | WebSockets (`websockets`) | Low-latency bi-directional location streaming & instant SOS broadcasts |
| **Database** | MySQL 8.0 (with SQLite fallback) | Relational storage for tourists, zones, coordinates, and incident logs |
| **ORM** | SQLAlchemy 2.0 | Type-safe database modeling & schema migrations |
| **Frontend** | Vanilla HTML5, Modern CSS, ES6+ JS | Lightweight, high-performance, dark command-center aesthetic |
| **Mapping Engine** | Leaflet.js & OpenStreetMap (Google Maps API ready) | Interactive vector map visualization with zero mandatory billing hurdles |
| **Identity & Blockchain** | Cryptographic Ledger (SHA-256) + `qrcode` | Tamper-evident Digital ID cards with verifiable hashes |
| **AI / Risk Engine** | Heuristic Multi-Factor Classifier (Scikit-Learn / TF ready) | Real-time threat classification & prioritization |

---

## 🗄️ Data Model Overview

* **`Tourist`**: `id`, `name`, `email`, `phone`, `digital_id`, `blockchain_hash`, `qr_code_url`, `is_active`, `created_at`
* **`LocationLog`**: `id`, `tourist_id`, `latitude`, `longitude`, `speed`, `accuracy`, `timestamp`
* **`Zone`**: `id`, `name`, `type` (`SAFE`, `RESTRICTED`, `HIGH_RISK`), `boundary_geojson`, `color_code`, `created_at`
* **`Incident`**: `id`, `tourist_id`, `type` (`SOS`, `GEOFENCE_BREACH`), `latitude`, `longitude`, `risk_level` (`LOW`, `MEDIUM`, `HIGH`), `risk_score`, `status` (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), `details`, `timestamp`
* **`Authority`**: `id`, `name`, `badge_number`, `role`, `assigned_zone`

---

## 🚀 Quickstart Guide

### 1. Prerequisites
* Python 3.10 or higher (Python 3.14 tested)
* MySQL 8.0 (Optional; SQLite is supported by default for rapid setup)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd Project

# Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=8000
HOST=0.0.0.0
DATABASE_URL=sqlite:///./tourist_safety.db
# Or for MySQL:
# DATABASE_URL=mysql+pymysql://root:password@localhost:3306/tourist_safety_db
SECRET_KEY=super_secret_tourist_safety_key
ENVIRONMENT=development
```

### 4. Running the Application
```bash
# Run using Python directly
python run.py
```
Access the application:
* 🌐 **Tourist Mobile Portal:** `http://localhost:8000/`
* 🛡️ **Authority Command Center:** `http://localhost:8000/authority`
* 📐 **Admin Geo-Fence Manager:** `http://localhost:8000/admin`
* 📚 **Interactive Swagger API Docs:** `http://localhost:8000/docs`

---

## 🧪 Testing & Demo Simulation
The system comes with a built-in **Simulation Engine** that allows you to:
1. Simulate tourists walking across Safe and Restricted zones.
2. Trigger simulated SOS alarms from remote locations.
3. Verify Digital Tourist IDs in the Authority view using sample QR codes.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
