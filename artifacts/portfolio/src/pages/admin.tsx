import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Trash2,
  Check,
  X,
  Upload,
  ImageIcon,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SESSION_KEY = "portfolio_admin_session";
const SESSION_USER_KEY = "portfolio_admin_user";

type Tab = "gallery" | "hero" | "about" | "settings";

interface UploadedImage {
  url: string;
  filename: string;
  title: string;
}
interface SiteMeta {
  hero?: { url: string; filename: string };
  about?: { url: string; filename: string };
}

function getStoredLogin(): { loggedIn: boolean; username: string } {
  return {
    loggedIn: localStorage.getItem(SESSION_KEY) === "1",
    username: localStorage.getItem(SESSION_USER_KEY) ?? "",
  };
}

// ── Sortable card ─────────────────────────────────────────────────────────────

function SortableImageCard({
  img,
  onDelete,
  onRename,
}: {
  img: UploadedImage;
  onDelete: (filename: string) => void;
  onRename: (filename: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(img.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.filename });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  function submitRename() {
    if (draft.trim() && draft.trim() !== img.title)
      onRename(img.filename, draft.trim());
    setEditing(false);
  }
  function cancelRename() {
    setDraft(img.title);
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white/5 border border-white/10 overflow-hidden flex flex-col select-none"
    >
      <div className="relative aspect-square overflow-hidden group">
        <img
          src={img.url}
          alt={img.title}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
          draggable={false}
        />
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1.5 bg-black/50 text-white/60 hover:text-white/90 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") cancelRename();
              }}
              autoFocus
              className="flex-1 min-w-0 bg-white/10 border border-white/20 text-white/90 text-xs px-2 py-1.5 outline-none focus:border-white/40 transition-colors"
            />
            <button
              onClick={submitRename}
              className="p-1.5 text-emerald-400/80 hover:text-emerald-400 transition-colors shrink-0"
            >
              <Check size={13} />
            </button>
            <button
              onClick={cancelRename}
              className="p-1.5 text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/60 tracking-wide truncate flex-1 min-w-0">
              {img.title}
            </span>
            <button
              onClick={() => {
                setDraft(img.title);
                setEditing(true);
                setConfirmDelete(false);
              }}
              className="p-1 text-white/25 hover:text-white/70 transition-colors shrink-0"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-red-400/70 tracking-wide flex-1">
              Remove this photo?
            </span>
            <button
              onClick={() => onDelete(img.filename)}
              className="text-[10px] tracking-widest uppercase text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setConfirmDelete(true);
              setEditing(false);
            }}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] tracking-widest uppercase text-red-400/60 hover:text-red-400 border border-red-400/15 hover:border-red-400/40 transition-colors"
          >
            <Trash2 size={11} />
            Delete Photo
          </button>
        )}
      </div>
    </div>
  );
}

// ── Site image section ────────────────────────────────────────────────────────

