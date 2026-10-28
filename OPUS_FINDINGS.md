# OPUS_FINDINGS: QuestForgeAI audit corrections

**Date:** 28 Oct 2026
**Branch:** `opus/audit-fixes-2026-10-28` (local only: not pushed, not deployed)
**Inputs:** `/workspace/linkedin_rebuild/week_oct28_reentry/questforge_audit_2026-10-28/` (ACTION_PLAN, UI_WALK_NOTES, OPUS_AUDIT_BRIEF, DISCOVERABILITY, VANTA_POSITIONING, owner brief)
**Live product:** https://questforgeai.ai/ on Cloudflare Workers

Nothing here has gone live. Every change on this branch needs the owner's yes and a deploy (see section 4).

---

## 1. Repo vs live reconciliation (read this first)

| Finding | Detail |
| --- | --- |
| The repo is Render-era | `render.yaml`, Express `server.js`, and "Render for application hosting" on `/security`. |
| Live is ahead of the repo | On 28 Oct 2026 the live `/`, `/pricing`, `/security` and `/privacy` had **newer copy** than `master`: a browser-only operator workspace, Cloudflare listed as a sub-processor, and September 2026 dates. Live `/terms`, `/refund`, `styles.css`, `site.js` and `sitemap.xml` were byte-identical to `master`. |
| Worker source is not in this repo | Live `/api/health` reports `runtime: cloudflare-workers` and `documentStorage: browser-only`. No Worker / `wrangler.toml` code exists here, and neither does the browser-only `/app` operator code. |
| What I did | Commit 1 (`393ef06`) copies the live HTML into `public/` so the branch starts from what is actually live. All fixes are applied on top of that. |

**Implication:** the static files in `public/` can be deployed to the Worker's assets as-is. The **server-side** fixes (health trim, HSTS, security.txt route) are implemented in `server.js` here, and **must be ported to the Worker source** too. Exact snippet in section 3.

---

## 2. What changed (by audit item)

### P0/P1: copy consistency
| Fix | Files |
| --- | --- |
| **24h vs 24-48h aligned.** Home title and OG/Twitter are now "Answered in 24-48 Hours" (were "24 Hours"). The home metric spells out "24 hours up to 300 questions, 48 hours up to 600". The final CTA "done by this time tomorrow" is now "back in 24 to 48 hours". Terms gain a §8 Turnaround: targets, not guarantees, measured from usable files. Pricing tier bullets (24h Standard / 48h Large) are unchanged and now match everything else. | `public/landing.html`, `public/terms.html`, `public/pricing.html` (meta) |
| **"pilot" removed from public legal copy.** Privacy: "pilot engagement" is now "questionnaire drafting engagement", and "controlled concierge pilot" is now "controlled, human-reviewed drafting service". Refund: "quality of the pilot workflow" is now "quality of every human-reviewed draft". The operator console (`index.html`) and the `/app` 403 gate still say "pilot" on purpose: they are the private workspace, not public marketing. | `public/privacy.html`, `public/refund.html` |
| **Terms naming.** Every footer and nav now says "Terms of Service", matching the page title and H1 (was "Terms and Conditions"). | all public pages + `success.html` |
| **Legal dates.** Privacy, Refund and Terms are bumped to October 2026 because their text changed. The Security body text did not change, so it keeps September 2026. | legal pages |
| **Sub-processors named in Privacy.** §6 now names Cloudflare, Anthropic and Paddle, matching `/security` (it was vague). Terms §4 names Paddle as Merchant of Record. | `public/privacy.html`, `public/terms.html` |
| **Home vs security retention mismatch.** The home "raw files stay local" card now adds "Copies shared with us by email are deleted within 30 days of delivery", consistent with `/security` §3. | `public/landing.html` |
| `/app` gate copy synced to live ("processing workspace", not "upload processor"). | `server.js` |

### P1: SEO / GEO hygiene (all 6 public pages)
- `<link rel="canonical">` matches the sitemap `loc` on `/`, `/pricing`, `/security`, `/terms`, `/privacy`, `/refund`.
- Meta description, OG and Twitter tags are now on every page. Before this, legal pages had none and `/security` had no Twitter tags. All use `og:site_name`.
- JSON-LD `@graph` on every page:
  - **Organization** (`#organization`): QuestForgeAI, legalName KAMTOBE CREATIONS LIMITED, Companies House 17288786, registered address, `hello@questforgeai.ai`. **No `sameAs`, logo, ratings or reviews**, because none exist yet.
  - **Service** (`#service`) on `/` and `/pricing`: the three public prices as `Offer`s in USD, with areaServed US/GB/CA/EU.
  - **WebSite** on `/`, and **BreadcrumbList** on the subpages.
  - JSON-LD is a data block, so the CSP `script-src 'self'` does not block it.
