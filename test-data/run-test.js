const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function runTest() {
  const form = new FormData();

  form.append('companyName', 'Acme Cloud Technologies');
  form.append('senderName', 'Enterprise Corp');
  form.append('questionnaire', fs.createReadStream(path.join(__dirname, 'sample-questionnaire.xlsx')), 'sample-questionnaire.xlsx');
  form.append('documents', fs.createReadStream(path.join(__dirname, 'sample-security-doc.txt')), 'sample-security-doc.txt');

  console.log('Submitting to QuestForge...');

  const submitRes = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    body: form,
  });

  const { jobId, error } = await submitRes.json();
  if (error) { console.error('Submit error:', error); return; }

  console.log('Job started:', jobId);

  // Poll for status
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`http://localhost:3000/api/status/${jobId}`);
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
