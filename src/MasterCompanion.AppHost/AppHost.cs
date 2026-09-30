var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("postgres")
    .WithImageTag("18.6")
    .WithDataVolume("mastercompanion-postgres")
    .AddDatabase("mastercompanion");

var api = builder.AddProject<Projects.MasterCompanion_Api>("api")
    .WithReference(database)
    .WaitFor(database);

builder.AddJavaScriptApp("frontend", "../mastercompanion-web")
    .WithPnpm(installArgs: ["--frozen-lockfile", "--offline"])
    .WithRunScript("start")
    .WithHttpEndpoint(port: 4200, env: "PORT")
    .WithEnvironment("API_BASE_URL", api.GetEndpoint("http"))
    .WaitFor(api);

builder.Build().Run();
