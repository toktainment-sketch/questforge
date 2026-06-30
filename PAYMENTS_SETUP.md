# QuestForge Paddle Setup

Status as of 2026-06-30:

- Paddle vendor dashboard still shows business verification as "In progress".
- Domain/payment setup work can continue while verification completes.
- Default payment link is set in Paddle to `https://questforgeai.ai/pricing`.
- Products and prices have been created in the Paddle catalog.

## Paddle Products

| Tier | Paddle product | Price | Billing | Environment variable |
| --- | --- | ---: | --- | --- |
| Standard | QuestForge Standard | USD 1,200 | One-time | `PADDLE_PRICE_STANDARD=pri_01kwb8g043gthn3weahbzcb7pq` |
| Large | QuestForge Large | USD 1,800 | One-time | `PADDLE_PRICE_LARGE=pri_01kwb8h6vnzhe6bzaj921attjp` |
| Monthly | QuestForge Monthly | USD 4,500 | Monthly recurring | `PADDLE_PRICE_MONTHLY=pri_01kwb8hv88py9cp7qs38kz2ctp` |

## Required Render Environment

Set these in Render before expecting live checkout to open:

```text
PADDLE_ENVIRONMENT=production
PADDLE_CLIENT_TOKEN=<copy from Paddle > Developer Tools > Authentication > Client-side tokens>
PADDLE_PRICE_STANDARD=pri_01kwb8g043gthn3weahbzcb7pq
PADDLE_PRICE_LARGE=pri_01kwb8h6vnzhe6bzaj921attjp
PADDLE_PRICE_MONTHLY=pri_01kwb8hv88py9cp7qs38kz2ctp
PADDLE_WEBHOOK_SECRET=<create from Paddle notifications/webhook endpoint>
```

Do not store API keys, webhook secrets, personal IDs, or bank details in this file.
