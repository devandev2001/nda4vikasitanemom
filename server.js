/**
 * Vikasita Nemom – Express Backend Server
 */

const express  = require('express');
const session  = require('express-session');
const multer   = require('multer');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Ensure directories exist (safe for serverless read-only FS) ─────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const DATA_FILE   = path.join(__dirname, 'data', 'content.json');

[UPLOADS_DIR, path.join(__dirname, 'data')].forEach(dir => {
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
  catch (_) { /* read-only FS on serverless — uploads/data won't persist anyway */ }
});

// ─── Default content ─────────────────────────────────────────────────────────
const DEFAULT_CONTENT = {
  bannerHeadline:   'വികസിത നേമം',
  bannerSubtext:    'മാറ്റം തുടങ്ങാം – നേമത്ത് നിന്ന്',
  bannerVideoUrl:   '',
  bgAudioUrl:       '',
  logoUrl:          '/images/logo-default.svg',
  manifestoTitle:   'ഇതാണ് മാറ്റം, ഇതാണ് വികസിത നേമം',
  manifestoSub:     'മാറാത്തത് മാറും. ഇനി നേമം വളരും.',
  manifestoCtaText: 'NDA 2026 മാർഗരേഖ കാണാൻ താഴെ ക്ലിക്ക് ചെയ്യുക',
  aboutTitle:       'നേമം – ഒരു പ്രതിജ്ഞ',
  aboutText:        'നേമം മണ്ഡലത്തിലെ ഓരോ കുടുംബത്തിനും ഒരു നല്ല ഭാവി ഉറപ്പ് നൽകുന്ന NDA-യുടെ പ്രതിബദ്ധത.',
  footerAboutText:  'NDA-നേമം — ഒരു ദൃഢവിശ്വാസം, വികസിത നേമം ലക്ഷ്യമാക്കുന്ന പ്രതിജ്ഞാബദ്ധ പ്രസ്ഥാനം.',
  socialLinks:      { facebook: '', twitter: '', youtube: '', instagram: '' },
  pdfs:             []
};

function readContent() {
  if (!fs.existsSync(DATA_FILE)) { writeContent(DEFAULT_CONTENT); return { ...DEFAULT_CONTENT }; }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { ...DEFAULT_CONTENT }; }
}

function writeContent(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Admin credentials ───────────────────────────────────────────────────────
const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH ||
  bcrypt.hashSync(process.env.ADMIN_PASS || 'nemom2026', 10);

// ─── Multer: wrap callback in Promise ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  }
});

function makeUpload(options) {
  const upload = multer({ storage, ...options });
  return (fieldName) => (req, res) => new Promise((resolve, reject) => {
    upload.single(fieldName)(req, res, (err) => { if (err) reject(err); else resolve(); });
  });
}

const videoUpload = makeUpload({
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    file.mimetype.startsWith('video/')
      ? cb(null, true) : cb(new Error('Only video files allowed (MP4, WebM)'));
  }
});

const imageUpload = makeUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['image/svg+xml','image/png','image/jpeg','image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only image files allowed (SVG, PNG, JPG, WEBP)'));
  }
});

const pdfUpload = makeUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    file.mimetype === 'application/pdf'
      ? cb(null, true) : cb(new Error('Only PDF files allowed'));
  }
});

const audioUpload = makeUpload({
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/aac','audio/x-wav'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only audio files allowed (MP3, WAV, OGG, AAC)'));
  }
});

// ─── Core middleware ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nemom-secret-2026-xk9',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// ─── Auth ────────────────────────────────────────────────────────────────────
function isLoggedIn(req) { return !!(req.session && req.session.admin); }

