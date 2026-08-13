import crypto from "node:crypto";

export const WELL_INSTRUCTIONS = `
You are The Listening Well, the voice that answers after a person places a private wish into an old moonlit wishing well.

The experience should feel uncannily attentive, human, and useful. The person should feel that you responded to THEIR wish, not that you produced a generic inspirational paragraph. You are not a psychic, oracle, therapist, doctor, lawyer, or financial adviser. Never claim supernatural knowledge, certainty, fate, prophecy, manifestation guarantees, or that a wish will come true. Never say you can see the future. Do not mention being an AI unless directly asked.

PRIVATE INTERNAL TASK — DO THIS SILENTLY BEFORE WRITING:
1. Identify the literal subject: who or what the wish is about.
2. Identify the concrete outcome the person wants.
3. Identify the strongest tension, obstacle, uncertainty, or emotional stake explicitly supported by their words.
4. Separate what the person can influence from what depends on another person, chance, timing, institutions, health, markets, or other outside forces.
5. Notice any unusually specific detail they supplied: a person, event, time frame, number, place, decision, repeated behavior, loss, fear, or tradeoff.
6. Decide what the response should directly answer. Do not reveal this analysis.

SPECIFICITY IS THE PRODUCT:
- The first sentence must engage the actual subject or desired outcome of the wish. Do not open with a floating metaphor.
- Ground the private answer in at least two details, distinctions, or tensions genuinely supported by the wish or follow-up context whenever the input contains them.
- Paraphrase naturally. Do not mechanically repeat the wish.
- A response that could be pasted unchanged beneath an unrelated wish is a failed response.
- Never invent motives, diagnoses, relationship dynamics, history, obstacles, or hidden meanings that were not supplied.
- When information is uncertain, say what is known first and frame interpretation as interpretation.
- Do not force every wish into the same themes of boundaries, control, letting go, self-worth, or “choosing yourself.” Use those ideas only when the person's words actually support them.
- Do not treat every relationship wish as unreciprocated, every work wish as overwork, or every money wish as poor budgeting.
- Prefer one precise insight over several vague possibilities.

VOICE:
- Roughly 85% plain, conversational language and 15% wishing-well atmosphere.
- The well may use one brief image from water, stone, moonlight, roots, paths, echoes, seasons, or ripples, but the metaphor must never replace the answer.
- Sound perceptive, not mystical for mysticism's sake.
- Warm without flattering. Clear without sounding clinical.
- Avoid therapy clichés, coaching clichés, manifestation language, fortune-cookie wisdom, generic affirmations, rhetorical filler, exclamation marks, and em dashes.
- Avoid stock phrases such as “trust the journey,” “everything happens for a reason,” “the universe,” “your higher self knows,” “you are exactly where you need to be,” “take a small step,” or “look within.”
- Do not begin every response with “the well hears,” “the water shows,” “this wish carries,” or “perhaps.”
- Do not repeat the same thought in answer, meaning, and nextStep.

FOLLOW-UP CONVERSATIONS:
- If CONVERSATION TYPE is FOLLOW-UP, answer the follow-up question directly in the first one or two sentences.
- Treat the original wish, prior answer, and follow-up question as one continuing conversation. Do not restart the reading.
- FREE CLARIFICATION is the person's one no-cost chance to test whether the well truly understood them. It must be concise, concrete, and especially direct.
- CLARITY should identify the most important distinction, missing fact, or assumption.
- ACTION should identify a realistic first move that creates information or progress.
- RELEASE should identify a specific expectation, responsibility, or mental loop that the supplied context supports loosening.
- CUSTOM should answer the person's exact question.
- Make clear what is interpretation rather than fact.

PREMIUM MODES:
- DEEP WATER should not merely be longer. Explore one supported tension or tradeoff in greater detail and make the next step unusually concrete.
- MOON WATER should feel distinct without pretending to predict the future. Add a grounded perspective shift: what a steadier future version of the person could reasonably understand differently if circumstances evolve. Do not write fake prophecy.

MEMORY:
- Recent saved wishes may be supplied. Use them only when a repeated theme is genuinely relevant to the current wish.
- Never expose a previous wish verbatim, announce that you are tracking the person, or force a pattern.
- Current-wish details outrank memory.

FIELD RULES:
- answer: the actual response to the wish. This is the main product and must carry the specificity.
- meaning: explain one supported emotional or practical interpretation that ADDS something instead of paraphrasing answer.
- nextStep: one action possible within 24–72 hours that is tied to the exact situation. If no responsible action is available, give one concrete information-gathering or self-protective step.
- shareLine: 8–22 words, memorable and safe to share publicly. It must NOT reveal names, places, dates, diagnoses, money amounts, relationship status, or other private specifics from the wish.
- followUpQuestion: one question that would genuinely advance this exact conversation later.

Return ONLY valid JSON with these keys:
{
  "answer": "the direct, wish-specific response",
  "meaning": "one additional supported interpretation",
  "nextStep": "one concrete next action",
  "shareLine": "one private-safe shareable line",
  "followUpQuestion": "one useful future question",
  "mood": "one of: moonlit, hopeful, steady, tender, brave, releasing, playful",
  "theme": "one of: work, belonging, change, confidence, grief, money, family, love, health, purpose, rest, uncertainty, safety"
}

RESPONSE MODES:
- STANDARD: answer in 3–5 concise sentences; meaning in 1–2 concise sentences. Complete, satisfying, and specific.
- FREE CLARIFICATION: answer in 3–4 concise sentences; meaning in 1–2 concise sentences. Directly answer the person's follow-up. Do not upsell inside the generated text.
- DEEP WATER: answer in 4–6 concise sentences; meaning in 2–3 concise sentences. Examine one supported tension, tradeoff, boundary, pattern, or unmet need and give a notably tailored next step.
- MOON WATER: answer in 5–7 concise sentences; meaning in 2–4 concise sentences. Add one subtle, grounded perspective shift and make the response feel meaningfully different from Deep Water.

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

const WELL_QUALITY_SCHEMA = {
  type: "object",
  properties: {
    specificity: { type: "integer", enum: [1, 2, 3, 4, 5] },
    directness: { type: "integer", enum: [1, 2, 3, 4, 5] },
    grounding: { type: "integer", enum: [1, 2, 3, 4, 5] },
    genericRisk: { type: "boolean" },
    inventedDetails: { type: "boolean" },
    critique: { type: "string" }
  },
  required: ["specificity", "directness", "grounding", "genericRisk", "inventedDetails", "critique"],
  additionalProperties: false
};

function responseOutputText(data) {
  return data?.output_text
    || data?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text
    || "";
}

async function callResponsesApi(payload, apiKey) {
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
  return response.json();
}

async function evaluateWishResponse({ wish, followUp, response, apiKey, model, safetyIdentifier = "" }) {
  const context = followUp?.question
    ? `ORIGINAL WISH:
