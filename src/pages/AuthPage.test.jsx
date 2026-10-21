import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import AuthPage from './AuthPage.jsx'
import App from '../App.jsx'

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSignupBonusAvailability: vi.fn(async () => ({ available: false })),
}))

function renderSignupAt(url, ctx = {}) {
  const context = { currentUser: null, onSignup: vi.fn(async () => ({ ok: true, verified: false })), ...ctx }
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/signup" element={<AuthPage mode="signup" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return context
}

const fill = (name, value) => fireEvent.change(document.querySelector(`input[name="${name}"]`), { target: { name, value } })

describe('AuthPage — referral links', () => {
  // The Store's shareable link is /signup?ref=CODE; nothing read it.
  it('prefills the referral code from ?ref=', () => {
    renderSignupAt('/signup?ref=abcd1234')
    expect(document.querySelector('input[name="referralCode"]').value).toBe('ABCD1234')
  })

  it('sends the prefilled code with the signup', async () => {
    const ctx = renderSignupAt('/signup?ref=ABCD1234')
    fill('username', 'ada_99')
    fill('email', 'ada@x.io')
    fill('password', 'password123')
    fill('confirmPassword', 'password123')
    document.querySelectorAll('input[type="checkbox"]').forEach((cb) => fireEvent.click(cb))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() => expect(ctx.onSignup).toHaveBeenCalled())
    expect(ctx.onSignup.mock.calls[0][0].referralCode).toBe('ABCD1234')
  })
})

describe('AuthPage — username rule', () => {
  it('blocks a username with spaces before calling the backend', async () => {
    const ctx = renderSignupAt('/signup')
    fill('username', 'ada lovelace')
    fill('email', 'ada@x.io')
    fill('password', 'password123')
    fill('confirmPassword', 'password123')
    document.querySelectorAll('input[type="checkbox"]').forEach((cb) => fireEvent.click(cb))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText(/Username must be 3-30 characters/)).toBeInTheDocument()
    expect(ctx.onSignup).not.toHaveBeenCalled()
  })
})

describe('/ref/:code', () => {
  // The backend used to build referral links as /ref/CODE, a route that
  // never existed; already-shared ones now land on signup with the code.
  it('redirects to signup with the code prefilled', async () => {
    // Renders the whole app (MainLayout loads public data on mount) -- keep
    // it off the network.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '{}' })))
    render(
      <MemoryRouter initialEntries={['/ref/ZZ99XX11']}>
        <App />
      </MemoryRouter>,
    )
    const input = await vi.waitFor(() => {
      const el = document.querySelector('input[name="referralCode"]')
      if (!el) throw new Error('signup form not rendered yet')
      return el
    }, { timeout: 4000 })
    expect(input.value).toBe('ZZ99XX11')
    vi.unstubAllGlobals()
  })
})

// The backend answers "forgot password" the same for every address (it
// never reveals whether one has an account), so the page shows that answer
// instead of advancing silently -- a typo'd email gets a hint.
describe('AuthPage — forgot password', () => {
  it('shows the uniform "if an account exists" message on the code step', async () => {
    const message = 'If an account exists for that email, a reset code is on its way.'
    const context = { currentUser: null, onForgotPassword: vi.fn(async () => ({ ok: true, message })) }
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    fill('email', 'maybe@x.io')
    fireEvent.submit(document.querySelector('form'))

    await vi.waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
    expect(context.onForgotPassword).toHaveBeenCalledWith('maybe@x.io')
    expect(document.querySelector('input[name="otp"]')).toBeInTheDocument()
  })
})
