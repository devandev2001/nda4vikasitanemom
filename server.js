/**
 * Vikasita Nemom – Express Backend
 * Storage  : Firebase Storage  (files)
 * Database : Firebase Firestore (content)
 * Hosting  : Vercel serverless
 */

const express        = require('express');
const multer         = require('multer');
const bcrypt         = require('bcryptjs');
const path           = require('path');
const jwt            = require('jsonwebtoken');
const admin          = require('firebase-admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Firebase init ────────────────────────────────────────────────────────────
// On Vercel: set FIREBASE_SERVICE_ACCOUNT env var to the JSON string of your
// service account key. Set FIREBASE_STORAGE_BUCKET to e.g. your-project.appspot.com
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  if (serviceAccount) {
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else {
    admin.initializeApp({ storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '' });
  }
}

const db     = admin.firestore();
const bucket = admin.storage().bucket();
const CONTENT_DOC = db.collection('site').doc('content');

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

async function readContent() {
  try {
    const snap = await CONTENT_DOC.get();
    if (!snap.exists) { await CONTENT_DOC.set(DEFAULT_CONTENT); return { ...DEFAULT_CONTENT }; }
    return { ...DEFAULT_CONTENT, ...snap.data() };
  } catch (e) {
    console.error('Firestore read error:', e.message);
    return { ...DEFAULT_CONTENT };
  }
}

async function writeContent(data) {
  await CONTENT_DOC.set(data, { merge: true });
}

// ─── Admin credentials ───────────────────────────────────────────────────────
const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH ||
  bcrypt.hashSync(process.env.ADMIN_PASS || 'nemom2026', 10);
const JWT_SECRET = process.env.SESSION_SECRET || 'nemom-secret-2026-xk9';

// ─── Multer: memory storage (buffer → Firebase Storage) ──────────────────────
const memStorage = multer.memoryStorage();

function makeUpload(options) {
  const upload = multer({ storage: memStorage, ...options });
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

// ─── Firebase Storage helpers ─────────────────────────────────────────────────
async function uploadToFirebase(file, folder) {
  const ext      = path.extname(file.originalname).toLowerCase();
  const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const blob     = bucket.file(filename);

  await blob.save(file.buffer, {
    metadata: { contentType: file.mimetype },
    public: true
  });

  // makePublic() ensures the object ACL is set
  await blob.makePublic();

  // Always use storage.googleapis.com — works for both .appspot.com and .firebasestorage.app buckets
  const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
  const url = `https://storage.googleapis.com/${bucket.name}/${encodedFilename}`;
  return { url, filename };
}

async function deleteFromFirebase(url) {
  if (!url) return;
  try {
    // Handle both storage.googleapis.com and firebasestorage.googleapis.com URLs
    const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
    if (match) await bucket.file(decodeURIComponent(match[1])).delete();
  } catch (_) { /* file may already be gone */ }
}

// ─── Core middleware ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Disable body parsing for upload routes — multer handles it directly
app.use('/api/upload', (req, res, next) => {
  req.socket.setTimeout(120000); // 2 min timeout for large uploads
  next();
});

// ─── Auth ────────────────────────────────────────────────────────────────────
function getToken(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // 2) x-admin-token header (fallback)
  return req.headers['x-admin-token'] || null;
}

function isLoggedIn(req) {
  const token = getToken(req);
  if (!token) return false;
  try { jwt.verify(token, JWT_SECRET); return true; }
  catch { return false; }
}

function requireAuth(req, res, next) {
  if (isLoggedIn(req)) return next();
  return res.status(401).json({ ok: false, message: 'Not authenticated. Please login.' });
}

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ ok: false, message: 'Username and password required' });
  if (username === ADMIN_USER && bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ ok: true, token });
  }
  res.status(401).json({ ok: false, message: 'Invalid username or password' });
});

app.get('/admin/logout', (_req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin/check', (req, res) => res.json({ ok: isLoggedIn(req) }));

// ─── Admin HTML (protected) ───────────────────────────────────────────────────
// Admin HTML is served as static; client-side JS handles auth redirect via /admin/check
app.get(['/admin', '/admin/'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ─── Public API ───────────────────────────────────────────────────────────────
app.get('/api/content', async (_req, res) => {
  res.json(await readContent());
});

// ─── Save URL endpoints (for direct Firebase browser uploads) ─────────────────
// Browser uploads file directly to Firebase Storage, then calls these to save the URL
app.post('/api/save/video', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, message: 'No URL provided' });
    const content = await readContent();
    content.bannerVideoUrl = url;
    await writeContent(content);
    res.json({ ok: true, url });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

app.post('/api/save/audio', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, message: 'No URL provided' });
    const content = await readContent();
    content.bgAudioUrl = url;
    await writeContent(content);
    res.json({ ok: true, url });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

// ─── Admin API ────────────────────────────────────────────────────────────────

app.post('/api/content/texts', requireAuth, async (req, res) => {
  try {
    const content = await readContent();
    ['bannerHeadline','bannerSubtext','manifestoTitle','manifestoSub',
     'manifestoCtaText','aboutTitle','aboutText','footerAboutText'].forEach(f => {
      if (req.body[f] !== undefined) content[f] = req.body[f];
    });
    await writeContent(content);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

app.post('/api/content/social', requireAuth, async (req, res) => {
  try {
    const content = await readContent();
    content.socialLinks = {
      facebook:  req.body.facebook  || '',
      twitter:   req.body.twitter   || '',
      youtube:   req.body.youtube   || '',
      instagram: req.body.instagram || ''
    };
    await writeContent(content);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

app.post('/api/upload/video', requireAuth, async (req, res) => {
  try {
    await videoUpload('video')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No video file received' });
    const content = await readContent();
    await deleteFromFirebase(content.bannerVideoUrl);
    const { url } = await uploadToFirebase(req.file, 'videos');
    content.bannerVideoUrl = url;
    await writeContent(content);
    res.json({ ok: true, url });
  } catch (err) {
    console.error('Video upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/upload/logo', requireAuth, async (req, res) => {
  try {
    await imageUpload('logo')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No image file received' });
    const content = await readContent();
    await deleteFromFirebase(content.logoUrl);
    const { url } = await uploadToFirebase(req.file, 'logos');
    content.logoUrl = url;
    await writeContent(content);
    res.json({ ok: true, url });
  } catch (err) {
    console.error('Logo upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/upload/audio', requireAuth, async (req, res) => {
  try {
    await audioUpload('audio')(req, res);
    if (!req.file) return res.status(400).json({ ok: false, message: 'No audio file received' });
    const content = await readContent();
    await deleteFromFirebase(content.bgAudioUrl);
    const { url } = await uploadToFirebase(req.file, 'audio');
    content.bgAudioUrl = url;
    await writeContent(content);
    res.json({ ok: true, url });
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
    const content = await readContent();
    if (!Array.isArray(content.pdfs)) content.pdfs = [];
    const { url } = await uploadToFirebase(req.file, 'pdfs');
    content.pdfs.push({ label, url, uploadedAt: new Date().toISOString() });
    await writeContent(content);
    res.json({ ok: true, url, label });
  } catch (err) {
    console.error('PDF upload error:', err.message);
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.delete('/api/content/pdf/:idx', requireAuth, async (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    const content = await readContent();
    if (!Array.isArray(content.pdfs) || isNaN(idx) || idx < 0 || idx >= content.pdfs.length)
      return res.status(404).json({ ok: false, message: 'PDF not found' });
    const [removed] = content.pdfs.splice(idx, 1);
    await deleteFromFirebase(removed.url);
    await writeContent(content);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
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
