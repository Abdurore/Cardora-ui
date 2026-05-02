import { nanoid } from "nanoid";
import { client } from "../config/db.js";
import { DB_NAME, DEFAULT_CURRENCY } from "../config/constants.js";
import { sanitizeWorldChatMessage } from "./chatController.js";
import {
  applyCardPatch,
  buildCardRenderModel,
  evaluateCardLock,
  getCardCost,
  sanitizeCardForClient,
  sanitizeCardForTier,
} from "../cards/engine.js";

async function generateUniqueSlug() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = nanoid(12);
    const exists = await client.db(DB_NAME).collection("cards").findOne({ slug: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Failed to generate unique slug");
}

async function createCardInternal(req, res, { forcedType, forcedTier } = {}) {
  try {
    const userId = req.user.id;
    const user = await client.db(DB_NAME).collection("users").findOne({ id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const normalizedCard = sanitizeCardForTier(req.body, {
      forcedType,
      forcedTier,
      creatorId: userId,
    });

    const requiredCC = getCardCost(normalizedCard.type, normalizedCard.tier);
    const availableCC = user.cc ?? user.cardoraCoupons ?? 0;
    if (availableCC < requiredCC) {
      return res.status(400).json({
        message: `Not enough CC. ${requiredCC} required.`,
      });
    }

    const slug = await generateUniqueSlug();
    const createdAt = new Date();

    const dbCard = {
      ...normalizedCard,
      userId,
      slug,
      views: 0,
      currency: user.currency || DEFAULT_CURRENCY,
      updatedAt: createdAt,
      createdAt,
    };

    await client.db(DB_NAME).collection("cards").insertOne(dbCard);
    await client.db(DB_NAME).collection("users").updateOne(
      { id: userId },
      {
        $inc: { cc: -requiredCC },
        $set: {
          lastCardCreatedAt: createdAt,
          cardReminderThresholdsSent: [],
        },
      },
    );

    return res.status(201).json({
      message: "Card created successfully",
      cardId: dbCard.id,
      slug,
      type: dbCard.type,
      tier: dbCard.tier,
      couponsCharged: requiredCC,
      remainingCC: availableCC - requiredCC,
      card: sanitizeCardForClient(dbCard),
      renderModel: buildCardRenderModel(dbCard, { userId }),
    });
  } catch (err) {
    console.error("Create card error:", err);
    return res.status(400).json({ message: err.message || "Failed to create card" });
  }
}

export async function createCard(req, res) {
  return createCardInternal(req, res);
}

export async function createClassicCard(req, res) {
  return createCardInternal(req, res, { forcedTier: "classic" });
}

export async function createPremiumCard(req, res) {
  return createCardInternal(req, res, { forcedTier: "premium" });
}

export async function createEliteCard(req, res) {
  return createCardInternal(req, res, { forcedTier: "elite" });
}

export async function createAnonymousCard(req, res) {
  return createCardInternal(req, res, { forcedType: "anonymous", forcedTier: "elite" });
}

export async function createClassicPollCard(req, res) {
  return createCardInternal(req, res, { forcedType: "poll", forcedTier: "classic" });
}

export async function createElitePollCard(req, res) {
  return createCardInternal(req, res, { forcedType: "poll", forcedTier: "elite" });
}

export async function createClassicChainCard(req, res) {
  return createCardInternal(req, res, { forcedType: "chain", forcedTier: "classic" });
}

export async function createEliteChainCard(req, res) {
  return createCardInternal(req, res, { forcedType: "chain", forcedTier: "elite" });
}

export async function createClassicTriviaCard(req, res) {
  return createCardInternal(req, res, { forcedType: "trivia", forcedTier: "classic" });
}

export async function createEliteTriviaCard(req, res) {
  return createCardInternal(req, res, { forcedType: "trivia", forcedTier: "elite" });
}

export async function createClassicAnonymousCard(req, res) {
  return createCardInternal(req, res, { forcedType: "anonymous", forcedTier: "classic" });
}

export async function createEliteAnonymousCard(req, res) {
  return createCardInternal(req, res, { forcedType: "anonymous", forcedTier: "elite" });
}

export async function updateCard(req, res) {
  try {
    const userId = req.user.id;
    const { cardId, config, layoutdata, enhancements } = req.body;
    const card = await client.db(DB_NAME).collection("cards").findOne({ id: cardId });

    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.userId !== userId) {
      return res.status(403).json({ message: "You can only update your own cards" });
    }

    const patched = applyCardPatch(card, { config, layoutdata, enhancements });
    patched.updatedAt = new Date();

    await client.db(DB_NAME).collection("cards").updateOne(
      { id: cardId },
      {
        $set: {
          config: patched.config,
          layoutdata: patched.layoutdata,
          enhancements: patched.enhancements,
          updatedAt: patched.updatedAt,
        },
      },
    );

    return res.status(200).json({
      message: "Card updated successfully",
      card: sanitizeCardForClient({ ...card, ...patched }),
      renderModel: buildCardRenderModel({ ...card, ...patched }, { userId }),
    });
  } catch (err) {
    console.error("Update card error:", err);
    return res.status(400).json({ message: err.message || "Failed to update card" });
  }
}

export async function deleteCard(req, res) {
  try {
    const userId = req.user.id;
    const { cardId } = req.body;

    const card = await client.db(DB_NAME).collection("cards").findOne({ id: cardId });
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.userId !== userId) {
      return res.status(403).json({ message: "You can only delete your own cards" });
    }

    await client.db(DB_NAME).collection("cards").deleteOne({ id: cardId });
    return res.status(200).json({ message: "Card deleted successfully" });
  } catch (err) {
    console.error("Delete card error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getCardBySlug(req, res) {
  try {
    const { slug } = req.params;
    const { password } = req.query;
    const viewerId = req.user?.id || null;

    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });
    if (!card) return res.status(404).json({ message: "Card not found" });

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    await client.db(DB_NAME).collection("cards").updateOne({ slug }, { $inc: { views: 1 } });
    const hydratedCard = { ...card, views: (card.views || 0) + 1 };

    return res.status(200).json({
      message: "Card retrieved successfully",
      card: sanitizeCardForClient(hydratedCard),
      renderModel: buildCardRenderModel(hydratedCard, { userId: viewerId }),
    });
  } catch (err) {
    console.error("Get card by slug error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function respondToCard(req, res) {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const { answer, response, password } = req.body;
    const normalizedAnswer = String(answer || response || "").toLowerCase();

    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.type !== "personal") {
      return res.status(400).json({ message: "This endpoint is for personal cards only" });
    }

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    const questionBlock = card?.config?.content?.questionBlock || {};
    if (!questionBlock.enabled || questionBlock.answerType !== "yes_no") {
      return res.status(400).json({ message: "This card does not accept yes/no responses" });
    }
    if (!["yes", "no"].includes(normalizedAnswer)) {
      return res.status(400).json({ message: "Answer must be 'yes' or 'no'" });
    }

    const update = await client
      .db(DB_NAME)
      .collection("cards")
      .updateOne(
        { slug, "state.answers.userId": { $ne: userId } },
        {
          $push: {
            "state.answers": {
              userId,
              answer: normalizedAnswer,
            },
          },
        },
      );

    if (update.matchedCount === 0) {
      return res.status(400).json({ message: "You already responded to this card" });
    }

    return res.status(200).json({
      message: "Response recorded",
      answer: normalizedAnswer,
    });
  } catch (err) {
    console.error("Personal response error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function submitPollVote(req, res) {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const { optionId, optionIndex, password } = req.body;
    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });

    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.type !== "poll") return res.status(400).json({ message: "Card is not a poll" });

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    const options = Array.isArray(card?.config?.content?.options)
      ? card.config.content.options
      : [];
    const finalOptionId =
      optionId
      || (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < options.length
        ? options[optionIndex].id
        : null);

    if (!finalOptionId) {
      return res.status(400).json({ message: "Invalid poll option selection" });
    }
    if (!options.some((opt) => opt.id === finalOptionId)) {
      return res.status(400).json({ message: "Selected option does not exist" });
    }

    const update = await client
      .db(DB_NAME)
      .collection("cards")
      .updateOne(
        { slug, "state.votes.userId": { $ne: userId } },
        {
          $push: { "state.votes": { userId, optionId: finalOptionId } },
          $inc: { [`state.counts.${finalOptionId}`]: 1 },
        },
      );

    if (update.matchedCount === 0) {
      return res.status(400).json({ message: "You have already voted" });
    }

    return res.status(200).json({ message: "Vote recorded", optionId: finalOptionId });
  } catch (err) {
    console.error("Poll vote error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function submitChainReply(req, res) {
  try {
    const userId = req.user.id;
    const username = req.user.username || "User";
    const { slug } = req.params;
    const { response, message, password } = req.body;
    const text = sanitizeWorldChatMessage(String(response || message || "").trim());

    if (!text) {
      return res.status(400).json({ message: "response is required" });
    }

    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.type !== "chain") {
      return res.status(400).json({ message: "Card is not a chain card" });
    }

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    const update = await client.db(DB_NAME).collection("cards").updateOne(
      { slug, "state.responses.userId": { $ne: userId } },
      {
        $push: {
          "state.responses": {
            userId,
            name: username,
            response: text,
            timestamp: new Date(),
          },
        },
      },
    );

    if (update.matchedCount === 0) {
      return res.status(400).json({ message: "You already replied to this chain" });
    }

    return res.status(200).json({ message: "Response added" });
  } catch (err) {
    console.error("Chain reply error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function submitAnonymousMessage(req, res) {
  try {
    const { slug } = req.params;
    const { text, message, password } = req.body;
    const normalizedText = sanitizeWorldChatMessage(String(text || message || "").trim());

    if (!normalizedText) {
      return res.status(400).json({ message: "text is required" });
    }

    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.type !== "anonymous") {
      return res.status(400).json({ message: "Card is not an anonymous card" });
    }

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    await client.db(DB_NAME).collection("cards").updateOne(
      { slug },
      {
        $push: {
          "state.responses": {
            id: nanoid(10),
            text: normalizedText,
            timestamp: new Date(),
          },
        },
      },
    );

    return res.status(200).json({ message: "Anonymous response submitted" });
  } catch (err) {
    console.error("Anonymous response error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function submitTriviaAttempt(req, res) {
  try {
    const userId = req.user.id;
    const username = req.user.username || "User";
    const { slug } = req.params;
    const { answers, password } = req.body;

    const card = await client.db(DB_NAME).collection("cards").findOne({ slug });
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (card.type !== "trivia") {
      return res.status(400).json({ message: "Card is not a trivia card" });
    }

    const lockCheck = evaluateCardLock(card, password);
    if (lockCheck.locked) {
      return res.status(lockCheck.status).json({
        message: lockCheck.message,
        lockType: lockCheck.lockType,
        unlockAt: lockCheck.unlockAt || null,
      });
    }

    const questions = Array.isArray(card?.config?.content?.questions)
      ? card.config.content.questions
      : [];
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      return res.status(400).json({
        message: "answers must match the number of trivia questions",
      });
    }

    let score = 0;
    for (let i = 0; i < questions.length; i += 1) {
      const submitted = Number.parseInt(answers[i], 10);
      if (submitted === questions[i].correctIndex) score += 1;
    }

    const updateExisting = await client.db(DB_NAME).collection("cards").updateOne(
      { slug, "state.players.userId": userId },
      {
        $set: {
          "state.players.$.name": username,
          "state.players.$.score": score,
        },
      },
    );

    if (updateExisting.matchedCount === 0) {
      const pushNew = await client.db(DB_NAME).collection("cards").updateOne(
        { slug, "state.players.userId": { $ne: userId } },
        {
          $push: {
            "state.players": {
              userId,
              name: username,
              score,
            },
          },
        },
      );

      if (pushNew.matchedCount === 0) {
        await client.db(DB_NAME).collection("cards").updateOne(
          { slug, "state.players.userId": userId },
          { $set: { "state.players.$.score": score, "state.players.$.name": username } },
        );
      }
    }

    return res.status(200).json({ message: "Trivia submitted", score });
  } catch (err) {
    console.error("Trivia submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
