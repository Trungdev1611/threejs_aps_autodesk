# BIM portal sample (React + Three.js + .NET + APS)

Mẫu bám JD: **dashboard** gọi API .NET, **Three.js** qua React Three Fiber, **Autodesk Viewer** + token APS từ backend.

## Cần cài trên máy

| Thành phần | Mục đích |
|------------|----------|
| **Node.js** (LTS) | `client` — Vite, React, R3F |
| **.NET 8 SDK** | `server` — Web API, proxy token APS |

## Chạy nhanh

**Terminal 1 — API**

```bash
cd server
dotnet restore
dotnet run
```

Mặc định: `http://localhost:5299` (xem `Properties/launchSettings.json`).

**Terminal 2 — Frontend**

```bash
cd client
npm install
npm run dev
```

Mở `http://localhost:5173`. Vite proxy `/api` → `5299`.

## Cấu hình tùy chọn

- **APS**: đặt `Aps:ClientId` và `Aps:ClientSecret` trên server (`appsettings.Development.json` hoặc `dotnet user-secrets`). Chi tiết: `server/README.md`.
- **URN model**: copy `client/.env.example` → `client/.env`, điền `VITE_APS_URN=` sau khi file đã translate trên APS.

## Cấu trúc

- `client/` — React + TypeScript + Vite, `@react-three/fiber`, `@react-three/drei`, `react-router-dom`
- `server/` — ASP.NET Core minimal API, CORS cho origin Vite, `GET /api/projects`, `GET /api/aps/token`
