# BimPortal.Api (.NET 8)

## Setup

1. Install [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).
2. From `server`:

```bash
dotnet restore
dotnet run
```

API default: `http://localhost:5299`

## Autodesk APS (token, upload, translate)

Do not put secrets in the frontend. Configure on the server (one of the following):

- Create `appsettings.Development.json` from `appsettings.Development.example.json` (not committed), or use env vars.
- Or use user-secrets:

```bash
dotnet user-secrets init
dotnet user-secrets set "Aps:ClientId" "YOUR_ID"
dotnet user-secrets set "Aps:ClientSecret" "YOUR_SECRET"
```

Frontend fetches tokens via `GET /api/aps/token` (dev: Vite proxies `/api` -> `5299`).

## Model endpoints

- `POST /api/models/upload` (`multipart/form-data`, field `file`): upload to APS OSS and returns `urn`.
- `POST /api/models/{urn}/translate`: starts translation (SVF2).
- `GET /api/models/{urn}/status`: reads Model Derivative manifest/status.
- `GET /api/models`: lists model metadata stored in PostgreSQL.
- `GET /api/aps/config`: basic config/status check.

## PostgreSQL (model metadata)

The API uses `ConnectionStrings:Default` to store upload/URN/status metadata in a `models` table.

- The schema is created automatically on startup (`create table if not exists`) for this demo.
- Override the connection string via `appsettings.Development.json` or env var:

```bash
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=threejs_aps_autodesk;Username=postgres;Password=YOUR_PASSWORD"
```

### Quick curl test

```bash
# Upload a file and receive a URN
curl -X POST http://localhost:5299/api/models/upload \
  -F "file=@/ABSOLUTE/PATH/to/your-model.dwg"

# Translate (replace URN)
curl -X POST "http://localhost:5299/api/models/<URN>/translate"

# Poll status
curl "http://localhost:5299/api/models/<URN>/status"
```
