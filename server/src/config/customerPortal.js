const DEFAULT_BASE_URL = "http://localhost:3000";

const customerPortalBaseUrl = ({ env = process.env } = {}) => {
  const configured = env.CUSTOMER_PORTAL_BASE_URL;
  const raw = typeof configured === "string" && configured.trim() ? configured : DEFAULT_BASE_URL;
  return raw.trim().replace(/\/+$/, "");
};

module.exports = { DEFAULT_BASE_URL, customerPortalBaseUrl };
