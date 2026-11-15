const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_TEXT_CHARS = 1_000_000;

const readPositiveInt = ({ env, name, fallback }) => {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
};

const getKnowledgeConfig = (env = process.env) => ({
  maxUploadBytes: readPositiveInt({
    env,
    name: "KB_MAX_UPLOAD_BYTES",
    fallback: DEFAULT_MAX_UPLOAD_BYTES,
  }),
  maxTextChars: readPositiveInt({
    env,
    name: "KB_MAX_TEXT_CHARS",
    fallback: DEFAULT_MAX_TEXT_CHARS,
  }),
});

module.exports = {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_TEXT_CHARS,
  getKnowledgeConfig,
};
