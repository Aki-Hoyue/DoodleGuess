'''
File: ai.py
Author: Hoyue
Description: It's the AI handler for the project.
'''

from openai import OpenAI
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def completion(
    message: str,
    model: str = os.getenv('AI_MODEL'),
    base_url: str = os.getenv('AI_BASE_URL'),
    key: str = os.getenv('AI_KEY')
) -> str:
    client = OpenAI(
        api_key=key,
        base_url=base_url
    )

    user_message = os.getenv('AI_USER_PROMPT', '') + message
    response = client.chat.completions.create(
        model=model,
        messages=[
            # {"role": "system", "content": os.getenv('AI_SYSTEM_PROMPT', '')},
            {"role": "user", "content": user_message}
        ]
    )

    return response.choices[0].message.content

