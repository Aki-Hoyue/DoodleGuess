from fastapi import APIRouter, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from typing import Optional
import aiofiles
import os
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

router = APIRouter(
    prefix="/api/image",
    tags=["image"]
)

UPLOAD_DIR = ROOT_DIR / "public" / "images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount the static files directory
router.mount("/static", StaticFiles(directory=str(UPLOAD_DIR)), name="static")

@router.post("/upload-drawing")
async def upload_drawing(
    file: UploadFile = File(...),
    room_id: str = Form(...),
    player_id: str = Form(...)
):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{room_id}_{player_id}_{timestamp}{os.path.splitext(file.filename)[1]}"
    file_path = UPLOAD_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    return {
        "status": "success",
        "filename": filename,
        "url": f"/images/{filename}"
    }

@router.get("/get-drawing/{room_id}")
async def get_drawing(room_id: str):
    """
    Get the latest drawing in the room
    """
    files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(room_id)]
    if not files:
        return {"status": "error", "message": "No drawing found"}
    
    latest_file = max(files, key=lambda x: os.path.getctime(os.path.join(UPLOAD_DIR, x)))
    return {
        "status": "success",
        "filename": latest_file,
        "url": f"/images/{latest_file}"
    }

