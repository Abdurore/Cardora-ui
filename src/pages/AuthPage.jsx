import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { getSignupBonusAvailability } from '../lib/api.js'

const currencyOptions = ['NGN', 'USD', 'EUR', 'GBP']

const isUnverifiedMsg = (msg = '') => {
  const l = msg.toLowerCase()
  return l.includes('verif') || l.includes('not verified') || l.includes('unverified') || l.includes('activate')
}

function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const { currentUser, onLogin, onSignup, onVerifyEmail, onRequestOtp, onForgotPassword, onResetPassword } =
    useOutletContext()

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    referralCode: '', currency: 'NGN', otp: '', newPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('') // set when login rejects for unverified account
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slowHint, setSlowHint] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(null) // after signup, show OTP step
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false)
  const [forgotFlow, setForgotFlow] = useState(null) // null | 'email' | 'reset'
  const [verifyFlow, setVerifyFlow] = useState(null)  // null | 'email' | 'otp'  (login page only)
  const [signupBonus, setSignupBonus] = useState(null)
  const slowTimerRef = useRef(null)
  const otpInputRef = useRef(null)

  // Reset ALL transient UI state whenever the user switches between /login and /signup
  useEffect(() => {
    setError('')
    setStatus('')
    setUnverifiedEmail('')
    setForgotFlow(null)
    setVerifyFlow(null)
    setPendingVerification(null)
    setIsSubmitting(false)
    setSlowHint(false)
    clearTimeout(slowTimerRef.current)
  }, [mode])

  useEffect(() => () => clearTimeout(slowTimerRef.current), [])

  // Auto-focus OTP input when entering a code-entry flow
  useEffect(() => {
    if (verifyFlow === 'otp' || forgotFlow === 'reset' || pendingVerification) {
      // Small delay to allow the DOM to render the input first
      const timer = setTimeout(() => otpInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [verifyFlow, forgotFlow, pendingVerification])

  useEffect(() => {
    if (mode !== 'signup') return
    getSignupBonusAvailability()
      .then(res => { if (res?.available) setSignupBonus(res) })
      .catch(() => {})
  }, [mode])

  const pageCopy = useMemo(() => mode === 'signup' ? {
    title: 'Create your Cardora account',
    submit: 'Create account',
    switchLabel: 'Already have an account?',
    switchTo: '/login',
    switchCta: 'Log in',
    intro: 'Choose a username, connect your email, and step into Cardora with your account, credits, and saved experiences aligned from day one.',
  } : {
    title: 'Welcome back to Cardora',
    submit: 'Log in',
    switchLabel: 'New here?',
    switchTo: '/signup',
    switchCta: 'Create account',
    intro: 'Sign in to return to your saved cards, gift balance, and the moments you are building for the people who matter.',
  }, [mode])

  if (currentUser) return <Navigate to="/profile" replace />

  // Clear error the moment the user starts correcting their input
  const handleChange = (event) => {
    setForm(prev => ({ ...prev, [event.target.name]: event.target.value }))
    if (error) setError('')
    if (unverifiedEmail) setUnverifiedEmail('')
    if (status) setStatus('')
  }

  const clearMessages = () => { setError(''); setStatus(''); setUnverifiedEmail('') }

  const handleSubmit = async (event) => {
    event.preventDefault()
    clearMessages()
    setIsSubmitting(true)
    setSlowHint(false)
    slowTimerRef.current = setTimeout(() => setSlowHint(true), 5000)

    try {
      // ── Verify email: step 1 (request OTP) ──
      if (verifyFlow === 'email') {
        if (!form.email) { setError('Enter your account email.'); return }
        const result = await onRequestOtp(form.email)
        if (!result.ok) { setError(result.message || 'Could not send the code. Try again.'); return }
        setVerifyFlow('otp') // advance silently — no toast
        return
      }

      // ── Verify email: step 2 (submit OTP) ──
      if (verifyFlow === 'otp') {
        if (!form.otp.trim()) { setError('Enter the 6-digit code from your email.'); return }
        const result = await onVerifyEmail(form.email, form.otp.trim())
        if (!result.ok) { setError(result.message || 'That code didn\'t work. Check it and try again.'); return }
        navigate(result.session ? '/profile' : '/login') // silent success
        return
      }

      // ── Forgot password: step 1 (request reset OTP) ──
      if (forgotFlow === 'email') {
        if (!form.email) { setError('Enter your account email.'); return }
        const result = await onForgotPassword(form.email)
        if (!result.ok) { setError(result.message || 'Could not send a reset code. Try again.'); return }
        setForgotFlow('reset') // advance silently
        return
      }

      // ── Forgot password: step 2 (reset) ──
      if (forgotFlow === 'reset') {
        if (!form.otp.trim() || !form.newPassword) { setError('Enter the code and your new password.'); return }
        if (form.newPassword.length < 8) { setError('New password must be at least 8 characters.'); return }
        const result = await onResetPassword(form.email, form.otp.trim(), form.newPassword)
        if (!result.ok) { setError(result.message || 'Password reset failed.'); return }
        setForgotFlow(null)
        setStatus(result.message || 'Password updated. You can now log in.')
        return
      }

      // ── Login ──
      if (mode === 'login') {
        if (!form.email || !form.password) { setError('Email and password are required.'); return }
        const result = await onLogin(form.email, form.password)
        if (!result.ok) {
          if (isUnverifiedMsg(result.message)) {
            setUnverifiedEmail(form.email)
          } else {
            setError(result.message || 'Incorrect email or password.')
          }
          return
        }
        navigate('/profile')
        return
      }

      // ── Post-signup OTP verification ──
      if (pendingVerification) {
        if (!form.otp.trim()) { setError('Enter the OTP sent to your email.'); return }
        const result = await onVerifyEmail(pendingVerification.email, form.otp.trim())
        if (!result.ok) { setError(result.message || 'Verification failed.'); return }
        navigate(result.session ? '/profile' : '/login')
        return
      }

      // ── Signup ──
      if (!form.username || !form.email || !form.password) { setError('Username, email, and password are required.'); return }
      if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
      if (!termsAccepted || !privacyAccepted) { setError('Accept both the Terms and Privacy Policy to continue.'); return }

      const result = await onSignup({
        username: form.username,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode.trim() || undefined,
        currency: form.currency,
        termsAccepted,
        privacyAccepted,
      })

      if (!result.ok) {
        setError(
          result.message === 'Invalid referral code'
            ? 'That referral code is not valid. Leave it empty or use a valid one.'
            : result.message || 'Account could not be created.',
        )
        return
      }

      if (result.verified) { navigate('/profile'); return }
      setPendingVerification({ email: form.email }) // heading copy provides context — no extra toast
    } finally {
      setIsSubmitting(false)
      setSlowHint(false)
      clearTimeout(slowTimerRef.current)
    }
  }

  const resendOtp = async () => {
    if (!pendingVerification?.email) return
    clearMessages()
    setIsSubmitting(true)
    const result = await onRequestOtp(pendingVerification.email)
    if (!result.ok) setError(result.message || 'Could not resend the code.')
    setIsSubmitting(false)
  }

  // User clicked "Verify here" from the login unverified notice
  const triggerVerify = () => {
    clearMessages()
    setVerifyFlow('email')
    // form.email is already set from the failed login attempt
  }

  // ── Heading / copy helpers ──
  const getHeading = () => {
    if (verifyFlow === 'email') return 'Verify your email'
    if (verifyFlow === 'otp') return 'Enter your code'
    if (forgotFlow === 'email') return 'Forgot your password?'
    if (forgotFlow === 'reset') return 'Choose a new password'
    if (pendingVerification) return 'Check your inbox'
    return pageCopy.title
  }

  const getCopy = () => {
    if (verifyFlow === 'email') return `Enter the email you signed up with and we'll send a 6-digit code.`
    if (verifyFlow === 'otp') return `A code was sent to ${form.email}. Enter it below to verify your account.`
    if (forgotFlow === 'email') return `Enter your account email and we'll send a code to reset your password.`
    if (forgotFlow === 'reset') return `Enter the code sent to ${form.email} and choose a new password.`
    if (pendingVerification) return `We sent a code to ${pendingVerification.email}. Enter it below to activate your account.`
    return pageCopy.intro
  }

  const getEyebrow = () => {
    if (verifyFlow) return 'Verify Email'
    if (forgotFlow) return 'Password Reset'
    if (pendingVerification) return 'Verify Email'
    return mode === 'signup' ? 'Sign Up' : 'Login'
  }

  const getSubmitLabel = () => {
    if (isSubmitting) {
      return slowHint
        ? (verifyFlow || pendingVerification || forgotFlow
            ? 'Sending… this may take a moment'
            : 'Waking up the server… hang tight')
        : 'Please wait…'
    }
    if (verifyFlow === 'email') return 'Send Code'
    if (verifyFlow === 'otp') return 'Verify'
    if (forgotFlow === 'email') return 'Send Reset Code'
    if (forgotFlow === 'reset') return 'Reset Password'
    if (pendingVerification) return 'Activate Account'
    return pageCopy.submit
  }

  const isMainForm = !forgotFlow && !verifyFlow && !pendingVerification

  return (
    <section className="auth-page">
      <div className="auth-page-bg" aria-hidden="true" />
      <div className="auth-page-shell auth-page-shell-single">
        <div className="auth-page-card auth-card">
          <div className="auth-page-header">
            <Link className="auth-page-back" to="/">Back Home</Link>
            <p className="eyebrow">{getEyebrow()}</p>
            <h1>{getHeading()}</h1>
            <p className="auth-page-copy">{getCopy()}</p>
            {signupBonus && mode === 'signup' && isMainForm ? (
              <div className="auth-bonus-banner">
                <span className="auth-bonus-icon">🎁</span>
                <span>
                  {signupBonus.bonusAmount
                    ? `New accounts get ${signupBonus.bonusAmount} free CC on sign up`
                    : signupBonus.message || 'New accounts get free Cardora Credits on sign up'}
                </span>
              </div>
            ) : null}
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* ── Verify email step 1 ── */}
            {verifyFlow === 'email' && (
              <label className="detail-field">
                Email
                <small className="detail-hint">The email you used when creating your account.</small>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" autoComplete="email" />
              </label>
            )}

            {/* ── Verify email step 2 ── */}
            {verifyFlow === 'otp' && (
              <label className="detail-field">
                Verification Code
                <small className="detail-hint">6-digit code from your email.</small>
                <input ref={otpInputRef} name="otp" type="text" value={form.otp} onChange={handleChange}
                  placeholder="123456" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
              </label>
            )}

            {/* ── Forgot password step 1 ── */}
            {forgotFlow === 'email' && (
              <label className="detail-field">
                Email
                <small className="detail-hint">The email used for your Cardora account.</small>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" autoComplete="email" />
              </label>
            )}

            {/* ── Forgot password step 2 ── */}
            {forgotFlow === 'reset' && (
              <>
                <label className="detail-field">
                  Reset Code
                  <small className="detail-hint">6-digit code from your email.</small>
                  <input ref={otpInputRef} name="otp" type="text" value={form.otp} onChange={handleChange}
                    placeholder="123456" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
                </label>
                <label className="detail-field">
                  New Password
                  <small className="detail-hint">At least 8 characters.</small>
                  <input name="newPassword" type="password" value={form.newPassword}
                    onChange={handleChange} placeholder="••••••••" autoComplete="new-password" />
                </label>
              </>
            )}

            {/* ── Signup-specific fields ── */}
            {isMainForm && mode === 'signup' && (
              <>
                <label className="detail-field">
                  Username
                  <small className="detail-hint">Your unique Cardora identity.</small>
                  <input name="username" type="text" value={form.username} onChange={handleChange}
                    placeholder="cardora_user" autoComplete="username" />
                </label>
                <label className="detail-field">
                  Referral Code
                  <small className="detail-hint">Optional — only add if you have a valid referral code.</small>
                  <input name="referralCode" type="text" value={form.referralCode}
                    onChange={handleChange} placeholder="Optional referral code" />
                </label>
                <label className="detail-field">
                  Currency
                  <small className="detail-hint">Used for pricing and CC purchase displays.</small>
                  <div className="auth-select">
                    <button type="button" className={`auth-select-trigger ${showCurrencyMenu ? 'open' : ''}`}
                      onClick={() => setShowCurrencyMenu(p => !p)}
                      aria-haspopup="listbox" aria-expanded={showCurrencyMenu}>
                      <span>{form.currency}</span>
                    </button>
                    {showCurrencyMenu && (
                      <div className="auth-select-menu" role="listbox" aria-label="Currency">
                        {currencyOptions.map(currency => (
                          <button key={currency} type="button" role="option"
                            aria-selected={form.currency === currency}
                            className={`auth-select-option ${form.currency === currency ? 'active' : ''}`}
                            onClick={() => { setForm(prev => ({ ...prev, currency })); setShowCurrencyMenu(false) }}>
                            {currency}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </>
            )}

            {/* ── Email + password (main login/signup form) ── */}
            {isMainForm && (
              <>
                <label className="detail-field">
                  Email
                  <small className="detail-hint">Your account email.</small>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@example.com" autoComplete="email" />
                </label>
                <label className="detail-field">
                  Password
                  <small className="detail-hint">{mode === 'signup' ? 'At least 8 characters.' : 'Your account password.'}</small>
                  <div className="auth-password-wrap">
                    <input name="password" type={showPassword ? 'text' : 'password'} value={form.password}
                      onChange={handleChange} placeholder="••••••••"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                    <button type="button" className="auth-password-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </label>
                {mode === 'signup' && (
                  <label className="detail-field">
                    Confirm Password
                    <small className="detail-hint">Re-enter your password.</small>
                    <div className="auth-password-wrap">
                      <input name="confirmPassword" type={showPassword ? 'text' : 'password'}
                        value={form.confirmPassword} onChange={handleChange}
                        placeholder="••••••••" autoComplete="new-password" />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <small className="auth-field-error">Passwords do not match</small>
                    )}
                  </label>
                )}
              </>
            )}

            {/* ── Post-signup OTP ── */}
            {!forgotFlow && pendingVerification && (
              <label className="detail-field">
                Verification Code
                <small className="detail-hint">Enter the 6-digit code sent to your email.</small>
                <input ref={otpInputRef} name="otp" type="text" value={form.otp} onChange={handleChange}
                  placeholder="123456" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
              </label>
            )}

            {/* ── Terms / Privacy (signup) ── */}
            {isMainForm && mode === 'signup' && (
              <div className="auth-consents">
                <label className="auth-consent">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                  <span>I accept the <Link to="/legal/terms">Terms and Conditions</Link>.</span>
                </label>
                <label className="auth-consent">
                  <input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} />
                  <span>I accept the <Link to="/legal/privacy">Privacy Policy</Link>.</span>
                </label>
              </div>
            )}

            {/* ── Login legal note ── */}
            {isMainForm && mode === 'login' && (
              <p className="auth-legal-note">
                By continuing, you acknowledge Cardora&apos;s{' '}
                <Link to="/legal/terms">Terms and Conditions</Link> and{' '}
                <Link to="/legal/privacy">Privacy Policy</Link>.
              </p>
            )}

            {/* ── Unverified email notice (login only) ── */}
            {unverifiedEmail && (
              <p className="auth-unverified-notice">
                Your email is not verified.{' '}
                <button type="button" className="auth-inline-link" onClick={triggerVerify}>
                  Verify here
                </button>
              </p>
            )}

            {/* ── Error / status — error takes priority, never both ── */}
            {error ? <p className="auth-error">{error}</p> : status ? <p className="auth-status">{status}</p> : null}

            <button className="primary" type="submit" disabled={isSubmitting}>
              {getSubmitLabel()}
            </button>

            {isSubmitting && slowHint && (
              <p className="auth-slow-hint">
                {verifyFlow || pendingVerification || forgotFlow
                  ? "Sending the email can take a little while — please don't close this page."
                  : 'The server is starting up. This can take 30–60 seconds on first use. Hang tight!'}
              </p>
            )}

            {/* Resend code — post-signup verification only */}
            {pendingVerification && !forgotFlow && (
              <button className="ghost" type="button" onClick={resendOtp} disabled={isSubmitting}>
                Resend code
              </button>
            )}

            {/* Forgot password trigger — login main form only */}
            {mode === 'login' && isMainForm && (
              <button className="ghost" type="button"
                onClick={() => { setForgotFlow('email'); clearMessages() }}>
                Forgot password?
              </button>
            )}

            {/* Back button — forgot flow */}
            {forgotFlow && (
              <button className="ghost" type="button"
                onClick={() => { setForgotFlow(null); clearMessages() }}>
                ← Back to login
              </button>
            )}

            {/* Back button — verify flow */}
            {verifyFlow && (
              <button className="ghost" type="button"
                onClick={() => { setVerifyFlow(null); clearMessages() }}>
                ← Back to login
              </button>
            )}
          </form>

          {!pendingVerification && !forgotFlow && !verifyFlow && (
            <p className="auth-page-switch">
              {pageCopy.switchLabel} <Link to={pageCopy.switchTo}>{pageCopy.switchCta}</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default AuthPage
