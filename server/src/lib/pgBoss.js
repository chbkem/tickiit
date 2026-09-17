const PgBoss = require("pg-boss");

const DLQ_NAME = "ingest.triage.dead";
const MAIN_QUEUE = "ingest.triage";
const MAX_RETRY_LIMIT = 4;
const DEFAULT_RETRY_DELAY = 5;
const DEFAULT_RETRY_BACKOFF = true;
const DEFAULT_EXPIRE_IN_SECONDS = 300;
const DEFAULT_DEAD_LETTER = DLQ_NAME;

let boss = null;

const ensureQueue = async (b) => {
  await b.createQueue(DLQ_NAME, { policy: "default" });
  await b.createQueue(MAIN_QUEUE, {
    policy: "exclusive",
    deadLetter: DEFAULT_DEAD_LETTER,
  });
};

const getBoss = async () => {
  if (boss) return boss;
  const connectionString = process.env.PGBOSS_CONNECTION_STRING || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("PgBoss requires PGBOSS_CONNECTION_STRING or DIRECT_URL to connect.");
  }
  boss = new PgBoss({ connectionString, schema: "pgboss" });
  await boss.start();
  await ensureQueue(boss);
  return boss;
};

const enqueueIngest = async ({ ingestionEventId, channel, externalId }) => {
  const b = await getBoss();
  const singletonKey = `${channel}:${externalId}`;
  const jobId = await b.send(MAIN_QUEUE, { ingestionEventId }, {
    singletonKey,
    retryLimit: MAX_RETRY_LIMIT,
    retryDelay: DEFAULT_RETRY_DELAY,
    retryBackoff: DEFAULT_RETRY_BACKOFF,
    expireInSeconds: DEFAULT_EXPIRE_IN_SECONDS,
    deadLetter: DEFAULT_DEAD_LETTER,
  });
  return { jobId, enqueued: jobId != null };
};

const registerIngestWorker = async (handler, { batchSize = 1 } = {}) => {
  const b = await getBoss();
  return b.work(MAIN_QUEUE, { batchSize }, handler);
};

const stop = async () => {
  if (!boss) return;
  try {
    await boss.stop();
  } finally {
    boss = null;
  }
};

module.exports = {
  getBoss,
  enqueueIngest,
  registerIngestWorker,
  stop,
  DLQ_NAME,
  MAIN_QUEUE,
  MAX_RETRY_LIMIT,
  DEFAULT_RETRY_DELAY,
  DEFAULT_RETRY_BACKOFF,
  DEFAULT_EXPIRE_IN_SECONDS,
};