# Convo Home Page Revamp — Audit & Architecture

> Branch: `alfie/home-revamp-20260626` (from `origin/rory/convo-marketing-site-mockup`)
> Author: Alfie · 26 June 2026
> Source of truth: `gtm/convo-gtm-strategy-v1.html` (v1.5)

---

## Why this rebuild

Two readers must walk away resolved:

| Reader | What they need to feel by scroll-end |
|---|---|
| **SMB owner (Dr Rachel persona, GTM slide 13)** | "This solves my after-hours enquiries AND fills my SEO gap. Demo this week." |
| **Investor / sharp operator** | "This is a venture-scale wedge play. First-party data moat. ~95% gross margin. $660M AU SAM, $1.7B AU/NZ/UK." |

The same words. Different reading. We do not say "investors" anywhere on page.

### Strategic signals to embed (subtle, not stated)

Each of these maps to a GTM slide and shows up on the home page as **product texture** or **proof**, never as positioning copy.

1. Massive TAM — *any SMB with a website + FAQs.* Embedded via the integrations strip (WordPress, Shopify, Webflow), the use-cases grid (dental, vet, legal, cosmetic, allied health, real estate, financial, agencies) and the comparison sentence. GTM 06 / 11.
2. Wedge + expansion — dental shows up first in the use-cases grid and in a case-study slot, but **not** in the hero. Reader infers: "they have a beachhead, but it works everywhere." GTM 10-17.
3. Compounding moat — phrased to customers as "every conversation makes Convo smarter about your customers." Reader who knows what they're looking at sees: first-party intent dataset per tenant, RAG-grade. GTM 09 / 13.
4. Technical credibility — one line on grounded retrieval and guardrails. Not a wall of jargon. GTM 09.
5. Velocity — "Shipped this quarter" strip (subtle, optional). GTM 03.
6. Founder credibility — appears in case-study quote attribution ("Blake & Cam, founders") and the close.

---

## Part 1 — Side-by-side audit

### Inputs

- **Live:** `brand/landing.html` (2,097 lines, served at convoapp.com.au). Reference DNA — strong hero, three-step howto, integration strip, dashboard mockup, compounding-loop section, testimonials, pricing on page, FAQ.
- **Draft:** `src/app/(marketing)/page.tsx` on `rory/convo-marketing-site-mockup`. Good Next.js scaffolding; copy needs work; missing trust + pricing on page.

### Section-by-section verdict

