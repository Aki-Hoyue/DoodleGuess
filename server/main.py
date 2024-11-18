from fastapi import FastAPI
from server.api import ai, image

app = FastAPI()

# 注册路由
app.include_router(ai.router)
app.include_router(image.router)