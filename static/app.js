/* ═══════════════════════════════════════════════════════════════════
   AstraGuard AI — Frontend Application Logic (Static Demo Version)
   ═══════════════════════════════════════════════════════════════════ */

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
  const clockTime = document.getElementById('clockTime');
  const clockDate = document.getElementById('clockDate');
  if (clockTime) clockTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (clockDate) {
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    clockDate.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
  }
}
setInterval(updateClock, 1000);
updateClock();

/* ── Sidebar model state ─────────────────────────────────────────── */
function updateSidebarModelState(accuracy) {
  const status = document.getElementById('sbModelStatus');
  const acc = document.getElementById('sbAccuracy');
  if (status) {
    status.textContent = 'TRAINED';
    status.style.color = 'var(--success)';
  }
  if (acc) acc.textContent = `Accuracy: ${accuracy.toFixed(2)}%`;
}

/* ── Data Source Logic ───────────────────────────────────────────── */
function toggleDataSource() {
  const source = document.querySelector('input[name="dataSource"]:checked').value;
  const simOptions = document.getElementById('simulated-options');
  const uploadOptions = document.getElementById('upload-options');
  const genStatus = document.getElementById('gen-status');

  if (source === 'simulated') {
    simOptions.style.display = 'block';
    uploadOptions.style.display = 'none';
  } else {
    simOptions.style.display = 'none';
    uploadOptions.style.display = 'block';
  }
}

function generateSimulatedData() {
  trainModel();
}

/* ── Train Model (Simulated) ─────────────────────────────────────── */
async function trainModel() {
  if (simRunning) { alert('Stop the simulation first before retraining.'); return; }

  const genBtn  = document.getElementById('genBtn');
  const prog    = document.getElementById('trainProgress');
  const results = document.getElementById('trainResults');

  genBtn.disabled  = true;
  genBtn.textContent = 'Training...';
  
  prog.style.display = 'flex';
  results.style.display = 'none';

  const steps = ['ps1','ps2','ps3','ps4'];
  const delays = [0, 800, 1800, 3000];

  steps.forEach((id, i) => {
    setTimeout(() => {
      document.getElementById(id).classList.add('active');
      if (i > 0) {
        document.getElementById(steps[i-1]).classList.remove('active');
        document.getElementById(steps[i-1]).classList.add('done');
      }
    }, delays[i]);
  });

  // Simulate API response delay
  setTimeout(() => {
    document.getElementById('ps4').classList.remove('active');
    document.getElementById('ps4').classList.add('done');

    prog.style.display  = 'none';
    results.style.display = 'flex';
    genBtn.disabled  = false;
    genBtn.textContent = 'Regenerate Dataset';

    const mockData = {
      accuracy: 99.82,
      label_counts: { 'Normal': 3240, 'DDoS': 842, 'Brute Force': 521, 'Malware': 397 },
      report: {
        'Normal':      { precision: 1.0, recall: 0.99, 'f1-score': 1.0, support: 3240 },
        'DDoS':        { precision: 0.99, recall: 1.0, 'f1-score': 1.0, support: 842 },
        'Brute Force': { precision: 1.0, recall: 0.98, 'f1-score': 0.99, support: 521 },
        'Malware':     { precision: 0.98, recall: 1.0, 'f1-score': 0.99, support: 397 }
      }
    };

    // Accuracy ring
    const pct  = mockData.accuracy / 100;
    const circ = 314.16;
    const off  = circ - circ * pct;
    const el   = document.getElementById('accCircle');
    if (el) {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
      el.style.strokeDashoffset = off;
    }

    animateCountUp('accNum', 0, mockData.accuracy, 1200, '%');
    document.getElementById('accBadge').textContent = '✓ Training Complete';
    document.getElementById('accSamples').textContent = `5,000 samples · 80/20 split`;

    // Metrics table
    const classes = ['Brute Force', 'DDoS', 'Malware', 'Normal'];
    const body    = document.getElementById('perfBody');
    body.innerHTML = '';
    classes.forEach(cls => {
      const m   = mockData.report[cls];
      const bc  = cls === 'Normal' ? 'pred-normal' : cls === 'DDoS' ? 'pred-ddos' : cls === 'Brute Force' ? 'pred-brute' : 'pred-malware';
      body.insertAdjacentHTML('beforeend', `<tr><td><span class="pred-badge ${bc}">${cls}</span></td><td>${fmt(m.precision)}</td><td>${fmt(m.recall)}</td><td>${fmt(m['f1-score'])}</td><td>${m.support}</td></tr>`);
    });

    modelTrained = true;
    document.getElementById('dashAccuracy').textContent = mockData.accuracy.toFixed(2) + '%';
    updateSidebarModelState(mockData.accuracy);
    buildTrafficChart(mockData.label_counts);

  }, 4000);
}

function fmt(val) { return (val * 100).toFixed(1) + '%'; }

