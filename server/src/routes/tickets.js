const express = require("express");
const ticketsController = require("../controllers/tickets");
const ticketCommentsRouter = require("./ticketComments");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const {
  idParamSchema,
  createTicketSchema,
  updateTicketSchema,
} = require("../validators/ticketSchemas");

const router = express.Router();

const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);

router.get("/", ticketsController.getTickets);
router.get("/:id", validate(idParamSchema), ticketsController.getTicketById);
router.post("/", writeLimiter, validate(createTicketSchema), ticketsController.createTicket);
router.patch("/:id", writeLimiter, validate(updateTicketSchema), ticketsController.updateTicket);
router.delete("/:id", writeLimiter, validate(idParamSchema), ticketsController.deleteTicket);

router.use("/:ticketId/comments", ticketCommentsRouter);

module.exports = router;