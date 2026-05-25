import { v4 as uuidv4 } from "uuid";
import {
  CARD_TYPES,
  CARD_TIERS,
  CARD_COSTS,
} from "./constants.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeObjects(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  for (const [key, val] of Object.entries(override)) {
    const baseVal = out[key];
    if (
      baseVal
      && typeof baseVal === "object"
      && !Array.isArray(baseVal)
      && val
      && typeof val === "object"
      && !Array.isArray(val)
    ) {
      out[key] = mergeObjects(baseVal, val);
    } else {
      out[key] = deepClone(val);
    }
  }
  return out;
}

function buildDefaultContent(type) {
  if (type === "personal") {
    return {
      header: "",
      body: "",
      questionBlock: {
        enabled: false,
        question: "",
        suspenseTexts: [],
        answerType: "yes_no",
      },
    };
  }
  if (type === "poll") {
    return { question: "", options: [] };
  }
  if (type === "chain") {
    return { challenge: "", rules: [] };
  }
  if (type === "trivia") {
    return { questions: [] };
  }
  return { message: "" };
}

function buildDefaultState(type, configContent = {}) {
  if (type === "personal") {
    return { answers: [] };
  }
  if (type === "poll") {
    const options = Array.isArray(configContent.options) ? configContent.options : [];
    const counts = {};
    for (const option of options) {
      if (option?.id) counts[option.id] = 0;
    }
    return { votes: [], counts };
  }
  if (type === "chain") {
    return { responses: [] };
  }
  if (type === "trivia") {
    return { players: [] };
  }
  return { responses: [] };
}

function buildDefaultLayoutData() {
  return {
    tier: "classic",
    paperTexture: {
      type: "none",
      opacity: 0,
      blendMode: "normal",
    },
  };
}

export function buildDefaultEnhancements() {
  return {
    background: {
      type: "color",
      value: "",
      videoSettings: {
        blur: 0,
        darkTint: 0,
        tintLevel: 0,
        tintColor: "",
      },
      gradientAnimation: {
        enabled: false,
        duration: 0,
      },
    },
    music: {
      track: "",
      volume: 0,
    },
    lock: {
      type: "none",
      value: "",
    },
    ambientEffect: {
      type: "none",
      emojis: [],
    },
    openEffect: {
      type: "none",
      colors: ["", "", ""],
    },
    media: [],
    animation: {
      entry: "fade",
      speed: 1,
    },
  };
}

function ensureTierAndType(type, tier) {
  if (!CARD_TYPES.includes(type)) {
    throw new Error(`Unsupported card type: ${type}`);
  }
  if (!CARD_TIERS.includes(tier)) {
    throw new Error(`Unsupported card tier: ${tier}`);
  }
  if (tier === "premium" && type !== "personal") {
    throw new Error("Premium tier is only allowed for personal cards");
  }
}

function assertNoInvalidEnhancements(type, tier, enhancements) {
  if (tier === "classic") {
    const defaults = buildDefaultEnhancements();
    const merged = mergeObjects(defaults, enhancements || {});
    const hasAnyEnhancement = JSON.stringify(merged) !== JSON.stringify(defaults);
    if (hasAnyEnhancement) {
      throw new Error("Classic cards cannot enable enhancements");
    }
    return defaults;
  }

  const merged = mergeObjects(buildDefaultEnhancements(), enhancements || {});

  if (tier === "premium") {
    if (type !== "personal") {
      throw new Error("Premium tier is only allowed for personal cards");
    }
    if (merged.background.type === "video") {
      throw new Error("Premium cards cannot use video backgrounds");
    }
    if (merged.music.track || merged.music.volume > 0) {
      throw new Error("Premium cards cannot enable music");
    }
    if (merged.openEffect.type !== "none") {
      throw new Error("Premium cards cannot enable openEffect");
    }
    if (Array.isArray(merged.media) && merged.media.length > 0) {
      throw new Error("Premium cards cannot add media");
    }

    return {
      ...merged,
      music: buildDefaultEnhancements().music,
      openEffect: buildDefaultEnhancements().openEffect,
      media: [],
    };
  }

  return merged;
}

