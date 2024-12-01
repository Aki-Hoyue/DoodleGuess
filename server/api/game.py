from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..websocket import rooms, manager
import logging

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/game",
    tags=["game"]
)

class GuessSubmission(BaseModel):
    room_id: str
    player_id: str
    guess: str

class GameState(BaseModel):
    room_id: str
    current_round: int
    total_rounds: int
    current_player: Optional[str]
    players: List[dict]
    status: str
    keyword: Optional[str]

@router.post("/submit-guess")
async def submit_guess(submission: GuessSubmission):
    logger.info(f"Received guess submission for room {submission.room_id}")
    if submission.room_id not in rooms:
        logger.warning(f"Room {submission.room_id} not found")
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[submission.room_id]
    
    # Record the player's guess
    if "guesses" not in room:
        room["guesses"] = {}
    room["guesses"][submission.player_id] = submission.guess
    
    # Check if all players have submitted guesses
    non_drawing_players = [p for p in room["players"] if not p["isDrawing"]]
    all_guessed = all(p["client_id"] in room["guesses"] for p in non_drawing_players)
    
    if all_guessed:
        # Notify all players in the room
        await manager.broadcast_to_room(submission.room_id, {
            "event": "all_guessed",
            "guesses": room["guesses"]
        })
        logger.info(f"All players have submitted guesses in room {submission.room_id}")
        return {"status": "success", "all_guessed": True}
    
    return {"status": "success", "all_guessed": False}

@router.get("/state/{room_id}")
async def get_game_state(room_id: str) -> GameState:
    logger.info(f"Getting game state for room {room_id}")
    if room_id not in rooms:
        logger.warning(f"Room {room_id} not found")
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    current_player = next((p["nickname"] for p in room["players"] if p["isDrawing"]), None)
    keyword = room.get("currentKeyword") if current_player else None
    
    return GameState(
        room_id=room_id,
        current_round=room["currentRound"],
        total_rounds=room["totalRounds"],
        current_player=current_player,
        players=room["players"],
        status=room["status"],
        keyword=keyword
    ) 