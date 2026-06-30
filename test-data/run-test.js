const fs = require('fs');
const path = require('path');
const { Blob } = require('buffer');

function fileBlob(filePath, type) {
  return new Blob([fs.readFileSync(filePath)], { type });
}

async function runTest() {
  const token = process.env.QUESTFORGE_OPERATOR_TOKEN || process.argv[2];
  if (!token) {
    throw new Error('Set QUESTFORGE_OPERATOR_TOKEN or pass the operator token as the first argument.');
  }

  const form = new FormData();
  form.append('companyName', 'Acme Cloud Technologies');
  form.append('senderName', 'Enterprise Corp');
  form.append(
    'questionnaire',
    fileBlob(path.join(__dirname, 'sample-questionnaire.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'sample-questionnaire.xlsx'
  );
  form.append(
    'documents',
    fileBlob(path.join(__dirname, 'sample-security-doc.txt'), 'text/plain'),
    'sample-security-doc.txt'
  );

  console.log('Submitting to QuestForgeAI...');

  const submitRes = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    headers: { 'x-questforge-token': token },
    body: form,
  });

  const { jobId, error } = await submitRes.json();
  if (error) {
    console.error('Submit error:', error);
    return;
  }

  console.log('Job started:', jobId);

  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`http://localhost:3000/api/status/${jobId}`, {
      headers: { 'x-questforge-token': token },
    });
    const status = await statusRes.json();
    console.log(`[${status.percent || 0}%] ${status.stage}`);

    if (status.done) {
      done = true;
      console.log('\n=== COMPLETE ===');
      console.log('Report:', JSON.stringify(status.report, null, 2));
      console.log('Files:', JSON.stringify(status.files, null, 2));
      console.log('\nCover Letter:\n' + status.coverLetter);
    }
    if (status.error) {
      done = true;
      console.error('ERROR:', status.error);
    }
  }
}

runTest().catch(console.error);
