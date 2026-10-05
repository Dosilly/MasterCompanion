using System.Text.Json.Serialization;

namespace MasterCompanion.Engine.Features.Folders;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(RenameFolderOperation), "rename")]
[JsonDerivedType(typeof(MoveFolderOperation), "move")]
[JsonDerivedType(typeof(ReorderMaterialOperation), "reorderMaterial")]
[JsonDerivedType(typeof(MoveMaterialOperation), "moveMaterial")]
public abstract record FolderOperation;
