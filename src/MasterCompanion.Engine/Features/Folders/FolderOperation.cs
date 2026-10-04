using System.Text.Json.Serialization;

namespace MasterCompanion.Engine.Features.Folders;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(RenameFolderOperation), "rename")]
[JsonDerivedType(typeof(MoveFolderOperation), "move")]
public abstract record FolderOperation(string FolderId);
