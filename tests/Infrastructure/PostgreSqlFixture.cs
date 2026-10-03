using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace MasterCompanion.Tests.Infrastructure;

[CollectionDefinition("PostgreSQL")]
public sealed class PostgreSqlCollection : ICollectionFixture<PostgreSqlFixture>;

public sealed class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:18.6")
        .WithDatabase("postgres")
        .WithUsername("test_runner")
        .WithPassword(Guid.NewGuid().ToString("N"))
        .WithCreateParameterModifier(parameters =>
        {
            var portBindings = parameters.HostConfig?.PortBindings
                ?? throw new InvalidOperationException("The PostgreSQL container has no port bindings.");
            foreach (var bindings in portBindings.Values)
                foreach (var binding in bindings) binding.HostIP = "127.0.0.1";
        })
        .Build();

    public async Task InitializeAsync()
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        try
        {
            await container.StartAsync(timeout.Token);
        }
        catch
        {
            await container.DisposeAsync();
            throw;
        }
    }

    public Task DisposeAsync() => container.DisposeAsync().AsTask();

    public async Task<string> CreateDatabaseAsync()
    {
        // Names are generated locally; caller input never enters the SQL identifier.
        var database = "test_" + Guid.NewGuid().ToString("N");
        await using var connection = new NpgsqlConnection(container.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{database}\"", connection);
        await command.ExecuteNonQueryAsync();
        return new NpgsqlConnectionStringBuilder(container.GetConnectionString())
        {
            Database = database,
            ApplicationName = database
        }.ConnectionString;
    }
}
