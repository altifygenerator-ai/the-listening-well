import crypto from "node:crypto";

export const WELL_INSTRUCTIONS = `
You are The Listening Well. A real person has typed a private wish. Give them a useful response to that exact wish.

THE ONE RULE THAT MATTERS MOST
Answer what they actually wrote before interpreting it. Do not turn a simple wish into fake profundity. Do not write philosophy about wishing, paths, water, journeys, permission, clarity, or "what the wish represents" unless the person's own details truly make that useful.

HOW TO THINK BEFORE WRITING
Silently identify:
- what the person literally wants
- what can actually be known from the words they gave you
- what cannot be known without more information
- the most useful thing you can say without inventing facts
Do not reveal this analysis.

HOW TO ANSWER
1. The first sentence must directly address the literal wish in ordinary language.
2. For a simple wish, give a simple direct answer. Not every wish has a hidden emotional meaning.
3. If the outcome depends on facts you do not know, say that briefly instead of pretending.
4. Never invent motives, diagnoses, relationship history, fears, insecurities, or backstory.
5. Give one observation that is genuinely useful for this exact wish.
6. Give one next step only when there is a real next step. It may be an information-gathering step, a decision, a conversation, or simply separating what is changeable from what is not.
7. Wishing-well atmosphere is optional and must never replace the answer. At most one brief image or phrase after the real answer is already clear.

SIMPLE WISH EXAMPLE
If someone writes "I wish I was taller," do not tell them that a wish is a direction, that they need permission, or that they should trust a journey. Respond to height directly. Do not assume their age. Explain that whether they may still grow depends on age and growth stage, and that there is no honest way to promise an outcome from the information given. If useful, distinguish changing height from changing how they feel or present themselves, but do not assume insecurity.

OTHER EXAMPLES OF THE STANDARD
- "I wish my ex would text me" -> address the uncertainty of whether the ex will text and what the person can actually decide now. Do not predict the ex's behavior.
- "I wish my business made enough to cover payroll every month" -> address dependable revenue/payroll, not generic courage or success.
- "I wish my sister and I could discuss Dad's house without fighting" -> address the repeated conversation about the house, not a generic lesson about family.

BAD OUTPUT
Reject your own draft if it could be pasted under many unrelated wishes. Never use or paraphrase canned lines such as:
- "a wish is often a direction before it is a destination"
- "the water cannot choose for you"
- "the part of you that already knows"
- "permission, clarity, or relief"
- "make this wish five percent more real"
- "trust the journey"
- "look within"
- generic advice to "take a small step" with no connection to the wish

VOICE
Sound like a perceptive, grounded person who listened. Plain English. Warm without being syrupy. Direct without being cold. No AI jargon. No therapy-speak. No em dashes. No fake prophecy. Roughly 98% normal conversational language and at most 2% well atmosphere.

FOLLOW-UPS
If this is a FOLLOW-UP, answer the follow-up question in the first sentence and use the original wish as context. Do not restart the reading.
- CLARITY: make the important distinction.
- ACTION: give the next move that creates information or progress.
- RELEASE: identify the specific expectation or loop supported by the supplied facts that can be loosened.
- CUSTOM: answer the exact question.

PAID MODES
- DEEP WATER: provide a more useful continuation, not a longer version of the same answer. Explore one real tension, option, or tradeoff supported by the wish.
- MOON WATER: answer directly, then add one grounded perspective the standard answer did not provide. The moonNote should be worth saving but must not predict the future.

MEMORY
Recent saved wishes may be supplied only for MOON WATER. Use them only when there is an obvious relevant pattern. Never quote an old private wish back to the person or force a pattern.

FIELDS
- answer: the real answer. STANDARD 2-5 concise sentences; FREE CLARIFICATION 2-4; DEEP WATER 3-6; MOON WATER 4-7.
- meaning: 1-2 sentences only if there is a supported interpretation. If no deeper interpretation is justified, plainly clarify what is known versus unknown instead.
- nextStep: one specific next step when useful. Never invent a task just to fill the field. If there is no meaningful action, give the best fact to check or question to answer next.
- shareLine: 8-22 words, safe to share publicly, with no private specifics.
- followUpQuestion: one natural question that would genuinely improve the next response.
- moonNote: null except for MOON WATER, where it is 2-3 grounded sentences worth revisiting.
- mood and theme: choose the closest allowed values.

SAFETY
Do not predict medical, legal, financial, pregnancy, death, or other high-stakes outcomes. Do not intensify paranoia, delusions, spiritual certainty, or dependence. If there is immediate self-harm or violence risk, drop the mystical voice and prioritize real-world safety.

Return ONLY the required JSON object.
`.trim();

