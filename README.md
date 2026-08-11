# Cardora UI

Cardora UI is a Vite + React single-page app for creating, previewing, sharing, and managing interactive digital cards.

## What Is Here

- `src/pages` contains route-level screens such as Home, Explore, Studio, Profile, Store, dashboards, chat, and card viewing.
- `src/components` contains reusable UI and card-experience pieces such as modals, envelopes, reveal effects, navigation, and template cards.
- `src/lib` contains API wrappers, backend mapping helpers, tier limits/requirements, palettes, Cloudinary helpers, device-capability checks, and studio/galaxy effects.
- `src/data` contains local defaults and static content used by the studio and legal pages.
- `api/` contains Vercel serverless functions that render Open Graph meta for link crawlers (see Deployment below).
- `Backend/Cardora` is a nested, independently git-tracked backend repo kept for schema reference only. It is gitignored here and excluded from this project's lint and test runs.

There is also a separate sibling copy at `../preview shi/Cardora-ui`; treat `Cardora-ui` as the main working app unless you intentionally want to change the preview copy too.

## Scripts

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build
npm run preview  # serve the built bundle on :4173
npm run lint     # eslint
npm test         # vitest run
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` (defaults to the deployed backend when unset) plus the two `VITE_CLOUDINARY_*` values if you need media uploads.

## Features & Integration

The frontend is fully aligned with the backend API specification (June 2026 Update):

- **Dynamic Pricing:** Card pricing is fetched from the backend (`GET /cards/prices`) and dynamically calculated in the Studio based on card type and tier.
- **Robust API Layer:** The API client uses `requestFirstSuccess` to gracefully fall back between parameter-based routes and body-based routes for `deleteCard`, `deleteTemplate`, and media deletion.
- **Systematic Gifts:** Premium users can attach gifts from their inventory directly during card creation (`giftInventoryId` payload field). The catalog is fetched dynamically from the backend (`/gifts/catalog`).
- **Interactive Cards:** Poll, trivia, and chain cards properly send top-level `name` fields.
- **Rewards Hub:** The Store UI displays a daily claim streak counter with dynamic flame animations, and premium users receive double CC bonuses.
- **Premium Decorators:** Users can equip profile backgrounds, which are dynamically loaded and managed in the Profile and Store. (Chat frames were removed.)
- **Moderation Tools:** Admin and Moderator dashboards fully support the `identifier` alias for resolving users by ID or username during bans, unbans, and role assignment.

## Routes

The app is routed from `src/App.jsx`, with every page lazy-loaded for route-level code splitting. Main routes include `/`, `/explore`, `/artists`, `/store`, `/studio`, `/quick`, `/create`, `/profile`, `/chat`, `/card/:id`, dashboard routes, and the public anonymous-send route `/ask/:username`.

All routes except `/ask/:username` render inside `src/layouts/MainLayout.jsx`, which holds the session, balance, and every backend action and passes them down through React Router's `Outlet` context.

## Deployment

`vercel.json` rewrites all traffic to the SPA, except that link-preview crawlers (identified by user agent) hitting `/card/:slug` or `/ask/:username` are routed to `api/card-meta.js` / `api/ask-meta.js`, which return real per-card Open Graph HTML. Scrapers do not execute JavaScript, so the SPA's own meta injection never reaches them.

## Notes

- The app builds successfully with Vite, and routes are code-split so a visitor only downloads the page they landed on. The largest chunk is the lazy-loaded three.js galaxy experience, which never loads for cards that do not use it.
- `src/App.css` is very large and mixes many page/component styles; splitting it by feature would make later UI work safer.
