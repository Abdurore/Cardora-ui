Cardora Backend API Handbook (Frontend + AI Integration)
=========================================================

Latest Updates (June 1, 2026)
-----------------------------
- Interactive card names:
  - poll, chain, and trivia cards now support a top-level `name`
  - backend also mirrors the resolved name into `config.content.name`
  - if no name is provided, backend derives one from question/challenge/default type label
  - `PUT /update-card` can update `name`
  - `GET /usercards` uses `name`/`config.content.name` when building card titles
- Gift attachment during card creation:
  - create-card payloads may include `giftInventoryId` or `inventoryId`
  - gifts can still be attached later through `POST /cards/attach-gift`
  - gifts are allowed only on `personal` cards
- Deletion endpoint compatibility:
  - card delete now supports `DELETE /delete-card` and `DELETE /delete-card/:cardId`
  - template delete accepts `templateId` from body, params, or query
  - admin gift/profile-background/chat-frame/template/redeem-code deletes accept IDs from params, body, or query where applicable
  - media deletes now support `/media/videos/:nameKey` and `/media/music/:nameKey`
- Template report fix:
  - `POST /reports/templates` now accepts `templateId` directly, in addition to generic `targetId`
- Account deletion cleanup:
  - `DELETE /delete-account` removes the user and deletes owned cards/templates
  - reports made by the deleted user are marked with `reportedByDeleted: true`

Latest Updates (May 6, 2026)
----------------------------
- Card read reliability improved:
  - `GET /cards/:slug` now performs a safer slug match (decoded + trim + case-insensitive fallback)
  - view increments now target card `id` to avoid slug mismatch edge cases
- New card pricing endpoint:
  - `GET /cards/prices` returns all card types with tier pricing from backend source-of-truth
- New first-time-user flow:
  - users now include `isFirstTimeUser` (default `true` on signup)
  - `PATCH /users/first-time/complete` sets `isFirstTimeUser` to `false` (auth required)
- Validation behavior updated:
  - unknown request fields are now stripped globally (`stripUnknown: true`)
  - card `layoutdata` is now optional and accepts any object shape
- Admin user management fixes:
  - `ban`, `unban`, and `set-role` now accept `identifier`, `userId`, or `email`
  - role assignment now supports demotion to `user` (in addition to `enterprise` and `moderator`)
- Admin analytics expanded:
  - richer `/admin/dashboard` totals (coupon revenue, CC sold, referrals, ad totals, ad rewarded CC)
  - `/admin/stats/overview` now includes:
    - revenue: all-time, last 7 days, last 30 days, current month, daily series
    - referrals: total referrals, total referrers, top referrers
    - ads: totals, completion rate, daily totals, and per-ad daily rows
- Ad analytics improvements:
  - impressions and completions now also tracked in a daily analytics collection
  - rewarded CC from ads is tracked in aggregate + daily metrics
  - `/admin/ads/global-stats` now includes daily totals and per-ad performance
  - `/admin/ads/analytics` now returns aggregate + daily rows

Latest Updates (May 10, 2026)
-----------------------------
- Premium membership and rewards:
  - `POST /create-premium-checkout` added (Paystack checkout for premium)
  - premium price is `500 NGN`, duration is `30 days`
  - premium activation/extension handled in webhook using `purchaseType: premium_subscription`
- Daily free claim improvements:
  - premium users now get `2 CC` daily (non-premium remains `1 CC`)
  - streak system added via `dailyClaimStreak` (consecutive daily claims)
- Premium gifting:
  - `POST /gift-premium` lets premium users gift one friend `7 days` premium
  - gifting is one-time per sender
- Profile backgrounds:
  - admin endpoints to add/delete profile backgrounds
  - premium users can equip exactly one profile background
  - equip endpoint supports `blur` boolean
- Chat frames:
  - admin endpoints to add/delete chat frames (`name`, `id`, `url`, `price`)
  - moderators can request new chat frames
  - admin must approve moderator chat frame requests
  - users can buy chat frames with CC and equip one owned frame at a time

Latest Updates (May 14, 2026)
-----------------------------
- Gift system (Flutterwave) added:
  - `GET /gifts/catalog` for fixed gift names + NGN prices
  - `POST /gifts/flutterwave/checkout` initializes Flutterwave checkout for one gift purchase
  - `POST /webhook/flutterwave` verifies Flutterwave events and credits purchased gifts into user inventory
- Gift attachment + claim flow:
  - `POST /cards/attach-gift` attaches one owned gift inventory item to one personal card
  - `POST /cards/:slug/claim-gift` lets recipient claim attached gift payout
  - recipient receives `90%` of gift amount; Cardora keeps `10%`
- Profile payload update:
  - `GET /current-user` now includes `giftsInventory` and `giftWalletNgn`
- User cards payload update:
  - `GET /usercards` now includes `giftAttachment` per card (if attached/claimed)

Latest Updates (May 20-21, 2026)
--------------------------------
This section documents implementation changes observed in backend source files modified on:
- Tuesday, May 20, 2026
- Wednesday, May 21, 2026

These updates are now part of the backend contract and should be treated as source-of-truth unless superseded by newer dated sections.

1) Validation and Input Sanitization Behavior (Global)
------------------------------------------------------
- Validation middleware uses:
  - `abortEarly: false`
  - `stripUnknown: true`
  - `convert: true`
- Impact:
  - Unknown request fields are removed from `params`, `query`, and `body` after validation.
  - Route handlers receive sanitized payloads only.
  - Several endpoints now safely accept multiple identifier aliases without leaking extra fields to handlers.

2) Admin Identity Resolution Expanded (ban/unban/set-role)
-----------------------------------------------------------
The following endpoints now resolve target users by any of:
- `identifier` (user `id` OR `username`)
- `userId` (alias for `identifier`)
- `email`

Endpoints:
- `POST /admin/ban-user`
- `POST /admin/unban-user`
- `POST /admin/users/set-role`

Detailed `POST /admin/ban-user` behavior:
- Request accepts:
  - identity: `identifier | userId | email` (at least one required)
  - duration control:
    - `until` (ISO date), OR
    - `durationDays` and/or `durationHours` (non-negative, not both zero)
  - optional `reason`
- Validation rules:
  - if no identity provided -> `400`
  - if no duration provided -> `400`
  - invalid `until` date -> `400`
  - `durationDays/durationHours` negative -> `400`
  - both duration values zero -> `400`
- Persistence behavior:
  - sets `isBanned: true`
  - sets `bannedAt: <now>`
  - sets computed `bannedUntil`
  - sets `banReason` (trimmed, default empty string)
- Response:
  - `message`
  - `identifier` (resolved identifier string when provided)
  - `bannedUntil`

Detailed `POST /admin/unban-user` behavior:
- Identity required via `identifier | userId | email`
- On success:
  - `isBanned: false`
  - `bannedUntil: null`
  - `banReason: null`
  - `unbannedAt: <now>`

Detailed `POST /admin/users/set-role` behavior:
- Identity required via `identifier | userId | email`
- Role restricted to:
  - `enterprise`
  - `moderator`
  - `user`
- Rejects unsupported role values with `400`.

3) Signup Bonus Admin Controls Finalized
----------------------------------------
Admin-only endpoints:
- `GET /admin/signup-bonus-status`
- `POST /admin/reset-signup-bonus`

