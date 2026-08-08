// Same crawler-only meta injection as api/card-meta.js, for /ask/:username.
// See that file for why this exists — this one has no card to describe (no
// backend concept ties a username to a specific card), so it just
// personalizes with the profile's username/avatar instead.
const BACKEND = (process.env.VITE_API_BASE_URL || 'https://cardora-uss3.onrender.com').replace(/\/+$/, '')
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://cardora.studio'
const LOGO_URL = `${SITE_ORIGIN}/cardora-logo.png?v=4`

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
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

function renderHtml({ title, description, image, url }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
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
</head>
<body>
<p>${t}</p>
<p>${d}</p>
<a href="${escapeHtml(url)}">Open on Cardora</a>
</body>
</html>`
}

export default async function handler(req, res) {
  const username = req.query?.username || ''
  const url = `${SITE_ORIGIN}/ask/${username}`
  const profile = username ? await fetchProfile(username) : null

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(renderHtml({
    title: profile ? `Ask @${profile.username} anonymously` : 'Ask anonymously on Cardora',
    description: '100% anonymous — nobody will know it was you.',
    image: profile?.profilePictureUrl || LOGO_URL,
    url,
  }))
}
