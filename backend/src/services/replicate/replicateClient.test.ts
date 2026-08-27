import assert from "node:assert/strict";
import { getSafeReplicateErrorDetails, ReplicateClient } from "./replicateClient";

async function run(): Promise<void> {
  let calls = 0;
  const waits: number[] = [];
  const client = new ReplicateClient(
    {
      async run() {
        calls += 1;
        if (calls === 1) {
          throw {
            status: 429,
            message: "429 Too Many Requests — Authorization: Bearer r8_very_secret_token",
            headers: { "retry-after": "0" },
          };
        }
        return ["https://example.test/generated.webp"];
      },
    },
    async (milliseconds) => {
      waits.push(milliseconds);
    },
  );

  const result = await client.generateImage({ prompt: "Editorial barber image", aspectRatio: "16:9" });
  assert.equal(calls, 2, "Un 429 doit provoquer une seule nouvelle tentative.");
  assert.deepEqual(waits, [0], "Le délai Retry-After doit être respecté avant le retry.");
  assert.equal(result.imageUrl, "https://example.test/generated.webp");

  const details = getSafeReplicateErrorDetails({
    status: 429,
    message: "Authorization: Bearer r8_very_secret_token ; REPLICATE_API_TOKEN=r8_very_secret_token",
    headers: { "retry-after": "10" },
  });
  assert.equal(details.status, 429);
  assert.equal(details.retryAfterSeconds, 10);
  assert(!details.message.includes("r8_very_secret_token"), "Un jeton ne doit jamais apparaître dans le résumé de log.");
  assert(details.message.includes("[REDACTED]"), "Le résumé doit indiquer qu’une donnée sensible a été masquée.");

  console.log("✅ replicateClient: retry 429 et redaction des secrets validés");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Échec du test replicateClient");
  process.exitCode = 1;
});
