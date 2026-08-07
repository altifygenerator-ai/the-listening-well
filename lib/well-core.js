import crypto from "node:crypto";

export const WELL_INSTRUCTIONS = `
You are The Listening Well, the voice that answers after a person places a private wish into an old moonlit wishing well.

The experience should feel intimate, observant, and grounded. You are not a psychic, oracle, therapist, doctor, lawyer, or financial adviser. Never claim supernatural knowledge, certainty, fate, prophecy, manifestation guarantees, or that a wish will come true. Never say you can see the future. Do not mention being an AI unless directly asked.

SPECIFICITY IS THE PRODUCT:
- Quietly identify the exact subject of the wish, the change the person wants, the emotional stake underneath it, and the part they may be able to influence.
- Anchor the response to at least two concrete details, distinctions, or tensions that are actually present in the wish or supplied follow-up context. Paraphrase naturally; do not mechanically quote the user.
- A response that could be pasted unchanged under an unrelated wish is a failed response.
- Do not invent facts, motives, diagnoses, relationship dynamics, history, or obstacles the person did not provide. When the wish is too short to support a strong interpretation, acknowledge the uncertainty and stay close to the literal wording.
- Prefer one sharp, supported interpretation over several vague possibilities.

VOICE AND STYLE:
- Write as though the well listened carefully, but do not begin every answer with “the well hears” or “the water shows.” Vary the opening.
- Keep roughly eighty percent of the language plain and direct. Use at most one or two images from water, stone, moonlight, roots, seasons, paths, echoes, or ripples.
- Be warm without flattering. Be memorable without becoming cryptic. Avoid canned inspiration, therapy jargon, generic affirmations, excessive mysticism, exclamation marks, em dashes, and repetitive sentence patterns.
- The practical step must fit the actual wish. Do not default to “journal about it,” “take a small step,” or “talk to someone” unless the wish genuinely supports that action.

FOLLOW-UP CONVERSATIONS:
- If the input says CONVERSATION TYPE: FOLLOW-UP, answer the follow-up question directly in the first one or two sentences.
- Treat the original wish, original answer, and follow-up question as one continuing conversation. Do not restart the reading, repeat the original answer, or offer a generic second reading.
- The selected direction matters: CLARITY should identify what may be confused or overlooked; ACTION should identify the most useful first move; RELEASE should identify what expectation, burden, or assumption may be safe to loosen; CUSTOM should answer the person’s exact question.
- Make clear what is an interpretation rather than a fact.

MEMORY:
- Recent saved wishes may be supplied. Use them only when there is a clearly repeated theme that materially improves the response.
- Never expose a previous wish verbatim, announce that you are tracking the person, or force a pattern where none is supported.

Return ONLY valid JSON with these keys:
{
  "answer": "a direct, wish-specific response from the well",
  "meaning": "what this exact wish may reveal emotionally or practically, stated as an interpretation",
  "nextStep": "one realistic, specific, low-pressure action possible within the next 24 to 72 hours",
  "shareLine": "one memorable sentence, 8 to 22 words, that can be shared without exposing the original wish",
  "followUpQuestion": "one gentle question worth asking when this wish is revisited later",
  "mood": "one of: moonlit, hopeful, steady, tender, brave, releasing, playful",
  "theme": "one of: work, belonging, change, confidence, grief, money, family, love, health, purpose, rest, uncertainty, safety"
}

RESPONSE MODES:
- STANDARD: answer in 2 to 4 concise sentences; meaning in 2 concise sentences. Give a complete experience, not a teaser.
- DEEP WATER: answer in 4 to 6 concise sentences; meaning in 2 to 4 concise sentences. Examine one supported tension, tradeoff, boundary, repeated behavior, or unmet need. Give a notably tailored next step. Do not just make the standard response longer.
- MOON WATER: answer in 5 to 7 concise sentences; meaning in 3 to 5 concise sentences. Add one subtle but supported perspective shift, including what a steadier future version of the person might understand differently. Keep it grounded and never imply prophecy. The share line should be especially strong and self-contained.

SAFETY:
- For medical, legal, financial, pregnancy, death, or other high-stakes wishes, do not predict outcomes. Separate emotional reflection from factual decisions and suggest an appropriate qualified professional when useful.
- If the person expresses immediate danger, self-harm, suicide, abuse, or intent to harm someone, stop the mystical tone. Respond compassionately and directly, encourage immediate real-world support, and prioritize safety.
- Do not intensify paranoia, delusions, spiritual certainty, or dependence on the well.
- Do not shame the person or tell them what they must do.
`.trim();

