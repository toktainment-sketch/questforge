# QuestForge — Delivery SOP

## Standard Operating Procedure for Questionnaire Completion Service

---

## 1. CLIENT INTAKE (0–1 hour after payment)

### Trigger
Client pays via Stripe or sends payment confirmation email.

### Steps
1. Send confirmation email within 30 minutes:
   - Subject: "QuestForge — You're in. Upload your files here."
   - Include upload link (QuestForge dashboard URL)
   - List what to upload: questionnaire file + security documentation
   - Set expectation: "24-hour delivery for Standard, 48-hour for Large"
2. Log client in tracking sheet: name, company, plan, payment date, delivery deadline
3. If client hasn't uploaded within 24 hours, send reminder email

### Confirmation Email Template

Subject: QuestForge — Upload your questionnaire and security docs

Hi {{firstName}},

Payment confirmed — thank you. Here's what to do next:

**Step 1:** Go to {{uploadLink}}
**Step 2:** Upload your security questionnaire (Excel, Word, or PDF)
**Step 3:** Upload your security documentation (SOC 2 report, pen test, privacy policy, previous questionnaire answers — anything you'd reference when answering)

Once uploaded, we'll deliver your completed questionnaire draft within {{deliveryTime}}.

Questions? Reply to this email.

Best,
QuestForge Team

---

## 2. PROCESSING (1–4 hours)

### Steps
1. Verify uploaded files are readable (not corrupted, not password-protected)
2. If files are unusable, email client immediately asking for re-upload
3. Run questionnaire through QuestForge engine
4. Monitor processing status via /api/status endpoint
5. When complete, download both output files:
   - Completed questionnaire (original format)
   - Summary report (confidence scores + flagged items)

### Quality Checks Before Delivery
- [ ] All questions have answers (no blank responses)
- [ ] Confidence report shows 80%+ auto-answered
- [ ] All legal/contractual questions are flagged (indemnification, SLA, liability, breach notification)
- [ ] No contradictory answers between sections
- [ ] Company name is correct throughout
- [ ] Cover letter is professional and references correct parties
- [ ] Flagged items have clear guidance on what client needs to review

### If Processing Fails
1. Check error in status.json
2. Common issues: file too large, unsupported format, API rate limit
3. Re-run with adjusted settings
4. If still failing, manually process the problematic sections and note in delivery

---

## 3. HUMAN QA REVIEW (30–60 minutes)

### Mandatory Review Items
1. **Legal flags:** Read every flagged legal/contractual answer. Verify the flag is appropriate. Add guidance note if needed.
2. **LOW confidence answers:** Read each one. Either improve using documentation or mark clearly as "needs client input."
3. **Consistency check:** Spot-check 5 random HIGH confidence answers against the source documentation. Are they accurate?
4. **Format check:** Open the completed questionnaire file. Does it look right? Are answers in the correct cells/fields?
5. **Cover letter:** Read it. Is it professional? Does it reference the correct company names?

### QA Pass/Fail Criteria
- **PASS:** 80%+ auto-answered, all legal items flagged, no obvious errors in spot-check
- **FAIL:** Under 80% auto-answered, missing legal flags, contradictory answers found
- If FAIL: fix issues and re-run QA check

---

## 4. DELIVERY (within 24/48 hours of upload)

### Delivery Email Template

Subject: Your completed security questionnaire is ready — QuestForge

Hi {{firstName}},

Your security questionnaire is complete. Here's what's attached:

**1. Completed Questionnaire** — answers filled in, ready for your team to review and submit.

**2. QuestForge Report** — includes:
- {{totalQuestions}} questions answered
- {{readyPercent}}% auto-answered with high confidence
- {{flaggedCount}} items flagged for your review (details in the report)
- Professional cover letter (ready to copy and send)

**What to do next:**
1. Open the completed questionnaire file
2. Review the flagged items (marked in the report) — these are legal/contractual questions or items where we need your team's specific input
3. Submit to your prospect

**Items flagged for your review:**
{{flaggedItemsSummary}}

If you'd like to walk through the output together, reply and we'll schedule a 15-minute call.

Best,
QuestForge Team

---

## 5. POST-DELIVERY (Day 1–14 after delivery)

### Day 1: Delivery confirmation
- Confirm client received and can open all files
- Ask: "Any questions about the flagged items?"

### Day 3: Check-in
- Email: "Have you had a chance to review the draft? Any revisions needed?"
- If revision requested: complete within 24 hours (1 revision included in Standard, 2 in Large)

### Day 7: Outcome check
- Email: "Did you submit the questionnaire? How did it go with the prospect?"
- Log outcome: submitted / not yet / prospect feedback

### Day 14: Follow-up and upsell
- If positive outcome: "Glad it worked. When your next questionnaire comes in, we're here. Would the monthly plan make sense for your volume?"
- If no response: final check-in, then close the loop

### Day 30: Delete client files
- Remove all uploaded documents and output files from server
- Confirm deletion in client record

---

## 6. REVISION HANDLING

### Included Revisions
- Standard plan: 1 revision pass
- Large plan: 2 revision passes
- Monthly plan: unlimited

### Revision Process
1. Client sends revision requests via email (specific items to change)
2. Update answers in the questionnaire file
3. Re-run QA on changed items only
4. Re-deliver within 24 hours
5. Log revision in tracking sheet

### Out-of-Scope Revisions
- Rewriting answers based on documentation we were never given → ask client for the documentation
- Changing answers to make claims not supported by documentation → flag as risk and explain
- Answering questions about products/features not in the documentation → ask client for product documentation

---

## 7. ESCALATION PROCEDURES

### Client Complaint
1. Respond within 2 hours
2. Offer to re-process with additional documentation
3. If quality genuinely poor: offer partial refund or free re-run

### Processing Failure
1. Notify client within 1 hour of discovery
2. Provide realistic revised timeline
3. If cannot deliver: full refund, no questions asked

### Confidentiality Concern
1. Execute NDA immediately if requested
2. Confirm data handling practices in writing
3. Offer to delete files immediately after delivery if client prefers

---

## 8. TRACKING AND METRICS

### Track Per Engagement
- Client name and company
- Plan type (Standard / Large / Monthly)
- Upload date → delivery date (measure turnaround)
- Total questions → auto-answered → flagged
- Revisions requested (count)
- Client outcome (submitted? prospect approved?)
- Client satisfaction (asked at Day 7)

### Weekly Metrics to Review
- Total engagements completed
- Average turnaround time
- Average auto-answer rate
- Number of revisions per engagement
- Client satisfaction score
- Revenue collected
