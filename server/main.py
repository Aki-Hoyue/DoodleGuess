from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.api import ai, image

app = FastAPI()

origins = [
    "*"
    # Wait for other origins
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(ai.router)
app.include_router(image.router)

@app.get("/status")
async def health_check():
    return {
        "status": "ok",
        "code": 200
    }
