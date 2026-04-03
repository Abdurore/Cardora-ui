# Cardora Frontend-to-Backend Integration Notes

This document summarizes the remaining backend work needed for full integration with the current Cardora frontend.

Backend base URL currently used by the frontend:

`https://cardora-uss3.onrender.com`

Frontend environments currently relevant:

- `https://cardoraa.netlify.app`
- `http://localhost:5173`

## Current Status

The frontend is already wired to the backend for these areas:

- signup
- email verification
- OTP resend
- login
- logout
- current user hydration
- coupon package loading
- marketplace template loading
- template likes
- template publishing
- checkout initialization

The biggest remaining gaps are backend response consistency, optional-field validation behavior, and the full card creation/view pipeline.

## Critical Backend Fixes

### 1. CORS must allow production and local development origins

Please allow the production frontend origin:

- `https://cardoraa.netlify.app`

And also allow local development origins, not just one fixed dev port.

At minimum, local development should support:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

But the better backend approach is to support trusted local origins dynamically, for example:

- `http://localhost:<any-dev-port>`
- `http://127.0.0.1:<any-dev-port>`

This is recommended because the Vite dev port may change over time.

Preferred implementation style:

- allow explicit production origin(s)
- allow trusted localhost / 127.0.0.1 origins during development

This is required so local development and production both work correctly.

### 2. `/signup` must treat `referralCode` as truly optional

Current backend behavior:

- if `referralCode` is present but empty, backend returns:
  - `Validation error`
  - `"'referralCode' is not allowed to be empty"`

Preferred backend behavior:

- accept `referralCode` when valid
- accept signup when `referralCode` is omitted
- ideally ignore blank referral values instead of rejecting them

### 3. Standardize auth response shapes

The frontend needs predictable response contracts for:

- `POST /signup`
- `POST /verify-email`
- `POST /login`
- `GET /current-user`

## Recommended Auth Response Contracts

### `POST /signup`

Recommended fields:

- `message`
- `requiresVerification: true | false`
- `token` if signup should immediately create a session
- `user` if available

### `POST /verify-email`

Preferred behavior:

- return `token`
- return `user`

If verification should not auto-login, then return a clear flag such as:

- `requiresLogin: true`

### `POST /login`

Recommended fields:

- `token`
- `user`

### `GET /current-user`

Recommended structure:

- `user`

Required user fields:

- `id` or `_id`
- `username`
- `email`
- `role`
- `currency`
- one stable CC balance field, preferably `ccBalance`

## Wallet / Balance / Checkout

### 4. Expose one stable CC balance field

The frontend currently has to infer balance from different possible fields.

Best backend fix:

- always expose `ccBalance`

### 5. Standardize checkout URL responses

For:

- `POST /create-paystack-checkout`
- `POST /create-coupon-checkout`

Please return one consistent field:

- `checkoutUrl`

This avoids frontend guessing between multiple response keys.

### 6. Confirm canonical coupon package fields

The frontend is consuming `/coupon-packages`.

Please confirm these as canonical:

- `packageId`
- `name`
- `numberOfCC`
- `price`
- `currency` or `priceCurrency`
- `featured`

## Templates / Marketplace

### 7. Standardize `/templates` response fields

The frontend marketplace needs these fields consistently:

- `templateId` or `_id`
- `name`
- `category`
- `previewImage`
- `layoutConfig` or `layoutdata`
- `tier` or `couponType`
- `likesCount`
- `viewCount` or `usageCount`

### 8. `POST /create-template` should return the created template object

Returning only a message is workable, but returning the created template object is better for:

- instant Explore sync
- instant Profile sync
- reduced re-fetch dependency

### 9. Confirm user-created template source

The frontend needs a reliable backend source for:

- templates created by the current user
- published templates by the current user

If this is not covered by an existing route, a dedicated endpoint is recommended.

## Card Creation / Recipient Experience

### 10. Confirm exact `layoutdata` schema for `POST /create-card`

The current Cardora Studio builds a rich card object and the frontend needs an exact mapping target.

Please confirm backend support for these sections:

- `background`
- `content`
- `closedState`
- `media`
- `questions`
- `interaction`
- `animation`
- `giftEffect`

### 11. `POST /create-card` should return stable public identifiers

Recommended response fields:

- `cardId`
- `slug`
- optionally `shareUrl`

### 12. `GET /cards/:slug` should return full recipient experience data

The frontend recipient experience needs:

- `sender`
- `recipient`
- `tier`
- `layoutdata`
- `questions`
- `gift data if attached`

## Validation / Error Responses

### 13. Keep validation errors structured

Current backend validation messages are already helpful.

Ideal consistent shape:

- `message`
- `details`
- `field`
- `source`

This makes frontend feedback much easier to render correctly.

## Nice-to-Have Backend Improvements

### 14. Add a public config endpoint

Recommended:

- `GET /public/config`

Possible payload:

- `supportedCurrencies`
- `authRules`
- `paymentProviderAvailability`
- `featureFlags`

## Biggest Remaining Blockers

These are the main backend-side blockers for full frontend integration:

1. CORS for local and production frontend origins
2. optional `referralCode` handling on signup
3. standardized auth/session response shapes
4. finalized `/create-card` and `/cards/:slug` schema
5. stable checkout URL response field

## Frontend Payload Notes

### Current signup payload sent by frontend

```json
{
  "username": "example_user",
  "email": "user@example.com",
  "password": "********",
  "currency": "NGN",
  "termsAccepted": true,
  "privacyAccepted": true
}
```

If a referral code exists, frontend adds:

```json
{
  "referralCode": "VALID_CODE"
}
```

### Current template publish payload sent by frontend

```json
{
  "name": "Rose Gold",
  "category": "birthday",
  "previewImage": "data-or-url",
  "layoutConfig": {
    "...": "current Cardora Studio card object"
  }
}
```

### Upcoming card creation integration need

The frontend is ready for a mapping pass into:

- `POST /create-card`

but needs backend confirmation of the exact accepted `layoutdata` structure first.

## Summary

The frontend is already partially integrated, but full production alignment depends on backend consistency in:

- auth
- validation behavior
- wallet balance shape
- checkout response shape
- templates response shape
- card creation / card retrieval schema

Once those are locked down, the remaining frontend integration work will be straightforward.
