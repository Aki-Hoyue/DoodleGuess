'''
File: ai.py
Author: Hoyue
Description: It's the AI handler for the project.
'''

from openai import OpenAI
import os
from dotenv import load_dotenv
from typing import List
import time
import json

# Load environment variables
load_dotenv()
SYSTEM_PROMPT = "<Role>: DoodleGuess Judge\nProfile\ndescription: Evaluate the relevance between the reference answer and the guesser's answer in the DoodleGuess game, and provide a structured judgment of 'true/false'.\n<Skills>\n1. Deep Reasoning: Ability to think critically and analytically.\n2. Knowledge Integration: Ability to quickly integrate and apply knowledge from various disciplines.\n3. Critical Thinking: Ability to question assumptions and consider multiple possibilities.\n4. Innovative Thinking: Ability to generate novel ideas and solutions.\n5. Metacognition: Ability to reflect on one's own thinking process and evaluate its effectiveness.\n<Background>\nIn the DoodleGuess game, the user provides a reference answer, and the guesser attempts to guess the answer through drawing. Our task is to evaluate the relevance between the reference answer and the guesser's answer, and provide a structured judgment of 'true/false'.\n<Goals>\n1. Evaluate the relevance between the reference answer and the guesser's answer.\n2. Provide a structured judgment of 'true/false'.\n<Workflows>\n1. Collect the reference answer and the guesser's answers.\n2. Translate the reference answer and the guesser's answers to English, and using English for the reasoning and judgement. 3. Conduct deep reasoning to analyze the relevance between the answers.\n4. Use critical thinking to consider multiple possibilities.\n5. Provide a structured judgment of 'true/false'.\n<Rules>\n1. The judgment result must be structured, using 'true/false' to indicate.\n2. The judgment result must be accurate and objective.\n3. The judgment reason must be comprehensive and detailed.\n4. The judgment result must be fair and reasonable.\n<OutputFormat>\n[\{'Judge': 'true', 'Reason': 'This answer matches the reference closely'\},\n \{'Judge': 'false', 'Reason': 'This answer is completely different'\}]\n<Notes>1. For different reference answers, their is no memory between them.\n2. Your answer is structured that must follow the <OutputFormat>, do not include any other information.\n3. your reason response must match the language of the reference answer."

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

def judge_answer(user_answer: str, guesser_answer: List[str], max_retries: int = 3) -> List[dict]:
    """
    Judge the answer and convert AI's response to a list of dictionaries with judgments and reasons
    Args:
        user_answer (str): The reference answer given by the user in the current round
        guesser_answer (List[str]): The answers given by the candidates
        max_retries (int): Maximum number of retries if parsing fails
    Returns:
        List[dict]: List of dictionaries containing judgment and reason for each answer
    Raises:
        Exception: If all retries fail
    """

    prompt = f"""The reference answer given by the user in the current round is: {user_answer}, 
the answers given by the candidates are: [{', '.join(guesser_answer)}]. Remember your system prompt and the notes. <Notes>1. For different reference answers, their is no memory between them.\n2. Your answer is structured that must follow the <OutputFormat>, do not include any other information.\n3. your reason response must match the language of the reference answer."""

    for attempt in range(max_retries):
        try:
            # Get AI response
            response = completion(prompt)
            
            # Clean and normalize the response
            response = response.strip()
            
            # Parse JSON response
            judgments = json.loads(response)
            # print(f"AI response: {judgments}")

            
            # Validate response structure
            if not isinstance(judgments, list):
                raise ValueError("Response is not a list")
            
            if len(judgments) != len(guesser_answer):
                raise ValueError("The number of judgments does not match the number of answers")
            
            # Convert string "true"/"false" to boolean values
            for judgment in judgments:
                if not isinstance(judgment, dict):
                    raise ValueError("Judgment is not an object")
                if "Judge" not in judgment or "Reason" not in judgment:
                    raise ValueError("Judgment missing required fields")
                judgment["Judge"] = str(judgment["Judge"]).lower() == "true"
            
            # print(f"Parsed judgments: {judgments}")
            return judgments
            
        except Exception as e:
            if attempt == max_retries - 1:
                raise Exception(f"Failed to parse AI response after {max_retries} attempts: {str(e)}")
            
            # Wait before retrying (with exponential backoff)
            time.sleep(2 ** attempt)
            
            # Modify prompt for retry
            prompt += "\nPrevious response was invalid. Please ensure you return only a valid JSON array of objects with 'Judge' and 'Reason' fields."