function requireAuth(req, res, next) {
  if (isLoggedIn(req)) return next();
  // API / XHR → 401 JSON
  if (req.path.startsWith('/api/') || req.xhr ||
      (req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
    return res.status(401).json({ ok: false, message: 'Not authenticated. Please login.' });
  }
  return res.redirect('/admin/login.html');
}

// ─── Static files ────────────────────────────────────────────────────────────
// Block direct access to admin HTML via static — force through the protected route
app.use('/admin', (req, res, next) => {
  const file = req.path.replace(/^\//, '').toLowerCase();
  // Allow login page and static assets (non-html files) to pass through
  if (file === 'login.html' || (file !== '' && !file.endsWith('.html'))) return next();
  // /admin/, /admin/index.html, or any other .html → require auth
  if (!isLoggedIn(req)) return res.redirect('/admin/login.html');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ ok: false, message: 'Username and password required' });
  if (username === ADMIN_USER && bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    req.session.admin = true;
    return req.session.save(() => res.json({ ok: true }));
  }
  res.status(401).json({ ok: false, message: 'Invalid username or password' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login.html'));
});

app.get('/admin/check', (req, res) => res.json({ ok: isLoggedIn(req) }));

// ─── Admin HTML (protected) ───────────────────────────────────────────────────
app.get(['/admin', '/admin/', '/admin/index.html'], requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ─── Public API ───────────────────────────────────────────────────────────────
app.get('/api/content', (_req, res) => res.json(readContent()));

// ─── Admin API ────────────────────────────────────────────────────────────────

app.post('/api/content/texts', requireAuth, (req, res) => {
  const content = readContent();
  ['bannerHeadline','bannerSubtext','manifestoTitle','manifestoSub',
   'manifestoCtaText','aboutTitle','aboutText','footerAboutText'].forEach(f => {
    if (req.body[f] !== undefined) content[f] = req.body[f];
  });
  writeContent(content);
  res.json({ ok: true });
});

app.post('/api/content/social', requireAuth, (req, res) => {
  const content = readContent();
  content.socialLinks = {
    facebook:  req.body.facebook  || '',
    twitter:   req.body.twitter   || '',
    youtube:   req.body.youtube   || '',
    instagram: req.body.instagram || ''
  };
  writeContent(content);
  res.json({ ok: true });
});

app.post('/api/upload/video', requireAuth, async (req, res) => {
  try {
    await videoUpload('video')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No video file received' });
    const content = readContent();
    if (content.bannerVideoUrl && content.bannerVideoUrl.startsWith('/uploads/')) {
      const old = path.join(__dirname, 'public', content.bannerVideoUrl);
      if (fs.existsSync(old)) fs.unlink(old, () => {});
    }
    content.bannerVideoUrl = '/uploads/' + req.file.filename;
    writeContent(content);
    res.json({ ok: true, url: content.bannerVideoUrl });
  } catch (err) {
    console.error('Video upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/upload/logo', requireAuth, async (req, res) => {
  try {
    await imageUpload('logo')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No image file received' });
    const content = readContent();
    if (content.logoUrl && content.logoUrl.startsWith('/uploads/')) {
      const old = path.join(__dirname, 'public', content.logoUrl);
      if (fs.existsSync(old)) fs.unlink(old, () => {});
    }
    content.logoUrl = '/uploads/' + req.file.filename;
    writeContent(content);
    res.json({ ok: true, url: content.logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/upload/audio', requireAuth, async (req, res) => {
  try {
    await audioUpload('audio')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No audio file received' });
    const content = readContent();
    if (content.bgAudioUrl && content.bgAudioUrl.startsWith('/uploads/')) {
      const old = path.join(__dirname, 'public', content.bgAudioUrl);
      if (fs.existsSync(old)) fs.unlink(old, () => {});
    }
    content.bgAudioUrl = '/uploads/' + req.file.filename;
    writeContent(content);
    res.json({ ok: true, url: content.bgAudioUrl });
  } catch (err) {
    console.error('Audio upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/upload/pdf', requireAuth, async (req, res) => {
  try {
    await pdfUpload('pdf')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No PDF file received' });
    const label   = (req.body.label || 'Manifesto').trim();
    const content = readContent();
    if (!Array.isArray(content.pdfs)) content.pdfs = [];
    content.pdfs.push({ label, url: '/uploads/' + req.file.filename, uploadedAt: new Date().toISOString() });
    writeContent(content);
    res.json({ ok: true, url: '/uploads/' + req.file.filename, label });
  } catch (err) {
    console.error('PDF upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.delete('/api/content/pdf/:idx', requireAuth, (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const content = readContent();
  if (!Array.isArray(content.pdfs) || isNaN(idx) || idx < 0 || idx >= content.pdfs.length)
    return res.status(404).json({ ok: false, message: 'PDF not found' });
  const [removed] = content.pdfs.splice(idx, 1);
  if (removed.url && removed.url.startsWith('/uploads/')) {
    const fp = path.join(__dirname, 'public', removed.url);
    if (fs.existsSync(fp)) fs.unlink(fp, () => {});
  }
  writeContent(content);
  res.json({ ok: true });
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: err.message || 'Internal server error' });
});

// ─── Start (local dev) / Export (Vercel serverless) ──────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n✅  Vikasita Nemom server running!');
    console.log(`   Website  →  http://localhost:${PORT}`);
    console.log(`   Admin    →  http://localhost:${PORT}/admin/`);
    console.log(`\n   Username: ${ADMIN_USER}`);
    console.log(`   Password: ${process.env.ADMIN_PASS || 'nemom2026'}\n`);
  });
}

module.exports = app;
