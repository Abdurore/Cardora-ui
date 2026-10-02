import { describe, it, expect } from 'vitest'
import { validateUsername } from './username.js'

describe('validateUsername', () => {
  it.each(['ada', 'ada.lovelace', 'ada_99', 'a-b-c', 'Ada'])('accepts %p', (u) => {
    expect(validateUsername(u)).toBe('')
  })
  it.each(['ab', 'ada lovelace', 'ada<b>', 'a/b', 'ada😀', 'x'.repeat(31), ''])('rejects %p', (u) => {
    expect(validateUsername(u)).not.toBe('')
  })
})