| # | Section in draft | Live equivalent | Verdict | Why |
|---|---|---|---|---|
| 1 | Hero (zinc-950, "Turn website conversations into blog posts that rank.") | Hero (white, "Every conversation grows your business.") | **Lift + rewrite** | Draft's chat+pipeline mockup is stronger than live's single-bubble. Keep the dark hero (premium feel) but rewrite headline (current echoes meta-title; not "investor-grade"). Stat row uses tenant-internal phrasing ("Puppy enquiry / Breed guide"). Kill the Doggo-flavoured metrics. |
| 2 | Integrations strip (WordPress, Shopify, Webflow, GSC, GA4, Ahrefs, API) | "Works with your stack" marquee | **Keep, polish** | Draft strip is denser and more credible (GSC, GA4, Ahrefs signals technical depth). Live's marquee animation is more polished visually. Keep static for now, increase visual weight. |
| 3 | Problem trio ("Content teams guess topics / Forms ask too early / Old pages drift") | (none — live skips problem section) | **Rewrite** | Concept is right but copy is internal-marketer talk. Rewrite in buyer-voice. Pull from GTM persona "my agency takes my money and I cannot tell what is working" (slide 13). |
| 4 | How it works (WorkflowDiagram, 5 steps) | "Three steps. Zero effort." (Chat / Extract / Publish) | **Lift + simplify** | Live's three-step is cleaner. Draft's five-step (Chat → Capture → Decide → Measure) is more honest but cluttered. Compress to **3-4 steps** using draft's structure with live's clarity. |
| 5 | Features (7 cards) | Features (6 cards) | **Keep, tighten copy** | Draft cards are well-structured, link to feature pages (good for SEO + IA). Copy is jargon-light. Reduce to **6** to fit a clean 3x2 grid. |
| 6 | Growth loop ("Better answers create better demand signals") on dark | "The Compounding Effect" with arrow loop | **Rewrite + steal live's visual** | Draft copy is internal-strategy talk. Live's flywheel arrow visual is iconic. Lift the visual concept (visitors → conversations → content → SEO traffic → visitors). This is the **moat made visible** — investor read happens here. |
| 7 | SEO performance ("Instant value means showing what moved") | Dashboard mockup | **Keep concept, lift dashboard** | Live has a stronger artifact — the dashboard mockup with named articles, pipeline stages, "12 articles this week" badge. Reuse that visual treatment. Draft's three-card copy is fine as a sub-block. |
| 8 | Use cases (4 links: Local services / Ecommerce / Marketplaces / Agencies) | (none) | **Rewrite** | This is the **expansion signal** for the sharp reader. Replace generic 4-tile with a **vertical grid** that names dental, vet, cosmetic, legal, allied health, real estate, financial advisory, agencies. Dental gets a "first wedge" badge or "case study available" tag. Investor reads: wedge + roadmap. Customer reads: "yes, my vertical is covered." |
| 9 | Proof format ("Show the before and after, not vague AI magic") | Testimonials (3 with stats: 3x organic / 47% leads / 12hrs saved) | **Kill draft / Lift live** | Draft "vague AI magic" sneers. Live's testimonials are the strongest social proof asset we have. Keep them. Flag for Blake: real or composite? If composite, we lift the **format** and replace with real ones (Doggo, AgPages pilot) or mark as "early pilot results." See "Blocker" below. |
| 10 | (missing in draft) | Pricing on page (Starter / Growth / Scale) | **Add (compact)** | GTM lock-in: annual-first, $249 / $499 / $899. Live shows $0 / $49 / $149 (old/wrong pricing). **Use the GTM-locked numbers.** Compact card row on home with "see full pricing" → /pricing. |
| 11 | (missing) | FAQ accordion | **Add (top 5)** | SEO win (FAQPage schema). Pull top 5 from `faqGroups` in content.ts. |
| 12 | CTA section (dark, "Ready to turn conversations into growth?") | Final CTA | **Keep, sharpen copy** | Decent. Tighten copy. |
| — | Footer | Footer | **Keep** | Both fine. Draft has better IA (more links). |

### Internal-positioning leaks Cam missed (flagged for kill or rewrite)

1. **Hero stat row:** "Lead signal: Puppy enquiry / Content action: Breed guide / Result: Tracked lead" — Doggo tenant data leaking. Confusing for any non-Doggo reader.
2. **ChatPipelineMockup hero name:** "Doggo visitor" badge + Cavoodle conversation hardcoded into the hero. **Keep the mockup component** but parameterise — show a **dental** conversation in the hero ("I broke a molar and need someone Tuesday — do you do same-day?") to land the wedge subtly. Sharp reader sees: "they're targeting dentists." Customer thinks: "this is what my visitors ask too."
3. **"Built for conversations that become commercial assets."** — internal slide-deck phrasing. Rewrite buyer-voice.
4. **"Better answers create better demand signals."** — strategy talk. Rewrite.
5. **"Show the before and after, not vague AI magic."** — defensive snark.
6. **"`Built for websites where questions become revenue.`"** — corporate.
7. JSON-LD says `price: "99", priceCurrency: "USD"` — **wrong currency, wrong tier.** Update to `299` AUD (Growth monthly starting price) or remove price field and rely on /pricing.

### SEO gaps in draft

