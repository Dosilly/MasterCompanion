using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Assets;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Features.Workspace;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn;
using MasterCompanion.Modules.Ythryn.Gameplay;
using MasterCompanion.ServiceDefaults;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<ICampaignModule, YthrynModule>();
builder.Services.AddSingleton<ICampaignGameRules, YthrynGameRules>();
builder.Services.AddScoped<GameplayService>();
var connectionString = builder.Configuration.GetConnectionString("mastercompanion")
    ?? throw new InvalidOperationException("The database connection string is missing. Configure ConnectionStrings__mastercompanion or start through MasterCompanion.AppHost.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();
app.UseExceptionHandler();
if (Directory.Exists(app.Environment.WebRootPath))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    // Missing API routes must not return the SPA document with a success status.
    app.MapFallback("/api/{**path}", () => Results.NotFound());
    app.MapFallbackToFile("index.html");
}
app.MapDefaultEndpoints();
GetWorkspace.Map(app);
GetMaterial.Map(app);
SaveMaterial.Map(app);
CreateMaterial.Map(app);
SearchMaterials.Map(app);
GetAsset.Map(app);
GameplayEndpoints.Map(app);

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await CampaignInitializer.ApplyAsync(db, scope.ServiceProvider.GetServices<ICampaignModule>());
}

await app.RunAsync();

namespace MasterCompanion.Api
{
    public partial class Program;
}
