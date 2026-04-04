/* =========================================================
   VIKASITA NEMOM – Admin Panel JS  (complete rewrite)
   ========================================================= */

// ── Firebase JS SDK (direct large-file uploads) ──────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

const firebaseApp = initializeApp({
  apiKey:            'AIzaSyAEdDwXotDoLyJNNXyYQ4y8yY1jGxkJCzs',
  authDomain:        'nda4vikasitanemom.firebaseapp.com',
  projectId:         'nda4vikasitanemom',
  storageBucket:     'nda4vikasitanemom.firebasestorage.app',
  messagingSenderId: '851294523572',
  appId:             '1:851294523572:web:3dc9001738c2d415a107e1'
});
const fbStorage = getStorage(firebaseApp);

// ── JWT helpers ───────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('adminToken') || '';
}

async function authFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
    throw new Error('Session expired');
  }
  return res;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon  = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
  const color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#FFB700';
  t.innerHTML = '<i class="fa ' + icon + '" style="color:' + color + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(40px)';
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// ── Set field value safely ────────────────────────────────────
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.value = val;
}

// ── Sidebar nav ───────────────────────────────────────────────
document.querySelectorAll('.nav-link[data-section]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(link.dataset.section)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Wire file drop zones ──────────────────────────────────────
function wireFile(inputId, nameId, zoneId) {
  const input  = document.getElementById(inputId);
  const nameEl = document.getElementById(nameId);
  const zone   = document.getElementById(zoneId);
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files[0]) nameEl.textContent = input.files[0].name;
  });
  zone?.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      const dt = new DataTransfer();
      dt.items.add(e.dataTransfer.files[0]);
      input.files = dt.files;
      nameEl.textContent = e.dataTransfer.files[0].name;
    }
  });
}
wireFile('videoFileInput', 'videoFileName', 'videoDropZone');
wireFile('audioFileInput', 'audioFileName', 'audioDropZone');
wireFile('logoFileInput',  'logoFileName',  'logoDropZone');
wireFile('pdfFileInput',   'pdfFileName',   'pdfDropZone');

// ── XHR upload with progress (logo + PDF through server) ─────
function xhrUpload(url, formData, fillId, textId, wrapId) {
  return new Promise((resolve, reject) => {
    const wrap = wrapId ? document.getElementById(wrapId) : null;
    const fill = fillId ? document.getElementById(fillId) : null;
    const text = textId ? document.getElementById(textId) : null;
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());

    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      if (fill) fill.style.width = pct + '%';
      if (text) text.textContent = 'Uploading... ' + pct + '%';
    });
    xhr.addEventListener('load', () => {
      if (wrap) wrap.style.display = 'none';
      try {
        const d = JSON.parse(xhr.responseText || '{}');
        xhr.status >= 200 && xhr.status < 300 ? resolve(d) : reject(d);
      } catch { reject({ message: 'Server error' }); }
    });
    xhr.addEventListener('error', () => {
      if (wrap) wrap.style.display = 'none';
      reject({ message: 'Network error — check your connection' });
    });
    xhr.send(formData);
  });
}

// ── Firebase direct upload (video + audio — bypasses Vercel) ─
function firebaseUpload(file, folder, fillId, textId, wrapId) {
  return new Promise((resolve, reject) => {
    const wrap = wrapId ? document.getElementById(wrapId) : null;
    const fill = fillId ? document.getElementById(fillId) : null;
    const text = textId ? document.getElementById(textId) : null;
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';

    const ext      = file.name.split('.').pop().toLowerCase();
    const filePath = folder + '/' + Date.now() + '-' + Math.round(Math.random() * 1e6) + '.' + ext;
    const task     = uploadBytesResumable(ref(fbStorage, filePath), file, { contentType: file.type });

    task.on('state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = 'Uploading... ' + pct + '%';
      },
      err => {
        if (wrap) wrap.style.display = 'none';
        reject({ message: err.message });
      },
      () => {
        if (wrap) wrap.style.display = 'none';
        // Build permanent public URL (not the expiring token URL)
        const bucket = 'nda4vikasitanemom.firebasestorage.app';
        const encoded = filePath.split('/').map(encodeURIComponent).join('/');
        resolve('https://storage.googleapis.com/' + bucket + '/' + encoded);
      }
    );
  });
}

