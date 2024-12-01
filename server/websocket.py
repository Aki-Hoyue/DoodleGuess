import os
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import random
import logging
from pathlib import Path
from server.ai import judge_guesses

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store room and connection information
rooms: Dict[str, dict] = {}
socket_to_room: Dict[str, str] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in rooms:
            for player in rooms[room_id]["players"]:
                if player["client_id"] in self.active_connections:
                    await self.active_connections[player["client_id"]].send_json(message)
            logger.info(f"Broadcast message to room {room_id}: {message}")

manager = ConnectionManager()

async def handle_create_room(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle creating a room
    """
    # Generate a unique room ID
    while True:
        room_id = str(random.randint(1000, 9999))
        if room_id not in rooms:
            break

    # Create the room and set the creator as the drawer
    rooms[room_id] = {
        "players": [{
            "nickname": data["creatorNickname"],
            "client_id": client_id,
            "score": 0,
            "isDrawing": True,  # The creator is the drawer by default
            "ready": True,  # The creator is ready by default
            "correct_guesses": 0,
            "drawings_guessed_correctly": 0  # Add new field
        }],
        "password": data["password"],
        "maxPlayers": data["maxPlayers"],
        "totalRounds": data["rounds"],
        "currentRound": 1,  # Initial round is 1
        "status": "waiting",
        "guesses": {},
        "currentDrawing": None,
        "currentKeyword": None
    }
    socket_to_room[client_id] = room_id
    logger.info(f"Room {room_id} created by client {client_id}")
    await websocket.send_json({
        "event": "room_created",
        "roomId": room_id
    })

async def handle_join_room(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle joining a room
    """
    room_id = data["roomId"]
    if room_id not in rooms:
        await websocket.send_json({"event": "error", "message": "Room not found"})
        logger.warning(f"Attempt to join non-existent room {room_id}")
        return

    room = rooms[room_id]
    
    # Check password
    if room["password"] != data.get("password"):
        await websocket.send_json({"event": "error", "message": "Incorrect password"})
        logger.warning(f"Incorrect password attempt for room {room_id}")
        return

    # Check if the room is full
    if len(room["players"]) >= room["maxPlayers"]:
        await websocket.send_json({"event": "error", "message": "Room is full"})
        logger.warning(f"Attempt to join full room {room_id}")
        return

    # Check if the nickname is already taken
    if any(p["nickname"] == data["nickname"] for p in room["players"]):
        await websocket.send_json({"event": "error", "message": "Nickname already taken"})
        logger.warning(f"Duplicate nickname attempt in room {room_id}")
        return
    room["players"].append({
        "nickname": data["nickname"],
        "client_id": client_id,
        "score": 0,
        "isDrawing": False,
        "ready": False,
        "correct_guesses": 0,
        "drawings_guessed_correctly": 0  # Add new field
    })
    socket_to_room[client_id] = room_id
    
    # Broadcast update
    await manager.broadcast_to_room(room_id, {
        "event": "player_joined",
        "players": room["players"]
    })
    logger.info(f"Player {data['nickname']} joined room {room_id}")

async def handle_submit_drawing(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle submitting a drawing
    """
    room_id = data["roomId"]
    if room_id not in rooms:
        logger.warning(f"Submit drawing for non-existent room {room_id}")
        return

    room = rooms[room_id]
    # Extract filename from the full URL
    filename = Path(data["drawingUrl"]).name
    room["currentDrawing"] = filename
    room["currentKeyword"] = data["keyword"]
    
    # Broadcast the new drawing to other players, using the correct URL
    await manager.broadcast_to_room(room_id, {
        "event": "new_drawing",
        "drawingUrl": f"/images/{filename}"
    })
    logger.info(f"New drawing submitted in room {room_id}")

async def handle_request_ai_judgment(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle AI judgment request
    """
    room_id = data["roomId"]
    if room_id not in rooms:
        logger.warning(f"AI judgment request for non-existent room {room_id}")
        return

    room = rooms[room_id]
    keyword = data["keyword"]
    guesses = data["guesses"]

    # Prepare input for AI judgment
    guess_list = []
    for player_id, guess in guesses.items():
        if player_id != client_id:  # Exclude the drawer's guess
            guess_list.append(guess)
    logger.info(f"AI judgment request for room {room_id}: {guess_list}")

    # Call AI judgment
    try:
        judgments = await judge_guesses(keyword, guess_list)
        logger.info(f"AI judgments for room {room_id}: {judgments}")

        # Prepare judgment data for the frontend
        judgment_data = []
        judgment_index = 0
        for player_id, guess in guesses.items():
            if player_id != client_id:  # Exclude the drawer
                judgment = judgments[judgment_index]
                player = next((p for p in room["players"] if p["client_id"] == player_id), None)
                if player:
                    judgment_data.append({
                        "player_id": player_id,
                        "nickname": player["nickname"],
                        "guess": guess,
                        "is_correct": judgment["is_correct"],
                        "reason": judgment["reason"]
                    })
                judgment_index += 1

        # Send AI judgment results to the frontend for confirmation
        await manager.broadcast_to_room(room_id, {
            "event": "ai_judgments",
            "judgments": judgment_data,
            "keyword": keyword
        })

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error in AI judgment: {error_message}")
        
        # Broadcast AI judgment failure message, switch to manual judgment mode
        await manager.broadcast_to_room(room_id, {
            "event": "ai_judgment_failed",
            "error": error_message,
            "guesses": [
                {
                    "player_id": player_id,
                    "guess": guess,
                    "nickname": next((p["nickname"] for p in room["players"] if p["client_id"] == player_id), None)
                }
                for player_id, guess in guesses.items()
                if player_id != client_id
            ]
        })

async def handle_submit_judgments(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle submitted judgments (either from AI or manual)
    """
    room_id = data["roomId"]
    if room_id not in rooms:
        logger.warning(f"Submit judgments for non-existent room {room_id}")
        return

    room = rooms[room_id]
    judgments = data["judgments"]
    logger.info(f"Final judgments submitted for room {room_id}: {judgments}")

    # Find the current drawer
    current_drawer = next((p for p in room["players"] if p["isDrawing"]), None)

    # Count correct guesses
    correct_guesses_count = sum(1 for j in judgments if j["is_correct"])

    # If there are correct guesses:
    # 1. Increase the drawer's drawings_guessed_correctly count
    # 2. Increase the drawer's score (1 point for each correct guess)
    if current_drawer and correct_guesses_count > 0:
        current_drawer["drawings_guessed_correctly"] = current_drawer.get("drawings_guessed_correctly", 0) + 1
        current_drawer["score"] = current_drawer.get("score", 0) + correct_guesses_count
        logger.info(f"Drawer {current_drawer['nickname']} earned {correct_guesses_count} points for {correct_guesses_count} correct guesses")

    # Update guessers' scores
    for judgment in judgments:
        player_id = judgment["player_id"]
        is_correct = judgment["is_correct"]
        player = next((p for p in room["players"] if p["client_id"] == player_id), None)
        if player and is_correct:
            player["score"] = player.get("score", 0) + 1
            player["correct_guesses"] = player.get("correct_guesses", 0) + 1

    # Update room status
    room["status"] = "round_end"
    room["judgments_submitted"] = True
    
    # Reset all players' ready status
    for player in room["players"]:
        player["ready"] = False

    # Select the next drawer
    current_drawer_index = next((i for i, p in enumerate(room["players"]) if p["isDrawing"]), 0)
    room["players"][current_drawer_index]["isDrawing"] = False
    next_drawer_index = (current_drawer_index + 1) % len(room["players"])
    room["players"][next_drawer_index]["isDrawing"] = True

    # Check if it's the last round
    if room["currentRound"] >= room["totalRounds"]:
        # Game over
        room["status"] = "game_over"
        await manager.broadcast_to_room(room_id, {
            "event": "game_over",
            "players": room["players"],
            "final_scores": [
                {
                    "nickname": player["nickname"],
                    "score": player.get("score", 0),
                    "correct_guesses": player.get("correct_guesses", 0),
                    "drawings_guessed_correctly": player.get("drawings_guessed_correctly", 0)
                }
                for player in room["players"]
            ],
            "judgments": [
                {
                    "player_id": judgment["player_id"],
                    "guess": room["guesses"].get(judgment["player_id"], ""),
                    "is_correct": judgment["is_correct"]
                }
                for judgment in judgments
            ],
            "keyword": room["currentKeyword"]
        })
        logger.info(f"Game over in room {room_id}")
    else:
        # Broadcast round end and final results
        await manager.broadcast_to_room(room_id, {
            "event": "round_end",
            "judgments": [
                {
                    "player_id": judgment["player_id"],
                    "guess": room["guesses"].get(judgment["player_id"], ""),
                    "is_correct": judgment["is_correct"]
                }
                for judgment in judgments
            ],
            "players": room["players"],
            "keyword": room["currentKeyword"],
            "current_round": room["currentRound"],
            "total_rounds": room["totalRounds"]
        })
        logger.info(f"Round {room['currentRound']} ended in room {room_id}")

async def handle_player_ready(websocket: WebSocket, client_id: str, data: dict):
    """
    Handle player ready status
    """
    room_id = data["roomId"]
    if room_id not in rooms:
        return
    
    room = rooms[room_id]
    player = next((p for p in room["players"] if p["client_id"] == client_id), None)
    if player:
        player["ready"] = True
        
        # Broadcast player ready status update
        room["status"] = "round_start"
        await manager.broadcast_to_room(room_id, {
            "event": "round_start",
            "players": room["players"]
        })
        
        # Check if the current player is ready
        if player["ready"]:
            # Update round number
            room["currentRound"] += 1
            room["guesses"] = {}
            room["currentDrawing"] = None
            room["currentKeyword"] = None
            
            # Clean up drawing-related states
            try:
                # Get the current room's image file path
                ROOT_DIR = Path(__file__).resolve().parent.parent
                IMAGES_DIR = ROOT_DIR / "public" / "images"
                for file in IMAGES_DIR.glob(f"{room_id}_*"):
                    try:
                        os.remove(file)
                        logger.info(f"Removed drawing file: {file}")
                    except Exception as e:
                        logger.error(f"Error removing file {file}: {e}")
            except Exception as e:
                logger.error(f"Error cleaning up drawings: {e}")

            logger.info(f"Starting round {room['currentRound']} in room {room_id}")
            # Broadcast new round start
            await manager.broadcast_to_room(room_id, {
                "event": "round_start",
                "currentRound": room["currentRound"],
                "totalRounds": room["totalRounds"],
                "players": room["players"]
            })
            
async def handle_disconnect(client_id: str):
    """
    Handle player disconnection
    """
    manager.disconnect(client_id)
    if client_id in socket_to_room:
        room_id = socket_to_room[client_id]
        if room_id in rooms:
            # Remove player from the room
            was_drawing = False
            for player in rooms[room_id]["players"]:
                if player["client_id"] == client_id:
                    was_drawing = player["isDrawing"]
                    break
            
            rooms[room_id]["players"] = [
                p for p in rooms[room_id]["players"] 
                if p["client_id"] != client_id
            ]
            
            # If the room is empty, delete it
            if not rooms[room_id]["players"]:
                del rooms[room_id]
                logger.info(f"Room {room_id} deleted (no players)")
            else:
                # If the player who left was the drawer, select a new drawer
                if was_drawing:
                    rooms[room_id]["players"][0]["isDrawing"] = True
                await manager.broadcast_to_room(room_id, {
                    "event": "player_left",
                    "players": rooms[room_id]["players"],
                    "drawer_left": was_drawing
                })
                logger.info(f"Player left room {room_id}, drawer_left: {was_drawing}")
        del socket_to_room[client_id]

event_handlers = {
    "create_room": handle_create_room,
    "join_room": handle_join_room,
    "submit_drawing": handle_submit_drawing,
    "request_ai_judgment": handle_request_ai_judgment,
    "player_ready": handle_player_ready,
    "submit_judgments": handle_submit_judgments
} 