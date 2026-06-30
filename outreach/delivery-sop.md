# QuestForge Concierge Pilot SOP

## Operating Position

QuestForge is a controlled, human-reviewed concierge pilot. Do not invite clients
to a public upload flow. The `/app` workspace is for the operator only and must
be protected by `QUESTFORGE_OPERATOR_TOKEN`.

## 1. Intake

### Trigger

Client requests a pilot and payment is confirmed through an approved payment
route. For QuestForge B2B pilots, the intended route is Payoneer Request a
Payment after Payoneer KYC is approved.

Until Payoneer is approved, do not treat Payoneer as live. Use only an owner
approved pilot exception or another confirmed payment route.

### Checklist

- Confirm client company, requester, prospect/customer, deadline, and plan.
- Confirm the questionnaire format and approximate question count.
- Confirm what supporting documents they can provide.
- Confirm payment status. "Paid" means funds are received/available in the
  payment provider balance, not merely that a request was sent.
- Offer NDA before receiving sensitive files.
- Confirm file-transfer method and retention schedule.
- Log engagement in the tracker before files are processed.

### Intake Email Template

Subject: QuestForge pilot intake, next steps

Hi {{firstName}},

Thanks for starting a QuestForge pilot. Before we process anything, please reply
with:

- Company name to use in the questionnaire.
- Prospect or customer who sent the questionnaire.
- Deadline and preferred delivery time.
- Questionnaire file format and approximate number of questions.
- Whether you need an NDA before sending security documents.

Once confirmed, we will send file-transfer instructions and return a reviewed
draft package within the agreed turnaround window.

Best,
QuestForge Team

## 2. File Handling

### Accept

- Questionnaire: `.xlsx`, `.docx`, `.pdf`, or `.txt`.
- Supporting documents: `.pdf`, `.docx`, `.txt`, or `.xlsx`.
- Maximum 10 supporting files through the current operator tool.

### Do Not Accept

- Password-protected files unless the password is provided through a separate
  channel.
- Executables, archives, images as primary evidence, or unknown file types.
- Documents the client is not authorized to share.

### Operator Steps

1. Confirm received/available payment or approved pilot exception.
2. Confirm NDA status if requested.
3. Save files only in the approved working location.
4. Use `/app?token={{operatorToken}}` locally or in the private operator
   environment.
5. Do not share `/app` or operator token with the client.

## 3. Processing

### Run

1. Open the operator workspace.
2. Upload one questionnaire and up to 10 supporting documents.
3. Enter the exact client company name and prospect/customer name.
4. Start processing and monitor `/api/status/:jobId` through the operator UI.
5. Download the generated report and completed questionnaire draft.

### If Processing Fails

1. Read the error in `status.json` or the UI.
2. Check for unsupported format, corrupted file, missing questions, or API issue.
3. Re-run only after fixing the file issue.
4. If still blocked, notify the client with a revised timeline or refund option.

## 4. Human QA

QuestForge output is never auto-submitted. QA is mandatory.

### Review Checklist

- Confirm all questionnaire rows that should be answered have a draft answer.
- Review every legal, contractual, SLA, breach notification, liability, and
  data-retention answer.
- Review every LOW-confidence answer and rewrite or mark for client input.
- Spot-check at least five HIGH/MEDIUM answers against source documentation.
- Check that company names, prospect names, and dates are correct.
- Open every output file and confirm formatting is usable.
- Remove unsupported claims that are not present in the client documentation.

### Pass Criteria

- No obvious unsupported security, privacy, legal, or compliance claim remains.
- Flagged items clearly tell the client what to verify.
- The final package is usable as a client-reviewed draft.

## 5. Delivery

### Delivery Email Template

Subject: Your QuestForge questionnaire draft is ready

Hi {{firstName}},

Your QuestForge draft package is ready. Attached:

- Draft questionnaire response file.
- QuestForge report with confidence scores and flagged items.
- Cover note draft.

Please review the flagged items before submitting to your prospect. These are
the questions where your security, legal, or commercial team should verify the
final wording.

If you want to walk through the output, reply and we can schedule a short call.

Best,
QuestForge Team

## 6. Follow-Up

- Day 1: Confirm the client received and can open files.
- Day 3: Ask whether revisions are needed.
- Day 7: Ask whether the questionnaire was submitted and log outcome.
- Day 14: Ask whether they expect another questionnaire this quarter.
- Day 30 or agreed date: delete uploaded files and generated outputs, then log
  deletion.

## 7. Revision Handling

- Standard: 1 revision pass.
- Large: 2 revision passes.
- Monthly: revisions handled under the monthly agreement.

Out-of-scope revisions:

- Claims unsupported by documentation.
- New product/security facts not present in provided evidence.
- Legal commitments the client has not approved.

## 8. Metrics

Track per engagement:

- Client, requester, plan, payment status, NDA status.
- Upload/receipt date, delivery deadline, delivery date.
- Total questions, answered questions, flagged items, revisions.
- Client outcome and testimonial permission.
- Deletion date.
