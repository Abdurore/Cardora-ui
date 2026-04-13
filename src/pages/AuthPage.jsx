import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useMemo, useState, useRef, useEffect } from 'react'
import { getSignupBonusAvailability } from '../lib/api.js'

const currencyOptions = ['NGN', 'USD', 'EUR', 'GBP']

function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const { currentUser, onLogin, onSignup, onVerifyEmail, onRequestOtp, onForgotPassword, onResetPassword } = useOutletContext()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    currency: 'NGN',
    otp: '',
    newPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slowHint, setSlowHint] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(null)
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false)
  const [forgotFlow, setForgotFlow] = useState(null) // null | 'email' | 'reset'
  const [verifyFlow, setVerifyFlow] = useState(null) // null | 'email' | 'otp'
  const [signupBonus, setSignupBonus] = useState(null)
  const slowTimerRef = useRef(null)

  // Clear slow timer on unmount
  useEffect(() => () => clearTimeout(slowTimerRef.current), [])

  useEffect(() => {
    if (mode !== 'signup') return
    getSignupBonusAvailability()
      .then((res) => { if (res?.available) setSignupBonus(res) })
      .catch(() => {})
  }, [mode])

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
    setSlowHint(false)
    slowTimerRef.current = setTimeout(() => setSlowHint(true), 5000)

    try {
      // Verify email flow — step 1: request OTP
      if (verifyFlow === 'email') {
        if (!form.email) {
          setError('Enter the email you signed up with.')
          return
        }
        const result = await onRequestOtp(form.email)
        if (!result.ok) {
          setError(result.message || 'Could not send verification code.')
          return
        }
        setStatus(result.message || 'Verification code sent to your email.')
        setVerifyFlow('otp')
        return
      }

      // Verify email flow — step 2: submit OTP
      if (verifyFlow === 'otp') {
        if (!form.otp.trim()) {
          setError('Enter the verification code sent to your email.')
          return
        }
        const result = await onVerifyEmail(form.email, form.otp.trim())
        if (!result.ok) {
          setError(result.message || 'Verification failed.')
          setDebugInfo(result.debug || null)
          return
        }
        if (result.session) {
          navigate('/profile')
        } else {
          setStatus('Email verified! You can now log in.')
          setVerifyFlow(null)
          navigate('/login')
        }
        return
      }
      // Forgot password — step 1: send OTP
      if (forgotFlow === 'email') {
        if (!form.email) {
          setError('Enter the email for your account.')
          return
        }
        const result = await onForgotPassword(form.email)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setStatus(result.message)
        setForgotFlow('reset')
        return
      }

      // Forgot password — step 2: reset with OTP + new password
      if (forgotFlow === 'reset') {
        if (!form.otp.trim() || !form.newPassword) {
          setError('OTP and new password are required.')
          return
        }
        if (form.newPassword.length < 8) {
          setError('New password must be at least 8 characters.')
          return
        }
        const result = await onResetPassword(form.email, form.otp.trim(), form.newPassword)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setStatus(result.message || 'Password reset! You can now log in.')
        setForgotFlow(null)
        return
      }

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
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.')
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
        referralCode: form.referralCode.trim() || undefined,
        currency: form.currency,
        termsAccepted,
        privacyAccepted,
      })

      if (!result.ok) {
        setError(
          result.message === 'Invalid referral code'
            ? 'That referral code is not valid. Use a valid code or leave the field empty.'
            : result.message || 'Account could not be created.',
        )
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
      setSlowHint(false)
      clearTimeout(slowTimerRef.current)
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

  // Determine the heading/copy
  const getHeading = () => {
    if (verifyFlow === 'email') return 'Verify your email'
    if (verifyFlow === 'otp') return 'Enter verification code'
    if (forgotFlow === 'email') return 'Forgot your password?'
    if (forgotFlow === 'reset') return 'Reset your password'
    if (pendingVerification) return 'Verify your email'
    return pageCopy.title
  }

  const getCopy = () => {
    if (verifyFlow === 'email') return 'Enter the email you used when signing up. We\'ll send a verification code to confirm your account.'
    if (verifyFlow === 'otp') return `Enter the code sent to ${form.email} to verify your account.`
    if (forgotFlow === 'email') return 'Enter the email address associated with your Cardora account. We\'ll send you a code to reset your password.'
    if (forgotFlow === 'reset') return `Enter the code sent to ${form.email} and choose a new password.`
    if (pendingVerification) return `We sent a one-time code to ${pendingVerification.email}. Enter it below to activate your Cardora account.`
    return pageCopy.intro
  }

  const getEyebrow = () => {
    if (verifyFlow) return 'Verify Email'
    if (forgotFlow) return 'Password Reset'
    if (pendingVerification) return 'Verify Email'
    return mode === 'signup' ? 'Sign Up' : 'Login'
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
            <p className="eyebrow">{getEyebrow()}</p>
            <h1>{getHeading()}</h1>
            <p className="auth-page-copy">{getCopy()}</p>
            {signupBonus && mode === 'signup' && !pendingVerification && !forgotFlow && !verifyFlow ? (
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

          <form className="auth-form" onSubmit={handleSubmit} action="" noValidate>
            {/* Verify Email — Step 1: email */}
            {verifyFlow === 'email' && (
              <label className="detail-field">
                Email
                <small className="detail-hint">The email you used when creating your account.</small>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                />
              </label>
            )}

            {/* Verify Email — Step 2: OTP */}
            {verifyFlow === 'otp' && (
              <label className="detail-field">
                Verification Code
                <small className="detail-hint">Enter the 6-digit code sent to your email.</small>
                <input
                  name="otp"
                  type="text"
                  value={form.otp}
                  onChange={handleChange}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
            )}

            {/* Forgot Password — Step 1: email */}
            {forgotFlow === 'email' && (
              <label className="detail-field">
                Email
                <small className="detail-hint">The email used for your Cardora account.</small>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                />
              </label>
            )}

            {/* Forgot Password — Step 2: OTP + new password */}
            {forgotFlow === 'reset' && (
              <>
                <label className="detail-field">
                  Reset Code
                  <small className="detail-hint">Enter the 6-digit code sent to your email.</small>
                  <input
                    name="otp"
                    type="text"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="123456"
                  />
                </label>
                <label className="detail-field">
                  New Password
                  <small className="detail-hint">At least 8 characters.</small>
                  <input
                    name="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="********"
                  />
                </label>
              </>
            )}

            {/* Normal signup fields */}
            {!forgotFlow && !verifyFlow && mode === 'signup' && !pendingVerification ? (
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
                  <small className="detail-hint">Optional. Add one only if you have a valid Cardora referral code.</small>
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

            {/* Email + Password (login or signup, not forgot flow) */}
            {!forgotFlow && !verifyFlow && !pendingVerification ? (
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
                  <small className="detail-hint">{mode === 'signup' ? 'At least 8 characters.' : 'Your account password.'}</small>
                  <div className="auth-password-wrap">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="********"
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
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
                    <small className="detail-hint">Re-enter your password to confirm.</small>
                    <div className="auth-password-wrap">
                      <input
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="********"
                      />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <small className="auth-field-error">Passwords do not match</small>
                    )}
                  </label>
                )}
              </>
            ) : !forgotFlow && pendingVerification ? (
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
            ) : null}

            {/* Terms/Privacy */}
            {!forgotFlow && mode === 'signup' && !pendingVerification ? (
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
            ) : !forgotFlow && !pendingVerification ? (
              <p className="auth-legal-note">
                By continuing, you acknowledge Cardora&apos;s{' '}
                <Link to="/legal/terms">Terms and Conditions</Link> and{' '}
                <Link to="/legal/privacy">Privacy Policy</Link>.
              </p>
            ) : null}

            {status ? <p className="auth-status">{status}</p> : null}
            {error ? <p className="auth-error">{error}</p> : null}

            <button className="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? (slowHint
                    ? (verifyFlow || pendingVerification || forgotFlow
                      ? 'Sending email... this may take a moment'
                      : 'Server is waking up... almost there')
                    : 'Please wait...')
                : verifyFlow === 'email'
                  ? 'Send Code'
                  : verifyFlow === 'otp'
                    ? 'Verify Email'
                    : forgotFlow === 'email'
                      ? 'Send Reset Code'
                      : forgotFlow === 'reset'
                        ? 'Reset Password'
                        : pendingVerification
                          ? 'Verify email'
                          : pageCopy.submit}
            </button>

            {isSubmitting && slowHint && (
              <p className="auth-slow-hint">
                {verifyFlow || pendingVerification || forgotFlow
                  ? 'Sending the verification email can take a little while. Please don\'t close this page.'
                  : 'The server is starting up after being idle. This can take 30–60 seconds on first use. Hang tight!'}
              </p>
            )}

            {pendingVerification && !forgotFlow ? (
              <button className="ghost" type="button" onClick={resendOtp} disabled={isSubmitting}>
                Resend code
              </button>
            ) : null}

            {/* Forgot Password link on login */}
            {mode === 'login' && !forgotFlow && !pendingVerification ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setForgotFlow('email')
                  setError('')
                  setStatus('')
                }}
              >
                Forgot password?
              </button>
            ) : null}

            {/* Back to login from forgot flow */}
            {forgotFlow ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setForgotFlow(null)
                  setError('')
                  setStatus('')
                }}
              >
                ← Back to login
              </button>
            ) : null}

            {/* Verify email link on signup page */}
            {mode === 'signup' && !forgotFlow && !pendingVerification && !verifyFlow ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setVerifyFlow('email')
                  setError('')
                  setStatus('')
                }}
              >
                Already signed up? Verify email
              </button>
            ) : null}

            {/* Back to signup from verify flow */}
            {verifyFlow ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setVerifyFlow(null)
                  setError('')
                  setStatus('')
                }}
              >
                ← Back to sign up
              </button>
            ) : null}
          </form>

          {!pendingVerification && !forgotFlow && !verifyFlow ? (
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