`GET /admin/signup-bonus-status` returns:
- `status.limit`
- `status.used`
- `status.remaining`
- `status.amount`

`POST /admin/reset-signup-bonus` behavior:
- upserts `systemCounters` record `name: "signup_bonus"`
- resets:
  - `used` -> `0`
  - `limit` -> `SIGNUP_BONUS_LIMIT` env/default
  - `amount` -> `SIGNUP_BONUS_AMOUNT` env/default
  - `updatedAt` -> now

4) User Data Retrieval Expansion
--------------------------------
`GET /current-user` now supports optional query override:
- `?identifier=<userId_or_username>`
- Auth is still required.
- If `identifier` exists and matches another user:
  - response returns that user’s current profile payload + analytics.
- If not found:
  - `404 User not found for identifier`

Additional fields guaranteed in `/current-user` response object:
- `isFirstTimeUser` (default `true` for legacy users missing the field)
- `giftWalletNgn`
- `giftsInventory`
- `dailyClaimStreak`
- `equippedProfileBackground`
- `profileBackgroundUrl`
- `ownedChatFrames`
- `equippedChatFrameId`

5) User Public Profile Payload Enriched
---------------------------------------
`GET /users/:identifier/profile` now includes:
- premium status signals:
  - `premiumUntil`
  - `isPremiumActive`
- profile decoration signals:
  - `equippedProfileBackground`
  - `profileBackgroundUrl`
  - `equippedChatFrameId`
- plus `profileBackgrounds` list from `profileBackgrounds` collection.

6) Template Deletion and Lookup Improvements
--------------------------------------------
Creator delete now supports two route shapes:
- `DELETE /delete-template` (body/query `templateId`)
- `DELETE /delete-template/:templateId` (param version)

Admin template tools:
- `DELETE /admin/templates`
  - accepts `templateId` from body or query
- `DELETE /admin/templates/:templateId`
  - hard deletes template by `id`
  - returns `Template deleted by admin`
- `GET /admin/templates/lookup`
  - accepts any of:
    - `shareLink`
    - `slug`
    - `templateId`
  - supports lookup by normalized shareLink fallbacks:
    - direct `shareLink`
    - same value as `slug`
    - same value as `id`

7) Card Read Reliability and Interaction Access Rules
-----------------------------------------------------
`GET /cards/:slug` reliability behavior:
- input slug is:
  - URL-decoded (`decodeURIComponent`)
  - trimmed
- lookup logic:
  - exact slug match OR case-insensitive regex exact boundary match
- view counting now increments by stable card `id` (not just slug), reducing mismatch risk.

`GET /cards/prices`:
- confirmed as active route + controller response contract:
  - `message`
  - `prices` object from backend pricing table

Interaction endpoint auth/access matrix:
- `POST /cards/:slug/response`
  - requires auth
- `POST /cards/:slug/poll-vote`
  - optional auth (`optionalAuth`)
  - guests are tracked as `guest:<ip>`
- `POST /cards/:slug/chain-reply`
  - optional auth
- `POST /cards/:slug/trivia-submit`
  - optional auth
- `POST /cards/:slug/anonymous-message`
  - public (no auth middleware)

Interaction rate limiting:
- shared limiter on poll/chain/anonymous/trivia interaction routes:
  - window: 15 minutes
  - max requests: 60 per IP

8) Ads Listing and Analytics Payload Refinements
------------------------------------------------
`GET /admin/ads` now returns computed stats per ad by joining `ads` + `adAnalytics`:
- `stats.views`
- `stats.impressions`
- `stats.clicks`
- `stats.completions`
- `stats.uniqueViewers` (count)
- `stats.viewLimit`
- `stats.remainingViews`

Response shape:
- `message`
- `count`
- `ads`

`GET /admin/ads/analytics` returns:
- aggregate rows from `adAnalytics` as `analytics`
- per-day rows from `adAnalyticsDaily` as `daily`
- supports optional `?adId=...`

`GET /admin/ads/global-stats` includes:
- totals from analytics collections
- per-ad derived rows
- daily rollups
- rewarded CC reconciliation against user `ccIncomeHistory` ad reward entries

9) Gift System Source-of-Truth Update (Catalog is DB-first)
-----------------------------------------------------------
`GET /gifts/catalog` behavior:
- primary source: active records in `gifts` collection (`name`, `priceNgn`)
- fallback source: built-in default gift map if DB has no active gift rows

Important:
- Frontend should no longer hardcode gift catalog values from static docs.
- Always consume `/gifts/catalog` response at runtime.

Admin gift management endpoints (admin only):
- `POST /admin/gifts`
  - body: `{ name, priceNgn }`
- `GET /admin/gifts`
- `DELETE /admin/gifts/:giftId`

10) Daily Free Claim Behavior Clarified
---------------------------------------
`POST /claim-daily-free-coupon` now explicitly:
- grants `2 CC` when premium active
- grants `1 CC` otherwise
- updates/increments `dailyClaimStreak` when prior claim was yesterday
- pushes structured income history entry:
  - `type: "daily_free_coupon"`
  - `amount`
  - `streak`
  - `balanceBefore`
  - `balanceAfter`
  - `createdAt`

11) Premium Gifting Guardrails Clarified
----------------------------------------
`POST /gift-premium` (`giftPremiumToFriend`) enforces:
- sender must currently be premium
- sender must have a paid premium source (not gifted-only chain abuse)
- sender can only gift once per paid subscription window
- sender cannot gift self
- recipient receives premium extension and receives gift history entries

12) Admin Broadcast Delivery Log Endpoint
-----------------------------------------
New documented admin endpoint:
- `GET /admin/broadcast-delivery-logs`

Query:
- `broadcastId` (required)
- `page` (default 1)
- `limit` (default 100, max 200)

Use-case:
- audit per-recipient delivery outcomes for specific broadcast runs.

13) Auth Middleware Behavior Note (Optional Auth)
-------------------------------------------------
`optionalAuth` now intentionally:
- attaches `req.user` only when token is valid, user exists, not blacklisted, and not currently banned
- otherwise continues silently as guest

This affects card interaction endpoints that are guest-capable (poll/chain/trivia) and should be reflected in frontend analytics/identity handling.

14) Documentation Date Scope
----------------------------
This section reflects changes observed from backend file edits timestamped May 20-21, 2026.
If a newer dated section conflicts with this section, follow the newest dated section.

Purpose
-------
This document is the source-of-truth integration guide for frontend engineers and AI coding assistants.
Use it to:
1) understand API behavior and permission rules
2) generate frontend service layers/types
3) implement UI flows with minimal backend guesswork

Base URL and Runtime
--------------------
- Base URL: routes are mounted at root (`/`)
- Production URL: `https://cardora-uss3.onrender.com`
- WebSocket URL: `https://cardora-uss3.onrender.com`
- Auth header format: `Authorization: Bearer <JWT>`

Tech Notes
----------
- Database: MongoDB
- API style: REST JSON
- Real-time chat: Socket.IO
- Time fields: ISO dates
- IDs: mostly string IDs generated by backend (`uuid`/custom IDs)


================================================================
1) Roles, Permissions, and Moderation Model
================================================================

Roles
-----
- `user`
- `artist`
- `enterprise`
- `moderator`
- `admin`

