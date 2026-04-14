"""
Sales Insight Bot - AI Lead & Spend Analytics Copilot
FastAPI application entry point.
"""
import platform
platform.system = lambda: "Windows"
platform.machine = lambda: "AMD64"
platform.version = lambda: "10.0"
platform.release = lambda: "10"
platform.architecture = lambda: ("64bit", "WindowsPE")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

from database import engine
from models import Base, LeadRecord, CampaignSpend, UploadBatch, CampaignMonthlyBudget, ActualSpend, UserProfile, UserPermission, TaskForceProject, TaskForceMember, TaskForceUpdate  # noqa: F401

from routers import leads_upload, leads_kpi, chat
from routers import spend_upload, spend_kpi, spend_advanced, uploads, budgets, manual_spend, report
from routers import hr_screening, hr_performance, hr_chat, orchestrator, runtime
from routers import auth, admin, competitor, taskforce, warehouse, warehouse_upload, logistics, crm

app = FastAPI(
    title="AI Lead & Spend Analytics Copilot",
    description="Deterministic KPI engine for leads + marketing spend + monthly budgets, explained by Groq AI.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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
    try:
        from database import run_migrations
        print("Skipping tables creation for fast boot...")
        # Base.metadata.create_all(bind=engine)
        # run_migrations()
        print("Startup complete.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e


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
app.include_router(crm.router)
app.include_router(logistics.router)
app.include_router(warehouse.router)
app.include_router(warehouse_upload.router)
app.include_router(competitor.router)
app.include_router(taskforce.router)
app.include_router(orchestrator.router)
app.include_router(runtime.router)



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

# Ensure static directories exist
os.makedirs(os.path.join("static", "uploads", "taskforce"), exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", UTF8StaticFiles(directory=assets_dir), name="assets")

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
    import traceback
    error_trace = traceback.format_exc()
    print(error_trace) # Print the real error to console
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=500, 
            content={
                "detail": str(exc),
                "traceback": error_trace
            }
        )
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8015))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
