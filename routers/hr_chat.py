from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from hr_ai_layer import policy_chat_reply

router = APIRouter(prefix="/api/hr", tags=["HR Chat"])

class Message(BaseModel):
    id: str
    text: str
    sender: str  # "user" | "ai"

class ChatRequest(BaseModel):
    chat_history: List[Message]
    new_message: str

@router.post("/chat")
def chat_with_policy_bot(req: ChatRequest):
    # Convert past messages to dict format expected by AI layer
    history = [{"sender": m.sender, "text": m.text} for m in req.chat_history]
    
    reply_text = policy_chat_reply(history, req.new_message)
    
    return {"reply": reply_text}
