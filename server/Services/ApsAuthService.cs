using System.Text.Json;
using BimPortal.Api.Models;
using Microsoft.Extensions.Options;

namespace BimPortal.Api.Services;

public sealed class ApsAuthService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ApsOptions _options;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly Dictionary<string, (string Token, DateTimeOffset ExpiresAt)> _cache = new();

    public ApsAuthService(IHttpClientFactory httpFactory, IOptions<ApsOptions> options)
    {
        _httpFactory = httpFactory;
        _options = options.Value;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ClientId) &&
        !string.IsNullOrWhiteSpace(_options.ClientSecret);

    public async Task<(string AccessToken, int ExpiresIn)> GetTokenAsync(
        string scope,
        CancellationToken ct)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Set Aps:ClientId and Aps:ClientSecret (see server/README.md).");
        }

        await _lock.WaitAsync(ct);
        try
        {
            // Cache tokens per-scope. Viewer scopes are narrower than OSS upload scopes.
            if (_cache.TryGetValue(scope, out var cached) && DateTimeOffset.UtcNow < cached.ExpiresAt)
            {
                var ttl = Math.Max(1, (int)(cached.ExpiresAt - DateTimeOffset.UtcNow).TotalSeconds);
                return (cached.Token, ttl);
            }

            var http = _httpFactory.CreateClient();
            using var body = new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["client_id"] = _options.ClientId,
                    ["client_secret"] = _options.ClientSecret,
                    ["grant_type"] = "client_credentials",
                    ["scope"] = scope,
                });

            using var res = await http.PostAsync(
                "https://developer.api.autodesk.com/authentication/v2/token",
                body,
                ct);
            var json = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"APS auth failed ({(int)res.StatusCode}): {json}");
            }

            using var doc = JsonDocument.Parse(json);
            var accessToken = doc.RootElement.GetProperty("access_token").GetString();
            var expiresIn = doc.RootElement.GetProperty("expires_in").GetInt32();
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                throw new InvalidOperationException("APS auth response missing access_token.");
            }

            // Small safety margin so we refresh before hard expiry.
            var expiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(1, expiresIn - 30));
            _cache[scope] = (accessToken, expiresAt);
            return (accessToken, expiresIn);
        }
        finally
        {
            _lock.Release();
        }
    }
}
