const crypto = require("crypto");
const { z } = require("zod");
const { cleanedText, optionalCleanedText, uppercaseEnum } = require("../../contracts/triageDecision");
const { PRIORITIES, TICKET_TYPES } = require("../../../constants/ticket");

const MAX_SUBJECT_LENGTH = 2000;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_IDENTIFIER_LENGTH = 200;

/**
 * TicketDraft — the closed-world, draft-only payload for create_ticket.
 *
 * Strict so a hijacked model cannot slip status/delete/whitelist-breakers in.
 * description carries extra ticket context; it is sanitized like every other
 * untrusted field and is validated at the registry boundary before the tool runs.
 */
const TicketDraft = z
  .object({
    subject: cleanedText(MAX_SUBJECT_LENGTH, "subject must be a non-empty string"),
    description: optionalCleanedText(MAX_DESCRIPTION_LENGTH),
    type: uppercaseEnum(TICKET_TYPES),
    priority: uppercaseEnum(PRIORITIES),
    assigneeRef: optionalCleanedText(MAX_IDENTIFIER_LENGTH),
  })
  .strict();

const createTicketTool = () => ({
  name: "create_ticket",
  description:
    "Create (draft only — nothing is persisted) a ticket proposal. Args: subject (short, specific summary), description (optional longer context about the ticket), type (TASK|BUG|INCIDENT|REQUEST), priority (LOW|MEDIUM|HIGH|URGENT), assigneeRef (optional, must come from the available assignee pool). Returns a draftId to reference in finalize.",
  kind: "draft",
  inputSchema: TicketDraft,
  run: async (ctx, args) => {
    const { assigneeRef } = args;
    if (assigneeRef && Array.isArray(ctx?.allowedAssignees) && !ctx.allowedAssignees.includes(assigneeRef)) {
      throw new Error(
        `assigneeRef "${assigneeRef}" is not in the allowed assignee pool. Choose one of: ${ctx.allowedAssignees.join(", ") || "none"}.`,
      );
    }
    const draft = { draftId: crypto.randomUUID(), ...args };
    if (ctx?.storeDraft) ctx.storeDraft(draft.draftId, draft);
    return draft;
  },
});

module.exports = { createTicketTool, TicketDraft, MAX_SUBJECT_LENGTH };