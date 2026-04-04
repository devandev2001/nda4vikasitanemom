/* =========================================================
   VIKASITA NEMOM – Main Frontend JS
   ========================================================= */

// ── Preloader ──
window.addEventListener('load', () => {
  const pre = document.getElementById('preloader');
  if (pre) {
    setTimeout(() => { pre.style.opacity = '0'; setTimeout(() => pre.remove(), 400); }, 400);
  }
  loadSiteContent();
});

// ── Load dynamic content from API ──
async function loadSiteContent() {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();
    applySiteContent(data);
  } catch (e) {
    console.warn('Could not load dynamic content, using defaults.');
  }
}

function applySiteContent(data) {
  setEl('banner-headline', data.bannerHeadline);
  setEl('banner-subtext',  data.bannerSubtext);

  // Banner video — always muted
  const vid = document.getElementById('bannerVideo');
  const src = document.getElementById('bannerVideoSrc');
  if (vid && src && data.bannerVideoUrl) {
    vid.muted = true;
    src.src   = data.bannerVideoUrl;
    vid.load();
    vid.play().catch(() => {});
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
   Inline PDF Viewer — iframe-based (scrollable, mobile-friendly)
   ───────────────────────────────────────────────────────── */

window.loadInlinePdf = function (url, label) {
  const viewer  = document.getElementById('manifestoViewer');
  const frame   = document.getElementById('manifestoFrame');
  const titleEl = document.getElementById('manifestoBarTitle');
  const dlBtn   = document.getElementById('manifestoDlBtn');
  if (!viewer || !frame) return;

  viewer.style.display = 'block';
  if (titleEl) titleEl.textContent = label || '';
  if (dlBtn)   { dlBtn.href = url; dlBtn.setAttribute('download', label || 'manifesto.pdf'); }

  // Use Google Docs Viewer to embed PDF — avoids cross-origin iframe block in Chrome
  var viewerUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(url);
  frame.src = viewerUrl;

  // Highlight active tab
  document.querySelectorAll('.pdf-tab-btn').forEach(b => b.classList.remove('active'));
  const tab = document.querySelector(`.pdf-tab-btn[data-url="${url}"]`);
  if (tab) tab.classList.add('active');
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
