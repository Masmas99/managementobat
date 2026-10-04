"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, LogIn, Plus, ShieldCheck } from "lucide-react";

const demoAccounts = [
  { role: "Super Admin", email: "sari@medistock.local", password: "super123" },
  { role: "Admin Farmasi", email: "andi@medistock.local", password: "change-me" },
  { role: "Petugas Gudang", email: "gudang@medistock.local", password: "gudang123" },
  { role: "Viewer", email: "viewer@medistock.local", password: "viewer123" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("Memverifikasi...");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setLoading(false);
      setMessage(payload.error || "Login gagal. Coba lagi.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  function fillDemo(account) {
    setEmail(account.email);
    setPassword(account.password);
    setMessage("");
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-row">
          <div className="brand-mark">
            <img src="/image.png" alt="MediStock" />
          </div>
          <div>
            <strong>MediStock</strong>
            <span>Pharmacy control center</span>
          </div>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow">Manajemen persediaan obat</p>
          <h1>Masuk sesuai role Anda.</h1>
          <p className="intro-copy">
            Setiap role memiliki halaman dan hak akses berbeda. Super Admin dan
            Admin Farmasi mengelola seluruh sistem, Petugas Gudang mencatat
            pergerakan stok, Viewer hanya memantau laporan.
          </p>
          <ul className="login-role-list">
            <li>
              <ShieldCheck size={16} /> Akses menu dan aksi diverifikasi di
              server
            </li>
            <li>
              <ShieldCheck size={16} /> Sesi login berlaku 7 hari
            </li>
            <li>
              <ShieldCheck size={16} /> Akun nonaktif otomatis ditolak
            </li>
          </ul>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">Login</p>
          <h2>Selamat datang kembali</h2>
          <p className="intro-copy">Gunakan akun yang terdaftar di MediStock.</p>

          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@medistock.local"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password Anda"
            />
          </label>

          {message && (
            <p className={`login-message ${loading ? "info" : "error"}`}>
              <AlertTriangle size={14} /> {message}
            </p>
          )}

          <button className="primary-button login-submit" type="submit" disabled={loading}>
            <LogIn size={17} /> {loading ? "Memproses..." : "Masuk"}
          </button>

          <div className="login-demo">
            <p className="eyebrow">Akun demo</p>
            {demoAccounts.map((account) => (
              <button type="button" key={account.role} onClick={() => fillDemo(account)}>
                <span>
                  <strong>{account.role}</strong>
                  <em>{account.email}</em>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}
