/* =========================================================
   VIKASITA NEMOM – Main Frontend JS
   ========================================================= */

// ── Preloader: keep visible until content is loaded ──
function dismissPreloader() {
  const pre = document.getElementById('preloader');
  if (!pre) return;
  pre.style.transition = 'opacity 0.35s';
  pre.style.opacity = '0';
  setTimeout(() => { if (pre.parentNode) pre.remove(); }, 380);
}

// Start fetching content immediately — don't wait for window.load
(function init() {
  loadSiteContent();
})();

// ── Load dynamic content from API ──
async function loadSiteContent() {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();
    applySiteContent(data);
  } catch (e) {
    console.warn('Could not load dynamic content, using defaults.');
  } finally {
    // Always dismiss preloader after content attempt — no flash
    dismissPreloader();
  }
}

function applySiteContent(data) {
  setEl('banner-headline', data.bannerHeadline);
  setEl('banner-subtext',  data.bannerSubtext);

  // Banner video — always muted + inline for iOS
  const vid = document.getElementById('bannerVideo');
  const src = document.getElementById('bannerVideoSrc');
  if (vid && src && data.bannerVideoUrl) {
    vid.muted        = true;
    vid.playsInline  = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');
    src.src = data.bannerVideoUrl;
    vid.load();
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // iOS / low-power mode: retry on first user touch
        document.addEventListener('touchstart', function retryVideo() {
          vid.play().catch(() => {});
          document.removeEventListener('touchstart', retryVideo);
        }, { once: true, passive: true });
      });
    }
  }

  // Background audio
  const audio    = document.getElementById('bgAudio');
  const audioBtn = document.getElementById('audioToggleBtn');
  if (audio && data.bgAudioUrl) {
    audio.src    = data.bgAudioUrl;
    audio.volume = 0.5;
    if (audioBtn) audioBtn.style.display = 'flex';
    audio.play()
      .then(() => { if (audioBtn) audioBtn.classList.add('playing'); })
      .catch(() => {
        document.addEventListener('click', function startAudio() {
          audio.play().then(() => { if (audioBtn) audioBtn.classList.add('playing'); }).catch(() => {});
          document.removeEventListener('click', startAudio);
        }, { once: true });
      });
  }

  setEl('manifesto-title',    data.manifestoTitle);
  setEl('manifesto-sub',      data.manifestoSub);
  setEl('manifesto-cta-text', data.manifestoCtaText);
  setEl('about-title',        data.aboutTitle);
  setEl('about-text',         data.aboutText);
  setEl('footer-about-text',  data.footerAboutText);

  ['site-logo', 'section-logo', 'footer-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el && data.logoUrl) el.src = data.logoUrl;
  });

  if (data.socialLinks) buildSocialLinks(data.socialLinks);
  buildInlinePdfViewer(data.pdfs || []);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}

