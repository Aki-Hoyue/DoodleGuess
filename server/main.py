from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .api import game, image
from .websocket import manager, event_handlers, handle_disconnect, rooms
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.3.22:3000", "http://192.168.3.22:8000", "http://192.168.3.101:3000", "http://192.168.3.101:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file directory
ROOT_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT_DIR / "public" / "images"
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Include routes
app.include_router(game.router)
app.include_router(image.router)

# Error handling
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTP error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"General error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"}
    )

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"Received message from client {client_id}: {data}")
            event = data.get("event")
            if event in event_handlers:
                await event_handlers[event](websocket, client_id, data)
            else:
                logger.warning(f"Unknown event type received: {event}")
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
        await handle_disconnect(client_id)
    except Exception as e:
        logger.error(f"Error processing message from client {client_id}: {str(e)}")
        await handle_disconnect(client_id)

@app.get("/")
async def root():
    return {"status": "ok", "message": "DoodleGuess API is running"}

# Debugging route
@app.get("/debug/rooms")
async def get_rooms():
    """
    Get all room information (for debugging purposes)
    """
    return {
        "rooms": {
            room_id: {
                "players": room["players"],
                "status": room["status"],
                "currentRound": room["currentRound"],
                "totalRounds": room["totalRounds"]
            }
            for room_id, room in rooms.items()
        }
    }
