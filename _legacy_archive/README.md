# Legacy Monolith Archive

This directory stores archived monolith files from v1.0 of Fabric AI Studio.

## Migrated Components Summary

| Legacy File | Replacement v2.0 Architecture | Status |
| :--- | :--- | :--- |
| `server.py` (~1,800 lines `http.server`) | `api_server.py` + `app/api/routers/` (FastAPI + Pydantic v2 + SSE) | **100% Migrated & Active** |
| `index.html` + `app.js` (Vanilla JS monolith) | `frontend/` (React 18 + TypeScript + Tailwind CSS + Vite + `@xyflow/react`) | **100% Migrated & Active** |

All tests and services run exclusively on the modernized FastAPI backend and React frontend.