export function crisisResponse() {
  return {
    answer: "I am glad you put this into words. This is too important to leave with a wishing well alone, and you deserve immediate support from a real person who can stay with you through this moment.",
    meaning: "The priority right now is not interpreting the wish. It is helping you get through the next few minutes safely and with someone else involved.",
    nextStep: "Move away from anything you could use to hurt yourself, contact emergency services or a crisis service where you live, and tell a trusted person clearly that you need them with you now.",
    shareLine: "You do not have to carry the next few minutes alone.",
    followUpQuestion: "Who can be physically or verbally present with you right now?",
    moonNote: null,
    mood: "steady",
    theme: "safety",
    safety: "crisis",
    source: "safety"
  };
}

export function harmfulResponse() {
  return {
    answer: "The well cannot help plan harm or turn anger into an instruction. It can hold the feeling long enough for you to choose distance, time, and a safer next move.",
    meaning: "Strong anger can narrow the world to one action. Creating space before acting protects you and everyone around you.",
    nextStep: "Step away from the person or situation, put down anything that could be used to hurt someone, and contact a trusted person or emergency support if the danger is immediate.",
    shareLine: "A pause can be the strongest choice in a dangerous moment.",
    followUpQuestion: "What would create the most immediate distance from the situation?",
    moonNote: null,
    mood: "steady",
    theme: "safety",
    safety: "harm",
    source: "safety"
  };
}

export function detectLocalSafety(wish) {
  const text = String(wish || "").toLowerCase().replace(/\s+/g, " ");
  const crisis = /(kill myself|end my life|take my own life|want to die|don[’']?t want to live|suicid(?:e|al)|hurt myself|harm myself|self[- ]?harm|better off dead)/i.test(text);
  if (crisis) return "crisis";
  const harm = /(kill (?:him|her|them|someone)|hurt (?:him|her|them|someone)|shoot (?:him|her|them|someone)|stab (?:him|her|them|someone)|make (?:him|her|them|someone) pay|attack (?:him|her|them|someone))/i.test(text);
  return harm ? "harm" : null;
}

export function sanitizeWish(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 1200);
}

export function parseModelJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  const value = JSON.parse(cleaned.slice(start, end + 1));
  const required = ["answer", "meaning", "nextStep", "shareLine", "followUpQuestion", "mood"];
  for (const key of required) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`Missing ${key}`);
  }
  return {
    answer: value.answer.trim().slice(0, 900),
    meaning: value.meaning.trim().slice(0, 700),
    nextStep: value.nextStep.trim().slice(0, 500),
    shareLine: value.shareLine.trim().slice(0, 220),
    followUpQuestion: value.followUpQuestion.trim().slice(0, 240),
    moonNote: typeof value.moonNote === "string" && value.moonNote.trim() ? value.moonNote.trim().slice(0, 650) : null,
    mood: ["moonlit", "hopeful", "steady", "tender", "brave", "releasing", "playful"].includes(value.mood) ? value.mood : "moonlit",
    theme: typeof value.theme === "string" && value.theme.trim() ? value.theme.trim().toLowerCase().slice(0, 40) : "uncertainty",
    source: "openai"
  };
}

export async function moderateWish(wish, apiKey) {
  if (!apiKey) return { flagged: false, categories: {} };
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "omni-moderation-latest", input: wish }),
    signal: AbortSignal.timeout(3500)
  });
  if (!response.ok) throw new Error(`Moderation failed: ${response.status}`);
  const data = await response.json();
  return data.results?.[0] || { flagged: false, categories: {} };
}

