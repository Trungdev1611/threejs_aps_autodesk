using BimPortal.Api.Models;
using BimPortal.Api.Services;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ApsOptions>(builder.Configuration.GetSection("Aps"));

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "frontend",
        p =>
        {
            p.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

builder.Services.AddHttpClient();
builder.Services.AddSingleton<ApsAuthService>();
builder.Services.AddSingleton<ApsStorageService>();
builder.Services.AddSingleton<ApsDerivativeService>();
builder.Services.AddSingleton<ModelRepository>();

var app = builder.Build();

app.UseCors("frontend");

// Try schema creation on startup, but keep API alive if DB credentials are missing/wrong.
var dbReady = false;
try
{
    await app.Services.GetRequiredService<ModelRepository>().EnsureSchemaAsync(CancellationToken.None);
    dbReady = true;
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "PostgreSQL is not ready. Configure ConnectionStrings:Default and retry.");
}

async Task<bool> EnsureDbReadyAsync(ModelRepository repo, CancellationToken ct)
{
    if (dbReady)
    {
        return true;
    }

    try
    {
        await repo.EnsureSchemaAsync(ct);
        dbReady = true;
        return true;
    }
    catch
    {
        return false;
    }
}

// Demo data for the dashboard page.
var projects = new[]
{
    new { id = "JP-2401", name = "Office tower — Osaka", phase = "Design", bimStatus = "IFC export OK" },
    new { id = "JP-2402", name = "Bridge deck — mock", phase = "Coordination", bimStatus = "Clash review" },
    new { id = "JP-2403", name = "Plant retrofit", phase = "As-built", bimStatus = "Point cloud aligned" },
};

app.MapGet("/api/projects", () => Results.Ok(projects));

// FE/Viewer uses this token to initialize Autodesk Viewer.
app.MapGet(
        "/api/aps/token",
        async (ApsAuthService auth, CancellationToken ct) =>
        {
            if (!auth.IsConfigured)
            {
                return Results.Json(
                    new { error = "Set Aps:ClientId and Aps:ClientSecret (see server/README.md)." },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var (accessToken, expiresIn) = await auth.GetTokenAsync(
                "data:read viewables:read",
                ct);
            return Results.Ok(new { access_token = accessToken, expires_in = expiresIn });
        })
    .WithName("ApsToken");

// Model list is backed by PostgreSQL (see ModelRepository).
app.MapGet(
    "/api/models",
    async (ModelRepository repo, CancellationToken ct) =>
    {
        if (!await EnsureDbReadyAsync(repo, ct))
        {
            return Results.Json(
                new
                {
                    error =
                        "PostgreSQL not ready. Set ConnectionStrings:Default and restart API (or retry endpoint).",
                },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Results.Ok(await repo.GetAllAsync(ct));
    });

// 1) Receive file from FE (multipart/form-data field "file")
// 2) Upload to APS OSS (signed S3 upload)
// 3) Return URN for next steps (translate + viewer)
app.MapPost(
    "/api/models/upload",
    async (
        IFormFile? file,
        ApsAuthService auth,
        ApsStorageService storage,
        ModelRepository repo,
        CancellationToken ct) =>
    {
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { error = "Missing file in multipart/form-data field 'file'." });
        }
        if (!await EnsureDbReadyAsync(repo, ct))
        {
            return Results.Json(
                new
                {
                    error =
                        "PostgreSQL not ready. Set ConnectionStrings:Default and restart API (or retry endpoint).",
                },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var (accessToken, _) = await auth.GetTokenAsync(
            "bucket:create bucket:read data:read data:write",
            ct);
        await using var stream = file.OpenReadStream();
        var (objectId, objectKey, urn) = await storage.UploadAsync(accessToken, file.FileName, stream, ct);

        var now = DateTimeOffset.UtcNow;
        var model = new StoredModel(
            Id: Guid.NewGuid().ToString("N"),
            FileName: file.FileName,
            ObjectKey: objectKey,
            ObjectId: objectId,
            Urn: urn,
            Status: "uploaded",
            CreatedAt: now,
            UpdatedAt: now);

        await repo.UpsertAsync(model, ct);
        return Results.Ok(model);
    })
    // Minimal APIs + multipart/form-data can add antiforgery metadata.
    // This app is a pure JSON API for a SPA, so we disable antiforgery for this endpoint.
    .DisableAntiforgery();

// Start Model Derivative translate job for an uploaded URN.
app.MapPost(
    "/api/models/{urn}/translate",
    async (
        string urn,
        ApsAuthService auth,
        ApsDerivativeService derivative,
        ModelRepository repo,
        CancellationToken ct) =>
    {
        if (!await EnsureDbReadyAsync(repo, ct))
        {
            return Results.Json(
                new
                {
                    error =
                        "PostgreSQL not ready. Set ConnectionStrings:Default and restart API (or retry endpoint).",
                },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var (accessToken, _) = await auth.GetTokenAsync("data:read data:write viewables:read", ct);
        var result = await derivative.StartTranslateAsync(accessToken, urn, ct);

        await repo.UpdateStatusAsync(urn, "inprogress", ct);

        return Results.Ok(result);
    });

// Poll this endpoint from FE to know when translate is done.
app.MapGet(
    "/api/models/{urn}/status",
    async (
        string urn,
        ApsAuthService auth,
        ApsDerivativeService derivative,
        ModelRepository repo,
        CancellationToken ct) =>
    {
        if (!await EnsureDbReadyAsync(repo, ct))
        {
            return Results.Json(
                new
                {
                    error =
                        "PostgreSQL not ready. Set ConnectionStrings:Default and restart API (or retry endpoint).",
                },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var (accessToken, _) = await auth.GetTokenAsync("data:read viewables:read", ct);
        var manifest = await derivative.GetManifestAsync(accessToken, urn, ct);
        var status = manifest.TryGetProperty("status", out var s) ? s.GetString() : "unknown";

        if (!string.IsNullOrWhiteSpace(status))
        {
            await repo.UpdateStatusAsync(urn, status!, ct);
        }

        return Results.Ok(manifest);
    });

// Quick check endpoint so FE can show missing APS config clearly.
app.MapGet(
    "/api/aps/config",
    (IOptions<ApsOptions> options, ApsAuthService auth) =>
    {
        var o = options.Value;
        return Results.Ok(
            new
            {
                isConfigured = auth.IsConfigured,
                dbReady,
                bucketKey = o.BucketKey,
                bucketPolicy = o.BucketPolicy,
            });
    });

app.MapGet("/api/health", () => Results.Ok(new { ok = true, dbReady }));

app.Run();
