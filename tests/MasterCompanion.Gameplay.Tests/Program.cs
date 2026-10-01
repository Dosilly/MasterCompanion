using MasterCompanion.Gameplay.Tests;

try
{
    if (args.Length == 0 || args is ["--rules"])
    {
        RulesTests.Run();
    }
    else if (args is ["--persistence"] or ["--http"])
    {
        var connection = Environment.GetEnvironmentVariable("MC_GAMEPLAY_TEST_CONNECTION")
            ?? throw new InvalidOperationException("Set MC_GAMEPLAY_TEST_CONNECTION to an isolated gameplay test database.");
        if (args[0] == "--http") await HttpTests.RunAsync(connection);
        else await PersistenceTests.RunAsync(connection);
    }
    else throw new InvalidOperationException("Supported test modes: --rules, --persistence, --http.");
}
catch (Exception exception)
{
    // Connection strings and SQL diagnostics can contain private data. Keep failure output bounded.
    Console.Error.WriteLine($"Gameplay verification failed ({exception.GetType().Name}): {SafeMessage(exception)}");
    Environment.ExitCode = 1;
}

static string SafeMessage(Exception exception) => exception is InvalidOperationException or ArgumentException
    ? exception.Message : "Unexpected verification failure. Inspect with a local debugger.";
