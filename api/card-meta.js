// 5.1: serves a real, server-rendered gate for EVERY request to
// /card/:slug — not just bots. Before this, only crawler user-agents
// (see vercel.json's old `has` condition) got real per-card OG meta; a
// real recipient got the bare SPA shell and stared at a blank screen
// until React mounted and fetched the card. Now everyone gets:
//   - correct OG/Twitter meta (bots still read this, same as before)
//   - a real, immediately-painted gate: sender name, card title, an
//     Open Card button — not a spinner
//   - the app's actual JS/CSS bundle preloaded while the gate is visible,
//     so the heavy assets are already warm by the time someone taps Open
//
// The gate lives inside #root using the exact markup CardView.jsx renders
// for the same state (see `.cardora-gate` in App.css) — main.jsx mounts
// with createRoot (not hydrateRoot), which replaces #root's children on
// first client render, so there's no hydration mismatch to manage, just a
// clean swap from server HTML to the live app once it's ready.
//
// window.__CARDORA_SSR_CARD__ carries only the same non-owner-safe fields
// the public API already exposes (name/type/tier/senderName) — never
// response content, vote tallies, or anything H2/H7 (Phase 1.3) protects.
const BACKEND = (process.env.VITE_API_BASE_URL || 'https://cardora-uss3.onrender.com').replace(/\/+$/, '')
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://cardora.studio'
const LOGO_URL = `${SITE_ORIGIN}/cardora-logo.png?v=4`

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

// The static build's real, hashed <script>/<link> tags. Vite doesn't hand
// this function a build-time manifest, and reading dist/ off disk isn't
// reliable across how Vercel packages functions vs. static output — so
// instead this self-fetches the deployment's own index.html, which is
// always in sync with whatever just got deployed, and pulls the tags out.
// Cached for the life of the warm serverless instance so a burst of card
// opens doesn't refetch it per-request.
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

// Minimal critical CSS so the gate paints correctly on Slow 3G before the
// full ~90KB (gzipped) app stylesheet has had a chance to arrive. Kept
// deliberately tiny -- this is a placeholder shell, not a themed card.
const GATE_CSS = `
#cardora-ssr-gate{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;gap:14px;background:#0b0f12;color:#e8f1f4;font-family:Manrope,system-ui,
sans-serif;text-align:center;padding:24px;box-sizing:border-box;z-index:1}
#cardora-ssr-gate img{width:56px;height:56px;border-radius:14px}
#cardora-ssr-gate .cg-sender{font-size:0.95rem;opacity:0.75;margin:0}
#cardora-ssr-gate .cg-title{font-size:1.5rem;font-weight:700;margin:0;max-width:26ch}
#cardora-ssr-gate .cg-btn{margin-top:10px;padding:14px 32px;border-radius:100px;border:none;
background:linear-gradient(135deg,#7ef7ff,#62ffa2);color:#06110f;font-weight:700;font-size:1rem;
letter-spacing:0.03em;cursor:pointer}
`

function renderGateHtml({ title, description, image, url, senderName, cardTitle, shell, slug }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const preloads = shell
    ? [
        `<link rel="modulepreload" href="${escapeHtml(shell.scriptSrc)}" />`,
        ...shell.styleHrefs.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`),
      ].join('\n')
    : ''
  const script = shell ? `<script type="module" src="${escapeHtml(shell.scriptSrc)}"></script>` : ''
  // Only ever the same non-sensitive fields the public API already returns
  // for a non-owner -- see H2/H7 (Phase 1.3). No response/interaction data.
  // `slug` lets the client tell "this is the card I was server-rendered
  // for" apart from "I client-side-navigated here from a different card
  // and this global is stale leftover from the previous page load."
  const ssrCard = JSON.stringify({ slug: slug || '', senderName: senderName || '', title: cardTitle || '' }).replace(/</g, '\\u003c')

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
${preloads}
<style>${GATE_CSS}</style>
</head>
<body>
<script>window.__CARDORA_SSR_CARD__ = ${ssrCard}</script>
<div id="root"><div id="cardora-ssr-gate">
<img src="${escapeHtml(LOGO_URL)}" alt="Cardora" />
<p class="cg-sender">${escapeHtml(senderName || 'Someone')} sent you a card</p>
<p class="cg-title">${escapeHtml(cardTitle || 'Open to see what it is')}</p>
<button class="cg-btn" type="button">Open Card</button>
</div></div>
${script}
</body>
</html>`
}

export default async function handler(req, res) {
  const slug = req.query?.slug || ''
  const url = `${SITE_ORIGIN}/card/${slug}`

  const [card, shell] = await Promise.all([
    slug ? fetchCard(slug) : Promise.resolve(null),
    fetchAppShell(),
  ])

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
  // Short and revalidate-on-stale rather than the old flat 5-minute cache --
  // this response now also carries the interactive shell, and a card can be
  // revoked (5.5) or renamed; a client shouldn't hold a gate for it too long.
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.status(slug ? 200 : 404).send(renderGateHtml({
    title: card ? copy.title(heading) : (slug ? 'Card not found' : 'You have a surprise'),
    description: card ? copy.description(senderName) : (slug ? 'This Cardora link is missing its card.' : 'You have a surprise waiting on Cardora.'),
    image: card ? image : LOGO_URL,
    url: slug ? url : SITE_ORIGIN,
    senderName: card ? senderName : '',
    cardTitle: card ? heading : '',
    shell,
    slug: card ? slug : '',
  }))
}