Permission Matrix (Practical)
-----------------------------
- User:
  - create/use cards, templates (if artist), chat, coupon/ad reward flows
  - report users/cards/templates
- Artist:
  - template creation/update/delete (own templates)
- Enterprise:
  - view ad stats tied to enterprise-associated ads
- Moderator:
  - view reports
  - ban/unban users
  - disable inappropriate templates
  - request broadcaster email (needs admin approval)
- Admin:
  - all moderator powers
  - direct broadcaster send
  - approve moderator broadcast requests
  - role assignment for `enterprise`, `moderator`, and `user`
  - full admin analytics/management

Role Assignment Endpoint Scope
------------------------------
`POST /admin/users/set-role` allows ONLY:
- `enterprise`
- `moderator`
- `user`

It does NOT assign artist/admin.
Artist still uses the artist application flow.


================================================================
2) High-Level Frontend Flows
================================================================

Auth + Onboarding
-----------------
1) `POST /signup`
2) `POST /verify-email`
3) `POST /login` => store JWT
4) `GET /current-user`

Card Creation
-------------
1) Fetch user CC via `GET /current-user`
2) Build type+tier payload
3) POST one of card create routes
4) Use backend response `couponsCharged` and `remainingCC` as financial truth

Ad Reward Flow
--------------
1) `GET /ads/rewarded` to fetch playable ad
2) user watches ad fully in UI
3) `POST /ads/complete` with `{ adId }`
4) refresh state via `GET /ads/stats` and/or `GET /current-user`

Moderation + Reports
--------------------
1) users submit reports (`/reports/*`)
2) moderator/admin fetch reports (`GET /admin/reports`)
3) moderator/admin take action:
   - ban/unban user
   - disable template
4) actions are logged separately by role


================================================================
3) Rate Limits
================================================================

- Global: 300 requests / 15 minutes / IP
- Auth-sensitive: 20 requests / 15 minutes / IP
- Sensitive routes include: `/signup`, `/login`, `/verify-email`, `/request-otp`, `/redeem-code`


================================================================
4) Auth Endpoints
================================================================

POST /signup
------------
Body:
```json
{
  "username": "raizel",
  "email": "raizel@example.com",
  "password": "StrongPass123",
  "profilePictureUrl": "https://example.com/avatar.jpg",
  "bio": "Optional bio",
  "referralCode": "OPTIONAL",
  "currency": "USD",
  "termsAccepted": true,
  "privacyAccepted": true
}
```

POST /verify-email
------------------
Body:
```json
{ "email": "raizel@example.com", "otp": "123456" }
```
Notes:
- triggers signup bonus eligibility check (first-N verified users)

POST /login
-----------
Body:
```json
{ "email": "raizel@example.com", "password": "StrongPass123" }
```
Response includes JWT token.

POST /request-otp
-----------------
Body: `{ "email": "..." }`

POST /forgot-password
---------------------
Body: `{ "email": "..." }`

POST /reset-password
--------------------
Body:
```json
{
  "email": "raizel@example.com",
  "otp": "123456",
  "newPassword": "NewStrongPass123"
}
```

POST /logout (auth)
-------------------
Blacklists current token.

GET /signup-bonus/availability
------------------------------
Returns bonus availability snapshot.


================================================================
5) User Endpoints
================================================================

GET /current-user (auth)
------------------------
Core profile + balance + analytics-friendly fields.
Includes `isFirstTimeUser` (defaults to `true` if missing in legacy records).

PUT /update-profile (auth)
--------------------------
Body (any one or more):
```json
{
  "username": "new_name",
  "email": "new@example.com",
  "bio": "Updated bio",
  "profilePictureUrl": "https://..."
}
```
If email changes, user must re-verify.

DELETE /delete-account (auth)
-----------------------------
Deletes own account.

Cleanup behavior:
- deletes the user row
- deletes cards owned by the user
- deletes templates owned by the user
- marks reports submitted by that user with `reportedByDeleted: true`

GET /usercards (auth)
---------------------
Query: `page`, `limit`

Card title behavior:
- uses top-level `name` first
- then `config.content.name`
- then type-specific content (`header`, `question`, `challenge`, `message`)
- falls back to `Untitled Card`

GET /users/:identifier/profile (auth)
-------------------------------------
Minimal profile for other users by `id` or `username`.

PATCH /users/first-time/complete (auth)
---------------------------------------
Marks onboarding completion for the current user:
- sets `isFirstTimeUser` to `false`

PATCH /users/equip-profile-background (auth)
--------------------------------------------
Premium-only endpoint to equip one profile background.

Body:
```json
{
  "backgroundId": "bg_gold_01",
  "blur": true
}
```

PATCH /users/equip-chat-frame (auth)
------------------------------------
Equip one owned chat frame.

Body:
```json
{
  "frameId": "frame_fire_01"
}
```

POST /users/buy-chat-frame (auth)
---------------------------------
Buy a chat frame using CC.

Body:
```json
{
  "frameId": "frame_fire_01"
}
```


================================================================
6) Reports System
================================================================

User Report Submission (auth)
-----------------------------
- `POST /reports/users`
- `POST /reports/cards`
- `POST /reports/templates`

Body:
```json
{
  "targetId": "USER_ID_OR_CARD_SLUG_OR_TEMPLATE_ID",
  "reason": "Inappropriate content",
  "details": "Optional context"
}
```

Target ID aliases are also accepted:
```json
{
  "templateId": "TEMPLATE_ID",
  "reason": "Inappropriate content",
  "details": "Optional context"
}
```

Alias map:
- `/reports/users`: `userId` or `targetId`
- `/reports/cards`: `cardId` or `targetId`
- `/reports/templates`: `templateId` or `targetId`

Moderation Report Review
------------------------
`GET /admin/reports` (admin/moderator)
Query:
- `type`: `user|card|template` (optional)
- `status`: `open|reviewed|resolved|dismissed` (default `open`)
- `page`, `limit`


================================================================
7) Cards API
================================================================

Card System Deep Dive (How the Entire System Works)
---------------------------------------------------
The backend uses a unified card engine. Every card is normalized into a strict shape,
validated by type+tier rules, persisted, and then returned in a safe client form.

High-level pipeline:
1) request hits a create route
2) route validation checks required fields by card type/tier
3) card engine normalizes:
   - type
   - tier
   - config
   - layoutdata
   - enhancements
   - state
4) backend checks CC balance and charges coupons
5) card is saved with unique `slug`
6) response returns:
   - stored card (`card`)
   - frontend-ready computed model (`renderModel`)
   - finance truth (`couponsCharged`, `remainingCC`)

Card Object Model (Core)
------------------------
At rest in DB (simplified):
```json
{
  "id": "uuid",
  "name": "Card display name",
  "slug": "public-card-slug",
  "userId": "creator-user-id",
  "type": "personal|poll|chain|trivia|anonymous",
  "tier": "classic|premium|elite",
  "config": {
    "colors": {
      "background": "#000000",
      "accent": "#ffffff",
      "gradient": ["#000000", "#222222"]
    },
    "font": "Poppins",
    "content": {}
  },
  "layoutdata": {
    "tier": "classic|premium|elite",
    "paperTexture": {
      "type": "none|vintage-paper|...custom",
      "opacity": 0,
      "blendMode": "normal|multiply|...custom"
    }
  },
  "enhancements": {},
  "state": {},
  "giftAttachment": {
    "inventoryId": "gift-inventory-id",
    "giftName": "spark",
    "priceNgn": 500,
    "ownerUserId": "creator-user-id",
    "status": "attached|claimed"
  },
  "meta": {
    "creatorId": "creator-user-id",
    "createdAt": "ISO_DATE"
  },
  "views": 0,
  "currency": "USD",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE"
}
```

