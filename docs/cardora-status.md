# Cardora — Comprehensive Status Report

Full audit landed. Everything below is drawn from a read-only sweep of the codebase on branch `claude/analyze-and-adjust-repo-WwN1I`. Use it as your QA/testing/config reference.

---

## 1. Routes & Pages

Every route except `/ask/:username` is wrapped in `<MainLayout>` (shared session/state via `useOutletContext`). All page components are `lazy()`-imported.

| Path | Component | In MainLayout | Notes / gating |
|---|---|---|---|
| `/` | `pages/Home.jsx` | Yes | Public. Artist gets different eyebrow/CTA copy. |
| `/explore` | `pages/Explore.jsx` | Yes | Public. |
| `/artists` | `pages/Artists.jsx` | Yes | Public. Deep-link via `?id=`. |
| `/store` | `pages/Store.jsx` | Yes | Public UI; purchases require auth. |
| `/store/gifts` | `pages/StoreGifts.jsx` | Yes | Auth for buy. |
| `/card/:id` | `pages/CardView.jsx` | Yes | Public read via `/cards/:slug`; locks handled in-page. |
| `/card/:slug/responses` | `pages/CardResponses.jsx` | Yes | Owner-only backend read. |
| `/studio` | `pages/CardStudio.jsx` | Yes | Full designer. |
| `/quick` | `pages/QuickCreate.jsx` | Yes | Renders sign-in prompt if `!currentUser`. |
| `/create` | `pages/CreateCardPicker.jsx` | Yes | Type picker. |
| `/admin` | `pages/AdminDashboard.jsx` | Yes | Access-restricted UI, backend enforces. |
| `/moderator` | `pages/ModeratorDashboard.jsx` | Yes | Access-restricted UI. |
| `/enterprise` | `pages/EnterpriseDashboard.jsx` | Yes | Access-restricted UI. |
| `/artist` | `pages/ArtistDashboard.jsx` | Yes | Access-restricted UI. |
| `/chat` | `pages/WorldChat.jsx` | Yes | Auth required to send / connect socket. |
| `/profile` | `pages/Profile.jsx` | Yes | Guest state if `!currentUser`. |
| `/login` | `pages/AuthPage.jsx` (`mode=login`) | Yes | Navigates `/` if authed. |
| `/signup` | `pages/AuthPage.jsx` (`mode=signup`) | Yes | Navigates `/` if authed. |
| `/legal/:doc` | `pages/LegalPage.jsx` | Yes | Public. |
| `*` | `pages/NotFound.jsx` | Yes | Catch-all. |
| `/ask/:username` | `pages/AnonSend.jsx` | **No** | Public standalone. |

---

## 2. Auth Flow

