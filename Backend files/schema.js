import Joi from "joi";
import {
  CARD_TYPES,
  CARD_TIERS,
  BACKGROUND_TYPES,
  LOCK_TYPES,
  AMBIENT_EFFECT_TYPES,
  OPEN_EFFECT_TYPES,
  ENTRY_ANIMATIONS,
} from "./constants.js";

const slug = Joi.string().trim().min(3).max(64).pattern(/^[A-Za-z0-9_-]+$/);

const colorSchema = Joi.string().trim().min(1).max(50);
const timestampSchema = Joi.date().iso();

const baseEnhancementsSchema = Joi.object({
  background: Joi.object({
    type: Joi.string().valid(...BACKGROUND_TYPES).default("color"),
    value: Joi.string().allow("").default(""),
    videoSettings: Joi.object({
      blur: Joi.number().min(0).max(100).default(0),
      darkTint: Joi.number().min(0).max(1).default(0),
      tintLevel: Joi.number().min(0).max(1).default(0),
      tintColor: colorSchema.allow("").default(""),
    }).default(),
    gradientAnimation: Joi.object({
      enabled: Joi.boolean().default(false),
      duration: Joi.number().min(0).max(120).default(0),
    }).default(),
  }).default(),
  music: Joi.object({
    track: Joi.string().allow("").default(""),
    volume: Joi.number().min(0).max(1).default(0),
  }).default(),
  lock: Joi.object({
    type: Joi.string().valid(...LOCK_TYPES).default("none"),
    value: Joi.alternatives()
      .try(Joi.string().allow(""), Joi.number())
      .default(""),
  }).default(),
  ambientEffect: Joi.object({
    type: Joi.string().valid(...AMBIENT_EFFECT_TYPES).default("none"),
    emojis: Joi.array().items(Joi.string().trim().max(10)).default([]),
  }).default(),
  openEffect: Joi.object({
    type: Joi.string().valid(...OPEN_EFFECT_TYPES).default("none"),
    colors: Joi.array().items(colorSchema).length(3).default(["", "", ""]),
  }).default(),
  media: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid("image").required(),
        url: Joi.string().trim().uri().required(),
      }),
    )
    .default([]),
  animation: Joi.object({
    entry: Joi.string().valid(...ENTRY_ANIMATIONS).default("fade"),
    speed: Joi.number().min(0.1).max(10).default(1),
  }).default(),
}).default();

const personalContentSchema = Joi.object({
  header: Joi.string().trim().min(1).max(200).required(),
  body: Joi.string().trim().min(1).max(4000).required(),
  questionBlock: Joi.object({
    enabled: Joi.boolean().default(false),
    question: Joi.string().trim().allow("").max(500).default(""),
    suspenseTexts: Joi.array().items(Joi.string().trim().max(250)).default([]),
    answerType: Joi.string().valid("yes_no").default("yes_no"),
  }).default(),
});

const pollContentSchema = Joi.object({
  question: Joi.string().trim().min(1).max(500).required(),
  options: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().trim().min(1).max(100).required(),
        text: Joi.string().trim().min(1).max(300).required(),
      }),
    )
    .min(2)
    .max(25)
    .required(),
});

const chainContentSchema = Joi.object({
  challenge: Joi.string().trim().min(1).max(600).required(),
  rules: Joi.array().items(Joi.string().trim().min(1).max(300)).max(25).default([]),
});

const triviaQuestionSchema = Joi.object({
  question: Joi.string().trim().min(1).max(500).required(),
  options: Joi.array()
    .items(Joi.string().trim().min(1).max(300))
    .min(2)
    .max(8)
    .required(),
  correctIndex: Joi.number().integer().min(0).required(),
});

const triviaContentSchema = Joi.object({
  questions: Joi.array().items(triviaQuestionSchema).min(1).max(50).required(),
});

const anonymousContentSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
});

const configSchema = Joi.object({
  colors: Joi.object({
    background: colorSchema.required(),
    accent: colorSchema.required(),
    gradient: Joi.array().items(colorSchema).length(2).required(),
  }).required(),
  font: Joi.string().trim().min(1).max(120).required(),
  content: Joi.object().required(),
}).required();

const layoutDataSchema = Joi.object({
  tier: Joi.string().valid(...CARD_TIERS),
  paperTexture: Joi.object({
    type: Joi.string().trim().max(120).default("none"),
    opacity: Joi.number().min(0).max(1).default(0),
    blendMode: Joi.string().trim().max(120).default("normal"),
  }).default(),
}).unknown(true);

const baseCreateSchema = Joi.object({
  id: Joi.string().trim().min(1).max(120),
  type: Joi.string().valid(...CARD_TYPES).required(),
  tier: Joi.string().valid(...CARD_TIERS).required(),
  config: configSchema.required(),
  layoutdata: layoutDataSchema.default(),
  enhancements: baseEnhancementsSchema,
  state: Joi.object().unknown(true),
  meta: Joi.object({
    creatorId: Joi.string().trim().min(1).max(120),
    createdAt: timestampSchema,
  }),
});