// ── Load all content into forms ───────────────────────────────
async function loadContent() {
  try {
    const res  = await fetch('/api/content');
    const data = await res.json();

    setVal('bannerHeadline',   data.bannerHeadline);
    setVal('bannerSubtext',    data.bannerSubtext);
    setVal('manifestoTitle',   data.manifestoTitle);
    setVal('manifestoSub',     data.manifestoSub);
    setVal('manifestoCtaText', data.manifestoCtaText);
    setVal('aboutTitle',       data.aboutTitle);
    setVal('aboutText',        data.aboutText);
    setVal('footerAboutText',  data.footerAboutText);

    if (data.socialLinks) {
      setVal('socialFacebook',  data.socialLinks.facebook);
      setVal('socialTwitter',   data.socialLinks.twitter);
      setVal('socialYoutube',   data.socialLinks.youtube);
      setVal('socialInstagram', data.socialLinks.instagram);
    }

    // Video preview
    const vWrap = document.getElementById('currentVideoWrap');
    const vEl   = document.getElementById('currentVideoPreview');
    const vName = document.getElementById('currentVideoName');
    if (data.bannerVideoUrl) {
      if (vWrap) vWrap.style.display = 'block';
      if (vEl)  vEl.src = data.bannerVideoUrl;
      if (vName) vName.textContent = decodeURIComponent(data.bannerVideoUrl.split('/').pop());
    } else {
      if (vWrap) vWrap.style.display = 'none';
    }

    // Audio preview
    const aWrap = document.getElementById('currentAudioWrap');
    const aEl   = document.getElementById('currentAudioPreview');
    const aName = document.getElementById('currentAudioName');
    if (data.bgAudioUrl) {
      if (aWrap) aWrap.style.display = 'block';
      if (aEl)  aEl.src = data.bgAudioUrl;
      if (aName) aName.textContent = decodeURIComponent(data.bgAudioUrl.split('/').pop());
    } else {
      if (aWrap) aWrap.style.display = 'none';
    }

    // Logo preview
    const lWrap = document.getElementById('currentLogoWrap');
    const lEl   = document.getElementById('currentLogoPreview');
    if (data.logoUrl) {
      if (lWrap) lWrap.style.display = 'block';
      if (lEl)  lEl.src = data.logoUrl;
    }

    renderPdfs(data.pdfs || []);

  } catch (e) {
    console.error('loadContent error:', e);
    toast('Failed to load content from server', 'error');
  }
}

// ── Render PDF list ───────────────────────────────────────────
function renderPdfs(pdfs) {
  const list = document.getElementById('pdfList');
  if (!list) return;
  if (!pdfs.length) {
    list.innerHTML = '<li style="color:#64748b;font-size:0.9rem;padding:8px 0;">No PDFs uploaded yet.</li>';
    return;
  }
  list.innerHTML = '';
  pdfs.forEach((pdf, idx) => {
    const li = document.createElement('li');
    li.className = 'pdf-list-item';
    li.innerHTML =
      '<span class="pdf-icon"><i class="fa fa-file-pdf"></i></span>' +
      '<div class="pdf-info"><strong>' + pdf.label + '</strong><span>' + decodeURIComponent(pdf.url.split('/').pop()) + '</span></div>' +
      '<div class="pdf-actions">' +
        '<a href="' + pdf.url + '" target="_blank" class="btn btn-ghost btn-sm" title="Preview"><i class="fa fa-eye"></i></a>' +
        '<button class="btn btn-danger btn-sm" onclick="deletePdf(' + idx + ')" title="Delete"><i class="fa fa-trash"></i></button>' +
      '</div>';
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────────────────────
// FORM SUBMIT HANDLERS
// ─────────────────────────────────────────────────────────────

// ── Save text content ─────────────────────────────────────────
document.getElementById('textsForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
  try {
    const res  = await authFetch('/api/content/texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bannerHeadline:   document.getElementById('bannerHeadline').value,
        bannerSubtext:    document.getElementById('bannerSubtext').value,
        manifestoTitle:   document.getElementById('manifestoTitle').value,
        manifestoSub:     document.getElementById('manifestoSub').value,
        manifestoCtaText: document.getElementById('manifestoCtaText').value,
        aboutTitle:       document.getElementById('aboutTitle').value,
        aboutText:        document.getElementById('aboutText').value,
        footerAboutText:  document.getElementById('footerAboutText').value,
      })
    });
    const d = await res.json();
    d.ok ? toast('Text content saved!') : toast(d.message || 'Save failed', 'error');
  } catch (err) { if (err.message !== 'Session expired') toast('Save failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save All Text';
});

// ── Save social links ─────────────────────────────────────────
document.getElementById('socialForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
  try {
    const res  = await authFetch('/api/content/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facebook:  document.getElementById('socialFacebook').value,
        twitter:   document.getElementById('socialTwitter').value,
        youtube:   document.getElementById('socialYoutube').value,
        instagram: document.getElementById('socialInstagram').value,
      })
    });
    const d = await res.json();
    d.ok ? toast('Social links saved!') : toast(d.message || 'Save failed', 'error');
  } catch (err) { if (err.message !== 'Session expired') toast('Save failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save Social Links';
});

