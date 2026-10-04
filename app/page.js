"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
  Users,
  X,
} from "lucide-react";
import { can, canAccess } from "@/lib/permissions";
import {
  clearCache,
  ensureData,
  getCached,
  prefetch,
  setCached,
  useCachedFetch,
} from "@/lib/useCachedFetch";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, key: "Dashboard" },
  { label: "Data Obat", icon: Package, key: "Data Obat" },
  { label: "Kategori Obat", icon: Boxes, key: "Kategori Obat" },
  { label: "Batch Obat", icon: Package, key: "Batch Obat" },
  { label: "Supplier", icon: Truck, key: "Supplier" },
  { label: "Lokasi Penyimpanan", icon: MapPin, key: "Lokasi Penyimpanan" },
  { label: "Stok Masuk", icon: ArrowDownToLine, key: "Stok Masuk" },
  { label: "Stok Keluar", icon: ArrowUpRight, key: "Stok Keluar" },
  {
    label: "Penyesuaian Stok",
    icon: SlidersHorizontal,
    key: "Penyesuaian Stok",
  },
  { label: "Kondisi Stok", icon: ShieldAlert, key: "Kondisi Stok" },
  { label: "Stok Menipis", icon: AlertTriangle, key: "Stok Menipis" },
  { label: "Akan Expired", icon: Clock3, key: "Akan Expired" },
  { label: "Sudah Expired", icon: ShieldAlert, key: "Sudah Expired" },
  { label: "Laporan Stok", icon: FileBarChart, key: "Laporan Stok" },
  { label: "Pengguna", icon: Users, key: "Pengguna" },
  { label: "Riwayat Aktivitas", icon: Clock3, key: "Riwayat Aktivitas" },
];

const DAY_MS = 86400000;

const PERIOD_DAYS = { "7 hari": 7, "30 hari": 30, "3 bulan": 90, "1 tahun": 365 };
const PERIOD_BUCKETS = { "7 hari": 7, "30 hari": 10, "3 bulan": 12, "1 tahun": 12 };

function daysUntil(date) {
  const value = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(value)) return 0;
  return Math.ceil((value - Date.now()) / DAY_MS);
}

function formatRelative(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "-";
  const diff = Date.now() - time;
  if (diff < 60000) return "Baru saja";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari yang lalu`;
  return new Date(time).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function niceStep(value) {
  if (!Number.isFinite(value) || value <= 0) return 5;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const factor = value / base;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return nice * base;
}

function dateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function initials(name) {
  if (!name) return "MS";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function MetricCard({ label, value, detail, tone, icon: Icon }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-head">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function StatusBadge({ status }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-badge ${statusClass}`}>{status}</span>;
}

function HelpPage() {
  const topics = [
    [
      "Memulai inventory",
      "Tambahkan obat, batch, supplier, lokasi, dan minimum stok sebelum mencatat transaksi.",
    ],
    [
      "FEFO dan expired",
      "Gunakan batch dengan tanggal expired paling dekat terlebih dahulu. Obat expired tidak dapat digunakan untuk stok keluar normal.",
    ],
    [
      "Penyesuaian stok",
      "Bandingkan stok sistem dengan hasil hitung fisik, pilih alasan, lalu simpan untuk membuat audit trail.",
    ],
    [
      "Koneksi database",
      "Pastikan DATABASE_URL Neon tersedia di .env lokal dan Environment Variables Vercel.",
    ],
  ];
  return (
    <div className="help-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Support center</p>
          <h1>Pusat bantuan</h1>
          <p className="intro-copy">
            Panduan singkat untuk mengoperasikan MediStock dengan benar.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            (window.location.href = "mailto:support@medistock.local")
          }
        >
          <CircleHelp size={17} /> Hubungi support
        </button>
      </div>
      <div className="help-grid">
        {topics.map(([title, copy]) => (
          <article className="panel help-card" key={title}>
            <CircleHelp size={19} />
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <article className="panel help-contact">
        <div>
          <p className="eyebrow">Butuh bantuan?</p>
          <h2>Siapkan kode obat dan waktu kejadian saat melaporkan masalah.</h2>
        </div>
        <span>support@medistock.local</span>
      </article>
    </div>
  );
}

function MasterResourcePage({ type, title, copy, role }) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const { data, refresh } = useCachedFetch(`/api/master/${type}`);
  const items = data || [];

  useEffect(() => {
    setSearch("");
    setFormOpen(false);
  }, [type]);
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const manageMaster = can(role, "manageMaster");

  function openForm(item = null) {
    setEditing(item);
    setName(item?.name || "");
    setMessage("");
    setFormOpen(true);
  }
  async function save(event) {
    event.preventDefault();
    setMessage("Menyimpan...");
    const response = await fetch(`/api/master/${type}`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, name } : { name }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error);
      return;
    }
    setMessage(payload.message);
    await refresh().catch(() => {});
    setTimeout(() => setFormOpen(false), 600);
  }
  async function remove(id) {
    if (!window.confirm("Hapus data master ini?")) return;
    const response = await fetch(
      `/api/master/${type}?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const payload = await response.json();
    if (!response.ok) window.alert(payload.error || "Data gagal dihapus.");
    await refresh().catch(() => {});
  }

  return (
    <div className="resource-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Master data</p>
          <h1>{title}</h1>
          <p className="intro-copy">{copy}</p>
        </div>
        {manageMaster && (
          <button className="primary-button" onClick={() => openForm()}>
            <Plus size={17} /> Tambah
          </button>
        )}
      </div>
      <div className="resource-summary">
        <strong>{filtered.length}</strong>
        <span>data aktif</span>
        <div className="table-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Cari ${title.toLowerCase()}...`}
          />
        </div>
      </div>
      <article className="panel table-panel resource-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jumlah obat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.id}</span>
                  </td>
                  <td>
                    {item.itemCount || 0} <small>jenis obat</small>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {manageMaster && (
                      <div className="row-actions">
                        <button onClick={() => openForm(item)}>Edit</button>
                        <button onClick={() => remove(item.id)}>Hapus</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <Package size={22} />
              <strong>Belum ada data</strong>
              <span>Tambahkan master data pertama.</span>
            </div>
          )}
        </div>
      </article>
      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <section
            className="transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Master data</p>
                <h2>
                  {editing ? "Edit" : "Tambah"} {title}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={save}>
              <label>
                Nama
                <input
                  required
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={`Nama ${title.toLowerCase()}`}
                />
              </label>
              {message && <p className="transaction-message">{message}</p>}
              <button className="primary-button modal-submit" type="submit">
                Simpan
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function UserResourcePage({ role }) {
  const { data, refresh } = useCachedFetch("/api/users");
  const users = data || [];
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    role: "Viewer",
    status: "ACTIVE",
    password: "",
  });
  const [message, setMessage] = useState("");
  function openForm(user = null) {
    setEditing(user);
    setForm(
      user
        ? { ...user, password: "" }
        : {
            id: `USR-${String(
              users.reduce((highest, item) => {
                const number = Number(String(item.id).match(/(\d+)$/)?.[1] || 0);
                return Math.max(highest, number);
              }, 0) + 1,
            ).padStart(3, "0")}`,
            name: "",
            email: "",
            role: "Viewer",
            status: "ACTIVE",
            password: "",
          },
    );
    setMessage("");
    setFormOpen(true);
  }
  async function save(event) {
    event.preventDefault();
    setMessage("Menyimpan...");
    const response = await fetch("/api/users", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error);
      return;
    }
    setMessage(payload.message);
    await refresh().catch(() => {});
    setTimeout(() => setFormOpen(false), 600);
  }
  async function remove(id) {
    if (!window.confirm("Hapus pengguna ini?")) return;
    const response = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) window.alert(payload.error);
    await refresh().catch(() => {});
  }
  const manageUsers = can(role, "manageUsers");
  return (
    <div className="resource-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Pengguna</h1>
          <p className="intro-copy">
            Kelola pengguna, role, dan status akses MediStock.
          </p>
        </div>
        {manageUsers && (
          <button className="primary-button" onClick={() => openForm()}>
            <Plus size={17} /> Tambah pengguna
          </button>
        )}
      </div>
      <article className="panel table-panel resource-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span>{user.id}</span>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>
                    {manageUsers && (
                      <div className="row-actions">
                        <button onClick={() => openForm(user)}>Edit</button>
                        <button onClick={() => remove(user.id)}>Hapus</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <section
            className="transaction-modal item-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Administration</p>
                <h2>{editing ? "Edit pengguna" : "Tambah pengguna"}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <label>
                  ID pengguna
                  <input
                    required
                    disabled={Boolean(editing)}
                    value={form.id}
                    onChange={(event) =>
                      setForm({ ...form, id: event.target.value })
                    }
                  />
                </label>
                <label>
                  Nama
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </label>
                <label>
                  Role
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({ ...form, role: event.target.value })
                    }
                  >
                    <option>Super Admin</option>
                    <option>Admin Farmasi</option>
                    <option>Petugas Gudang</option>
                    <option>Viewer</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={editing && !form.password ? undefined : 8}
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    placeholder={
                      editing ? "Biarkan kosong jika tidak diganti" : "Minimal 8 karakter"
                    }
                  />
                </label>
              </div>
              {message && <p className="transaction-message">{message}</p>}
              <button className="primary-button modal-submit" type="submit">
                Simpan pengguna
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const cachedProfile = getCached('/api/profile');
  const { data: profileData } = useCachedFetch('/api/profile');
  const [profile, setProfile] = useState(cachedProfile || { name: '', avatarUrl: '', email: '', role: '' });
  const [initialized, setInitialized] = useState(Boolean(cachedProfile));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (profileData && !initialized) { setProfile(profileData); setInitialized(true); } }, [profileData, initialized]);
  async function save(event) { event.preventDefault(); setMessage('Menyimpan...'); const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profile, currentPassword, newPassword }) }); const payload = await response.json(); setMessage(response.ok ? payload.message : payload.error); if (response.ok) { setProfile(payload.data); setCached('/api/profile', payload.data); setCurrentPassword(''); setNewPassword(''); } }
  return <div className="settings-page"><div className="page-intro"><div><p className="eyebrow">System</p><h1>Pengaturan</h1><p className="intro-copy">Perbarui profil dan keamanan akun admin.</p></div></div><form className="settings-form" onSubmit={save}><article className="panel settings-card"><p className="eyebrow">Profil</p><div className="profile-preview"><div className="avatar large">{profile.name?.slice(0, 2).toUpperCase() || 'MS'}</div><div><strong>{profile.name || 'Pengguna'}</strong><span>{profile.role || '-'}</span></div></div><label>Nama<input value={profile.name || ''} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>Foto profil URL<input value={profile.avatarUrl || ''} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} placeholder="https://.../foto.jpg" /></label></article><article className="panel settings-card"><p className="eyebrow">Keamanan</p><label>Password saat ini<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Password baru<input type="password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>            <p className="muted-copy">Password minimal 8 karakter. Perubahan password membatalkan sesi di perangkat lain.</p></article><div className="settings-actions">{message && <span className="transaction-message">{message}</span>}<button className="primary-button" type="submit">Simpan pengaturan</button></div></form></div>;
}

