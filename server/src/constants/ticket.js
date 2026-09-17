module.exports = Object.freeze({
  STATUSES: Object.freeze(["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"]),
  PRIORITIES: Object.freeze(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  TICKET_TYPES: Object.freeze(["TASK", "BUG", "INCIDENT", "REQUEST"]),
  DEFAULT_SOURCE: "API",
});