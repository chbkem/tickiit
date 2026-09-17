require("dotenv").config();
const prisma = require("./lib/prisma");
const clerkClient = require("./lib/clerk");
const logger = require("./lib/logger");
const ticketService = require("./services/ticketService");
const { KeywordKnowledgeRetriever } = require("./ai/knowledge/retriever");
const { createCircuitBreaker } = require("./ai/circuitBreaker");
const { createWorkerHandler } = require("./ai/pipeline/runner");
const { registerIngestWorker, stop } = require("./lib/pgBoss");

const breaker = createCircuitBreaker();

const deps = {
  prisma,
  clerkClient,
  ticketService,
  breaker,
  knowledgeRetriever: new KeywordKnowledgeRetriever({ prisma }),
  env: process.env,
  logger,
};

const shutdown = async (signal) => {
  logger.info(`Worker shutting down (${signal})`);
  try {
    await stop();
  } finally {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  }
};

const main = async () => {
  const handler = createWorkerHandler(deps);
  await registerIngestWorker(handler, { batchSize: 1 });
  logger.info("Ingest worker registered", { queue: "ingest.triage", signal: "SIGTERM/SIGINT to stop" });
};

main().catch((error) => {
  logger.error("Worker failed to start", { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));