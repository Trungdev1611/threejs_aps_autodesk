using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BimPortal.Api.Models;
using Microsoft.Extensions.Options;

namespace BimPortal.Api.Services;

public sealed class ApsStorageService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ApsOptions _options;
    private bool _bucketEnsured;

    public ApsStorageService(IHttpClientFactory httpFactory, IOptions<ApsOptions> options)
    {
        _httpFactory = httpFactory;
        _options = options.Value;
    }

    public async Task<(string ObjectId, string ObjectKey, string Urn)> UploadAsync(
        string accessToken,
        string fileName,
        Stream stream,
        CancellationToken ct)
    {
        // APS requires bucket first; conflict is fine if it already exists.
        await EnsureBucketExistsAsync(accessToken, ct);

        var objectKey = BuildObjectKey(fileName);
        var signedUrl = await CreateSignedS3UploadUrlAsync(accessToken, objectKey, ct);
        await UploadToSignedUrlAsync(signedUrl, stream, ct);

        // After upload succeeds, fetch object details to get objectId.
        var (objectId, uploadedObjectKey) = await GetObjectDetailsAsync(accessToken, objectKey, ct);

        // URN is base64url(objectId) and is what Model Derivative/Viewer uses.
        return (objectId, uploadedObjectKey, ToUrn(objectId));
    }

    private async Task<string> CreateSignedS3UploadUrlAsync(
        string accessToken,
        string objectKey,
        CancellationToken ct)
    {
        // APS OSS direct-to-S3: ask APS for a pre-signed S3 upload URL.
        var escapedObjectKey = Uri.EscapeDataString(objectKey);
        var escapedBucketKey = Uri.EscapeDataString(_options.BucketKey);
        var url =
            $"https://developer.api.autodesk.com/oss/v2/buckets/{escapedBucketKey}/objects/{escapedObjectKey}/signed?access=write&useCdn=true";

        var payload = JsonSerializer.Serialize(
            new
            {
                minutesExpiration = 60,
                singleUse = true,
            });

        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"APS signed upload URL failed ({(int)res.StatusCode}): {json}");
        }

        using var doc = JsonDocument.Parse(json);
        // Typical response field name: signedUrl
        if (doc.RootElement.TryGetProperty("signedUrl", out var signedUrlProp))
        {
            var signedUrl = signedUrlProp.GetString();
            if (!string.IsNullOrWhiteSpace(signedUrl))
            {
                return signedUrl;
            }
        }

        throw new InvalidOperationException("APS signed upload response missing signedUrl.");
    }

    private async Task UploadToSignedUrlAsync(string signedUrl, Stream stream, CancellationToken ct)
    {
        // Upload bytes directly to S3 using the signed URL (no Bearer token).
        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(HttpMethod.Put, signedUrl);
        req.Content = new StreamContent(stream);
        req.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/octet-stream");
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"S3 upload failed ({(int)res.StatusCode}): {body}");
        }
    }

    private async Task<(string ObjectId, string ObjectKey)> GetObjectDetailsAsync(
        string accessToken,
        string objectKey,
        CancellationToken ct)
    {
        var escapedObjectKey = Uri.EscapeDataString(objectKey);
        var escapedBucketKey = Uri.EscapeDataString(_options.BucketKey);
        var url =
            $"https://developer.api.autodesk.com/oss/v2/buckets/{escapedBucketKey}/objects/{escapedObjectKey}/details";

        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"APS object details failed ({(int)res.StatusCode}): {json}");
        }

        using var doc = JsonDocument.Parse(json);
        var objectId = doc.RootElement.GetProperty("objectId").GetString();
        var uploadedObjectKey = doc.RootElement.GetProperty("objectKey").GetString() ?? objectKey;
        if (string.IsNullOrWhiteSpace(objectId))
        {
            throw new InvalidOperationException("APS object details response missing objectId.");
        }

        return (objectId, uploadedObjectKey);
    }

    private async Task EnsureBucketExistsAsync(string accessToken, CancellationToken ct)
    {
        if (_bucketEnsured)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(
            new
            {
                bucketKey = _options.BucketKey,
                policyKey = _options.BucketPolicy,
            });

        var http = _httpFactory.CreateClient();
        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            "https://developer.api.autodesk.com/oss/v2/buckets");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var res = await http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode || res.StatusCode == HttpStatusCode.Conflict)
        {
            _bucketEnsured = true;
            return;
        }

        var body = await res.Content.ReadAsStringAsync(ct);
        throw new InvalidOperationException(
            $"APS create bucket failed ({(int)res.StatusCode}): {body}");
    }

    private static string BuildObjectKey(string originalName)
    {
        var ext = Path.GetExtension(originalName)?.ToLowerInvariant() ?? string.Empty;
        var name = Path.GetFileNameWithoutExtension(originalName);
        var sanitized = new string(
            name
                .ToLowerInvariant()
                .Select(ch => char.IsLetterOrDigit(ch) || ch == '-' ? ch : '-')
                .ToArray())
            .Trim('-');

        if (string.IsNullOrWhiteSpace(sanitized))
        {
            sanitized = "model";
        }

        return $"{sanitized}-{DateTimeOffset.UtcNow:yyyyMMddHHmmssfff}{ext}";
    }

    private static string ToUrn(string objectId)
    {
        var bytes = Encoding.UTF8.GetBytes(objectId);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