- `/pricing` now has an `<h1>`, which it lacked. It is styled like the old h2, so nothing changes visually.
- `sitemap.xml` has `<lastmod>2026-10-28</lastmod>` on every URL.
- Navigation is consistent. Subpages show Home, Pricing, Security, FAQ and **Get started**. Home shows How it works, Sample output, Pricing, Security and **Get started**.

### P1: security hygiene
| Fix | Files |
| --- | --- |
| **`/api/health` trimmed.** The public response is now `{"status":"ok"}` only, with `Cache-Control: no-store`. The `apiKey`, `payments`, `pilotAccessConfigured` and `retentionDays` fields are returned only with a valid operator token (`x-questforge-token`). | `server.js` |
| **HSTS** `Strict-Transport-Security: max-age=31536000; includeSubDomains` on every response. **No `preload`**, because preload-list submission is hard to undo and is an owner call. | `server.js` |
| **security.txt** (RFC 9116) at `/.well-known/security.txt` (and `/security.txt`): Contact hello@, Expires 2027-10-28, Policy points to `/security`. | `public/.well-known/security.txt`, `server.js` |
| Tests now cover the trimmed health response, operator health, the HSTS header, security.txt, the home canonical, JSON-LD and the sample section. **`npm test`: 8/8 pass.** | `test/server.test.js` |

### P1: conversion / Paddle-failure fallback (`/pricing`)
- Buy buttons already had `mailto:` hrefs, so they work if Paddle never loads. Gaps closed:
  - `/api/payment-config` now times out after 8s. Before, a hung request left the "Connecting secure Paddle checkout..." text up forever.
  - Any failure (config, Paddle script blocked, checkout error on click) now shows a status line with an **"Order by email instead"** link. Before, a click error swallowed the mailto and left only an error message.
  - A permanent line under the plans: "Checkout not loading, or your company cannot pay by card? **Order by email**…". It adds a >600-question / portal path ("Ask for a written scope") and a USD + Paddle tax note.
  - New FAQ: "What if the checkout button does not open?"
  - "Start Monthly" is renamed "Buy Monthly" to match the other buttons.
- Files: `public/site.js`, `public/pricing.html`, `public/styles.css`.

