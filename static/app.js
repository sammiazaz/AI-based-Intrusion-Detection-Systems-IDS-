/* ═══════════════════════════════════════════════════════════════════
   AstraGuard AI — Frontend Application Logic
   ═══════════════════════════════════════════════════════════════════ */

/* ── Config ──────────────────────────────────────────────────────── */
const BASE_URL = 'http://127.0.0.1:5000';   // Flask backend

/* ── State ───────────────────────────────────────────────────────── */
let trafficChart   = null;
let simInterval    = null;
let simRunning     = false;
let packetCount    = 0;
let threatCount    = 0;
let simStats       = { Normal: 0, DDoS: 0, 'Brute Force': 0, Malware: 0 };
let modelTrained   = false;

/* ── Routing / Navigation ─────────────────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const target = item.dataset.section;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    item.classList.add('active');
    document.getElementById('section-' + target).classList.add('active');
  });
});

/* ── Live Clock ──────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('clockTime').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('clockDate').textContent =
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
}

setInterval(updateClock, 1000);
updateClock();

/* ── Check Model Status on Load ──────────────────────────────────── */
async function fetchStatus() {
  try {
    const res  = await fetch(`${BASE_URL}/api/status`);
    const data = await res.json();
    modelTrained = data.trained;
    if (data.trained) {
      updateSidebarModelState(data.accuracy);
      document.getElementById('dashAccuracy').textContent = data.accuracy.toFixed(2) + '%';
    }
  } catch (_) { /* server might not be up yet */ }
}

fetchStatus();

/* ── Sidebar model state ─────────────────────────────────────────── */
function updateSidebarModelState(accuracy) {
  document.getElementById('sbModelStatus').textContent = 'TRAINED';
  document.getElementById('sbModelStatus').style.color = 'var(--success)';
  document.getElementById('sbAccuracy').textContent    = `Accuracy: ${accuracy.toFixed(2)}%`;
}

/* ── Data Source Logic ───────────────────────────────────────────── */
function toggleDataSource() {
  const source = document.querySelector('input[name="dataSource"]:checked').value;
  const simOptions = document.getElementById('simulated-options');
  const uploadOptions = document.getElementById('upload-options');
  const trainBtn = document.getElementById('trainBtn');
  const genStatus = document.getElementById('gen-status');

  if (source === 'simulated') {
    simOptions.style.display = 'block';
    uploadOptions.style.display = 'none';
    trainBtn.disabled = genStatus.style.display === 'none';
  } else {
    simOptions.style.display = 'none';
    uploadOptions.style.display = 'block';
    trainBtn.disabled = !document.getElementById('csvUpload').value;
  }
}

function generateSimulatedData() {
  trainModel();
}

document.addEventListener('DOMContentLoaded', () => {
  const csvUpload = document.getElementById('csvUpload');
  if (csvUpload) {
    csvUpload.addEventListener('change', () => {
      document.getElementById('trainBtn').disabled = !csvUpload.value;
    });
  }
});

