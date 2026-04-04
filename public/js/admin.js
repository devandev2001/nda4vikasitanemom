/* =========================================================
   VIKASITA NEMOM – Admin Panel JS
   ========================================================= */

// ── Firebase config (client-side — safe to expose) ──
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

const firebaseApp = initializeApp({
  apiKey:            "AIzaSyAEdDwXotDoLyJNNXyYQ4y8yY1jGxkJCzs",
  authDomain:        "nda4vikasitanemom.firebaseapp.com",
  projectId:         "nda4vikasitanemom",
  storageBucket:     "nda4vikasitanemom.firebasestorage.app",
  messagingSenderId: "851294523572",
  appId:             "1:851294523572:web:3dc9001738c2d415a107e1"
});
const storage = getStorage(firebaseApp);

// ── Upload large file directly to Firebase Storage from browser ──
function uploadToFirebaseDirect(file, folder, progressFillId, progressTextId, progressWrapId) {
  return new Promise((resolve, reject) => {
    const wrap = progressWrapId ? document.getElementById(progressWrapId) : null;
    const fill = progressFillId ? document.getElementById(progressFillId) : null;
    const text = progressTextId ? document.getElementById(progressTextId) : null;
    if (wrap) wrap.style.display = 'block';

    const ext      = file.name.split('.').pop().toLowerCase();
    const filename = `${folder}/${Date.now()}-${Math.round(Math.random()*1e6)}.${ext}`;
    const storageRef = ref(storage, filename);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

    task.on('state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `Uploading… ${pct}%`;
      },
      (err) => {
        if (wrap) wrap.style.display = 'none';
        reject({ message: err.message });
      },
      async () => {
        if (wrap) wrap.style.display = 'none';
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// ── Tell server to save the Firebase URL to Firestore ──
async function saveUrlToServer(endpoint, fieldName, url) {
  const res = await authFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, fieldName })
  });
  return res.json();
}

// ── Toast Notification ──
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
  toast.innerHTML = `<i class="fa ${icons[type] || 'fa-circle-info'}" style="color:${type==='success'?'#22c55e':type==='error'?'#ef4444':'#FFB700'}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ── Sidebar nav active ──
document.querySelectorAll('.nav-link[data-section]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = document.getElementById(link.dataset.section);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── File input display helpers ──
function wireFileInput(inputId, fileNameId, dropZoneId) {
  const input = document.getElementById(inputId);
  const nameEl = document.getElementById(fileNameId);
  const zone = document.getElementById(dropZoneId);
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files[0]) nameEl.textContent = input.files[0].name;
  });
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      input.files = e.dataTransfer.files;
      nameEl.textContent = e.dataTransfer.files[0].name;
    }
  });
}
wireFileInput('videoFileInput', 'videoFileName', 'videoDropZone');
wireFileInput('audioFileInput', 'audioFileName', 'audioDropZone');
wireFileInput('logoFileInput', 'logoFileName', 'logoDropZone');
wireFileInput('pdfFileInput', 'pdfFileName', 'pdfDropZone');

// ── XHR upload with progress ──
function uploadWithProgress(url, formData, progressFillId, progressTextId, progressWrapId) {
  return new Promise((resolve, reject) => {
    const wrap = progressWrapId ? document.getElementById(progressWrapId) : null;
    const fill = progressFillId ? document.getElementById(progressFillId) : null;
    const text = progressTextId ? document.getElementById(progressTextId) : null;
    if (wrap) wrap.style.display = 'block';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;                           // ← send session cookie
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `Uploading… ${pct}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (wrap) wrap.style.display = 'none';
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({}); }
      } else {
        try { reject(JSON.parse(xhr.responseText)); }
        catch { reject({ message: 'Upload failed' }); }
      }
    });
    xhr.addEventListener('error', () => { if (wrap) wrap.style.display = 'none'; reject({ message: 'Network error' }); });
    xhr.send(formData);
  });
}

// ── Authenticated fetch helper ──
async function authFetch(url, options = {}) {
  options.credentials = options.credentials || 'same-origin'; // Ensure credentials are included
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    throw new Error('Session expired. Please login again.');
  }
  return res;
}

