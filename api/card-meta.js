// Serves crawler-facing HTML for /card/:slug and /ask/:username with real,
// per-card Open Graph / Twitter Card meta — Facebook/WhatsApp/Twitter/Discord/
// Slack scrapers never execute JavaScript, so the SPA's client-side meta
// injection in CardView.jsx (see useEffect there) never reaches them; every
// shared link unfurled as the same static "You have a surprise..." headline
// over the app logo regardless of what the card actually was.
//
// vercel.json only routes bot user-agents here (see the `has` condition on
// the /card/:slug and /ask/:username rewrites) — real visitors never hit
// this function and keep getting the normal SPA `index.html`, so nothing
// about the in-app experience changes.
const BACKEND = (process.env.VITE_API_BASE_URL || 'https://cardora-uss3.onrender.com').replace(/\/+$/, '')
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://cardora.studio'
const LOGO_URL = `${SITE_ORIGIN}/cardora-logo.png?v=4`

// 5.3: every description takes the resolved sender name (already defaulted
// to "Someone" by the caller — never blank) so a shared link's unfurl says
// who it's actually from, not a generic placeholder.
const TYPE_COPY = {
  personal: { title: (h) => h || 'You have a surprise', description: (s) => `${s} sent you something made to be opened, not just viewed.` },
  poll: { title: (h) => h || 'Cast your vote', description: (s) => `${s} wants to know what you think — tap in to vote.` },
  trivia: { title: () => 'You have been challenged to a quiz', description: (s) => `${s} challenged you — think you know the answers?` },
  chain: { title: (h) => h || 'A chain was started for you', description: (s) => `${s} started this — keep it going and add your reply.` },
  anonymous: { title: () => 'Send an anonymous message', description: () => '100% anonymous — nobody will know it was you.' },
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

async function fetchCard(slug) {
  try {
    const res = await fetch(`${BACKEND}/cards/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.card || data?.data?.card || data?.renderModel || data?.data?.renderModel || data
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
  const slug = req.query?.slug || ''
  const url = `${SITE_ORIGIN}/card/${slug}`

  if (!slug) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(404).send(renderHtml({
      title: 'Card not found',
      description: 'This Cardora link is missing its card.',
      image: LOGO_URL,
      url: SITE_ORIGIN,
    }))
    return
  }

  const card = await fetchCard(slug)
  const type = card?.type || 'personal'
  const copy = TYPE_COPY[type] || TYPE_COPY.personal
  const heading = card?.config?.content?.header || card?.config?.content?.question || card?.config?.content?.challenge || card?.name || card?.title || ''
  const senderName = card?.senderName || 'Someone'
  // A stored per-card preview image (rendered from the card's actual design
  // and uploaded at send time) is a natural next step here — until that
  // exists, every unfurl falls back to the app logo, which is still a real
  // improvement over today's identical-for-every-card headline.
  const image = card?.layoutdata?.styleExtras?.ogImage || LOGO_URL

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(renderHtml({
    title: card ? copy.title(heading) : 'You have a surprise',
    description: card ? copy.description(senderName) : 'You have a surprise waiting on Cardora.',
    image,
    url,
  }))
}