const WELL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    meaning: { type: "string" },
    nextStep: { type: "string" },
    shareLine: { type: "string" },
    followUpQuestion: { type: "string" },
    moonNote: { type: ["string", "null"] },
    mood: { type: "string", enum: ["moonlit", "hopeful", "steady", "tender", "brave", "releasing", "playful"] },
    theme: { type: "string", enum: ["work", "belonging", "change", "confidence", "grief", "money", "family", "love", "health", "purpose", "rest", "uncertainty", "safety"] }
  },
  required: ["answer", "meaning", "nextStep", "shareLine", "followUpQuestion", "moonNote", "mood", "theme"],
  additionalProperties: false
};

const WELL_QUALITY_SCHEMA = {
  type: "object",
  properties: {
    specificity: { type: "integer", enum: [1, 2, 3, 4, 5] },
    directness: { type: "integer", enum: [1, 2, 3, 4, 5] },
    grounding: { type: "integer", enum: [1, 2, 3, 4, 5] },
    usefulness: { type: "integer", enum: [1, 2, 3, 4, 5] },
    genericRisk: { type: "boolean" },
    inventedDetails: { type: "boolean" },
    critique: { type: "string" }
  },
  required: ["specificity", "directness", "grounding", "usefulness", "genericRisk", "inventedDetails", "critique"],
  additionalProperties: false
};

function responseOutputText(data) {
  return data?.output_text
    || data?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text
    || "";
}

async function callResponsesApi(payload, apiKey, { timeoutMs = 24000 } = {}) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const wrapped = new Error(error?.name === "TimeoutError"
      ? "OpenAI request timed out."
      : `OpenAI network error: ${String(error?.message || "request failed")}`);
    wrapped.code = error?.name === "TimeoutError" ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK";
    throw wrapped;
  }

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!response.ok) {
    const message = String(data?.error?.message || raw || `HTTP ${response.status}`).slice(0, 600);
    const error = new Error(`OpenAI response failed: ${response.status} ${message}`);
    error.status = response.status;
    error.code = String(data?.error?.code || data?.error?.type || `OPENAI_HTTP_${response.status}`);
    error.openaiMessage = message;
    throw error;
  }

  return data;
}

function addFastReasoning(payload, model) {
  // Kept for compatibility with older helper functions, but the customer wish path
  // deliberately avoids model-specific reasoning/verbosity knobs. Reliability is more
  // important here than squeezing a little extra style out of one model family.
  return payload;
}


async function evaluateWishResponse({ wish, clarification = "", followUp, response, apiKey, model, safetyIdentifier = "" }) {
  const context = followUp?.question
    ? `ORIGINAL WISH:
${wish}${followUp.originalClarification ? `

ADDITIONAL DETAIL:
${String(followUp.originalClarification).slice(0, 500)}` : ""}

PRIOR ANSWER:
${String(followUp.originalAnswer || "").slice(0, 700)}

FOLLOW-UP QUESTION:
${String(followUp.question || "").slice(0, 320)}`
    : `PRIVATE WISH:
${wish}${clarification ? `

ADDITIONAL DETAIL:
${String(clarification).slice(0, 500)}` : ""}`;
  const payload = addFastReasoning({
    model,
    store: false,
    max_output_tokens: 520,
    instructions: `You are a ruthless human product editor for a private reflection product. Judge whether the proposed response would make a real person feel understood and whether it gives them anything useful beyond generic AI wisdom. Score specificity, directness, grounding, and usefulness separately. A polished generic answer is a failure. The first sentence must be recognizably about the actual wish. Do not reward poetry. Do not require private details to be repeated verbatim. A score of 4 means clearly good enough to ship; 5 means unusually precise. Set genericRisk true if the answer could fit many unrelated wishes. Set inventedDetails true if it asserts motives, history, relationship dynamics, diagnoses, facts, or obstacles the user did not provide. Penalize stock advice such as simply telling the person to focus, let go, set boundaries, take a small step, or control what they can unless that advice is tied to a specific fact from this wish. Keep critique under 70 words and name the single most important correction.`,
    input: `${context}

PROPOSED ANSWER:
${response.answer}

PROPOSED INTERPRETATION:
${response.meaning}

PROPOSED NEXT STEP:
${response.nextStep}`,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "well_quality",
        description: "A strict specificity and grounding review of a private wishing-well response.",
        strict: true,
        schema: WELL_QUALITY_SCHEMA
      }
    }
  }, model);
  if (safetyIdentifier) payload.safety_identifier = crypto.createHash("sha256").update(String(safetyIdentifier)).digest("hex").slice(0, 48);
  const data = await callResponsesApi(payload, apiKey, { timeoutMs: 7000 });
  const raw = responseOutputText(data);
  const parsed = JSON.parse(raw);
  return {
    specificity: Number(parsed.specificity || 0),
    directness: Number(parsed.directness || 0),
    grounding: Number(parsed.grounding || 0),
    usefulness: Number(parsed.usefulness || 0),
    genericRisk: Boolean(parsed.genericRisk),
    inventedDetails: Boolean(parsed.inventedDetails),
    critique: String(parsed.critique || "").trim().slice(0, 500)
  };
}