### P2: design and CTA hierarchy
- **Hero:** one primary action (**See pricing and buy online**, larger `.btn-lg`) and one low-commitment secondary (**Check scope by email first**). The secondary is a mailto with a scoping template that warns against attaching confidential files before NDA. The old "Start a questionnaire" implied a self-serve form, so it is gone. "See what a draft looks like" is a text link to the sample.
- **Final CTA:** primary is buy, secondary is email scope, and Security is a ghost link (it was two equal-weight buttons).
- **Sample output section (`#sample`), new.** It is a 4-row illustrative table (question, draft answer, evidence used, status) showing: two high-confidence answers tied to evidence, one **flagged: no evidence**, and one **flagged: legal review**. It is captioned *"Illustrative excerpt built from synthetic documentation for a fictional company. It is not a client deliverable and does not describe any real customer."* It also has a "Request the full sample pack by email" CTA and an HTML `<!-- OWNER: -->` comment marking where the real redacted sample pack link goes. **No customers, logos or testimonials were added.**
- The confusing **"0" metric** ("raw files stored…") is replaced with **"Your format"** (answers returned in the buyer's original spreadsheet or document).
- Deliverable badges are clearer: "Review" is now **Flagged** and "Tracked" is now **Logged**.
- Section backgrounds alternate properly now that the sample section is in place.
- Checked locally at desktop and 375px mobile: no horizontal page overflow. The sample table scrolls inside its own card on small screens.

### Vanta positioning (FAQ on `/pricing`)
The answer was rewritten to be **honest, not a supersede claim**: Vanta and Drata are compliance platforms; "If you need that, use them; QuestForgeAI does not replace them". QuestForgeAI does the narrower job of the buyer's custom questionnaire, with no migration and no annual contract.

### Not changed (deliberately)
- **`/security` body tone and content.** It stays honest, including "What we do not claim" (no SOC 2/ISO). Only the head/meta, nav and footer changed.
- "No sales call" positioning, the prices, and the tier contents.
- The operator console (`index.html`, `operator.js`). Live runs a different browser-only build that is not in this repo.
- `robots.txt` in the repo. Live robots are Cloudflare-managed (prepended at the edge), so this is a dashboard decision (section 4).
- CSP `style-src 'unsafe-inline'` is kept. The pricing page uses an inline `style=` attribute and Paddle's overlay may need it. Tightening it is a P3 that needs a Paddle checkout test.

---

## 3. Port to the Cloudflare Worker (required before these fixes are live)

Apply the equivalent of the `server.js` changes in the Worker's fetch handler:

```js
// 1) Trim health: only liveness for the public
if (url.pathname === '/api/health') {
  const ok = timingSafeEqual(request.headers.get('x-questforge-token'), env.QUESTFORGE_OPERATOR_TOKEN);
  const body = ok
    ? { status: 'ok', runtime: 'cloudflare-workers', apiKey: !!env.ANTHROPIC_API_KEY, payments: paymentsReady,
        pilotAccessConfigured: !!env.QUESTFORGE_OPERATOR_TOKEN, documentStorage: 'browser-only' }
    : { status: 'ok' };
  return withSecurityHeaders(Response.json(body, { headers: { 'Cache-Control': 'no-store' } }));
}

// 2) HSTS, added wherever the CSP / X-Frame-Options headers are set today
headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

// 3) security.txt: ensure public/.well-known/security.txt is in the assets bundle
//    and confirm after deploy that the asset pipeline serves the dot-directory
//    (add an explicit route like server.js does if it returns 404).
```

Alternatively, HSTS can be switched on in Cloudflare (SSL/TLS > Edge Certificates > HSTS). Do not do both with conflicting values.

---

## 4. Remaining owner-gated items (not done by Opus)

| # | Item | Why it is gated | How |
| --- | --- | --- | --- |
| 1 | **Approve and deploy this branch** | No live change without the owner's yes | Review the diff, port section 3 to the Worker, deploy the Worker plus static assets. Then smoke-test `/`, `/pricing` (Paddle opens), `/api/health` (public shows only `{"status":"ok"}`), `/.well-known/security.txt`, and response headers (HSTS). |
| 2 | **Google Search Console** | Needs the owner's Google account and a DNS change | Add a Domain property for `questforgeai.ai`, add the TXT record in Cloudflare DNS, verify, submit `sitemap.xml`, and request indexing for `/`, `/pricing`, `/security`. Kamtobe's GSC does **not** cover this domain. |
| 3 | **Bing Webmaster Tools** | Needs the owner's Microsoft account | Import from GSC after step 2 and submit the sitemap. |
| 4 | **Cloudflare managed robots / AI crawl control** | Cloudflare dashboard, owner decision | Allow AI **search/answer** crawlers on product pages if wanted. Keep `ai-train=no` and the training Disallows (consistent with the "no training" promise). Note: ClaudeBot and anthropic-ai get a **403 at the edge**, which is a separate rule from robots.txt. |
| 5 | **Unlock operator `/app`** | Secret handling | Live `pilotAccessConfigured: false` means no operator token is set, so the owner is currently locked out of the workspace too. Set `QUESTFORGE_OPERATOR_TOKEN` as a Worker **secret** (`wrangler secret put` or the dashboard), never in the repo. Then open `/app?token=…` or send the `x-questforge-token` header. Confirm this is intentional before the first paid order. |
| 6 | **Real sample deliverable** | Content asset, no fabrication | Build the redacted or synthetic sample pack (spreadsheet, confidence report, flagged items, cover note). Link it where the `<!-- OWNER: -->` comment sits in `#sample`. |
| 7 | **Paddle live purchase test** | Spends money | One live test on each tier after deploy, including the email fallback path. |
| 8 | **HSTS preload** | Hard to reverse | Only after HSTS has run cleanly for a few weeks, if wanted at all. |
| 9 | **DPA / sub-processor PDF, named security contact** | Legal content | Owner or counsel to draft. Link it from `/security` §6 and §9. |
| 10 | **Content surface** | Owner copy approval | Comparison page (vs Vanta/HyperComply/DIY, honest wedge), use-case pages (SIG, CAIQ, HECVAT, custom Excel), about page. Add them to `sitemap.xml` when they ship. |
| 11 | **Repo hygiene** | Owner choice | Bring the Worker source into this repo (or a sibling repo) so repo and live cannot drift again. Retire `render.yaml` and update `ACCESS_MAP.md` (it still says Render) once the Worker is the only runtime. |

---

## 5. Files changed on this branch

```
OPUS_FINDINGS.md                    (new: this file)
public/.well-known/security.txt     (new)
public/landing.html                 (live sync + SEO + copy + CTA + sample section)
public/pricing.html                 (live sync + SEO + h1 + email fallback + FAQ)
public/security.html                (live sync + SEO head/nav/footer only)
public/privacy.html                 (live sync + SEO + pilot removed + sub-processors)
public/refund.html                  (SEO + pilot removed)
public/terms.html                   (SEO + Paddle named + turnaround clause)
public/success.html                 (footer naming)
public/site.js                      (Paddle timeout + email fallback)
public/styles.css                   (CTA sizes, sample table, order fallback, h1)
public/sitemap.xml                  (lastmod)
server.js                           (health trim, HSTS, security.txt route, /app gate copy)
test/server.test.js                 (new assertions)
```
