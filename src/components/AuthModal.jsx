import { useState } from 'react'
import { createPortal } from 'react-dom'

function AuthModal({ open, onClose, onLogin, onSignup, currentUser, onLogout }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  if (!open) return null

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
      if (!ok) setError('Invalid email or password.')
      else onClose()
      return
    }

    if (
      !form.name ||
      !form.username ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError('All fields are required.')
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

    const ok = onSignup({
      name: form.name,
      username: form.username,
      email: form.email,
      password: form.password,
    })
    if (!ok) setError('Account already exists.')
    else onClose()
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    setForm({
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    })
    setError('')
  }

  return createPortal(
    <section className="auth-modal" role="dialog" aria-modal="true">
      <div className="auth-backdrop" onClick={onClose} />
      <div className="auth-card">
        <div className="auth-header">
          <h3>{currentUser ? 'Account' : mode === 'login' ? 'Welcome back' : 'Create account'}</h3>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {currentUser ? (
          <div className="auth-profile">
            <div className="auth-avatar" style={{ background: currentUser.avatarColor }} />
            <div>
              <p className="auth-name">{currentUser.name}</p>
              <p className="auth-email">{currentUser.email}</p>
            </div>
            <button className="primary" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                className={`tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => handleModeChange('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => handleModeChange('signup')}
              >
                Sign up
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'signup' ? (
                <>
                  <label className="detail-field">
                    Name
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                    />
                  </label>
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
              {error ? <p className="auth-error">{error}</p> : null}
              <button className="primary" type="submit">
                {mode === 'login' ? 'Login' : 'Create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </section>,
    document.body,
  )
}

export default AuthModal
