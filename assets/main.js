
// ============================================================
// DATA STORE
// ============================================================
const DB = {
  getAbsen: () => JSON.parse(localStorage.getItem('hme_absen') || '[]'),
  setAbsen: (d) => localStorage.setItem('hme_absen', JSON.stringify(d)),
  getQRList: () => JSON.parse(localStorage.getItem('hme_qr_list') || '[]'),
  setQRList: (d) => localStorage.setItem('hme_qr_list', JSON.stringify(d)),
  addAbsen: (rec) => {
    const d = DB.getAbsen();
    d.push(rec);
    DB.setAbsen(d);
  },
  addQR: (qr) => {
    const d = DB.getQRList();
    d.push(qr);
    DB.setQRList(d);
  },
  markQRUsed: (token) => {
    const d = DB.getQRList();
    const q = d.find(x => x.token === token);
    if (q) { q.used = true; DB.setQRList(d); }
  },
  markQRExpired: (token) => {
    const d = DB.getQRList();
    const q = d.find(x => x.token === token);
    if (q && !q.used) { q.expired = true; DB.setQRList(d); }
  },
  getQRByToken: (token) => DB.getQRList().find(x => x.token === token)
};

// ============================================================
// ROUTING
// ============================================================
function init() {
  const hash = window.location.hash;
  if (hash.startsWith('#absen/')) {
    const token = hash.replace('#absen/', '');
    document.getElementById('admin-wrap').style.display = 'none';
    document.getElementById('absen-page').style.display = 'flex';
    startAbsenFlow(token);
  } else {
    document.getElementById('admin-wrap').style.display = 'block';
    document.getElementById('absen-page').style.display = 'none';
    refreshDash();
    updateSettingInfo();
    setTodayDate();
  }
}

