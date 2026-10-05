using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace MasterCompanion.Engine.Features.Sessions;

internal static class SessionRequestDecoder
{
    internal const long MaxRevision = 9_007_199_254_740_991;
    private const int MaxRequestBytes = 262_144;
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        AllowOutOfOrderMetadataProperties = true,
        MaxDepth = 8
    };

    internal abstract record Result;
    internal sealed record Accepted(SessionOperationRequest Request) : Result;
    internal sealed record Rejected(int Status, string Code) : Result;

    internal static async Task<Result> ReadAsync(HttpRequest httpRequest, CancellationToken token)
    {
        if (!httpRequest.HasJsonContentType())
        {
            return new Rejected(415, "session_json_required");
        }
        if (httpRequest.ContentLength > MaxRequestBytes)
        {
            return new Rejected(413, "session_request_too_large");
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
            return new Rejected(413, "session_request_too_large");
        }
        SessionOperationRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<SessionOperationRequest>(buffer.AsSpan(0, length), JsonOptions);
        }
        catch (Exception error) when (error is JsonException or NotSupportedException)
        {
            return new Rejected(400, "invalid_session_operation");
        }
        if (request is null || request.RequestId == Guid.Empty ||
            request.ExpectedRevision is < 0 or >= MaxRevision || request.Operation is null ||
            request.Operation.SessionId == Guid.Empty)
        {
            return new Rejected(400, "invalid_session_operation");
        }
        var valid = request.Operation switch
        {
            CreateSessionOperation create => ValidTitle(create.Title) && ValidTitle(create.PreparationTitle) && ValidTitle(create.NotesTitle),
            UpdateSessionOperation update => ValidTitle(update.Title) && ValidText(update.Summary) && ValidText(update.FollowUp),
            PinSessionMaterialOperation pin => ValidMaterialId(pin.MaterialId),
            UnpinSessionMaterialOperation unpin => ValidMaterialId(unpin.MaterialId),
            StartSessionOperation or CompleteSessionOperation or DeleteSessionOperation => true,
            _ => false
        };
        return valid ? new Accepted(request) : new Rejected(400, "invalid_session_operation");
    }

    private static bool ValidTitle(string value) => value.Trim().Length is >= 1 and <= 300 && !value.Any(char.IsControl);
    private static bool ValidText(string value) => value.Length <= 20_000 &&
        !value.Any(character => char.IsControl(character) && character is not ('\n' or '\r' or '\t'));
    private static bool ValidMaterialId(string value) => value.Length is >= 1 and <= 80 &&
        !value.Any(character => char.IsWhiteSpace(character) || char.IsControl(character) || "/\\?#".Contains(character));
}
