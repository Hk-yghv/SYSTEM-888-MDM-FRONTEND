import os
from datetime import date
from threading import Lock
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
from ai_engine import SystemMDAIEngine

load_dotenv()

app = FastAPI(title="System MDM AI Service", version="1.0.0")

_ai_usage = {}
_ai_usage_lock = Lock()

def get_ai_daily_limit(user: Dict[str, Any]) -> int:
    role = str(user.get("role", "Staff")).lower()
    if user.get("isImmutable") or role in {"superadmin", "administrator"}:
        return int(os.getenv("AI_DAILY_LIMIT_ADMIN", "50"))
    return int(os.getenv("AI_DAILY_LIMIT_USER", "20"))

def consume_ai_quota(user: Dict[str, Any]) -> tuple[bool, int, int]:
    account = str(user.get("username", "anonymous")).strip() or "anonymous"
    today = date.today().isoformat()
    limit = get_ai_daily_limit(user)
    with _ai_usage_lock:
        record = _ai_usage.get(account)
        if not record or record["date"] != today:
            record = {"date": today, "count": 0}
        if record["count"] >= limit:
            _ai_usage[account] = record
            return False, 0, limit
        record["count"] += 1
        _ai_usage[account] = record
        return True, limit - record["count"], limit

# Enable CORS for Frontend Admin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str
    user: Dict[str, Any] = {}
    history: Optional[List[Dict[str, str]]] = []

class QuickPromptsRequest(BaseModel):
    user: Dict[str, Any] = {}

@app.get("/")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "backend3-python-ai", "version": "1.0.0"}

@app.post("/api/ai/chat")
async def chat_endpoint(payload: ChatRequest):
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    allowed, remaining, limit = consume_ai_quota(payload.user or {})
    if not allowed:
        raise HTTPException(status_code=429, detail=f"AI daily limit reached ({limit} questions). Try again tomorrow.")
    try:
        reply = SystemMDAIEngine.process_chat(
            question=payload.question,
            user=payload.user,
            conversation_history=payload.history
        )
        return {
            "success": True,
            "answer": reply,
            "userBrand": payload.user.get("brand", ""),
            "userRole": payload.user.get("role", ""),
            "quotaRemaining": remaining
        }
    except Exception as e:
        print(f"Chat processing error: {e}")
        return {
            "success": False,
            "answer": f"⚠️ មានបញ្ហាក្នុងការដំណើរការ AI Assistant: {str(e)}"
        }

@app.post("/api/ai/quick-prompts")
async def quick_prompts_endpoint(payload: QuickPromptsRequest):
    user = payload.user or {}
    brand = user.get("brand", "")
    role = user.get("role", "")

    if role == "Administrator" or not brand:
        prompts = [
            "📊 សង្ខេបទិន្នន័យកិច្ចសន្យា និងទូរស័ព្ទសរុប",
            "💳 សង្ខេបប្រាក់ទទួលបានសរុបពីការបង់",
            "🔒 តើមានទូរស័ព្ទប៉ុន្មានគ្រឿងជាប់ Lock?",
            "🔍 ស្វែងរកអតិថិជនតាមឈ្មោះ ឬលេខទូរស័ព្ទ",
            "📱 ពិនិត្យឧបករណ៍ដែលបាន Activate ចុងក្រោយ"
        ]
    else:
        prompts = [
            f"📊 សង្ខេបទិន្នន័យ Brand {brand}",
            f"📱 ចំនួនទូរស័ព្ទសកម្មក្នុង Brand {brand}",
            "💳 ប្រវត្តិបង់ប្រាក់ក្នុង Brand ខ្ញុំ",
            "🔒 ពិនិត្យទូរស័ព្ទជាប់ Lock ក្នុង Brand ខ្ញុំ",
            "🔍 ស្វែងរកកិច្ចសន្យាអតិថិជន"
        ]
    return {"prompts": prompts}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5003))
    print(f"🚀 SYSTEM MDM Python AI Backend 3 running on port {port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
