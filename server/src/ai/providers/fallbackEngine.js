const { AiProvider } = require("./aiProvider");

const TASK = "TASK";
const MEDIUM = "MEDIUM";

const TYPE_RULES = [
  { type: "INCIDENT", pattern: /outage|downtime|sev\s*[12]|\bp1\b|degraded|unavailable|impacted|emergency|production|\bis down\b/i },
  { type: "BUG", pattern: /bug|error|exception|crash|broken|failing|failed|not working|doesn'?t work|workaround|stack\s*trace|\b5\d\d\b|\b40[134]\b|wrong|incorrect|to fix|fix\b/i },
  { type: "REQUEST", pattern: /request|please|can you|could you|would you|i need|i want|\badd |\bcreate |\bnew |access|permission|setup|provision/i },
];

const PRIORITY_RULES = [
  {
    priority: "URGENT",
    pattern: /urgent|asap|immediately?|critical|emergency|outage|down|breach|security|sev\s*1|\bp1\b|production|impacted|blocked/i,
  },
  {
    priority: "HIGH",
    pattern: /\bhigh\b|important|soon|broken|crash|not working|doesn'?t work|blocking|deadline|today|end of day|\bp2\b|sev\s*2/i,
  },
  {
    priority: "LOW",
    pattern: /\blow\b|minor|cosmetic|when you get a chance|someday|question|checking|asking|nice to have/i,
  },
];

const MAX_SUBJECT = 200;
const MAX_CONFIDENCE = 0.65;

const matchType = (text) => {
  const rule = TYPE_RULES.find((r) => r.pattern.test(text));
  return rule ? rule.type : TASK;
};

const matchPriority = (text) => {
  const rule = PRIORITY_RULES.find((r) => r.pattern.test(text));
  return rule ? rule.priority : MEDIUM;
};

const assessConfidence = (text, type, priority) => {
  const signals = [];
  if (type !== TASK) signals.push(`type signal: ${type}`);
  if (priority !== MEDIUM) signals.push(`priority signal: ${priority}`);
  const substantialContext = text.length >= 40;
  if (substantialContext) signals.push("substantial context");

  let score = 0.3;
  if (type !== TASK) score += 0.15;
  if (priority !== MEDIUM) score += 0.15;
  if (substantialContext) score += 0.05;
  // Capped below AI_CONFIDENCE_THRESHOLD (0.7) so deterministic decisions
  // always route to human review when a model provider is available.
  score = Math.min(score, MAX_CONFIDENCE);

  return {
    score,
    label: score >= 0.55 ? "MEDIUM" : "LOW",
    reasoning: signals.length > 0 ? signals.join("; ") : "No strong signals",
    signals,
  };
};

const buildSubject = (subject, body) => {
  const line =
    (subject && subject.split("\n")[0].trim()) ||
    (body && body.split("\n")[0].trim()) ||
    "Untriaged input";
  if (line.length <= MAX_SUBJECT) return line;
  return `${line.slice(0, MAX_SUBJECT - 1).trimEnd()}…`;
};

const buildRationale = (type, priority) =>
  `Deterministic fallback: classified as ${type.toLowerCase()} with ${priority.toLowerCase()} priority from keyword signals (no model available).`;

const extractUserText = (messages = []) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter(Boolean)
    .join("\n");

class FallbackDeterministicProvider extends AiProvider {
  constructor(options = {}) {
    super();
    this._model = options.model ?? "fallback-deterministic";
  }

  get providerId() {
    return "fallback-deterministic";
  }

  get model() {
    return this._model;
  }

  decide({ subject = "", body = "" } = {}) {
    const cleanSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanBody = typeof body === "string" ? body.trim() : "";
    const text = [cleanSubject, cleanBody].filter(Boolean).join(" \n ");

    const type = matchType(text);
    const priority = matchPriority(text);
    const confidence = assessConfidence(text, type, priority);
    const decision = {
      subject: buildSubject(cleanSubject, cleanBody),
      type,
      priority,
      assigneeRef: null,
      rationale: buildRationale(type, priority),
    };

    return { decision, confidence };
  }

  async chat({ messages } = {}) {
    const text = extractUserText(messages);
    const { decision, confidence } = this.decide({ subject: text, body: "" });
    return {
      choices: [
        {
          message: { role: "assistant", content: JSON.stringify({ decision, confidence }), toolCalls: [] },
          finishReason: "stop",
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

module.exports = {
  FallbackDeterministicProvider,
  TYPE_RULES,
  PRIORITY_RULES,
  matchType,
  matchPriority,
  assessConfidence,
  buildSubject,
  extractUserText,
};