using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace MasterCompanion.Gameplay.Tests.Integration;

public sealed class CampaignApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:mastercompanion", connectionString);
        // Database fault tests must not write connection/SQL diagnostics to runner output.
        builder.ConfigureLogging(logging => logging.ClearProviders());
    }
}
