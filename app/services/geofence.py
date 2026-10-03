import json
from typing import List, Tuple, Optional
from app.models.zone import Zone

class GeoFenceService:
    @staticmethod
    def is_point_in_polygon(lat: float, lon: float, polygon: List[List[float]]) -> bool:
        """
        Ray-casting algorithm to determine if a point (lat, lon) is inside a polygon.
        Polygon is a list of [lat, lon] coordinates.
        """
        if not polygon or len(polygon) < 3:
            return False

        n = len(polygon)
        inside = False

        p1_lat, p1_lon = polygon[0]
        for i in range(1, n + 1):
            p2_lat, p2_lon = polygon[i % n]
            
            # Check if point is between the y-bounds (latitudes) of the edge
            if min(p1_lat, p2_lat) < lat <= max(p1_lat, p2_lat):
                # Calculate x-intersection of the line with the horizontal ray
                if lon <= max(p1_lon, p2_lon):
                    if p1_lat != p2_lat:
                        x_inters = (lat - p1_lat) * (p2_lon - p1_lon) / (p2_lat - p1_lat) + p1_lon
                        if p1_lon == p2_lon or lon <= x_inters:
                            inside = not inside
            p1_lat, p1_lon = p2_lat, p2_lon

        return inside

    @classmethod
    def evaluate_location(cls, lat: float, lon: float, zones: List[Zone]) -> Tuple[Optional[Zone], str]:
        """
        Evaluate tourist location against all active zones.
        Returns the highest-priority zone matched and status:
        Prioritizes HIGH_RISK > RESTRICTED > SAFE.
        """
        matched_high_risk = None
        matched_restricted = None
        matched_safe = None

        for zone in zones:
            try:
                coords = json.loads(zone.coordinates_json)
                if cls.is_point_in_polygon(lat, lon, coords):
                    if zone.type.upper() == "HIGH_RISK":
                        matched_high_risk = zone
                    elif zone.type.upper() == "RESTRICTED":
                        matched_restricted = zone
                    elif zone.type.upper() == "SAFE":
                        matched_safe = zone
            except Exception:
                continue

        if matched_high_risk:
            return matched_high_risk, "HIGH_RISK_BREACH"
        if matched_restricted:
            return matched_restricted, "RESTRICTED_BREACH"
        if matched_safe:
            return matched_safe, "SAFE_ZONE"

        return None, "UNCLASSIFIED_AREA"
