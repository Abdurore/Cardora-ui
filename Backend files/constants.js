export const CARD_TYPES = ["personal", "trivia", "anonymous", "poll", "chain"];
export const CARD_TIERS = ["classic", "premium", "elite"];

export const BACKGROUND_TYPES = ["color", "gradient", "video", "animated"];
export const LOCK_TYPES = ["none", "tap", "scratch", "timer", "password"];
export const AMBIENT_EFFECT_TYPES = [
  "none",
  "starfield",
  "snow",
  "bubbles",
  "fountain",
  "fireflies",
  "floating",
];
export const OPEN_EFFECT_TYPES = [
  "none",
  "confetti",
  "fireworks",
  "heartsBurst",
  "starShower",
  "balloons",
  "emojiRain",
];
export const ENTRY_ANIMATIONS = ["fade", "slide", "zoom"];

export const CARD_COSTS = {
  personal: {
    classic: 0,
    premium: 25,
    elite: 35,
  },
  poll: {
    classic: 0,
    elite: 35,
  },
  chain: {
    classic: 0,
    elite: 40,
  },
  trivia: {
    classic: 0,
    elite: 50,
  },
  anonymous: {
    classic: 0,
    elite: 45,
  },
};
