using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace MasterCompanion.Engine.Features.Folders;

internal static class FolderRequestDecoder
{
    private const int MaxRequestBytes = 8_192;
    internal const long MaxRevision = 9_007_199_254_740_991;
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        AllowOutOfOrderMetadataProperties = true,
        MaxDepth = 4
    };

    internal abstract record Result;
    internal sealed record Accepted(FolderOperationRequest Request) : Result;
    internal sealed record Rejected(int Status, string Code) : Result;

    internal static async Task<Result> ReadAsync(HttpRequest httpRequest, CancellationToken token)
    {
        if (!httpRequest.HasJsonContentType())
        {
            return new Rejected(415, "folder_json_required");
        }
        if (httpRequest.ContentLength > MaxRequestBytes)
        {
            return new Rejected(413, "folder_request_too_large");
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
            return new Rejected(413, "folder_request_too_large");
        }

        FolderOperationRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<FolderOperationRequest>(buffer.AsSpan(0, length), JsonOptions);
        }
        catch (JsonException)
        {
            return new Rejected(400, "invalid_folder_operation");
        }
        catch (NotSupportedException)
        {
            return new Rejected(400, "invalid_folder_operation");
        }
        if (request is null || request.RequestId == Guid.Empty || request.ExpectedRevision is < 0 or > MaxRevision)
        {
            return new Rejected(400, "invalid_folder_operation");
        }

        var validOperation = request.Operation switch
        {
            RenameFolderOperation rename => ValidId(rename.FolderId) && rename.Title.Trim().Length is >= 1 and <= 300 &&
                !rename.Title.Any(char.IsControl),
            ReorderMaterialOperation reorder => ValidId(reorder.MaterialId) &&
                (reorder.FolderId is null || ValidId(reorder.FolderId)) &&
                (reorder.BeforeId is null || ValidId(reorder.BeforeId)),
            MoveFolderOperation move => ValidId(move.FolderId) && (move.ParentId is null || ValidId(move.ParentId)) &&
                (move.BeforeId is null || ValidId(move.BeforeId)),
            _ => false
        };
        return validOperation ? new Accepted(request) : new Rejected(400, "invalid_folder_operation");
    }

    private static bool ValidId(string id) => id.Length is >= 1 and <= 80 &&
        id == id.Trim() && !id.Any(char.IsControl);
}
