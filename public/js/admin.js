/* =========================================================
   VIKASITA NEMOM – Admin Panel JS
   Uses Firebase Compat SDK loaded via <script> tags
   NO ES module imports — works with Vercel bundling
   ========================================================= */

// ── Firebase init (compat SDK — global firebase object) ──────
firebase.initializeApp({
  apiKey:            'AIzaSyAEdDwXotDoLyJNNXyYQ4y8yY1jGxkJCzs',
  authDomain:        'nda4vikasitanemom.firebaseapp.com',
  projectId:         'nda4vikasitanemom',
  storageBucket:     'nda4vikasitanemom.firebasestorage.app',
  messagingSenderId: '851294523572',
  appId:             '1:851294523572:web:3dc9001738c2d415a107e1'
});
const fbStorage = firebase.storage();

// ── JWT helpers ───────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('adminToken') || '';
}

function authFetch(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = 'Bearer ' + getToken();
  return fetch(url, opts).then(function(res) {
    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login.html';
      throw new Error('Session expired');
    }
    return res;
  });
}

// ── Toast notification ────────────────────────────────────────
function toast(msg, type) {
  type = type || 'success';
  var c = document.getElementById('toastContainer');
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  var icon  = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
  var color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#FFB700';
  t.innerHTML = '<i class="fa ' + icon + '" style="color:' + color + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transform = 'translateX(40px)';
    setTimeout(function() { t.remove(); }, 400);
  }, 3500);
}

// ── Set field value safely ────────────────────────────────────
function setVal(id, val) {
  var el = document.getElementById(id);
  if (el && val != null) el.value = val;
}