/* ── Train Model ─────────────────────────────────────────────────── */
async function trainModel() {
  if (simRunning) { alert('Stop the simulation first before retraining.'); return; }

  const genBtn  = document.getElementById('genBtn');
  const prog    = document.getElementById('trainProgress');
  const results = document.getElementById('trainResults');

  genBtn.disabled  = true;
  const originalText = genBtn.textContent;
  genBtn.textContent = 'Training...';
  
  prog.style.display = 'flex';
  results.style.display = 'none';

  const steps = ['ps1','ps2','ps3','ps4'];
  const delays = [0, 600, 1400, 2600];

  steps.forEach((id, i) => {
    setTimeout(() => {
      document.getElementById(id).classList.add('active');
      if (i > 0) {
        document.getElementById(steps[i-1]).classList.remove('active');
        document.getElementById(steps[i-1]).classList.add('done');
      }
    }, delays[i]);
  });

  try {
    const res  = await fetch(`${BASE_URL}/api/train`, { method: 'POST' });
    const data = await res.json();

    // Mark last step done
    setTimeout(() => {
      document.getElementById('ps4').classList.remove('active');
      document.getElementById('ps4').classList.add('done');
    }, 3400);

    setTimeout(() => {
      prog.style.display  = 'none';
      results.style.display = 'flex';
      genBtn.disabled  = false;
      genBtn.textContent = 'Regenerate Dataset';

      // Accuracy ring animation
      const pct  = data.accuracy / 100;
      const circ = 314.16;
      const off  = circ - circ * pct;
      const el   = document.getElementById('accCircle');
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
      el.style.strokeDashoffset = off;

      // Count-up for accuracy number
      animateCountUp('accNum', 0, data.accuracy, 1200, '%');

      document.getElementById('accBadge').textContent   = '✓ Training Complete';
      document.getElementById('accSamples').textContent = `5,000 samples · 80/20 split`;

      // Metrics table
      const classes = ['Brute Force', 'DDoS', 'Malware', 'Normal'];
      const body    = document.getElementById('perfBody');
      body.innerHTML = '';
      classes.forEach(cls => {
        const m   = data.report[cls] || {};
        const badgeClass = cls === 'Normal' ? 'pred-normal'
          : cls === 'DDoS' ? 'pred-ddos'
          : cls === 'Brute Force' ? 'pred-brute'
          : 'pred-malware';

        body.insertAdjacentHTML('beforeend', `
          <tr>
            <td><span class="pred-badge ${badgeClass}">${cls}</span></td>
            <td>${fmt(m.precision)}</td>
            <td>${fmt(m.recall)}</td>
            <td>${fmt(m['f1-score'])}</td>
            <td>${m.support || '—'}</td>
          </tr>`);
      });

      // Update dashboard summary
      modelTrained = true;
      document.getElementById('dashAccuracy').textContent = data.accuracy.toFixed(2) + '%';
      updateSidebarModelState(data.accuracy);

      // Build traffic chart
      buildTrafficChart(data.label_counts);
    }, 3600);

  } catch (err) {
    genBtn.disabled = false;
    genBtn.textContent = 'Retry Training';
    prog.style.display = 'none';
    alert('Training failed: ' + err.message);
  }
}

function fmt(val) {
  return val !== undefined ? (parseFloat(val) * (val <= 1 ? 100 : 1)).toFixed(1) + '%' : '—';
}

