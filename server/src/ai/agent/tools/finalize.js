const { z } = require("zod");
const { TriageDecision, Confidence } = require("../../contracts/triageDecision");

const MAX_DRAFT_ID_LENGTH = 200;

/**
 * FinalizeInput — structured confirmation for the agent loop.
 *
 * decision validates against the same TriageDecision contract the apply stage
 * consumes; confidence against the Confidence contract. draftId ties finalize
 * back to a create_ticket draft produced earlier in the same run, so a decision
 * cannot be committed (nor injected) without having passed through the draft tool.
 */
const FinalizeInput = z
  .object({
    draftId: z.string().trim().min(1).max(MAX_DRAFT_ID_LENGTH),
    decision: TriageDecision,
    confidence: Confidence,
  })
  .strict();

const finalizeTool = () => ({
  name: "finalize",
  description:
    "Commit the final triage decision and end the run. Args: draftId from a previous create_ticket call, decision (subject/type/priority/assigneeRef must match the stored draft, plus a rationale), confidence (score 0-1, optional label/reasoning/signals). Returns accepted=true with the confirmed draft.",
  kind: "finalize",
  inputSchema: FinalizeInput,
  run: async (ctx, args) => {
    const draft = ctx?.getDraft ? ctx.getDraft(args.draftId) : null;
    if (!draft) {
      throw new Error(`No draft found for draftId "${args.draftId}". Call create_ticket first.`);
    }
    const { decision: d } = args;
    const mismatches = [];
    if (d.subject !== draft.subject) mismatches.push("subject");
    if (d.type !== draft.type) mismatches.push("type");
    if (d.priority !== draft.priority) mismatches.push("priority");
    if ((d.assigneeRef ?? null) !== (draft.assigneeRef ?? null)) mismatches.push("assigneeRef");

    if (mismatches.length > 0) {
      throw new Error(
        `finalize decision does not match the stored draft on: ${mismatches.join(", ")}. Call create_ticket again with the revised draft.`,
      );
    }
    return { accepted: true, draftId: args.draftId, decision: d, confidence: args.confidence, draft };
  },
});

module.exports = { finalizeTool, FinalizeInput };