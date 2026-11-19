const { tokenHashPrefix } = require("./accessToken");

const TOKEN_IN_PATH = /(\/api\/public\/tickets\/)([A-Za-z0-9_-]{20,512})/g;

const redactTokenInText = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(
    TOKEN_IN_PATH,
    (_match, prefix, token) => `${prefix}[token ${tokenHashPrefix(token)}]`,
  );
};

const redactRequestContext = (context) => {
  if (!context || typeof context !== "object") return context;
  const safe = { ...context };
  safe.url = redactTokenInText(safe.url);
  if (safe.params && typeof safe.params === "object") {
    safe.params = { ...safe.params };
    if (typeof safe.params.token === "string") {
      safe.params.token = `[token ${tokenHashPrefix(safe.params.token)}]`;
    }
  }
  return safe;
};

module.exports = { redactTokenInText, redactRequestContext };
