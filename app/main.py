from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.routers import tourists_router, incidents_router, zones_router, views_router, trip_router
from seed_data import seed_initial_demo_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and seed initial demo zones/tourists
    init_db()
    seed_initial_demo_data()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Smart Tourist Safety Monitoring and Incident Response System with Real-Time GPS Telemetry, Geo-fencing, AI Risk Scoring, and Blockchain Identity.",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files mount
static_dir = settings.BASE_DIR / "app" / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Routers
app.include_router(views_router)
app.include_router(tourists_router, prefix=settings.API_V1_STR)
app.include_router(incidents_router, prefix=settings.API_V1_STR)
app.include_router(zones_router, prefix=settings.API_V1_STR)
app.include_router(trip_router, prefix=settings.API_V1_STR)
