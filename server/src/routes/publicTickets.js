const express = require("express");
const customerTicketsController = require("../controllers/customerTickets");
const validate = require("../middleware/validate");
const { createLimiter } = require("../middleware/rateLimit");
const { tokenRateLimitKey } = require("../utils/accessToken");
const { tokenParamSchema, createReplySchema } = require("../validators/customerTicketSchemas");

const router = express.Router();

// One bucket per link token, on top of the global /api limit in src/index.js.
const perLinkLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: tokenRateLimitKey,
  message: { error: "Too many requests on this link, please try again later." },
});

router.get(
  "/:token",
  perLinkLimiter,
  validate(tokenParamSchema),
  customerTicketsController.getCustomerTicket,
);
router.post(
  "/:token/replies",
  perLinkLimiter,
  validate(createReplySchema, { status: 422 }),
  customerTicketsController.postCustomerReply,
);

module.exports = router;
