import { runBenchmarkCli } from "../lib/intelligenceV2/benchmarkCli";

async function main() {
  const execution = await runBenchmarkCli(
    process.argv.slice(2),
  );

  for (const result of execution.results) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exitCode = execution.exitCode;
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
});