function setTodayDate() {
  const today = new Date();
  document.getElementById('gen-tanggal').value = today.toISOString().split('T')[0];
  document.getElementById('dash-date').textContent = today.toLocaleDateString('id-ID', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

window.addEventListener('hashchange', init);
window.addEventListener('load', init);

// ============================================================
// ADMIN TABS
// ============================================================
function showTab(t) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  event.currentTarget.classList.add('active');
  if (t === 'rekap') renderRekap();
  if (t === 'dash') refreshDash();
  if (t === 'setting') updateSettingInfo();
}

// ============================================================
// GENERATE QR
// ============================================================
let countdownTimer = null;

function generateToken() {
  return 'QR' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateQR() {
  const kegiatan = document.getElementById('gen-nama-kegiatan').value.trim();
  const tgl = document.getElementById('gen-tanggal').value;
  const durasi = parseInt(document.getElementById('gen-durasi').value) || 15;
  const lat = parseFloat(document.getElementById('gen-lat').value);
  const lng = parseFloat(document.getElementById('gen-lng').value);
  const radius = parseInt(document.getElementById('gen-radius').value) || 100;

  if (!kegiatan || !tgl) {
    alert('Harap isi nama kegiatan dan tanggal!');
    return;
  }

  const token = generateToken();
  const baseURL = window.location.href.split('#')[0];
  const link = `${baseURL}#absen/${token}`;

  const qrData = {
    token, kegiatan, tgl, durasi, lat, lng, radius,
    created: new Date().toISOString(),
    used: false, expired: false
  };
  DB.addQR(qrData);

  // Render QR
  const box = document.getElementById('qrcode-box');
  box.innerHTML = '';
  new QRCode(box, {
    text: link,
    width: 160, height: 160,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('gen-link-text').textContent = link;
  document.getElementById('qr-output').style.display = 'flex';
  document.getElementById('gen-status-badge').className = 'badge badge-yellow';
  document.getElementById('gen-status-badge').textContent = '⏳ Aktif';

  // Countdown
  if (countdownTimer) clearInterval(countdownTimer);
  let rem = durasi;
  const fill = document.getElementById('countdown-fill');
  const num = document.getElementById('countdown-num');
  num.textContent = rem;
  fill.style.width = '100%';

  countdownTimer = setInterval(() => {
    rem--;
    num.textContent = rem;
    fill.style.width = ((rem / durasi) * 100) + '%';
    if (rem <= 0) {
      clearInterval(countdownTimer);
      DB.markQRExpired(token);
      document.getElementById('gen-status-badge').className = 'badge badge-red';
      document.getElementById('gen-status-badge').textContent = '✕ Kedaluwarsa';
      num.textContent = '0';
      fill.style.width = '0%';
    }
  }, 1000);

  renderQRHistory();
  refreshDash();
}

function renderQRHistory() {
  const list = DB.getQRList().slice().reverse();
  const tbody = document.getElementById('qr-history-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text3); padding:1rem;">Belum ada QR</td></tr>';
    return;
  }
  tbody.innerHTML = list.slice(0, 10).map(q => {
    const st = q.used ? '<span class="badge badge-green">✓ Dipakai</span>'
      : q.expired ? '<span class="badge badge-red">✕ Expired</span>'
      : '<span class="badge badge-yellow">⏳ Aktif</span>';
    return `<tr>
      <td style="font-size:13px;">${q.kegiatan}</td>
      <td class="td-mono">${new Date(q.created).toLocaleTimeString('id-ID')}</td>
      <td>${st}</td>
    </tr>`;
  }).join('');
}

function downloadQR() {
  const canvas = document.querySelector('#qrcode-box canvas');
  if (!canvas) { alert('QR belum dihasilkan'); return; }
  const a = document.createElement('a');
  a.download = 'qr-absen-hme.png';
  a.href = canvas.toDataURL();
  a.click();
}

function copyLink() {
  const link = document.getElementById('gen-link-text').textContent;
  navigator.clipboard.writeText(link).then(() => alert('Link berhasil disalin!'));
}

// ============================================================
// DASHBOARD
// ============================================================
function refreshDash() {
  const today = new Date().toISOString().split('T')[0];
  const absen = DB.getAbsen();
  const qrList = DB.getQRList();
  const todayAbsen = absen.filter(a => a.tgl === today);

  document.getElementById('stat-hadir').textContent = todayAbsen.length;
  document.getElementById('stat-qr-aktif').textContent = qrList.filter(q => !q.used && !q.expired).length;
  document.getElementById('stat-qr-used').textContent = qrList.filter(q => q.used).length;
  document.getElementById('stat-qr-exp').textContent = qrList.filter(q => q.expired && !q.used).length;

  const tbody = document.getElementById('dash-tbody');
  const recent = absen.slice().reverse().slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data absensi</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(r => `
    <tr>
      <td style="font-weight:500;">${r.nama}</td>
      <td class="td-mono">${r.nim}</td>
      <td class="td-mono">${r.waktu}</td>
      <td style="font-size:12px; color:var(--text2);">${r.lat ? r.lat.toFixed(4)+', '+r.lng.toFixed(4) : '—'}</td>
      <td>${r.foto ? `<img src="${r.foto}" onclick="showPhoto('${r.foto}')" style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border);">` : '—'}</td>
      <td><span class="badge badge-green">✓ Hadir</span></td>
    </tr>`).join('');
}

// ============================================================
// REKAP
// ============================================================
function renderRekap(data) {
  const absen = data || DB.getAbsen();
  const tbody = document.getElementById('rekap-tbody');
  if (!absen.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text3); padding:2rem;">Belum ada data absensi</td></tr>';
    return;
  }
  tbody.innerHTML = absen.map((r, i) => `
    <tr>
      <td class="td-mono">${i + 1}</td>
      <td style="font-weight:500;">${r.nama}</td>
      <td class="td-mono">${r.nim}</td>
      <td style="font-size:13px;">${r.kegiatan || '—'}</td>
      <td class="td-mono">${r.tgl}</td>
      <td class="td-mono">${r.waktu}</td>
      <td style="font-size:11px; color:var(--text2);">${r.lat ? r.lat.toFixed(5)+', '+r.lng.toFixed(5) : '—'}</td>
      <td>${r.foto ? `<img src="${r.foto}" onclick="showPhoto('${r.foto}')" style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border);">` : '—'}</td>
      <td class="td-mono" style="font-size:11px;">${r.token ? r.token.substring(0,12)+'...' : '—'}</td>
      <td><span class="badge badge-green">✓ Hadir</span></td>
    </tr>`).join('');
}

function filterRekap() {
  const tgl = document.getElementById('filter-tgl').value;
  const q = document.getElementById('filter-q').value.toLowerCase();
  let data = DB.getAbsen();
  if (tgl) data = data.filter(r => r.tgl === tgl);
  if (q) data = data.filter(r =>
    r.nama.toLowerCase().includes(q) || r.nim.toLowerCase().includes(q)
  );
  renderRekap(data);
}

function clearFilter() {
  document.getElementById('filter-tgl').value = '';
  document.getElementById('filter-q').value = '';
  renderRekap();
}

// ============================================================
// EXPORT EXCEL
// ============================================================
function exportExcel() {
  const absen = DB.getAbsen();
  if (!absen.length) { alert('Tidak ada data untuk diekspor.'); return; }

  const rows = absen.map((r, i) => ({
    'No': i + 1,
    'Nama Lengkap': r.nama,
    'NIM': r.nim,
    'Kegiatan': r.kegiatan || '',
    'Tanggal': r.tgl,
    'Waktu Submit': r.waktu,
    'Latitude': r.lat || '',
    'Longitude': r.lng || '',
    'QR Token': r.token || '',
    'Status': 'Hadir',
    'Sistem': 'Absensi Piket HME',
    'Pembuat Sistem': 'HME — Himpunan Mahasiswa Elektro'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Lock columns width
  ws['!cols'] = [
    {wch:4},{wch:22},{wch:14},{wch:24},{wch:12},{wch:14},
    {wch:12},{wch:12},{wch:20},{wch:8},{wch:22},{wch:28}
  ];

  // Style header
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1a2235' } } };
  }

  // Protect sheet (read-only)
  ws['!protect'] = { sheet: true, password: 'hme2024', objects: true, scenarios: true };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

  // Info sheet
  const infoData = [
    ['REKAP ABSENSI PIKET HME', ''],
    ['Sistem', 'Absensi Piket HME v1.0.0'],
    ['Pembuat Sistem', 'HME — Himpunan Mahasiswa Elektro'],
    ['Diekspor Pada', new Date().toLocaleString('id-ID')],
    ['Total Record', absen.length],
    ['', ''],
    ['CATATAN', 'Data ini bersifat read-only dan tidak dapat dimodifikasi. Setiap perubahan data akan diketahui dan dapat dilacak.']
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{wch:20},{wch:60}];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Info Sistem');

  const fname = `Rekap_Absen_HME_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ============================================================
// SETTING
// ============================================================
function updateSettingInfo() {
  document.getElementById('info-total-absen').textContent = DB.getAbsen().length;
  document.getElementById('info-total-qr').textContent = DB.getQRList().length;
}

function confirmReset() {
  if (confirm('⚠️ PERHATIAN!\n\nSemua data absensi dan QR akan dihapus permanen.\nTindakan ini TIDAK DAPAT dibatalkan.\n\nKetik "HAPUS" untuk konfirmasi')) {
    const input = prompt('Ketik HAPUS untuk konfirmasi:');
    if (input === 'HAPUS') {
      localStorage.removeItem('hme_absen');
      localStorage.removeItem('hme_qr_list');
      alert('Semua data telah dihapus.');
      refreshDash();
      updateSettingInfo();
      renderQRHistory();
    } else {
      alert('Reset dibatalkan.');
    }
  }
}

// ============================================================
// PHOTO MODAL
// ============================================================
function showPhoto(src) {
  document.getElementById('modal-photo').src = src;
  document.getElementById('photo-modal').classList.add('open');
}
function closePhotoModal() {
  document.getElementById('photo-modal').classList.remove('open');
}

// ============================================================
// ABSEN FLOW (mahasiswa)
// ============================================================
let absenData = {};
let absenTimerHandle = null;
let photoDataURL = null;
let locationValid = false;
let userLat = null;
let userLng = null;

function showState(s) {
  ['loading','error','form','camera','success'].forEach(id => {
    const el = document.getElementById('state-' + id);
    if (el) el.style.display = id === s ? 'block' : 'none';
  });
}

function startAbsenFlow(token) {
  showState('loading');
  const qr = DB.getQRByToken(token);

  if (!qr) {
    showError('QR Tidak Ditemukan', 'QR code ini tidak terdaftar dalam sistem.');
    return;
  }
  if (qr.used) {
    showError('QR Sudah Digunakan', 'QR code ini sudah pernah digunakan sebelumnya dan tidak dapat dipakai lagi.');
    return;
  }
  if (qr.expired) {
    showError('QR Kedaluwarsa', 'Batas waktu QR code ini telah habis. Minta QR baru kepada panitia.');
    return;
  }

  // Check if token expired by time
  const created = new Date(qr.created).getTime();
  const now = Date.now();
  const elapsed = (now - created) / 1000;
  if (elapsed > qr.durasi) {
    DB.markQRExpired(token);
    showError('QR Kedaluwarsa', `Link ini hanya berlaku ${qr.durasi} detik. Minta QR baru kepada panitia.`);
    return;
  }

  absenData = { ...qr, token };
  const remaining = Math.ceil(qr.durasi - elapsed);
  startAbsenTimer(remaining, qr.durasi);
}

function startAbsenTimer(rem, total) {
  showState('form');
  document.getElementById('absen-kegiatan-label').textContent = `Kegiatan: ${absenData.kegiatan} — ${absenData.tgl}`;

  const numEl = document.getElementById('absen-countdown');
  const fillEl = document.getElementById('absen-timer-fill');
  numEl.textContent = rem;
  fillEl.style.width = ((rem / total) * 100) + '%';

  // Check location
  checkLocation();

  absenTimerHandle = setInterval(() => {
    rem--;
    numEl.textContent = rem;
    fillEl.style.width = ((rem / total) * 100) + '%';
    if (rem <= 5) numEl.style.color = 'var(--red)';
    if (rem <= 0) {
      clearInterval(absenTimerHandle);
      DB.markQRExpired(absenData.token);
      showError('Waktu Habis', 'Batas waktu pengisian telah habis. Minta QR baru kepada panitia.');
    }
  }, 1000);
}

function checkLocation() {
  const dot = document.getElementById('loc-dot');
  const txt = document.getElementById('loc-text');
  dot.className = 'loc-dot';
  txt.textContent = 'Memeriksa lokasi GPS...';

  if (!navigator.geolocation) {
    dot.className = 'loc-dot red';
    txt.textContent = 'GPS tidak tersedia di browser ini';
    locationValid = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    const dist = getDistance(userLat, userLng, absenData.lat, absenData.lng);

    if (dist <= absenData.radius) {
      locationValid = true;
      dot.className = 'loc-dot green';
      txt.textContent = `✓ Dalam kawasan Camp Elektro (${Math.round(dist)}m dari pusat)`;
      document.getElementById('btn-submit').disabled = false;
    } else {
      locationValid = false;
      dot.className = 'loc-dot red';
      txt.textContent = `✗ Di luar kawasan (${Math.round(dist)}m, batas ${absenData.radius}m)`;
      document.getElementById('btn-submit').disabled = true;
    }
  }, err => {
    dot.className = 'loc-dot red';
    txt.textContent = 'Gagal mendapatkan lokasi. Izinkan akses GPS.';
    locationValid = false;
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function submitAbsen() {
  const nama = document.getElementById('form-nama').value.trim();
  const nim = document.getElementById('form-nim').value.trim();

  if (!nama || !nim) {
    alert('Harap isi nama dan NIM!');
    return;
  }
  if (!locationValid) {
    alert('Lokasi Anda tidak berada dalam kawasan Camp Elektro!');
    return;
  }

  clearInterval(absenTimerHandle);

  // Save partial data
  absenData._formNama = nama;
  absenData._formNim = nim;

  // Open camera
  showState('camera');
  openCamera();
}

function openCamera() {
  const video = document.getElementById('video-el');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(stream => {
      video.srcObject = stream;
      video.style.display = 'block';
      document.getElementById('photo-preview').style.display = 'none';
    })
    .catch(err => {
      // Camera failed, still save without photo
      finalSubmit(true);
    });
}

function capturePhoto() {
  const video = document.getElementById('video-el');
  const canvas = document.getElementById('canvas-el');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d').drawImage(video, 0, 0);
  photoDataURL = canvas.toDataURL('image/jpeg', 0.7);

  // Stop stream
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());

  video.style.display = 'none';
  const preview = document.getElementById('photo-preview');
  preview.src = photoDataURL;
  preview.style.display = 'block';

  document.getElementById('camera-btns').style.display = 'none';
  document.getElementById('confirm-btns').style.display = 'flex';
}

function retakePhoto() {
  photoDataURL = null;
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('confirm-btns').style.display = 'none';
  document.getElementById('camera-btns').style.display = 'flex';
  openCamera();
}

function finalSubmit(skipPhoto) {
  const now = new Date();
  const record = {
    nama: absenData._formNama,
    nim: absenData._formNim,
    kegiatan: absenData.kegiatan,
    tgl: absenData.tgl,
    waktu: now.toLocaleTimeString('id-ID'),
    lat: userLat,
    lng: userLng,
    foto: skipPhoto ? null : photoDataURL,
    token: absenData.token,
    createdAt: now.toISOString()
  };

  DB.addAbsen(record);
  DB.markQRUsed(absenData.token);

  // Show success
  showState('success');
  document.getElementById('success-msg').textContent =
    `${record.nama} — ${record.nim} berhasil absen pada ${record.waktu}`;

  if (record.foto) {
    const ph = document.getElementById('success-photo');
    ph.src = record.foto;
    ph.style.display = 'block';
  }
}

function showError(title, msg) {
  document.getElementById('err-title').textContent = title;
  document.getElementById('err-msg').textContent = msg;
  showState('error');
}

// ============================================================
// INIT
// ============================================================
init();