function ResourcePage({
  page,
  role,
  inventory,
  transactions,
  adjustments,
  search,
  setSearch,
  onAddTransaction,
  onAddAdjustment,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onDetailItem,
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  if (page === "Bantuan") return <HelpPage />;
  if (page === "Supplier")
    return (
      <MasterResourcePage
        role={role}
        type="suppliers"
        title="Supplier"
        copy="Kelola pemasok yang menyuplai obat ke fasilitas."
      />
    );
  if (page === "Kategori Obat")
    return (
      <MasterResourcePage
        role={role}
        type="categories"
        title="Kategori obat"
        copy="Kelola klasifikasi obat untuk inventory dan laporan."
      />
    );
  if (page === "Lokasi Penyimpanan")
    return (
      <MasterResourcePage
        role={role}
        type="locations"
        title="Lokasi penyimpanan"
        copy="Kelola tempat penyimpanan setiap batch obat."
      />
    );
  if (page === "Pengguna") return <UserResourcePage role={role} />;
  if (page === "Pengaturan") return <SettingsPage />;
  const today = dateOnly(Date.now());
  const expiringLimit = dateOnly(Date.now() + 90 * DAY_MS);
  const inventoryRows = inventory.filter((item) => {
    const matchesSearch =
      `${item.name} ${item.id} ${item.batch} ${item.supplier} ${item.location}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || item.status === statusFilter;
    const matchesCategory =
      categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesSupplier =
      supplierFilter === "ALL" || item.supplier === supplierFilter;
    const matchesLocation =
      locationFilter === "ALL" || item.location === locationFilter;
    if (page === "Stok Menipis")
      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesSupplier &&
        matchesLocation &&
        item.stock < item.minimum
      );
    if (page === "Akan Expired")
      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesSupplier &&
        matchesLocation &&
        item.status !== "EXPIRED" &&
        item.nearestExpiry <= expiringLimit
      );
    if (page === "Sudah Expired")
      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesSupplier &&
        matchesLocation &&
        item.nearestExpiry < today
      );
    if (page === "Kondisi Stok")
      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesSupplier &&
        matchesLocation
      );
    return (
      matchesSearch &&
      matchesStatus &&
      matchesCategory &&
      matchesSupplier &&
      matchesLocation
    );
  });
  const categories = [...new Set(inventory.map((item) => item.category))];
  const suppliers = [...new Set(inventory.map((item) => item.supplier))];
  const locations = [...new Set(inventory.map((item) => item.location))];
  const transactionRows = transactions.filter((item) => {
    const matchesSearch =
      `${item.inventory?.name || item.name || ""} ${item.inventory?.batch || item.batch || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    return (
      matchesSearch &&
      ((page === "Stok Masuk" && item.type === "IN") ||
        (page === "Stok Keluar" && item.type === "OUT"))
    );
  });
  const rows =
    page === "Penyesuaian Stok"
      ? adjustments.filter((item) =>
          `${item.inventory?.name || item.name || ""} ${item.reason || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      : page === "Stok Masuk" || page === "Stok Keluar"
        ? transactionRows
        : page === "Pengguna"
          ? [{ id: "USR-001", name: "Andi Saputra", value: "Admin Farmasi" }]
          : page === "Pengaturan"
            ? [
                {
                  id: "CFG-001",
                  name: "Nama fasilitas",
                  value: "Klinik MediStock",
                },
                { id: "CFG-002", name: "Zona waktu", value: "Asia/Jakarta" },
              ]
            : page === "Kategori Obat"
              ? [...new Set(inventory.map((item) => item.category))]
                  .map((name) => ({
                    id: name,
                    name,
                    medicines: inventory.filter(
                      (item) => item.category === name,
                    ).length,
                    stock: inventory
                      .filter((item) => item.category === name)
                      .reduce((sum, item) => sum + item.stock, 0),
                    status: "ACTIVE",
                  }))
                  .filter((item) =>
                    item.name.toLowerCase().includes(search.toLowerCase()),
                  )
              : page === "Riwayat Aktivitas"
                ? transactions
                    .map((item) => ({
                      ...item,
                      name: `${item.type === "IN" ? "Stok masuk" : "Stok keluar"} · ${item.inventory?.name || item.name || "Inventory"}`,
                      category: item.inventory?.batch || item.batch || "-",
                      location: item.createdAt,
                      status: "COMPLETED",
                    }))
                    .filter((item) =>
                      item.name.toLowerCase().includes(search.toLowerCase()),
                    )
                : page === "Supplier"
                  ? [...new Set(inventory.map((item) => item.supplier))]
                      .map((name) => ({
                        id: name,
                        name,
                        contact: "Kontak supplier",
                        medicines: inventory.filter(
                          (item) => item.supplier === name,
                        ).length,
                        stock: inventory
                          .filter((item) => item.supplier === name)
                          .reduce((sum, item) => sum + item.stock, 0),
                        status: "ACTIVE",
                      }))
                      .filter((item) =>
                        item.name.toLowerCase().includes(search.toLowerCase()),
                      )
                  : page === "Lokasi Penyimpanan"
                    ? [...new Set(inventory.map((item) => item.location))]
                        .map((name) => ({
                          id: name,
                          name,
                          medicines: inventory.filter(
                            (item) => item.location === name,
                          ).length,
                          stock: inventory
                            .filter((item) => item.location === name)
                            .reduce((sum, item) => sum + item.stock, 0),
                          status: "ACTIVE",
                        }))
                        .filter((item) =>
                          item.name
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                    : inventoryRows;

  const config = {
    "Data Obat": {
      eyebrow: "Master inventory",
      title: "Data obat",
      copy: "Kelola seluruh obat, stok minimum, dan expired terdekat.",
      action: "Tambah obat",
      columns: [
        "Obat",
        "Kategori",
        "Stok",
        "Minimum",
        "Expired terdekat",
        "Status",
        "Aksi",
      ],
    },
    "Batch Obat": {
      eyebrow: "Traceability",
      title: "Batch obat",
      copy: "Lacak batch, supplier, lokasi, dan tanggal expired setiap obat.",
      action: "Tambah batch",
      columns: [
        "Batch / obat",
        "Supplier",
        "Lokasi",
        "Stok",
        "Expired",
        "Status",
      ],
    },
    "Kondisi Stok": {
      eyebrow: "Stock health",
      title: "Kondisi stok",
      copy: "Identifikasi stok habis, menipis, normal, dan berlebih.",
      action: "Lihat kondisi",
      columns: [
        "Obat",
        "Stok saat ini",
        "Minimum",
        "Kekurangan",
        "Lokasi",
        "Status",
      ],
    },
    "Stok Menipis": {
      eyebrow: "Replenishment",
      title: "Stok menipis",
      copy: "Daftar obat yang berada di bawah batas minimum.",
      action: "Stok masuk",
      columns: [
        "Obat",
        "Stok saat ini",
        "Minimum",
        "Kekurangan",
        "Supplier",
        "Status",
      ],
    },
    "Akan Expired": {
      eyebrow: "Expiry control",
      title: "Akan expired",
      copy: "Pantau batch yang mendekati tanggal expired dan prioritaskan FEFO.",
      action: "Buka laporan",
      columns: [
        "Obat / batch",
        "Expired",
        "Stok",
        "Supplier",
        "Lokasi",
        "Status",
      ],
    },
    "Sudah Expired": {
      eyebrow: "Expiry control",
      title: "Sudah expired",
      copy: "Obat yang sudah melewati tanggal expired dan tidak boleh dikeluarkan.",
      action: "Buka laporan",
      columns: [
        "Obat / batch",
        "Expired",
        "Stok tersisa",
        "Supplier",
        "Lokasi",
        "Status",
      ],
    },
    Supplier: {
      eyebrow: "Master data",
      title: "Supplier",
      copy: "Kelola pemasok dan lihat jumlah inventory dari setiap supplier.",
      action: "Tambah supplier",
      columns: ["Supplier", "Kontak", "Jenis obat", "Total stok", "Status"],
    },
    "Lokasi Penyimpanan": {
      eyebrow: "Master data",
      title: "Lokasi penyimpanan",
      copy: "Pastikan setiap stok dapat ditemukan berdasarkan lokasi penyimpanan.",
      action: "Tambah lokasi",
      columns: ["Lokasi", "Jenis obat", "Total stok", "Status"],
    },
    "Laporan Stok": {
      eyebrow: "Reporting",
      title: "Laporan stok",
      copy: "Ringkasan inventory, nilai persediaan, batch, dan expired terdekat.",
      action: "Export laporan",
      columns: [
        "Obat",
        "Kategori",
        "Total stok",
        "Nilai persediaan",
        "Lokasi",
        "Status",
      ],
    },
    "Stok Masuk": {
      eyebrow: "Stock in",
      title: "Stok masuk",
      copy: "Riwayat penerimaan obat dari supplier ke lokasi penyimpanan.",
      action: "Catat stok masuk",
      columns: ["Tanggal", "Obat / batch", "Jumlah", "Stok sesudah", "Status"],
    },
    "Stok Keluar": {
      eyebrow: "Stock out",
      title: "Stok keluar",
      copy: "Riwayat pengeluaran obat dengan kontrol stok dan FEFO.",
      action: "Catat stok keluar",
      columns: ["Tanggal", "Obat / batch", "Jumlah", "Stok sesudah", "Status"],
    },
    "Penyesuaian Stok": {
      eyebrow: "Stock audit",
      title: "Penyesuaian stok",
      copy: "Cocokkan stok fisik dengan sistem dan simpan alasan setiap selisih.",
      action: "Buat penyesuaian",
      columns: [
        "Tanggal",
        "Obat",
        "Sebelum",
        "Stok fisik",
        "Selisih",
        "Alasan",
      ],
    },
    "Kategori Obat": {
      eyebrow: "Master data",
      title: "Kategori obat",
      copy: "Kelompokkan obat agar pencarian dan pelaporan lebih mudah.",
      action: "Tambah kategori",
      columns: ["Kategori", "Jenis obat", "Total stok", "Status"],
    },
    "Riwayat Aktivitas": {
      eyebrow: "Audit trail",
      title: "Riwayat aktivitas",
      copy: "Lacak perubahan stok dan aktivitas penting pengguna.",
      action: "Export aktivitas",
      columns: ["Aktivitas", "Referensi", "Jumlah", "Waktu", "Status"],
    },
    Pengguna: {
      eyebrow: "Administration",
      title: "Pengguna",
      copy: "Kelola akses pengguna dan peran di dalam MediStock.",
      action: "Tambah pengguna",
      columns: ["Nama pengguna", "Email", "Peran", "Status"],
    },
    Pengaturan: {
      eyebrow: "System",
      title: "Pengaturan",
      copy: "Konfigurasi identitas fasilitas dan preferensi inventory.",
      action: "Simpan perubahan",
      columns: ["Pengaturan", "Nilai", "Status"],
    },
  }[page] || {
    eyebrow: "Workspace",
    title: page,
    copy: "Modul ini siap dihubungkan ke data operasional MediStock.",
    action: "Tambah data",
    columns: ["Nama", "Status"],
  };

  function formattedDate(date) {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function rowCells(item) {
    if (page === "Penyesuaian Stok") {
      const source = item.inventory || item;
      return (
        <>
          <td>
            {new Date(item.createdAt).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </td>
          <td>
            <strong>{source.name || item.name}</strong>
            <span>{source.batch || item.inventoryId}</span>
          </td>
          <td>{item.stockBefore}</td>
          <td>{item.physicalStock}</td>
          <td
            className={
              item.difference < 0
                ? "difference-negative"
                : "difference-positive"
            }
          >
            {item.difference > 0 ? "+" : ""}
            {item.difference}
          </td>
          <td>{item.reason}</td>
        </>
      );
    }
    if (page === "Stok Masuk" || page === "Stok Keluar") {
      const source = item.inventory || item;
      return (
        <>
          <td>
            {new Date(item.createdAt).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </td>
          <td>
            <strong>{source.name}</strong>
            <span>{source.batch}</span>
          </td>
          <td>
            {item.quantity} <small>unit</small>
          </td>
          <td>
            {item.stockAfter} <small>unit</small>
          </td>
          <td>
            <StatusBadge status="COMPLETED" />
          </td>
        </>
      );
    }
    if (page === "Kategori Obat")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>Klasifikasi inventory</span>
          </td>
          <td>
            {item.medicines} <small>jenis obat</small>
          </td>
          <td>
            {item.stock.toLocaleString("id-ID")} <small>unit</small>
          </td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Riwayat Aktivitas")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>Petugas farmasi</span>
          </td>
          <td>{item.category}</td>
          <td>
            {item.quantity} <small>unit</small>
          </td>
          <td>
            {new Date(item.location).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Pengguna")
      return (
        <>
          <td>
            <strong>Andi Saputra</strong>
            <span>andi@medistock.local</span>
          </td>
          <td>Admin Farmasi</td>
          <td>Administrator</td>
          <td>
            <StatusBadge status="ACTIVE" />
          </td>
        </>
      );
    if (page === "Pengaturan")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
          </td>
          <td>{item.value}</td>
          <td>
            <StatusBadge status="ACTIVE" />
          </td>
        </>
      );
    if (page === "Supplier")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>{item.id}</span>
          </td>
          <td>{item.contact}</td>
          <td>
            {item.medicines} <small>jenis obat</small>
          </td>
          <td>
            {item.stock.toLocaleString("id-ID")} <small>unit</small>
          </td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Lokasi Penyimpanan")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>Area penyimpanan aktif</span>
          </td>
          <td>
            {item.medicines} <small>jenis obat</small>
          </td>
          <td>
            {item.stock.toLocaleString("id-ID")} <small>unit</small>
          </td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Laporan Stok")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>
              {item.id} · batch {item.batch}
            </span>
          </td>
          <td>{item.category}</td>
          <td>
            {item.stock.toLocaleString("id-ID")} <small>unit</small>
          </td>
          <td>{currency.format(item.stock * item.unitPrice)}</td>
          <td>{item.location}</td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Data Obat")
      return (
        <>
          <td>
            <button className="detail-link" onClick={() => onDetailItem(item)}>
              <strong>{item.name}</strong>
              <span>
                {item.id} · {item.generic}
              </span>
            </button>
          </td>
          <td>{item.category}</td>
          <td>
            {item.stock} <small>unit</small>
          </td>
          <td>
            {item.minimum} <small>unit</small>
          </td>
          <td>{formattedDate(item.nearestExpiry)}</td>
          <td>
            <StatusBadge status={item.status} />
          </td>
          <td>
            {can(role, "manageInventory") && (
              <div className="row-actions">
                <button onClick={() => onEditItem(item)}>Edit</button>
                <button onClick={() => onDeleteItem(item.id)}>Hapus</button>
              </div>
            )}
          </td>
        </>
      );
    if (page === "Batch Obat")
      return (
        <>
          <td>
            <strong>{item.batch}</strong>
            <span>{item.name}</span>
          </td>
          <td>{item.supplier}</td>
          <td>{item.location}</td>
          <td>
            {item.stock} <small>unit</small>
          </td>
          <td>{formattedDate(item.nearestExpiry)}</td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    if (page === "Kondisi Stok" || page === "Stok Menipis")
      return (
        <>
          <td>
            <strong>{item.name}</strong>
            <span>
              {item.id} · {item.category}
            </span>
          </td>
          <td>
            {item.stock} <small>unit</small>
          </td>
          <td>
            {item.minimum} <small>unit</small>
          </td>
          <td>
            {Math.max(item.minimum - item.stock, 0)} <small>unit</small>
          </td>
          <td>{page === "Kondisi Stok" ? item.location : item.supplier}</td>
          <td>
            <StatusBadge status={item.status} />
          </td>
        </>
      );
    return (
      <>
        <td>
          <strong>{item.name}</strong>
          <span>{item.batch}</span>
        </td>
        <td>{formattedDate(item.nearestExpiry)}</td>
        <td>
          {item.stock} <small>unit</small>
        </td>
        <td>{item.supplier}</td>
        <td>{item.location}</td>
        <td>
          <StatusBadge status={item.status} />
        </td>
      </>
    );
  }

  const actionPermission =
    page === "Data Obat"
      ? "manageInventory"
      : page === "Penyesuaian Stok"
        ? "adjustStock"
        : page === "Stok Masuk" || page === "Stok Keluar"
          ? "recordTransaction"
          : null;
  const showAction = !actionPermission || can(role, actionPermission);
  return (
    <div className="resource-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <p className="intro-copy">{config.copy}</p>
        </div>
        {showAction && (
          <button
            className="primary-button"
            onClick={
              page === "Data Obat"
                ? onAddItem
                : page === "Penyesuaian Stok"
                  ? onAddAdjustment
                  : onAddTransaction
            }
          >
            <Plus size={17} /> {config.action}
          </button>
        )}
      </div>
      <div className="resource-summary">
        <strong>{rows.length}</strong>
        <span>data ditampilkan</span>
        <div className="table-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari obat, batch, supplier..."
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="ALL">Semua status</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW STOCK">Stok menipis</option>
          <option value="OUT OF STOCK">Habis</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          className="filter-select"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="ALL">Semua kategori</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
        >
          <option value="ALL">Semua supplier</option>
          {suppliers.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
        >
          <option value="ALL">Semua lokasi</option>
          {locations.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button className="filter-button">
          <SlidersHorizontal size={15} /> Filter
        </button>
      </div>
      <article className="panel table-panel resource-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr key={item.id || `${item.name}-${index}`}>
                  {rowCells(item)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty-state">
              <Package size={22} />
              <strong>Tidak ada data yang cocok</strong>
              <span>Catat transaksi untuk mulai membangun riwayat.</span>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default function Dashboard() {
  const [inventory, setInventory] = useState(() => getCached("/api/inventory") || []);
  const [transactions, setTransactions] = useState(() => getCached("/api/transactions") || []);
  const [adjustments, setAdjustments] = useState(() => getCached("/api/adjustments") || []);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30 hari");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] = useState("IN");
  const [transactionItem, setTransactionItem] = useState("");
  const [transactionQuantity, setTransactionQuantity] = useState("");
  const [transactionMessage, setTransactionMessage] = useState("");
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState("");
  const [physicalStock, setPhysicalStock] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("Perhitungan fisik");
  const [adjustmentMessage, setAdjustmentMessage] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    id: "",
    name: "",
    generic: "",
    category: "Analgesik",
    batch: "",
    supplier: "",
    location: "",
    minimum: 0,
    unitPrice: 0,
    nearestExpiry: "2027-01-01",
  });
  const [itemMessage, setItemMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const role = session?.role;

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((payload) => {
        setSession(payload.data);
        setAuthChecked(true);
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  const allowedNavigation = useMemo(
    () => navigation.filter((item) => canAccess(role, item.key)),
    [role],
  );

  useEffect(() => {
    if (session && !canAccess(session.role, activePage)) setActivePage("Dashboard");
  }, [session, activePage]);

  useEffect(() => {
    if (!session) return;
    const urls = [
      "/api/profile",
      "/api/master/categories",
      "/api/master/suppliers",
      "/api/master/locations",
    ];
    if (can(session.role, "manageUsers")) urls.push("/api/users");
    prefetch(urls);
  }, [session]);

  function logout() {
    clearCache();
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
  }

  function loadInventory() {
    return fetch("/api/inventory", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rows = payload.data || [];
        setInventory(rows);
        setCached("/api/inventory", rows);
      })
      .catch(() => {});
  }

  function loadTransactions() {
    return fetch("/api/transactions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rows = payload.data || [];
        setTransactions(rows);
        setCached("/api/transactions", rows);
      })
      .catch(() => {});
  }

  function loadAdjustments() {
    return fetch("/api/adjustments", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rows = payload.data || [];
        setAdjustments(rows);
        setCached("/api/adjustments", rows);
      })
      .catch(() => {});
  }

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([loadInventory(), loadTransactions(), loadAdjustments()]);
    setRefreshing(false);
  }

  useEffect(() => {
    refreshAll();
    const interval = window.setInterval(refreshAll, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!itemOpen) return undefined;
    let active = true;
    Promise.all(
      ["categories", "suppliers", "locations"].map((type) =>
        ensureData(`/api/master/${type}`),
      ),
    ).then((values) => {
      if (!active) return;
      const mappings = [
        ["Kategori", "category"],
        ["Supplier", "supplier"],
        ["Lokasi", "location"],
      ];
      mappings.forEach(([labelText, field], index) => {
        const label = [...document.querySelectorAll(".item-modal label")].find(
          (entry) => entry.textContent.trim().startsWith(labelText),
        );
        const input = label?.querySelector("input");
        if (
          !label ||
          !input ||
          label.querySelector(`select[data-master-field="${field}"]`)
        )
          return;
        input.style.display = "none";
        const select = document.createElement("select");
        select.dataset.masterField = field;
        select.className = "master-select";
        select.required = true;
        select.innerHTML = `<option value="">Pilih ${labelText.toLowerCase()}</option>`;
        (values[index] || []).forEach((item) => {
          const option = document.createElement("option");
          option.value = item.name;
          option.textContent = item.name;
          select.appendChild(option);
        });
        select.value = itemForm[field] || "";
        select.addEventListener("change", (event) =>
          setItemForm((previous) => ({
            ...previous,
            [field]: event.target.value,
          })),
        );
        label.appendChild(select);
      });
      const heading = document.querySelector(".item-modal .modal-heading");
      if (heading && !heading.querySelector(".manage-modal-button")) {
        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "manage-modal-button";
        manageButton.textContent = "Kelola Data Obat";
        manageButton.addEventListener("click", () => {
          setItemOpen(false);
          choosePage("Data Obat");
        });
        heading.appendChild(manageButton);
      }
    });
    return () => {
      active = false;
    };
  }, [itemOpen]);

  const visibleInventory = useMemo(
    () =>
      inventory.filter((item) =>
        `${item.name} ${item.id} ${item.batch} ${item.supplier}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [inventory, search],
  );
  const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
  const inventoryValue = inventory.reduce(
    (sum, item) => sum + item.stock * item.unitPrice,
    0,
  );
  const lowStock = inventory.filter((item) => item.stock < item.minimum);

  const health = useMemo(() => {
    const counts = { safe: 0, warning: 0, critical: 0, expired: 0 };
    inventory.forEach((item) => {
      const days = daysUntil(item.nearestExpiry);
      if (days <= 0) counts.expired += 1;
      else if (days <= 30) counts.critical += 1;
      else if (days <= 90) counts.warning += 1;
      else counts.safe += 1;
    });
    const total = counts.safe + counts.warning + counts.critical + counts.expired;
    const share = (value) => (total ? (value / total) * 100 : 0);
    const safeEnd = share(counts.safe);
    const warningEnd = safeEnd + share(counts.warning);
    const criticalEnd = warningEnd + share(counts.critical);
    return {
      counts,
      total,
      expiring: counts.warning + counts.critical,
      background: total
        ? `conic-gradient(var(--teal) 0 ${safeEnd}%, #dfae50 ${safeEnd}% ${warningEnd}%, #d96c58 ${warningEnd}% ${criticalEnd}%, #4a5854 ${criticalEnd}% 100%)`
        : "#e9edeb",
    };
  }, [inventory]);
  const expiredCount = health.counts.expired;
  const expiringCount = health.expiring;

  const movement = useMemo(() => {
    const days = PERIOD_DAYS[period] ?? 7;
    const count = PERIOD_BUCKETS[period] ?? 7;
    const end = Date.now();
    const start = end - days * DAY_MS;
    const size = (end - start) / count;
    const buckets = Array.from({ length: count }, (_, index) => ({
      start: start + index * size,
      in: 0,
      out: 0,
    }));
    transactions.forEach((entry) => {
      const at = new Date(entry.createdAt).getTime();
      if (Number.isNaN(at) || at < start || at > end) return;
      const index = Math.min(count - 1, Math.floor((at - start) / size));
      const quantity = Number(entry.quantity) || 0;
      if (entry.type === "IN") buckets[index].in += quantity;
      else buckets[index].out += quantity;
    });
    adjustments.forEach((entry) => {
      const at = new Date(entry.createdAt).getTime();
      if (Number.isNaN(at) || at < start || at > end) return;
      const index = Math.min(count - 1, Math.floor((at - start) / size));
      const difference = Number(entry.difference) || 0;
      if (difference > 0) buckets[index].in += difference;
      if (difference < 0) buckets[index].out += Math.abs(difference);
    });
    const totalIn = buckets.reduce((sum, bucket) => sum + bucket.in, 0);
    const totalOut = buckets.reduce((sum, bucket) => sum + bucket.out, 0);
    const peak = Math.max(...buckets.map((bucket) => Math.max(bucket.in, bucket.out)));
    const step = Math.max(1, Math.round(niceStep(peak / 3)));
    const max = step * 3;
    const labelIndexes = [...new Set([0, 1, 2, 3, 4].map((index) => Math.round((index * (count - 1)) / 4)))];
    return {
      buckets,
      max,
      labels: [max, step * 2, step, 0],
      totalIn,
      totalOut,
      labelIndexes,
      empty: totalIn + totalOut === 0,
    };
  }, [transactions, adjustments, period]);

  const recentActivity = useMemo(() => {
    const entries = [
      ...transactions.map((entry) => ({
        id: entry.id,
        type: entry.type === "IN" ? "in" : "out",
        label: `${entry.type === "IN" ? "Stok masuk" : "Stok keluar"} ${entry.quantity} unit ${entry.inventory?.name || entry.name || "obat"}`,
        at: entry.createdAt,
      })),
      ...adjustments.map((entry) => ({
        id: entry.id,
        type: "adjust",
        label: `Penyesuaian ${entry.inventory?.name || entry.name || "obat"} · selisih ${Number(entry.difference) > 0 ? "+" : ""}${entry.difference}`,
        at: entry.createdAt,
      })),
    ];
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return entries.slice(0, 5);
  }, [transactions, adjustments]);

  function choosePage(page) {
    if (!canAccess(role, page)) return;
    setActivePage(page);
    setMobileOpen(false);
  }

  function handleResourceAction() {
    if (activePage === "Laporan Stok") {
      window.print();
      return;
    }
    if (
      ["Riwayat Aktivitas", "Pengguna", "Pengaturan", "Bantuan"].includes(
        activePage,
      )
    )
      return;
    setTransactionOpen(true);
  }

  function openItemForm(item = null) {
    setEditingItem(item);
    setItemForm(
      item
        ? { ...item }
        : {
            id: `MED-${String(
              inventory.reduce((highest, item) => {
                const number = Number(String(item.id).match(/(\d+)$/)?.[1] || 0);
                return Math.max(highest, number);
              }, 0) + 1,
            ).padStart(3, "0")}`,
            name: "",
            generic: "",
            category: "Analgesik",
            batch: "",
            supplier: "",
            location: "",
            minimum: 0,
            unitPrice: 0,
            nearestExpiry: "2027-01-01",
          },
    );
    setItemMessage("");
    setItemOpen(true);
  }

  async function submitItem(event) {
    event.preventDefault();
    setItemMessage("Menyimpan data...");
    const response = await fetch("/api/inventory", {
      method: editingItem ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingItem ? itemForm : { mode: "create", ...itemForm },
      ),
    });
    const payload = await response.json();
    if (!response.ok) {
      setItemMessage(payload.error || "Data gagal disimpan.");
      return;
    }
    setItemMessage(payload.message || "Data berhasil disimpan.");
    loadInventory();
    setTimeout(() => setItemOpen(false), 700);
  }

  async function deleteItem(id) {
    if (!window.confirm("Hapus obat ini dari inventory?")) return;
    const response = await fetch(
      `/api/inventory?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const payload = await response.json();
    if (!response.ok) window.alert(payload.error || "Obat gagal dihapus.");
    loadInventory();
  }

  async function submitTransaction(event) {
    event.preventDefault();
    setTransactionMessage("Menyimpan transaksi...");
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryId: transactionItem,
        type: transactionType,
        quantity: transactionQuantity,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setTransactionMessage(payload.error);
      return;
    }
    setTransactionMessage(payload.message);
    setTransactionQuantity("");
    loadInventory();
    loadTransactions();
    setTimeout(() => {
      setTransactionOpen(false);
      setTransactionMessage("");
    }, 700);
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    setAdjustmentMessage("Menyimpan penyesuaian...");
    const response = await fetch("/api/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryId: adjustmentItem,
        physicalStock,
        reason: adjustmentReason,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setAdjustmentMessage(payload.error);
      return;
    }
    setAdjustmentMessage(payload.message);
    loadInventory();
    loadAdjustments();
    setTimeout(() => {
      setAdjustmentOpen(false);
      setAdjustmentMessage("");
    }, 700);
  }

  return (
    <main className="app-shell">
      {!authChecked && (
        <div className="session-loading">Memuat sesi login...</div>
      )}
      <div
        className={`mobile-overlay ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div>
          <div className="brand-row">
            <div className="brand-mark">
              <Plus size={22} strokeWidth={3} />
            </div>
            <div>
              <strong>MediStock</strong>
              <span>Pharmacy control center</span>
            </div>
            <button
              className="icon-button sidebar-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
          <label className="global-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari obat, batch..."
            />
          </label>
          <p className="nav-caption">Workspace</p>
          <nav className="nav-list">
            {allowedNavigation.map(({ label, icon: Icon, key }) => (
              <button
                key={key}
                className={`nav-item ${activePage === key ? "active" : ""}`}
                onClick={() => choosePage(key)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {key === "Stok Menipis" && <em>{lowStock.length}</em>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => choosePage("Pengaturan")}>
            <Settings size={17} />
            <span>Pengaturan</span>
          </button>
          <button className="nav-item" onClick={() => choosePage("Bantuan")}>
            <CircleHelp size={17} />
            <span>Pusat Bantuan</span>
          </button>
          <div className="profile">
            <div className="avatar">{initials(session?.name)}</div>
            <div>
              <strong>{session?.name || "Memuat..."}</strong>
              <span>{session?.role || "-"}</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>{activePage}</strong>
          </div>
          <div className="top-actions">
            <div className="date-stamp">
              {new Date().toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}{" "}
              <span>•</span> Shift pagi
            </div>
            <button
              className={`icon-button refresh-button ${refreshing ? "spinning" : ""}`}
              onClick={refreshAll}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifikasi"
            >
              <Bell size={19} />
              <i />
            </button>
            {notificationsOpen && (
              <div className="notification-popover">
                <strong>Perlu perhatian</strong>
                <span>{expiredCount} batch sudah expired</span>
                <span>{lowStock.length} obat stok menipis</span>
                <span>{expiringCount} batch mendekati expired</span>
              </div>
            )}
            <div className="top-profile">
              <button
                type="button"
                className="top-profile-trigger"
                aria-label="Menu profil"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
              >
                <div className="avatar small">{initials(session?.name)}</div>
                <span>{session?.name || ""}</span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <p className="eyebrow">Masuk sebagai</p>
                  <strong>{session?.name || "Memuat..."}</strong>
                  <span className="profile-role">{session?.role || "-"}</span>
                  <em>{session?.email || ""}</em>
                  <button
                    type="button"
                    className="profile-menu-logout"
                    onClick={() => {
                      setProfileOpen(false);
                      setLogoutConfirmOpen(true);
                    }}
                  >
                    <LogOut size={14} /> Keluar
                  </button>
                </div>
              )}
            </div>
            {profileOpen && (
              <div
                className="popover-overlay"
                onClick={() => setProfileOpen(false)}
              />
            )}
          </div>
        </header>

        {activePage === "Dashboard" ? (
          <div className="page-content">
            <div className="page-intro">
              <div>
                <p className="eyebrow">
                  {new Date().toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h1>Ringkasan persediaan</h1>
                <p className="intro-copy">
                  Pantau kesehatan stok dan tindakan yang perlu dilakukan hari
                  ini.
                </p>
              </div>
              {can(role, "recordTransaction") && (
                <button
                  className="primary-button"
                  onClick={() => setTransactionOpen(true)}
                >
                  <Plus size={17} /> Tambah transaksi
                </button>
              )}
            </div>

            <section className="metrics-grid">
              <MetricCard
                label="Total obat"
                value={inventory.length}
                detail="jenis terdaftar"
                tone="teal"
                icon={Package}
              />
              <MetricCard
                label="Total stok"
                value={totalStock.toLocaleString("id-ID")}
                detail="unit tersedia"
                tone="blue"
                icon={Boxes}
              />
              <MetricCard
                label="Stok menipis"
                value={lowStock.length}
                detail="perlu restock"
                tone="amber"
                icon={AlertTriangle}
              />
              <MetricCard
                label="Akan expired"
                value={expiringCount}
                detail="dalam 90 hari"
                tone="coral"
                icon={Clock3}
              />
              <MetricCard
                label="Nilai persediaan"
                value={currency.format(inventoryValue)}
                detail="estimasi harga beli"
                tone="ink"
                icon={FileBarChart}
              />
            </section>

            <section className="dashboard-grid">
              <article className="panel movement-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Aktivitas stok</p>
                    <h2>Pergerakan persediaan</h2>
                  </div>
                  <select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  >
                    <option>7 hari</option>
                    <option>30 hari</option>
                    <option>3 bulan</option>
                    <option>1 tahun</option>
                  </select>
                </div>
                <div className="chart">
                  <div className="chart-y">
                    {movement.labels.map((label) => (
                      <span key={label}>{label.toLocaleString("id-ID")}</span>
                    ))}
                  </div>
                  <div className="chart-body">
                    <div className="grid-lines">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="bars">
                      {movement.buckets.map((bucket, index) => (
                        <div
                          className="bar-pair"
                          key={index}
                          title={`${new Date(bucket.start).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} · masuk ${bucket.in} · keluar ${bucket.out}`}
                        >
                          <i
                            style={{ height: `${(bucket.in / movement.max) * 100}%` }}
                          />
                          <b
                            style={{ height: `${(bucket.out / movement.max) * 100}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    {movement.empty && (
                      <p className="chart-empty">
                        Belum ada pergerakan stok pada periode {period}.
                      </p>
                    )}
                    <div className="chart-x">
                      {movement.labelIndexes.map((index) => (
                        <span key={index}>
                          {new Date(movement.buckets[index].start).toLocaleDateString(
                            "id-ID",
                            { day: "2-digit", month: "short" },
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="legend">
                  <span>
                    <i className="in" /> Stok masuk{" "}
                    {movement.totalIn.toLocaleString("id-ID")}
                  </span>
                  <span>
                    <i className="out" /> Stok keluar{" "}
                    {movement.totalOut.toLocaleString("id-ID")}
                  </span>
                </div>
              </article>
              <article className="panel status-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Kesehatan inventory</p>
                    <h2>Status expired</h2>
                  </div>
                  <button
                    className="more-button"
                    onClick={() => choosePage("Laporan Stok")}
                  >
                    Lihat laporan <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="donut-wrap">
                  <div className="donut" style={{ background: health.background }}>
                    <div>
                      <strong>{health.total}</strong>
                      <span>batch</span>
                    </div>
                  </div>
                  <div className="status-list">
                    <span>
                      <i className="safe" />
                      Aman <b>{health.counts.safe}</b>
                    </span>
                    <span>
                      <i className="warning" />
                      Akan expired <b>{health.counts.warning}</b>
                    </span>
                    <span>
                      <i className="critical" />
                      Critical <b>{health.counts.critical}</b>
                    </span>
                    <span>
                      <i className="expired" />
                      Expired <b>{health.counts.expired}</b>
                    </span>
                  </div>
                </div>
              </article>
            </section>

            <section className="lower-grid">
              <article className="panel table-panel">
                <div className="panel-heading table-heading">
                  <div>
                    <p className="eyebrow">Prioritas hari ini</p>
                    <h2>Perlu perhatian</h2>
                  </div>
                  <button
                    className="more-button"
                    onClick={() => choosePage("Kondisi Stok")}
                  >
                    Buka monitoring <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="table-tools">
                  <div className="table-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari nama obat atau batch"
                    />
                  </div>
                  <button className="filter-button">
                    <SlidersHorizontal size={15} /> Filter
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Obat / batch</th>
                        <th>Stok</th>
                        <th>Expired</th>
                        <th>Lokasi</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInventory.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <span>
                              {item.batch} · {item.supplier}
                            </span>
                          </td>
                          <td>
                            {item.stock} <small>unit</small>
                          </td>
                          <td>
                            {new Date(item.nearestExpiry).toLocaleDateString(
                              "id-ID",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td>{item.location}</td>
                          <td>
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Jejak sistem</p>
                    <h2>Aktivitas terbaru</h2>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => choosePage("Riwayat Aktivitas")}
                    aria-label="Buka riwayat aktivitas"
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="activity-list">
                  {recentActivity.length === 0 ? (
                    <div className="empty-state">
                      <Clock3 size={22} />
                      <strong>Belum ada aktivitas</strong>
                      <span>
                        Pergerakan stok dan penyesuaian akan muncul di sini.
                      </span>
                    </div>
                  ) : (
                    recentActivity.map((entry) => (
                      <div className="activity-item" key={entry.id}>
                        <div className={`activity-dot ${entry.type}`} />
                        <div>
                          <strong>{entry.label}</strong>
                          <span>{formatRelative(entry.at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="full-link"
                  onClick={() => choosePage("Riwayat Aktivitas")}
                >
                  Lihat semua aktivitas <ArrowUpRight size={15} />
                </button>
              </article>
            </section>
          </div>
        ) : (
          <div className="page-content">
            <ResourcePage
              page={activePage}
              role={role}
              inventory={inventory}
              transactions={transactions}
              adjustments={adjustments}
              search={search}
              setSearch={setSearch}
              onAddTransaction={handleResourceAction}
              onAddAdjustment={() => setAdjustmentOpen(true)}
              onAddItem={() => openItemForm()}
              onEditItem={openItemForm}
              onDeleteItem={deleteItem}
              onDetailItem={setDetailItem}
            />
          </div>
        )}
      </section>
      {transactionOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setTransactionOpen(false)}
        >
          <section
            className="transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Inventory movement</p>
                <h2>Catat transaksi stok</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setTransactionOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <div className="transaction-tabs">
              <button
                className={transactionType === "IN" ? "selected" : ""}
                onClick={() => setTransactionType("IN")}
              >
                <ArrowDownToLine size={15} /> Stok masuk
              </button>
              <button
                className={transactionType === "OUT" ? "selected" : ""}
                onClick={() => setTransactionType("OUT")}
              >
                <ArrowUpRight size={15} /> Stok keluar
              </button>
            </div>
            <form onSubmit={submitTransaction}>
              <label>
                Obat
                <select
                  required
                  value={transactionItem}
                  onChange={(event) => setTransactionItem(event.target.value)}
                >
                  <option value="">Pilih obat</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · stok {item.stock}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah unit
                <input
                  required
                  min="1"
                  type="number"
                  value={transactionQuantity}
                  onChange={(event) =>
                    setTransactionQuantity(event.target.value)
                  }
                  placeholder="Contoh: 20"
                />
              </label>
              {transactionMessage && (
                <p className="transaction-message">{transactionMessage}</p>
              )}
              <button className="primary-button modal-submit" type="submit">
                Simpan transaksi
              </button>
            </form>
          </section>
        </div>
      )}
      {adjustmentOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setAdjustmentOpen(false)}
        >
          <section
            className="transaction-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Stock audit</p>
                <h2>Penyesuaian stok</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setAdjustmentOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={submitAdjustment}>
              <label>
                Obat
                <select
                  required
                  value={adjustmentItem}
                  onChange={(event) => setAdjustmentItem(event.target.value)}
                >
                  <option value="">Pilih obat</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · sistem {item.stock}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stok fisik
                <input
                  required
                  min="0"
                  type="number"
                  value={physicalStock}
                  onChange={(event) => setPhysicalStock(event.target.value)}
                  placeholder="Jumlah hasil hitung fisik"
                />
              </label>
              <label>
                Alasan
                <select
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                >
                  <option>Perhitungan fisik</option>
                  <option>Rusak</option>
                  <option>Hilang</option>
                  <option>Expired</option>
                  <option>Kesalahan pencatatan</option>
                </select>
              </label>
              {adjustmentMessage && (
                <p className="transaction-message">{adjustmentMessage}</p>
              )}
              <button className="primary-button modal-submit" type="submit">
                Simpan penyesuaian
              </button>
            </form>
          </section>
        </div>
      )}
      {itemOpen && (
        <div className="modal-backdrop" onClick={() => setItemOpen(false)}>
          <section
            className="transaction-modal item-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Master inventory</p>
                <h2>{editingItem ? "Edit obat" : "Tambah obat"}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setItemOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={submitItem}>
              <div className="form-grid">
                <label>
                  Kode obat
                  <input
                    required
                    value={itemForm.id}
                    disabled={Boolean(editingItem)}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, id: event.target.value })
                    }
                  />
                </label>
                <label>
                  Nama obat
                  <input
                    required
                    value={itemForm.name}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Nama generik
                  <input
                    required
                    value={itemForm.generic}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, generic: event.target.value })
                    }
                  />
                </label>
                <label>
                  Kategori
                  <input
                    required
                    value={itemForm.category}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, category: event.target.value })
                    }
                  />
                </label>
                <label>
                  Batch
                  <input
                    required
                    value={itemForm.batch}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, batch: event.target.value })
                    }
                  />
                </label>
                <label>
                  Supplier
                  <input
                    required
                    value={itemForm.supplier}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, supplier: event.target.value })
                    }
                  />
                </label>
                <label>
                  Lokasi
                  <input
                    required
                    value={itemForm.location}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, location: event.target.value })
                    }
                  />
                </label>
                <label>
                  Expired
                  <input
                    required
                    type="date"
                    value={itemForm.nearestExpiry}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        nearestExpiry: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Minimum stok
                  <input
                    required
                    min="0"
                    type="number"
                    value={itemForm.minimum}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, minimum: event.target.value })
                    }
                  />
                </label>
                <label>
                  Harga beli
                  <input
                    required
                    min="0"
                    type="number"
                    value={itemForm.unitPrice}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        unitPrice: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              {itemMessage && (
                <p className="transaction-message">{itemMessage}</p>
              )}
              <button className="primary-button modal-submit" type="submit">
                Simpan obat
              </button>
            </form>
          </section>
        </div>
      )}
      {detailItem && (
        <div className="modal-backdrop" onClick={() => setDetailItem(null)}>
          <section
            className="transaction-modal detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Inventory detail</p>
                <h2>{detailItem.name}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setDetailItem(null)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <div className="detail-grid">
              <div>
                <span>Kode obat</span>
                <strong>{detailItem.id}</strong>
              </div>
              <div>
                <span>Nama generik</span>
                <strong>{detailItem.generic}</strong>
              </div>
              <div>
                <span>Kategori</span>
                <strong>{detailItem.category}</strong>
              </div>
              <div>
                <span>Batch</span>
                <strong>{detailItem.batch}</strong>
              </div>
              <div>
                <span>Total stok</span>
                <strong>{detailItem.stock} unit</strong>
              </div>
              <div>
                <span>Stok minimum</span>
                <strong>{detailItem.minimum} unit</strong>
              </div>
              <div>
                <span>Supplier</span>
                <strong>{detailItem.supplier}</strong>
              </div>
              <div>
                <span>Lokasi</span>
                <strong>{detailItem.location}</strong>
              </div>
              <div>
                <span>Nilai persediaan</span>
                <strong>
                  {currency.format(detailItem.stock * detailItem.unitPrice)}
                </strong>
              </div>
              <div>
                <span>Expired</span>
                <strong>
                  {new Date(detailItem.nearestExpiry).toLocaleDateString(
                    "id-ID",
                    { day: "2-digit", month: "short", year: "numeric" },
                  )}
                </strong>
              </div>
            </div>
            <div className="detail-history">
              <p className="eyebrow">Riwayat pergerakan</p>
              {transactions
                .filter(
                  (item) =>
                    (item.inventory?.id || item.inventoryId) === detailItem.id,
                )
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id}>
                    <span>
                      {item.type === "IN" ? "Stok masuk" : "Stok keluar"} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString("id-ID")}
                    </span>
                    <strong>{item.quantity} unit</strong>
                  </div>
                ))}
              {transactions.filter(
                (item) =>
                  (item.inventory?.id || item.inventoryId) === detailItem.id,
              ).length === 0 && (
                <span className="muted-copy">Belum ada riwayat transaksi.</span>
              )}
            </div>
          </section>
        </div>
      )}
      {logoutConfirmOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <section
            className="transaction-modal confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Konfirmasi</p>
                <h2>Keluar dari MediStock?</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setLogoutConfirmOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <p className="confirm-copy">
              Anda yakin ingin logout? Sesi Anda akan berakhir dan Anda akan
              kembali ke halaman login.
            </p>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Batal
              </button>
              <button className="danger-button" onClick={logout}>
                <LogOut size={15} /> Ya, keluar
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
