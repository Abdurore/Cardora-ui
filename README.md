# Cardora UI

Cardora UI is a Vite + React single-page app for creating, previewing, sharing, and managing interactive digital cards.

## What Is Here

- `src/pages` contains route-level screens such as Home, Explore, Studio, Profile, Store, dashboards, chat, and card viewing.
- `src/components` contains reusable UI and card-experience pieces such as modals, envelopes, reveal effects, navigation, and template cards.
- `src/lib` contains API wrappers, backend mapping helpers, tier limits, palettes, Cloudinary helpers, and studio effects.
- `src/data` contains local defaults and static content used by the studio and legal pages.
- `Backend files` contains backend reference files copied into this project folder.

There is also a separate sibling copy at `../preview shi/Cardora-ui`; treat `Cardora-ui` as the main working app unless you intentionally want to change the preview copy too.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Features & Integration

The frontend is fully aligned with the backend API specification (June 2026 Update):

- **Dynamic Pricing:** Card pricing is fetched from the backend (`GET /cards/prices`) and dynamically calculated in the Studio based on card type and tier.
- **Robust API Layer:** The API client uses `requestFirstSuccess` to gracefully fall back between parameter-based routes and body-based routes for `deleteCard`, `deleteTemplate`, and media deletion.
- **Systematic Gifts:** Premium users can attach gifts from their inventory directly during card creation (`giftInventoryId` payload field). The catalog is fetched dynamically from the backend (`/gifts/catalog`).
- **Interactive Cards:** Poll, trivia, and chain cards properly send top-level `name` fields.
- **Rewards Hub:** The Store UI displays a daily claim streak counter with dynamic flame animations, and premium users receive double CC bonuses.
- **Premium Decorators:** Users can equip chat frames and profile backgrounds, which are dynamically loaded and managed in the Profile and Store.
- **Moderation Tools:** Admin and Moderator dashboards fully support the `identifier` alias for resolving users by ID or username during bans, unbans, and role assignment.

## Routes

The app is routed from `src/App.jsx`. Main routes include `/`, `/explore`, `/store`, `/studio`, `/create`, `/profile`, `/chat`, `/inbox`, dashboard routes, and the public anonymous-send route `/ask/:username`.

## Notes

- The app currently builds successfully with Vite.
- The production bundle is large enough to trigger Vite's chunk-size warning, so route-level code splitting is a good future improvement.
- `src/App.css` is very large and mixes many page/component styles; splitting it by feature would make later UI work safer.
