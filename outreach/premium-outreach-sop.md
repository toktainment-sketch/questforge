# QuestForgeAI Premium Outreach SOP

Updated: 2026-06-30

## Operating Rule

No generic outreach. Every prospect must have a reason, a role-specific angle,
and a logged research trigger before contact.

## Stage 1: Account Discovery

Use these sources in order:

1. LinkedIn Sales Navigator account search.
2. Google search operators.
3. Crunchbase funding/growth signals.
4. Job postings.
5. G2/Capterra category lists.
6. Company security/trust pages.
7. Communities and founder/security posts.

Account search strings:

```text
+"security questionnaire" +"SOC 2" +"enterprise"
+"vendor security review" +"B2B SaaS"
+"SIG questionnaire" +"startup"
+"CAIQ" +"security questionnaire"
+"HECVAT" +"security questionnaire" +"SaaS"
site:*.com "trust center" "SOC 2" -vanta.com -drata.com
site:*.com "security questionnaire" "enterprise"
site:*.com "vendor security review" "sales"
```

## Stage 2: Account Qualification

Score each company using `premium-gtm-research-brief.md`. Only continue if:

- Score is 70+; or
- Score is 60+ with a warm network path or strong public trigger.

Reject or pause accounts with no clear regulated/enterprise buyer signal.

## Stage 3: Contact Mapping

For each approved account, identify 2-3 contacts:

1. Commercial owner: CRO, VP Sales, Head of Revenue, CEO/founder.
2. Risk owner: CISO, Head of Security, Security/GRC lead.
3. Workflow owner: RevOps, Sales Engineer, Solutions Architect, Compliance Ops.

Do not rely on one title. Security questionnaires are cross-functional, so the
best account view is commercial plus security plus workflow.

## Stage 4: Enrichment

Use:

- LinkedIn for role, activity, recent posts, mutual context.
- Apollo for verified business email.
- Clay when a higher-quality enrichment waterfall is needed.
- Company site for security/trust evidence.
- Crunchbase for funding and growth signals.
- BuiltWith/Wappalyzer for tech and trust stack clues.

Record:

- Source URL.
- Why this account is relevant.
- Why this person is likely to care.
- Best opener.
- Email confidence.
- Whether the message is LinkedIn-first or email-first.

## Stage 5: Personalization

Every first message needs one of these:

- Funding/upmarket trigger.
- Trust center or SOC 2 trigger.
- Job post trigger.
- LinkedIn post/comment trigger.
- Vertical-specific trigger.
- Buyer page or enterprise customer trigger.
- Warm relationship trigger.

Bad personalization:

```text
I noticed you work at {{company}}.
I saw your website.
Hope you are well.
```

Premium personalization:

```text
I saw {{company}} is selling into healthcare teams and already has a trust page.
That usually means the evidence exists, but custom buyer questionnaires still
turn into spreadsheet work across sales, security, and legal.
```

## Stage 6: Channel Choice

Use LinkedIn first when:

- The buyer has posted in the last 30 days.
- There is a mutual connection.
- The trigger came from LinkedIn.
- The contact's email confidence is low.

Use email first when:

- Verified company-domain email exists.
- There is a sharp company trigger.
- The buyer is senior and not active on LinkedIn.

Use both carefully when:

- The account is top 20.
- The message is highly researched.
- Follow-up is spaced and respectful.

## Stage 7: Outreach Cadence

Top 20 high-touch accounts:

| Day | Action |
| --- | --- |
| 0 | View profile, engage with relevant post if natural, send personalized connection request |
| 1 | Send researched email if verified email exists |
| 3 | LinkedIn follow-up with useful observation or sample offer |
| 5 | Email follow-up with one proof asset |
| 9 | New angle: role-specific pain or buyer trigger |
| 14 | Breakup message with permission to close the loop |

Do not send more than one cold email follow-up if the person opts out or shows no
fit. Log opt-outs immediately.

## Stage 8: Response Handling

Positive response:

- Offer sample output.
- Ask if they have a questionnaire in motion this quarter.
- Move to a 15-minute discovery call.

Question about accuracy:

- Explain human-reviewed draft, confidence notes, low-evidence flags, and final
  client approval.

"We use Vanta/Drata":

- Position QuestForgeAI as the custom buyer questionnaire response layer, not a
  compliance platform replacement.

"Send info":

- Send the one-pager, synthetic sample output, and one short question:
  "Do custom questionnaires currently land with sales, security, or legal?"

No fit:

- Thank them and ask if there is a better owner only when appropriate.

## Stage 9: Tracking

Use `premium-prospect-tracker-template.csv`. Minimum fields:

- Account score.
- Role angle.
- Trigger.
- Source URL.
- Email confidence.
- Outreach date.
- Response.
- Opt-out status.
- Next action.

## Stage 10: Weekly Review

Every Friday:

- Count new accounts researched.
- Count contacts enriched.
- Count messages sent.
- Count replies.
- Count calls booked.
- Count pilots quoted.
- Count pilots paid.
- Note which angle performed best.
- Update message copy for the next week.