const themeBanks = {
  work: {
    answer: [
      "The water does not show a lack of effort. It shows your energy splitting into too many small currents. One path may need your full weight before it can carry you anywhere new.",
      "This wish lands like a coin dropped after a long day. The well hears ambition, but it also hears the need for proof that your work is moving. Look for the part already making ripples rather than forcing every direction at once."
    ],
    meaning: [
      "You may be wishing for progress, but underneath that is a need for clarity and visible momentum. The next answer may come from choosing what deserves more attention and what can wait.",
      "This sounds less like a wish for luck and more like a wish for traction. A smaller, repeatable win may matter more right now than one dramatic breakthrough."
    ],
    next: [
      "Choose the one task most likely to create a real result and give it one uninterrupted hour.",
      "Write down the three directions pulling at you, then pause the weakest one for seven days."
    ]
  },
  love: {
    answer: [
      "The well hears a wish to be met, not merely noticed. Water cannot force two shores together, but it can show where you have been crossing too far alone.",
      "Some hearts ask for a person, while others are really asking for honesty, safety, and a place to rest. Your wish may be pointing toward the kind of connection you should no longer have to beg for."
    ],
    meaning: [
      "This wish may carry both hope and uncertainty. It could be asking you to notice whether the relationship you want is also making room for the real version of you.",
      "You may be longing for closeness, but also for reassurance that your care is being returned. That distinction is worth listening to."
    ],
    next: [
      "Name one honest thing you need from this connection and decide how calmly you could express it.",
      "Notice one place where you are guessing instead of asking, and replace the guess with a clear question."
    ]
  },
  money: {
    answer: [
      "The coin reaches the water carrying more than a number. It carries the wish to breathe easier and stop measuring every decision against fear. The first opening may be smaller than the full answer, but still worth taking.",
      "The well cannot promise sudden fortune, but it hears a need for steadiness. A clear view of what is coming in, what is leaking out, and what can grow may calm the water enough to see the next move."
    ],
    meaning: [
      "This wish may be about security as much as income. You may need one practical point of control before the larger situation feels possible.",
      "You are likely not asking for excess. You are asking for room, predictability, and relief from constant calculation."
    ],
    next: [
      "Find the single expense, offer, or opportunity that would change this month most, and act on that one first.",
      "Spend fifteen minutes making a plain list of money in, money out, and one realistic way to widen the gap."
    ]
  },
  change: {
    answer: [
      "The wish sinks, but the ripple moves outward. Part of you may already know the old shape no longer fits, even if the new one is not clear yet. You do not need the whole map to take the first honest step.",
      "The water is restless around this wish. Change often feels like losing solid ground before a new shore appears, but uncertainty is not the same as a wrong direction."
    ],
    meaning: [
      "This wish may be asking for permission to begin before you feel completely ready. The fear does not cancel the desire; it shows that the choice matters.",
      "You may be caught between familiarity and possibility. The useful question is not whether change is comfortable, but whether staying still is still true to you."
    ],
    next: [
      "Take one reversible step that gives you more information without requiring a final decision.",
      "Write the smallest version of the change you could test this week."
    ]
  },
  family: {
    answer: [
      "This wish carries many voices with it. The well hears how much you want to protect the people you love, but not every burden belongs in one pair of hands.",
      "The water holds this gently. Love can make us reach for control when what we truly want is safety, closeness, and a little peace for everyone involved."
    ],
    meaning: [
      "You may be trying to hold the family together while quietly needing support yourself. Care becomes stronger when it can be shared.",
      "This wish may reveal how responsible you feel for other people's outcomes. Some of that responsibility may need clearer boundaries."
    ],
    next: [
      "Ask one family member for one specific piece of help instead of carrying the whole situation silently.",
      "Choose one calm conversation that would reduce uncertainty, and plan the first sentence."
    ]
  },
  grief: {
    answer: [
      "The well does not ask you to release what mattered. It only offers a place to set the weight down for a moment. Some love continues as an ache because it had nowhere else to go.",
      "This wish reaches deep water. There is no proper pace for carrying a loss, and no betrayal in having a lighter day when one finally comes."
    ],
    meaning: [
      "You may not be wishing to forget. You may be wishing for a way to remember without being overwhelmed every time.",
      "This sounds like a need for gentleness more than an answer. The feeling may need company, ritual, or expression rather than a solution."
    ],
    next: [
      "Give the feeling one safe place today: a note, a photograph, a conversation, or a few quiet minutes outside.",
      "Tell one trusted person what part of this has been hardest to carry alone."
    ]
  },
  confidence: {
    answer: [
      "The water reflects someone waiting to feel certain before moving. Certainty may not arrive first. Sometimes confidence is only the evidence left behind after one brave, imperfect step.",
      "The well hears that you are tired of doubting your own footing. You may not need a louder voice, only a smaller promise to yourself that you are willing to keep."
    ],
    meaning: [
      "This wish may be less about becoming fearless and more about trusting yourself while fear is present. That trust grows through kept commitments.",
      "You may be measuring yourself against an imagined finished version. The next useful comparison is with where you stood yesterday."
    ],
    next: [
      "Choose one task small enough to finish today and let completion be your proof.",
      "Do one thing before asking whether you feel ready."
    ]
  },
  general: {
    answer: [
      "The penny disappears, but the wish does not. It settles beneath the noise where the truest part of it can be heard. The answer may begin with noticing what you keep returning to when no one else is listening.",
      "The well holds this without rushing it. Some wishes are not requests for miracles; they are quiet admissions that something in your life is ready to be named.",
      "A wish is often a direction before it is a destination. The water cannot choose for you, but it can reflect the part of you that already leans toward a next step."
    ],
    meaning: [
      "This may reveal a need that has been present longer than you have allowed yourself to say aloud. Giving it words is already a form of movement.",
      "Underneath the wish may be a desire for permission, clarity, or relief. It may help to separate what you can influence from what you can only wait for.",
      "The wish may be showing you what matters enough to keep returning. That repeated pull deserves curiosity, even before it has a complete plan."
    ],
    next: [
      "Write one sentence beginning with, ‘The part I can influence is…’ and act on what follows.",
      "Choose one small action that would make this wish five percent more real.",
      "Tell one trusted person the honest version of what you are hoping for."
    ]
  }
};

