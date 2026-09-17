const path = require("path");
const fs = require("fs");
const { createLogger, format, transports } = require("winston");

const isProd = process.env.NODE_ENV === "production";
const LOG_DIR = path.join(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

const redactSensitive = format((info) => {
  const sanitize = (value) => {
    if (typeof value !== "string") return value;
    return value
      .replace(/postgresql:\/\/[^\s"']+/g, "postgresql://***:***@***")
      .replace(/\b(sk|pk)_(test|live)_[A-Za-z0-9_]+/g, "$1_***");
  };

  info.message = sanitize(info.message);
  if (info.stack) info.stack = sanitize(info.stack);
  for (const key of Object.keys(info)) {
    if (/secret|token|password|database_url|direct_url/i.test(key)) info[key] = sanitize(info[key]);
  }
  return info;
});

const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  redactSensitive(),
  format.json(),
);

const devFormat = format.combine(
  format.timestamp({ format: "HH:mm:ss" }),
  format.errors({ stack: true }),
  redactSensitive(),
  format.colorize(),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const stackStr = stack ? `\n${stack}` : "";
    return `${timestamp} ${level}: ${message}${metaStr}${stackStr}`;
  }),
);

if (isProd) fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = createLogger({
  level: isProd ? "info" : "debug",
  format: isProd ? prodFormat : devFormat,
  transports: isProd
    ? [
        new transports.File({
          filename: LOG_FILE,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
        }),
      ]
    : [new transports.Console()],
});

module.exports = logger;