// ── Sidebar nav ───────────────────────────────────────────────
document.querySelectorAll('.nav-link[data-section]').forEach(function(link) {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(function(l) { l.classList.remove('active'); });
    link.classList.add('active');
    var target = document.getElementById(link.dataset.section);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Wire file drop zones ──────────────────────────────────────
function wireFile(inputId, nameId, zoneId) {
  var input  = document.getElementById(inputId);
  var nameEl = document.getElementById(nameId);
  var zone   = document.getElementById(zoneId);
  if (!input) return;
  input.addEventListener('change', function() {
    if (input.files[0]) nameEl.textContent = input.files[0].name;
  });
  if (zone) {
    zone.addEventListener('dragover',  function(e) { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function()  { zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        var dt = new DataTransfer();
        dt.items.add(e.dataTransfer.files[0]);
        input.files = dt.files;
        nameEl.textContent = e.dataTransfer.files[0].name;
      }
    });
  }
}
wireFile('videoFileInput', 'videoFileName', 'videoDropZone');
wireFile('audioFileInput', 'audioFileName', 'audioDropZone');
wireFile('logoFileInput',  'logoFileName',  'logoDropZone');
wireFile('pdfFileInput',   'pdfFileName',   'pdfDropZone');

// ── XHR upload with progress (logo + PDF → server) ───────────
function xhrUpload(url, formData, fillId, textId, wrapId) {
  return new Promise(function(resolve, reject) {
    var wrap = wrapId ? document.getElementById(wrapId) : null;
    var fill = fillId ? document.getElementById(fillId) : null;
    var text = textId ? document.getElementById(textId) : null;
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());

    xhr.upload.addEventListener('progress', function(e) {
      if (!e.lengthComputable) return;
      var pct = Math.round((e.loaded / e.total) * 100);
      if (fill) fill.style.width = pct + '%';
      if (text) text.textContent = 'Uploading... ' + pct + '%';
    });
    xhr.addEventListener('load', function() {
      if (wrap) wrap.style.display = 'none';
      try {
        var d = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(d); else reject(d);
      } catch(e) { reject({ message: 'Server error' }); }
    });
    xhr.addEventListener('error', function() {
      if (wrap) wrap.style.display = 'none';
      reject({ message: 'Network error' });
    });
    xhr.send(formData);
  });
}

// ── Firebase direct upload (video + audio — no Vercel limit) ─
function firebaseUpload(file, folder, fillId, textId, wrapId) {
  return new Promise(function(resolve, reject) {
    var wrap = wrapId ? document.getElementById(wrapId) : null;
    var fill = fillId ? document.getElementById(fillId) : null;
    var text = textId ? document.getElementById(textId) : null;
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';

    var ext      = file.name.split('.').pop().toLowerCase();
    var filePath = folder + '/' + Date.now() + '-' + Math.round(Math.random() * 1e6) + '.' + ext;
    var storageRef = fbStorage.ref(filePath);
    var task = storageRef.put(file, { contentType: file.type });

    task.on('state_changed',
      function(snap) {
        var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = 'Uploading... ' + pct + '%';
      },
      function(err) {
        if (wrap) wrap.style.display = 'none';
        reject({ message: err.message });
      },
      function() {
        if (wrap) wrap.style.display = 'none';
        // Permanent public URL (not expiring token URL)
        var bucket  = 'nda4vikasitanemom.firebasestorage.app';
        var encoded = filePath.split('/').map(encodeURIComponent).join('/');
        resolve('https://storage.googleapis.com/' + bucket + '/' + encoded);
      }
    );
  });
}

// ── Load all content into forms ───────────────────────────────
function loadContent() {
  return fetch('/api/content').then(function(res) { return res.json(); }).then(function(data) {
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
    var vWrap = document.getElementById('currentVideoWrap');
    var vEl   = document.getElementById('currentVideoPreview');
    var vName = document.getElementById('currentVideoName');
    if (data.bannerVideoUrl) {
      if (vWrap) vWrap.style.display = 'block';
      if (vEl)   vEl.src = data.bannerVideoUrl;
      if (vName) vName.textContent = decodeURIComponent(data.bannerVideoUrl.split('/').pop());
    } else {
      if (vWrap) vWrap.style.display = 'none';
    }

    // Audio preview
    var aWrap = document.getElementById('currentAudioWrap');
    var aEl   = document.getElementById('currentAudioPreview');
    var aName = document.getElementById('currentAudioName');
    if (data.bgAudioUrl) {
      if (aWrap) aWrap.style.display = 'block';
      if (aEl)   aEl.src = data.bgAudioUrl;
      if (aName) aName.textContent = decodeURIComponent(data.bgAudioUrl.split('/').pop());
    } else {
      if (aWrap) aWrap.style.display = 'none';
    }

    // Logo preview
    var lWrap = document.getElementById('currentLogoWrap');
    var lEl   = document.getElementById('currentLogoPreview');
    if (data.logoUrl) {
      if (lWrap) lWrap.style.display = 'block';
      if (lEl)   lEl.src = data.logoUrl;
    }

    renderPdfs(data.pdfs || []);

  }).catch(function(e) {
    console.error('loadContent error:', e);
    toast('Failed to load content', 'error');
  });
}

// ── Render PDF list ───────────────────────────────────────────
function renderPdfs(pdfs) {
  var list = document.getElementById('pdfList');
  if (!list) return;
  if (!pdfs.length) {
    list.innerHTML = '<li style="color:#64748b;font-size:0.9rem;padding:8px 0;">No PDFs uploaded yet.</li>';
    return;
  }
  list.innerHTML = '';
  pdfs.forEach(function(pdf, idx) {
    var li = document.createElement('li');
    li.className = 'pdf-list-item';
    li.innerHTML =
      '<span class="pdf-icon"><i class="fa fa-file-pdf"></i></span>' +
      '<div class="pdf-info"><strong>' + pdf.label + '</strong>' +
      '<span>' + decodeURIComponent(pdf.url.split('/').pop()) + '</span></div>' +
      '<div class="pdf-actions">' +
        '<a href="' + pdf.url + '" target="_blank" class="btn btn-ghost btn-sm"><i class="fa fa-eye"></i></a>' +
        '<button class="btn btn-danger btn-sm" onclick="deletePdf(' + idx + ')"><i class="fa fa-trash"></i></button>' +
      '</div>';
    list.appendChild(li);
  });
}

// ── Save text content ─────────────────────────────────────────
document.getElementById('textsForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
  authFetch('/api/content/texts', {
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
  }).then(function(res) { return res.json(); }).then(function(d) {
    d.ok ? toast('Text content saved!') : toast(d.message || 'Save failed', 'error');
  }).catch(function(err) {
    if (err.message !== 'Session expired') toast('Save failed', 'error');
  }).finally(function() {
    btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save All Text';
  });
});

// ── Save social links ─────────────────────────────────────────
document.getElementById('socialForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
  authFetch('/api/content/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facebook:  document.getElementById('socialFacebook').value,
      twitter:   document.getElementById('socialTwitter').value,
      youtube:   document.getElementById('socialYoutube').value,
      instagram: document.getElementById('socialInstagram').value,
    })
  }).then(function(res) { return res.json(); }).then(function(d) {
    d.ok ? toast('Social links saved!') : toast(d.message || 'Save failed', 'error');
  }).catch(function(err) {
    if (err.message !== 'Session expired') toast('Save failed', 'error');
  }).finally(function() {
    btn.disabled = false; btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Save Social Links';
  });
});

