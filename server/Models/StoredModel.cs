namespace BimPortal.Api.Models;

public sealed record StoredModel(
    string Id,
    string FileName,
    string ObjectKey,
    string ObjectId,
    string Urn,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
