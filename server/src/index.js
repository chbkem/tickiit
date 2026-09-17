require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const ticketsRouter = require("./routes/tickets");
const aiTriageRouter = require("./routes/aiTriage");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { clerkMiddleware } = require("@clerk/express");
const logger = require("./lib/logger");

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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
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

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});