- ❌ No FAQPage schema (we have FAQ content; add to home with structured data)
- ❌ No Organization schema (founders, country, founding date — useful for E-E-A-T)
- ❌ No semantic `<h2>`/`<h3>` hierarchy in workflow + features (currently mixes h2/h3 inconsistently)
- ❌ Hero h1 is generic ("Turn website conversations into blog posts that rank") — same as page meta-title, missed keyword opportunity
- ❌ No internal links into vertical or comparison pages from the home (use-case tiles all link to single /use-cases)
- ❌ No OG image (`opengraph-image` route or static `og.png`) — `marketingMetadata` doesn't set `images`
- ❌ `<html lang="en">` — should be `en-AU` to match content
- ❌ No `<link rel="alternate" hreflang>` (defer; en-AU only for now)
- ⚠️ Hero stat row could carry valuable keyword phrases instead of internal jargon

---

## Part 2 — Section architecture (final IA)

10 sections. Each one earns its place. Each one double-resolves (SMB read / investor read).

### S1 · Hero (dark, full-bleed feel)

- **Purpose:** Headline + chat-to-content visualisation in one viewport.
- **SMB read:** "This answers my visitors and writes my content."
- **Investor read:** "Two products bridged into one workflow. Clear positioning vs Tidio (chat-only) and SEObot (content-only)." GTM 05 / 07.
- **Copy beat:**
  - Eyebrow: `Chat + content as one product` (drops GTM bridge framing)
  - H1: **Every visitor question becomes the next page that ranks.**
  - Sub: One AI chat for your website. Every conversation captures a lead now and feeds the SEO content your customers were going to search for anyway.
  - CTAs: Start free · See it live