// ── Upload video ──────────────────────────────────────────────
document.getElementById('videoUploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('videoFileInput');
  if (!input.files[0]) { toast('Please select a video file', 'warning'); return; }
  if (input.files[0].size > 500 * 1024 * 1024) { toast('Video must be under 500MB', 'warning'); return; }

  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  try {
    const url  = await firebaseUpload(input.files[0], 'videos', 'videoProgressFill', 'videoProgressText', 'videoProgress');
    const res  = await authFetch('/api/save/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const d = await res.json();
    if (d.ok) {
      toast('Video uploaded successfully!');
      document.getElementById('currentVideoWrap').style.display = 'block';
      const v = document.getElementById('currentVideoPreview');
      v.src = url; v.load();
      document.getElementById('currentVideoName').textContent = input.files[0].name;
      input.value = ''; document.getElementById('videoFileName').textContent = '';
    } else { toast(d.message || 'Failed to save video', 'error'); }
  } catch (err) { if (err.message !== 'Session expired') toast('Upload failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Video';
});

// ── Upload audio ──────────────────────────────────────────────
document.getElementById('audioUploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('audioFileInput');
  if (!input.files[0]) { toast('Please select an audio file', 'warning'); return; }
  if (input.files[0].size > 50 * 1024 * 1024) { toast('Audio must be under 50MB', 'warning'); return; }

  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  try {
    const url  = await firebaseUpload(input.files[0], 'audio', 'audioProgressFill', 'audioProgressText', 'audioProgress');
    const res  = await authFetch('/api/save/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const d = await res.json();
    if (d.ok) {
      toast('Background audio uploaded!');
      document.getElementById('currentAudioWrap').style.display = 'block';
      const a = document.getElementById('currentAudioPreview');
      a.src = url; a.load();
      document.getElementById('currentAudioName').textContent = input.files[0].name;
      input.value = ''; document.getElementById('audioFileName').textContent = '';
    } else { toast(d.message || 'Failed to save audio', 'error'); }
  } catch (err) { if (err.message !== 'Session expired') toast('Upload failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Audio';
});

// ── Upload logo ───────────────────────────────────────────────
document.getElementById('logoUploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('logoFileInput');
  if (!input.files[0]) { toast('Please select a logo file', 'warning'); return; }

  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  const fd = new FormData();
  fd.append('logo', input.files[0]);
  try {
    const d = await xhrUpload('/api/upload/logo', fd, null, null, null);
    if (d.ok) {
      toast('Logo uploaded!');
      document.getElementById('currentLogoWrap').style.display = 'block';
      document.getElementById('currentLogoPreview').src = d.url + '?t=' + Date.now();
      input.value = ''; document.getElementById('logoFileName').textContent = '';
    } else { toast(d.message || 'Upload failed', 'error'); }
  } catch (err) { toast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Logo';
});

// ── Upload PDF ────────────────────────────────────────────────
document.getElementById('pdfUploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('pdfFileInput');
  const label = document.getElementById('pdfLabel').value.trim();
  if (!input.files[0]) { toast('Please select a PDF file', 'warning'); return; }
  if (!label)          { toast('Please enter a label for this PDF', 'warning'); return; }

  const btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  const fd = new FormData();
  fd.append('pdf', input.files[0]);
  fd.append('label', label);
  try {
    const d = await xhrUpload('/api/upload/pdf', fd, 'pdfProgressFill', 'pdfProgressText', 'pdfProgress');
    if (d.ok) {
      toast('PDF uploaded!');
      input.value = ''; document.getElementById('pdfFileName').textContent = ''; document.getElementById('pdfLabel').value = '';
      await loadContent();
    } else { toast(d.message || 'Upload failed', 'error'); }
  } catch (err) { toast(err.message || 'Upload failed', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload PDF';
});

// ── Delete PDF ────────────────────────────────────────────────
window.deletePdf = async function(idx) {
  if (!confirm('Delete this PDF? This cannot be undone.')) return;
  try {
    const res  = await authFetch('/api/content/pdf/' + idx, { method: 'DELETE' });
    const d    = await res.json();
    if (d.ok) { toast('PDF deleted'); await loadContent(); }
    else toast(d.message || 'Delete failed', 'error');
  } catch (err) { if (err.message !== 'Session expired') toast('Delete failed', 'error'); }
};

// ─────────────────────────────────────────────────────────────
// INIT — check auth token, then load all content
// ─────────────────────────────────────────────────────────────
(async () => {
  const token = getToken();
  if (!token) { window.location.href = '/admin/login.html'; return; }
  try {
    const res  = await fetch('/admin/check', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!data.ok) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login.html';
      return;
    }
    await loadContent();
  } catch {
    window.location.href = '/admin/login.html';
  }
})();