function assertStateConsistency(card) {
  if (card.type === "poll") {
    const optionIds = new Set((card.config.content.options || []).map((o) => o.id));
    const votes = Array.isArray(card.state.votes) ? card.state.votes : [];
    const seenUsers = new Set();
    const derivedCounts = {};

    for (const optionId of optionIds) {
      derivedCounts[optionId] = 0;
    }

    for (const vote of votes) {
      if (seenUsers.has(vote.userId)) {
        throw new Error("Poll state invalid: duplicate user votes");
      }
      seenUsers.add(vote.userId);
      if (!optionIds.has(vote.optionId)) {
        throw new Error("Poll state invalid: vote optionId not found in options");
      }
      derivedCounts[vote.optionId] = (derivedCounts[vote.optionId] || 0) + 1;
    }

    const currentCounts = card.state.counts || {};
    for (const optionId of optionIds) {
      if ((currentCounts[optionId] || 0) !== (derivedCounts[optionId] || 0)) {
        throw new Error("Poll state invalid: counts are inconsistent with votes");
      }
    }
  }

  if (card.type === "personal") {
    const answers = Array.isArray(card.state.answers) ? card.state.answers : [];
    const users = new Set();
    for (const answer of answers) {
      if (users.has(answer.userId)) {
        throw new Error("Personal state invalid: duplicate answers for same user");
      }
      users.add(answer.userId);
    }
  }

  if (card.type === "trivia") {
    const players = Array.isArray(card.state.players) ? card.state.players : [];
    const users = new Set();
    for (const player of players) {
      if (users.has(player.userId)) {
        throw new Error("Trivia state invalid: duplicate players for same user");
      }
      users.add(player.userId);
    }
  }
}

export function sanitizeCardForTier(cardInput, { forcedType, forcedTier, creatorId }) {
  const type = String(forcedType || cardInput.type || "").toLowerCase();
  const tier = String(forcedTier || cardInput.tier || "").toLowerCase();

  ensureTierAndType(type, tier);

  const config = mergeObjects(
    {
      colors: { background: "", accent: "", gradient: ["", ""] },
      font: "",
      content: buildDefaultContent(type),
    },
    cardInput.config || {},
  );

  const enhancements = assertNoInvalidEnhancements(type, tier, cardInput.enhancements);
  const defaultState = buildDefaultState(type, config.content);
  const state = mergeObjects(defaultState, cardInput.state || {});
  const layoutdata = mergeObjects(buildDefaultLayoutData(), cardInput.layoutdata || {});
  layoutdata.tier = tier;

  const card = {
    id: String(cardInput.id || uuidv4()),
    type,
    tier,
    config,
    enhancements,
    layoutdata,
    state,
    meta: {
      creatorId,
      createdAt: cardInput.meta?.createdAt ? new Date(cardInput.meta.createdAt) : new Date(),
    },
  };

  assertStateConsistency(card);
  return card;
}

export function applyCardPatch(existingCard, patch) {
  const next = deepClone(existingCard);
  if (patch.config) {
    next.config = mergeObjects(next.config, patch.config);
  }
  if (patch.enhancements) {
    next.enhancements = mergeObjects(next.enhancements, patch.enhancements);
  }
  if (patch.layoutdata) {
    next.layoutdata = mergeObjects(next.layoutdata || buildDefaultLayoutData(), patch.layoutdata);
  }

  const sanitized = sanitizeCardForTier(next, {
    forcedType: existingCard.type,
    forcedTier: existingCard.tier,
    creatorId: existingCard.meta?.creatorId || existingCard.userId,
  });
  return sanitized;
}