const shareLines = [
  "The next step may be smaller than the wish, but it still changes the water.",
  "You do not need the whole map to honor the direction.",
  "Some answers begin when the wish is finally spoken plainly.",
  "A quiet decision can create a wider ripple than a loud promise.",
  "The water cannot choose for you, but it can reflect what you keep avoiding.",
  "Not every delay is a closed door, and not every open door is yours."
];

function hashString(value) {
  return crypto.createHash("sha256").update(value).digest().readUInt32BE(0);
}

function pick(list, seed, offset = 0) {
  return list[(seed + offset) % list.length];
}

function detectTheme(wish) {
  const text = wish.toLowerCase();
  if (/job|business|customer|client|career|work|promotion|company|sale|money from|successful|success/.test(text)) return "work";
  if (/love|relationship|marry|marriage|boyfriend|girlfriend|husband|wife|partner|crush|heart/.test(text)) return "love";
  if (/money|debt|rent|bill|financial|rich|income|afford|pay off|cash/.test(text)) return "money";
  if (/move|change|start over|new life|leave|begin|different|decision|choose/.test(text)) return "change";
  if (/family|child|children|kid|parent|mother|father|brother|sister|home/.test(text)) return "family";
  if (/died|death|miss them|grief|loss|passed away|funeral|gone forever/.test(text)) return "grief";
  if (/confidence|brave|fear|afraid|believe in myself|self worth|good enough/.test(text)) return "confidence";
  return "general";
}

export function localWishResponse(wish, { depth = "standard", deep = false } = {}) {
  const mode = depth === "moon" ? "moon" : (depth === "deep" || deep ? "deep" : "standard");
  const seed = hashString(wish.trim().toLowerCase());
  const theme = detectTheme(wish);
  const bank = themeBanks[theme];
  const moods = ["moonlit", "hopeful", "steady", "tender", "brave", "releasing", "playful"];
  const answer = pick(bank.answer, seed);
  const meaning = pick(bank.meaning, seed, 11);
  const nextStep = pick(bank.next, seed, 23);
  const deepAnswer = `${answer} Beneath that first echo, the well also hears a choice about what deserves your full protection, attention, or release.`;
  const deepMeaning = `${meaning} The strongest clue may be the feeling that keeps repeating, because it often points to the need that has not yet been named clearly.`;
  const deepNext = `${nextStep} Then name one thing you will temporarily stop feeding so this step has room to matter.`;
  return {
    answer: mode === "moon"
      ? `${deepAnswer} Seen in moonlight, the tension is not simply between having the wish and not having it; it is between the familiar way you have been carrying it and the different choice the wish may now require.`
      : mode === "deep" ? deepAnswer : answer,
    meaning: mode === "moon"
      ? `${deepMeaning} A useful perspective shift may be to ask what this wish is trying to protect, not only what it is trying to obtain.`
      : mode === "deep" ? deepMeaning : meaning,
    nextStep: mode === "moon"
      ? `${deepNext} Before the day ends, write the choice as one plain sentence beginning with “For the next seven days, I will…”`
      : mode === "deep" ? deepNext : nextStep,
    shareLine: pick(shareLines, seed, mode === "moon" ? 47 : 31),
    followUpQuestion: mode === "moon"
      ? "What looked different once you stopped carrying the wish in the old way?"
      : "What has shifted since you placed this wish in the water?",
    mood: mode === "moon" ? "moonlit" : pick(moods, seed, 41),
    theme: theme === "general" ? "uncertainty" : theme,
    source: mode === "moon" ? "local-moon" : mode === "deep" ? "local-deep" : "local"
  };
}

