import { Router } from "express";
import {
  createCard,
  createClassicCard,
  createPremiumCard,
  createEliteCard,
  createAnonymousCard,
  createClassicPollCard,
  createElitePollCard,
  createClassicChainCard,
  createEliteChainCard,
  createClassicTriviaCard,
  createEliteTriviaCard,
  createClassicAnonymousCard,
  createEliteAnonymousCard,
  updateCard,
  deleteCard,
  getCardBySlug,
  respondToCard,
  submitPollVote,
  submitChainReply,
  submitAnonymousMessage,
  submitTriviaAttempt,
} from "../controllers/cardController.js";
import { auth } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { cardSchemas } from "../cards/schema.js";

const router = Router();

const interactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

router.post("/create-card", auth, validate(cardSchemas.create), createCard);
router.post(
  "/create-card/classic",
  auth,
  validate(cardSchemas.createClassic),
  createClassicCard,
);
router.post(
  "/create-card/premium",
  auth,
  validate(cardSchemas.createPremium),
  createPremiumCard,
);
router.post(
  "/create-card/elite",
  auth,
  validate(cardSchemas.createElite),
  createEliteCard,
);
router.post(
  "/create-card/anonymous",
  auth,
  validate(cardSchemas.createAnonymous),
  createAnonymousCard,
);
router.post(
  "/create-card/poll/classic",
  auth,
  validate(cardSchemas.createClassicPoll),
  createClassicPollCard,
);
router.post(
  "/create-card/poll/elite",
  auth,
  validate(cardSchemas.createElitePoll),
  createElitePollCard,
);
router.post(
  "/create-card/chain/classic",
  auth,
  validate(cardSchemas.createClassicChain),
  createClassicChainCard,
);
router.post(
  "/create-card/chain/elite",
  auth,
  validate(cardSchemas.createEliteChain),
  createEliteChainCard,
);
router.post(
  "/create-card/trivia/classic",
  auth,
  validate(cardSchemas.createClassicTrivia),
  createClassicTriviaCard,
);
router.post(
  "/create-card/trivia/elite",
  auth,
  validate(cardSchemas.createEliteTrivia),
  createEliteTriviaCard,
);
router.post(
  "/create-card/anonymous/classic",
  auth,
  validate(cardSchemas.createClassicAnonymous),
  createClassicAnonymousCard,
);
router.post(
  "/create-card/anonymous/elite",
  auth,
  validate(cardSchemas.createEliteAnonymous),
  createEliteAnonymousCard,
);
router.put("/update-card", auth, validate(cardSchemas.update), updateCard);
router.delete("/delete-card", auth, validate(cardSchemas.delete), deleteCard);
router.get("/cards/:slug", validate(cardSchemas.getBySlug), getCardBySlug);
router.post(
  "/cards/:slug/response",
  auth,
  validate(cardSchemas.respond),
  respondToCard,
);
router.post(
  "/cards/:slug/poll-vote",
  auth,
  interactionLimiter,
  validate(cardSchemas.pollVote),
  submitPollVote,
);
router.post(
  "/cards/:slug/chain-reply",
  auth,
  interactionLimiter,
  validate(cardSchemas.chainReply),
  submitChainReply,
);
router.post(
  "/cards/:slug/anonymous-message",
  interactionLimiter,
  validate(cardSchemas.anonymousMessage),
  submitAnonymousMessage,
);
router.post(
  "/cards/:slug/trivia-submit",
  auth,
  interactionLimiter,
  validate(cardSchemas.triviaSubmit),
  submitTriviaAttempt,
);

export default router;
