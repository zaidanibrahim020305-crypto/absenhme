console.log("MAIN JS LOADED");
// ============================================================
// DATA STORE
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKIY8dpENwuOCa5v1k-vNreFq3rztkz9k",
  authDomain: "hme24-79562.firebaseapp.com",
  databaseURL: "https://hme24-79562-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hme24-79562",
  storageBucket: "hme24-79562.firebasestorage.app",
  messagingSenderId: "879738852701",
  appId: "1:879738852701:web:f0aae0fdcfdcc61d15c4b4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.db = db;
window.firebaseRef = ref;
window.firebaseSet = set;
window.firebaseGet = get;
window.firebasePush = push;
window.firebaseUpdate = update;

const DB = {

  async getAbsen() {
    const snapshot = await get(ref(db, "absensi"));
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  },

  async addAbsen(record) {
    const newRef = push(ref(db, "absensi"));
    await set(newRef, record);
  },

  async getQRList() {
    const snapshot = await get(ref(db, "qr"));
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  },

  async addQR(qrData) {
    await set(ref(db, "qr/" + qrData.token), qrData);
  },

  async getQRByToken(token) {
    const snapshot = await get(ref(db, "qr/" + token));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  },

  async markQRUsed(token) {
    await update(ref(db, "qr/" + token), {
      used: true
    });
  },

  async markQRExpired(token) {
    await update(ref(db, "qr/" + token), {
      expired: true
    });
  }
};

window.showTab = showTab;
window.generateQR = generateQR;
window.downloadQR = downloadQR;
window.copyLink = copyLink;

window.filterRekap = filterRekap;
window.clearFilter = clearFilter;
window.exportExcel = exportExcel;

window.confirmReset = confirmReset;

window.showPhoto = showPhoto;
window.closePhotoModal = closePhotoModal;

window.submitAbsen = submitAbsen;
window.capturePhoto = capturePhoto;
window.retakePhoto = retakePhoto;
window.finalSubmit = finalSubmit;