// ── Load existing content into forms ──
async function loadContent() {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();

    // Texts
    setVal('bannerHeadline', data.bannerHeadline);
    setVal('bannerSubtext', data.bannerSubtext);
    setVal('manifestoTitle', data.manifestoTitle);
    setVal('manifestoSub', data.manifestoSub);
    setVal('manifestoCtaText', data.manifestoCtaText);
    setVal('aboutTitle', data.aboutTitle);
    setVal('aboutText', data.aboutText);
    setVal('footerAboutText', data.footerAboutText);

    // Social
    if (data.socialLinks) {
      setVal('socialFacebook', data.socialLinks.facebook);
      setVal('socialTwitter', data.socialLinks.twitter);
      setVal('socialYoutube', data.socialLinks.youtube);
      setVal('socialInstagram', data.socialLinks.instagram);
    }

    // Current video
    if (data.bannerVideoUrl) {
      const wrap = document.getElementById('currentVideoWrap');
      const vid = document.getElementById('currentVideoPreview');
      const name = document.getElementById('currentVideoName');
      if (wrap) wrap.style.display = 'block';
      if (vid) vid.src = data.bannerVideoUrl;
      if (name) name.textContent = data.bannerVideoUrl.split('/').pop();
    }

    // Current audio
    if (data.bgAudioUrl) {
      const wrap = document.getElementById('currentAudioWrap');
      const aud  = document.getElementById('currentAudioPreview');
      const name = document.getElementById('currentAudioName');
      if (wrap) wrap.style.display = 'block';
      if (aud)  aud.src = data.bgAudioUrl;
      if (name) name.textContent = data.bgAudioUrl.split('/').pop();
    }

    // Current logo
    if (data.logoUrl) {
      const wrap = document.getElementById('currentLogoWrap');
      const img = document.getElementById('currentLogoPreview');
      if (wrap) wrap.style.display = 'block';
      if (img) img.src = data.logoUrl;
    }

    // PDFs
    renderPdfList(data.pdfs || []);
  } catch (e) {
    console.error('Failed to load content', e);
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

function renderPdfList(pdfs) {
  const list = document.getElementById('pdfList');
  if (!list) return;
  if (!pdfs.length) {
    list.innerHTML = '<li style="color:#64748b;font-size:0.9rem;">No PDFs uploaded yet.</li>';
    return;
  }
  list.innerHTML = '';
  pdfs.forEach((pdf, idx) => {
    const li = document.createElement('li');
    li.className = 'pdf-list-item';
    li.innerHTML = `
      <span class="pdf-icon"><i class="fa fa-file-pdf"></i></span>
      <div class="pdf-info">
        <strong>${pdf.label}</strong>
        <span>${pdf.url.split('/').pop()}</span>
      </div>
      <div class="pdf-actions">
        <a href="${pdf.url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fa fa-eye"></i></a>
        <button class="btn btn-danger btn-sm" data-idx="${idx}" onclick="deletePdf(${idx})"><i class="fa fa-trash"></i></button>
      </div>`;
    list.appendChild(li);
  });
}

// ── Text save ──
document.getElementById('textsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…';
  try {
    const res = await authFetch('/api/content/texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bannerHeadline: document.getElementById('bannerHeadline').value,
        bannerSubtext:  document.getElementById('bannerSubtext').value,
        manifestoTitle: document.getElementById('manifestoTitle').value,
        manifestoSub:   document.getElementById('manifestoSub').value,
        manifestoCtaText: document.getElementById('manifestoCtaText').value,
        aboutTitle:     document.getElementById('aboutTitle').value,
        aboutText:      document.getElementById('aboutText').value,
        footerAboutText: document.getElementById('footerAboutText').value,
      })
    });
    const data = await res.json();
    if (data.ok) showToast('Text content saved successfully!');
    else showToast(data.message || 'Save failed', 'error');
  } catch { showToast('Save failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save All Text';
});

// ── Social save ──
document.getElementById('socialForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…';
  try {
    const res = await authFetch('/api/content/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facebook: document.getElementById('socialFacebook').value,
        twitter:  document.getElementById('socialTwitter').value,
        youtube:  document.getElementById('socialYoutube').value,
        instagram: document.getElementById('socialInstagram').value,
      })
    });
    const data = await res.json();
    if (data.ok) showToast('Social links saved!');
    else showToast(data.message || 'Save failed', 'error');
  } catch { showToast('Save failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save Social Links';
});

