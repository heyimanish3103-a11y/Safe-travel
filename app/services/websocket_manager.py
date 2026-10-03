import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger("websocket_manager")

class ConnectionManager:
    def __init__(self):
        # Active connections for tactical responders
        self.authority_connections: Set[WebSocket] = set()
        # Active connections for individual tourists: tourist_id -> Set[WebSocket]
        self.tourist_connections: Dict[int, Set[WebSocket]] = {}

    async def connect_authority(self, websocket: WebSocket):
        await websocket.accept()
        self.authority_connections.add(websocket)
        logger.info(f"Authority connected. Total authorities: {len(self.authority_connections)}")

    def disconnect_authority(self, websocket: WebSocket):
        self.authority_connections.discard(websocket)
        logger.info(f"Authority disconnected. Total authorities: {len(self.authority_connections)}")

    async def connect_tourist(self, tourist_id: int, websocket: WebSocket):
        await websocket.accept()
        if tourist_id not in self.tourist_connections:
            self.tourist_connections[tourist_id] = set()
        self.tourist_connections[tourist_id].add(websocket)
        logger.info(f"Tourist {tourist_id} connected. Active devices: {len(self.tourist_connections[tourist_id])}")

    def disconnect_tourist(self, tourist_id: int, websocket: WebSocket):
        if tourist_id in self.tourist_connections:
            self.tourist_connections[tourist_id].discard(websocket)
            if not self.tourist_connections[tourist_id]:
                del self.tourist_connections[tourist_id]
        logger.info(f"Tourist {tourist_id} disconnected.")

    async def broadcast_to_authorities(self, message: dict):
        """Broadcast live telemetry or incident payload to all connected command center screens."""
        payload = json.dumps(message, default=str)
        dead_sockets = []
        for connection in list(self.authority_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Error sending to authority websocket: {e}")
                dead_sockets.append(connection)
        for dead in dead_sockets:
            self.authority_connections.discard(dead)

    async def send_to_tourist(self, tourist_id: int, message: dict):
        """Send direct safety warning or status alert to a specific tourist's portal."""
        if tourist_id in self.tourist_connections:
            payload = json.dumps(message, default=str)
            dead_sockets = []
            for connection in list(self.tourist_connections[tourist_id]):
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.warning(f"Error sending to tourist {tourist_id} websocket: {e}")
                    dead_sockets.append(connection)
            for dead in dead_sockets:
                self.tourist_connections[tourist_id].discard(dead)

ws_manager = ConnectionManager()
