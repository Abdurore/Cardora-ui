// 5.1: serves a real response for EVERY request to /ask/:username — not
// just bots (vercel.json's old `has` condition gated this to crawler
// user-agents only; card-meta.js got the same fix already, this route
// didn't). A real visitor used to get the bare SPA shell and wait for
// AnonSend.jsx to mount, fetch the active inbox, and client-side
// navigate to /card/:slug -- three round trips of blank screen before
// anything paints.
//
// /ask/:username's own real behavior (per AnonSend.jsx) is "resolve to
// whichever anonymous card is active, then go there" -- it's a redirector,
// not a destination with its own content to render. So the fast path here
// is a real HTTP redirect straight to /card/:slug, which the existing
// unconditional /card/:slug rewrite already gives a full SSR gate (correct
// OG meta pulled from the actual card, preloaded assets, immediate paint)
// with no duplicated gate logic. Social crawlers follow redirects when
// building link previews, so bots get MORE accurate previews this way too
// (the real card's sender/title, not a generic "ask me anything").
//
// Only when nothing resolves (no such user, or a real account with no
// active inbox yet -- the backend 404s both alike) does this render its
// own gate, reusing card-meta.js's asset-preload technique so AnonSend.jsx
// mounts fast and takes over for the exact not-found/no-inbox distinction.
const BACKEND = (process.env.VITE_API_BASE_URL || 'https://cardora-uss3.onrender.com').replace(/\/+$/, '')
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://cardora.studio'
const LOGO_URL = `${SITE_ORIGIN}/cardora-logo.png?v=4`

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

async function fetchActiveAnonymousSlug(username) {
  try {
    const res = await fetch(`${BACKEND}/users/${encodeURIComponent(username)}/anonymous-card`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.slug || data?.data?.slug || null
  } catch {
    return null
  }
}

async function fetchProfile(username) {
  try {
    const res = await fetch(`${BACKEND}/users/${encodeURIComponent(username)}/profile`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.profile || data?.data?.profile || null
  } catch {
    return null
  }
}

// Same self-fetch-the-deployed-shell trick as card-meta.js -- see that
// file for why (no reliable build-time manifest available here).
let shellCache = null
async function fetchAppShell() {
  if (shellCache) return shellCache
  try {
    const res = await fetch(`${SITE_ORIGIN}/index.html`)
    if (!res.ok) return null
    const html = await res.text()
    const scriptMatch = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
    const styleMatches = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    if (!scriptMatch) return null
    shellCache = {
      scriptSrc: scriptMatch[1],
      styleHrefs: styleMatches.map((m) => m[1]),
    }
    return shellCache
  } catch {
    return null
  }
}

const GATE_CSS = `
#cardora-ssr-gate{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;gap:14px;background:#07111a;color:#e8f1f4;font-family:Manrope,system-ui,
sans-serif;text-align:center;padding:24px;box-sizing:border-box;z-index:1}
#cardora-ssr-gate img{width:56px;height:56px;border-radius:14px}
#cardora-ssr-gate .cg-title{font-size:1.5rem;font-weight:700;margin:0;max-width:26ch}
#cardora-ssr-gate .cg-sub{font-size:0.95rem;opacity:0.75;margin:0;max-width:32ch}
`

function renderGateHtml({ title, description, image, url, avatarUrl }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<style>${GATE_CSS}</style>
</head>
<body>
<div id="root"><div id="cardora-ssr-gate">
<img src="${escapeHtml(avatarUrl || LOGO_URL)}" alt="Cardora" />
<p class="cg-title">${t}</p>
<p class="cg-sub">${d}</p>
</div></div>
</body>
</html>`
}

function renderGateHtmlWithShell(args, shell) {
  const base = renderGateHtml(args)
  if (!shell) return base
  const preloads = [
    `<link rel="modulepreload" href="${escapeHtml(shell.scriptSrc)}" />`,
    ...shell.styleHrefs.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`),
  ].join('\n')
  const script = `<script type="module" src="${escapeHtml(shell.scriptSrc)}"></script>`
  return base
    .replace('<style>', `${preloads}\n<style>`)
    .replace('</body>', `${script}\n</body>`)
}

export default async function handler(req, res) {
  const username = req.query?.username || ''
  const url = `${SITE_ORIGIN}/ask/${username}`

  if (!username) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    return res.status(404).send(renderGateHtml({
      title: 'Ask anonymously on Cardora',
      description: '100% anonymous — nobody will know it was you.',
      image: LOGO_URL,
      url: SITE_ORIGIN,
    }))
  }

  const activeSlug = await fetchActiveAnonymousSlug(username)
  if (activeSlug) {
    // 302, not 301 -- the active card can rotate (6.6), this mapping is
    // never permanent.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    return res.redirect(302, `/card/${encodeURIComponent(activeSlug)}`)
  }

  const [profile, shell] = await Promise.all([
    fetchProfile(username),
    fetchAppShell(),
  ])

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Short cache -- a brand-new inbox or a first-time profile fetch
  // shouldn't stay stale for the old 5-minute window.
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.status(profile ? 200 : 404).send(renderGateHtmlWithShell({
    title: profile ? `Ask @${profile.username} anonymously` : 'User not found',
    description: profile
      ? '100% anonymous — nobody will know it was you.'
      : "This Cardora link doesn't belong to an active account.",
    image: profile?.profilePictureUrl || LOGO_URL,
    avatarUrl: profile?.profilePictureUrl || LOGO_URL,
    url,
  }, shell))
}
