using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BimPortal.Api.Services;

public sealed class ApsDerivativeService
{
    private readonly IHttpClientFactory _httpFactory;

    public ApsDerivativeService(IHttpClientFactory httpFactory)
    {
        _httpFactory = httpFactory;
    }

    public async Task<JsonElement> StartTranslateAsync(string accessToken, string urn, CancellationToken ct)
    {
        // Start conversion job so uploaded source model becomes web-viewable (SVF2).
        var payload = JsonSerializer.Serialize(
            new
            {
                input = new { urn },
                output = new
                {
                    formats = new[]
                    {
                        new
                        {
                            type = "svf2",
                            views = new[] { "2d", "3d" },
                        },
                    },
                },
            });

        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            "https://developer.api.autodesk.com/modelderivative/v2/designdata/job");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"APS translate job failed ({(int)res.StatusCode}): {json}");
        }

        return JsonDocument.Parse(json).RootElement.Clone();
    }

    public async Task<JsonElement> GetManifestAsync(string accessToken, string urn, CancellationToken ct)
    {
        // Manifest contains translate status: pending/inprogress/success/failed.
        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(
            HttpMethod.Get,
            $"https://developer.api.autodesk.com/modelderivative/v2/designdata/{Uri.EscapeDataString(urn)}/manifest");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"APS manifest failed ({(int)res.StatusCode}): {json}");
        }

        return JsonDocument.Parse(json).RootElement.Clone();
    }
}