// ── Upload video ──────────────────────────────────────────────
document.getElementById('videoUploadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var input = document.getElementById('videoFileInput');
  if (!input.files[0]) { toast('Please select a video file', 'warning'); return; }
  if (input.files[0].size > 500 * 1024 * 1024) { toast('Video must be under 500MB', 'warning'); return; }
  var btn = e.submitter; var file = input.files[0];
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  firebaseUpload(file, 'videos', 'videoProgressFill', 'videoProgressText', 'videoProgress')
    .then(function(url) {
      return authFetch('/api/save/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      }).then(function(res) { return res.json(); }).then(function(d) {
        if (d.ok) {
          toast('Video uploaded successfully!');
          document.getElementById('currentVideoWrap').style.display = 'block';
          var v = document.getElementById('currentVideoPreview'); v.src = url; v.load();
          document.getElementById('currentVideoName').textContent = file.name;
          input.value = ''; document.getElementById('videoFileName').textContent = '';
        } else { toast(d.message || 'Failed to save video', 'error'); }
      });
    })
    .catch(function(err) { if (err.message !== 'Session expired') toast('Upload failed: ' + err.message, 'error'); })
    .finally(function() { btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Video'; });
});

// ── Upload audio ──────────────────────────────────────────────
document.getElementById('audioUploadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var input = document.getElementById('audioFileInput');
  if (!input.files[0]) { toast('Please select an audio file', 'warning'); return; }
  if (input.files[0].size > 50 * 1024 * 1024) { toast('Audio must be under 50MB', 'warning'); return; }
  var btn = e.submitter; var file = input.files[0];
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  firebaseUpload(file, 'audio', 'audioProgressFill', 'audioProgressText', 'audioProgress')
    .then(function(url) {
      return authFetch('/api/save/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      }).then(function(res) { return res.json(); }).then(function(d) {
        if (d.ok) {
          toast('Background audio uploaded!');
          document.getElementById('currentAudioWrap').style.display = 'block';
          var a = document.getElementById('currentAudioPreview'); a.src = url; a.load();
          document.getElementById('currentAudioName').textContent = file.name;
          input.value = ''; document.getElementById('audioFileName').textContent = '';
        } else { toast(d.message || 'Failed to save audio', 'error'); }
      });
    })
    .catch(function(err) { if (err.message !== 'Session expired') toast('Upload failed: ' + err.message, 'error'); })
    .finally(function() { btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Audio'; });
});

// ── Upload logo ───────────────────────────────────────────────
document.getElementById('logoUploadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var input = document.getElementById('logoFileInput');
  if (!input.files[0]) { toast('Please select a logo file', 'warning'); return; }
  var btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  var fd = new FormData(); fd.append('logo', input.files[0]);
  xhrUpload('/api/upload/logo', fd, null, null, null)
    .then(function(d) {
      if (d.ok) {
        toast('Logo uploaded!');
        document.getElementById('currentLogoWrap').style.display = 'block';
        document.getElementById('currentLogoPreview').src = d.url + '?t=' + Date.now();
        input.value = ''; document.getElementById('logoFileName').textContent = '';
      } else { toast(d.message || 'Upload failed', 'error'); }
    })
    .catch(function(err) { toast(err.message || 'Upload failed', 'error'); })
    .finally(function() { btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload Logo'; });
});

// ── Upload PDF ────────────────────────────────────────────────
document.getElementById('pdfUploadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var input = document.getElementById('pdfFileInput');
  var label = document.getElementById('pdfLabel').value.trim();
  if (!input.files[0]) { toast('Please select a PDF file', 'warning'); return; }
  if (!label) { toast('Please enter a label for this PDF', 'warning'); return; }
  var btn = e.submitter;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  var fd = new FormData(); fd.append('pdf', input.files[0]); fd.append('label', label);
  xhrUpload('/api/upload/pdf', fd, 'pdfProgressFill', 'pdfProgressText', 'pdfProgress')
    .then(function(d) {
      if (d.ok) {
        toast('PDF uploaded!');
        input.value = ''; document.getElementById('pdfFileName').textContent = '';
        document.getElementById('pdfLabel').value = '';
        loadContent();
      } else { toast(d.message || 'Upload failed', 'error'); }
    })
    .catch(function(err) { toast(err.message || 'Upload failed', 'error'); })
    .finally(function() { btn.disabled = false; btn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Upload PDF'; });
});

// ── Delete PDF ────────────────────────────────────────────────
window.deletePdf = function(idx) {
  if (!confirm('Delete this PDF? This cannot be undone.')) return;
  authFetch('/api/content/pdf/' + idx, { method: 'DELETE' })
    .then(function(res) { return res.json(); })
    .then(function(d) {
      if (d.ok) { toast('PDF deleted'); loadContent(); }
      else toast(d.message || 'Delete failed', 'error');
    })
    .catch(function(err) { if (err.message !== 'Session expired') toast('Delete failed', 'error'); });
};

// ── Init: check token → load content ─────────────────────────
(function init() {
  var token = getToken();
  if (!token) { window.location.href = '/admin/login.html'; return; }
  fetch('/admin/check', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.ok) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
        return;
      }
      loadContent();
    })
    .catch(function() { window.location.href = '/admin/login.html'; });
})();
