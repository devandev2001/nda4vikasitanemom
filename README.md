# Vikasita Nemom – Campaign Website

A full-stack campaign website for **Vikasita Nemom** with:
- 🎥 Full-screen banner video
- 📄 Manifesto/PDF viewer (flip-through)
- 🔐 Admin Control Panel to update all content
- 📤 Upload video, logo, and PDFs via browser
- 💾 All content stored in `data/content.json`

---

## 🚀 Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# Or with auto-reload (development)
npm run dev
```

Then open:
- **Website:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin/

**Default admin credentials:**
- Username: `admin`
- Password: `nemom2026`

---

## 🔐 Change Admin Password

Before going live, change the password by setting environment variables:

```bash
ADMIN_USER=yourusername ADMIN_PASS=yourpassword node server.js
```

Or create a `.env` file:

```
ADMIN_USER=admin
ADMIN_PASS=YourStrongPassword123
SESSION_SECRET=a-long-random-string
```

---

## 📁 Project Structure

```
vikasita-nemom/
├── server.js              # Node.js/Express backend
├── package.json
├── data/
│   └── content.json       # All site content (auto-created)
└── public/
    ├── index.html          # Main website
    ├── css/
    │   ├── style.css       # Website styles
    │   └── admin.css       # Admin panel styles
    ├── js/
    │   ├── main.js         # Website JS
    │   └── admin.js        # Admin JS
    ├── admin/
    │   ├── index.html      # Admin dashboard
    │   └── login.html      # Admin login
    ├── images/
    │   └── logo-default.svg
    └── uploads/            # Uploaded files (auto-created)
```

---

## 🛠 Admin Panel Features

| Feature | Description |
|---|---|
| **Banner Video** | Upload MP4 video shown as fullscreen banner |
| **Text Content** | Edit all headlines, subtitles, about text |
| **Logo** | Upload SVG/PNG logo |
| **Manifestos/PDFs** | Upload multiple PDFs with custom labels |
| **Social Links** | Set Facebook, Twitter, YouTube, Instagram URLs |

---

## 🌐 Deployment

For production, deploy on any Node.js host:
- **Railway** (free tier)
- **Render** (free tier)
- **VPS with PM2:** `pm2 start server.js --name nemom`
