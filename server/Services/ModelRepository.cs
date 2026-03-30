using BimPortal.Api.Models;
using Npgsql;

namespace BimPortal.Api.Services;

public sealed class ModelRepository
{
    private readonly string _connectionString;

    public ModelRepository(IConfiguration config)
    {
        _connectionString =
            config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Missing ConnectionStrings:Default for PostgreSQL.");
    }

    public async Task EnsureSchemaAsync(CancellationToken ct)
    {
        const string sql = """
            create table if not exists models (
                id text primary key,
                file_name text not null,
                object_key text not null,
                object_id text not null,
                urn text not null unique,
                status text not null,
                created_at timestamptz not null,
                updated_at timestamptz not null
            );
            """;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpsertAsync(StoredModel model, CancellationToken ct)
    {
        const string sql = """
            insert into models (id, file_name, object_key, object_id, urn, status, created_at, updated_at)
            values (@id, @file_name, @object_key, @object_id, @urn, @status, @created_at, @updated_at)
            on conflict (urn) do update
              set file_name = excluded.file_name,
                  object_key = excluded.object_key,
                  object_id = excluded.object_id,
                  status = excluded.status,
                  updated_at = excluded.updated_at;
            """;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", model.Id);
        cmd.Parameters.AddWithValue("file_name", model.FileName);
        cmd.Parameters.AddWithValue("object_key", model.ObjectKey);
        cmd.Parameters.AddWithValue("object_id", model.ObjectId);
        cmd.Parameters.AddWithValue("urn", model.Urn);
        cmd.Parameters.AddWithValue("status", model.Status);
        cmd.Parameters.AddWithValue("created_at", model.CreatedAt);
        cmd.Parameters.AddWithValue("updated_at", model.UpdatedAt);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<StoredModel>> GetAllAsync(CancellationToken ct)
    {
        const string sql = """
            select id, file_name, object_key, object_id, urn, status, created_at, updated_at
            from models
            order by created_at desc;
            """;

        var list = new List<StoredModel>();
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(ReadModel(reader));
        }

        return list;
    }

    public async Task<StoredModel?> GetByUrnAsync(string urn, CancellationToken ct)
    {
        const string sql = """
            select id, file_name, object_key, object_id, urn, status, created_at, updated_at
            from models
            where urn = @urn;
            """;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("urn", urn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return ReadModel(reader);
    }

    public async Task UpdateStatusAsync(string urn, string status, CancellationToken ct)
    {
        const string sql = """
            update models
            set status = @status,
                updated_at = now()
            where urn = @urn;
            """;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("urn", urn);
        cmd.Parameters.AddWithValue("status", status);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static StoredModel ReadModel(NpgsqlDataReader reader) =>
        new(
            Id: reader.GetString(0),
            FileName: reader.GetString(1),
            ObjectKey: reader.GetString(2),
            ObjectId: reader.GetString(3),
            Urn: reader.GetString(4),
            Status: reader.GetString(5),
            CreatedAt: reader.GetFieldValue<DateTimeOffset>(6),
            UpdatedAt: reader.GetFieldValue<DateTimeOffset>(7)
        );
}
