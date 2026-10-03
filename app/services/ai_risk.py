from datetime import datetime
from typing import Tuple, List, Optional
from app.models.zone import Zone

class AIRiskClassifier:
    """
    Multi-Factor Heuristic & Algorithmic Risk Classification Engine.
    Evaluates incidents across spatial, temporal, behavioral, and telemetry matrices.
    """

    @classmethod
    def classify_incident(
        cls,
        incident_type: str,
        zone: Optional[Zone] = None,
        recent_incident_count: int = 0,
        incident_time: Optional[datetime] = None
    ) -> Tuple[str, int, str]:
        """
        Calculates risk score (0-100), risk level (LOW/MEDIUM/HIGH), and detailed factor summary.
        """
        if incident_time is None:
            incident_time = datetime.utcnow()

        score = 0
        factors: List[str] = []

        # 1. Base Score by Trigger Type
        if incident_type.upper() == "SOS":
            score += 70
            factors.append("One-Touch Distress SOS Initiated (+70)")
        elif incident_type.upper() == "GEOFENCE_BREACH":
            if zone and zone.type.upper() == "HIGH_RISK":
                score += 60
                factors.append("High-Risk Security Perimeter Breach (+60)")
            elif zone and zone.type.upper() == "RESTRICTED":
                score += 40
                factors.append("Restricted/Controlled Zone Intrusion (+40)")
            else:
                score += 30
                factors.append("Unidentified Perimeter Anomaly (+30)")
        else:
            score += 25
            factors.append("General Safety Event (+25)")

        # 2. Temporal Factor (Time-of-day risk)
        hour = incident_time.hour
        if 21 <= hour or hour < 5:
            score += 20
            factors.append("High-Risk Nocturnal Time Window (21:00 - 05:00 UTC) (+20)")
        elif 18 <= hour < 21:
            score += 10
            factors.append("Low-Light Twilight Window (18:00 - 21:00 UTC) (+10)")
        else:
            factors.append("Standard Daylight Operating Hours (+0)")

        # 3. Behavioral / Recurrence Factor
        if recent_incident_count > 0:
            boost = min(recent_incident_count * 10, 20)
            score += boost
            factors.append(f"Multiple Recent Alarms Detected ({recent_incident_count} prior events) (+{boost})")

        # Clamp score between 0 and 100
        final_score = min(max(score, 0), 100)

        # 4. Classification Tiers
        if final_score >= 70:
            level = "HIGH"
        elif final_score >= 40:
            level = "MEDIUM"
        else:
            level = "LOW"

        factor_summary = " | ".join(factors)
        return level, final_score, factor_summary