function animateCountUp(id, from, to, duration, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
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
  if (placeholder) placeholder.style.display = 'none';

  const chartEl = document.getElementById('trafficChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');

  if (trafficChart) { trafficChart.destroy(); }

  const labels = Object.keys(labelCounts);
  const values = Object.values(labelCounts);
  const colors = { 'Normal': '#22c55e', 'DDoS': '#ef4444', 'Brute Force': '#f59e0b', 'Malware': '#a78bfa' };

  trafficChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(l => colors[l] || '#888'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { color: '#737373', font: { size: 10 }, usePointStyle: true } }
      }
    }
  });
  const b = document.getElementById('chartBadge');
  if (b) { b.textContent = 'TRAINED'; b.className = 'badge badge-live'; }
}

/* ── Live Simulation ─────────────────────────────────────────────── */
function toggleSimulation() {
  if (!modelTrained) { alert('Please train the model first.'); return; }
  simRunning ? stopSimulation() : startSimulation();
}

function startSimulation() {
  simRunning = true;
  const btn = document.getElementById('simBtn');
  btn.textContent = '■ Stop Simulation';
  btn.classList.add('running');
  document.getElementById('logEmpty').style.display = 'none';
  document.getElementById('logTable').style.display = 'table';
  const b = document.getElementById('alertsBadge');
  b.textContent = 'LIVE'; b.className = 'badge badge-live';
  simInterval = setInterval(simulatePacket, 1500);
}

function stopSimulation() {
  simRunning = false;
  clearInterval(simInterval);
  const btn = document.getElementById('simBtn');
  btn.textContent = '▶ Start Simulation';
  btn.classList.remove('running');
  const b = document.getElementById('alertsBadge');
  b.textContent = 'IDLE'; b.className = 'badge';
  setAlertDisplay(false, null);
}

function simulatePacket() {
  const types = ['Normal', 'Normal', 'Normal', 'DDoS', 'Brute Force', 'Malware', 'Normal'];
  const pred  = types[Math.floor(Math.random() * types.length)];
  const isThreat = pred !== 'Normal';
  
  const data = {
    prediction: pred,
    is_threat: isThreat,
    timestamp: new Date().toLocaleTimeString(),
    duration: (Math.random() * 0.5).toFixed(4),
    src_bytes: Math.floor(Math.random() * 5000),
    dst_bytes: Math.floor(Math.random() * 5000),
    conn_count: Math.floor(Math.random() * 100)
  };

  packetCount++;
  simStats[pred]++;
  if (isThreat) threatCount++;

  setAlertDisplay(isThreat, pred);
  document.getElementById('sNormal').textContent  = simStats['Normal'];
  document.getElementById('sDdos').textContent    = simStats['DDoS'];
  document.getElementById('sBrute').textContent   = simStats['Brute Force'];
  document.getElementById('sMalware').textContent = simStats['Malware'];
  document.getElementById('dashDetected').textContent = threatCount;
  updateThreatLevel();
  document.getElementById('packetCountBadge').textContent = `${packetCount} packets`;

  addLogRow(data);
  if (isThreat || Math.random() < 0.3) addAlertItem(data);
}

function setAlertDisplay(isT, p) {
  const inner = document.getElementById('alertInner');
  const label = document.getElementById('alertLabel');
  const icon  = document.getElementById('alertIcon');
  if (isT) {
    inner.className = 'alert-inner threat';
    icon.textContent = p === 'DDoS' ? '⚡' : p === 'Malware' ? '🦠' : '⚠️';
    label.textContent = `🚨 ${p.toUpperCase()} DETECTED`;
  } else {
    inner.className = 'alert-inner secure';
    icon.textContent = '🛡️';
    label.textContent = 'SECURE';
  }
}

function updateThreatLevel() {
  const el = document.getElementById('dashThreat');
  const ratio = packetCount > 0 ? threatCount / packetCount : 0;
  if (ratio < 0.1) { el.textContent = 'LOW'; el.className = 'mc-value color-success'; }
  else if (ratio < 0.3) { el.textContent = 'MED'; el.className = 'mc-value color-warning'; }
  else { el.textContent = 'HIGH'; el.className = 'mc-value color-danger'; }
}

function addLogRow(d) {
  const body = document.getElementById('logBody');
  const row = body.insertRow(0);
  row.className = 'new-row';
  const bc = d.prediction === 'Normal' ? 'pred-normal' : d.prediction === 'DDoS' ? 'pred-ddos' : d.prediction === 'Brute Force' ? 'pred-brute' : 'pred-malware';
  row.innerHTML = `<td>${packetCount}</td><td>${d.timestamp}</td><td>${d.duration}</td><td>${d.src_bytes}</td><td>${d.dst_bytes}</td><td>${d.conn_count}</td><td><span class="pred-badge ${bc}">${d.prediction}</span></td>`;
  if (body.rows.length > 15) body.deleteRow(15);
}

function addAlertItem(d) {
  const list = document.getElementById('alertsList');
  if (list.querySelector('.empty-hint')) list.innerHTML = '';
  const item = document.createElement('div');
  item.className = `alert-item ${d.is_threat ? 'is-threat' : 'is-normal'}`;
  item.innerHTML = `<span class="alert-dot"></span><span>${d.prediction}</span><span class="alert-ts">${d.timestamp}</span>`;
  list.prepend(item);
  if (list.children.length > 8) list.removeChild(list.lastChild);
}
