const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const formService = require("../services/formService");
const ticketService = require("../services/ticketService");
const emailService = require("../services/emailService");
const { resolveRequester } = require("../ai/identity");
const { isHoneypotFilled, isSubmittedTooFast } = require("../utils/formGuard");

const DEFAULT_ORG_NAME = "our support team";

const serializePublicForm = (form) => ({
  publicId: form.publicId,
  name: form.name,
  description: form.description,
  orgName: form.orgName ?? DEFAULT_ORG_NAME,
});

exports.getPublicForm = asyncHandler(async (req, res) => {
  const form = await formService.findActiveFormByPublicId(req.params.publicId);
  if (!form) {
    throw new ApiError(404, "This form is no longer available.");
  }
  res.json(serializePublicForm(form));
});

exports.submitPublicForm = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const { name, email, subject, message, website, elapsedMs } = req.body;

  if (isHoneypotFilled(website)) {
    logger.warn("Public form submission rejected: honeypot filled", {
      publicId,
      ip: req.ip,
    });
    throw new ApiError(400, "Submission rejected.");
  }

  if (isSubmittedTooFast(elapsedMs)) {
    logger.warn("Public form submission rejected: submitted too quickly", {
      publicId,
      ip: req.ip,
    });
    throw new ApiError(400, "Submission rejected.");
  }

  const form = await formService.findActiveFormByPublicId(publicId);
  if (!form) {
    throw new ApiError(404, "This form is no longer available.");
  }

  const identity = await resolveRequester({ name, email });

  const ticket = await ticketService.createTicket({
    data: {
      subject,
      description: message,
      status: "OPEN",
      priority: "MEDIUM",
      type: "TASK",
      source: "FORM",
      orgId: form.orgId,
      formId: form.id,
      requesterId: identity.requesterId,
      requesterKey: identity.requesterKey,
      requesterName: identity.requesterName,
      requesterEmail: identity.requesterEmail,
      assigneeId: null,
    },
  });

  let confirmationSent = false;
  try {
    confirmationSent = await emailService.sendTicketConfirmation({
      to: email,
      name,
      ticket,
      orgName: form.orgName ?? DEFAULT_ORG_NAME,
    });
  } catch (error) {
    logger.error("Failed to send ticket confirmation email", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      errorMessage: error.message,
    });
  }

  logger.info("Ticket created via public form", {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    formId: form.id,
    orgId: form.orgId,
    confirmationSent,
  });

  res.status(201).json({
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    confirmationSent,
  });
});