Important invariant:
- `card.tier` is canonical for pricing/feature rules.
- `layoutdata.tier` is always synchronized to the same value by backend normalization.
- interactive cards (`poll`, `chain`, `trivia`) have a top-level `name`.
- backend mirrors interactive card names into `config.content.name`.
- `giftAttachment` exists only when a gift has been attached.

AI-Safe Card Payload Map (Use This to Avoid Structure Errors)
--------------------------------------------------------------
This section is the authoritative map for frontend and AI payload generation.
Most integration mistakes happen when fields are put in the wrong branch.

Top-level card create/update branches:
- `type` -> card mode (`personal|poll|chain|trivia|anonymous`)
- `tier` -> plan (`classic|premium|elite`)
- `config` -> theme + content text/questions/options
- `enhancements` -> visual FX/media/lock/animation behavior
- `layoutdata` -> layout metadata (currently `tier` + `paperTexture`)
- `state` -> runtime interaction state (usually backend-managed)

Hard rule:
- Do not put visual FX fields inside `layoutdata`.
- Do not put question/poll/trivia content inside `enhancements`.
- Do not put lock/music/media inside `config`.

Canonical Field Ownership
-------------------------
1) `config` (semantic card content + base theme)
- `config.colors.background`: string
- `config.colors.accent`: string
- `config.colors.gradient`: `[string, string]`
- `config.font`: string
- `config.content`: object shape depends on card `type`

`config.content` by type:
- personal:
  - `header`: string
  - `body`: string
  - `questionBlock.enabled`: boolean
  - `questionBlock.question`: string
  - `questionBlock.suspenseTexts`: string[]
  - `questionBlock.answerType`: currently `yes_no`
- poll:
  - `question`: string
  - `options`: `{ id: string, text: string }[]`
- chain:
  - `challenge`: string
  - `rules`: string[]
- trivia:
  - `questions`: `{ question: string, options: string[], correctIndex: number }[]`
- anonymous:
  - `message`: string

2) `enhancements` (elite/premium visual behavior)
- `background.type`: `color|gradient|video|animated`
- `background.value`: string (color token/gradient token/video URL/animated preset token)
- `background.videoSettings.blur`: number
- `background.videoSettings.darkTint`: number
- `background.videoSettings.tintLevel`: number (0..1)
- `background.videoSettings.tintColor`: string (hex/rgb token used by frontend)
- `background.gradientAnimation.enabled`: boolean
- `background.gradientAnimation.duration`: number
- `music.track`: string (URL or library key)
- `music.volume`: number (0..1)
- `lock.type`: `none|tap|scratch|timer|password`
- `lock.value`: string/number (password text or timer date value)
- `ambientEffect.type`: `none|starfield|snow|bubbles|fountain|fireflies|floating`
- `ambientEffect.emojis`: string[]
- `openEffect.type`: `none|confetti|fireworks|heartsBurst|starShower|balloons|emojiRain`
- `openEffect.colors`: `[string, string, string]`
- `media`: `[{ type: "image", url: string }]`
- `animation.entry`: `fade|slide|zoom`
- `animation.speed`: number

3) `layoutdata` (layout metadata, not effects)
- `tier`: backend keeps this equal to top-level `tier`
- `paperTexture.type`: string (`none` default)
- `paperTexture.opacity`: number
- `paperTexture.blendMode`: string

4) `state` (interaction records)
- Usually omit during create unless restoring/importing.
- Backend manages consistency (votes/counts, duplicate responder checks, etc).

What Backend Auto-Normalizes
----------------------------
- Missing branches are filled with defaults.
- `layoutdata.tier` is overwritten to match top-level `tier`.
- Type/tier constraints are enforced (example: premium only supports personal).
- Classic cards reject non-default enhancements.
- Premium cards reject elite-only capabilities (video/music/openEffect/media).

Minimal Elite Personal Example (Recommended Starter)
----------------------------------------------------
Use this when prompting frontend AI; extend only what you need.

```json
{
  "type": "personal",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#0f172a",
      "accent": "#22d3ee",
      "gradient": ["#0f172a", "#1e293b"]
    },
    "font": "Cinzel",
    "content": {
      "header": "For Someone Special",
      "body": "You are appreciated more than words can say.",
      "questionBlock": {
        "enabled": true,
        "question": "Will you say yes?",
        "suspenseTexts": ["Take your time", "No pressure", "Follow your heart"],
        "answerType": "yes_no"
      }
    }
  },
  "layoutdata": {
    "paperTexture": {
      "type": "none",
      "opacity": 0,
      "blendMode": "normal"
    }
  },
  "enhancements": {
    "background": {
      "type": "animated",
      "value": "aurora-soft",
      "videoSettings": { "blur": 0, "darkTint": 0.15, "tintLevel": 0.2, "tintColor": "#0b1220" },
      "gradientAnimation": { "enabled": true, "duration": 8 }
    },
    "music": {
      "track": "https://cdn.example.com/music/soft-piano.mp3",
      "volume": 0.4
    },
    "lock": {
      "type": "password",
      "value": "4207"
    },
    "ambientEffect": {
      "type": "floating",
      "emojis": ["✨", "💫"]
    },
    "openEffect": {
      "type": "confetti",
      "colors": ["#22d3ee", "#a7f3d0", "#fbcfe8"]
    },
    "media": [
      {
        "type": "image",
        "url": "https://cdn.example.com/cards/photo-1.jpg"
      }
    ],
    "animation": {
      "entry": "fade",
      "speed": 1
    }
  }
}
```

Sample Payload Matrix (All Supported Card Types + Tiers)
---------------------------------------------------------
Use these as copy/paste-safe starters. They are intentionally minimal.
Each sample shows correct branch placement for `config`, `layoutdata`, and `enhancements`.

1) Personal + Classic
```json
{
  "type": "personal",
  "tier": "classic",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#111111",
      "gradient": ["#ffffff", "#f3f4f6"]
    },
    "font": "Poppins",
    "content": {
      "header": "A note for you",
      "body": "Wishing you joy today.",
      "questionBlock": {
        "enabled": false,
        "question": "",
        "suspenseTexts": [],
        "answerType": "yes_no"
      }
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "none", "opacity": 0, "blendMode": "normal" }
  },
  "enhancements": {}
}
```

2) Personal + Premium
```json
{
  "type": "personal",
  "tier": "premium",
  "config": {
    "colors": {
      "background": "#0f172a",
      "accent": "#22d3ee",
      "gradient": ["#0f172a", "#1e293b"]
    },
    "font": "Cinzel",
    "content": {
      "header": "For You",
      "body": "You matter deeply to me.",
      "questionBlock": {
        "enabled": true,
        "question": "Will you say yes?",
        "suspenseTexts": ["Take your time"],
        "answerType": "yes_no"
      }
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "linen", "opacity": 0.15, "blendMode": "multiply" }
  },
  "enhancements": {
    "background": {
      "type": "animated",
      "value": "aurora-soft",
      "videoSettings": { "blur": 0, "darkTint": 0, "tintLevel": 0, "tintColor": "" },
      "gradientAnimation": { "enabled": true, "duration": 8 }
    },
    "music": { "track": "", "volume": 0 },
    "lock": { "type": "none", "value": "" },
    "ambientEffect": { "type": "floating", "emojis": ["✨"] },
    "openEffect": { "type": "none", "colors": ["", "", ""] },
    "media": [],
    "animation": { "entry": "fade", "speed": 1 }
  }
}
```

