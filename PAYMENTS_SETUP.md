# QuestForgeAI Paddle Setup

Status as of 2026-06-30:

- Paddle vendor dashboard shows "Verification passed".
- Live Paddle checkout opens successfully from the QuestForgeAI pricing page.
- Default payment link is set in Paddle to `https://questforgeai.ai/pricing`.
- Products and prices have been created in the Paddle catalog.
- Paddle payout setup is paused until Wise Business completes review for
  KAMTOBE CREATIONS LIMITED and provides usable business account details.

## Must-Close Reminder

Do not mark payment operations complete until Paddle payouts are finished.
Payout setup was suspended because Wise Business is reviewing the KAMTOBE
CREATIONS LIMITED business account. Once Wise approves the account, return to
Paddle > Payout Settings and enter the Wise business payout details, then save
and verify the payout configuration.

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
```

Set this after creating the Paddle notification endpoint:

```text
PADDLE_WEBHOOK_SECRET=<create from Paddle notifications/webhook endpoint>
```

Do not store API keys, webhook secrets, personal IDs, or bank details in this file.
