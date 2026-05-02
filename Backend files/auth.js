import jwt from "jsonwebtoken";
import { JWT_SECRET, DB_NAME } from "../config/constants.js";
import { client } from "../config/db.js";

// Verifies the JWT and attaches user payload to the request.
export async function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }

  try {
    const blacklistEntry = await client
      .db(DB_NAME)
      .collection("tokenBlacklist")
      .findOne({ token });
    if (blacklistEntry && blacklistEntry.expiresAt > new Date()) {
      return res.status(401).json({ message: "Token revoked" });
    }

    const user = await client
      .db(DB_NAME)
      .collection("users")
      .findOne(
        { id: decoded.id },
        { projection: { bannedUntil: 1, isBanned: 1 } },
      );
    if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return res.status(403).json({ message: "Account is banned" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Requires an authenticated user with admin role.
export function adminAuth(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function moderatorAuth(req, res, next) {
  if (!req.user || req.user.role !== "moderator") {
    return res.status(403).json({ message: "Moderator access required" });
  }
  next();
}

export function adminOrModeratorAuth(req, res, next) {
  if (!req.user || !["admin", "moderator"].includes(req.user.role)) {
    return res.status(403).json({ message: "Admin or moderator access required" });
  }
  next();
}

// Optional auth: attaches req.user when a valid token is provided, otherwise continues silently.
export async function optionalAuth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return next();
  }

  try {
    const blacklistEntry = await client
      .db(DB_NAME)
      .collection("tokenBlacklist")
      .findOne({ token });
    if (blacklistEntry && blacklistEntry.expiresAt > new Date()) {
      return next();
    }

    const user = await client
      .db(DB_NAME)
      .collection("users")
      .findOne(
        { id: decoded.id },
        { projection: { bannedUntil: 1 } },
      );
    if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return next();
    }

    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Optional auth middleware error:", err);
    return next();
  }
}