3) Personal + Elite
```json
{
  "type": "personal",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#111827",
      "accent": "#34d399",
      "gradient": ["#111827", "#1f2937"]
    },
    "font": "Cinzel",
    "content": {
      "header": "My Heartfelt Message",
      "body": "Thank you for always being there.",
      "questionBlock": {
        "enabled": true,
        "question": "Will you be mine forever?",
        "suspenseTexts": ["Breathe", "No pressure"],
        "answerType": "yes_no"
      }
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "vintage-paper", "opacity": 0.2, "blendMode": "multiply" }
  },
  "enhancements": {
    "background": {
      "type": "gradient",
      "value": "midnight-gradient",
      "videoSettings": { "blur": 0, "darkTint": 0, "tintLevel": 0, "tintColor": "" },
      "gradientAnimation": { "enabled": false, "duration": 0 }
    },
    "music": { "track": "https://cdn.example.com/music/soft-piano.mp3", "volume": 0.35 },
    "lock": { "type": "password", "value": "4207" },
    "ambientEffect": { "type": "fireflies", "emojis": [] },
    "openEffect": { "type": "confetti", "colors": ["#22d3ee", "#a7f3d0", "#fbcfe8"] },
    "media": [{ "type": "image", "url": "https://cdn.example.com/cards/memory-1.jpg" }],
    "animation": { "entry": "zoom", "speed": 1.1 }
  }
}
```

4) Poll + Classic
```json
{
  "name": "Preference Poll",
  "type": "poll",
  "tier": "classic",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#0f172a",
      "gradient": ["#ffffff", "#f8fafc"]
    },
    "font": "Poppins",
    "content": {
      "name": "Preference Poll",
      "question": "Which one do you prefer?",
      "options": [
        { "id": "opt_a", "text": "Option A" },
        { "id": "opt_b", "text": "Option B" }
      ]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "none", "opacity": 0, "blendMode": "normal" }
  },
  "enhancements": {}
}
```

5) Poll + Elite
```json
{
  "name": "Date Ideas",
  "type": "poll",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#0b1020",
      "accent": "#60a5fa",
      "gradient": ["#0b1020", "#172554"]
    },
    "font": "Poppins",
    "content": {
      "name": "Date Ideas",
      "question": "Best date idea?",
      "options": [
        { "id": "movie", "text": "Movie Night" },
        { "id": "dinner", "text": "Dinner Date" },
        { "id": "beach", "text": "Beach Walk" }
      ]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "linen", "opacity": 0.12, "blendMode": "multiply" }
  },
  "enhancements": {
    "background": {
      "type": "video",
      "value": "https://cdn.example.com/bg/soft-lights.mp4",
      "videoSettings": { "blur": 14, "darkTint": 0.25, "tintLevel": 0.2, "tintColor": "#0b1220" },
      "gradientAnimation": { "enabled": false, "duration": 0 }
    },
    "music": { "track": "https://cdn.example.com/music/lounge.mp3", "volume": 0.25 },
    "lock": { "type": "none", "value": "" },
    "ambientEffect": { "type": "none", "emojis": [] },
    "openEffect": { "type": "none", "colors": ["", "", ""] },
    "media": [],
    "animation": { "entry": "slide", "speed": 1 }
  }
}
```

6) Chain + Classic
```json
{
  "name": "Kindness Chain",
  "type": "chain",
  "tier": "classic",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#111827",
      "gradient": ["#ffffff", "#f3f4f6"]
    },
    "font": "Poppins",
    "content": {
      "name": "Kindness Chain",
      "challenge": "Share one kind thing you did today.",
      "rules": ["Be respectful", "Keep it short"]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "none", "opacity": 0, "blendMode": "normal" }
  },
  "enhancements": {}
}
```

7) Chain + Elite
```json
{
  "name": "Motivation Chain",
  "type": "chain",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#1f2937",
      "accent": "#f59e0b",
      "gradient": ["#1f2937", "#374151"]
    },
    "font": "Poppins",
    "content": {
      "name": "Motivation Chain",
      "challenge": "Drop your best motivation quote.",
      "rules": ["No hate speech", "Keep it meaningful"]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "kraft", "opacity": 0.18, "blendMode": "multiply" }
  },
  "enhancements": {
    "background": {
      "type": "animated",
      "value": "warm-glow",
      "videoSettings": { "blur": 0, "darkTint": 0, "tintLevel": 0, "tintColor": "" },
      "gradientAnimation": { "enabled": true, "duration": 10 }
    },
    "music": { "track": "", "volume": 0 },
    "lock": { "type": "timer", "value": "2026-12-31T23:59:59.000Z" },
    "ambientEffect": { "type": "floating", "emojis": ["🔥"] },
    "openEffect": { "type": "fireworks", "colors": ["#f59e0b", "#fde68a", "#fca5a5"] },
    "media": [],
    "animation": { "entry": "fade", "speed": 1 }
  }
}
```

8) Trivia + Classic
```json
{
  "name": "Quick Math",
  "type": "trivia",
  "tier": "classic",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#1d4ed8",
      "gradient": ["#ffffff", "#eff6ff"]
    },
    "font": "Poppins",
    "content": {
      "name": "Quick Math",
      "questions": [
        {
          "question": "2 + 2 = ?",
          "options": ["3", "4", "5"],
          "correctIndex": 1
        }
      ]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "none", "opacity": 0, "blendMode": "normal" }
  },
  "enhancements": {}
}
```

9) Trivia + Elite
```json
{
  "name": "World Capitals",
  "type": "trivia",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#0a0a0a",
      "accent": "#a78bfa",
      "gradient": ["#0a0a0a", "#1f1b2e"]
    },
    "font": "Poppins",
    "content": {
      "name": "World Capitals",
      "questions": [
        {
          "question": "Capital of France?",
          "options": ["Berlin", "Madrid", "Paris"],
          "correctIndex": 2
        }
      ]
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "velvet", "opacity": 0.16, "blendMode": "overlay" }
  },
  "enhancements": {
    "background": {
      "type": "gradient",
      "value": "violet-ink",
      "videoSettings": { "blur": 0, "darkTint": 0, "tintLevel": 0, "tintColor": "" },
      "gradientAnimation": { "enabled": false, "duration": 0 }
    },
    "music": { "track": "", "volume": 0 },
    "lock": { "type": "none", "value": "" },
    "ambientEffect": { "type": "starfield", "emojis": [] },
    "openEffect": { "type": "none", "colors": ["", "", ""] },
    "media": [],
    "animation": { "entry": "slide", "speed": 1 }
  }
}
```

10) Anonymous + Classic
```json
{
  "type": "anonymous",
  "tier": "classic",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#111111",
      "gradient": ["#ffffff", "#f9fafb"]
    },
    "font": "Poppins",
    "content": {
      "message": "Leave your honest thoughts anonymously."
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "none", "opacity": 0, "blendMode": "normal" }
  },
  "enhancements": {}
}
```

