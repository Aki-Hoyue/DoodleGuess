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
    """上传图片到GitHub并返回CDN URL
    
    Args:
        file: 上传的图片文件
        folder: 可选的目标文件夹
        
    Returns:
        包含CDN URL的响应
        
    Raises:
        HTTPException: 上传失败时抛出
    """
    try:
        # 读取文件内容
        content = await file.read()
        
        # 如果没有指定folder，使用默认值
        target_folder = folder or os.getenv('GITHUB_DEFAULT_FOLDER', "imgup/23")
        
        # 上传图片
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
