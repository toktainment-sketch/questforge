# QuestForge Access Map

Last updated: 2026-06-30

This file is for non-sensitive access coordination only. Do not paste passwords,
OTP codes, bank details, government IDs, API keys, webhook secrets, or auth codes
here. Store those in the secrets vault/password manager.

## Primary Identity

| Item | Details |
| --- | --- |
| Legal entity | KAMTOBE CREATIONS LIMITED |
| Company number | 17288786 |
| Registered address | 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ |
| Public business email | admin@kamtobecreations.com |
| Public website | https://questforgeai.ai |

## Paddle

| Item | Details |
| --- | --- |
| Site | https://vendors.paddle.com |
| Account / business shown | KAMTOBE CREATIONS LIMITED |
| Login email | Needs confirmation. User indicated it is not `toktainment@gmail.com`. |
| Login method | Browser session currently active in Chrome. Password stays with user/vault. |
| Current dashboard status | Get Started 3/5. Domain approved. Business verification still appears in progress. |
| Approved domain | questforgeai.ai |
| Default payment link | https://questforgeai.ai/pricing |
| Products/prices | See `PAYMENTS_SETUP.md` |
| Render env vars set | `PADDLE_ENVIRONMENT`, `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_STANDARD`, `PADDLE_PRICE_LARGE`, `PADDLE_PRICE_MONTHLY` |
| Not yet set | `PADDLE_WEBHOOK_SECRET` after creating Paddle notification endpoint |

## Render

| Item | Details |
| --- | --- |
| Site | https://dashboard.render.com |
| Workspace | My Workspace |
| Login method | GitHub OAuth via `toktainment-sketch` |
| Service | questforge |
| Service ID | srv-d8gegg6gvqtc73emo0lg |
| Runtime/region | Node, Oregon |
| Git repo/branch | `toktainment-sketch/questforge`, `master` |
| Render URL | https://questforge-sq2s.onrender.com |
| Custom domain | https://questforgeai.ai |

## GitHub

| Item | Details |
| --- | --- |
| Site | https://github.com |
| Account | toktainment-sketch |
| Repository | https://github.com/toktainment-sketch/questforge |
| Local repo | `C:\Users\ifeom\OneDrive\Desktop\AI STUDIO FOLDER\01_ACTIVE_PROJECTS\questforge` |
| Auth observed | GitHub CLI logged in as `toktainment-sketch` |

## Gmail / Google

| Item | Details |
| --- | --- |
| Connected Gmail connector | `toktainment@gmail.com` |
| Business email | `admin@kamtobecreations.com` |
| Open Chrome mailbox | `editwithcleopatra@gmail.com`, Google account name Cleopatra Odumodu |
| Open Chrome mailbox | `kamtobecreations@gmail.com`, Google account name Kamtobe Creations |
| Current routing note | Payoneer messages for KAMTOBE/admin are visible in `editwithcleopatra@gmail.com`. Do not rely on `toktainment@gmail.com` for this project. |
| Search result | No Paddle messages found in `kamtobecreations@gmail.com` or `editwithcleopatra@gmail.com` when searched for Paddle-related terms on 2026-06-30. |

## Payoneer

| Item | Details |
| --- | --- |
| Site | https://www.payoneer.com |
| Business account | KAMTOBE CREATIONS LIMITED |
| Login email from handover | `admin@kamtobecreations.com` |
| Mailbox where Payoneer mail appeared | `editwithcleopatra@gmail.com` |
| Latest email found | "Action required: Provide information as part of account review", from Payoneer, received 2026-06-29 05:36. |
| Status from email | Verification Center requires additional information before full receive/send functionality. Review usually takes up to 5 business days after submission. |
| Secret handling | Password and bank details stay in user vault only. |

## Flutterwave

| Item | Details |
| --- | --- |
| Site | https://dashboard.flutterwave.com |
| Intended business | KAMTOBE CREATIONS LIMITED |
| Status | Signup was blocked by Flutterwave business-name validation. Not active for QuestForge checkout. |
| Login email | Needs confirmation if revisited. |

## Wise

| Item | Details |
| --- | --- |
| Site | https://wise.com |
| Status from handover | Personal profile created; business onboarding started then abandoned. Not active for QuestForge checkout. |
| Login email | Needs confirmation if revisited. |

## QuestForge Live Payment State

| Item | Details |
| --- | --- |
| Live pricing page | https://questforgeai.ai/pricing |
| App payment provider | Paddle |
| API readiness | `/api/payment-config` reports Paddle ready after Render env setup. |
| Current blocker | Paddle checkout opens but Paddle displays its own error until account/business verification fully clears. |