11) Anonymous + Elite
```json
{
  "type": "anonymous",
  "tier": "elite",
  "config": {
    "colors": {
      "background": "#111827",
      "accent": "#f472b6",
      "gradient": ["#111827", "#312e81"]
    },
    "font": "Poppins",
    "content": {
      "message": "Drop your anonymous advice."
    }
  },
  "layoutdata": {
    "paperTexture": { "type": "linen", "opacity": 0.14, "blendMode": "multiply" }
  },
  "enhancements": {
    "background": {
      "type": "video",
      "value": "https://cdn.example.com/bg/night-sky.mp4",
      "videoSettings": { "blur": 10, "darkTint": 0.35, "tintLevel": 0.3, "tintColor": "#0f172a" },
      "gradientAnimation": { "enabled": false, "duration": 0 }
    },
    "music": { "track": "", "volume": 0 },
    "lock": { "type": "password", "value": "openme" },
    "ambientEffect": { "type": "bubbles", "emojis": [] },
    "openEffect": { "type": "none", "colors": ["", "", ""] },
    "media": [{ "type": "image", "url": "https://cdn.example.com/cards/anon-cover.jpg" }],
    "animation": { "entry": "zoom", "speed": 1.05 }
  }
}
```

Quick Tier Legality Reminder
----------------------------
- Personal supports: `classic`, `premium`, `elite`
- Poll supports: `classic`, `elite`
- Chain supports: `classic`, `elite`
- Trivia supports: `classic`, `elite`
- Anonymous supports: `classic`, `elite`
- Premium is only valid for `personal`

Common AI Mistakes (And Fixes)
------------------------------
1) Mistake: sending your old `background/music/closedState/questions` tree inside `layoutdata`.
- Fix: map visual behavior to `enhancements`, text to `config.content`, and keep `layoutdata` mostly for paper texture metadata.

2) Mistake: `type: "standard"`.
- Fix: use `personal` instead of `standard`.

3) Mistake: using `lock.type: "time"`.
- Fix: backend expects `timer`.

4) Mistake: `media.images: ["..."]`.
- Fix: backend expects `enhancements.media` as objects:
  - `{ "type": "image", "url": "..." }`

5) Mistake: putting trivia `correctIndex` in client rendering assumptions.
- Fix: backend strips correct answers in client-safe payloads.

Layoutdata + Paper Texture (New System Behavior)
------------------------------------------------
The new card engine fully supports `layoutdata`.

If frontend sends no `layoutdata`, backend auto-creates:
```json
{
  "tier": "classic",
  "paperTexture": {
    "type": "none",
    "opacity": 0,
    "blendMode": "normal"
  }
}
```

Then backend forces:
- `layoutdata.tier = card.tier`

This means:
- tier is always present at both top-level and layout level
- paper texture is always present with safe defaults
- partial layout updates are merged, not destructive

Tier Rules (Feature and Pricing Gates)
--------------------------------------
Card tiers:
- `classic`
- `premium`
- `elite`

Costs are resolved by backend (`getCardCost(type, tier)`), not by frontend assumptions.

Validation highlights:
- premium is allowed only for `personal` cards
- classic blocks enhancements
- premium blocks elite-only features (music/video/media/openEffect)
- elite unlocks full enhancement set

Always read/create with backend truth:
- use `couponsCharged`
- use `remainingCC`

Create Routes (auth)
--------------------
General:
- `POST /create-card`

Forced-tier routes:
- `POST /create-card/classic`
- `POST /create-card/premium`
- `POST /create-card/elite`

Forced type+tier routes:
- `POST /create-card/anonymous` (anonymous + elite)
- `POST /create-card/poll/classic`
- `POST /create-card/poll/elite`
- `POST /create-card/chain/classic`
- `POST /create-card/chain/elite`
- `POST /create-card/trivia/classic`
- `POST /create-card/trivia/elite`
- `POST /create-card/anonymous/classic`
- `POST /create-card/anonymous/elite`

Create Payload Notes
--------------------
- Optional top-level `name` is supported for all cards.
- For `poll`, `chain`, and `trivia`, backend mirrors the resolved name into `config.content.name`.
- If interactive card `name` is omitted, backend derives one from:
  - poll: `config.content.question`
  - chain: `config.content.challenge`
  - trivia: default `Trivia Card`
- To attach a gift during creation, include either `giftInventoryId` or `inventoryId`.
- Gift-at-create is allowed only for `personal` cards.

Create personal card with gift attached:
```json
{
  "type": "personal",
  "tier": "classic",
  "giftInventoryId": "GIFT_INVENTORY_ID",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#111111",
      "gradient": ["#ffffff", "#f3f4f6"]
    },
    "font": "Poppins",
    "content": {
      "header": "A gift for you",
      "body": "Open this with love.",
      "questionBlock": {
        "enabled": false,
        "question": "",
        "suspenseTexts": [],
        "answerType": "yes_no"
      }
    }
  }
}
```

Read/Update/Delete
------------------
- `GET /cards/prices`
- `GET /cards/:slug`
- `PUT /update-card` (auth)
- `DELETE /delete-card` (auth, body/query `cardId`)
- `DELETE /delete-card/:cardId` (auth)

Card Pricing Endpoint
---------------------
`GET /cards/prices` returns backend pricing by card type and tier.
Current values:
- personal: classic `0`, premium `25`, elite `35`
- poll: classic `0`, elite `35`
- chain: classic `0`, elite `40`
- trivia: classic `0`, elite `50`
- anonymous: classic `0`, elite `45`

Update-card supports partial patching of:
- `name`
- `config`
- `layoutdata`
- `enhancements`

Backend re-sanitizes after patch, so type/tier invariants are preserved.

Interaction Routes (By Type)
----------------------------
- `POST /cards/:slug/response` (auth) -> personal yes/no
- `POST /cards/:slug/poll-vote` (optional auth, guests allowed) -> poll options
- `POST /cards/:slug/chain-reply` (optional auth, guests allowed) -> chain responses
- `POST /cards/:slug/anonymous-message` (public, rate-limited) -> anonymous responses
- `POST /cards/:slug/trivia-submit` (optional auth, guests allowed) -> trivia attempts

Card Type Semantics (Thorough)
------------------------------
1) Personal Cards
- `type = personal`
- Content:
  - `header`
  - `body`
  - optional `questionBlock` (yes/no)
- State:
  - `answers[]` (one answer per user)
- Interaction endpoint:
  - `/cards/:slug/response`
- Duplicate user answers are prevented by backend logic.

2) Poll Cards
- `type = poll`
- Content:
  - `name`
  - `question`
  - `options[]` with stable option IDs
- State:
  - `votes[]` (userId + optionId)
  - `counts` map keyed by optionId
- Interaction endpoint:
  - `/cards/:slug/poll-vote`
- Backend enforces consistency:
  - no duplicate vote entries per user
  - vote optionId must exist in config options
  - counts must match votes

3) Chain Cards
- `type = chain`
- Content:
  - `name`
  - `challenge`
  - optional `rules[]`
- State:
  - `responses[]`
- Interaction endpoint:
  - `/cards/:slug/chain-reply`
- Safety:
  - bad-word moderation/sanitization applies to chain replies

