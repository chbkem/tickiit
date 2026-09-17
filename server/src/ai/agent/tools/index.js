const { requesterContextTool } = require("./requesterContext");
const { knowledgeSearchTool } = require("./knowledgeSearch");
const { agentPoolTool } = require("./agentPool");
const { orgPolicyTool } = require("./orgPolicy");

/**
 * createContextTools — the read-tool battery bound to the injected service
 * interfaces. Each factory reads its own dependency from `deps`, so wiring the
 * whole set is a single call:
 *
 *   new ToolRegistry([
 *     ...createContextTools({
 *       requesterStore,
 *       knowledgeRetriever,
 *       agentPoolService,
 *       orgPolicyService,
 *     }),
 *     createTicketTool(),
 *     finalizeTool(),
 *   ])
 */
const createContextTools = (deps = {}) => [
  requesterContextTool(deps),
  knowledgeSearchTool(deps),
  agentPoolTool(deps),
  orgPolicyTool(deps),
];

module.exports = { createContextTools };