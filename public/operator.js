const params = new URLSearchParams(window.location.search);
const tokenFromUrl = params.get('token');
if (tokenFromUrl) {
  sessionStorage.setItem('questforgeOperatorToken', tokenFromUrl);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const operatorToken = tokenFromUrl || sessionStorage.getItem('questforgeOperatorToken') || '';
const uploadForm = document.getElementById('uploadForm');
const qFile = document.getElementById('qFile');
const docsFiles = document.getElementById('docsFiles');
const qFileList = document.getElementById('qFileList');
const docsFileList = document.getElementById('docsFileList');
const submitBtn = document.getElementById('submitBtn');
const progressSection = document.getElementById('progressSection');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const resultGrid = document.getElementById('resultGrid');
const downloadLinks = document.getElementById('downloadLinks');
const flaggedList = document.getElementById('flaggedList');
const coverLetterText = document.getElementById('coverLetterText');
const errorBox = document.getElementById('errorBox');
const tokenState = document.getElementById('tokenState');

if (tokenState) {
  tokenState.textContent = operatorToken ? 'Token active' : 'Token missing';
  tokenState.className = `status-pill ${operatorToken ? 'green' : 'amber'}`;
}

function authHeaders() {
  return operatorToken ? { 'x-questforge-token': operatorToken } : {};
}

function setFilesLabel(target, files) {
  if (!files || files.length === 0) {
    target.textContent = 'No file selected';
    return;
  }

  target.textContent = Array.from(files).map(file => file.name).join(', ');
}

function showError(message) {
  errorBox.style.display = 'block';
  errorBox.textContent = `Error: ${message}`;
  submitBtn.disabled = false;
}

function clearError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

function setProgress(label, percent) {
  progressSection.style.display = 'block';
  progressLabel.textContent = label || 'Processing';
  progressPercent.textContent = `${percent || 0}%`;
  progressBar.style.width = `${percent || 0}%`;
}

function makeStat(value, label) {
  const stat = document.createElement('div');
  stat.className = 'result-stat';

  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;

  stat.append(strong, span);
  return stat;
}

function addDownloadButton(label, url) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl-btn';
  button.textContent = label;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await downloadFile(url);
    } catch (err) {
      showError(err.message);
    } finally {
      button.disabled = false;
    }
  });
  downloadLinks.appendChild(button);
}

async function downloadFile(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const message = await res.text().catch(() => 'Download failed');
    throw new Error(message || 'Download failed');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match ? match[1] : url.split('/').pop();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function renderFlaggedItems(items = []) {
  flaggedList.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No items were flagged in the generated report.';
    flaggedList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'review-item';
    const title = document.createElement('strong');
    title.textContent = `${item.id}: ${item.question}`;
    const reason = document.createElement('span');
    reason.textContent = item.reason;
    row.append(title, reason);
    flaggedList.appendChild(row);
  });
}

function showResults(status) {
  const report = status.report || {};
  resultGrid.innerHTML = '';
  resultGrid.append(
    makeStat(report.total ?? 0, 'Total questions'),
    makeStat(`${report.readyPercent ?? 0}%`, 'Draft-ready'),
    makeStat(report.needsReview ?? 0, 'Need review')
  );
  resultGrid.style.display = 'grid';

  downloadLinks.innerHTML = '';
  if (status.files?.summary) addDownloadButton('Download report', status.files.summary);
  if (status.files?.completedQ) addDownloadButton('Download questionnaire', status.files.completedQ);

  coverLetterText.textContent = status.coverLetter || 'No cover note returned.';
  renderFlaggedItems(status.flaggedItems || []);
}

async function pollStatus(jobId) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${jobId}`, { headers: authHeaders() });
      const status = await res.json();
      setProgress(status.stage || 'Processing', status.percent || 0);

      if (status.done) {
        clearInterval(interval);
        setProgress('Complete. Run mandatory QA before delivery.', 100);
        submitBtn.disabled = false;
        showResults(status);
      }

      if (status.error) {
        clearInterval(interval);
        showError(status.error);
      }
    } catch (err) {
      clearInterval(interval);
      showError('Lost connection to server. Refresh and check the job folder before retrying.');
    }
  }, 1500);
}

function wireUploadZone(zoneId, input) {
  const zone = document.getElementById(zoneId);

  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('drag');
    input.files = event.dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
}

qFile.addEventListener('change', event => setFilesLabel(qFileList, event.target.files));
docsFiles.addEventListener('change', event => setFilesLabel(docsFileList, event.target.files));
wireUploadZone('qZone', qFile);
wireUploadZone('docsZone', docsFiles);

uploadForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();

  if (!operatorToken) {
    showError('Operator token missing. Open /app?token=YOUR_TOKEN once to activate this console.');
    return;
  }

  if (!qFile.files[0] || docsFiles.files.length === 0) {
    showError('Upload one questionnaire and at least one supporting document.');
    return;
  }

  const formData = new FormData();
  formData.append('companyName', document.getElementById('companyName').value.trim());
  formData.append('senderName', document.getElementById('senderName').value.trim() || 'the prospect');
  formData.append('questionnaire', qFile.files[0]);
  Array.from(docsFiles.files).forEach(file => formData.append('documents', file));

  submitBtn.disabled = true;
  resultGrid.style.display = 'none';
  downloadLinks.innerHTML = '';
  renderFlaggedItems([]);
  coverLetterText.textContent = 'Cover note will appear after processing.';
  setProgress('Uploading files', 3);

  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    pollStatus(data.jobId);
  } catch (err) {
    showError(err.message);
  }
});