export function evaluateCardLock(card, providedValue) {
  const lock = card?.enhancements?.lock || { type: "none", value: "" };
  const lockType = String(lock.type || "none").toLowerCase();

  if (lockType === "password") {
    const expected = String(lock.value || "").trim();
    const candidate = String(providedValue || "").trim();
    if (!expected || candidate !== expected) {
      return {
        locked: true,
        status: 403,
        message: "Password required to access this card",
        lockType: "password",
      };
    }
  }

  if (lockType === "timer") {
    const rawValue = lock.value;
    let unlockAt = null;
    if (typeof rawValue === "number") {
      unlockAt = new Date(rawValue);
    } else {
      unlockAt = new Date(String(rawValue || ""));
    }
    if (Number.isNaN(unlockAt.getTime()) || new Date() < unlockAt) {
      return {
        locked: true,
        status: 403,
        message: "Card is locked until timer expires",
        lockType: "timer",
        unlockAt: Number.isNaN(unlockAt.getTime()) ? null : unlockAt,
      };
    }
  }

  return { locked: false };
}

export function sanitizeCardForClient(card) {
  const safe = deepClone(card);
  if (safe?.enhancements?.lock?.type === "password") {
    safe.enhancements.lock.value = "";
  }
  if (safe?.type === "trivia" && Array.isArray(safe?.config?.content?.questions)) {
    safe.config.content.questions = safe.config.content.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
    }));
  }
  return safe;
}

export function buildCardRenderModel(card, viewer = {}) {
  const safeCard = sanitizeCardForClient(card);
  const viewerId = viewer?.userId || null;

  const base = {
    id: safeCard.id,
    type: safeCard.type,
    tier: safeCard.tier,
    layoutdata: safeCard.layoutdata,
    visuals: {
      typography: { font: safeCard.config.font },
      palette: safeCard.config.colors,
      background: safeCard.enhancements.background,
      animation: safeCard.enhancements.animation,
      ambientEffect: safeCard.enhancements.ambientEffect,
      openEffect: safeCard.enhancements.openEffect,
      media: safeCard.enhancements.media || [],
      music: safeCard.enhancements.music,
    },
    content: safeCard.config.content,
    lock: safeCard.enhancements.lock,
  };

  if (safeCard.type === "personal") {
    const answers = safeCard.state.answers || [];
    const yesCount = answers.filter((a) => a.answer === "yes").length;
    const noCount = answers.filter((a) => a.answer === "no").length;
    const viewerAnswer = viewerId
      ? answers.find((a) => a.userId === viewerId)?.answer || null
      : null;
    return {
      ...base,
      interaction: {
        kind: "yes_no",
        yesCount,
        noCount,
        totalResponses: answers.length,
        viewerAnswer,
      },
    };
  }

  if (safeCard.type === "poll") {
    const votes = safeCard.state.votes || [];
    const counts = safeCard.state.counts || {};
    return {
      ...base,
      interaction: {
        kind: "poll",
        options: (safeCard.config.content.options || []).map((option) => ({
          id: option.id,
          text: option.text,
          votes: counts[option.id] || 0,
        })),
        totalVotes: votes.length,
        viewerVote: viewerId
          ? votes.find((vote) => vote.userId === viewerId)?.optionId || null
          : null,
      },
    };
  }

  if (safeCard.type === "chain") {
    return {
      ...base,
      interaction: {
        kind: "chain",
        responses: safeCard.state.responses || [],
        responseCount: Array.isArray(safeCard.state.responses)
          ? safeCard.state.responses.length
          : 0,
      },
    };
  }

  if (safeCard.type === "trivia") {
    return {
      ...base,
      interaction: {
        kind: "trivia",
        players: safeCard.state.players || [],
      },
    };
  }

  return {
    ...base,
    interaction: {
      kind: "anonymous",
      responses: safeCard.state.responses || [],
      responseCount: Array.isArray(safeCard.state.responses)
        ? safeCard.state.responses.length
        : 0,
    },
  };
}

export function getCardCost(type, tier) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedTier = String(tier || "").toLowerCase();
  const byType = CARD_COSTS[normalizedType];
  if (!byType) return 0;
  const price = byType[normalizedTier];
  return Number.isFinite(price) ? price : 0;
}