function SiteImageSection({
  slot,
  label,
  description,
  currentUrl,
  onUploaded,
}: {
  slot: "hero" | "about";
  label: string;
  description: string;
  currentUrl?: string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("photo", file);
    await fetch(`/api/admin/site-images/${slot}`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    onUploaded();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="border border-white/10 p-6 flex flex-col md:flex-row gap-8 items-start">
      <div className="w-full md:w-64 shrink-0">
        <div
          className={`relative overflow-hidden bg-white/5 border border-white/10 ${slot === "hero" ? "aspect-video" : "aspect-[3/4]"}`}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={label}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={24} className="text-white/15" />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <h3 className="text-sm tracking-widest uppercase text-white/70 mb-1">
            {label}
          </h3>
          <p className="text-xs text-white/30 tracking-wide">{description}</p>
        </div>
        {currentUrl && (
          <p className="text-[10px] text-white/25 tracking-wide">
            Currently using a custom image
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          id={`site-upload-${slot}`}
        />
        <label
          htmlFor={`site-upload-${slot}`}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-widest uppercase cursor-pointer transition-colors ${uploading ? "bg-white/5 text-white/30" : "bg-white/10 hover:bg-white/15 text-white/70 hover:text-white/90"}`}
        >
          <Upload size={12} />
          {uploading
            ? "Uploading..."
            : currentUrl
              ? "Replace Image"
              : "Upload Image"}
        </label>
      </div>
    </div>
  );
}

// ── Password field ────────────────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs tracking-widest uppercase text-white/40 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full bg-white/5 border border-white/10 text-white/90 px-4 py-3 pr-11 text-sm outline-none focus:border-white/30 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Admin() {
  const stored = getStoredLogin();
  const [loggedIn, setLoggedIn] = useState(stored.loggedIn);
  const [currentUser, setCurrentUser] = useState(stored.username);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("gallery");
  const [localImages, setLocalImages] = useState<UploadedImage[] | null>(null);

  // Settings form
  const [settingsUsername, setSettingsUsername] = useState("");
  const [settingsCurrent, setSettingsCurrent] = useState("");
  const [settingsNew, setSettingsNew] = useState("");
  const [settingsConfirm, setSettingsConfirm] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Login ──────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginUsername,
        password: loginPassword,
      }),
    });
    setLoginLoading(false);
    if (res.ok) {
      const data = (await res.json()) as { username: string };
      localStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(SESSION_USER_KEY, data.username);
      setCurrentUser(data.username);
      setLoggedIn(true);
      setSettingsUsername(data.username);
    } else {
      setLoginError("Invalid username or password.");
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    setLoggedIn(false);
    setLoginUsername("");
    setLoginPassword("");
  }

  // ── Data queries ───────────────────────────────────────────────────────────

  const { data: galleryData, isLoading: galleryLoading } = useQuery<{
    images: UploadedImage[];
  }>({
    queryKey: ["admin-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/images");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: loggedIn,
  });

  useEffect(() => {
    if (galleryData?.images) setLocalImages(galleryData.images);
  }, [galleryData]);

  const { data: siteData } = useQuery<SiteMeta>({
    queryKey: ["admin-site-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/site-images");
      if (!res.ok) return {};
      return res.json();
    },
    enabled: loggedIn,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/admin/images/${filename}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-images"] });
      setLocalImages(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({
      filename,
      title,
    }: {
      filename: string;
      title: string;
    }) => {
      const res = await fetch(`/api/admin/images/${filename}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Rename failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-images"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (order: string[]) => {
      await fetch("/api/admin/images/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images"] });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("photo", file);
      await fetch("/api/admin/upload", { method: "POST", body: formData });
    }
    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["admin-images"] });
    queryClient.invalidateQueries({ queryKey: ["gallery-images"] });
    setLocalImages(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = localImages ?? galleryData?.images ?? [];
    const oldIndex = current.findIndex((img) => img.filename === active.id);
    const newIndex = current.findIndex((img) => img.filename === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(current, oldIndex, newIndex);
    setLocalImages(reordered);
    reorderMutation.mutate(reordered.map((img) => img.filename));
  }

  function invalidateSite() {
    queryClient.invalidateQueries({ queryKey: ["admin-site-images"] });
    queryClient.invalidateQueries({ queryKey: ["site-images"] });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess(false);
    if (settingsNew && settingsNew !== settingsConfirm) {
      setSettingsError("New passwords do not match.");
      return;
    }
    if (!settingsCurrent) {
      setSettingsError("Current password is required.");
      return;
    }
    setSettingsLoading(true);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: settingsCurrent,
        newUsername: settingsUsername.trim() || undefined,
        newPassword: settingsNew.trim() || undefined,
      }),
    });
    setSettingsLoading(false);
    if (res.ok) {
      const data = (await res.json()) as { username: string };
      localStorage.setItem(SESSION_USER_KEY, data.username);
      setCurrentUser(data.username);
      setSettingsUsername(data.username);
      setSettingsCurrent("");
      setSettingsNew("");
      setSettingsConfirm("");
      setSettingsSuccess(true);
    } else {
      const err = (await res.json()) as { error: string };
      setSettingsError(err.error ?? "Something went wrong.");
    }
  }

  // ── Login screen ───────────────────────────────────────────────────────────

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-light tracking-[0.2em] text-white/80 uppercase mb-10 text-center">
            Admin Access
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs tracking-widest uppercase text-white/40 mb-2"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white/90 px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors"
                autoComplete="username"
              />
            </div>
            <PasswordField
              id="login-password"
              label="Password"
              value={loginPassword}
              onChange={setLoginPassword}
              autoComplete="current-password"
            />
            {loginError && (
              <p className="text-red-400/80 text-xs tracking-wide">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white/80 text-xs tracking-widest uppercase py-3 transition-colors"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const images = localImages ?? galleryData?.images ?? [];
  const tabs: { id: Tab; label: string }[] = [
    { id: "gallery", label: "Gallery" },
    { id: "hero", label: "Home Background" },
    { id: "about", label: "About Portrait" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white/80">
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-sm tracking-[0.25em] uppercase text-white/60">
            Portfolio Admin
          </h1>
          <p className="text-xs tracking-widest uppercase text-white/30 mt-0.5">
            {currentUser}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="/"
            className="text-xs tracking-widest uppercase text-white/40 hover:text-white/70 transition-colors"
          >
            View Site
          </a>
          <button
            onClick={handleLogout}
            className="text-xs tracking-widest uppercase text-white/40 hover:text-white/70 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="border-b border-white/10 px-8">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-xs tracking-widest uppercase transition-colors border-b-[1.5px] -mb-px ${activeTab === tab.id ? "border-white/60 text-white/80" : "border-transparent text-white/30 hover:text-white/60"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-8 py-10 max-w-7xl mx-auto">
        {/* ── Gallery ── */}
        {activeTab === "gallery" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-light tracking-widest uppercase text-white/70">
                  Portfolio Gallery
                </h2>
                <p className="text-xs text-white/30 mt-1 tracking-wide">
                  {images.length} image{images.length !== 1 ? "s" : ""}
                  {images.length > 1 && " — drag the grip handle to reorder"}
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`flex items-center gap-2 px-6 py-3 text-xs tracking-widest uppercase cursor-pointer transition-colors ${uploading ? "bg-white/5 text-white/30" : "bg-white/10 hover:bg-white/15 text-white/70 hover:text-white/90"}`}
                >
                  {uploading ? (
                    <span className="animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <span className="text-lg leading-none">+</span>
                      <span>Add Photo</span>
                    </>
                  )}
                </label>
              </div>
            </div>
            {galleryLoading ? (
              <div className="text-center py-20 text-white/30 text-sm tracking-widest uppercase">
                Loading...
              </div>
            ) : images.length === 0 ? (
              <div className="border border-dashed border-white/10 py-24 text-center">
                <p className="text-white/30 text-sm tracking-widest uppercase mb-2">
                  No photos yet
                </p>
                <p className="text-white/20 text-xs tracking-wide">
                  Click "Add Photo" to upload images from your laptop
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={images.map((img) => img.filename)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {images.map((img) => (
                      <SortableImageCard
                        key={img.filename}
                        img={img}
                        onDelete={(f) => deleteMutation.mutate(f)}
                        onRename={(f, t) =>
                          renameMutation.mutate({ filename: f, title: t })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}

        {/* ── Hero ── */}
        {activeTab === "hero" && (
          <div className="max-w-2xl">
            <div className="mb-8">
              <h2 className="text-lg font-light tracking-widest uppercase text-white/70">
                Home Background
              </h2>
              <p className="text-xs text-white/30 mt-1 tracking-wide">
                Replaces the full-screen image on the landing page
              </p>
            </div>
            <SiteImageSection
              slot="hero"
              label="Hero Background"
              description="Displayed full-screen behind your name on the home page. Works best with wide landscape or atmospheric shots."
              currentUrl={siteData?.hero?.url}
              onUploaded={invalidateSite}
            />
          </div>
        )}

        {/* ── About ── */}
        {activeTab === "about" && (
          <div className="max-w-2xl">
            <div className="mb-8">
              <h2 className="text-lg font-light tracking-widest uppercase text-white/70">
                About Portrait
              </h2>
              <p className="text-xs text-white/30 mt-1 tracking-wide">
                The image shown alongside your bio on the About page
              </p>
            </div>
            <SiteImageSection
              slot="about"
              label="About Portrait"
              description="Displayed in portrait format next to your bio. Works best with a tall image — a photo of yourself or something that represents your style."
              currentUrl={siteData?.about?.url}
              onUploaded={invalidateSite}
            />
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === "settings" && (
          <div className="max-w-md">
            <div className="mb-8">
              <h2 className="text-lg font-light tracking-widest uppercase text-white/70">
                Change Credentials
              </h2>
              <p className="text-xs text-white/30 mt-1 tracking-wide">
                Update your admin username and/or password
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label
                  htmlFor="settings-username"
                  className="block text-xs tracking-widest uppercase text-white/40 mb-2"
                >
                  Username
                  <span className="ml-2 text-white/20 normal-case tracking-normal">
                    leave blank to keep current
                  </span>
                </label>
                <input
                  id="settings-username"
                  type="text"
                  placeholder={currentUser}
                  value={settingsUsername}
                  onChange={(e) => {
                    setSettingsUsername(e.target.value);
                    setSettingsSuccess(false);
                    setSettingsError("");
                  }}
                  autoComplete="username"
                  className="w-full bg-white/5 border border-white/10 text-white/90 placeholder:text-white/20 px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div className="border-t border-white/8 pt-5 space-y-4">
                <PasswordField
                  id="settings-current"
                  label="Current Password"
                  value={settingsCurrent}
                  onChange={(v) => {
                    setSettingsCurrent(v);
                    setSettingsSuccess(false);
                    setSettingsError("");
                  }}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="settings-new"
                  label={`New Password\u00a0\u00a0`}
                  value={settingsNew}
                  onChange={(v) => {
                    setSettingsNew(v);
                    setSettingsSuccess(false);
                    setSettingsError("");
                  }}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="settings-confirm"
                  label="Confirm New Password"
                  value={settingsConfirm}
                  onChange={(v) => {
                    setSettingsConfirm(v);
                    setSettingsSuccess(false);
                    setSettingsError("");
                  }}
                  autoComplete="new-password"
                />
              </div>

              {settingsError && (
                <p className="text-red-400/80 text-xs tracking-wide">
                  {settingsError}
                </p>
              )}
              {settingsSuccess && (
                <p className="text-emerald-400/80 text-xs tracking-wide">
                  Credentials updated successfully.
                </p>
              )}

              <button
                type="submit"
                disabled={settingsLoading}
                className="w-full bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white/80 text-xs tracking-widest uppercase py-3 transition-colors"
              >
                {settingsLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
