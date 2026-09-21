/**
 * Manual smoke test for POST /api/ai/triage (npm run test:api).
 *
 * Prints a dry-run payload by default; pass `--send` to perform a live POST.
 *
 *   node scripts/test-ai-triage.js            # print body only
 *   node scripts/test-ai-triage.js --send     # POST to a running server
 *
 * Uses API_BASE_URL (default http://localhost:5000) and AI_INGEST_TOKEN from
 * the environment. The token can be generated with npm run token:generate.
 */
const crypto = require("crypto");

const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";
const token = process.env.AI_INGEST_TOKEN;
const send = process.argv.includes("--send");

const payload = {
  channel: "test",
  requesterRef: `test_${crypto.randomBytes(6).toString("hex")}`,
  name: "Test Runner",
  email: "test-runner@example.com",
  raw: {
    subject: "Login button is broken",
    body: "Clicking the login button does nothing this morning.",
  },
};

if (!token) {
  console.error("Set AI_INGEST_TOKEN in the environment first (npm run token:generate).");
  process.exit(1);
}

if (!send) {
  console.log("Dry-run payload (pass --send to POST to the server):");
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

(async () => {
  let res;
  try {
    res = await fetch(`${baseUrl}/api/ai/triage`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(`Could not reach ${baseUrl}: ${error.message}`);
    process.exit(1);
  }

  const body = await res.json();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${body.error ?? res.statusText}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ticketNumber: body.ticket?.ticketNumber,
        requesterKind: body.requester?.kind,
        stages: body.stages.map((stage) => `${stage.stage}:${stage.kind}`),
        totalTokens: body.usage?.totalTokens,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});