- **Visual:** Live chat (dental example, AHPRA-clean) + content queue side panel. Same component, dental-flavoured. (Investor read: vertical specificity.)
- **Stat row:** Replace "Puppy enquiry" trio with three credible KPIs:
  - `24/7` answers · `Every chat` becomes a content signal · `One install` on WordPress, Shopify, Webflow
  - (Live landing's pattern: 10× / 24/7 / Zero. Same energy.)
- **GTM ref:** Slides 04-05 (the bridge), 07 (whitespace).

### S2 · Integrations / trust strip

- **Purpose:** Reduce buyer risk + signal technical depth in one row.
- **SMB read:** "Works with WordPress, my CMS."
- **Investor read:** "GSC + GA4 + Ahrefs connected → first-party + SEO data fused. RAG-grade. Multi-CMS = TAM unlock."
- **Copy beat:** No copy. Logo row, monochrome, balanced.
- **GTM ref:** Slide 06 (TAM table), 09 (moat #1).

### S3 · Problem (buyer-voice)

- **Purpose:** Validate the persona's pain in two lines.
- **SMB read:** "Yes, that's exactly my problem."
- **Investor read:** "They've nailed the persona. This is selling pain, not features."
- **Copy beat:**
  - Eyebrow: `The gap`
  - H2: **Your SEO agency is expensive. Your website doesn't answer the phone. Your visitors ask the same questions, and nobody is writing them down.**
  - Three cards:
    - *Your agency reports rankings, not patients.* You can't point to a piece of content that brought you a customer last quarter.
    - *Your forms ask too early.* Visitors leave before they trust you enough to type their email.
    - *Your team has no time to write.* The same questions get answered on the phone every day, and none of them ever make it to a page.
- **GTM ref:** Slide 13 (persona pain quotes).

### S4 · How it works (3 steps, large)

- **Purpose:** Make the loop crystal clear.
- **SMB read:** "Three things. I get it."
- **Investor read:** "This is the closed loop. Chat in, content out, both compound." GTM 05.
- **Copy beat:**
  - Eyebrow: `The loop`
  - H2: **Three steps. One growth engine.**
  - Step 01 · **Chat.** Convo answers your visitors 24/7 using your real business knowledge. Captures leads when the question is ready, not before.
  - Step 02 · **Decide.** Convo groups recurring questions, checks what your site already covers, and writes the page that's missing. Or updates the one that's drifted.
  - Step 03 · **Publish.** Reviewed, SEO-optimised content flows into WordPress, Shopify, or Webflow. Performance tracked against the original conversation.
- **Visual:** Reuse `WorkflowDiagram` component (compressed to 3 cards).
- **GTM ref:** Slide 05.

### S5 · Features (6 cards, 3×2)

- **Purpose:** Capability surface area without overwhelming.
- **SMB read:** "Everything I need."
- **Investor read:** "Genuine product, not a thin wrapper. Knowledge base + analytics + publishing = sticky."
- **Cards (keep from `featureCards`, drop `Content Maintenance` since it overlaps SEO Pipeline):**
  - AI Chatbot · Lead Capture · SEO Content Pipeline · SEO Performance Analytics · Knowledge Base · CMS Publishing
- **Copy beat:** Use feature card text from content.ts. Eyebrow stays. Title stays. Description: trust the existing copy, light polish.
- **GTM ref:** Slides 08 (comp matrix), 09 (moats).

### S6 · Compounding loop (dark, the moat made visible)

- **Purpose:** Show the flywheel. This is the investor moment.
- **SMB read:** "The more I use it, the better it gets."
- **Investor read:** "First-party data flywheel. Defensible. Compounds per tenant. Per GTM slide 09 moat #1."
- **Copy beat:**
  - Eyebrow: `The compounding loop`
  - H2: **Every conversation makes Convo smarter about your customers.**
  - Sub: Visitors ask. Convo answers. The questions feed your content. The content brings more visitors. Each tenant ends up with a private dataset of exactly what their buyers ask, in their words, that no competitor has access to.
  - 4-node arrow loop: Visitors → Conversations → Content → SEO traffic → (back to Visitors)
- **Visual:** Steal live landing's flywheel arrow visual. Refine into Next.js component.
- **GTM ref:** Slides 09 (moat #1: first-party data loop), 05 (the loop).

### S7 · The dashboard (proof of product)

- **Purpose:** Show the actual product. Reduces "vaporware" risk.
- **SMB read:** "Real product. I can see what I'd see."
- **Investor read:** "Shipped product. Velocity signal." GTM 03.
- **Copy beat:**
  - Eyebrow: `The dashboard`
  - H2: **Watch conversations become published content.**
  - Sub: One view. Live conversations on the left. Content pipeline on the right. Every published page tracked against impressions, clicks, and the chat enquiries that came after.
- **Visual:** Dashboard mockup component (lift live's structure: browser chrome, side-nav, content pipeline with article rows in Published / Generating / Draft states).
- **GTM ref:** Slide 03.

### S8 · Use cases (vertical grid — the expansion signal)

- **Purpose:** Show breadth without softening positioning.
- **SMB read:** "My vertical is covered."
- **Investor read:** "Wedge identified, expansion sequence visible, TAM spans 8 verticals." GTM 11, 16.
- **Copy beat:**
  - Eyebrow: `Built for service businesses`
  - H2: **Whatever your customers ask, Convo learns it.**
  - Sub: Convo is strongest when the same buying questions keep landing on your site. We see that pattern across health, services, retail, and agencies.
- **Visual:** 8-tile grid. Dental tile carries a small "Pilot ready" or "Founding wedge" badge (subtle). Each tile has a vertical icon + name + one-line example question:
  - **Dental** — "Do you do same-day crowns?" *(Pilot ready)*
  - **Vet** — "Is my puppy due for a vaccine?"
  - **Legal** — "Do I have a case for unfair dismissal?"
  - **Cosmetic** — "How much downtime after a chin filler?"
  - **Allied health** — "Will my health fund cover this?"
  - **Real estate** — "What's the rental yield in [suburb]?"
  - **Financial advice** — "Should I salary sacrifice?"
  - **Agencies** — White-label for your clients
- **GTM ref:** Slides 11 (vertical scorecard), 16 (expansion playbook), 20 (agency channel).

### S9 · Pricing (compact, on-page)

- **Purpose:** Anchor the value. Premium positioning visible.
- **SMB read:** "Honest, simple, I can budget for it."
- **Investor read:** "Premium pricing tier. Not racing to the bottom. GTM pricing locked." GTM 21-22.
- **Copy beat:**
  - Eyebrow: `Pricing`
  - H2: **Annual-first. Three tiers. Pays for itself with one new customer.**
  - 3 compact cards (Starter $249 / Growth $499 / Scale $899 — annual prices, monthly shown smaller). Growth highlighted.
  - Below: *Looking for multi-location, white-label, or DSO scale? Talk to us about Enterprise.*
  - Link: See full pricing →
- **GTM ref:** Slide 21.

### S10 · FAQ (top 5, with FAQPage schema)

- **Purpose:** SEO + last-mile objection handling.
- **Pull from `faqGroups`:** What is Convo · What makes it different · Does every conversation become content · Can I review before publishing · Which CMS platforms are supported.
- **Schema:** `FAQPage` JSON-LD.

### S11 · Final CTA (dark)

- **Purpose:** Close.
- **Copy:** **Try Convo on your own website.** Free to start. WordPress, Shopify, or Webflow. Live in 15 minutes.
- CTAs: Start free · Book a demo
- **GTM ref:** Slide 14 (the demo is the moment of truth).

### Footer

Keep current. Strong IA already.

---

## Part 3 — Things I'm flagging, not solving

1. **Testimonials are placeholder / fictional in live landing** (Sarah Hutchins at Greenfield Landscaping, etc.). I will **not** carry these into the rebuild as real. Options:
   - (a) Omit testimonials entirely on this PR. Cleaner.
   - (b) Mark them as "Pilot results from early customers" with anonymised attribution (Brisbane dental practice, Sydney vet clinic).
   - **Recommendation:** (a) for this PR. Add a "Trusted by early customers" line under integrations if we want trust without false attribution. Real testimonials become a follow-up PR once Wedge 1 pilots run.

2. **No OG image asset.** I'll add an `opengraph-image` route that renders a branded OG card (Next.js native). Falls back gracefully without a design asset.

3. **The "eat our own dog food" Convo widget on the marketing site.** Per Cam's note. Requires a Convo tenant for the site itself. Documented as a follow-up in the PR description, not blocking this PR.

4. **JSON-LD pricing currency.** Will update to AUD 299 (Growth monthly) — closest single representative price. Cleanest fix.

5. **Hero `min-h-[calc(100vh-4rem)]`** is aggressive on short laptops. Will keep but cap with `max-h` or use intrinsic height.

6. **Dental-flavoured chat in hero risks confusing non-dentist buyers.** Mitigation: stat row + sub-headline stay broad ("any service business"). The dental example reads as "this is the kind of thing visitors ask" not "this is who Convo is for." Plus dental tile in S8 wears the wedge badge.

---

## Phase 3 plan — execution checklist

- [ ] `src/app/(marketing)/page.tsx` — full rewrite using new section architecture
- [ ] `src/components/marketing/product-mockups.tsx` — replace Doggo/Cavoodle hero conversation with dental example; add `DashboardMockup` + `CompoundingLoop` components
- [ ] `src/lib/marketing/content.ts` — extend with verticals[], pricingTiers[], homeFaqs[]; tighten copy where used on home
- [ ] `src/lib/marketing/seo.ts` — add `images` field to OG; add Organization + FAQPage schema helpers
- [ ] `src/app/(marketing)/page.tsx` — add Organization + FAQPage JSON-LD; fix SoftwareApplication price/currency
- [ ] `src/app/layout.tsx` — `<html lang="en-AU">`
- [ ] `src/app/(marketing)/opengraph-image.tsx` — Next.js Image Response, branded
- [ ] `src/components/marketing/marketing-layout.tsx` — light polish on header (no major changes); tighten footer description
- [ ] No new dependencies
- [ ] `npm run build` clean
- [ ] Open PR, link to this doc

