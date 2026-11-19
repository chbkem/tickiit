const express = require("express");
const customerTicketsController = require("../controllers/customerTickets");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const { ticketIdParamSchema } = require("../validators/customerTicketSchemas");

const router = express.Router({ mergeParams: true });

const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);

router.delete(
  "/",
  writeLimiter,
  validate(ticketIdParamSchema),
  customerTicketsController.revokeCustomerLinks,
);

module.exports = router;