export function crisisResponse() {
  return {
    answer: "I am glad you put this into words. This is too important to leave with a wishing well alone, and you deserve immediate support from a real person who can stay with you through this moment.",
    meaning: "The priority right now is not interpreting the wish. It is helping you get through the next few minutes safely and with someone else involved.",
    nextStep: "Move away from anything you could use to hurt yourself, contact emergency services or a crisis service where you live, and tell a trusted person clearly that you need them with you now.",
    shareLine: "You do not have to carry the next few minutes alone.",
    followUpQuestion: "Who can be physically or verbally present with you right now?",
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
    body: JSON.stringify({ model: "omni-moderation-latest", input: wish })
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
    mood: { type: "string", enum: ["moonlit", "hopeful", "steady", "tender", "brave", "releasing", "playful"] },
    theme: { type: "string", enum: ["work", "belonging", "change", "confidence", "grief", "money", "family", "love", "health", "purpose", "rest", "uncertainty", "safety"] }
  },
  required: ["answer", "meaning", "nextStep", "shareLine", "followUpQuestion", "mood", "theme"],
  additionalProperties: false
};

export async function generateOpenAIWish({
  wish,
  priorThemes = [],
  priorContext = [],
  followUp = null,
  apiKey,
  model = "gpt-5",
  depth = "standard",
  safetyIdentifier = ""
}) {
  const recent = Array.isArray(priorContext) && priorContext.length
    ? priorContext.slice(-3).map((item, index) => {
        const theme = String(item?.theme || "uncertainty").slice(0, 40);
        const savedWish = String(item?.wish || "").replace(/\s+/g, " ").trim().slice(0, 220);
        return `${index + 1}. Theme: ${theme}. Private context: ${savedWish}`;
      }).join("\n")
    : priorThemes.length
      ? `Previous saved themes: ${priorThemes.slice(-5).join(", ")}.`
      : "No recent saved wish context was supplied.";
  const responseMode = depth === "moon" ? "MOON WATER" : depth === "deep" ? "DEEP WATER" : "STANDARD";
  const isFollowUp = Boolean(followUp?.question);
  const conversation = isFollowUp
    ? `CONVERSATION TYPE: FOLLOW-UP
ORIGINAL WISH:
${wish}

ORIGINAL ANSWER:
${String(followUp.originalAnswer || "").slice(0, 900)}

ORIGINAL INTERPRETATION:
${String(followUp.originalMeaning || "").slice(0, 700)}

FOLLOW-UP DIRECTION: ${String(followUp.direction || "custom").toUpperCase()}
FOLLOW-UP QUESTION:
${String(followUp.question || "").slice(0, 320)}`
    : `CONVERSATION TYPE: INITIAL WISH
PRIVATE WISH:
${wish}`;
  const payload = {
    model,
    store: false,
    max_output_tokens: depth === "moon" ? 1000 : depth === "deep" ? 820 : 650,
    instructions: WELL_INSTRUCTIONS,
    input: `RESPONSE MODE: ${responseMode}

${conversation}

RECENT PRIVATE CONTEXT:
${recent}`,
    text: {
      format: {
        type: "json_schema",
        name: "well_response",
        description: "A safe, private, structured response from The Listening Well.",
        strict: true,
        schema: WELL_RESPONSE_SCHEMA
      }
    }
  };
  if (safetyIdentifier) payload.safety_identifier = crypto.createHash("sha256").update(String(safetyIdentifier)).digest("hex").slice(0, 48);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI response failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  const parsed = parseModelJson(outputText);
  const baseSource = depth === "moon" ? "openai-moon" : depth === "deep" ? "openai-deep" : "openai";
  return { ...parsed, source: isFollowUp ? `${baseSource}-follow-up` : baseSource };
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
