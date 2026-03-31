import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useMemo, useState } from 'react'

function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const { currentUser, onLogin, onSignup } = useOutletContext()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  })
  const [error, setError] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  const pageCopy = useMemo(
    () =>
      mode === 'signup'
        ? {
            title: 'Create your Cardora account',
            submit: 'Create account',
            switchLabel: 'Already have an account?',
            switchTo: '/login',
            switchCta: 'Log in',
            intro:
              'Choose a username, connect your Gmail, and step into Cardora with your account, credits, and saved experiences aligned from day one.',
          }
        : {
            title: 'Welcome back to Cardora',
            submit: 'Log in',
            switchLabel: 'New here?',
            switchTo: '/signup',
            switchCta: 'Create account',
            intro:
              'Sign in to return to your saved cards, gift balance, and the moments you are building for the people who matter.',
          },
    [mode],
  )

  if (currentUser) {
    return <Navigate to="/profile" replace />
  }

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (mode === 'login') {
      if (!form.email || !form.password) {
        setError('Email and password are required.')
        return
      }
      const ok = onLogin(form.email, form.password)
      if (!ok) {
        setError('Invalid email or password.')
        return
      }
      navigate('/profile')
      return
    }

    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      setError('Username, email, and passwords are required.')
      return
    }
    if (!form.email.toLowerCase().endsWith('@gmail.com')) {
      setError('Please use a Gmail address.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!acceptedLegal) {
      setError('You need to accept the Terms and Privacy Policy before creating an account.')
      return
    }

    const ok = onSignup({
      username: form.username,
      email: form.email,
      password: form.password,
      referralCode: form.referralCode.trim(),
    })
    if (!ok) {
      setError('Account already exists.')
      return
    }
    navigate('/profile')
  }

  return (
    <section className="auth-page">
      <div className="auth-page-bg" aria-hidden="true" />
      <div className="auth-page-shell auth-page-shell-single">
        <div className="auth-page-card auth-card">
          <div className="auth-page-header">
            <Link className="auth-page-back" to="/">
              Back Home
            </Link>
            <p className="eyebrow">{mode === 'signup' ? 'Sign Up' : 'Login'}</p>
            <h1>{pageCopy.title}</h1>
            <p className="auth-page-copy">{pageCopy.intro}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <>
                <label className="detail-field">
                  Username
                  <input
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="cardora_user"
                  />
                </label>
                <label className="detail-field">
                  Referral Code
                  <input
                    name="referralCode"
                    type="text"
                    value={form.referralCode}
                    onChange={handleChange}
                    placeholder="Optional referral code"
                  />
                </label>
              </>
            ) : null}

            <label className="detail-field">
              Gmail
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@gmail.com"
              />
            </label>

            <label className="detail-field">
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="********"
              />
            </label>

            {mode === 'signup' ? (
              <label className="detail-field">
                Confirm Password
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="********"
                />
              </label>
            ) : null}

            {mode === 'signup' ? (
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(event) => setAcceptedLegal(event.target.checked)}
                />
                <span>
                  I agree to the <Link to="/legal/terms">Terms and Conditions</Link> and{' '}
                  <Link to="/legal/privacy">Privacy Policy</Link>.
                </span>
              </label>
            ) : (
              <p className="auth-legal-note">
                By continuing, you acknowledge Cardora&apos;s{' '}
                <Link to="/legal/terms">Terms and Conditions</Link> and{' '}
                <Link to="/legal/privacy">Privacy Policy</Link>.
              </p>
            )}

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="primary" type="submit">
              {pageCopy.submit}
            </button>
          </form>

          <p className="auth-page-switch">
            {pageCopy.switchLabel} <Link to={pageCopy.switchTo}>{pageCopy.switchCta}</Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default AuthPage
