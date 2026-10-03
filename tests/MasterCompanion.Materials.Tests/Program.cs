using MasterCompanion.Materials.Tests;

try
{
    if (args.Length > 0 && args is not ["--http"])
        throw new InvalidOperationException("Supported test mode: --http.");
    var connection = Environment.GetEnvironmentVariable("MC_MATERIALS_TEST_CONNECTION")
        ?? throw new InvalidOperationException("Set MC_MATERIALS_TEST_CONNECTION to an isolated materials test database.");
    await HttpTests.RunAsync(connection);
}
catch (Exception exception)
{
    var message = exception is InvalidOperationException or ArgumentException
        ? exception.Message : "Unexpected verification failure. Inspect with a local debugger.";
    Console.Error.WriteLine($"Material verification failed ({exception.GetType().Name}): {message}");
    Environment.ExitCode = 1;
}