// ── Social links ──
function buildSocialLinks(links) {
  const container = document.getElementById('social-links');
  if (!container) return;
  const icons = {
    facebook: 'fa-brands fa-facebook', twitter: 'fa-brands fa-x-twitter',
    youtube:  'fa-brands fa-youtube',  instagram: 'fa-brands fa-instagram',
  };
  container.innerHTML = '';
  Object.entries(links).forEach(([platform, url]) => {
    if (!url) return;
    const li = document.createElement('li');
    li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
      <i class="${icons[platform] || 'fa fa-link'}"></i> ${platform.charAt(0).toUpperCase() + platform.slice(1)}
    </a>`;
    container.appendChild(li);
  });
}

// ── Background Audio Toggle ──
window.toggleBgAudio = function () {
  const audio = document.getElementById('bgAudio');
  const btn   = document.getElementById('audioToggleBtn');
  if (!audio) return;
  if (audio.paused) {
    audio.play().then(() => { if (btn) btn.classList.add('playing'); }).catch(() => {});
  } else {
    audio.pause();
    if (btn) btn.classList.remove('playing');
  }
};

// ── Header scroll / back-to-top ──
const _hdr = document.getElementById('header');
window.addEventListener('scroll', () => {
  if (_hdr) _hdr.classList.toggle('scrolled', window.scrollY > 40);
  const btt = document.getElementById('backToTop');
  if (btt) btt.classList.toggle('visible', window.scrollY > 300);
});
document.getElementById('backToTop')?.addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: 'smooth' })
);

// ── Mobile Menu ──
document.getElementById('menuToggle')?.addEventListener('click', () =>
  document.getElementById('mobileMenu')?.classList.add('open')
);
document.getElementById('mobileMenuClose')?.addEventListener('click', () =>
  document.getElementById('mobileMenu')?.classList.remove('open')
);
document.querySelectorAll('.mobile-menu a').forEach(a =>
  a.addEventListener('click', () => document.getElementById('mobileMenu')?.classList.remove('open'))
);

/* ─────────────────────────────────────────────────────────
   Inline PDF Viewer — PDF.js canvas renderer
   Works on every browser including iOS Safari & Android Chrome
   ───────────────────────────────────────────────────────── */

var _pdfDoc = null;
var _pdfUrl = null;

window.loadInlinePdf = function (url, label) {
  var viewer  = document.getElementById('manifestoViewer');
  var wrap    = document.getElementById('manifestoFrameWrap');
  var titleEl = document.getElementById('manifestoBarTitle');
  var dlBtn   = document.getElementById('manifestoDlBtn');
  if (!viewer || !wrap) return;

  viewer.style.display = 'block';
  if (titleEl) titleEl.textContent = label || '';
  if (dlBtn)   { dlBtn.href = url; dlBtn.setAttribute('download', label || 'manifesto.pdf'); }

  // Highlight active tab
  document.querySelectorAll('.pdf-tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var tab = document.querySelector('.pdf-tab-btn[data-url="' + url + '"]');
  if (tab) tab.classList.add('active');

  if (_pdfUrl === url && _pdfDoc) return; // already loaded
  _pdfUrl = url;

  // Show spinner
  wrap.innerHTML =
    '<div class="pdf-loading"><div class="pdf-spinner"></div><span>Loading…</span></div>';

  // PDF.js: render all pages as canvases into a scrollable container
  var pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

  pdfjsLib.getDocument({ url: url, withCredentials: false }).promise.then(function(pdf) {
    _pdfDoc = pdf;
    var totalPages = pdf.numPages;

    // Build scrollable canvas container
    var container = document.createElement('div');
    container.className = 'pdf-canvas-container';

    wrap.innerHTML = '';
    wrap.appendChild(container);

    // Render all pages sequentially
    var renderPage = function(num) {
      pdf.getPage(num).then(function(page) {
        var wrapWidth = wrap.clientWidth || 360;
        var viewport  = page.getViewport({ scale: 1 });
        var scale     = (wrapWidth - 4) / viewport.width;
        var scaled    = page.getViewport({ scale: scale });

        var pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page-wrap';

        var canvas = document.createElement('canvas');
        canvas.width  = Math.floor(scaled.width);
        canvas.height = Math.floor(scaled.height);

        pageDiv.appendChild(canvas);
        container.appendChild(pageDiv);

        page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise.then(function() {
          if (num < totalPages) renderPage(num + 1);
        });
      });
    };

    renderPage(1);

  }).catch(function(err) {
    console.error('PDF.js error:', err);
    wrap.innerHTML =
      '<div class="pdf-fallback">' +
        '<i class="fa fa-file-pdf" style="font-size:2.5rem;color:#FFB700;margin-bottom:14px;"></i>' +
        '<p>Could not load PDF preview.</p>' +
        '<a href="' + url + '" target="_blank" class="manifesto-dl-btn" style="margin-top:12px;">' +
          '<i class="fa fa-download"></i> Open PDF' +
        '</a>' +
      '</div>';
  });
};

// ── Build manifesto viewer with optional tab row ──
function buildInlinePdfViewer(pdfs) {
  const viewer = document.getElementById('manifestoViewer');
  const noDoc  = document.getElementById('pdfNoDocMsg');
  const tabRow = document.getElementById('pdfTabRow');

  if (!pdfs.length) {
    if (noDoc)  noDoc.style.display  = 'block';
    if (viewer) viewer.style.display = 'none';
    return;
  }
  if (noDoc) noDoc.style.display = 'none';

  // Build tab buttons when >1 PDF
  if (tabRow) {
    tabRow.innerHTML = '';
    if (pdfs.length > 1) {
      tabRow.style.display = 'flex';
      pdfs.forEach(pdf => {
        const btn = document.createElement('button');
        btn.className   = 'pdf-tab-btn';
        btn.dataset.url = pdf.url;
        btn.innerHTML   = `<i class="fa fa-file-pdf"></i> ${pdf.label}`;
        btn.addEventListener('click', () => window.loadInlinePdf(pdf.url, pdf.label));
        tabRow.appendChild(btn);
      });
    } else {
      tabRow.style.display = 'none';
    }
  }

  // Auto-load first PDF
  window.loadInlinePdf(pdfs[0].url, pdfs[0].label);
}
