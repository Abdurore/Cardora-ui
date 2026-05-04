# Cardora UI — Project Memory

## Backend Card Creation Schema (CRITICAL — single source of truth)

Reference files live on `main` under `Backend files/`. Read them when in doubt:
- `cardRoutes.js` — endpoint list
- `cardController.js` — controller logic + state shape
- `schema.js` — Joi validation rules (the actual gate)
- `engine.js` — sanitisation, tier rules, render model
- `constants.js` — enum values + card costs
- `validate.js` — runs Joi with `allowUnknown: false` (extra fields rejected)

### Top-level payload shape (POST /create-card variants)

The frontend MUST send exactly this — NOTHING else:
```js
{
  config: { colors: {background, accent, gradient: [c1, c2]}, font, content: {...} },
  enhancements: {...},   // {} for classic
  layoutdata: { paperTexture: {type, opacity, blendMode} }
}
```

**DO NOT include**: `type`, `tier`, `useCoupons`, `couponType`, `anonTemplate`, `title`, `templateId`, or any other top-level fields. The forced endpoints (`/create-card/elite`, `/create-card/poll/elite`, etc.) use `Joi.forbidden()` for `type`/`tier` and `allowUnknown: false` for everything else.

### Endpoints (all auth-required)

| Endpoint | type | tier |
|---|---|---|
| `POST /create-card` | required | required |
| `POST /create-card/classic` | required | forbidden |
| `POST /create-card/premium` | required | forbidden — personal only! |
| `POST /create-card/elite` | required | forbidden |
| `POST /create-card/anonymous` | forbidden | forbidden (forces elite) |
| `POST /create-card/{poll\|chain\|trivia\|anonymous}/{classic\|elite}` | forbidden | forbidden |

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

1. **`type`/`tier` at top level** of payload → forced endpoints reject. Only send `{config, enhancements, layoutdata}`.
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
