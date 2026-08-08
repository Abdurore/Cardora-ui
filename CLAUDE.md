# Cardora UI — Project Memory

## Frontend tier model: "design free, pay at send"

The Studio (`src/pages/CardStudio.jsx`) and Quick Create (`src/pages/QuickCreate.jsx`) no longer ask for a tier upfront and never lock any tool/control. Every sender gets the full toolkit; the card's tier and CC cost are **computed live** from what's actually on the card, shown in a persistent tier meter (`src/components/TierMeter.jsx`), with small pips (`src/components/TierPip.jsx`) on controls that would raise the cost. The send modal is a receipt (`src/components/SendReceipt.jsx`) listing every reason the card costs what it costs, plus a one-tap "Trim extras & send free."

**Single source of truth**: `src/lib/tierRequirements.js`.
- `computeCardTier(cardObject, { type, pollData, triviaData, chainData, isArtist })` → `{ tier, reasons }`. Data-driven rule registry — every rule mirrors a real backend gate (`Backend/Cardora/src/cards/engine.js` `assertNoInvalidEnhancements`, or a `tierLimits.js` cap). Artists always compute `elite` with no cost (informational only — their flow is Publish, not Send).
- `trimCardToTier(cardObject, targetTier, ctx)` → deep-cloned, stripped-down `{ cardObject, pollData, triviaData, chainData, removed }`. Powers "Trim extras & send free."
- `getTierCost` / `normalizeCardPrices` / `TIER_COST_BY_TYPE` — shared pricing, fetched live via `getCardPrices()` with the same fallback table CardStudio and QuickCreate both import from here (don't re-duplicate it in either page).

**Gotchas already handled — don't reintroduce them:**
- A blank draft's starting colors depend on the *viewer's own* site theme at creation time (CardStudio seeds light-mode-friendly colors when the studio itself is in light mode). `hasCustomColors`/`envelopeDeviates` in tierRequirements.js compare against **both** the dark and light untouched baselines — comparing against only one, or against mere truthiness, flags every fresh card as "hand-picked colors" (this shipped as a real bug once already).
- Music and any open effect (`animation.openEffect !== 'none'`) are **always** an elite reason regardless of that effect's own `tier` tag in `studioEffects.js` — the backend rejects both below elite outright, so the tags there are Studio-picker-only leftovers, not pricing truth.
- `studioTier`/`cardTier` must be computed via `useMemo` **after** `cardObject`/`pollData`/`triviaData`/`chainData` state exists, and any early `if (!currentUser) return` gate must come **after** every hook (including these `useMemo`s) — putting the gate first causes a "rendered more hooks than during the previous render" crash the moment a logged-in user's tier hooks start running.
- `?tier=` in the URL is inert everywhere now (Studio, QuickCreate) — callers may still pass it (harmless leftover in a few `navigate()` calls), but nothing reads it anymore.

## Backend Card Creation Schema (CRITICAL — single source of truth)

Reference files live under `Backend/Cardora/src/`. Read them when in doubt:
- `routes/cardRoutes.js` — endpoint list
- `controllers/cardController.js` — controller logic + state shape
- `cards/schema.js` — Joi validation rules (the actual gate)
- `cards/engine.js` — sanitisation, tier rules, render model
- `cards/constants.js` — enum values + card costs
- `middleware/validate.js` — runs Joi with `allowUnknown: false` (extra fields rejected)

(The old `Backend files/` snapshot folder referenced here previously has been deleted — the live backend at `Backend/Cardora/` is the only source of truth now.)

### Top-level payload shape (POST /create-card variants)

Per `cards/schema.js`'s `baseCreateSchema`, these top-level fields are valid — anything else 400s under `allowUnknown: false`:
```js
{
  id: 'optional-string',                 // rarely sent by the frontend
  name: 'optional-string',               // card display name; NOT `title`
  type: 'personal',                      // required on non-forced endpoints (see table below)
  tier: 'classic',                       // required on non-forced endpoints
  config: { colors: {background, accent, gradient: [c1, c2]}, font, content: {...} },
  enhancements: {...},                   // {} for classic
  layoutdata: { paperTexture: {type, opacity, blendMode} },
  state: {...},                          // rarely sent by the frontend
  giftInventoryId: 'optional-string',    // mutually exclusive with inventoryId (Joi .oxor)
  inventoryId: 'optional-string',
  meta: { creatorId, createdAt },        // rarely sent by the frontend
}
```

**DO NOT include**: `useCoupons`, `couponType`, `anonTemplate`, `title`, `templateId`, or any other field not listed above — `allowUnknown: false` rejects them.

**On the *forced* endpoints** (`/create-card/elite`, `/create-card/poll/elite`, etc.), `type`/`tier` are **not** `Joi.forbidden()` — they use `.valid(forcedValue).default(forcedValue)`. That means: omit them and they default correctly (this is what the frontend mappers do); send them and they must exactly match the endpoint's forced type/tier or the request 400s. Sending the *wrong* type/tier is rejected, but sending the *right* one is harmless.

### Endpoints (all auth-required)

| Endpoint | type | tier |
|---|---|---|
| `POST /create-card` | required | required |
| `POST /create-card/classic` | required | forced to `classic` (defaulted; omit it) |
| `POST /create-card/premium` | required | forced to `premium` — personal only! |
| `POST /create-card/elite` | required | forced to `elite` (defaulted; omit it) |
| `POST /create-card/anonymous` | forced to `anonymous` | forced to `elite` |
| `POST /create-card/{poll\|chain\|trivia\|anonymous}/{classic\|elite}` | forced to match the path | forced to match the path |

"Forced" means defaulted-if-omitted and validated-if-sent (see above) — not `Joi.forbidden()`.

### Card type/tier matrix (from `CARD_COSTS`)

| Type | classic | premium | elite |
|---|---|---|---|
| personal | 0 CC | 25 CC | 35 CC |
| poll | 0 CC | ❌ | 35 CC |
| chain | 0 CC | ❌ | 40 CC |
| trivia | 0 CC | ❌ | 50 CC |
| anonymous | 0 CC | ❌ | 45 CC |

Premium is **only allowed for personal**. Engine throws if `tier==='premium' && type!=='personal'`.

### config.colors (3 fields, exact)

```js
{
  background: string,     // min(1) max(50)  — dark surface
  accent:     string,     // min(1) max(50)  — primary accent (= palette.primary)
  gradient: [string, string]  // EXACTLY 2 strings, each min(1) max(50)
}
```

Frontend palette → backend mapping:
- `palette.surface` → `colors.background`
- `palette.primary` → `colors.accent` AND `colors.gradient[0]`
- `palette.accent`  → `colors.gradient[1]`
- `palette.ink` (text) is **NOT stored** in config.colors. On reconstruction, derive from background luminance (helper: `isLightColor()` in `backendMappers.js`).

### config.content (per type, all min(1) on required fields)

```js
// personal
{ header: required(1-200), body: required(1-4000), questionBlock: { enabled, question, suspenseTexts[], answerType: 'yes_no' } }

// poll
{ question: required(1-500), options: [{ id: required(1-100), text: required(1-300) }] }  // 2-25 options

// chain
{ challenge: required(1-600), rules: [string(1-300)] }  // max 25 rules

// trivia
{ questions: [{ question: required(1-500), options: [string(1-300)] (2-8), correctIndex }] }  // 1-50 questions
// CUSTOM RULE: correctIndex must be < options.length

// anonymous
{ message: required(1-2000) }
```

Empty strings on required fields = **400 validation error**. Frontend `handleCreateCard` validates client-side before submit and returns a clear message.

### enhancements (per tier)

**classic** → MUST be `{}` (or exactly defaults — engine stringifies and compares).

**premium** (personal only) → no `video` background, no music, no openEffect, no media.

**elite** → all enhancements allowed.

```js
{
  background: {
    type: 'color'|'gradient'|'video'|'animated',  // 4 valid types
    value: string,
    videoSettings: { blur, darkTint, tintLevel, tintColor },
    gradientAnimation: { enabled, duration }
  },
  music: { track: string, volume: number(0..1) },     // ⚠ "track" not "url"
  lock: {
    type: 'none'|'tap'|'scratch'|'timer'|'password',  // ⚠ "timer" not "time"
    value: string|number
  },
  ambientEffect: { type: 'none'|'starfield'|'snow'|'bubbles'|'fountain'|'fireflies'|'floating', emojis: [] },
  openEffect: {
    type: 'none'|'confetti'|'fireworks'|'heartsBurst'|'starShower'|'balloons'|'emojiRain',
    colors: [string, string, string]  // ⚠ EXACTLY 3, each min(1). Empty strings fail!
  },
  media: [{ type: 'image', url: string }],  // ⚠ url MUST be valid URI (Joi.uri()) — blob:/file: fail
  animation: { entry: 'fade'|'slide'|'zoom', speed: 0.1..10 }
}
```

### Common AI mistakes (fixed in current code, watch for regressions)

1. **`type`/`tier` at top level on a forced endpoint**: safe to omit (defaults to the forced value); if sent, must exactly match the endpoint's forced type/tier or it 400s. Simplest to just omit them and send `{config, enhancements, layoutdata}` plus whichever of `name`/`giftInventoryId`/`inventoryId` actually apply.
2. **`useCoupons`/`couponType`/`anonTemplate`** in payload → `allowUnknown: false` rejects. They're frontend-only state.
3. **lock.type `'time'`** → backend wants `'timer'`. Mapper converts.
4. **music `url`** → backend wants `track`. Mapper renames.
5. **openEffect.colors with empty strings** → fails colorSchema min(1). Mapper fills with `colors.accent || '#ffffff'`.
6. **media URL = blob/file** → fails Joi.uri(). Mapper filters to `^(https?:|data:)`.
7. **Empty option/rule strings** in poll/chain/trivia → fails per-item min(1). Mapper filters them out.
8. **Trivia question with < 2 options** → fails options min(2). Mapper drops the question.
9. **correctIndex >= options.length** → backend custom validator rejects. Mapper clamps to valid range.
10. **Premium + non-personal** → engine throws. Frontend blocks at `handleCreateCard` entry.

### sanitizeCardForClient (what backend HIDES from recipient)

When a card is fetched (`GET /cards/:slug`), the backend strips:
- `enhancements.lock.value` if `lock.type === 'password'`
- `correctIndex` from each trivia question (only `question` + `options` returned)

Frontend reconstruction (`backendCardToCardObject`) must not assume those fields exist.

### state shape (per type)

- personal: `{ answers: [{ userId, answer: 'yes'|'no' }] }` (one per user)
- poll: `{ votes: [{ userId, optionId }], counts: { [optionId]: number } }` (one vote per user)
- chain: `{ responses: [{ userId, name, response, timestamp }] }` (one per user)
- trivia: `{ players: [{ userId, name, score }] }` (upsert per user)
- anonymous: `{ responses: [{ id, text, timestamp }] }` (no userId — truly anonymous)

### Lock evaluation (engine.js `evaluateCardLock`)

- `password`: compares trimmed strings exactly. Wrong password → `403 lockType:password`.
- `timer`: `value` is ISO string OR ms epoch number. Until timer expires → `403 lockType:timer unlockAt:Date`.
- `tap`/`scratch`/`none`: not blocked at fetch time (frontend-only gate).

### Render model

`buildCardRenderModel(card, viewer)` returns the public-facing shape with `interaction` keyed by type. The frontend `CardView.jsx` uses this directly — don't re-fetch via `state` paths.

---

## Color round-trip semantics (already fixed)

`config.colors.accent` = `palette.primary` (the heading/border emphasis), NOT the palette's secondary "accent" key.
`theme.accentColor` (frontend, used for buttons/seal) = `palette.accent` = `colors.gradient[1]`.
On reconstruction, `theme.accentColor` is rebuilt from `gradient[1]`, NOT from `colors.accent`, to match what `applyPalette` originally set.
