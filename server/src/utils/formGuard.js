const MIN_FILL_MS = 1500;

const isHoneypotFilled = (website) =>
  typeof website === "string" && website.trim() !== "";

const isSubmittedTooFast = (elapsedMs) => {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) return false;
  return elapsedMs < MIN_FILL_MS;
};

module.exports = { MIN_FILL_MS, isHoneypotFilled, isSubmittedTooFast };
