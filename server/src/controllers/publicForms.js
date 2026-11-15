const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const formService = require("../services/formService");
const ticketService = require("../services/ticketService");
const emailService = require("../services/emailService");
const attemptService = require("../services/attemptService");
const { resolveRequester } = require("../ai/identity");
const { signFormToken } = require("../spam/formToken");
const { formTokenSecret } = require("../spam/config");
const { FORM_TOKEN_TTL_MS } = require("../spam/spamRules");
const { evaluateSubmission } = require("../spam/guard");
const { createPowChallenge } = require("../spam/altcha");

const DEFAULT_ORG_NAME = "our support team";

const serializePublicForm = (form) => ({
  publicId: form.publicId,
  name: form.name,
  description: form.description,
  orgName: form.orgName ?? DEFAULT_ORG_NAME,
  formToken: signFormToken(
    { publicId: form.publicId, issuedAt: Date.now() },
    formTokenSecret(),
  ),
});

const requireActiveForm = async (publicId) => {
  const form = await formService.findActiveFormByPublicId(publicId);
  if (!form) {
    throw new ApiError(404, "This form is no longer available.");
  }
  return form;
};

exports.getPublicForm = asyncHandler(async (req, res) => {
  const form = await requireActiveForm(req.params.publicId);
  res.json(serializePublicForm(form));
});

exports.getChallenge = asyncHandler(async (req, res) => {
  await requireActiveForm(req.params.publicId);
  const challenge = await createPowChallenge();
  res.json(challenge);
});

exports.submitPublicForm = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const body = req.body;

  const form = await requireActiveForm(publicId);

  const decision = await evaluateSubmission({ form, body, ip: req.ip });

  const attemptData = {
    formId: form.id,
    publicId: form.publicId,
    ipHash: decision.ipHash,
    emailHash: decision.emailHash,
    emailDomain: decision.emailDomain,
    bodyHash: decision.bodyHash,
    verdict: decision.verdict,
    score: decision.score ?? 0,
    reasons: decision.reasons ?? [],
  };

  if (decision.verdict === "REJECTED") {
    await attemptService.recordAttempt(attemptData);
    logger.warn("Public form submission rejected", {
      publicId,
      reason: decision.reasons[0],
    });
    throw new ApiError(decision.status, decision.message);
  }

  const quarantined = decision.verdict === "QUARANTINED";

  const identity = await resolveRequester({ name: body.name, email: body.email });

  const ticket = await ticketService.createTicket({
    data: {
      subject: body.subject,
      description: body.message,
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
      isSpam: quarantined,
      spamScore: quarantined ? decision.score : 0,
      spamReasons: quarantined ? decision.reasons : [],
      quarantinedAt: quarantined ? new Date() : null,
    },
  });

  await attemptService.recordAttempt({ ...attemptData, ticketId: ticket.id });

  if (quarantined) {
    logger.warn("Public form submission quarantined", {
      ticketId: ticket.id,
      publicId,
      reasons: decision.reasons,
      score: decision.score,
    });
    return res.status(201).json({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      confirmationSent: false,
    });
  }

  let confirmationSent = false;
  try {
    confirmationSent = await emailService.sendTicketConfirmation({
      to: body.email,
      name: body.name,
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
