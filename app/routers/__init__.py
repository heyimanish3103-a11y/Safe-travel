from app.routers.tourists import router as tourists_router
from app.routers.incidents import router as incidents_router
from app.routers.zones import router as zones_router
from app.routers.views import router as views_router
from app.routers.trip import router as trip_router

__all__ = ["tourists_router", "incidents_router", "zones_router", "views_router", "trip_router"]
