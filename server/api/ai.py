from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from ..ai import judge_answer

router = APIRouter(prefix="/api", tags=["ai"])

class JudgeRequest(BaseModel):
    reference_answer: str
    guessed_answers: List[str]

class JudgeResponse(BaseModel):
    Judge: bool
    Reason: str

@router.post("/judge", response_model=List[JudgeResponse])
async def judge_answers(request: JudgeRequest):
    """Guesser judge the answer
    
    Args:
        request: JudgeRequest, include reference answer (str) and guessed answers (List[str])
        
    Returns:
        List[JudgeResponse]
        
    Raises:
        HTTPException: AI judgment failed
    """
    try:
        results = judge_answer(
            user_answer=request.reference_answer,
            guesser_answer=request.guessed_answers
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI judgment failed: {str(e)}"
        )
