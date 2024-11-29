'''
File: image.py
Author: Hoyue
Description: It's an image uploader API.
'''

import base64
from datetime import datetime
from typing import Union, BinaryIO
from github import Github
from pathlib import Path
import os
from dotenv import load_dotenv
import uuid
from PIL import Image
import io
import imghdr

# Load environment variables
load_dotenv()

class ImageUploader:
    def __init__(self, 
                 github_token: str = os.getenv('GITHUB_TOKEN'),
                 repo_name: str = os.getenv('GITHUB_REPO'),
                 branch: str = os.getenv('GITHUB_BRANCH', 'main')):
        self.g = Github(github_token)
        self.repo = self.g.get_repo(repo_name)
        self.branch = branch
        self.cdn_base_url = f"https://image.hoyue.fun"

    def upload(self, 
                    image: Union[str, bytes, BinaryIO],
                    folder: str = "images",
                    max_size: int = 5 * 1024 * 1024) -> str:
        try:
            # UUID Generate
            uuid_filename = str(uuid.uuid4())
            
            # Handle different input types
            if isinstance(image, str):
                # If image is a file path
                file_path = Path(image)
                if not imghdr.what(file_path):
                    raise ValueError("Invalid image file")
                filename = f"{uuid_filename}_{file_path.name}"
                with open(file_path, 'rb') as f:
                    content = f.read()
            elif isinstance(image, bytes):
                # If image is bytes data
                if not imghdr.what(None, h=image):
                    raise ValueError("Invalid image data")
                filename = f"{uuid_filename}_image.png"
                content = image
            else:
                # If image is file-like object
                content = image.read()
                if not imghdr.what(None, h=content):
                    raise ValueError("Invalid image data")
                filename = f"{uuid_filename}_image.png"

            # Check file size
            if len(content) > max_size:
                raise ValueError(f"Image size exceeds maximum limit of {max_size/1024/1024}MB")

            # Verify it's a valid image by trying to open it
            try:
                Image.open(io.BytesIO(content))
            except Exception:
                raise ValueError("Invalid image format")

            # Create or update file in repository
            target_path = f"{folder}/{filename}"
            
            try:
                self.repo.create_file(
                    path=target_path,
                    message=f"Upload image {filename}",
                    content=content,
                    branch=self.branch
                )
            except Exception as e:
                contents = self.repo.get_contents(target_path, ref=self.branch)
                self.repo.update_file(
                    path=target_path,
                    message=f"Update image {filename}",
                    content=content,
                    sha=contents.sha,
                    branch=self.branch
                )

            return f"{self.cdn_base_url}/{target_path}"

        except Exception as e:
            raise Exception(f"Failed to upload image: {str(e)}")

def image_upload(image_data: Union[str, bytes, BinaryIO], folder: str = os.getenv('GITHUB_DEFAULT_FOLDER', "imgup/23")) -> str:
    """
    Upload image to GitHub repository and return CDN URL
    
    Args:
        image_data: Can be file path (str), bytes data, or file-like object
        folder: Target folder in repository, default is defined in GITHUB_DEFAULT_FOLDER
        
    Returns:
        str: CDN URL of the uploaded image
    """
    try:
        uploader = ImageUploader()
        return uploader.upload(image=image_data, folder=folder)
    except Exception as e:
        raise Exception(f"Image upload failed: {str(e)}")