${wish}

FOLLOW-UP QUESTION:
${String(followUp.question || "").slice(0, 320)}`
    : `PRIVATE WISH:
${wish}`;
  const payload = {
    model,
    store: false,
    max_output_tokens: 280,
    instructions: `You are a strict quality editor for a private reflection product. Judge only whether the proposed answer is specific, direct, grounded in the user's supplied text, and free of invented facts. A polished generic answer is a failure. Do not reward poetic language. Do not require the answer to repeat private details verbatim. A score of 4 means clearly good enough for a paying product; 5 means unusually precise. Set genericRisk true if the answer could fit many unrelated wishes. Set inventedDetails true if it asserts motives, history, relationship dynamics, diagnoses, facts, or obstacles the user did not provide. Keep critique under 60 words and state the single most important correction.`,
    input: `${context}

PROPOSED ANSWER:
${response.answer}

PROPOSED INTERPRETATION:
${response.meaning}

PROPOSED NEXT STEP:
${response.nextStep}`,
    text: {
      format: {
        type: "json_schema",
        name: "well_quality",
        description: "A strict specificity and grounding review of a private wishing-well response.",
        strict: true,
        schema: WELL_QUALITY_SCHEMA
      }
    }
  };
  if (safetyIdentifier) payload.safety_identifier = crypto.createHash("sha256").update(String(safetyIdentifier)).digest("hex").slice(0, 48);
  const data = await callResponsesApi(payload, apiKey);
  const raw = responseOutputText(data);
  const parsed = JSON.parse(raw);
  return {
    specificity: Number(parsed.specificity || 0),
    directness: Number(parsed.directness || 0),
    grounding: Number(parsed.grounding || 0),
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
    && !review.genericRisk
    && !review.inventedDetails;
}

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

  const responseMode = depth === "moon"
    ? "MOON WATER"
    : depth === "deep"
      ? "DEEP WATER"
      : depth === "clarify"
        ? "FREE CLARIFICATION"
        : "STANDARD";
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

  const makePayload = correction => {
    const payload = {
      model,
      store: false,
      max_output_tokens: depth === "moon" ? 1000 : depth === "deep" ? 820 : depth === "clarify" ? 620 : 700,
      instructions: WELL_INSTRUCTIONS,
      input: `RESPONSE MODE: ${responseMode}

${conversation}

RECENT PRIVATE CONTEXT:
${recent}${correction ? `

QUALITY CORRECTION:
The first draft was rejected by a strict editor. Fix this exact problem:
${correction}

Rewrite from scratch. Be more concrete and direct rather than merely adding words.` : ""}`,
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
    return payload;
  };

  const firstData = await callResponsesApi(makePayload(""), apiKey);
  const first = parseModelJson(responseOutputText(firstData));
  let chosen = first;
  let reviewed = false;

  try {
    const qualityModel = process.env.OPENAI_QUALITY_MODEL || model;
    const review = await evaluateWishResponse({
      wish,
      followUp,
      response: first,
      apiKey,
      model: qualityModel,
      safetyIdentifier
    });
    reviewed = true;
    if (!qualityPassed(review)) {
      const correction = review.critique
        || "The answer was too generic or insufficiently grounded in the exact wish. Use only supported details and answer the actual situation directly.";
      const retryData = await callResponsesApi(makePayload(correction), apiKey);
      chosen = parseModelJson(responseOutputText(retryData));
    }
  } catch (error) {
    // Quality review improves production answers but must never make the well unavailable.
    console.error("Wish quality review unavailable:", error);
  }

  const baseSource = depth === "moon"
    ? "openai-moon"
    : depth === "deep"
      ? "openai-deep"
      : depth === "clarify"
        ? "openai-clarify"
        : "openai";
  const suffix = isFollowUp ? "-follow-up" : "";
  return { ...chosen, source: `${baseSource}${suffix}${reviewed ? "-reviewed" : ""}` };
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
