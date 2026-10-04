export const ROLES = ["Super Admin", "Admin Farmasi", "Petugas Gudang", "Viewer"];

const ALL_PAGES = [
  "Dashboard",
  "Data Obat",
  "Kategori Obat",
  "Batch Obat",
  "Supplier",
  "Lokasi Penyimpanan",
  "Stok Masuk",
  "Stok Keluar",
  "Penyesuaian Stok",
  "Kondisi Stok",
  "Stok Menipis",
  "Akan Expired",
  "Sudah Expired",
  "Laporan Stok",
  "Pengguna",
  "Riwayat Aktivitas",
  "Pengaturan",
  "Bantuan",
];

const OPERATIONAL_PAGES = ALL_PAGES.filter((page) => page !== "Pengguna");

const MONITORING_PAGES = [
  "Dashboard",
  "Kondisi Stok",
  "Stok Menipis",
  "Akan Expired",
  "Sudah Expired",
  "Laporan Stok",
  "Riwayat Aktivitas",
  "Pengaturan",
  "Bantuan",
];

const PAGE_ACCESS = {
  "Super Admin": ALL_PAGES,
  "Admin Farmasi": ALL_PAGES,
  "Petugas Gudang": OPERATIONAL_PAGES,
  "Viewer": MONITORING_PAGES,
};

const ACTION_ACCESS = {
  "Super Admin": ["manageInventory", "manageMaster", "recordTransaction", "adjustStock", "manageUsers"],
  "Admin Farmasi": ["manageInventory", "manageMaster", "recordTransaction", "adjustStock", "manageUsers"],
  "Petugas Gudang": ["manageMaster", "recordTransaction", "adjustStock"],
  "Viewer": [],
};

export function canAccess(role, page) {
  return Boolean(PAGE_ACCESS[role]?.includes(page));
}

export function can(role, action) {
  return Boolean(ACTION_ACCESS[role]?.includes(action));
}

export function pagesFor(role) {
  return PAGE_ACCESS[role] || [];
}
