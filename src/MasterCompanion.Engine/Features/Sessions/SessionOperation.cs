using System.Text.Json.Serialization;

namespace MasterCompanion.Engine.Features.Sessions;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(CreateSessionOperation), "create")]
[JsonDerivedType(typeof(UpdateSessionOperation), "update")]
[JsonDerivedType(typeof(StartSessionOperation), "start")]
[JsonDerivedType(typeof(CompleteSessionOperation), "complete")]
[JsonDerivedType(typeof(PinSessionMaterialOperation), "pin")]
[JsonDerivedType(typeof(UnpinSessionMaterialOperation), "unpin")]
[JsonDerivedType(typeof(DeleteSessionOperation), "delete")]
public abstract record SessionOperation(Guid SessionId);
