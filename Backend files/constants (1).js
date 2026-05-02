export const DB_NAME = process.env.DB_NAME || "Cardora";
export const SALT_ROUNDS = Number.parseInt(process.env.SALTROUNDS, 10) || 10;
export const JWT_SECRET = process.env.SECRETKEY || "defaultsecret";
export const PORT = process.env.PORT || 2027;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
export const SIGNUP_BONUS_LIMIT = Number.parseInt(process.env.SIGNUP_BONUS_LIMIT, 10) || 200;
export const SIGNUP_BONUS_AMOUNT = Number.parseInt(process.env.SIGNUP_BONUS_AMOUNT, 10) || 20;
export const AD_REWARD_CC = Number.parseInt(process.env.AD_REWARD_CC, 10) || 1;
export const DAILY_AD_LIMIT = Number.parseInt(process.env.DAILY_AD_LIMIT, 10) || 10;
export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "NGN";

// Rewarded Ads Constants
export const REWARDED_AD_CC = 2;
export const REWARDED_AD_DAILY_LIMIT = 10;
export const REWARDED_AD_COOLDOWN_MS = 45 * 1000; // 45 seconds
