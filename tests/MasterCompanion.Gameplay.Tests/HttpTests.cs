using System.Net;
using System.Text;
using System.Text.Json;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn.Gameplay;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace MasterCompanion.Gameplay.Tests;

public static class HttpTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task RunAsync(string connectionString)
    {
        if (new NpgsqlConnectionStringBuilder(connectionString).Database != "mastercompanion_gameplay_test")
            throw new InvalidOperationException("HTTP tests require an isolated mastercompanion_gameplay_test database.");

        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        builder.Services.AddSingleton<ICampaignGameRules, YthrynGameRules>();
        builder.Services.AddScoped<GameplayService>();
        await using var app = builder.Build();
        GameplayEndpoints.Map(app);
        var campaignId = Guid.NewGuid();
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
            db.Campaigns.Add(new Campaign { Id = campaignId, Title = "HTTP boundary specimen", ModuleId = "ythryn", ModuleVersion = "1.0.0" });
            await db.SaveChangesAsync();
        }

        await app.StartAsync();
        try
        {
            var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()
                ?? throw new InvalidOperationException("The HTTP test server has no bound address.");
            using var client = new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) };
            var path = $"/api/campaigns/{campaignId:D}/game";
            var characterId = Guid.NewGuid();
            var requestId = Guid.NewGuid();
            var validPrefix = $"\"requestId\":\"{requestId:D}\",\"expectedRevision\":0,";
            var validParty = $"[{{\"id\":\"{characterId:D}\",\"name\":\"HTTP character\"}}]";
            var inputs = new[]
            {
                "{", "null", "[]", "{}",
                "{" + validPrefix + "\"kind\":\"unknown\"}",
                "{" + validPrefix + "\"kind\":\"updateParty\"}",
                "{" + validPrefix + "\"kind\":\"updateParty\",\"party\":" + validParty + ",\"minutes\":1}",
                "{" + validPrefix + "\"kind\":\"updateParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\" \"}]}",
                "{" + validPrefix + "\"kind\":\"shortRest\",\"minutes\":60}",
                "{" + validPrefix + "\"kind\":\"shortRest\",\"command\":{}}",
                "{\"expectedRevision\":0,\"kind\":\"configureParty\",\"party\":" + validParty + "}",
                $"{{\"requestId\":\"{requestId:D}\",\"kind\":\"configureParty\",\"party\":{validParty}}}",
                $"{{\"requestId\":\"{requestId:D}\",\"expectedRevision\":\"0\",\"kind\":\"configureParty\",\"party\":{validParty}}}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":" + validParty + ",\"unknown\":true}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\"HTTP character\",\"unknown\":true}]}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"invalid-id\",\"name\":\"Character\"}]}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[null]}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":null}]}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":" + validParty + ",\"expectedRevision\":1}",
                "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\"Character\",\"name\":\"Different\"}]}",
                "{" + validPrefix + "\"kind\":\"module\",\"command\":{\"kind\":\"healCharacter\",\"kind\":\"resolveCheck\"}}",
                "{" + validPrefix + "\"kind\":\"module\",\"command\":{\"kind\":\"healCharacter\",\"characterId\":\"" + characterId.ToString("D") +
                    "\",\"nested\":" + new string('[', 20) + "0" + new string(']', 20) + "}}"
            };
            foreach (var input in inputs)
            {
                using var content = new StringContent(input, Encoding.UTF8, "application/json");
                using var response = await client.PostAsync(path + "/operations", content);
                await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_game_operation");
                await AssertNoGameplayWritesAsync(app.Services, campaignId);
            }

            using (var content = new StringContent("{}", Encoding.UTF8, "text/plain"))
            using (var response = await client.PostAsync(path + "/operations", content))
                await AssertProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "game_json_required");

            var oversized = new string(' ', 65_537);
            using (var content = new StringContent(oversized, Encoding.UTF8, "application/json"))
            using (var response = await client.PostAsync(path + "/operations", content))
                await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "game_request_too_large");

            using (var content = new UnknownLengthJsonContent(Encoding.UTF8.GetBytes(oversized)))
            using (var response = await client.PostAsync(path + "/operations", content))
                await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "game_request_too_large");
            await AssertNoGameplayWritesAsync(app.Services, campaignId);

            using (var response = await client.GetAsync(path))
            {
                var state = await ReadSuccessAsync(response);
                Require(state.Revision == 0 && state.Snapshot.Party.Count == 0,
                    "HTTP GET must expose the unconfigured revision without writing state.");
            }
            await AssertNoGameplayWritesAsync(app.Services, campaignId);

            var configure = new GameOperationRequest(Guid.NewGuid(), 0, "configureParty", [new(characterId, "HTTP character")]);
            var configured = await PostSuccessAsync(client, path, configure);
            Require(configured.Revision == 1 && configured.Snapshot.Party.Single().Id == characterId,
                "The HTTP endpoint must persist a valid typed party configuration.");
            var advance = new GameOperationRequest(Guid.NewGuid(), 1, "advanceTime", Minutes: 30);
            var advanced = await PostSuccessAsync(client, path, advance);
            Require(advanced.Revision == 2 && advanced.Snapshot.TimeMinutes == 30,
                "A valid HTTP time operation must return its confirmed revision and time.");
            using (var response = await client.GetAsync(path))
            {
                var read = await ReadSuccessAsync(response);
                Require(read.Revision == advanced.Revision && read.Snapshot.TimeMinutes == advanced.Snapshot.TimeMinutes,
                    "HTTP GET in a separate scope must read the confirmed operation.");
            }
            using (var content = new StringContent(JsonSerializer.Serialize(advance with { RequestId = Guid.NewGuid() }, JsonOptions), Encoding.UTF8, "application/json"))
            using (var response = await client.PostAsync(path + "/operations", content))
                await AssertProblemAsync(response, HttpStatusCode.Conflict, "game_revision_conflict");

            var shortRest = await PostSuccessAsync(client, path,
                new GameOperationRequest(Guid.NewGuid(), advanced.Revision, "shortRest"));
            Require(shortRest.Revision == 3 && shortRest.Snapshot.TimeMinutes == 90 && shortRest.Snapshot.RestEnds.Count == 0,
                "A typed HTTP short rest must advance sixty minutes without recording a completed long rest.");
            var renameRequest = new GameOperationRequest(Guid.NewGuid(), shortRest.Revision, "updateParty",
                [new(characterId, "Renamed HTTP character")]);
            var renamed = await PostSuccessAsync(client, path, renameRequest);
            Require(renamed.Revision == 4 && renamed.Snapshot.Party.Single().Id == characterId &&
                renamed.Snapshot.Party.Single().Name == "Renamed HTTP character" &&
                JsonElement.DeepEquals(renamed.Snapshot.ModuleState, shortRest.Snapshot.ModuleState),
                "The HTTP party editor must retain identity and module state while changing a name.");
            var empty = await PostSuccessAsync(client, path,
                new GameOperationRequest(Guid.NewGuid(), renamed.Revision, "updateParty", []));
            Require(empty.Revision == 5 && empty.Snapshot.Party.Count == 0 && empty.Snapshot.TimeMinutes == 90,
                "An explicit empty HTTP roster must retain nonzero game time.");
            var replayed = await PostSuccessAsync(client, path, renameRequest);
            Require(replayed.Revision == renamed.Revision &&
                JsonElement.DeepEquals(JsonSerializer.SerializeToElement(replayed), JsonSerializer.SerializeToElement(renamed)),
                "Replaying a party edit through HTTP must return its original confirmed receipt.");
            using (var response = await client.GetAsync(path))
            {
                var read = await ReadSuccessAsync(response);
                Require(read.Revision == empty.Revision && read.Snapshot.Party.Count == 0,
                    "An old party receipt must not overwrite the latest persisted HTTP roster.");
            }
            var restored = await PostSuccessAsync(client, path,
                new GameOperationRequest(Guid.NewGuid(), empty.Revision, "undo"));
            Require(restored.Revision == 6 && JsonElement.DeepEquals(JsonSerializer.SerializeToElement(restored.Snapshot),
                JsonSerializer.SerializeToElement(renamed.Snapshot)),
                "HTTP undo must restore the roster and owned module state removed by the latest party operation.");
            using (var response = await client.GetAsync($"/api/campaigns/{Guid.NewGuid():D}/game"))
                await AssertProblemAsync(response, HttpStatusCode.NotFound, "campaign_not_found");

            Console.WriteLine("HTTP gameplay tests passed: strict JSON, media and size limits, ProblemDetails, isolated writes, party editing, short rest, receipts and undo.");
        }
        finally
        {
            await app.StopAsync();
        }
    }

    private static async Task AssertNoGameplayWritesAsync(IServiceProvider services, Guid campaignId)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Require(!await db.GameStates.AnyAsync(x => x.CampaignId == campaignId) &&
            !await db.GameOperations.AnyAsync(x => x.CampaignId == campaignId),
            "Rejected HTTP input and unconfigured reads must not persist gameplay state or journal rows.");
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Require(response.StatusCode == status && response.Content.Headers.ContentType?.MediaType == "application/problem+json",
            $"Expected ProblemDetails status {(int)status}, received {(int)response.StatusCode}.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var problem = document.RootElement;
        Require(problem.GetProperty("status").GetInt32() == (int)status && problem.GetProperty("code").GetString() == code &&
            problem.GetProperty("title").GetString() is { Length: > 0 } && !problem.TryGetProperty("exception", out _),
            $"Expected stable ProblemDetails error code {code} without exception diagnostics.");
    }

    private static async Task<GameStateResponse> PostSuccessAsync(HttpClient client, string path, GameOperationRequest request)
    {
        using var content = new StringContent(JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(path + "/operations", content);
        return await ReadSuccessAsync(response);
    }

    private static async Task<GameStateResponse> ReadSuccessAsync(HttpResponseMessage response)
    {
        Require(response.StatusCode == HttpStatusCode.OK, $"Expected a successful HTTP game response, received {(int)response.StatusCode}.");
        return JsonSerializer.Deserialize<GameStateResponse>(await response.Content.ReadAsStringAsync(), JsonOptions)
            ?? throw new InvalidOperationException("A successful HTTP response must contain a game state.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private sealed class UnknownLengthJsonContent : HttpContent
    {
        private readonly byte[] bytes;

        public UnknownLengthJsonContent(byte[] bytes)
        {
            this.bytes = bytes;
            Headers.ContentType = new("application/json");
        }

        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(bytes).AsTask();
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
    }
}
