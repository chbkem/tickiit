require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const ticketsRouter = require("./routes/tickets");
const aiTriageRouter = require("./routes/aiTriage");
const kbRouter = require("./routes/kb");
const channelsRouter = require("./routes/channels");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { clerkMiddleware } = require("@clerk/express");
const logger = require("./lib/logger");
const { createLimiter } = require("./middleware/rateLimit");
const { assertChannelConfig } = require("./config/channels");
const channelService = require("./services/channelService");

const app = express();
const PORT = process.env.PORT || 5000;

const configureCors = () => {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configuredOrigins.length
    ? configuredOrigins
    : ["http://localhost:3000", "http://127.0.0.1:3000"];
  if (process.env.NODE_ENV === "production" && !configuredOrigins.length) {
    logger.warn(
      "CORS_ORIGINS is not set in production; falling back to localhost-only origins. " +
        "Set CORS_ORIGINS to your frontend origin(s).",
    );
  }
  return cors({ origin: origins, credentials: true });
};

app.use(helmet());
app.use(configureCors());
app.use(express.json({ limit: "16kb" }));

const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

app.use(clerkMiddleware());

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.http("HTTP request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    });
  });
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Ticketing Dashboard API" });
});

app.use("/api/tickets", ticketsRouter);
app.use("/api/ai/triage", aiTriageRouter);
app.use("/api/kb", kbRouter);
app.use("/api/channels", channelsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

/**
 * Telegram channel startup checks (spec 0003).
 *
 * A present but malformed CHANNEL_ENCRYPTION_KEY or CHANNEL_PUBLIC_BASE_URL
 * throws here rather than at the first connect attempt, because a value that
 * exists and is wrong is a misconfiguration. A missing one only warns: the rest
 * of the API works without it, and the token endpoints answer 503 with a clear
 * message.
 *
 * The decrypt sweep then marks any channel stranded by a rotated key as ERROR,
 * so a key change is visible in the dashboard rather than discovered on the
 * next reply.
 */
const channelStartup = async () => {
  try {
    const { encryptionKey, missing } = assertChannelConfig();
    if (missing.length > 0) {
      logger.warn(
        `Telegram bot channels are not fully configured: ${missing.join(", ")} not set. ` +
          "Email intake is unaffected; connecting a Telegram bot will fail until these are set.",
      );
      return;
    }

    const marked = await channelService.sweepUndecryptableChannels({ key: encryptionKey });
    if (marked > 0) {
      logger.warn(
        `${marked} Telegram channel(s) were marked ERROR because their stored token could not be decrypted with the current CHANNEL_ENCRYPTION_KEY.`,
      );
    }
  } catch (error) {
    logger.error("Channel configuration is invalid; Telegram bot channels are disabled", {
      errorMessage: error.message,
    });
  }
};

channelStartup();