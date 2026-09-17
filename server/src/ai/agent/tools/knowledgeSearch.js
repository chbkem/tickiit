const { z } = require("zod");
const { cleanedText } = require("../../contracts/triageDecision");

const MAX_QUERY_LENGTH = 500;
const MAX_SEARCH_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 5;

const KnowledgeSearchInput = z
  .object({
    query: cleanedText(MAX_QUERY_LENGTH, "query must be a non-empty string"),
    limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional(),
  })
  .strict();

/**
 * search_knowledge — asks the KnowledgeRetriever for ranked article hits.
 *
 * The retriever is injected (KeywordKnowledgeRetriever until pgvector, Phase 2);
 * org scoping is bound from the run context, never from model arguments, so a
 * hijacked call cannot pivot to another org's knowledge base. All output strings
 * are sanitized and capped inside the retriever. A missing retriever degrades to
 * an empty hit set rather than throwing, so the loop never hard-fails on config.
 */
const knowledgeSearchTool = ({ knowledgeRetriever } = {}) => ({
  name: "search_knowledge",
  description:
    "Search the knowledge base for internal context that may answer or route the ticket. Args: query (the search terms), limit (optional, 1-10, default 5). Returns ranked hits with title, snippet, tags, source, and relevance (high|medium|low).",
  kind: "read",
  inputSchema: KnowledgeSearchInput,
  run: async (ctx, args) => {
    const orgId = ctx?.orgId ?? ctx?.task?.orgId ?? null;
    if (!knowledgeRetriever || typeof knowledgeRetriever.search !== "function") {
      return { query: args.query, orgId, hits: [], hitCount: 0, note: "Knowledge base is unavailable." };
    }
    const result = await knowledgeRetriever.search({
      orgId,
      query: args.query,
      limit: args.limit ?? DEFAULT_SEARCH_LIMIT,
    });
    return result;
  },
});

module.exports = { knowledgeSearchTool, KnowledgeSearchInput, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT };