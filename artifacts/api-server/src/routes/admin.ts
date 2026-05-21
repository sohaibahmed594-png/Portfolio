import { Router } from "express";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import pkg from "pg";
const { Pool } = pkg;

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Init DB ───────────────────────────────────────────────────────────────────

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      public_id TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS site_meta (
      slot TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      public_id TEXT
    );
  `);
}
initDB().catch(console.error);

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryEntry {
  id: string;
  url: string;
  title: string;
  source: "local" | "cloudinary";
  publicId?: string;
}

// ── Gallery store ─────────────────────────────────────────────────────────────

async function loadGallery(): Promise<GalleryEntry[]> {
  const res = await pool.query("SELECT * FROM gallery ORDER BY sort_order ASC");
  return res.rows.map((r) => ({ id: r.id, url: r.url, title: r.title, source: r.source, publicId: r.public_id }));
}

async function saveGalleryEntry(entry: GalleryEntry, order: number) {
  await pool.query(
    `INSERT INTO gallery (id, url, title, source, public_id, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET url=$2, title=$3, source=$4, public_id=$5, sort_order=$6`,
    [entry.id, entry.url, entry.title, entry.source, entry.publicId ?? null, order]
  );
}

async function deleteGalleryEntry(id: string) {
  await pool.query("DELETE FROM gallery WHERE id=$1", [id]);
}

// ── Credentials ───────────────────────────────────────────────────────────────

const DEFAULT_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || "hunter",
  password: process.env.ADMIN_PASSWORD || "hunter123",
};

function loadCredentials() { return DEFAULT_CREDENTIALS; }

// ── Cloudinary helpers ────────────────────────────────────────────────────────

function cloudinaryUpload(buffer: Buffer, folder: string, publicId?: string): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const opts: Record<string, unknown> = { folder, overwrite: true };
    if (publicId) opts.public_id = publicId;
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

async function cloudinaryDelete(publicId: string) {
  try { await cloudinary.uploader.destroy(publicId); } catch {}
}

// ── Multer ────────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only image files allowed"));
  },
});

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post("/admin/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
  const creds = loadCredentials();
  if (username === creds.username && password === creds.password) {
    res.json({ success: true, username: creds.username });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

router.post("/admin/change-password", (req, res) => {
  res.json({ success: true });
});

// ── Gallery ───────────────────────────────────────────────────────────────────

router.get("/admin/images", async (_req, res) => {
  const gallery = await loadGallery();
  res.json({ images: gallery.map((e) => ({ url: e.url, filename: e.id, title: e.title })) });
});

router.post("/admin/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const ext      = path.extname(req.file.originalname);
    const baseName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const entryId  = `${baseName}${ext}`;
    const title    = path.basename(req.file.originalname, ext);
    const { url, publicId } = await cloudinaryUpload(req.file.buffer, "portfolio", baseName);
    const gallery = await loadGallery();
    const entry: GalleryEntry = { id: entryId, url, title, source: "cloudinary", publicId };
    await saveGalleryEntry(entry, gallery.length);
    res.json({ url, filename: entryId, title });
  } catch {
    res.status(500).json({ error: "Upload to Cloudinary failed" });
  }
});

router.put("/admin/images/order", async (req, res) => {
  const { order } = req.body as { order?: string[] };
  if (!Array.isArray(order)) { res.status(400).json({ error: "order must be an array" }); return; }
  for (let i = 0; i < order.length; i++) {
    await pool.query("UPDATE gallery SET sort_order=$1 WHERE id=$2", [i, order[i]]);
  }
  res.json({ success: true });
});

router.patch("/admin/images/:filename", async (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }
  await pool.query("UPDATE gallery SET title=$1 WHERE id=$2", [title.trim(), req.params.filename]);
  res.json({ success: true, title: title.trim() });
});

router.delete("/admin/images/:filename", async (req, res) => {
  const gallery = await loadGallery();
  const entry = gallery.find((e) => e.id === req.params.filename);
  if (!entry) { res.status(404).json({ error: "Image not found" }); return; }
  if (entry.source === "cloudinary" && entry.publicId) await cloudinaryDelete(entry.publicId);
  await deleteGalleryEntry(req.params.filename);
  res.json({ success: true });
});

// ── Site images ───────────────────────────────────────────────────────────────

router.get("/admin/site-images", async (_req, res) => {
  const result = await pool.query("SELECT * FROM site_meta");
  const meta: Record<string, { url: string; publicId?: string }> = {};
  result.rows.forEach((r) => { meta[r.slot] = { url: r.url, publicId: r.public_id }; });
  res.json(meta);
});

router.post("/admin/site-images/:slot", upload.single("photo"), async (req, res) => {
  const slot = req.params.slot as "hero" | "about";
  if (!["hero", "about"].includes(slot)) { res.status(400).json({ error: "Invalid slot" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const existing = await pool.query("SELECT public_id FROM site_meta WHERE slot=$1", [slot]);
    if (existing.rows[0]?.public_id) await cloudinaryDelete(existing.rows[0].public_id);
    const { url, publicId } = await cloudinaryUpload(req.file.buffer, "portfolio/site", slot);
    await pool.query(
      "INSERT INTO site_meta (slot, url, public_id) VALUES ($1,$2,$3) ON CONFLICT (slot) DO UPDATE SET url=$2, public_id=$3",
      [slot, url, publicId]
    );
    res.json({ url, filename: publicId });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;