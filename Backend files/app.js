import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { CORS_ORIGIN } from "./config/constants.js";
import { paystackWebhook } from "./controllers/couponController.js";
import { sanitizeNoSql } from "./middleware/sanitizeNoSql.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import artistRoutes from "./routes/artistRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import adRoutes from "./routes/adRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again later." },
  });

  app.use(
    cors({
      origin: true, // Allow all origins
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(helmet());

  app.use(globalLimiter);
  app.use("/signup", authLimiter);
  app.use("/login", authLimiter);
  app.use("/verify-email", authLimiter);
  app.use("/request-otp", authLimiter);
  app.use("/redeem-code", authLimiter);

  app.post(
    "/webhook/paystack",
    express.raw({ type: "application/json" }),
    paystackWebhook,
  );

  app.use(express.json());
  app.use(sanitizeNoSql);

  app.use(authRoutes);
  app.use(userRoutes);
  app.use(artistRoutes);
  app.use(templateRoutes);
  app.use(cardRoutes);
  app.use(analyticsRoutes);
  app.use(adminRoutes);
  app.use(couponRoutes);
  app.use(currencyRoutes);
  app.use(packageRoutes);
  app.use("/ads", adRoutes);
  app.use("/chats", chatRoutes);
  app.use("/media", mediaRoutes);
  app.use(reportRoutes);

  // 404 landing page for invalid requests.
  app.use((req, res) => {
    const appHome = CORS_ORIGIN || "https://cardora.studio";
    res.status(404).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>404 - Cardora</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #dfe9ea;
        --muted: #95a8ad;
        --panel: #0b1b20;
        --panel-border: rgba(255, 255, 255, 0.08);
        --glow: rgba(0, 0, 0, 0.55);
        --accent: #63f4d5;
      }
      body {
        margin: 0;
        font-family: "Georgia", "Times New Roman", serif;
        background:
          radial-gradient(900px 500px at 20% 20%, rgba(45, 92, 98, 0.45), transparent),
          radial-gradient(1200px 800px at 80% 0%, rgba(16, 45, 52, 0.8), transparent),
          linear-gradient(135deg, #061217, #0f2a30);
        color: var(--ink);
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      .card {
        background: linear-gradient(180deg, rgba(9, 24, 30, 0.98), rgba(7, 20, 25, 0.98));
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        padding: 42px 40px;
        max-width: 640px;
        box-shadow:
          0 30px 70px var(--glow),
          inset 0 0 0 1px rgba(255, 255, 255, 0.02);
        position: relative;
      }
      .card:before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: 0 0 0 1px rgba(99, 244, 213, 0.08);
        pointer-events: none;
      }
      .badge {
        display: inline-block;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-weight: 600;
        letter-spacing: 0.22em;
        font-size: 11px;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 12px;
        font-size: 40px;
        letter-spacing: 0.02em;
      }
      p { margin: 12px 0; line-height: 1.7; font-size: 16px; color: var(--muted); }
      .cta {
        margin-top: 18px;
        display: inline-block;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(99, 244, 213, 0.12);
        color: var(--ink);
        font-weight: 600;
        text-decoration: none;
        border: 1px solid rgba(99, 244, 213, 0.35);
      }
      .cta:hover { background: rgba(99, 244, 213, 0.2); }
      .subtle { color: rgba(223, 233, 234, 0.55); font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="card">
      <span class="badge">Cardora</span>
      <h1>We could not find that page</h1>
      <p>Looks like this link does not lead anywhere right now.</p>
      <p>If you typed the address, check it for typos. Otherwise, head back to the app and keep creating.</p>
      <a class="cta" href="${appHome}">Back to Cardora</a>
      <p class="subtle">Need help? Try reloading or returning to the home screen.</p>
    </div>
  </body>
</html>`);
  });

  return app;
}
