const sanitizeHtml = require("sanitize-html");

const SANITIZE_OPTIONS = { allowedTags: [], allowedAttributes: {}, allowedSchemes: [] };

const sanitizeText = (value) => {
  if (typeof value !== "string") return value;
  return sanitizeHtml(value, SANITIZE_OPTIONS).replace(/&nbsp;/g, " ").trim();
};

module.exports = { sanitizeText, SANITIZE_OPTIONS };