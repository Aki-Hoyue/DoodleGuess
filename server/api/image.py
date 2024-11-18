from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Optional
from pydantic import BaseModel
from ..image import image_upload
import os

router = APIRouter(prefix="/api", tags=["image"])

class ImageResponse(BaseModel):
    url: str

@router.post("/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    folder: Optional[str] = None
):
    """Upload image to GitHub and return CDN URL
    
    Args:
        file: UploadFile, the image file to upload
        folder: Optional[str], the target folder, default is "imgup/23"
        
    Returns:
        ImageResponse, include CDN URL
        
    Raises:
        HTTPException: Upload failed
    """
    try:
        # Read file content
        content = await file.read()
        
        # If no folder is specified, use the default value
        target_folder = folder or os.getenv('GITHUB_DEFAULT_FOLDER', "imgup/23")
        
        # Upload image
        url = image_upload(
            image_data=content,
            folder=target_folder
        )
        
        return ImageResponse(url=url)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(e)}"
        )
