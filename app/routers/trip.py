from fastapi import APIRouter
from pydantic import BaseModel
import random

router = APIRouter(prefix="/trip", tags=["Trip"])

class TripRequest(BaseModel):
    destination: str

class TripResponse(BaseModel):
    destination: str
    packing_guide: list
    route_and_cost: str
    real_time_incidents: list
    famous_places: list
    itinerary: list

@router.post("/plan", response_model=TripResponse)
def plan_trip(request: TripRequest):
    # Mocking AI response for the trip destination
    dest = request.destination
    return TripResponse(
        destination=dest,
        packing_guide=[
            "First Aid Kit", "Power Bank", "Water Bottle", 
            "Weather-appropriate clothing", "Emergency cash"
        ],
        route_and_cost=f"Optimal Route to {dest} via Highway 4. Estimated cost: $150.",
        real_time_incidents=[
            {"type": "Traffic", "details": "Minor congestion on Main Route"},
            {"type": "Weather", "details": "Clear skies expected"}
        ],
        famous_places=[
            f"{dest} Central Plaza",
            f"Historic Museum of {dest}",
            f"{dest} Nature Reserve"
        ],
        itinerary=[
            "Day 1: Arrival and check-in, visit Central Plaza.",
            "Day 2: Guided tour of Historic Museum.",
            "Day 3: Nature walk and departure."
        ]
    )
