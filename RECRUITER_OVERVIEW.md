## threejs_aps_autodesk — what this project demonstrates

This repository is a small end-to-end sample built to match a typical **React + Three.js + .NET + BIM/APS** job scope.

### Highlights

- **APS pipeline (real-world)**:
  - Upload a design file to APS storage
  - Generate a URN
  - Trigger Model Derivative translation (SVF2)
  - **Poll** the manifest status (`inprogress/success/failed`)
  - View the result in **Autodesk Viewer** on the web

- **Token handling**:
  - Server-side OAuth 2-legged token generation (no secrets in the browser)
  - Short-lived access token caching on the backend
  - Viewer integration using **`getAccessToken` callback** to refresh tokens when needed

- **Persistence**:
  - Stores model metadata (file name, URN, status, timestamps) in **PostgreSQL**

- **React UX**:
  - A “Models” page that drives the workflow (upload/translate/status) and renders the viewer inline
  - A separate viewer page is available for opening in a new tab

- **Custom 3D**:
  - A Three.js / React Three Fiber page demonstrating scene setup and debug tooling for coordinate systems

### Tech stack

- Frontend: React + TypeScript + Vite + axios + React Router + Three.js (R3F/drei)
- Backend: ASP.NET Core (.NET 8)
- DB: PostgreSQL
- Platform: Autodesk Platform Services (APS) Viewer + Model Derivative + OSS