4) Trivia Cards
- `type = trivia`
- Content:
  - `name`
  - `questions[]`
  - each question has `options[]` + `correctIndex`
- State:
  - `players[]` attempts/scores
- Interaction endpoint:
  - `/cards/:slug/trivia-submit`
- Security behavior:
  - client-safe responses hide answer keys in render/read payloads
  - duplicate player entries per user are rejected

5) Anonymous Cards
- `type = anonymous`
- Content:
  - `message`
- State:
  - `responses[]`
- Interaction endpoint:
  - `/cards/:slug/anonymous-message` (no auth required, rate-limited)
- Safety:
  - bad-word moderation/sanitization applies to anonymous messages

Render Model Contract (Frontend Consumption)
--------------------------------------------
`buildCardRenderModel(...)` returns a normalized shape for UI rendering:
- `id`, `type`, `tier`
- `layoutdata` (includes `paperTexture`, `tier`)
- `visuals` (palette/background/effects/media/music)
- `content`
- `lock`
- `interaction` object specific to card type

This lets frontend avoid card-type branching on raw DB structures.

Lock and Access Behavior
------------------------
Cards can be lock-protected via enhancements lock config:
- password lock
- timer lock

`GET /cards/:slug` enforces lock evaluation before revealing payload.
If locked, API returns lock metadata and appropriate 403 response.

Data Safety/Client Sanitization
-------------------------------
Before returning a card:
- lock password values are removed from response
- trivia correct answers are stripped from client-visible payload

This applies to both card payload and render model.

Important Moderation/Safety Behavior
------------------------------------
- bad-word filter is applied in world chat
- bad-word filter is also applied in:
  - chain replies
  - anonymous card messages


================================================================
8) Templates API
================================================================

Artist Template CRUD
--------------------
- `POST /create-template` (auth, artist role)
- `PUT /update-template` (auth, artist role)
- `DELETE /delete-template` (auth, artist role, body/query `templateId`)
- `DELETE /delete-template/:templateId` (auth, artist role)

Public Template Reads
---------------------
- `GET /templates`
- `GET /templates/popular`
- `GET /templates/:id`
- `POST /templates/:id/like` (auth)
- `POST /templates/:id/unlike` (auth)

Moderation Behavior
-------------------
- disabled templates are hidden from public template endpoints

Admin/Moderator Template Moderation
-----------------------------------
- `GET /admin/templates/lookup` (admin)
  - query by `shareLink` or `slug` or `templateId`
- `PATCH /admin/templates/:templateId/disable` (admin/moderator)
- `DELETE /admin/templates` (admin, body/query `templateId`)
- `DELETE /admin/templates/:templateId` (admin)


================================================================
9) Chat and WebSocket
================================================================

HTTP Chat
---------
`GET /chats` (auth) with pagination.

WebSocket
---------
Connect with:
```js
io("https://cardora-uss3.onrender.com", {
  auth: { userId, username }
});
```

Events:
- `send_message` => `{ content }`
- `new_message`
- `user_joined`
- `user_left`
- `error`

Policy:
- per-user message cooldown is enforced
- old world chat messages are cleaned up by scheduled jobs (24h retention window)


================================================================
10) Coupons, Redeem Codes, and Packages
================================================================

User Coupon Endpoints
---------------------
- `POST /claim-daily-free-coupon` (auth)
- `GET /user/coupons` (auth)
- `POST /redeem-code` (auth)
- `POST /create-paystack-checkout` (auth)
- `POST /create-premium-checkout` (auth)
- `POST /gift-premium` (auth)
- `GET /gifts/catalog` (public/auth)
- `POST /gifts/flutterwave/checkout` (auth)

Gift Catalog + Prices (NGN)
---------------------------
`GET /gifts/catalog` returns:
- `spark`: `500`
- `sweetHeart`: `1000`
- `purpleLove`: `2000`
- `oceanHeart`: `3000`
- `emeraldHeart`: `5000`
- `passionHeart`: `10000`
- `goldenHeart`: `20000`
- `crystalHeart`: `50000`
- `diamondHeart`: `100000`
- `legendaryHeart`: `200000`

Gift Checkout (Flutterwave)
---------------------------
`POST /gifts/flutterwave/checkout`

Body:
```json
{
  "giftName": "spark"
}
```

Response includes:
- `checkoutUrl` (Flutterwave hosted payment page)
- `txRef`
- gift price/currency metadata

Gift payment crediting is webhook-driven (`POST /webhook/flutterwave`).

Gift Attachment + Claim Endpoints
---------------------------------
Attach:
- `POST /cards/attach-gift` (auth)

Body:
```json
{
  "cardId": "CARD_ID",
  "inventoryId": "GIFT_INVENTORY_ID"
}
```

`giftInventoryId` is also accepted as an alias for `inventoryId`.

Attach during card creation:
```json
{
  "type": "personal",
  "tier": "classic",
  "giftInventoryId": "GIFT_INVENTORY_ID",
  "config": {
    "colors": {
      "background": "#ffffff",
      "accent": "#111111",
      "gradient": ["#ffffff", "#f3f4f6"]
    },
    "font": "Poppins",
    "content": {
      "header": "A gift for you",
      "body": "This card has a gift attached.",
      "questionBlock": {
        "enabled": false,
        "question": "",
        "suspenseTexts": [],
        "answerType": "yes_no"
      }
    }
  }
}
```

Claim:
- `POST /cards/:slug/claim-gift` (auth)

Gift Rules (Backend-Enforced)
-----------------------------
- only `personal` cards can have gifts attached
- only one gift can be attached to a card at a time
- only the card owner can attach gifts to that card
- only gifts in sender inventory with `status: available` can be attached
- deleting an unclaimed gift-attached card returns the inventory item to `available`
- card owner cannot claim their own attached gift
- claim is one-time; subsequent claim attempts fail
- payout split on successful claim:
  - recipient: `90%`
  - Cardora/platform fee: `10%`

Gift Data in User/Card Payloads
-------------------------------
`GET /current-user` now includes:
- `giftsInventory: []`
- `giftWalletNgn: number`

`GET /usercards` now includes:
- `giftAttachment` when present
  - `status` transitions: `attached` -> `claimed`

Premium Checkout
----------------
`POST /create-premium-checkout`
- Initializes Paystack checkout for premium purchase.
- Price: `500 NGN`
- Duration: `30 days`

Premium Gift
------------
`POST /gift-premium`

Body:
```json
{
  "username": "friend_username"
}
```

Rules:
- Sender must have active premium.
- Sender can gift only once.
- Recipient receives `7 days` premium (extends existing premium if active).

Daily Free Claim Notes
----------------------
- `POST /claim-daily-free-coupon` now awards:
  - `2 CC` for premium users
  - `1 CC` for non-premium users
- Streak tracking is now included:
  - `dailyClaimStreak` increments for consecutive daily claims
- `GET /user/coupons` now includes premium/streak fields:
  - `dailyClaimStreak`
  - `dailyFreeRewardAmount`
  - `premiumUntil`
  - `isPremiumActive`

Admin Redeem Code Endpoints
---------------------------
- `POST /admin/redeem-codes`
- `GET /admin/redeem-codes`
- `PATCH /admin/redeem-codes/disable`
- `PATCH /admin/redeem-codes/enable`
- `DELETE /admin/redeem-codes`

