import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useMemo, useState } from 'react'

const currencyOptions = ['NGN', 'USD', 'EUR', 'GBP']

function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const { currentUser, onLogin, onSignup, onVerifyEmail, onRequestOtp } = useOutletContext()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    referralCode: '',
    currency: 'NGN',
    otp: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(null)
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false)

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
              'Choose a username, connect your email, and step into Cardora with your account, credits, and saved experiences aligned from day one.',
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('')
    setDebugInfo(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        if (!form.email || !form.password) {
          setError('Email and password are required.')
          return
        }
        const result = await onLogin(form.email, form.password)
        if (!result.ok) {
          setError(result.message || 'Invalid email or password.')
          setDebugInfo(result.debug || null)
          return
        }
        navigate('/profile')
        return
      }

      if (pendingVerification) {
        if (!form.otp.trim()) {
          setError('Enter the OTP sent to your email.')
          return
        }
        const result = await onVerifyEmail(pendingVerification.email, form.otp.trim())
        if (!result.ok) {
          setError(result.message || 'Verification failed.')
          setDebugInfo(result.debug || null)
          return
        }
        if (result.session) {
          navigate('/profile')
        } else {
          navigate('/login')
        }
        return
      }

      if (!form.username || !form.email || !form.password) {
        setError('Username, email, and password are required.')
        return
      }
      if (!termsAccepted || !privacyAccepted) {
        setError('You need to accept both the Terms and Conditions and Privacy Policy before creating an account.')
        return
      }

      const result = await onSignup({
        username: form.username,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode.trim(),
        currency: form.currency,
        termsAccepted,
        privacyAccepted,
      })

      if (!result.ok) {
        setError(result.message || 'Account could not be created.')
        setDebugInfo(result.debug || null)
        return
      }

      if (result.verified) {
        navigate('/profile')
        return
      }

      setPendingVerification({ email: form.email })
      setStatus(result.message || 'Account created. Enter the verification code sent to your email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendOtp = async () => {
    if (!pendingVerification?.email) return
    setError('')
    setStatus('')
    setIsSubmitting(true)
    const result = await onRequestOtp(pendingVerification.email)
    if (!result.ok) setError(result.message || 'Could not resend the code.')
    else setStatus(result.message || 'A new code has been sent.')
    setIsSubmitting(false)
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
            <p className="eyebrow">
              {pendingVerification ? 'Verify Email' : mode === 'signup' ? 'Sign Up' : 'Login'}
            </p>
            <h1>{pendingVerification ? 'Verify your email' : pageCopy.title}</h1>
            <p className="auth-page-copy">
              {pendingVerification
                ? `We sent a one-time code to ${pendingVerification.email}. Enter it below to activate your Cardora account.`
                : pageCopy.intro}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} action="" noValidate>
            {mode === 'signup' && !pendingVerification ? (
              <>
                <label className="detail-field">
                  Username
                  <small className="detail-hint">This is your unique Cardora identity.</small>
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
                  <small className="detail-hint">Optional. Add one if someone invited you.</small>
                  <input
                    name="referralCode"
                    type="text"
                    value={form.referralCode}
                    onChange={handleChange}
                    placeholder="Optional referral code"
                  />
                </label>
                <label className="detail-field">
                  Currency
                  <small className="detail-hint">Used for pricing and CC purchase displays.</small>
                  <div className="auth-select">
                    <button
                      type="button"
                      className={`auth-select-trigger ${showCurrencyMenu ? 'open' : ''}`}
                      onClick={() => setShowCurrencyMenu((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={showCurrencyMenu}
                    >
                      <span>{form.currency}</span>
                    </button>
                    {showCurrencyMenu ? (
                      <div className="auth-select-menu" role="listbox" aria-label="Currency">
                        {currencyOptions.map((currency) => (
                          <button
                            key={currency}
                            type="button"
                            role="option"
                            aria-selected={form.currency === currency}
                            className={`auth-select-option ${
                              form.currency === currency ? 'active' : ''
                            }`}
                            onClick={() => {
                              setForm((prev) => ({ ...prev, currency }))
                              setShowCurrencyMenu(false)
                            }}
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
              </>
            ) : null}

            {!pendingVerification ? (
              <>
                <label className="detail-field">
                  Email
                  <small className="detail-hint">Your account email and verification destination.</small>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                  />
                </label>

                <label className="detail-field">
                  Password
                  <small className="detail-hint">Create the password that will be used for login.</small>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="********"
                  />
                </label>
              </>
            ) : (
              <label className="detail-field">
                OTP Code
                <small className="detail-hint">Enter the verification code sent to your email.</small>
                <input
                  name="otp"
                  type="text"
                  value={form.otp}
                  onChange={handleChange}
                  placeholder="123456"
                />
              </label>
            )}

            {mode === 'signup' && !pendingVerification ? (
              <div className="auth-consents">
                <label className="auth-consent">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                  />
                  <span>
                    I accept the <Link to="/legal/terms">Terms and Conditions</Link>.
                  </span>
                </label>
                <label className="auth-consent">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  />
                  <span>
                    I accept the <Link to="/legal/privacy">Privacy Policy</Link>.
                  </span>
                </label>
              </div>
            ) : !pendingVerification ? (
              <p className="auth-legal-note">
                By continuing, you acknowledge Cardora&apos;s{' '}
                <Link to="/legal/terms">Terms and Conditions</Link> and{' '}
                <Link to="/legal/privacy">Privacy Policy</Link>.
              </p>
            ) : null}

            {status ? <p className="auth-status">{status}</p> : null}
            {error ? <p className="auth-error">{error}</p> : null}
            {debugInfo ? (
              <div className="auth-debug">
                <p className="auth-debug-title">Backend Debug</p>
                <p className="auth-debug-line">
                  <strong>URL:</strong> {debugInfo.url}
                </p>
                <p className="auth-debug-line">
                  <strong>Method:</strong> {debugInfo.method}
                </p>
                <pre className="auth-debug-pre">
                  {JSON.stringify(
                    {
                      requestBody: debugInfo.requestBody,
                      responseBody: debugInfo.responseBody,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            ) : null}

            <button className="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Please wait...'
                : pendingVerification
                  ? 'Verify email'
                  : pageCopy.submit}
            </button>

            {pendingVerification ? (
              <button className="ghost" type="button" onClick={resendOtp} disabled={isSubmitting}>
                Resend code
              </button>
            ) : null}
          </form>

          {!pendingVerification ? (
            <p className="auth-page-switch">
              {pageCopy.switchLabel} <Link to={pageCopy.switchTo}>{pageCopy.switchCta}</Link>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default AuthPage