/* ── Animated count-up ───────────────────────────────────────────── */
function animateCountUp(id, from, to, duration, suffix = '') {
  const el    = document.getElementById(id);
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = (from + (to - from) * ease).toFixed(2) + suffix;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Traffic Chart ───────────────────────────────────────────────── */
function buildTrafficChart(labelCounts) {
  const placeholder = document.getElementById('chartPlaceholder');
  placeholder.style.display = 'none';

  const ctx = document.getElementById('trafficChart').getContext('2d');

  if (trafficChart) { trafficChart.destroy(); }

  const labels = Object.keys(labelCounts);
  const values = Object.values(labelCounts);
  const colors = {
    'Normal':      'rgba(0,255,136,0.8)',
    'DDoS':        'rgba(255,61,87,0.8)',
    'Brute Force': 'rgba(255,185,70,0.8)',
    'Malware':     'rgba(199,125,255,0.8)'
  };

  trafficChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data:            values,
        backgroundColor: labels.map(l => colors[l] || '#888'),
        borderColor:     labels.map(l => (colors[l] || '#888').replace('0.8','1')),
        borderWidth:     2,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#6b7a9a',
            font: { size: 11, family: 'Inter' },
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10,16,32,0.95)',
          borderColor: 'rgba(0,212,255,0.2)',
          borderWidth: 1,
          titleColor: '#ccd8f0',
          bodyColor: '#6b7a9a',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} packets`
          }
        }
      },
      animation: { animateRotate: true, duration: 1000 }
    }
  });

  document.getElementById('chartBadge').textContent = 'TRAINED';
  document.getElementById('chartBadge').className   = 'badge badge-live';
}

/* ── Live Simulation ─────────────────────────────────────────────── */
function toggleSimulation() {
  if (!modelTrained) {
    alert('Please train the model first before running a simulation.\n\n→ Go to "Train Model" and click "Initialize Training".');
    return;
  }

  if (simRunning) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function startSimulation() {
  simRunning = true;
  const btn  = document.getElementById('simBtn');
  btn.textContent = '■ Stop Simulation';
  btn.classList.add('running');

  document.getElementById('logEmpty').style.display  = 'none';
  document.getElementById('logTable').style.display  = 'table';
  document.getElementById('alertsBadge').textContent = 'LIVE';
  document.getElementById('alertsBadge').className   = 'badge badge-live';
  document.getElementById('liveIndicator') && (document.getElementById('liveIndicator').textContent = 'LIVE');

  // Poll every 2 seconds
  simInterval = setInterval(fetchPacket, 2000);
  fetchPacket(); // immediate first call
}

function stopSimulation() {
  simRunning = false;
  clearInterval(simInterval);
  simInterval = null;

  const btn = document.getElementById('simBtn');
  btn.textContent = '▶ Start Simulation';
  btn.classList.remove('running');

  document.getElementById('alertsBadge').textContent = 'IDLE';
  document.getElementById('alertsBadge').className   = 'badge';

  setAlertDisplay(false, null);
}

async function fetchPacket() {
  try {
    const res  = await fetch(`${BASE_URL}/api/predict`);
    if (!res.ok) { stopSimulation(); alert('Model not trained.'); return; }
    const data = await res.json();

    packetCount++;
    simStats[data.prediction]++;

    if (data.is_threat) {
      threatCount++;
    }

    // Update alert display
    setAlertDisplay(data.is_threat, data.prediction);

    // Update stat pills
    document.getElementById('sNormal').textContent  = simStats['Normal'];
    document.getElementById('sDdos').textContent    = simStats['DDoS'];
    document.getElementById('sBrute').textContent   = simStats['Brute Force'];
    document.getElementById('sMalware').textContent = simStats['Malware'];

    // Update dashboard numbers
    document.getElementById('dashDetected').textContent = threatCount;
    updateThreatLevel();

    // Packet counter badge
    document.getElementById('packetCountBadge').textContent = `${packetCount} packet${packetCount !== 1 ? 's' : ''}`;

    // Add row to log table
    addLogRow(data);

    // Add to recent alerts list on dashboard (only threats + some normals for UX)
    if (data.is_threat || Math.random() < 0.3) {
      addAlertItem(data);
    }

  } catch (err) {
    console.error('Predict error:', err);
  }
}

/* Alert display */
function setAlertDisplay(isThreat, prediction) {
  const inner = document.getElementById('alertInner');
  const icon  = document.getElementById('alertIcon');
  const label = document.getElementById('alertLabel');
  const desc  = document.getElementById('alertDesc');

  if (isThreat && prediction) {
    inner.className = 'alert-inner threat';
    icon.textContent  = prediction === 'DDoS' ? '⚡' : prediction === 'Malware' ? '🦠' : '🔓';
    label.textContent = `🚨 ${prediction.toUpperCase()} DETECTED`;
    desc.textContent  = `Malicious activity identified — ${prediction} attack in progress`;
  } else {
    inner.className = 'alert-inner secure';
    icon.textContent  = '🛡️';
    label.textContent = 'SECURE';
    desc.textContent  = 'Network traffic normal — no threats detected';
  }
}

/* Threat level */
function updateThreatLevel() {
  const el    = document.getElementById('dashThreat');
  const ratio = packetCount > 0 ? threatCount / packetCount : 0;
  if (ratio < 0.2)       { el.textContent = 'LOW';      el.className = 'mc-value color-success'; }
  else if (ratio < 0.5)  { el.textContent = 'MEDIUM';   el.className = 'mc-value color-warning'; }
  else                   { el.textContent = 'HIGH';     el.className = 'mc-value color-danger'; }
}

/* Log row */
function addLogRow(data) {
  const body = document.getElementById('logBody');
  const cls  = predClass(data.prediction);
  const row  = document.createElement('tr');
  row.classList.add('new-row');
  row.innerHTML = `
    <td>${packetCount}</td>
    <td>${data.timestamp}</td>
    <td>${data.duration}</td>
    <td>${data.src_bytes.toLocaleString()}</td>
    <td>${data.dst_bytes.toLocaleString()}</td>
    <td>${data.conn_count}</td>
    <td><span class="pred-badge ${cls}">${data.prediction}</span></td>`;
  body.prepend(row);
  // Keep max 25 rows
  while (body.rows.length > 25) body.deleteRow(body.rows.length - 1);
}

/* Alert item */
function addAlertItem(data) {
  const list = document.getElementById('alertsList');
  const empty = list.querySelector('.empty-hint');
  if (empty) empty.remove();

  const cls  = data.is_threat ? 'is-threat' : 'is-normal';
  const dot  = data.is_threat ? 'var(--danger)' : 'var(--success)';
  const item = document.createElement('div');
  item.className = `alert-item ${cls}`;
  item.innerHTML = `
    <span class="alert-dot" style="background:${dot}"></span>
    <span>${data.prediction}</span>
    <span class="alert-ts">${data.timestamp}</span>`;
  list.prepend(item);
  while (list.children.length > 12) list.removeChild(list.lastChild);
}

/* Prediction CSS class */
function predClass(pred) {
  if (pred === 'Normal')      return 'pred-normal';
  if (pred === 'DDoS')        return 'pred-ddos';
  if (pred === 'Brute Force') return 'pred-brute';
  if (pred === 'Malware')     return 'pred-malware';
  return '';
}