Package Endpoints
-----------------
- `GET /coupon-packages` (public/auth)
- `POST /admin/packages`
- `GET /admin/packages`
- `PUT /admin/packages/:packageId`
- `DELETE /admin/packages/:packageId`


================================================================
11) Ads + Enterprise Analytics
================================================================

User Ad Endpoints
-----------------
- `GET /ads/rewarded` (auth)
- `POST /ads/complete` (auth)
- `GET /ads/stats` (auth)
- `GET /ads/enterprise-stats` (auth; enterprise/admin)

Ad Object Highlights
--------------------
- `videoUrl` (required)
- `linkUrl` (optional; frontend should render as tappable/clickable CTA)
- `maxViews` (optional view cap)
- `currentViews`
- `isActive`
- enterprise linkage:
  - `enterpriseAccountId`
  - `enterpriseAccountUsername`

Admin Ad Endpoints
------------------
- `POST /admin/ads`
- `PATCH /admin/ads/:id`
- `DELETE /admin/ads/:id`
- `GET /admin/ads`
- `GET /admin/ads/analytics`
- `GET /admin/ads/global-stats`
- `GET /admin/ads/enterprise-stats`

View Limit Behavior
-------------------
- if `maxViews` reached, ad is auto-disabled
- re-enable requires increasing limit above current views first


================================================================
12) Admin + Moderator Operations
================================================================

Admin + Moderator
-----------------
- `POST /admin/ban-user`
- `POST /admin/unban-user`
- `GET /admin/reports`
- `PATCH /admin/templates/:templateId/disable`

Admin-only
----------
- dashboard/stats/users/packages/redeem codes/full ad admin
- `POST /admin/users/set-role` (enterprise|moderator|user)
- `GET /admin/action-logs`
- `GET /admin/moderator-action-logs`
- broadcaster direct send endpoint
- broadcast request approval endpoint
- `POST /admin/profile-backgrounds`
- `DELETE /admin/profile-backgrounds/:backgroundId`
- `POST /admin/chat-frames`
- `DELETE /admin/chat-frames/:frameId`
- `POST /admin/chat-frame-requests/:requestId/approve`

Moderator-only
--------------
- `POST /admin/broadcast-requests` (request email broadcast for admin approval)
- `POST /admin/chat-frame-requests` (request chat frame creation; admin approval required)


================================================================
13) Broadcast (Email) Workflows
================================================================

Direct Admin Broadcast
----------------------
`POST /admin/send-seasonal-reminder` (admin)
Body:
```json
{
  "subject": "Important update",
  "message": "Custom broadcast body"
}
```

Moderator -> Admin Approval Broadcast
-------------------------------------
1) Moderator submits request:
   - `POST /admin/broadcast-requests`
2) Admin approves and sends:
   - `POST /admin/broadcast-requests/:requestId/approve`

Profile Background Management
-----------------------------
Create profile background (admin):
`POST /admin/profile-backgrounds`

Body:
```json
{
  "id": "bg_gold_01",
  "name": "Golden Aura",
  "url": "https://cdn.example.com/backgrounds/golden-aura.png"
}
```

Delete profile background (admin):
`DELETE /admin/profile-backgrounds/:backgroundId`

Chat Frame Management + Request Flow
------------------------------------
Create chat frame (admin):
`POST /admin/chat-frames`

Body:
```json
{
  "id": "frame_fire_01",
  "name": "Fire Edge",
  "url": "https://cdn.example.com/frames/fire-edge.png",
  "price": 50
}
```

Delete chat frame (admin):
`DELETE /admin/chat-frames/:frameId`

Moderator/admin request chat frame:
`POST /admin/chat-frame-requests`

Approve request (admin):
`POST /admin/chat-frame-requests/:requestId/approve`


================================================================
14) Logs and Auditability
================================================================

Collections
-----------
- Admin actions: `adminActionLogs`
- Moderator actions: `moderatorActionLogs`

Logged fields include
---------------------
- actor id
- actor username
- actor email
- actor role
- HTTP action (`METHOD /route`)
- sanitized request details
- status code
- duration
- timestamp


================================================================
15) Analytics Endpoints
================================================================

- `GET /user-analytics` (auth)
- `GET /card-analytics/:slug` (auth)
- admin stats endpoints under `/admin/stats/*`


================================================================
16) Media Library Endpoints
================================================================

Videos
------
- `POST /media/videos` (auth + admin)
- `DELETE /media/videos` (auth + admin)
- `GET /media/videos` (public)

Music
-----
- `POST /media/music` (auth + admin)
- `DELETE /media/music` (auth + admin)
- `GET /media/music` (public)


================================================================
17) Integration Gotchas for Frontend + AI
================================================================

1) Always trust backend financial fields (`remainingCC`, reward responses), not local calculations.
2) Role checks are strict. Hide unavailable UI actions by role.
3) Use backend pagination params consistently (`page`, `limit`).
4) For moderation dashboards:
   - consume `/admin/reports`
   - provide actions for ban/unban/disable template
5) For ad playback UI:
   - show `linkUrl` CTA when present
   - handle cooldown/daily-limit errors from `/ads/rewarded` and `/ads/complete`
6) Public profile endpoint exists but still requires auth.
7) Template moderation visibility:
   - disabled templates are not returned in public template queries.


================================================================
18) Suggested Frontend Type Stubs
================================================================

```ts
type Role = "user" | "artist" | "enterprise" | "moderator" | "admin";

type PublicProfile = {
  id: string;
  username: string;
  bio: string;
  profilePictureUrl: string | null;
  role: Role;
  createdAt: string | null;
  referralsCount: number;
};

type ReportType = "user" | "card" | "template";
type ReportStatus = "open" | "reviewed" | "resolved" | "dismissed";

type Report = {
  reportId: string;
  type: ReportType;
  targetId: string;
  reason: string;
  details: string;
  reportedById: string;
  reportedByUsername: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
};

type AdStats = {
  views: number;
  impressions: number;
  clicks: number;
  completions: number;
  uniqueViewers: number;
};
```


================================================================
19) Environment Variables (Deployment)
================================================================

Required/important:
- `MONGO_URL`
- `SECRETKEY`
- `CORS_ORIGIN`
- `EMAILUSER`
- `EMAILPASS`
- `PORT` (runtime)

Optional:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `EMAIL_FROM` (recommended, e.g. `Cardora <noreply@cardora.studio>`)
- `EMAIL_REPLY_TO` (recommended, e.g. `cardoraofficial@gmail.com`)
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_PREMIUM_PLAN_CODE` (required for premium subscription checkout)
- `FLUTTERWAVE_SECRET_KEY` (required for gift checkout + transaction verification)
- `FLW_SECRET_HASH` or `FLUTTERWAVE_SECRET_HASH` (required for webhook signature verification)
- `FLUTTERWAVE_REDIRECT_URL` (optional; fallback is `CORS_ORIGIN`)


================================================================
20) Final Notes for Your Frontend Partner
================================================================

If using AI to scaffold frontend code:
1) paste this whole README into AI context
2) ask AI to generate:
   - typed API client
   - auth/token interceptor
   - role-gated route guards
   - moderation dashboard pages
   - reports UI + actions
   - ad playback + reward state handling
3) keep backend response contracts as final authority if generated frontend assumptions differ