// ── Video upload (direct to Firebase — no 50MB Vercel limit) ──
document.getElementById('videoUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const input = document.getElementById('videoFileInput');
  if (!input.files[0]) { showToast('Please select a video file', 'warning'); return; }
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading…';
  try {
    const url = await uploadToFirebaseDirect(input.files[0], 'videos', 'videoProgressFill', 'videoProgressText', 'videoProgress');
    const data = await saveUrlToServer('/api/save/video', 'bannerVideoUrl', url);
    if (data.ok) {
      showToast('Video uploaded successfully!');
      const wrap = document.getElementById('currentVideoWrap');
      const vid  = document.getElementById('currentVideoPreview');
      const name = document.getElementById('currentVideoName');
      if (wrap) wrap.style.display = 'block';
      if (vid)  { vid.src = url; vid.load(); }
      if (name) name.textContent = input.files[0].name;
      input.value = ''; document.getElementById('videoFileName').textContent = '';
    } else { showToast(data.message || 'Save failed', 'error'); }
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Video';
});

// ── Audio upload (direct to Firebase — no size limit) ──
document.getElementById('audioUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const input = document.getElementById('audioFileInput');
  if (!input.files[0]) { showToast('Please select an audio file', 'warning'); return; }
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading…';
  try {
    const url = await uploadToFirebaseDirect(input.files[0], 'audio', 'audioProgressFill', 'audioProgressText', 'audioProgress');
    const data = await saveUrlToServer('/api/save/audio', 'bgAudioUrl', url);
    if (data.ok) {
      showToast('Background audio uploaded!');
      const wrap = document.getElementById('currentAudioWrap');
      const aud  = document.getElementById('currentAudioPreview');
      const name = document.getElementById('currentAudioName');
      if (wrap) wrap.style.display = 'block';
      if (aud)  { aud.src = url; aud.load(); }
      if (name) name.textContent = input.files[0].name;
      input.value = ''; document.getElementById('audioFileName').textContent = '';
    } else { showToast(data.message || 'Save failed', 'error'); }
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Audio';
});

// ── Logo upload ──
document.getElementById('logoUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('logoFileInput');
  if (!input.files[0]) { showToast('Please select a logo file', 'warning'); return; }
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading…';
  const fd = new FormData();
  fd.append('logo', input.files[0]);
  try {
    const data = await uploadWithProgress('/api/upload/logo', fd, null, null, null);
    if (data.ok) {
      showToast('Logo uploaded!');
      const wrap = document.getElementById('currentLogoWrap');
      const img = document.getElementById('currentLogoPreview');
      if (wrap) wrap.style.display = 'block';
      if (img) img.src = data.url + '?t=' + Date.now();
      input.value = ''; document.getElementById('logoFileName').textContent = '';
    } else { showToast(data.message || 'Upload failed', 'error'); }
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Logo';
});

// ── PDF upload ──
document.getElementById('pdfUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('pdfFileInput');
  const label = document.getElementById('pdfLabel').value.trim();
  if (!input.files[0]) { showToast('Please select a PDF file', 'warning'); return; }
  if (!label) { showToast('Please enter a label for this PDF', 'warning'); return; }
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading…';
  const fd = new FormData();
  fd.append('pdf', input.files[0]);
  fd.append('label', label);
  try {
    const data = await uploadWithProgress('/api/upload/pdf', fd, 'pdfProgressFill', 'pdfProgressText', 'pdfProgress');
    if (data.ok) {
      showToast('PDF uploaded!');
      input.value = ''; document.getElementById('pdfFileName').textContent = '';
      document.getElementById('pdfLabel').value = '';
      await loadContent(); // refresh list
    } else { showToast(data.message || 'Upload failed', 'error'); }
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload PDF';
});

// ── Delete PDF ──
window.deletePdf = async function(idx) {
  if (!confirm('Delete this PDF? This cannot be undone.')) return;
  try {
    const res = await authFetch(`/api/content/pdf/${idx}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) { showToast('PDF deleted'); await loadContent(); }
    else showToast(data.message || 'Delete failed', 'error');
  } catch { showToast('Delete failed', 'error'); }
};

// ── Init ──
// Check authentication first, then load content
(async () => {
  try {
    const res = await fetch('/admin/check', {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const data = await res.json();
    if (!data.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
    loadContent();
  } catch {
    window.location.href = '/admin/login.html';
  }
})();