const withTypeSpecificContent = (schema) =>
  schema.custom((value, helpers) => {
    const type = value.type;
    let contentSchema = null;

    if (type === "personal") contentSchema = personalContentSchema;
    if (type === "poll") contentSchema = pollContentSchema;
    if (type === "chain") contentSchema = chainContentSchema;
    if (type === "trivia") contentSchema = triviaContentSchema;
    if (type === "anonymous") contentSchema = anonymousContentSchema;

    if (!contentSchema) {
      return helpers.error("any.custom", { message: "Unsupported card type" });
    }

    const { error } = contentSchema.validate(value.config?.content, {
      abortEarly: false,
      allowUnknown: false,
    });
    if (error) {
      return helpers.error("any.custom", {
        message: `Invalid config.content for ${type}: ${error.details
          .map((d) => d.message)
          .join(", ")}`,
      });
    }

    if (type === "trivia") {
      const questions = value.config?.content?.questions || [];
      const invalidQuestion = questions.find(
        (q) => q.correctIndex < 0 || q.correctIndex >= q.options.length,
      );
      if (invalidQuestion) {
        return helpers.error("any.custom", {
          message: "Each trivia question must have a correctIndex within options range",
        });
      }
    }

    return value;
  }, "type-specific content validation");

const createCardBodySchema = withTypeSpecificContent(baseCreateSchema);

const withForced = ({ forcedType, forcedTier }) => {
  const schema = createCardBodySchema.keys({
    type: forcedType ? Joi.forbidden() : Joi.string().valid(...CARD_TYPES).required(),
    tier: forcedTier ? Joi.forbidden() : Joi.string().valid(...CARD_TIERS).required(),
  });
  return schema;
};

export const cardSchemas = {
  create: { body: createCardBodySchema },
  createClassic: { body: withForced({ forcedTier: "classic" }) },
  createPremium: { body: withForced({ forcedTier: "premium" }) },
  createElite: { body: withForced({ forcedTier: "elite" }) },
  createAnonymous: { body: withForced({ forcedType: "anonymous", forcedTier: "elite" }) },
  createClassicPoll: { body: withForced({ forcedType: "poll", forcedTier: "classic" }) },
  createElitePoll: { body: withForced({ forcedType: "poll", forcedTier: "elite" }) },
  createClassicChain: { body: withForced({ forcedType: "chain", forcedTier: "classic" }) },
  createEliteChain: { body: withForced({ forcedType: "chain", forcedTier: "elite" }) },
  createClassicTrivia: { body: withForced({ forcedType: "trivia", forcedTier: "classic" }) },
  createEliteTrivia: { body: withForced({ forcedType: "trivia", forcedTier: "elite" }) },
  createClassicAnonymous: {
    body: withForced({ forcedType: "anonymous", forcedTier: "classic" }),
  },
  createEliteAnonymous: {
    body: withForced({ forcedType: "anonymous", forcedTier: "elite" }),
  },
  update: {
    body: Joi.object({
      cardId: Joi.string().trim().min(1).max(120).required(),
      config: configSchema,
      layoutdata: layoutDataSchema,
      enhancements: baseEnhancementsSchema,
    }).or("config", "enhancements", "layoutdata"),
  },
  delete: {
    body: Joi.object({
      cardId: Joi.string().trim().min(1).max(120).required(),
    }),
  },
  getBySlug: {
    params: Joi.object({ slug: slug.required() }),
    query: Joi.object({
      password: Joi.string().trim().max(120),
    }),
  },
  respond: {
    params: Joi.object({ slug: slug.required() }),
    body: Joi.object({
      answer: Joi.string().valid("yes", "no").insensitive(),
      response: Joi.string().valid("yes", "no").insensitive(),
      password: Joi.string().trim().max(120),
    }).or("answer", "response"),
  },
  pollVote: {
    params: Joi.object({ slug: slug.required() }),
    body: Joi.object({
      optionId: Joi.string().trim().min(1).max(100),
      optionIndex: Joi.number().integer().min(0),
      password: Joi.string().trim().max(120),
    }).xor("optionId", "optionIndex"),
  },
  chainReply: {
    params: Joi.object({ slug: slug.required() }),
    body: Joi.object({
      response: Joi.string().trim().min(1).max(1000),
      message: Joi.string().trim().min(1).max(1000),
      name: Joi.string().trim().min(1).max(50),
      password: Joi.string().trim().max(120),
    }).or("response", "message"),
  },
  anonymousMessage: {
    params: Joi.object({ slug: slug.required() }),
    body: Joi.object({
      text: Joi.string().trim().min(1).max(1000),
      message: Joi.string().trim().min(1).max(1000),
      password: Joi.string().trim().max(120),
    }).or("text", "message"),
  },
  triviaSubmit: {
    params: Joi.object({ slug: slug.required() }),
    body: Joi.object({
      answers: Joi.array().items(Joi.number().integer().min(0)).min(1).required(),
      name: Joi.string().trim().min(1).max(50),
      password: Joi.string().trim().max(120),
    }),
  },
};
