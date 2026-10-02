// Mirrors the backend's signup/update-profile username rule
// (Backend/Cardora/src/validation/schemas.js): usernames appear in URLs
// (/ask/:username) and emails, so only URL-safe characters.
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/

export const USERNAME_RULE_MESSAGE = 'Username must be 3-30 characters: letters, numbers, dots, dashes or underscores.'

// Returns an error message, or '' when the username is valid.
export function validateUsername(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 'Username is required.'
  return USERNAME_PATTERN.test(trimmed) ? '' : USERNAME_RULE_MESSAGE
}
