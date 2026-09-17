const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const { runTriage } = require("../ai/pipeline/runTriage");

exports.triage = asyncHandler(async (req, res) => {
  const result = await runTriage({ input: req.body });

  logger.info("Triage request completed", {
    ticketId: result.ticket.id,
    ticketNumber: result.ticket.ticketNumber,
    stages: result.stages.map((stage) => `${stage.stage}:${stage.kind}`).join(","),
    usage: result.usage.totalTokens,
  });

  res.status(201).json(result);
});