using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace MasterCompanion.Engine.Features.Gameplay;

public static class GameplayEndpoints
{
    private const int MaxRequestBytes = 65_536;

    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/game", async (Guid campaignId,
            GameplayService service, CancellationToken token) => ToResult(await service.ReadAsync(campaignId, token)));
        endpoints.MapPost("/api/campaigns/{campaignId:guid}/game/operations", async (Guid campaignId,
            HttpRequest httpRequest, GameplayService service, CancellationToken token) =>
        {
            if (!httpRequest.HasJsonContentType())
            {
                return ToResult(new(415, "game_json_required"));
            }

            if (httpRequest.ContentLength > MaxRequestBytes)
            {
                return ToResult(new(413, "game_request_too_large"));
            }

            var buffer = new byte[MaxRequestBytes + 1];
            var length = 0;
            while (length < buffer.Length)
            {
                var read = await httpRequest.Body.ReadAsync(buffer.AsMemory(length), token);
                if (read == 0)
                {
                    break;
                }

                length += read;
            }
            if (length > MaxRequestBytes)
            {
                return ToResult(new(413, "game_request_too_large"));
            }

            GameOperationRequest? request;
            try { request = JsonSerializer.Deserialize<GameOperationRequest>(buffer.AsSpan(0, length), GameSnapshotCodec.JsonOptions); }
            catch (JsonException) { return ToResult(new(400, "invalid_game_operation")); }
            if (request is null)
            {
                return ToResult(new(400, "invalid_game_operation"));
            }

            return ToResult(await service.ExecuteAsync(campaignId, request, token));
        });
    }

    private static IResult ToResult(GameExecution execution) => execution.Response is { } response
        ? Results.Ok(response)
        : Results.Problem(statusCode: execution.StatusCode, title: "Game operation could not be completed",
            extensions: new Dictionary<string, object?> { ["code"] = execution.Code });
}
