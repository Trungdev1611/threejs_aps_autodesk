# portal sample (React + Three.js + .NET + APS)
<img width="1586" height="644" alt="image" src="https://github.com/user-attachments/assets/88801e75-9b28-4b8b-8962-575c5b57365e" />

<img width="1097" height="859" alt="image" src="https://github.com/user-attachments/assets/c1d0cf01-a339-4cec-9b07-158105b6473a" />




This repo is a small **BIM-style web portal** showcasing:
- a React dashboard UI,
- a Three.js (R3F) page for custom 3D,
- an APS pipeline: **upload -> URN -> translate -> manifest polling -> Viewer**,
- and PostgreSQL persistence for model metadata.

## Prerequisites

| Tool | Used for |
|------|----------|
| **Node.js** (LTS) | `client` — Vite + React + R3F |
| **.NET 8 SDK** | `server` — ASP.NET Core API |
| **PostgreSQL** | model metadata (`models` table) |

## Run locally

**Terminal 1 — API**

```bash
cd server
dotnet restore
dotnet run
```

API default: `http://localhost:5299` (see `Properties/launchSettings.json`).

**Terminal 2 — Frontend**

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `5299`.

## Configuration (dev)

- Copy `server/appsettings.Development.example.json` to `server/appsettings.Development.json` (not committed) and fill:
  - `Aps:ClientId`, `Aps:ClientSecret`
  - `ConnectionStrings:Default`

## Structure

- `client/` — React + TypeScript + Vite, `@react-three/fiber`, `@react-three/drei`
- `server/` — ASP.NET Core Minimal API + APS integration + PostgreSQL repository
