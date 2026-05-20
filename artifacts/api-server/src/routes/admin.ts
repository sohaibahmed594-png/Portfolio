import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDir = path.resolve(process.cwd(), "uploads");
const siteDir    = path.join(uploadsDir, "site");

for (const dir of [uploadsDir, siteDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const galleryFile     = path.join(uploadsDir, "gallery.json");
const siteMetaFile    = path.join(siteDir, "meta.json");
const credentialsFile = path.join(uploadsDir, "credentials.json");

// Legacy files — used only for one-time migration
const legacyTitlesFile = path.join(uploadsDir, "titles.json");
const legacyOrderFile  = path.join(uploadsDir, "order.json");

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryEntry {
  id: string;                         // slash-free filename-style key
  url: string;                        // Cloudinary URL or /api/uploads/...
  title: string;
  source: "local" | "cloudinary";
  publicId?: string;                  // Cloudinary public_id (may include folder)
}

interface SiteMeta {
  hero?:  { url: string; publicId?: string; filename?: string };
  about?: { url: string; publicId?: string; filename?: string };
}

interface Credentials { username: string; password: string; }

// ── Gallery store ─────────────────────────────────────────────────────────────

function loadGallery(): GalleryEntry[] {
  if (!fs.existsSync(galleryFile)) return migrateFromLegacy();
  try { return JSON.parse(fs.readFileSync(galleryFile, "utf-8")); } catch { return []; }
}

function saveGallery(entries: GalleryEntry[]) {
  fs.writeFileSync(galleryFile, JSON.stringify(entries, null, 2));
}

function migrateFromLegacy(): GalleryEntry[] {
  let titles: Record<string, string> = {};
  let order: string[] = [];
  try { if (fs.existsSync(legacyTitlesFile)) titles = JSON.parse(fs.readFileSync(legacyTitlesFile, "utf-8")); } catch {}
  try { if (fs.existsSync(legacyOrderFile))  order  = JSON.parse(fs.readFileSync(legacyOrderFile,  "utf-8")); } catch {}

  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  const excluded  = new Set(["titles.json", "order.json", "credentials.json", "gallery.json", "site"]);
  const allFiles  = fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir).filter((f) => !excluded.has(f) && imageExts.has(path.extname(f).toLowerCase()))
    : [];

  const allSet   = new Set(allFiles);
  const ordered  = [...order.filter((f) => allSet.has(f)), ...allFiles.filter((f) => !order.includes(f))];
  const entries: GalleryEntry[] = ordered.map((f) => ({
    id: f,
    url: `/api/uploads/${f}`,
    title: titles[f] ?? path.basename(f, path.extname(f)),
    source: "local" as const,
  }));

  saveGallery(entries);
  return entries;
}

// ── Site meta ─────────────────────────────────────────────────────────────────

function loadSiteMeta(): SiteMeta {
  if (!fs.existsSync(siteMetaFile)) return {};
  try { return JSON.parse(fs.readFileSync(siteMetaFile, "utf-8")); } catch { return {}; }
}
function saveSiteMeta(meta: SiteMeta) {
  fs.writeFileSync(siteMetaFile, JSON.stringify(meta, null, 2));
}

// ── Credentials ───────────────────────────────────────────────────────────────

const DEFAULT_CREDENTIALS: Credentials = { username: "hunter", password: "hunter123" };

function loadCredentials(): Credentials {
  if (!fs.existsSync(credentialsFile)) return { ...DEFAULT_CREDENTIALS };
  try { return JSON.parse(fs.readFileSync(credentialsFile, "utf-8")); } catch { return { ...DEFAULT_CREDENTIALS }; }
}
function saveCredentials(creds: Credentials) {
  fs.writeFileSync(credentialsFile, JSON.stringify(creds, null, 2));
}

// ── Cloudinary helpers ────────────────────────────────────────────────────────

function cloudinaryUpload(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
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

async function cloudinaryDelete(publicId: string): Promise<void> {
  try { await cloudinary.uploader.destroy(publicId); } catch {}
}

// ── Multer ────────────────────────────────────────────────────────────────────

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFilter,
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
  const { currentPassword, newUsername, newPassword } = req.body as {
    currentPassword?: string; newUsername?: string; newPassword?: string;
  };
  if (!currentPassword) { res.status(400).json({ error: "Current password required" }); return; }
  const creds = loadCredentials();
  if (currentPassword !== creds.password) { res.status(401).json({ error: "Current password is incorrect" }); return; }
  const updated: Credentials = {
    username: newUsername?.trim() || creds.username,
    password: newPassword?.trim() || creds.password,
  };
  saveCredentials(updated);
  res.json({ success: true, username: updated.username });
});

// ── Gallery ───────────────────────────────────────────────────────────────────

router.get("/admin/images", (_req, res) => {
  const gallery = loadGallery();
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

    const entry: GalleryEntry = { id: entryId, url, title, source: "cloudinary", publicId };
    const gallery = loadGallery();
    gallery.push(entry);
    saveGallery(gallery);

    res.json({ url, filename: entryId, title });
  } catch {
    res.status(500).json({ error: "Upload to Cloudinary failed" });
  }
});

router.put("/admin/images/order", (req, res) => {
  const { order } = req.body as { order?: string[] };
  if (!Array.isArray(order)) { res.status(400).json({ error: "order must be an array" }); return; }
  const gallery = loadGallery();
  const byId    = new Map(gallery.map((e) => [e.id, e]));
  const inOrder = new Set(order);
  const reordered = [
    ...order.map((id) => byId.get(id)).filter((e): e is GalleryEntry => !!e),
    ...gallery.filter((e) => !inOrder.has(e.id)),
  ];
  saveGallery(reordered);
  res.json({ success: true });
});

router.patch("/admin/images/:filename", (req, res) => {
  const id      = req.params.filename;
  const gallery = loadGallery();
  const entry   = gallery.find((e) => e.id === id);
  if (!entry) { res.status(404).json({ error: "Image not found" }); return; }
  const { title } = req.body as { title?: string };
  if (!title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }
  entry.title = title.trim();
  saveGallery(gallery);
  res.json({ success: true, title: entry.title });
});

router.delete("/admin/images/:filename", async (req, res) => {
  const id      = req.params.filename;
  const gallery = loadGallery();
  const idx     = gallery.findIndex((e) => e.id === id);
  if (idx === -1) { res.status(404).json({ error: "Image not found" }); return; }
  const entry = gallery[idx];

  if (entry.source === "cloudinary" && entry.publicId) {
    await cloudinaryDelete(entry.publicId);
  } else if (entry.source === "local") {
    const fp = path.join(uploadsDir, entry.id);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  gallery.splice(idx, 1);
  saveGallery(gallery);
  res.json({ success: true });
});

// ── Site images ───────────────────────────────────────────────────────────────

router.get("/admin/site-images", (_req, res) => {
  res.json(loadSiteMeta());
});

router.post("/admin/site-images/:slot", upload.single("photo"), async (req, res) => {
  const slot = req.params.slot as "hero" | "about";
  if (!["hero", "about"].includes(slot)) { res.status(400).json({ error: "Invalid slot" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const meta = loadSiteMeta();
    if (meta[slot]?.publicId) await cloudinaryDelete(meta[slot]!.publicId!);

    const { url, publicId } = await cloudinaryUpload(req.file.buffer, "portfolio/site", slot);
    meta[slot] = { url, publicId };
    saveSiteMeta(meta);
    res.json({ url, filename: publicId });
  } catch {
    res.status(500).json({ error: "Upload to Cloudinary failed" });
  }
});

export default router;
