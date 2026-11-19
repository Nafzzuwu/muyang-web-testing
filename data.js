// data.js — MUYANG v3.0
// Semua data warung sekarang disimpan di Supabase Database (tabel: warungs, warung_menus)
// File ini hanya menyimpan konstanta statis yang tidak perlu database.

// Tidak ada CULINARY_DATA dummy di sini.
// Data warung diambil via DB.getAllActiveWarungs() di app.js (dengan join warung_menus).

// Hanya konstanta UI statis yang dipertahankan:
const ADMIN_CREDS = { username: 'admin_muyang', password: 'admin123' }; // Fallback jika DB offline
