const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Flags answers that need human review before delivery
const LEGAL_FLAGS = [
  'indemnif', 'liability', 'sla', 'uptime', 'guarantee', 'warranty',
  'breach notification', 'data retention', 'subprocessor', 'pentest',
  'penetration test', 'insurance', 'audit right', 'escrow', 'termination',
];

function buildKnowledgeBase(documents) {
  return documents.map(d => d.text || '').join('\n\n---\n\n');
}

function detectLegalFlag(question) {
  const q = question.toLowerCase();
  return LEGAL_FLAGS.some(flag => q.includes(flag));
}

function scoreConfidence(answer) {
  if (!answer || answer.length < 20) return 'LOW';
  if (answer.includes("I don't have") || answer.includes('not found') || answer.includes('unclear')) return 'LOW';
  if (answer.length > 200) return 'HIGH';
  return 'MEDIUM';
}

async function answerQuestion(question, knowledgeBase, companyName = 'the company') {
  const isLegalFlag = detectLegalFlag(question);

  const systemPrompt = `You are a security documentation specialist helping ${companyName} complete a vendor security questionnaire.

You will be given:
1. A question from a security questionnaire
2. The company's security documentation as context

Your job:
- Answer the question accurately based ONLY on the provided documentation
- Be specific, professional, and concise (2-5 sentences unless more detail is clearly needed)
- If the documentation doesn't clearly support an answer, say: "Based on available documentation: [best attempt]" and note what's missing
- Never invent certifications, standards, or security controls that aren't in the documentation
- Use professional B2B vendor language

If the question asks about something not covered in the documentation, respond with:
"[NEEDS REVIEW] - This question requires input from the security team: [explain what specific information is needed]"`;

  const userPrompt = `SECURITY DOCUMENTATION:
${knowledgeBase.slice(0, 12000)}

---

QUESTIONNAIRE QUESTION:
${question}

Provide a clear, accurate answer based on the documentation above.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const answer = message.content[0].text;
  const confidence = scoreConfidence(answer);
  const needsReview = isLegalFlag || answer.includes('[NEEDS REVIEW]') || confidence === 'LOW';

  return { answer, confidence, needsReview, isLegalFlag };
}

async function processQuestionnaire(questions, documents, companyName, onProgress) {
  const knowledgeBase = buildKnowledgeBase(documents);
  const results = [];
  let completed = 0;

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(q => answerQuestion(q.question, knowledgeBase, companyName)
        .then(result => ({ ...q, ...result }))
        .catch(err => ({
          ...q,
          answer: '[ERROR] Failed to generate answer - needs manual completion',
          confidence: 'LOW',
          needsReview: true,
          error: err.message,
        }))
      )
    );

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress({ completed, total: questions.length, percent: Math.round((completed / questions.length) * 100) });
    }

    // Brief pause between batches
    if (i + batchSize < questions.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

async function generateRebuttalletter(companyName, questionnaireSender, completedCount, flaggedCount) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Write a brief, professional cover note (3 short paragraphs) from ${companyName} to ${questionnaireSender} submitting a completed security questionnaire.
      Note that ${completedCount} questions are answered, and ${flaggedCount} items are flagged for follow-up discussion.
      Tone: confident, professional, cooperative. End with an offer to schedule a call for any clarifications.`,
    }],
  });
  return message.content[0].text;
}

module.exports = { processQuestionnaire, generateRebuttalletter, buildKnowledgeBase };