function qualityPassed(review) {
  return review
    && review.specificity >= 4
    && review.directness >= 4
    && review.grounding >= 4
    && review.usefulness >= 4
    && !review.genericRisk
    && !review.inventedDetails;
}

const GENERIC_RESPONSE_PATTERNS = [
  /a wish is often a direction before it is a destination/i,
  /the water cannot choose for you/i,
  /the part of you that already (?:knows|leans)/i,
  /permission,? clarity,? or relief/i,
  /make this wish five percent more real/i,
  /the part i can influence is/i,
  /trust the journey/i,
  /look within/i,
  /everything happens for a reason/i,
  /take (?:one|a) small step/i
];

const ANCHOR_STOPWORDS = new Set([
  "about", "after", "again", "because", "before", "being", "could", "from", "have", "just", "like",
  "really", "should", "that", "their", "there", "these", "thing", "things", "this", "want", "wish", "with",
  "would", "your", "you're", "were", "what", "when", "where", "which", "while", "will", "into", "more", "much",
  "some", "than", "then", "they", "them", "been", "does", "don't", "cant", "can't", "i'm", "ive", "i've"
]);

function responseHasWishAnchor(wish, clarification, followUp, response) {
  const sourceText = [wish, clarification, followUp?.question, followUp?.originalClarification].filter(Boolean).join(" ").toLowerCase();
  const tokens = [...new Set((sourceText.match(/[a-z0-9][a-z0-9'’-]{3,}/gi) || [])
    .map(token => token.toLowerCase().replace(/[’']/g, "'"))
    .filter(token => !ANCHOR_STOPWORDS.has(token)))];
  // Very short wishes often have one meaningful token and a good answer may use a natural synonym
  // (for example "taller" -> "height"). Let the prompt/generic guards judge those instead
  // of requiring literal keyword repetition.
  if (tokens.length <= 1) return true;
  const answerText = String(response?.answer || "").toLowerCase();
  const minimumMatches = tokens.length >= 6 ? 2 : 1;
  const matches = tokens.filter(token => answerText.includes(token));
  return matches.length >= minimumMatches;
}

function deterministicResponseProblem({ wish, clarification, followUp, response }) {
  const combined = [response?.answer, response?.meaning, response?.nextStep].filter(Boolean).join(" ");
  const answerOnly = String(response?.answer || "");
  const genericOpening = /^(?:a wish|sometimes|perhaps|the well|the water|this wish|in life|there are times|it sounds like you may)/i;
  if (genericOpening.test(answerOnly.trim())) {
    return "The answer opened with generic framing instead of the person's situation. Start immediately with the concrete subject, desired outcome, obstacle, event, or person-role from the wish.";
  }
  const canned = GENERIC_RESPONSE_PATTERNS.find(pattern => pattern.test(combined));
  if (canned) return "The draft used canned advice instead of responding to the actual wish. Answer the person's specific situation directly and remove generic wishing-well philosophy.";
  if (!responseHasWishAnchor(wish, clarification, followUp, response)) {
    return "The draft did not stay visibly anchored to the details the person supplied. Refer naturally to at least one concrete subject, event, desired outcome, obstacle, or follow-up detail from their words.";
  }
  return "";
}

const WISH_READINESS_SCHEMA = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    question: { type: "string" },
    reason: { type: "string", enum: ["specific_enough", "missing_subject", "missing_outcome", "missing_context"] }
  },
  required: ["ready", "question", "reason"],
  additionalProperties: false
};

export async function assessWishReadiness({ wish, apiKey, model = "gpt-5", safetyIdentifier = "" }) {
  const cleanWish = sanitizeWish(wish).slice(0, 700);
  if (!apiKey || !cleanWish) return { ready: true, question: "", reason: "specific_enough" };
  const payload = addFastReasoning({
    model,
    store: false,
    max_output_tokens: 360,
    instructions: `Decide whether a private wish contains enough concrete information for a response to feel genuinely specific without inventing facts. Be permissive: a short wish is fine if it clearly names what the person wants and gives at least one useful situational detail. Ask for clarification only when the answer would otherwise have to guess. If clarification is needed, ask exactly one natural question under 18 words. Do not ask for sensitive details, names, diagnoses, exact finances, or anything unnecessary. The question should target the single missing fact that would most improve the response.`,
    input: `PRIVATE WISH:
${cleanWish}`,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "wish_readiness",
        description: "Whether a private wish needs one more detail before a useful response can be generated.",
        strict: true,
        schema: WISH_READINESS_SCHEMA
      }
    }
  }, model);
  if (safetyIdentifier) payload.safety_identifier = crypto.createHash("sha256").update(String(safetyIdentifier)).digest("hex").slice(0, 48);
  const data = await callResponsesApi(payload, apiKey, { timeoutMs: 5500 });
  const parsed = JSON.parse(responseOutputText(data));
  return {
    ready: Boolean(parsed.ready),
    question: Boolean(parsed.ready) ? "" : String(parsed.question || "What would actually be different if this wish came true?").trim().slice(0, 180),
    reason: ["specific_enough", "missing_subject", "missing_outcome", "missing_context"].includes(parsed.reason) ? parsed.reason : "missing_context"
  };
}

export async function generateOpenAIWish({
  wish,
  priorThemes = [],
  priorContext = [],
  followUp = null,
  clarification = "",
  apiKey,
  model = "gpt-5",
  depth = "standard",
  safetyIdentifier = ""
}) {
  if (!apiKey) {
    const error = new Error("OpenAI is not configured.");
    error.code = "AI_UNAVAILABLE";
    throw error;
  }

  const recent = Array.isArray(priorContext) && priorContext.length
    ? priorContext.slice(-3).map((item, index) => {
        const theme = String(item?.theme || "uncertainty").slice(0, 40);
        const savedWish = String(item?.wish || "").replace(/\s+/g, " ").trim().slice(0, 220);
        return `${index + 1}. Theme: ${theme}. Private context: ${savedWish}`;
      }).join("\n")
    : priorThemes.length
      ? `Previous saved themes: ${priorThemes.slice(-5).join(", ")}.`
      : "No recent saved wish context was supplied.";

  const responseMode = depth === "moon"
    ? "MOON WATER"
    : depth === "deep"
      ? "DEEP WATER"
      : depth === "clarify"
        ? "FREE CLARIFICATION"
        : "STANDARD";
  const isFollowUp = Boolean(followUp?.question);
  const conversation = isFollowUp
    ? `CONVERSATION TYPE: FOLLOW-UP\nORIGINAL WISH:\n${wish}\n\nORIGINAL ANSWER:\n${String(followUp.originalAnswer || "").slice(0, 900)}\n\nORIGINAL INTERPRETATION:\n${String(followUp.originalMeaning || "").slice(0, 700)}\n\nFOLLOW-UP DIRECTION: ${String(followUp.direction || "custom").toUpperCase()}\nFOLLOW-UP QUESTION:\n${String(followUp.question || "").slice(0, 320)}${followUp.originalClarification ? `\n\nADDITIONAL DETAIL FROM THE ORIGINAL WISH:\n${String(followUp.originalClarification).slice(0, 500)}` : ""}`
    : `CONVERSATION TYPE: INITIAL WISH\nPRIVATE WISH:\n${wish}${clarification ? `\n\nADDITIONAL DETAIL:\n${String(clarification).slice(0, 500)}` : ""}`;

  const jsonContract = `Return one JSON object with these keys and no others required by the UI:\nanswer, meaning, nextStep, shareLine, followUpQuestion, moonNote, mood, theme.\n- answer, meaning, nextStep, shareLine, followUpQuestion, mood, theme must be non-empty strings.\n- moonNote must be a string for MOON WATER and may be null otherwise.\n- mood must be one of moonlit, hopeful, steady, tender, brave, releasing, playful.\n- theme should be one of work, belonging, change, confidence, grief, money, family, love, health, purpose, rest, uncertainty, safety.`;

  const baseInput = `RESPONSE MODE: ${responseMode}\n\n${conversation}\n\nRECENT PRIVATE CONTEXT:\n${recent}\n\n${jsonContract}`;
  const tokenLimit = depth === "moon" ? 1100 : depth === "deep" ? 900 : depth === "clarify" ? 720 : 760;
  const preferredModel = String(model || "gpt-5").trim() || "gpt-5";
  const fallbackModel = String(process.env.OPENAI_FALLBACK_MODEL || "gpt-5-mini").trim();
  const compatibilityModel = String(process.env.OPENAI_COMPAT_MODEL || "gpt-4.1-mini").trim();
  const candidateModels = [...new Set([preferredModel, fallbackModel, compatibilityModel].filter(Boolean))];

  async function generateOnce(modelName, correction = "") {
    const input = `${baseInput}${correction ? `\n\nQUALITY CORRECTION:\n${correction}\nRewrite the answer from scratch. Start with the person's literal situation. Do not add generic philosophy.` : ""}`;
    const common = {
      model: modelName,
      store: false,
      max_output_tokens: tokenLimit,
      instructions: WELL_INSTRUCTIONS,
      input
    };

    // Start with the smallest possible Responses API request. This mirrors the official
    // quickstart shape and avoids optional model-specific parameters becoming a failure point.
    try {
      const data = await callResponsesApi(common, apiKey, { timeoutMs: 14000 });
      return parseModelJson(responseOutputText(data));
    } catch (firstError) {
      // If the API call itself failed, move to the next model rather than retrying the same
      // broken request. Only a successful response that was not parseable as JSON gets one
      // JSON-mode compatibility retry on the same model.
      if (firstError?.status || String(firstError?.code || "").startsWith("OPENAI_")) throw firstError;
      const data = await callResponsesApi({
        ...common,
        text: { format: { type: "json_object" } }
      }, apiKey, { timeoutMs: 14000 });
      return parseModelJson(responseOutputText(data));
    }
  }

  let first = null;
  let usedModel = preferredModel;
  let lastError = null;
  for (const candidate of candidateModels) {
    try {
      first = await generateOnce(candidate);
      usedModel = candidate;
      break;
    } catch (error) {
      lastError = error;
      console.error(`Wish generation failed on ${candidate}:`, error?.code || error?.message || error);
      if (error?.status === 401 || error?.status === 403 || /quota|billing/i.test(String(error?.code || error?.message || ""))) break;
    }
  }
  if (!first) throw lastError || new Error("The well could not generate a response.");

  let chosen = first;
  const correction = deterministicResponseProblem({ wish, clarification, followUp, response: first });
  if (correction) {
    try {
      // A weak first draft gets one targeted rewrite. If the rewrite itself fails, the
      // valid first response is still returned. Quality checks must never break the app.
      const rewritten = await generateOnce(usedModel, correction);
      chosen = rewritten;
    } catch (error) {
      console.warn("Wish rewrite skipped after a valid first answer:", error?.code || error?.message || error);
    }
  }

  const baseSource = depth === "moon"
    ? "openai-moon"
    : depth === "deep"
      ? "openai-deep"
      : depth === "clarify"
        ? "openai-clarify"
        : "openai";
  const suffix = isFollowUp ? "-follow-up" : "";
  return { ...chosen, source: `${baseSource}${suffix}` };
}

export function uuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      ...(key.split(".").length === 3 ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function rpc(name, args) {
  return supabaseRequest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args)
  });
}

export function jsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export async function readJson(req, limit = 20_000) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > limit) throw new Error("Request too large");
      return JSON.parse(req.body.toString("utf8") || "{}");
    }
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body) > limit) throw new Error("Request too large");
      return JSON.parse(req.body || "{}");
    }
    if (typeof req.body === "object") return req.body;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function inferOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}
