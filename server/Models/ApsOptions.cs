namespace BimPortal.Api.Models;

public sealed class ApsOptions
{
    public string ClientId { get; init; } = string.Empty;

    public string ClientSecret { get; init; } = string.Empty;

    // Must be globally unique, 3-128 chars, lowercase letters/numbers/hyphen.
    public string BucketKey { get; init; } = "bim-portal-sample-netko";

    // transient | temporary | persistent
    public string BucketPolicy { get; init; } = "transient";
}