- **Token storage**: `sessionStorage['cardora:authToken']` (tab-scoped on purpose — a second account in another tab used to clobber the first tab's socket auth). One-time migration reads any legacy `localStorage` value.
- **Signup** → `POST /signup`. Fields: username, email, password, confirm, optional referralCode, currency (NGN/USD/EUR/GBP), terms + privacy required. Sends a `ui-avatars.com` placeholder as `profilePictureUrl`.
- **OTP verify** → `POST /verify-email` (6-digit); resend via `POST /request-otp`.
- **Referral code** → invalid codes surface: "That referral code is not valid. Leave it empty or use a valid one."
- **Signup bonus banner** → `GET /signup-bonus/availability` polled on Home hero + AuthPage signup mode.
- **Login** → `POST /login`. Password autocomplete `current-password` + show/hide toggle. Unverified branch shows inline "Verify here" link.
- **Forgot / reset password** → `POST /forgot-password` then `POST /reset-password`. Min password length 8 client-side.
- **Session hydration** → `MainLayout.hydrateSession` runs once on mount. Calls `getCurrentUser()` + `getUserCoupons()` via `Promise.allSettled`. 401/403 on `/current-user` fully clears session. Sets `authReady` for skeleton states.
- **Logout** → `POST /logout`, then clears local state in `finally` (failing call still logs out).
- **Delete account** → `DELETE /delete-account` behind "type DELETE to confirm" gate.
- **Guest identity** → `localStorage['cardora:guestId']` UUID (with fallback), sent as `X-Guest-Id` on every request so anonymous voters/repliers aren't collapsed by NAT/IP.

---

## 3. Roles

`ROLE_MAP` (`backendMappers.js:5-12`): `admin → Admin, artist → Artist, creator → User, user → User, moderator → Moderator, enterprise → Enterprise`. Unknown roles get title-cased.

| Role | Dashboard | Key endpoints | Enforcement |
|---|---|---|---|
| **Admin** | `/admin` | All `/admin/*` | Profile link + dashboard visible; backend enforces |
| **Moderator** | `/moderator` | Reports, ban/unban, disable templates, moderator logs, broadcast requests | `isModerator` gate on page |
| **Enterprise** | `/enterprise` | `getEnterpriseAdStats`, `updateAdminAd` (own ads only) | `isEnterprise` gate on page |
| **Artist** | `/artist` | `getMyTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, tracking | Studio unlocks full toolkit at 0 CC; Send becomes Publish |
| **User** | *(uses `/profile`)* | Everything a signed-in user needs | Default |
| **Visitor** | none | Unauth reads only (`getTemplates`, `getPopularTemplates`, `getCardBySlug`, `getGiftCatalog`) | Default when logged out |

**Artist apply**: Profile → "Apply as Artist" modal collects portfolio URL, bio, contact email → `POST /artistapply`. No self-serve moderator/enterprise apply — the UI points to `support@cardora.app`.

---

## 4. Currency (CC — Cardora Coins)

**Balance store**: `MainLayout.balance` state, blended into `hydratedUser` so pages can read `balance` or `currentUser.balance`. `resolveBalance` in `backendMappers.js` reads from ~10 possible keys (`couponBalance`, `ccBalance`, `balance`, `coupons`, `numberOfCC`, `cc`, `totalCC`, …). `refreshBalance` = re-run `hydrateSession()`.

### Earn paths

| Source | UI | Endpoint |
|---|---|---|
| Signup bonus | Home banner, AuthPage banner | `/signup-bonus/availability` |
| Daily coupon | Store → Rewards → Earn | `POST /claim-daily-free-coupon` (Premium users get 2 CC) |
| Redeem code | Store → Rewards → Redeem | `POST /redeem-code` |
| Rewarded ads | Store → Rewards → Earn (`RewardedAds.jsx`) | `/ads/rewarded`, `/ads/complete`, `/ads/stats` |
| Referral milestones | Passive via `ccIncomeHistory` | Server-side |
| CC purchase | Store → Buy CC | Paystack primary, `/create-coupon-checkout` fallback (on 404 only) |

### Spend matrix (from `tierRequirements.js`, mirroring CLAUDE.md)

| Type | classic | premium | elite |
|---|---|---|---|
| personal | 0 | 25 | 35 |
| poll | 0 | ❌ | 35 |
| trivia | 0 | ❌ | 50 |
| chain | 0 | ❌ | 40 |
| anonymous | 0 | ❌ | 45 |

Live-priced via `GET /cards/prices`; falls back to table above. Non-personal `premium` is auto-upgraded to `elite` in `MainLayout.handleCreateCard`.

### Purchase flow
- `addToCart` picks Paystack; falls back to `createCouponCheckout` **only on HTTP 404** (500s throw to prevent double-charges).
- Callback URL keys sent in every variant the backend might read (`callbackUrl`, `callback_url`, `redirectUrl`, `redirect_url`, `returnUrl`) all set to `${origin}/store`.
- `normalizeCheckoutSession` walks ~7 possible envelope paths, then does a full-page redirect.

### Premium subscription
₦500 / 30 days via `POST /create-premium-checkout`, returns to `/profile?premium=callback`. Post-return effect waits 1.2s (webhook delay) then refreshes balance. Gift Premium via `POST /gift-premium` with `{username}`.

### Gifts
`GET /gifts/catalog` → catalog. `POST /gifts/flutterwave/checkout` (NGN-only) with placeholder in `sessionStorage['cardora:pendingGiftCheckout']`. Return: `POST /gifts/verify-payment` retried 3× with backoff. Attach: Studio sends `giftInventoryId` inline on card create (atomic rollback); QuickCreate uses separate `POST /cards/attach-gift`. Claim: `POST /cards/:slug/claim-gift`. Withdrawal (NGN only): `getWalletSummary`, `getBanks`, `resolveBankAccount`, `saveBankDetails`, `withdrawGiftWallet`.

### Referral
- Link: **`https://cardora.studio/signup?ref=<code>`** (hardcoded, no longer origin-based).
- Milestones: 1 → 5 CC, 5 → 15, 10 → 30, 25 → 75, 50 → 150. Progress bar uses equal-spaced segments now with correct segment-proportional fill.

### Currency
`getCurrencies`, `updateCurrency`, `getUserCurrency`. `MainLayout.handleCurrencyChange` writes the choice then re-fetches `loadPublicData(code)` so CC packs re-price. Fallback set: `NGN, USD, EUR, GBP, GHS, KES, ZAR`.

---

## 5. Studio Flow (`CardStudio.jsx`, ~4523 lines)

### Entry points
1. `CreateCardPicker` (`/create`) — type-only picker.
2. `CardTypeModal` (Home CTA / ScreenNav FAB / `openCardTypeModal` context).
3. Direct URL `/studio?type=<personal|poll|trivia|chain|anonymous>`.
4. Draft restore from Profile → router state.
5. Template edit (Artist) → `state.editTemplateId`.

### Tools
`ALL_TOOLS` = 14 tools in groups Content | Style | Effects | Interactive. Every user gets the full toolkit for their card type — no upfront gate.

| Type | Tools |
|---|---|
| personal | closedState, content, media, background, theme, cardStyle, animation, experience, interaction, gifts |
| poll | content, media, background, theme, cardStyle, animation, interaction, poll |
| trivia | content, media, background, theme, cardStyle, animation, interaction, trivia |
| chain | content, media, background, theme, cardStyle, animation, interaction, chain |
| anonymous | content, media, background, theme, cardStyle, animation, interaction, anon |

Artists get `gifts` filtered out. `experience` (galaxy) is personal-only.

### Live tier meter
`computeCardTier(cardObject, ctx)` returns `{ tier, reasons }`. Every rule mirrors a backend gate — music/videoBg/openEffect/gift/lock are always elite; premium palette / typewriter / animated border are premium (upgraded to elite for non-personal). Displayed via `<TierMeter>` + per-control `<TierPip>`. Test coverage in `src/lib/tierRequirements.test.js`.

### Inline editing
`activeEditEl` state + `contentEditable` on heading, body, closed-state envelope heading/body, envelope body/flap/seal (with color pickers). Poll options + chain prompt are now inline-editable in the preview (recent fix). Trivia questions edited from the tool panel.

### Send flow
- Modal opens even for free cards (design decision: sender always sees the tier/cost breakdown).
- Flushes pending Cloudinary uploads, resolves any local-pending gift to an inventory id, then routes to the appropriate `createCard*` endpoint.
- Slug extracted from ~8 possible response shapes.
- Clears autosave on success.
- Gift attach is atomic with card creation (send `giftInventoryId` in payload).

### Send modal
`SendReceipt.jsx` shows reasons + tier + cost, "Trim extras & send free" button. Post-send: shareable slug URL, copy button, WhatsApp/Telegram/X/Twitter buttons, native `navigator.share` "More" button, mailto email row.

### Autosave
Key `cardora:studioAutoSave:<userId|guest>`, debounced 600ms, flushed on `beforeunload`. Scoped by `studioType` — poll draft can't restore into a personal card.

### Publish vs Send
Button flips at `CardStudio.jsx:4001`: `isArtist ? setShowPublish : handleSendClick`. Publish goes through `updateMarketplaceTemplate` (edit) or `publishTemplate` (`POST /create-template`) and requires a screenshot upload.

### Mobile vs desktop
Separate render paths — desktop `.cs-toolrail` + preview + `.cs-settings`; mobile `.cs-mobile-shell` / `.cs-m2-*` with header, full-height preview, inline edit zone. Now fully themed for light mode.

---

## 6. Quick Create (`QuickCreate.jsx`, ~1109 lines)

- Multi-step: theme → font → content → preview → send.
- All 5 types supported via `?type=`. **`?tier=` is inert now** (harmless leftover in some `navigate()` calls).
- Fewer palettes (6 initial vs full library), max 3 images, one heading/body, no envelope/lock/ambient/chain-rules.
- "Open in Studio" hands off the built `cardObject` via router state.
- Gate: renders sign-in prompt if `!currentUser`.
- Trim/pricing use the same `tierRequirements.js` — no duplication.
- Gift attach uses the 2-step `attachGiftToCard` (unlike Studio's atomic path).

---

## 7. Card Recipient View (`CardView.jsx`)

- URL `/card/:id` (slug or id). Public via `getCardBySlug`; automatically authenticates if a token exists (owner sees answer state).
- Handles many envelope shapes (`res.card`, `res.data.card`, `res.renderModel`, `res.payload`, `res.result`, top-level) via `isCardLike` heuristic.
- Preserves separately: mapped card, `interaction` (server-side keyed to viewer), `reactions`, `_chainState`.
- Client-side OG/Twitter meta injected as a fallback; real scrapers get pre-rendered HTML from `api/card-meta.js`.

### Locks
- **password**: 403 with `payload.locked` → password gate; hint from `layoutdata.styleExtras.lockHint`. Retries with `?password=`.
- **timer**: FE reads `enhancements.lock.type === 'timer'`; shows countdown until unlockAt.
- **tap / scratch**: not blocked at fetch — frontend-only reveal in `CardPreviewModal`.

### Interaction submitters (all with waterfall paths, 404/405 fall-through only)
- Poll: `/cards/:slug/poll-vote|poll/vote|vote|response` + `/public/*` twins.
- Trivia: same waterfall.
- Chain: same.
- Anonymous: `POST /cards/:slug/anonymous-message` (no auth attached even if present).
- Personal Q&A: `submitCardResponse`.
- Reactions: `reactToCard` → `POST /cards/:slug/react`.

### Bots
`vercel.json` user-agent regex (Facebook, Twitter, WhatsApp, Telegram, Slack, Discord, LinkedIn, Google, Pinterest, Reddit, Applebot, Skype, VK, W3C Validator, Bitrix, Iframely, Embedly) → `api/card-meta.js` / `api/ask-meta.js` for real per-card OG. Others get the SPA.

---

## 8. Anonymous Inbox

**There is no `AnonInbox.jsx` and no `/inbox` route.** Backend has no user-inbox concept — every anonymous card is just a card with a slug.

- `/ask/:username` (`AnonSend.jsx`) is public; resolves via `GET /users/:username/profile`. Renders "User not found" or "No inbox link connected yet — ask them to send you their Cardora card link directly" (CTA to `/create`).
- Recipient's anonymous responses land at `/card/:slug/responses` via `CardResponses.jsx`'s embedded `AnonInboxView`.
- Endpoints: `POST /cards/:slug/anonymous-message` (send), `GET /cards/:slug` (owner authed read).

---

## 9. Explore, Marketplace, Templates

### `/explore`
- Grid from `marketplaceTemplates` (`GET /templates?page=1&limit=24`, approved/live only).
- Trending rail (`GET /templates/popular?days=7&page=1&limit=8`).
- Filters: search, type (all/personal/poll/trivia/chain/anonymous), category, favorites, paginated Load More (12 at a time). Filter state syncs to URL query.

### `CardDetailModal`
Opens from `openCardDetails` context. Preview, likes, "Share to World Chat", "Use Template" → Studio prefilled.

### Artist templates
- Publish: `POST /create-template`. Optimistically added to local marketplaceTemplates so Artist sees Pending review immediately.
- Moderation: Admin Templates tab uses `getAdminTemplates`, `approveTemplate`, `rejectTemplate`, `disableAdminTemplate` (7-day), `enableAdminTemplate` (waterfall enable/restore/reenable), `adminDeleteTemplate`.
- Moderator can disable but not delete.
- Templates use custom `id` (e.g. `CDT-xxxxx`); Mongo `_id` is last-resort fallback only.

---

## 10. World Chat (`WorldChat.jsx`, ~637 lines)

- Socket: `io(API_BASE, { auth: { token }, transports: ['websocket','polling'] })`. Server verifies token — no client-supplied username/userId trust.
- History: `GET /chats?page=1&limit=50` on mount.
- Events: `new_message` (150-message ring buffer), `user_joined`/`user_left` toasts, `online_count`, `error` with cooldown-parsing for rate-limits.
- Extras: online/offline detection, 30-second timestamp ticker, template-share pending state from router, extended-profile modal via `getPublicProfile`.
- Header: single unified structure (recently fixed for light mode).

---

## 11. Admin / Moderator / Enterprise Dashboards

### `/admin` — 11 tabs
`Overview | Users | Reports | Templates | Packages | Codes | Ads | Media | Gifts | Coupons | Logs`

| Tab | Actions |
|---|---|
| Overview | Stat tiles, broadcast (`sendSeasonalReminder` = actual broadcast; do NOT stub as `/admin/broadcast-message`), broadcast-request approve/reject |
| Users | List, ban, unban, setRole |
| Reports | Filter by type/status, update status |
| Templates | Approve, reject-with-reason, disable-for-N-days, enable, admin-delete |
| Packages | Full CRUD |
| Codes | Create, disable, enable, delete |
| Ads | Full CRUD (video via Cloudinary), enterprise account assignment via dropdown |
| Media | Profile Backgrounds, Videos, Music (music trim happens client-side, only trimmed clip uploaded) |
| Gifts | Signup Bonus reset, Custom gifts (10 effect keys × 5 tiers), Broadcast Delivery Logs |
| Coupons | Read-only ledger |
| Logs | Admin action logs + moderator action logs |

### `/moderator` — 5 tabs
`Reports | Users | Templates | Logs | Broadcast`. Reports (no delete power), ban/unban (no setRole), template disable-only, own action logs, broadcast request (routes to admin approval).

### `/enterprise`
Stats grid (Views/Impressions/Clicks/Completions/Unique Viewers) from `getEnterpriseAdStats` with client-side fallback. Ads table with pause/resume via `updateAdminAd(id, { isActive, active })` — single method, no duplicate.

---

## 12. Store

### `/store` — Buy CC | Rewards Hub | Gifts
- **Buy CC**: paginated PackCards from `couponPackages` (loaded via `GET /coupon-packages?activeOnly=true&currency=<X>`). Confirmation modal → Paystack redirect.
- **Rewards → Earn**: daily coupon + streak, then `<RewardedAds>` (80% watch threshold, 30s cooldown, daily limit merged server + `localStorage['cardora:rewardedAds:<YYYY-MM-DD>']`).
- **Rewards → Redeem**: text input → `redeemCode`.
- **Rewards → Referrals**: referral code copy, invite link (cardora.studio), milestone progress bar (5 markers, equal-spaced, correct segment-based fill).
- Currency selector is in **Profile**, not Store.

### `/store/gifts`
Catalog from `getGiftCatalog` (10-heart fallback). Purchase via Flutterwave (NGN only). Return: `verifyGiftPayment` fires immediately, retries 3× with backoff, only claims success if gift lands. Inventory view with per-item statuses (available/unverified/pending). Wallet chip in ₦ (NGN-only by design).

---

## 13. Profile

- **Header**: avatar (Cloudinary via `AvatarCropModal`), name, @username, role badge, premium badge, bio, referral code (click to copy).
- **Stats**: role-conditional — Artist gets templates/likes/views/uses; Enterprise gets ads/views/clicks/completions; default gets balance/cards/views/likes. "More stats" reveals CC Earned + Saved + Gifts + **Gift Wallet Withdraw** button.
- **Edit Profile** modal → name/username/bio patch.
- **Role dashboard links** — one link per role.
- **Artist apply** button (for non-special roles).
- **Premium section**: subscribe CTA, gift-premium (once premium), profile background picker (once premium).
- **Currency preference** dropdown.
- **Drafts** from `localStorage['cardora:studioDrafts:<userId>']`.
- **Published Templates** (Artist): from `getMyTemplates` (fallback filter marketplace by ownerId). Edit Design, Edit Info, Delete.
- **My Cards**: `getUserCards`. Delete now uses `card._id || card.id` (recently fixed — matches backend `findOne({ id: cardId })`).
- **Saved Cards**: favorites-filtered from marketplace.
- **Gift Inventory** (non-artist).
- **CC Income History** (last 10 reversed).
- **Gift Wallet modal**: bank picker, account resolution, save, withdrawal.
- **Danger zone**: logout + delete-account (typed-DELETE gate).

---

## 14. Theming

- Toggle: sun/moon in `ScreenHeader.jsx`. Persists `localStorage['cardora-theme']`; first visit falls back to `prefers-color-scheme` live until user picks.
- Tokens: `src/index.css` `:root { }` + `:root[data-theme="light"] { }`.
- Overrides: `App.css` has **1321 `data-theme="light"` selectors** (flagged in CLAUDE.md as intentional wart).
- `main.jsx` stamps `data-theme` before first render (no dark→light flash).

### Known light-mode gaps (hardcoded near-white text without light override)
| File | Sites |
|---|---|
| `App.jsx:31` | `RouteFallback` loader color |
| `components/ErrorBoundary.jsx:37` | fallback text |
| `components/CardPreviewModal.jsx` | many inline rgba(255,255,255,…) — mostly card overlay where card bg is dark, but line 1101 loaders could bleed |
| `pages/CardResponses.jsx:508, 612` | inline light-cyan tinted greys |
| `pages/CardView.jsx:200` | "We could not find that card" fallback |
| `pages/AdminDashboard.jsx:1364, 1407` | "No pending requests" / "Loading…" placeholders |
| `pages/ModeratorDashboard.jsx:438` | ban-confirm modal text |
| `pages/AnonSend.jsx:58, 95` | light-mode-agnostic text |
| `data/layoutData.js:6, 16` | neutral text/border constants |

None blocking, but `ErrorBoundary` and `CardResponses` will read as low-contrast.

---

## 15. API Surface (~920 lines in `src/lib/api.js`)

All exports go through `request()` or `requestFirstSuccess()`. Waterfall calls only fall through on 404/405 (not 400/500).

**Auth**: `signup`, `verifyEmail`, `requestOtp`, `login`, `logout`, `forgotPassword`, `resetPassword`, `getSignupBonusAvailability`

**Users**: `getCurrentUser`, `updateProfile`, `deleteAccount`, `getUserCards`, `equipProfileBackground`, `getProfileBackgrounds` (waterfall), `createProfileBackground`, `deleteProfileBackground`, `getPublicProfile`

**Cards**: `deleteCard` (waterfall), `getCardPrices`, `getCardBySlug`, `getMyCard`, all interaction submitters (all waterfall), `reactToCard`, 12 `createCard*` variants

**Templates**: `getTemplates`, `getMyTemplates`, `getPopularTemplates`, `getTemplateById`, `like/unlikeTemplate`, `trackTemplateView/Use`, `create/update/deleteTemplate`, `adminDeleteTemplate` (waterfall), `getAdminTemplates`, `approve/rejectTemplate`, `disable/enableAdminTemplate`

**Store**: `getUserCoupons`, `claimDailyFreeCoupon`, `redeemCode`, `getCouponPackages`, `createPaystackCheckout`, `createCouponCheckout`, `createPremiumCheckout`, `giftPremium`

**Gifts**: `getGiftCatalog`, `createFlutterwaveGiftCheckout`, `verifyGiftPayment`, `attachGiftToCard`, `claimGiftFromCard`, plus wallet (`getWalletSummary`, `getBanks`, `resolveBankAccount`, `saveBankDetails`, `withdrawGiftWallet`)

**Ads**: `getRewardedAd`, `completeAd`, `getAdStats`, `clickAd` (waterfall), `trackAdView` (waterfall)

**WorldChat**: `getWorldChat`

**Artists**: `getArtists`, `getArtistById`, `artistApply`

**Analytics**: `getUserAnalytics`, `getCardAnalytics` (wrapper — currently unused, kept for future per-card analytics UI)

**Currency**: `getCurrencies`, `updateCurrency`, `getUserCurrency`

**Admin**: full suite covering dashboard/users/coupons/logs, ban/unban/setRole, reports + status, broadcast requests, moderator logs, `getEnterpriseAdStats` (5-path waterfall), reporting endpoints, packages CRUD, redeem codes CRUD, `sendSeasonalReminder`, stats endpoints, ads CRUD (`updateAdminAd` used everywhere including from EnterpriseDashboard), signup bonus, custom gifts CRUD, broadcast delivery logs

**Media**: videos + music (with `deleteMediaVideo/Music` waterfalls) + `updateMediaMusic`

**Notable observations**:
- `clickAd` / `trackAdView` waterfalls each try 5 candidate paths — 4 will 404 in production. Noisy in monitoring.
- Gift attach path split: Studio atomic (via `giftInventoryId` in payload), QuickCreate 2-step (via `attachGiftToCard`). Worth unifying.
- No `TODO`/`FIXME` markers anywhere in `src/`, `api/`, or `vite.config.js`.

---

## 16. Recent Fixes on This Branch

Themes from recent commits:
- **Cloudinary env safety** (hard build-time env-guard in `vite.config.js`).
- **Light-mode audit** (regressions fixed, ESLint noise unburied).
- **Galaxy experience** landed (memory photos on nodes, mobile readability).
- **Ambient effects rework** (per-effect palettes, live-music-driven, mobile coverage).
- **Gift attach double-path bug fixed** (no more spurious "This card already has a gift" toast on successful sends).
- **Motion quality** (typewriter lag, device-capability-coordinated open effects, gift shape variety).
- **Tier system overhaul** (compute-at-send, link unfurl, reactions, anon media).
- **Studio Phase 2 revert** (shared `StudioEnvelope` component instead of embedded preview).
- **Test infra** (vitest + jsdom + @testing-library; `tierRequirements.test.js`, `backendMappers.test.js`, `ErrorBoundary.test.jsx`).

Plus in this session: poll/chain inline preview editing, card type order (Chain + Anon before Poll + Trivia), delete-card `id` fix, media 413 strip (base64 URLs dropped from payload), admin duplicate ad-assignment UI removed, `updateEnterpriseAd` duplicate method removed, referral link uses `cardora.studio`, milestone progress bar spacing/fill fixed, mobile studio full light-mode overrides.

---

## 17. Deployment & Environment

### `vite.config.js`
- Required env: `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`. Optional: `VITE_API_BASE_URL` (default `https://cardora-uss3.onrender.com`).
- `checkDeployableEnv(mode)`:
  - Deploy host (`VERCEL` or `CI` set): missing Cloudinary vars **throw**, aborting build. Localhost `VITE_API_BASE_URL` on deploy host also throws.
  - Local: warns but succeeds.
  - Escape hatch: `SKIP_ENV_CHECK=1`.
- Vitest excludes `Backend/**`.

### `vercel.json`
- SPA catch-all `/(.*) → /`.
- Two bot-only rewrites (long UA regex): `/card/:slug` → `/api/card-meta`; `/ask/:username` → `/api/ask-meta`.

### Serverless functions
- `api/card-meta.js` — server-fetches `${BACKEND}/cards/:slug`, per-type OG title/description, 5-min public cache. `SITE_ORIGIN=https://cardora.studio`.
- `api/ask-meta.js` — server-fetches profile, "Ask @username anonymously" OG with profile picture.

### Package
React 19.2.4, React Router 7.9.3, three 0.160.1 (galaxy), socket.io-client 4.8.3, canvas-confetti, framer-motion 12, html2canvas, @tsparticles/*, react-colorful, react-icons. Dev: vite 8, vitest 4, playwright 1.62.

---

## QA Checklist

1. **Auth**: signup with/without referral, OTP verify, resend, unverified-login → verify-inline, forgot password, logout, delete account.
2. **Tab isolation**: log into A in tab 1, B in tab 2 — tab 1 stays A, each World Chat socket authenticates as its own tab's user.
3. **Card creation**: verify every `type × tier` in the CC matrix; trim-to-free button on a heavily-decorated card.
4. **Recipient view**: password lock (correct/wrong), timer lock (before/after), poll vote (auth + guest), trivia score, chain reply, anonymous message with `allowAnonMedia` on/off.
5. **Studio drafts**: autosave restore across reload with same `?type=`; poll draft doesn't restore into personal card.
6. **Referral**: create referred account, hit milestone, verify CC in `ccIncomeHistory`, verify segment math (1/5/10/25/50).
7. **Gifts**: buy via Flutterwave, return path, inventory landing; attach via Studio (atomic) and QC (2-step); recipient claim.
8. **Rewarded ads**: 80% watch → reward; daily-limit merge server + local.
9. **Admin flows**: direct broadcast, moderator request → admin approve, template disable/enable/delete, ad create + Cloudinary upload, ad enterprise assignment, redeem code create, gift create.
10. **Enterprise**: pause/resume ad, aggregate stats fallback with partial data.
11. **Bots**: `curl -A "Twitterbot/1.0" https://<host>/card/<slug>` returns pre-rendered OG HTML.
12. **Light mode**: force via header toggle, walk every page watching for the near-white text sites in §14.
13. **Env safety**: `VERCEL=1 npm run build` without Cloudinary vars must fail; local build without vars must warn but succeed.
