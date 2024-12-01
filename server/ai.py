'''
File: ai.py
Author: Hoyue
Description: It's the AI handler for the project.
'''

import logging
import json
import time
from typing import List
import asyncio
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """<Role>: DoodleGuess Judge
Profile
description: Evaluate the relevance between the reference answer and the guesser's answer in the DoodleGuess game, and provide a structured judgment of 'true/false'.
<Skills>
1. Deep Reasoning: Ability to think critically and analytically.
2. Knowledge Integration: Ability to quickly integrate and apply knowledge from various disciplines.
3. Critical Thinking: Ability to question assumptions and consider multiple possibilities.
4. Innovative Thinking: Ability to generate novel ideas and solutions.
5. Metacognition: Ability to reflect on one's own thinking process and evaluate its effectiveness.
<Background>
In the DoodleGuess game, the user provides a reference answer, and the guesser attempts to guess the answer through drawing. Our task is to evaluate the relevance between the reference answer and the guesser's answer, and provide a structured judgment of 'true/false'.
<Goals>
1. Evaluate the relevance between the reference answer and the guesser's answer.
2. Provide a structured judgment of 'true/false'.
<Workflows>
1. Collect the reference answer and the guesser's answers.
2. Translate the reference answer and the guesser's answers to English, and using English for the reasoning and judgement. 3. Conduct deep reasoning to analyze the relevance between the answers.
4. Use critical thinking to consider multiple possibilities.
5. Provide a structured judgment of 'true/false'.
<Rules>
1. The judgment result must be structured, using 'true/false' to indicate.
2. The judgment result must be accurate and objective.
3. The judgment reason must be comprehensive and detailed.
4. The judgment result must be fair and reasonable.
<OutputFormat>
[{'Judge': 'true', 'Reason': 'This answer matches the reference closely'},
 {'Judge': 'false', 'Reason': 'This answer is completely different'}]
<Notes>1. For different reference answers, their is no memory between them.
2. Your answer is structured that must follow the <OutputFormat>, do not include any other information.
3. your reason response must match the language of the reference answer."""

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

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message}
        ]
    )
    
    return response.choices[0].message.content

async def judge_guesses(user_answer: str, guesser_answer: List[str], max_retries: int = 3) -> List[dict]:
    """
    Judge the answer and convert AI's response to a list of dictionaries with judgments and reasons
    Args:
        user_answer (str): The reference answer given by the user in the current round
        guesser_answer (List[str]): The answers given by the candidates
        max_retries (int): Maximum number of retries if parsing fails
    Returns:
        List[dict]: List of dictionaries containing judgment and reason for each answer
    Raises:
        Exception: If AI judgment fails after all retries
    """
    if not guesser_answer:
        raise ValueError("No guesses to judge")

    guess_str = "["
    for guess in guesser_answer:
        guess_str += f"{guess}, "
    guess_str += "]"

    prompt = f"""
    The reference answer given by the user in the current round is: {user_answer}, 
    the answers given by the candidates are: {guess_str}. 
    Remember your system prompt and the notes. 
    <Notes>
    1. For different reference answers, their is no memory between them.
    2. Your answer is structured that must follow the <OutputFormat>, do not include any other information.
    3. your reason response must match the language of the reference answer.
    4. The number of judgments in dictionary must be equal to the number of input answers.
    """

    last_error = None
    for attempt in range(max_retries):
        try:
            # Get AI response
            response = completion(prompt)
            logger.info(f"Raw AI response: {response}")
            if not response:
                raise ValueError(f"Empty response from AI (attempt {attempt + 1}/{max_retries})")
            
            # Clean and normalize the response
            response = response.strip()
            response = response.replace("'", '"')
            response = response.replace('\\n', '')
            response = response.replace('\\', '')
            
            if not response.startswith('[') or not response.endswith(']'):
                raise ValueError(f"Response is not a valid JSON array: {response}")
            
            logger.info(f"Normalized response: {response}")
            
            # Parse JSON response
            try:
                judgments = json.loads(response)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON response from AI: {str(e)}\nResponse: {response}")
            
            # Validate response structure
            if not isinstance(judgments, list):
                raise ValueError(f"Response is not a list. Got: {type(judgments)}")
            
            if len(judgments) != len(guesser_answer):
                raise ValueError(f"The number of judgments ({len(judgments)}) does not match the number of answers ({len(guesser_answer)})")
            
            normalized_judgments = []
            for i, (judgment, guess) in enumerate(zip(judgments, guesser_answer)):
                if not isinstance(judgment, dict):
                    raise ValueError(f"Judgment {i} is not an object. Got: {type(judgment)}")
                
                if "Judge" not in judgment:
                    raise ValueError(f"Judgment {i} missing 'Judge' field")
                if "Reason" not in judgment:
                    raise ValueError(f"Judgment {i} missing 'Reason' field")
                
                normalized_judgment = {
                    "is_correct": str(judgment["Judge"]).lower() == "true",
                    "reason": judgment["Reason"],
                    "guess": guess
                }
                normalized_judgments.append(normalized_judgment)
            
            logger.info(f"Normalized judgments: {normalized_judgments}")
            return normalized_judgments
            
        except Exception as e:
            last_error = e
            logger.error(f"AI judgment attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
    
    # If we get here, all retries failed
    raise Exception(f"AI judgment failed after {max_retries} attempts. Last error: {str(last_error)}")
