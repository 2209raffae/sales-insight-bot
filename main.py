"""
Sales Insight Bot - AI Lead & Spend Analytics Copilot
FastAPI application entry point.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.staticfiles import StaticFiles
from database import engine
from models import Base, LeadRecord, CampaignSpend, UploadBatch, CampaignMonthlyBudget, ActualSpend, UserProfile, UserPermission  # noqa: F401

from routers import leads_upload, leads_kpi, chat
from routers import spend_upload, spend_kpi, spend_advanced, uploads, budgets, manual_spend, report
from routers import hr_screening, hr_performance, hr_chat
from routers import auth, admin, competitor

app = FastAPI(
    title="AI Lead & Spend Analytics Copilot",
    description="Deterministic KPI engine for leads + marketing spend + monthly budgets, explained by Groq AI.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UTF8StaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        content_type = response.headers.get("content-type", "")
        if (
            content_type
            and "charset=" not in content_type.lower()
            and (
                content_type.startswith("text/")
                or "javascript" in content_type
                or "json" in content_type
            )
        ):
            response.headers["content-type"] = f"{content_type}; charset=utf-8"
        return response



@app.middleware("http")
async def enforce_utf8_charset(request: Request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if (
        content_type
        and "charset=" not in content_type.lower()
        and (
            content_type.startswith("text/")
            or "application/json" in content_type
            or "javascript" in content_type
        )
    ):
        response.headers["content-type"] = f"{content_type}; charset=utf-8"
    return response


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)      # creates new tables if not present


# Include routers
app.include_router(leads_upload.router)
app.include_router(leads_kpi.router)
app.include_router(spend_upload.router)
app.include_router(spend_kpi.router)
app.include_router(spend_advanced.router)
app.include_router(uploads.router)
app.include_router(budgets.router)
app.include_router(manual_spend.router)
app.include_router(chat.router)
app.include_router(report.router)
app.include_router(hr_screening.router)
app.include_router(hr_performance.router)
app.include_router(hr_chat.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(competitor.router)



@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if request.url.path.startswith("/api"):
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content={"detail": detail})
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# Mount React build
import os
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")

if os.path.isdir(frontend_dist):
    app.mount("/assets", UTF8StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Serve index.html for all other routes to let React Router handle them
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return JSONResponse(status_code=404, content={"detail": "Frontend non compilato."})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api"):
        return JSONResponse(status_code=422, content={"detail": exc.errors()})
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if request.url.path.startswith("/api"):
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=4000, reload=True)
