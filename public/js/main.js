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

  // Background audio — auto-play by default, remember user's mute preference
  const audio    = document.getElementById('bgAudio');
  const audioBtn = document.getElementById('audioToggleBtn');
  if (audio && data.bgAudioUrl) {
    audio.src    = data.bgAudioUrl;
    audio.volume = 0.5;
    if (audioBtn) audioBtn.style.display = 'flex';

    // Check if user previously muted
    var userMuted = localStorage.getItem('bgAudioMuted') === '1';

    function tryPlayAudio() {
      if (localStorage.getItem('bgAudioMuted') === '1') return;
      audio.play().then(function() {
        if (audioBtn) audioBtn.classList.add('playing');
        removeAutoplayListeners();
      }).catch(function() {});
    }

    // Listen for ANY user gesture — browsers unlock audio on these events
    var gestureEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown', 'scroll'];
    function onFirstGesture() {
      tryPlayAudio();
    }
    function addAutoplayListeners() {
      gestureEvents.forEach(function(evt) {
        document.addEventListener(evt, onFirstGesture, { once: true, passive: true });
      });
    }
    function removeAutoplayListeners() {
      gestureEvents.forEach(function(evt) {
        document.removeEventListener(evt, onFirstGesture);
      });
    }

    if (userMuted) {
      // User chose to mute — keep it muted, show muted state
      if (audioBtn) audioBtn.classList.remove('playing');
    } else {
      // Try autoplay immediately
      audio.play().then(function() {
        if (audioBtn) audioBtn.classList.add('playing');
      }).catch(function() {
        // Browser blocked — wait for first user gesture
        addAutoplayListeners();
      });
    }
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
    localStorage.setItem('bgAudioMuted', '0');
  } else {
    audio.pause();
    if (btn) btn.classList.remove('playing');
    localStorage.setItem('bgAudioMuted', '1');
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

var _pdfDoc      = null;
var _pdfUrl      = null;
var _pdfZoom     = -1;    // -1 = fit-width (default on all screens)
var _fitZoom     = 1.0;   // calculated fit-width zoom, stored after first page
var _renderTimer = null;

/* Re-render all pages at current _pdfZoom */
function _renderAllPages(pdf, wrap, zoomOverride) {
  var zoom      = (zoomOverride !== undefined) ? zoomOverride : _pdfZoom;
  var dpr       = Math.min(window.devicePixelRatio || 1, 3);
  var wrapWidth = wrap.clientWidth || window.innerWidth || 360;
  var viewport1 = null; // will be set from page 1

  // Calculate fit-width zoom from page 1
  pdf.getPage(1).then(function(p1) {
    var vp = p1.getViewport({ scale: 1 });
    _fitZoom  = (wrapWidth - 8) / vp.width;
    var cssScale = zoom < 0 ? _fitZoom : zoom; // zoom=-1 means fit

    // Update zoom label — show "Fit" when at fit-width, otherwise show %
    var label = document.getElementById('pdfZoomLabel');
    if (label) label.textContent = (zoom < 0) ? 'Fit' : Math.round(cssScale * 100) + '%';

    var container = document.createElement('div');
    container.className = 'pdf-canvas-container';
    wrap.innerHTML = '';
    wrap.appendChild(container);

    var renderPage = function(num) {
      pdf.getPage(num).then(function(page) {
        var vp          = page.getViewport({ scale: 1 });
        var renderScale = cssScale * dpr;
        var scaled      = page.getViewport({ scale: renderScale });
        var cssW        = Math.round(scaled.width  / dpr);
        var cssH        = Math.round(scaled.height / dpr);

        var pageDiv = document.createElement('div');
        pageDiv.className    = 'pdf-page-wrap';
        pageDiv.style.width  = cssW + 'px';

        var canvas          = document.createElement('canvas');
        canvas.width        = Math.floor(scaled.width);
        canvas.height       = Math.floor(scaled.height);
        canvas.style.width  = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.style.display = 'block';

        pageDiv.appendChild(canvas);
        container.appendChild(pageDiv);

        page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled })
          .promise.then(function() {
            if (num < pdf.numPages) renderPage(num + 1);
          });
      });
    };

    renderPage(1);
  });
}

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

  // Always default to fit-width on all screen sizes
  _pdfZoom = -1;

  if (_pdfUrl === url && _pdfDoc) {
    _renderAllPages(_pdfDoc, wrap);
    return;
  }
  _pdfUrl = url;

  // Show spinner
  wrap.innerHTML =
    '<div class="pdf-loading"><div class="pdf-spinner"></div><span>Loading…</span></div>';

  var pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

  pdfjsLib.getDocument({ url: url, withCredentials: false }).promise.then(function(pdf) {
    _pdfDoc = pdf;
    _renderAllPages(pdf, wrap);

    // Wire zoom buttons (only once)
    var btnOut = document.getElementById('pdfZoomOut');
    var btnIn  = document.getElementById('pdfZoomIn');
    var btnFit = document.getElementById('pdfZoomFit');

    function applyZoom(newZoom) {
      _pdfZoom = newZoom;
      wrap.innerHTML = '<div class="pdf-loading"><div class="pdf-spinner"></div><span>Re-rendering…</span></div>';
      clearTimeout(_renderTimer);
      _renderTimer = setTimeout(function() { _renderAllPages(pdf, wrap); }, 50);
    }

    if (btnOut && !btnOut._bound) {
      btnOut._bound = true;
      btnOut.addEventListener('click', function() {
        var cur = _pdfZoom < 0 ? _fitZoom : _pdfZoom;
        var next = parseFloat((cur - 0.25).toFixed(2));
        // If zooming out would go to or below fit-width, snap to fit instead
        if (next <= _fitZoom) {
          applyZoom(-1);
        } else {
          applyZoom(next);
        }
      });
    }
    if (btnIn && !btnIn._bound) {
      btnIn._bound = true;
      btnIn.addEventListener('click', function() {
        // When currently at fit-width, start from a clean 25% step above fitZoom
        var cur  = _pdfZoom < 0 ? _fitZoom : _pdfZoom;
        var next = parseFloat((cur + 0.25).toFixed(2));
        applyZoom(Math.min(4.0, next));
      });
    }
    if (btnFit && !btnFit._bound) {
      btnFit._bound = true;
      btnFit.addEventListener('click', function() { applyZoom(-1); });
    }

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