// ============================================================
// ROUTING
// ============================================================
async function init() {

  const hash = window.location.hash;

  if (hash.startsWith('#absen/')) {

    const token = hash.replace('#absen/', '');

    document.getElementById('admin-wrap').style.display = 'none';
    document.getElementById('absen-page').style.display = 'flex';

    await startAbsenFlow(token);

  } else {

    document.getElementById('admin-wrap').style.display = 'block';
    document.getElementById('absen-page').style.display = 'none';

    await refreshDash();
    await updateSettingInfo();

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
window.showTab = function(t) {

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  const page = document.getElementById('tab-' + t);

  if (!page) {
    console.error('Tab tidak ditemukan:', t);
    return;
  }

  page.classList.add('active');

  const btn = document.querySelector(
    `.nav-tab[onclick="showTab('${t}')"]`
  );

  if (btn) {
    btn.classList.add('active');
  }

  if (t === 'rekap') renderRekap();
  if (t === 'dash') refreshDash();
  if (t === 'setting') updateSettingInfo();
};

// ============================================================
// GENERATE QR
// ============================================================
let countdownTimer = null;

function generateToken() {
  return 'QR' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function generateQR() {
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
  await DB.addQR(qrData);

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

async function renderQRHistory() {

  const list = await DB.getQRList();

  const tbody = document.getElementById('qr-history-tbody');

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3"
            style="text-align:center;
                   color:var(--text3);
                   padding:1rem;">
          Belum ada QR
        </td>
      </tr>
    `;
    return;
  }

  const sortedList = [...list]
    .sort((a, b) =>
      new Date(b.created) - new Date(a.created)
    )
    .slice(0, 10);

  tbody.innerHTML = sortedList.map(q => {

    let status = '';

    if (q.used) {
      status =
        '<span class="badge badge-green">✓ Dipakai</span>';
    }
    else if (q.expired) {
      status =
        '<span class="badge badge-red">✕ Expired</span>';
    }
    else {
      status =
        '<span class="badge badge-yellow">⏳ Aktif</span>';
    }

    return `
      <tr>
        <td style="font-size:13px;">
          ${q.kegiatan || '-'}
        </td>

        <td class="td-mono">
          ${
            q.created
            ? new Date(q.created)
                .toLocaleTimeString('id-ID')
            : '-'
          }
        </td>

        <td>
          ${status}
        </td>
      </tr>
    `;
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
async function refreshDash() {

  const today = new Date().toISOString().split('T')[0];

  const absen = await DB.getAbsen();
  const qrList = await DB.getQRList();

  const todayAbsen = absen.filter(a => a.tgl === today);

  // Statistik Dashboard
  document.getElementById('stat-hadir').textContent =
    todayAbsen.length;

  document.getElementById('stat-qr-aktif').textContent =
    qrList.filter(q => !q.used && !q.expired).length;

  document.getElementById('stat-qr-used').textContent =
    qrList.filter(q => q.used).length;

  document.getElementById('stat-qr-exp').textContent =
    qrList.filter(q => q.expired && !q.used).length;

  // Tabel Absensi Terbaru
  const tbody = document.getElementById('dash-tbody');

  const recent = [...absen]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  if (recent.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6"
            style="text-align:center;
                   color:var(--text3);
                   padding:2rem;">
          Belum ada data absensi
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent.map(r => `
    <tr>
      <td style="font-weight:500;">
        ${r.nama || '-'}
      </td>

      <td class="td-mono">
        ${r.nim || '-'}
      </td>

      <td class="td-mono">
        ${r.waktu || '-'}
      </td>

      <td style="font-size:12px;color:var(--text2);">
        ${
          r.lat && r.lng
          ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`
          : '—'
        }
      </td>

      <td>
        ${
          r.foto
          ? `<img
                src="${r.foto}"
                onclick="showPhoto('${r.foto}')"
                style="
                  width:36px;
                  height:36px;
                  object-fit:cover;
                  border-radius:6px;
                  cursor:pointer;
                  border:1px solid var(--border);
                ">`
          : '—'
        }
      </td>

      <td>
        <span class="badge badge-green">
          ✓ Hadir
        </span>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// REKAP
// ============================================================
async function renderRekap(data = null) {

  const absen = data || await DB.getAbsen();

  const tbody = document.getElementById('rekap-tbody');

  if (!absen || absen.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10"
            style="text-align:center;
                   color:var(--text3);
                   padding:2rem;">
          Belum ada data absensi
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = absen.map((r, i) => `
    <tr>

      <td class="td-mono">
        ${i + 1}
      </td>

      <td style="font-weight:500;">
        ${r.nama || '-'}
      </td>

      <td class="td-mono">
        ${r.nim || '-'}
      </td>

      <td style="font-size:13px;">
        ${r.kegiatan || '-'}
      </td>

      <td class="td-mono">
        ${r.tgl || '-'}
      </td>

      <td class="td-mono">
        ${r.waktu || '-'}
      </td>

      <td style="font-size:11px;color:var(--text2);">
        ${
          r.lat && r.lng
          ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`
          : '—'
        }
      </td>

      <td>
        ${
          r.foto
          ? `<img
              src="${r.foto}"
              onclick="showPhoto('${r.foto}')"
              style="
                width:36px;
                height:36px;
                object-fit:cover;
                border-radius:6px;
                cursor:pointer;
                border:1px solid var(--border);
              ">`
          : '—'
        }
      </td>

      <td class="td-mono" style="font-size:11px;">
        ${
          r.token
          ? r.token.substring(0,12) + '...'
          : '—'
        }
      </td>

      <td>
        <span class="badge badge-green">
          ✓ Hadir
        </span>
      </td>

    </tr>
  `).join('');
}

async function filterRekap() {

  const tgl =
    document.getElementById('filter-tgl').value;

  const q =
    document.getElementById('filter-q')
      .value.toLowerCase();

  let data = await DB.getAbsen();

  if (tgl)
    data = data.filter(r => r.tgl === tgl);

  if (q)
    data = data.filter(r =>
      r.nama.toLowerCase().includes(q) ||
      r.nim.toLowerCase().includes(q)
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
async function exportExcel() {

  const absen = await DB.getAbsen();

  if (!absen || absen.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

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

  ws['!cols'] = [
    {wch:4},
    {wch:22},
    {wch:14},
    {wch:24},
    {wch:12},
    {wch:14},
    {wch:12},
    {wch:12},
    {wch:20},
    {wch:8},
    {wch:22},
    {wch:28}
  ];

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    'Rekap Absensi'
  );

  const infoData = [
    ['REKAP ABSENSI PIKET HME'],
    [''],
    ['Sistem', 'Absensi Piket HME'],
    ['Diekspor Pada', new Date().toLocaleString('id-ID')],
    ['Total Record', absen.length]
  ];

  const wsInfo =
    XLSX.utils.aoa_to_sheet(infoData);

  XLSX.utils.book_append_sheet(
    wb,
    wsInfo,
    'Info Sistem'
  );

  const fileName =
    `Rekap_Absen_HME_${
      new Date().toISOString().split('T')[0]
    }.xlsx`;

  XLSX.writeFile(wb, fileName);
}

// ============================================================
// SETTING
// ============================================================
async function updateSettingInfo() {

  const absen =
    await DB.getAbsen();

  const qr =
    await DB.getQRList();

  document.getElementById(
    'info-total-absen'
  ).textContent = absen.length;

  document.getElementById(
    'info-total-qr'
  ).textContent = qr.length;
}

async function confirmReset() {

  const konfirmasi = confirm(
    '⚠️ PERHATIAN!\n\n' +
    'Semua data absensi dan QR akan dihapus permanen.\n' +
    'Tindakan ini tidak dapat dibatalkan.\n\n' +
    'Lanjutkan?'
  );

  if (!konfirmasi) return;

  const input = prompt(
    'Ketik HAPUS untuk konfirmasi:'
  );

  if (input !== 'HAPUS') {
    alert('Reset dibatalkan.');
    return;
  }

  try {

    await remove(ref(db, "absensi"));
    await remove(ref(db, "qr"));

    alert('Semua data berhasil dihapus.');

    await refreshDash();
    await renderQRHistory();
    await updateSettingInfo();

  } catch (err) {

    console.error(err);

    alert(
      'Gagal menghapus data Firebase.'
    );

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

async function startAbsenFlow(token) {
  showState('loading');

  const qr = await DB.getQRByToken(token);

  if (!qr) {
    showError(
      'QR Tidak Ditemukan',
      'QR code ini tidak terdaftar dalam sistem.'
    );
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

async function finalSubmit(skipPhoto) {

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

  await DB.addAbsen(record);

  await DB.markQRUsed(
    absenData.token
  );

  showState('success');

  document.getElementById(
    'success-msg'
  ).textContent =
    `${record.nama} — ${record.nim} berhasil absen pada ${record.waktu}`;
}

function showError(title, msg) {
  document.getElementById('err-title').textContent = title;
  document.getElementById('err-msg').textContent = msg;
  showState('error');
}

// ============================================================
// INIT
// ============================================================

