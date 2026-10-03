from pathlib import Path
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.config import settings
from app.services.websocket_manager import ws_manager

templates = Jinja2Templates(directory=str(settings.BASE_DIR / "app" / "templates"))

router = APIRouter(tags=["Views & WebSockets"])

@router.get("/", response_class=HTMLResponse)
def landing_hub(request: Request):
    """Mission Control and Unified Gateway."""
    return templates.TemplateResponse(request=request, name="landing.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/tourist", response_class=HTMLResponse)
def tourist_portal(request: Request):
    """Tourist Mobile Portal interface."""
    return templates.TemplateResponse(request=request, name="tourist.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    """Login and Registration page."""
    return templates.TemplateResponse(request=request, name="login.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/dashboard", response_class=HTMLResponse)
def home_dashboard(request: Request):
    """Home Dashboard for SafeTrip AI."""
    return templates.TemplateResponse(request=request, name="dashboard.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/planning", response_class=HTMLResponse)
def planning_dashboard(request: Request):
    """Trip planning and live GPS tracking dashboard."""
    return templates.TemplateResponse(request=request, name="planning.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/authority", response_class=HTMLResponse)
def authority_dashboard(request: Request):
    """Tactical Command Center Dashboard for responders."""
    return templates.TemplateResponse(request=request, name="authority.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/admin", response_class=HTMLResponse)
def admin_geofence_studio(request: Request):
    """Admin Geo-Fence Studio interface for configuring security perimeters."""
    return templates.TemplateResponse(request=request, name="admin.html", context={"project_name": settings.PROJECT_NAME})

@router.get("/verify", response_class=HTMLResponse)
@router.get("/verify/{digital_id}", response_class=HTMLResponse)
def verify_identity_page(request: Request, digital_id: str = None):
    """Public Blockchain Digital Pass verification portal."""
    return templates.TemplateResponse(request=request, name="verify.html", context={
        "project_name": settings.PROJECT_NAME,
        "prefill_id": digital_id
    })

# ----------------- WebSockets -----------------

@router.websocket("/ws/authority")
async def websocket_authority_endpoint(websocket: WebSocket):
    """Real-time tactical command stream."""
    await ws_manager.connect_authority(websocket)
    try:
        while True:
            # Keep connection alive; can accept client-side heartbeats or pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_authority(websocket)
    except Exception:
        ws_manager.disconnect_authority(websocket)

@router.websocket("/ws/tourist/{tourist_id}")
async def websocket_tourist_endpoint(websocket: WebSocket, tourist_id: int):
    """Real-time personal safety stream for tourist device."""
    await ws_manager.connect_tourist(tourist_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_tourist(tourist_id, websocket)
    except Exception:
        ws_manager.disconnect_tourist(tourist_id, websocket)
