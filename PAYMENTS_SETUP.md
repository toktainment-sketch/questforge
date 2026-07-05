# QuestForgeAI Paddle Setup

Status as of 2026-07-05:

- Paddle vendor dashboard shows "Verification passed".
- Live Paddle checkout opens successfully from the QuestForgeAI pricing page.
- Default payment link is set in Paddle to `https://questforgeai.ai/pricing`.
- Products and prices have been created in the Paddle catalog.
- Paddle webhook destination is active at
  `https://questforgeai.ai/api/paddle/webhook`.
- Render has `PADDLE_WEBHOOK_SECRET` set. A signed live webhook test returned
  `200 {"received":true}` on 2026-06-30.
- Paddle email received on 2026-06-30 said the account is live and payments can
  be taken, but domain review could not locate Pricing, Terms and Conditions,
  Privacy Policy, and Refund Policy URLs. Commit `d4b89fb` made these links
  explicit in public footers and added `sitemap.xml` and `robots.txt`.
- Paddle payout settings were updated successfully in Paddle on 2026-06-30
  using Wise Business GBP wire-transfer details for KAMTOBE CREATIONS LIMITED.
- Production deploy `e55c532` is live. Public URLs now resolve for Pricing,
  Terms and Conditions, Privacy Policy, Refund Policy, and Security Overview.
- Paddle checkout payloads for Standard, Large, and Monthly return live price IDs
  with HTTPS success and cancel URLs.
- Public QuestForgeAI support/intake links point to `hello@questforgeai.ai`.

## Must-Close Reminder

Paddle payout settings are saved and visible in the Paddle dashboard. Continue
to monitor Paddle for payout verification or additional review requests before
relying on withdrawals as fully cleared.

## Paddle Products

| Tier | Paddle product | Price | Billing | Environment variable |
| --- | --- | ---: | --- | --- |
| Standard | QuestForgeAI Standard | USD 1,200 | One-time | `PADDLE_PRICE_STANDARD=pri_01kwb8g043gthn3weahbzcb7pq` |
| Large | QuestForgeAI Large | USD 1,800 | One-time | `PADDLE_PRICE_LARGE=pri_01kwb8h6vnzhe6bzaj921attjp` |
| Monthly | QuestForgeAI Monthly | USD 4,500 | Monthly recurring | `PADDLE_PRICE_MONTHLY=pri_01kwb8hv88py9cp7qs38kz2ctp` |

## Required Render Environment

Set these in Render before expecting live checkout to open:

```text
PADDLE_ENVIRONMENT=production
PADDLE_CLIENT_TOKEN=<copy from Paddle > Developer Tools > Authentication > Client-side tokens>
PADDLE_PRICE_STANDARD=pri_01kwb8g043gthn3weahbzcb7pq
PADDLE_PRICE_LARGE=pri_01kwb8h6vnzhe6bzaj921attjp
PADDLE_PRICE_MONTHLY=pri_01kwb8hv88py9cp7qs38kz2ctp
PADDLE_WEBHOOK_SECRET=<set in Render from Paddle notification destination>
```

Do not store API keys, webhook secrets, personal IDs, or bank details in this file.
