using System.Text.Json;

namespace MasterCompanion.Contracts;

public sealed record GameSnapshot(long TimeMinutes, IReadOnlyList<GameCharacter> Party,
    IReadOnlyList<long> RestEnds, int ModuleSchemaVersion, JsonElement ModuleState);
