/**
 * MUYANG (Murah Kenyang) - Full Application Logic v3.0
 * Kelompok 6 - Universitas Jember
 * Architecture: 100% Supabase Database (8 normalized tables)
 * - Zero localStorage for data (session-only LS key)
 * - Proper relational schema: users, warungs, warung_menus, reviews, bookmarks,
 *   umkm_registrations, paket_kemitraan, transactions
 * - Anti-spam reviews via DB UNIQUE constraint (warung_id, user_id)
 * - Bookmarks via proper bookmarks table
 * - Menus via warung_menus table (not JSONB blob)
 * - Admin full CRUD via DB
 */

// ============================================================
// UTILITY HELPERS
// ============================================================
function formatIDR(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

function showToast(message, type) {
  const toastMsg = document.getElementById('toastMsg');
  const toastText = document.getElementById('toastText');
  if (!toastMsg || !toastText) return;
  toastText.textContent = message;
  toastMsg.classList.remove('show', 'toast-error');
  if (type === 'error') toastMsg.classList.add('toast-error');
  toastMsg.classList.add('show');
  setTimeout(() => toastMsg.classList.remove('show', 'toast-error'), 4000);
}

let loadingDepth = 0;
function setLoading(isLoading, message = 'Memproses...') {
  const loadingEl = document.getElementById('globalLoading');
  const textEl = document.getElementById('globalLoadingText');
  if (!loadingEl) return;
  loadingDepth = Math.max(0, loadingDepth + (isLoading ? 1 : -1));
  if (isLoading && textEl) textEl.textContent = message;
  loadingEl.hidden = loadingDepth === 0;
  loadingEl.setAttribute('aria-busy', loadingDepth > 0 ? 'true' : 'false');
}

async function withLoading(task, message = 'Memproses...') {
  setLoading(true, message);
  try { return await task(); } finally { setLoading(false); }
}

function timeAgo(isoString) {
  if (!isoString) return 'Baru saja';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(isoString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// SECURITY HELPERS (cegah XSS saat render lewat innerHTML)
// ============================================================
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Hanya izinkan http(s). Hasilnya sudah di-escape, aman untuk atribut src/href.
function safeUrl(url, fallback = '') {
  if (url == null || String(url).trim() === '') return esc(fallback);
  try {
    const u = new URL(String(url ?? ''), window.location.origin);
    if (u.protocol === 'https:' || u.protocol === 'http:') return esc(u.href);
  } catch (e) { /* abaikan */ }
  return esc(fallback);
}

// ============================================================
// SESSION HELPERS (localStorage — session token only)
// ============================================================
const LS = {
  getSession: () => JSON.parse(localStorage.getItem('muyang_session') || 'null'),
  setSession: (d) => localStorage.setItem('muyang_session', JSON.stringify(d)),
  clearSession: () => localStorage.removeItem('muyang_session')
};

function saveAuthResponse(authData) {
  if (!authData?.ok || !authData.token || !authData.user) return false;
  const user = authData.user;
  const extra = user.extra_data || {};
  LS.setSession({
    token: authData.token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    role: user.role,
    id: user.id,
    nim: user.role === 'mahasiswa' ? user.identifier : undefined,
    email: user.role === 'umkm' ? user.identifier : undefined,
    username: user.role === 'admin' ? user.identifier : undefined,
    nama: user.role === 'mahasiswa' ? user.name : undefined,
    name: user.name,
    warungName: user.role === 'umkm' ? user.name : undefined,
    fakultas: extra.fakultas || 'Mahasiswa UNEJ',
    status: user.status || (user.role === 'umkm' ? 'pending' : undefined)
  });
  startSessionWatcher();
  return true;
}

function authErrorMessage(code, fallback = 'Operasi autentikasi gagal.') {
  return ({
    invalid_credentials: 'Identitas atau password salah.',
    too_many_attempts: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    duplicate: 'Data tersebut sudah terdaftar.',
    weak_password: 'Password baru minimal 6 karakter.',
    invalid_input: 'Periksa kembali data yang dimasukkan.',
    invalid_location: 'Titik lokasi warung tidak valid.',
    verification_failed: 'Data verifikasi tidak cocok.',
    unauthorized: 'Sesi sudah tidak valid. Silakan masuk kembali.'
  })[code] || fallback;
}

// Clear any old legacy localStorage keys on load
(function purgeLegacy() {
  ['muyang_users_mhs', 'muyang_users_umkm', 'muyang_seeded_v2', 'muyang_user_reviews'].forEach(k => localStorage.removeItem(k));
})();

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_CONFIG = {
  url: 'https://dtkfdhxcoatrctsdynhv.supabase.co',
  key: 'sb_publishable_AVy6Q_27ndMvnT37O-cSog_KcWXL7Aa'
};

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    console.log('[MUYANG] Database Client OK');
  } catch (err) {
    console.warn('[MUYANG] Database init error:', err);
  }
}

// Keuntungan otomatis per paket (harus sama dengan kolom di tabel paket_kemitraan)
const PAKET_BENEFITS = {
  'Featured Listing': { featured: true, badge: 'Mitra Baru Muyang' },
  'Promosi Kilat': { featured: false, badge: 'Promo Kilat' },
  'Kampanye Bersama': { featured: true, badge: 'Kampanye Muyang' }
};

// ============================================================
// DATABASE HELPER — central fetch function
// ============================================================
const DB = {
  async rpc(name, params = {}) {
    if (!supabaseClient) return { data: null, error: new Error('Database tidak tersedia.') };
    const { data, error } = await supabaseClient.rpc(name, params);
    return { data, error };
  },

  async login(identifier, password, role) {
    return this.rpc('app_login', {
      p_identifier: identifier,
      p_password: password,
      p_role: role
    });
  },

  async checkSession(token) {
    return this.rpc('app_check_session', { p_token: token });
  },

  async validateSession(token, role) {
    const validationRpc = {
      mahasiswa: 'mhs_my_bookmarks',
      umkm: 'umkm_my_registration',
      admin: 'admin_list_registrations'
    }[role];
    if (!validationRpc) return { data: null, error: new Error('Role sesi tidak valid.') };
    return this.rpc(validationRpc, { p_token: token });
  },

  async registerMahasiswa(nim, name, fakultas, password) {
    return this.rpc('app_register_mahasiswa', {
      p_nim: nim,
      p_name: name,
      p_fakultas: fakultas,
      p_password: password
    });
  },

  async registerUmkm(payload) {
    return this.rpc('app_register_umkm', {
      p_warung_name: payload.warungName,
      p_owner_name: payload.ownerName,
      p_email: payload.email,
      p_whatsapp: payload.whatsapp,
      p_alamat: payload.alamat,
      p_paket_name: payload.paketName,
      p_lat: payload.lat,
      p_lng: payload.lng,
      p_password: payload.password
    });
  },

  async resetPassword(identifier, role, verifier, newPassword) {
    return this.rpc('app_reset_password', {
      p_identifier: identifier,
      p_role: role,
      p_verifier: verifier,
      p_new_password: newPassword
    });
  },

  async getMyBookmarks(token) {
    const { data, error } = await this.rpc('mhs_my_bookmarks', { p_token: token });
    return { data: data || [], error };
  },

  async addBookmark(token, warungId) {
    return this.rpc('mhs_add_bookmark', { p_token: token, p_warung_id: warungId });
  },

  async removeBookmark(token, warungId) {
    return this.rpc('mhs_remove_bookmark', { p_token: token, p_warung_id: warungId });
  },

  async submitReview(token, review) {
    return this.rpc('mhs_submit_review', {
      p_token: token,
      p_warung_id: review.warung_id,
      p_rating: review.rating,
      p_kenyang: review.kenyang,
      p_comment: review.comment,
      p_faculty: review.faculty
    });
  },

  async deleteReview(reviewId, token = LS.getSession()?.token) {
    return this.rpc('delete_review', { p_token: token, p_review_id: reviewId });
  },

  async getMyRegistration(token) {
    return this.rpc('umkm_my_registration', { p_token: token });
  },

  async getMyPartnership(token) { return this.rpc('umkm_my_partnership', { p_token: token }); },
  async requestPackageChange(token, paketId) { return this.rpc('umkm_request_package_change', { p_token: token, p_paket_id: paketId }); },
  async adminPartnershipOverview(token) { return this.rpc('admin_partnership_overview', { p_token: token }); },
  async adminApprovePackageChange(token, regId) { return this.rpc('admin_approve_package_change', { p_token: token, p_reg_id: regId }); },

  async getMyWarung(token) {
    return this.rpc('umkm_my_warung', { p_token: token });
  },

  async getAdminRegistrations(token) {
    const { data, error } = await this.rpc('admin_list_registrations', { p_token: token });
    return { data: data || [], error };
  },

  async getAdminRegistration(token, regId) {
    return this.rpc('admin_get_registration', { p_token: token, p_reg_id: regId });
  },

  async listAdminReviews(token) {
    return this.getAdminReviews(token);
  },

  async deleteAdminReview(token, reviewId) {
    return this.deleteReview(token, reviewId);
  },

  async getAdminReviews(token) {
    const { data, error } = await this.rpc('admin_list_reviews', { p_token: token });
    return { data: data || [], error };
  },

  async saveUmkmLocation(token, lat, lng, distance, coordinates) {
    return this.rpc('umkm_set_location', {
      p_token: token, p_lat: lat, p_lng: lng,
      p_distance: distance, p_coordinates: coordinates
    });
  },

  async saveAdminLocation(token, regId, lat, lng, distance, coordinates) {
    return this.rpc('admin_set_registration_location', {
      p_token: token, p_reg_id: regId, p_lat: lat, p_lng: lng,
      p_distance: distance, p_coordinates: coordinates
    });
  },

  async setWarungImage(token, imageUrl) {
    return this.rpc('umkm_set_warung_image', { p_token: token, p_image_url: imageUrl });
  },

  // ---- WARUNGS ----
  async getAllActiveWarungs() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from('warungs')
      .select('*, warung_menus(*)')
      .eq('is_active', true)
      .order('id', { ascending: true });
    if (error) { console.warn('[DB] getAllActiveWarungs:', error.message); return []; }
    return data || [];
  },

  async getWarungById(id) {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient
      .from('warungs')
      .select('*, warung_menus(*)')
      .eq('id', id)
      .maybeSingle();
    return data;
  },

  async getWarungByOwnerId(userId) {
    const session = LS.getSession();
    if (!session || session.id !== userId || session.role !== 'umkm') return null;
    const { data } = await this.getMyWarung(session.token);
    return data;
  },

  // ---- REVIEWS ----
  async getReviewsForWarung(warungId) {
    if (!supabaseClient) return [];
    const { data } = await supabaseClient
      .from('reviews')
      .select('*')
      .eq('warung_id', warungId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async getUserReviews(userId) {
    if (!supabaseClient) return [];
    const session = LS.getSession();
    if (!session || session.id !== userId) return [];
    const { data } = await supabaseClient
      .from('reviews')
      .select('*, warungs(name, image_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async hasUserReviewedWarung(userId, warungId) {
    if (!supabaseClient) return false;
    const { data } = await supabaseClient
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('warung_id', warungId)
      .maybeSingle();
    return !!data;
  },

  async insertReview(review) {
    return this.submitReview(LS.getSession()?.token, review);
  },

  async deleteReview(reviewId) {
    return this.deleteReviewRpc(LS.getSession()?.token, reviewId);
  },

  async deleteReviewRpc(token, reviewId) {
    return this.rpc('delete_review', { p_token: token, p_review_id: reviewId });
  },

  // ---- BOOKMARKS ----
  async getUserBookmarks(userId) {
    const { data } = await this.getMyBookmarks(LS.getSession()?.token);
    return data || [];
  },

  async isBookmarked(userId, warungId) {
    const rows = await this.getUserBookmarks(userId);
    return rows.some(row => String(row.warung_id) === String(warungId));
  },

  async addBookmark(userId, warungId) {
    return this.addBookmarkRpc(LS.getSession()?.token, warungId);
  },

  async removeBookmark(userId, warungId) {
    return this.removeBookmarkRpc(LS.getSession()?.token, warungId);
  },

  async addBookmarkRpc(token, warungId) { return this.rpc('mhs_add_bookmark', { p_token: token, p_warung_id: warungId }); },
  async removeBookmarkRpc(token, warungId) { return this.rpc('mhs_remove_bookmark', { p_token: token, p_warung_id: warungId }); },

  // ---- WARUNG MENUS ----
  async insertMenu(menu) {
    return this.rpc('umkm_add_menu', {
      p_token: LS.getSession()?.token,
      p_name: menu.name,
      p_price: menu.price,
      p_portion: menu.portion,
      p_image_url: menu.image_url || null
    });
  },

  async deleteMenu(menuId) {
    return this.rpc('umkm_delete_menu', { p_token: LS.getSession()?.token, p_menu_id: menuId });
  },

  async updateMenuAvailability(menuId, isAvailable) {
    return this.rpc('umkm_set_menu_available', {
      p_token: LS.getSession()?.token,
      p_menu_id: menuId,
      p_available: isAvailable
    });
  },

  // ---- USERS ----

  // ---- PAKET KEMITRAAN ----
  async getPaketList() {
    if (!supabaseClient) return [];
    const { data } = await supabaseClient.from('paket_kemitraan').select('*').order('price');
    return data || [];
  },

  async getPaketById(id) {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.from('paket_kemitraan').select('*').eq('id', id).maybeSingle();
    return data;
  },

  // ---- UMKM REGISTRATIONS ----
  async getAllRegistrations() {
    const session = LS.getSession();
    if (!session?.token || session.role !== 'admin') return [];
    const { data, error } = await this.getAdminRegistrations(session.token);
    if (error) throw error;
    return data || [];
  },

  async getRegistrationByUserId(userId) {
    const session = LS.getSession();
    if (!session || session.id !== userId || session.role !== 'umkm') return null;
    const { data } = await this.getMyRegistration(session.token);
    return data;
  },

  async insertRegistration(reg) {
    return { data: null, error: new Error('Pendaftaran harus menggunakan app_register_umkm.') };
  },

  async adminAction(action, regId, warung) {
    const functions = {
      approve: 'admin_approve_registration',
      reject: 'admin_reject_registration',
      activate: 'admin_activate_registration',
      deactivate: 'admin_deactivate_registration',
      reactivate: 'admin_reactivate_registration'
    };
    const params = { p_token: LS.getSession()?.token, p_reg_id: regId };
    if (action === 'activate') params.p_warung = warung;
    return this.rpc(functions[action], params);
  },

  async runAdminAction(action, regId, warung) {
    const labels = {
      approve: 'Menyetujui pendaftaran...',
      reject: 'Menolak pendaftaran...',
      activate: 'Mengaktifkan mitra...',
      deactivate: 'Menonaktifkan kemitraan...',
      reactivate: 'Mengaktifkan kembali mitra...'
    };
    const { data, error } = await withLoading(
      () => this.adminAction(action, regId, warung),
      labels[action] || 'Memproses aksi admin...'
    );
    if (error) throw error;
    return data;
  },

  // ---- TRANSACTIONS ----
  async getTransactionByRegId(regId) {
    return null;
  },

  async insertTransaction(tx) {
    return { error: new Error('Transaksi dibuat oleh RPC persetujuan admin.') };
  },

  async updateTransactionStatus(regId, status) {
    return { error: new Error('Status transaksi dikelola oleh RPC server.') };
  }
};

// ============================================================
// IN-MEMORY WARUNG CACHE (refreshed from Supabase on load)
// ============================================================
let warungsCache = [];

async function refreshWarungsCache() {
  warungsCache = await DB.getAllActiveWarungs();
  return warungsCache;
}

function normalizeWarung(w) {
  // Normalize DB warung to app format for rendering
  const menus = (w.warung_menus || []).filter(m => m.is_available);
  const prices = menus.map(m => m.price).filter(p => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : (w.min_price || 0);
  const maxPrice = prices.length > 0 ? Math.max(...prices) : (w.max_price || 0);

  // Safe parse: JSONB bisa datang sebagai array, JSON string, atau Postgres text[] {val1,val2}
  let features = w.features || [];
  if (typeof features === 'string') {
    if (features.startsWith('{') && features.endsWith('}')) {
      // Postgres text[] format: {"val1","val2"} → parse manually
      try {
        features = JSON.parse('[' + features.slice(1, -1).replace(/"([^"]*)"/g, '"$1"') + ']');
      } catch {
        // fallback: strip braces and split by comma
        features = features.slice(1, -1).split(',').map(s => s.replace(/^"(.*)"$/, '$1').trim()).filter(Boolean);
      }
    } else {
      try { features = JSON.parse(features); } catch { features = []; }
    }
  }
  if (!Array.isArray(features)) features = [];

  let coordinates = w.coordinates || { x: 50, y: 50 };
  if (typeof coordinates === 'string') { try { coordinates = JSON.parse(coordinates); } catch { coordinates = { x: 50, y: 50 }; } }

  return {
    id: w.id,
    name: w.name,
    category: w.category,
    categoryLabel: w.category_label || w.category,
    location: w.location || '',
    area: w.area || 'Jl. Kalimantan',
    lat: w.lat,
    lng: w.lng,
    googleMapsUrl: w.google_maps_url || `https://www.google.com/maps?q=${w.lat},${w.lng}`,
    whatsapp: w.whatsapp || '081234567890',
    distance: w.distance || '500m dari Kampus',
    priceRange: minPrice > 0 ? `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}` : 'Harga Variatif',
    minPrice,
    maxPrice,
    avgPrice: w.avg_price || Math.round((minPrice + maxPrice) / 2),
    rating: w.rating || 4.5,
    reviewsCount: w.reviews_count || 0,
    kenyangScore: w.kenyang_score || 9.0,
    isFeatured: w.is_featured || false,
    promoBadge: w.promo_badge || null,
    image: w.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    hours: w.hours || '08.00 - 21.00 WIB',
    features,
    description: w.description || `Warung mitra resmi Muyang. Sajian lezat khusus mahasiswa UNEJ.`,
    popularMenus: menus.map(m => ({
      id: m.id,
      name: m.name,
      price: m.price,
      portion: m.portion || 'Porsi Kenyang',
      isBestSeller: m.is_best_seller || false,
      imageUrl: m.image_url || null
    })),
    coordinates
  };
}

function getAllCulinaryData() {
  return warungsCache.map(normalizeWarung);
}

// ============================================================
// VIEW & NAVIGATION MANAGEMENT
// ============================================================
function showLanding() {
  const landing = document.getElementById('landingContent');
  if (landing) landing.style.display = '';
  document.querySelectorAll('.dashboard-view').forEach(v => v.style.display = 'none');
  const footer = document.getElementById('mainFooter');
  if (footer) footer.style.display = '';
}

function showDashboard(viewId) {
  const landing = document.getElementById('landingContent');
  if (landing) landing.style.display = 'none';
  document.querySelectorAll('.dashboard-view').forEach(v => v.style.display = 'none');
  const target = document.getElementById(viewId);
  if (target) target.style.display = '';
  const footer = document.getElementById('mainFooter');
  if (footer) footer.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.showLanding = showLanding;

function setActiveNav(hash) {
  document.querySelectorAll('.nav-links .nav-item').forEach(item => {
    const a = item.querySelector('a');
    if (a && a.getAttribute('href') === hash) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function navigateToSection(hash) {
  showLanding();
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  if (mobileNavDrawer && mobileNavDrawer.classList.contains('active')) {
    mobileNavDrawer.classList.remove('active');
  }
  if (!hash || hash === '#' || hash === '#home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', '#home');
    return;
  }
  const targetEl = document.querySelector(hash);
  if (targetEl) {
    history.replaceState(null, '', hash);
    setTimeout(() => targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    setActiveNav(hash);
    if (hash === '#radar-map' && leafletMap) {
      setTimeout(() => leafletMap.invalidateSize(), 300);
    }
  }
}
window.navigateToSection = navigateToSection;

// ============================================================
// NAVBAR STATE
// ============================================================
function updateNavbarState() {
  const session = LS.getSession();
  if (session && (!session.token || (session.expiresAt && session.expiresAt <= Date.now()))) {
    LS.clearSession();
  }
  const currentSession = LS.getSession();
  const navActions = document.getElementById('navActions');
  const mobileAuthArea = document.getElementById('mobileNavAuthArea');
  if (!navActions) return;

  if (!currentSession) {
    navActions.innerHTML = `
      <button class="btn btn-outline btn-sm" id="navBtnLogin">
        <i class="fa-solid fa-right-to-bracket"></i> Masuk
      </button>
      <button class="btn btn-primary btn-sm" id="navBtnRegister">
        <i class="fa-solid fa-user-plus"></i> Daftar
      </button>
    `;
    if (mobileAuthArea) mobileAuthArea.innerHTML = `
      <button class="btn btn-outline" style="width:100%;" id="navBtnLoginMobile"><i class="fa-solid fa-right-to-bracket"></i> Masuk</button>
      <button class="btn btn-primary" style="width:100%;margin-top:8px;" id="navBtnRegisterMobile"><i class="fa-solid fa-user-plus"></i> Daftar</button>
    `;
    document.getElementById('navBtnLogin')?.addEventListener('click', () => openModal('loginModal'));
    document.getElementById('navBtnRegister')?.addEventListener('click', () => openModal('registerModal'));
    document.getElementById('navBtnLoginMobile')?.addEventListener('click', () => openModal('loginModal'));
    document.getElementById('navBtnRegisterMobile')?.addEventListener('click', () => openModal('registerModal'));
  } else {
    let displayName = '';
    let roleLabel = '';
    let roleIcon = '';
    if (currentSession.role === 'mahasiswa') {
      displayName = currentSession.nama || currentSession.nim;
      roleLabel = 'Mahasiswa UNEJ';
      roleIcon = '<i class="fa-solid fa-user-graduate"></i>';
    } else if (currentSession.role === 'umkm') {
      displayName = currentSession.warungName || currentSession.email;
      roleLabel = 'Mitra UMKM';
      roleIcon = '<i class="fa-solid fa-store"></i>';
    } else if (currentSession.role === 'admin') {
      displayName = 'Administrator';
      roleLabel = 'Admin MUYANG';
      roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
    }

    navActions.innerHTML = `
      <div class="nav-logged-wrap">
        <button class="btn btn-primary btn-sm" id="navDirectDashBtn" title="Buka Dashboard">
          <i class="fa-solid fa-gauge"></i> <span>Dashboard</span>
        </button>
        <div class="user-dropdown-wrap">
          <button class="btn btn-outline btn-sm user-dropdown-trigger" id="navUserBtn" aria-label="Menu Pengguna">
            ${roleIcon} <span class="nav-user-name">${esc(displayName)}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;"></i>
          </button>
          <div class="user-dropdown-menu" id="navUserDropdown">
            <div style="padding: 10px 14px; background: var(--neutral-50); border-bottom: 1px solid var(--neutral-200);">
              <div style="font-size: 0.7rem; color: var(--neutral-400); font-weight: 700; text-transform: uppercase;">Login Sebagai:</div>
              <div style="font-size: 0.85rem; font-weight: 800; color: var(--primary-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(displayName)}</div>
              <div style="font-size: 0.72rem; color: var(--accent-600); font-weight: 700;">${roleLabel}</div>
            </div>
            <a href="#dashboard" class="dropdown-item" id="dropDashboard"><i class="fa-solid fa-gauge"></i> Buka Dashboard</a>
            <a href="#katalog" class="dropdown-item" id="dropKatalog"><i class="fa-solid fa-magnifying-glass"></i> Cari Kuliner</a>
            <a href="#radar-map" class="dropdown-item" id="dropRadar"><i class="fa-solid fa-map-location-dot"></i> Peta Kampus</a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item dropdown-item-danger" id="dropLogout"><i class="fa-solid fa-right-from-bracket"></i> Keluar</a>
          </div>
        </div>
      </div>
    `;

    if (mobileAuthArea) mobileAuthArea.innerHTML = `
      <button class="btn btn-primary" style="width:100%;" id="mobileDashBtn"><i class="fa-solid fa-gauge"></i> Buka Dashboard</button>
      <button class="btn btn-outline" style="width:100%;margin-top:8px;" id="mobileLogoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
    `;

    document.getElementById('navUserBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('navUserDropdown')?.classList.toggle('open');
    });

    document.getElementById('navDirectDashBtn')?.addEventListener('click', () => routeToDashboard());
    document.getElementById('dropDashboard')?.addEventListener('click', (e) => { e.preventDefault(); routeToDashboard(); });
    document.getElementById('dropKatalog')?.addEventListener('click', (e) => { e.preventDefault(); navigateToSection('#katalog'); });
    document.getElementById('dropRadar')?.addEventListener('click', (e) => { e.preventDefault(); navigateToSection('#radar-map'); });
    document.getElementById('dropLogout')?.addEventListener('click', (e) => { e.preventDefault(); window.logoutUser(); });
    document.getElementById('mobileDashBtn')?.addEventListener('click', () => {
      document.getElementById('mobileNavDrawer')?.classList.remove('active');
      routeToDashboard();
    });
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => window.logoutUser());
  }
}

async function routeToDashboard() {
  const session = LS.getSession();
  if (!session) { openModal('loginModal'); return; }
  await withLoading(async () => {
    history.replaceState(null, '', '#dashboard');
    if (session.role === 'admin') {
      showDashboard('viewDashboardAdmin');
      await renderAdminDashboard();
    } else if (session.role === 'mahasiswa') {
      showDashboard('viewDashboardMahasiswa');
      await renderMahasiswaDashboard();
    } else if (session.role === 'umkm') {
      await renderUmkmDashboard();
    }
  }, 'Memuat dashboard...');
}
window.routeToDashboard = routeToDashboard;

// ============================================================
// AUTH: MODAL HELPERS
// ============================================================
function openModal(id) {
  closeAllModals();
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
}
window.closeAllModals = closeAllModals;

window.openLoginModal = function (tab) {
  openModal('loginModal');
  if (tab) {
    document.querySelectorAll('#loginModal .auth-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('#loginModal .auth-tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'loginPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
    });
  }
};

// ============================================================
// AUTH: LOGIN HANDLERS (100% Supabase)
// ============================================================
async function handleLoginMahasiswa(e) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }
  const nim = document.getElementById('loginNim').value.trim();
  const password = document.getElementById('loginPasswordMhs').value;

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi...'; }
  setLoading(true, 'Memverifikasi akun...');

  try {
    const { data, error } = await DB.login(nim, password, 'mahasiswa');
    if (error) throw error;
    if (!saveAuthResponse(data)) {
      showToast(authErrorMessage(data?.error, 'NIM atau password salah.'), 'error');
    } else {
      closeAllModals();
      updateNavbarState();
      routeToDashboard();
      showToast(`Selamat datang, ${data.user.name}!`);
    }
  } catch (err) {
    showToast('Gagal terhubung ke database.', 'error');
    console.warn('[AUTH] Login mahasiswa error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

async function handleLoginUmkm(e) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }
  const email = document.getElementById('loginEmailUmkm').value.trim().toLowerCase();
  const password = document.getElementById('loginPasswordUmkm').value;

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi...'; }
  setLoading(true, 'Memverifikasi akun UMKM...');

  try {
    const { data, error } = await DB.login(email, password, 'umkm');
    if (error) throw error;
    if (!saveAuthResponse(data)) {
      showToast(authErrorMessage(data?.error, 'Email atau password UMKM salah.'), 'error');
    } else {
      closeAllModals();
      updateNavbarState();
      routeToDashboard();
      showToast(`Selamat datang, ${data.user.name}!`);
    }
  } catch (err) {
    showToast('Gagal terhubung ke database.', 'error');
    console.warn('[AUTH] Login UMKM error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

async function handleLoginAdmin(e) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi...'; }
  setLoading(true, 'Memverifikasi akses admin...');

  try {
    const { data, error } = await DB.login(username, password, 'admin');
    if (error) throw error;
    if (!saveAuthResponse(data)) {
      showToast(authErrorMessage(data?.error, 'Kredensial admin salah.'), 'error');
    } else {
      closeAllModals();
      updateNavbarState();
      routeToDashboard();
      showToast(`Selamat datang, ${data.user.name}!`);
    }
  } catch (err) {
    showToast('Gagal terhubung ke database.', 'error');
    console.warn('[AUTH] Login admin error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

// ============================================================
// AUTH: LUPA PASSWORD (mahasiswa lewat NIM, UMKM lewat email, lalu atur password baru)
// ============================================================
window.openForgotPassword = function (role) {
  const isMhs = role === 'mahasiswa';
  openModal('forgotPasswordModal');
  document.getElementById('forgotFormMahasiswa').style.display = isMhs ? '' : 'none';
  document.getElementById('forgotFormUmkm').style.display = isMhs ? 'none' : '';
  document.getElementById('forgotSubtitle').textContent = isMhs
    ? 'Masukkan NIM kamu untuk membuat password baru.'
    : 'Masukkan email UMKM kamu untuk membuat password baru.';
  document.getElementById('forgotBackBtn').dataset.role = role;
  // Bawa isian dari form login supaya tidak mengetik ulang
  const typed = document.getElementById(isMhs ? 'loginNim' : 'loginEmailUmkm')?.value.trim();
  const target = document.getElementById(isMhs ? 'forgotNim' : 'forgotEmailUmkm');
  if (typed && target && !target.value) target.value = typed;
  const verifier = document.getElementById(isMhs ? 'forgotVerifierMhs' : 'forgotVerifierUmkm');
  if (verifier) verifier.value = '';
};

async function handleForgotPassword(e, role) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }

  const isMhs = role === 'mahasiswa';
  const newPass = document.getElementById(isMhs ? 'forgotNewPassMhs' : 'forgotNewPassUmkm').value;
  const confirmPass = document.getElementById(isMhs ? 'forgotConfirmPassMhs' : 'forgotConfirmPassUmkm').value;
  const verifier = document.getElementById(isMhs ? 'forgotVerifierMhs' : 'forgotVerifierUmkm').value.trim();
  if (newPass.length < 6) { showToast('Password baru minimal 6 karakter.', 'error'); return; }
  if (newPass !== confirmPass) { showToast('Konfirmasi password tidak sama.', 'error'); return; }
  if (!verifier) { showToast('Isi data verifikasi terlebih dahulu.', 'error'); return; }

  const btn = e.target.querySelector('[type=submit]');
  const btnLabel = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi...'; }
  setLoading(true, 'Memverifikasi data dan memperbarui password...');

  try {
    const identifier = isMhs
      ? document.getElementById('forgotNim').value.trim()
      : document.getElementById('forgotEmailUmkm').value.trim().toLowerCase();
    const { data, error } = await DB.resetPassword(identifier, role, verifier, newPass);
    if (error) {
      showToast('Gagal mengubah password: ' + (error.message || 'Coba lagi.'), 'error');
      return;
    }
    if (!data?.ok) {
      showToast(authErrorMessage(data?.error, 'Verifikasi gagal. Periksa identitas dan data verifikasi.'), 'error');
      return;
    }

    document.getElementById(isMhs ? 'forgotFormMahasiswa' : 'forgotFormUmkm')?.reset();
    window.openLoginModal(role);
    const loginInput = document.getElementById(isMhs ? 'loginNim' : 'loginEmailUmkm');
    if (loginInput) loginInput.value = identifier;
    showToast('Password berhasil diubah. Silakan masuk dengan password baru.');
  } catch (err) {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
    console.warn('[AUTH] Forgot password error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.innerHTML = btnLabel; }
  }
}

// ============================================================
// AUTH: REGISTER HANDLERS (100% Supabase)
// ============================================================
async function handleRegisterMahasiswa(e) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }
  const nama = document.getElementById('regNamaLengkap').value.trim();
  const nim = document.getElementById('regNim').value.trim();
  const fakultas = document.getElementById('regFakultas').value.trim();
  const password = document.getElementById('regPasswordMhs').value;

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Mendaftarkan...'; }
  setLoading(true, 'Membuat akun mahasiswa...');

  try {
    const { data, error } = await DB.registerMahasiswa(nim, nama, fakultas, password);
    if (error) throw error;
    if (!saveAuthResponse(data)) {
      showToast(authErrorMessage(data?.error, 'Gagal mendaftar.'), 'error');
      return;
    }
    closeAllModals();
    document.getElementById('registerFormMahasiswa')?.reset();
    updateNavbarState();
    routeToDashboard();
    showToast(`Daftar berhasil! Selamat datang, ${data.user.name}!`);
  } catch (err) {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
    console.warn('[AUTH] Register mahasiswa error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Daftar Sekarang'; }
  }
}

async function handleRegisterUmkm(e) {
  e.preventDefault();
  if (!supabaseClient) { showToast('Database tidak tersedia.', 'error'); return; }
  const warungName = document.getElementById('regWarungName').value.trim();
  const ownerName = document.getElementById('regOwnerName').value.trim();
  const email = document.getElementById('regEmailUmkm').value.trim().toLowerCase();
  const whatsapp = document.getElementById('regWa').value.trim();
  const alamat = document.getElementById('regAlamat').value.trim();
  const paketEl = document.getElementById('regPaket');
  const paketName = paketEl.value;
  const password = document.getElementById('regPasswordUmkm').value;

  // Titik lokasi wajib diisi dan harus masuk akal (area Jember)
  const loc = regLocPicker ? regLocPicker.getLatLng() : null;
  if (!loc) {
    showToast('Tentukan titik lokasi warung di peta dulu (ketuk peta atau pakai "Gunakan lokasi saya").', 'error');
    document.getElementById('regMapPicker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const locErr = validateCoords(loc.lat, loc.lng);
  if (locErr) { showToast(locErr, 'error'); return; }

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Mendaftarkan...'; }
  setLoading(true, 'Mengirim pendaftaran UMKM...');

  try {
    const { data, error } = await DB.registerUmkm({
      warungName, ownerName, email, whatsapp, alamat, paketName,
      lat: +loc.lat.toFixed(6),
      lng: +loc.lng.toFixed(6),
      password
    });
    if (error) throw error;
    if (!saveAuthResponse(data)) {
      showToast(authErrorMessage(data?.error, 'Gagal mendaftarkan UMKM.'), 'error');
      return;
    }
    closeAllModals();
    document.getElementById('registerFormUmkm')?.reset();
    if (regLocPicker) regLocPicker.clear();
    updateNavbarState();
    routeToDashboard();
    showToast(`Pendaftaran "${data.user.name}" berhasil! Menunggu verifikasi admin.`);
  } catch (err) {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
    console.warn('[AUTH] Register UMKM error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Daftar Mitra Sekarang'; }
  }
}

// ============================================================
// AUTH: LOGOUT
// ============================================================
window.logoutUser = function () {
  const session = LS.getSession();
  withLoading(async () => {
    stopSessionWatcher();
    if (session?.token) await DB.rpc('app_logout', { p_token: session.token });
    LS.clearSession();
    updateNavbarState();
    showLanding();
    history.replaceState(null, '', '#home');
    showToast('Berhasil keluar. Sampai jumpa!');
  }, 'Keluar dari akun...');
};

// ============================================================
// SESSION WATCHER — tendang perangkat lama jika akun login di perangkat lain
// ============================================================
const SESSION_CHECK_INTERVAL_MS = 60000; // cadangan; notifikasi utama lewat Realtime
let kickChannel = null;
let sessionWatcherTimer = null;
let sessionCheckBusy = false;

function showSessionKickedModal() {
  document.getElementById('sessionKickedModal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'sessionKickedModal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-card modal-xs">
      <div class="modal-content-pad" style="text-align:center;">
        <div style="font-size:2.4rem;color:#c2410c;margin-bottom:10px;"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3 style="margin:0 0 8px;">Akun Login di Perangkat Lain</h3>
        <p style="margin:0 0 18px;color:#6b7280;line-height:1.5;">
          Akun kamu baru saja dipakai masuk di perangkat lain, jadi sesi di perangkat ini otomatis diakhiri.
          Satu akun hanya bisa aktif di satu perangkat. Jika itu bukan kamu, segera masuk kembali dan ganti password.
        </p>
        <button class="btn btn-primary" style="width:100%;" id="sessionKickedOk">Masuk Kembali</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('sessionKickedOk')?.addEventListener('click', () => {
    modal.remove();
    openModal('loginModal');
  });
}

function handleSessionEnded(reason) {
  stopSessionWatcher();
  LS.clearSession();
  updateNavbarState();
  showLanding();
  history.replaceState(null, '', '#home');
  if (reason === 'replaced') {
    showSessionKickedModal();
  } else {
    showToast('Sesi kamu sudah berakhir. Silakan masuk kembali.', 'error');
  }
}

async function checkSessionNow() {
  if (sessionCheckBusy) return;
  const session = LS.getSession();
  if (!session?.token) { stopSessionWatcher(); return; }
  sessionCheckBusy = true;
  try {
    const { data, error } = await DB.checkSession(session.token);
    if (error || !data) return; // gangguan jaringan: jangan logout
    // abaikan jika user sudah login ulang selama request berjalan
    if (LS.getSession()?.token !== session.token) return;
    if (data.ok === false) handleSessionEnded(data.reason);
  } catch (err) {
    console.info('[AUTH] Session check skipped:', err?.message);
  } finally {
    sessionCheckBusy = false;
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Dengarkan sinyal "kicked" dari database lewat Supabase Realtime (Broadcast).
// Nama channel memakai hash token sendiri, jadi hanya perangkat pemilik token yang tahu.
async function subscribeKickChannel(token) {
  if (!supabaseClient || !window.crypto?.subtle) return;
  try {
    const hash = await sha256Hex(token);
    // batalkan jika user sudah logout / login ulang selama hashing
    if (LS.getSession()?.token !== token) return;
    unsubscribeKickChannel();
    kickChannel = supabaseClient
      .channel('kick:' + hash)
      .on('broadcast', { event: 'kicked' }, () => {
        checkSessionNow();
        setTimeout(checkSessionNow, 1000); // jaga-jaga jika pengecekan sebelumnya masih berjalan
      })
      .subscribe((status) => {
        // setelah (re)connect, cek sekali untuk menutup celah pesan yang terlewat
        if (status === 'SUBSCRIBED') checkSessionNow();
      });
  } catch (err) {
    console.info('[AUTH] Realtime kick channel unavailable:', err?.message);
  }
}

function unsubscribeKickChannel() {
  if (kickChannel && supabaseClient) {
    try { supabaseClient.removeChannel(kickChannel); } catch (_) { /* abaikan */ }
  }
  kickChannel = null;
}

function startSessionWatcher() {
  stopSessionWatcher();
  const token = LS.getSession()?.token;
  if (!token) return;
  sessionWatcherTimer = setInterval(checkSessionNow, SESSION_CHECK_INTERVAL_MS);
  subscribeKickChannel(token);
}

function stopSessionWatcher() {
  if (sessionWatcherTimer) clearInterval(sessionWatcherTimer);
  sessionWatcherTimer = null;
  unsubscribeKickChannel();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && LS.getSession()?.token) checkSessionNow();
});
window.addEventListener('focus', () => {
  if (LS.getSession()?.token) checkSessionNow();
});

// ============================================================
// DASHBOARD: MAHASISWA (100% dari Supabase)
// ============================================================
async function renderMahasiswaDashboard() {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;

  const welcomeEl = document.getElementById('dashMahasiswaWelcome');
  if (welcomeEl) welcomeEl.textContent = `Halo, ${session.nama} (${session.nim}) — ${session.fakultas}`;

  // Load bookmarks dan reviews dari Supabase
  const [bookmarkRows, reviewRows] = await Promise.all([
    DB.getUserBookmarks(session.id),
    DB.getUserReviews(session.id)
  ]);

  // 1. Render Bookmarks
  const bookmarkListEl = document.getElementById('dashBookmarkList');
  if (bookmarkListEl) {
    if (bookmarkRows.length === 0) {
      bookmarkListEl.innerHTML = '<p style="color:var(--neutral-500);font-size:0.9rem;">Belum ada simpanan. Jelajahi katalog kuliner dan klik ikon bookmark pada warung favoritmu!</p>';
    } else {
      bookmarkListEl.innerHTML = bookmarkRows.map(bm => {
        const w = bm.warungs;
        if (!w) return '';
        return `
          <div class="dash-bookmark-card">
            <img src="${safeUrl(w.image_url, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80')}" alt="${esc(w.name)}" class="dash-bm-img">
            <div class="dash-bm-info">
              <h4>${esc(w.name)}</h4>
              <p><i class="fa-solid fa-location-dot"></i> ${esc(w.area || '')} (${esc(w.distance || '')})</p>
              <p style="color:var(--accent-600);font-weight:800;margin-top:4px;">Mulai ${formatIDR(w.min_price || 0)}</p>
            </div>
            <div class="dash-bm-actions">
              <button class="btn btn-primary btn-sm" onclick="window.openDetailModal(${esc(JSON.stringify(String(w.id)))})">
                <i class="fa-solid fa-eye"></i> Lihat Menu
              </button>
              <button class="btn btn-outline btn-sm" onclick="window.removeDashBookmark(${esc(JSON.stringify(String(w.id)))})" title="Hapus Simpanan">
                <i class="fa-solid fa-trash-can" style="color:#dc2626;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render Riwayat Ulasan
  const reviewListEl = document.getElementById('dashReviewList');
  if (reviewListEl) {
    if (reviewRows.length === 0) {
      reviewListEl.innerHTML = '<p style="color:var(--neutral-500);font-size:0.9rem;">Kamu belum menulis ulasan kuliner. Berikan ulasan pada tempat makan yang pernah kamu kunjungi!</p>';
    } else {
      reviewListEl.innerHTML = reviewRows.map(r => `
        <div class="dash-review-card">
          <div class="dash-review-top">
            <span class="dash-review-warung"><i class="fa-solid fa-store" style="color:var(--accent-500);"></i> ${esc(r.warungs?.name || 'Warung')}</span>
            <span class="dash-review-date">${timeAgo(r.created_at)}</span>
          </div>
          <div class="dash-review-badges">
            <span style="color:var(--gold-500);font-size:0.85rem;">${'<i class="fa-solid fa-star"></i>'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))}</span>
            <span style="background:var(--success-100);color:var(--success-700);font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:var(--radius-full);">Kenyang: ${r.kenyang}/5</span>
          </div>
          <p class="dash-review-comment">"${esc(r.comment)}"</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
            <button class="btn btn-primary btn-xs" onclick="window.openDetailModal(${esc(JSON.stringify(String(r.warung_id)))})">
              <i class="fa-solid fa-eye"></i> Buka Warung
            </button>
            <button class="btn btn-outline btn-xs" style="color:#dc2626;border-color:#dc2626;" onclick="window.deleteMahasiswaReview(${Number(r.id)})" title="Hapus Ulasan">
              <i class="fa-solid fa-trash-can"></i> Hapus
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

window.removeDashBookmark = async function (warungId) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;
  await withLoading(() => DB.removeBookmark(session.id, warungId), 'Menghapus dari simpanan...');
  await renderMahasiswaDashboard();
  renderCulinaryGrid();
  showToast('Warung dihapus dari simpanan favorit.');
};

window.deleteMahasiswaReview = async function (reviewId) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;
  await withLoading(() => DB.deleteReview(reviewId), 'Menghapus ulasan...');
  await renderMahasiswaDashboard();
  // Refresh warung cache for updated rating
  await refreshWarungsCache();
  renderCulinaryGrid();
  showToast('Ulasan kamu berhasil dihapus.');
};

// ============================================================
// MASA KEMITRAAN: info, ganti/perpanjang paket (UMKM) + ringkasan (admin)
// ============================================================
const MUYANG_WA = '6282336669588';

async function renderPartnershipInfo() {
  const box = document.getElementById('umkmPartnershipInfo');
  const session = LS.getSession();
  if (!box || !session?.token) return;
  const { data } = await DB.getMyPartnership(session.token);
  if (!data?.ok) { box.style.display = 'none'; return; }
  const left = data.days_left;
  const endTxt = data.ends_at ? new Date(data.ends_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  let tone = '#ecfdf5;color:#065f46', msg;
  if (data.status === 'expired') {
    // Banner "Masa Kemitraan Telah Berakhir" sudah menampilkan info + tombol perpanjang; jangan dobel.
    box.style.display = 'none';
    const desc = document.querySelector('#umkmExpiredBanner .expired-banner-desc');
    if (desc) {
      const base = 'Warung Anda sudah tidak tampil di katalog publik. Pilih paket untuk memperpanjang kemitraan dan mengaktifkan kembali listing Anda.';
      desc.textContent = data.ends_at ? `Berakhir pada ${endTxt}. ${base}` : base;
    }
    return;
  }
  if (left !== null && left <= 7) { tone = '#fffbeb;color:#92400e'; msg = `Paket ${esc(data.paket_name)} berakhir ${endTxt} (${left} hari lagi). Perpanjang agar listing tidak turun.`; }
  else { msg = `Paket ${esc(data.paket_name)} aktif sampai ${endTxt}${left !== null ? ` (${left} hari lagi)` : ''}.`; }
  const pending = data.pending_name
    ? `<div style="margin-top:6px;font-weight:700;">Permintaan ${esc(data.pending_name)} sedang menunggu verifikasi admin.</div>` : '';
  box.style.cssText = `display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 16px;border-radius:12px;margin:12px 0;background:${tone};`;
  box.innerHTML = `<div>${msg}${pending}</div>
    <button class="btn btn-primary btn-sm" onclick="window.openPackageChangeModal()"><i class="fa-solid fa-rotate"></i> Ganti / Perpanjang Paket</button>`;
}

window.openPackageChangeModal = async function () {
  document.getElementById('packageChangeModal')?.remove();
  const pakets = await DB.getPaketList();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'packageChangeModal';
  modal.innerHTML = `<div class="modal-card modal-sm"><button class="modal-close-btn" aria-label="Tutup">×</button>
    <div class="modal-content-pad"><h3 style="margin:0 0 6px;">Ganti / Perpanjang Paket</h3>
    <p style="margin:0 0 14px;color:#6b7280;">Pilih paket. Setelah transfer dan dikonfirmasi admin, paket langsung berlaku.</p>
    <div id="pkgOptions" style="display:grid;gap:8px;">${pakets.map((p, i) => `
      <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;">
        <input type="radio" name="pkgChoice" value="${Number(p.id)}" ${i === 0 ? 'checked' : ''}>
        <span><strong>${esc(p.name)}</strong> — ${formatIDR(p.price)} / ${Number(p.duration_days) || 30} hari</span>
      </label>`).join('')}</div>
    <button class="btn btn-accent btn-block" style="margin-top:14px;" id="pkgSubmit">Ajukan Permintaan</button></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
  document.getElementById('pkgSubmit').onclick = async () => {
    const id = Number(modal.querySelector('input[name="pkgChoice"]:checked')?.value);
    const session = LS.getSession();
    const { data, error } = await withLoading(() => DB.requestPackageChange(session.token, id), 'Mengajukan permintaan...');
    if (error || !data?.ok) { showToast('Gagal mengajukan permintaan. Coba lagi.', 'error'); return; }
    const wa = encodeURIComponent(`Halo Tim Muyang! Saya ingin ganti/perpanjang paket ke ${data.paket_name} senilai ${formatIDR(data.amount)} (ID: ${data.reg_id}). Berikut bukti transfer saya.`);
    modal.querySelector('.modal-content-pad').innerHTML = `<h3 style="margin:0 0 8px;">Permintaan Terkirim</h3>
      <p style="color:#6b7280;">Transfer ${formatIDR(data.amount)} lalu kirim bukti ke WhatsApp Muyang agar admin segera memverifikasi.</p>
      <a class="btn btn-accent btn-block" target="_blank" rel="noopener" href="https://wa.me/${MUYANG_WA}?text=${wa}"><i class="fa-brands fa-whatsapp"></i> Kirim Bukti via WhatsApp</a>`;
    renderPartnershipInfo();
  };
};

async function renderAdminPartnershipOverview(tableEl) {
  const session = LS.getSession();
  if (!tableEl || !session?.token) return;
  let box = document.getElementById('adminPartnershipOverview');
  if (!box) { box = document.createElement('div'); box.id = 'adminPartnershipOverview'; tableEl.parentElement.prepend(box); }
  const { data } = await DB.adminPartnershipOverview(session.token);
  if (!data?.ok || (!data.pending.length && !data.expiring.length)) { box.innerHTML = ''; return; }
  const fmt = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  box.innerHTML = `<div style="padding:12px 16px;margin-bottom:14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;">
    ${data.pending.length ? `<div style="font-weight:800;margin-bottom:6px;">Permintaan ganti/perpanjang paket (${data.pending.length})</div>` +
      data.pending.map(r => `<div style="display:flex;gap:10px;justify-content:space-between;align-items:center;padding:4px 0;flex-wrap:wrap;">
        <span><strong>${esc(r.business_name)}</strong>: ${esc(r.current_paket || '-')} → <strong>${esc(r.new_paket)}</strong> (${formatIDR(r.amount)}) · ${esc(r.phone)}</span>
        <button class="btn btn-primary btn-xs" onclick="window.adminApprovePackageChange(${Number(r.reg_id)})">Pembayaran Diterima, Terapkan</button></div>`).join('') : ''}
    ${data.expiring.length ? `<div style="font-weight:800;margin:${data.pending.length ? '10px' : '0'} 0 6px;">Segera berakhir (≤ 7 hari)</div>` +
      data.expiring.map(r => `<div style="padding:2px 0;"><strong>${esc(r.business_name)}</strong> — ${fmt(r.ends_at)} (${r.days_left} hari lagi) · ${esc(r.phone)}</div>`).join('') : ''}
  </div>`;
}

window.adminApprovePackageChange = async function (regId) {
  const { data, error } = await withLoading(() => DB.adminApprovePackageChange(LS.getSession()?.token, regId), 'Menerapkan paket...');
  if (error || !data?.ok) { showToast('Gagal menerapkan paket.', 'error'); return; }
  await refreshWarungsCache();
  renderCulinaryGrid();
  await renderAdminDashboard();
  showToast('Paket berhasil diterapkan.');
};

// ============================================================
// DASHBOARD: UMKM (100% dari Supabase)
// ============================================================
// Atur tampilan dashboard UMKM sesuai masa kemitraan (aktif vs berakhir).
// Dipanggil di kedua kondisi supaya sisa tampilan sebelumnya tidak "bocor".
function setUmkmExpiredState(isExpired) {
  const pill = document.getElementById('umkmActivePill');
  if (pill) pill.style.display = isExpired ? 'none' : '';

  const banner = document.getElementById('umkmExpiredBanner');
  if (banner) banner.style.display = isExpired ? '' : 'none';

  const addMenuForm = document.getElementById('addMenuForm');
  if (addMenuForm) {
    addMenuForm.style.opacity = isExpired ? '0.5' : '';
    addMenuForm.style.pointerEvents = isExpired ? 'none' : '';
  }

  const uploadBtn = document.getElementById('uploadWarungPhotoBtn');
  if (uploadBtn) {
    uploadBtn.disabled = isExpired;
    uploadBtn.title = isExpired ? 'Perpanjang kemitraan untuk mengupload foto.' : '';
  }
}

async function renderUmkmDashboard() {
  const session = LS.getSession();
  if (!session || session.role !== 'umkm') return;

  // Ambil data live dari Supabase
  const [reg, warung] = await Promise.all([
    DB.getRegistrationByUserId(session.id),
    DB.getWarungByOwnerId(session.id)
  ]);

  const status = reg ? reg.status : 'pending';

  // Update session status
  if (session.status !== status) {
    session.status = status;
    LS.setSession(session);
  }

  if (status === 'pending') {
    const el = document.getElementById('pendingUmkmName');
    if (el) el.textContent = session.warungName;
    showDashboard('viewDashboardUmkmPending');

  } else if (status === 'awaiting_payment') {
    const paket = reg.paket_kemitraan;
    const el = document.getElementById('paymentUmkmName');
    if (el) el.textContent = session.warungName;
    const paketEl = document.getElementById('paymentPaket');
    const nominalEl = document.getElementById('paymentNominal');
    const waEl = document.getElementById('paymentWaLink');
    if (paketEl) paketEl.textContent = paket ? paket.name : reg.category;
    const amount = paket ? paket.price : 0;
    if (nominalEl) nominalEl.textContent = formatIDR(amount);
    const waMsg = encodeURIComponent(
      `Halo Tim Muyang! Saya ${reg.owner_name} dari ${reg.business_name} (ID: ${reg.id}) ingin mengkonfirmasi pembayaran paket ${paket ? paket.name : reg.category} senilai ${formatIDR(amount)}. Berikut saya lampirkan bukti transfer.`
    );
    if (waEl) waEl.href = `https://wa.me/6282336669588?text=${waMsg}`;
    showDashboard('viewDashboardUmkmPayment');

  } else if (status === 'verifying') {
    const el = document.getElementById('verifyingUmkmName');
    if (el) el.textContent = session.warungName;
    showDashboard('viewDashboardUmkmVerifying');

  } else if (status === 'rejected') {
    const el = document.getElementById('rejectedUmkmName');
    if (el) el.textContent = session.warungName;
    showDashboard('viewDashboardUmkmRejected');

  } else if (status === 'active') {
    const welcomeEl = document.getElementById('dashUmkmWelcome');
    const paket = reg ? reg.paket_kemitraan : null;
    if (welcomeEl) welcomeEl.textContent = `${session.warungName} — ${paket ? paket.name : 'Mitra Aktif'}`;
    setUmkmExpiredState(false);
    renderPartnershipInfo();

    if (warung) {
      // Tampilkan foto warung yang sudah ada di preview
      const warungPreview = document.getElementById('warungPhotoPreview');
      if (warungPreview && warung.image_url) {
        warungPreview.src = warung.image_url;
        warungPreview.style.display = 'block';
      }
      await renderUmkmMenuList(warung);
      await renderUmkmIncomingReviews(warung.id);
      setupUmkmLocationEditor(warung);
    }
    showDashboard('viewDashboardUmkmActive');
  } else if (status === 'expired') {
    // Masa kemitraan berakhir — tampilkan view aktif tapi dengan banner expired
    const welcomeEl = document.getElementById('dashUmkmWelcome');
    if (welcomeEl) welcomeEl.textContent = `${session.warungName} — Masa Kemitraan Berakhir`;

    // Sembunyikan badge "Mitra Aktif", tampilkan banner berakhir, nonaktifkan form
    setUmkmExpiredState(true);
    renderPartnershipInfo();

    if (warung) {
      await renderUmkmMenuList(warung);
      await renderUmkmIncomingReviews(warung.id);
    }
    showDashboard('viewDashboardUmkmActive');
  }
}

async function renderUmkmMenuList(warung) {
  const listEl = document.getElementById('umkmMenuList');
  if (!listEl) return;

  // Tampilkan foto warung yang sudah ada di preview
  const warungPreview = document.getElementById('warungPhotoPreview');
  if (warungPreview && warung.image_url) {
    warungPreview.src = warung.image_url;
    warungPreview.style.display = 'block';
  }

  const menus = warung.warung_menus || [];
  if (menus.length === 0) {
    listEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada menu warung. Tambahkan menu pertama Anda pada formulir di atas.</p>';
    return;
  }
  listEl.innerHTML = menus.map(m => `
    <div class="dash-menu-item">
      <div style="display:flex;align-items:center;gap:10px;">
        ${m.image_url
      ? `<img src="${safeUrl(m.image_url)}" alt="${esc(m.name)}" style="width:48px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--neutral-200);" onerror="this.style.display='none'">`
      : `<div style="width:48px;height:40px;background:var(--neutral-100);border-radius:6px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--neutral-300);"><i class="fa-solid fa-utensils" style="color:var(--neutral-300);font-size:0.9rem;"></i></div>`
    }
        <div>
          <span class="dash-menu-name">${esc(m.name)}</span>
          ${m.is_best_seller ? '<span style="background:var(--gold-100);color:var(--gold-600);font-size:0.68rem;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:800;">Favorit</span>' : ''}
          <span class="dash-menu-portion">${esc(m.portion || '')}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="dash-menu-price">${formatIDR(m.price)}</span>
        <label style="font-size:0.75rem;cursor:pointer;display:flex;align-items:center;gap:4px;">
          <input type="checkbox" ${m.is_available ? 'checked' : ''} onchange="window.toggleMenuAvailability(${Number(m.id)}, this.checked)"> Tersedia
        </label>
        <button class="btn-icon-danger" onclick="window.deleteUmkmMenu(${Number(m.id)})" title="Hapus Menu">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.toggleMenuAvailability = async function (menuId, isAvailable) {
  await withLoading(() => DB.updateMenuAvailability(menuId, isAvailable), 'Memperbarui ketersediaan menu...');
  await refreshWarungsCache();
  renderCulinaryGrid();
};

async function renderUmkmIncomingReviews(warungId) {
  const reviewsEl = document.getElementById('umkmReviewsList');
  if (!reviewsEl) return;
  const reviews = await DB.getReviewsForWarung(warungId);

  if (reviews.length === 0) {
    reviewsEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada ulasan baru dari mahasiswa untuk warung Anda.</p>';
    return;
  }

  reviewsEl.innerHTML = reviews.map(r => `
    <div class="dash-review-card">
      <div class="dash-review-top">
        <span style="font-weight:800;color:var(--primary-900);">${esc(r.reviewer_name || r.users?.name || 'Mahasiswa')}</span>
        <span class="dash-review-date">${timeAgo(r.created_at)}</span>
      </div>
      <div class="dash-review-badges">
        <span style="color:var(--gold-500);font-size:0.85rem;">${'<i class="fa-solid fa-star"></i>'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))}</span>
        <span style="background:var(--success-100);color:var(--success-700);font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:var(--radius-full);">Kenyang: ${r.kenyang}/5</span>
      </div>
      <p class="dash-review-comment">"${esc(r.comment)}"</p>
    </div>
  `).join('');
}

window.deleteUmkmMenu = async function (menuId) {
  const session = LS.getSession();
  if (!session || session.role !== 'umkm') return;
  await withLoading(() => DB.deleteMenu(menuId), 'Menghapus menu...');
  // Refresh warung data
  const warung = await DB.getWarungByOwnerId(session.id);
  if (warung) await renderUmkmMenuList(warung);
  await refreshWarungsCache();
  renderCulinaryGrid();
  showToast('Menu berhasil dihapus.');
};

// ============================================================
// DASHBOARD: ADMIN (100% dari Supabase)
// ============================================================
async function renderAdminDashboard() {
  const tableEl = document.getElementById('adminUmkmTable');
  const statsEl = document.getElementById('adminStatsContainer');
  const reviewsTableEl = document.getElementById('adminReviewsTable');

  if (tableEl) tableEl.innerHTML = '<p style="color:var(--neutral-400);padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data dari database...</p>';
  if (statsEl) statsEl.innerHTML = '';

  let registrations;
  try {
    registrations = await DB.getAllRegistrations();
  } catch (error) {
    console.warn('[Admin] Load registrations error:', error);
    if (tableEl) tableEl.innerHTML = '<p style="color:#b91c1c;padding:16px;">Gagal memuat data admin. Sesi mungkin kedaluwarsa; keluar lalu masuk kembali.</p>';
    if (reviewsTableEl) reviewsTableEl.innerHTML = '';
    return;
  }

  renderAdminPartnershipOverview(tableEl);

  const statusLabel = {
    pending: '<span class="status-badge status-pending">Pending Review</span>',
    awaiting_payment: '<span class="status-badge status-payment">Menunggu Bayar</span>',
    verifying: '<span class="status-badge status-verifying">Verifikasi Bayar</span>',
    active: '<span class="status-badge status-active">Mitra Aktif</span>',
    rejected: '<span class="status-badge status-rejected">Ditolak</span>',
    expired: '<span class="status-badge" style="background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;font-weight:800;font-size:0.72rem;padding:3px 10px;border-radius:999px;">Kemitraan Berakhir</span>'
  };

  // Stats Grid
  if (statsEl) {
    const total = registrations.length;
    const pending = registrations.filter(u => u.status === 'pending').length;
    const payment = registrations.filter(u => u.status === 'awaiting_payment' || u.status === 'verifying').length;
    const active = registrations.filter(u => u.status === 'active').length;
    const expired = registrations.filter(u => u.status === 'expired').length;

    statsEl.innerHTML = `
      <div class="admin-stat-card">
        <div class="admin-stat-icon total"><i class="fa-solid fa-store"></i></div>
        <div><div class="admin-stat-val">${total}</div><div class="admin-stat-label">Total Pendaftar</div></div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon pending"><i class="fa-solid fa-clock"></i></div>
        <div><div class="admin-stat-val">${pending}</div><div class="admin-stat-label">Menunggu Review</div></div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon payment"><i class="fa-solid fa-wallet"></i></div>
        <div><div class="admin-stat-val">${payment}</div><div class="admin-stat-label">Menunggu Bayar</div></div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon active"><i class="fa-solid fa-circle-check"></i></div>
        <div><div class="admin-stat-val">${active}</div><div class="admin-stat-label">Mitra Aktif</div></div>
      </div>
      ${expired > 0 ? `
      <div class="admin-stat-card" style="border-left:3px solid #9ca3af;">
        <div class="admin-stat-icon" style="background:#f3f4f6;color:#6b7280;"><i class="fa-solid fa-ban"></i></div>
        <div><div class="admin-stat-val" style="color:#6b7280;">${expired}</div><div class="admin-stat-label">Kemitraan Berakhir</div></div>
      </div>` : ''}
    `;
  }

  // UMKM Table
  if (tableEl) {
    if (registrations.length === 0) {
      tableEl.innerHTML = '<p style="color:var(--neutral-500);padding:16px;">Belum ada pendaftar UMKM di database.</p>';
    } else {
      tableEl.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Warung &amp; Info</th>
              <th>Pemilik &amp; WhatsApp</th>
              <th>Paket Kemitraan</th>
              <th>Status</th>
              <th>Aksi Verifikasi</th>
            </tr>
          </thead>
          <tbody>
            ${registrations.map(u => `
              <tr>
                <td>
                  <div style="font-weight:800;color:var(--neutral-900);">${esc(u.business_name)}</div>
                  <div style="font-size:0.75rem;color:var(--neutral-500);margin-top:2px;"><span style="font-weight:600;">REG#${u.id}</span></div>
                  <div style="font-size:0.75rem;color:var(--neutral-400);margin-top:2px;"><i class="fa-solid fa-location-dot"></i> ${esc(u.address)}</div>
                  ${u.lat != null && u.lng != null
          ? `<div style="font-size:0.75rem;margin-top:2px;"><a href="https://www.google.com/maps?q=${u.lat},${u.lng}" target="_blank" rel="noopener" style="color:var(--primary-700);font-weight:700;text-decoration:none;"><i class="fa-solid fa-map-pin"></i> Lihat titik di Google Maps</a> <span style="color:var(--neutral-400);">(${Number(u.lat).toFixed(5)}, ${Number(u.lng).toFixed(5)})</span></div>`
          : `<div style="font-size:0.75rem;color:#d97706;margin-top:2px;"><i class="fa-solid fa-triangle-exclamation"></i> Belum ada titik (memakai titik di jalan)</div>`}
                  <button class="btn btn-outline btn-xs" style="margin-top:4px;" onclick="window.adminEditCoords(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.user_id))})"><i class="fa-solid fa-pen"></i> ${u.lat != null && u.lng != null ? 'Koreksi titik' : 'Isi titik'}</button>
                  <div style="font-size:0.72rem;color:var(--neutral-400);"><i class="fa-regular fa-clock"></i> ${new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </td>
                <td>
                  <div style="font-weight:700;">${esc(u.owner_name)}</div>
                  <a href="https://wa.me/62${esc(String(u.phone).replace(/[^0-9]/g, '').replace(/^0/, ''))}" target="_blank" style="font-size:0.8rem;color:var(--success-600);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:2px;">
                    <i class="fa-brands fa-whatsapp"></i> ${esc(u.phone)}
                  </a>
                </td>
                <td>
                  <div style="font-weight:700;color:var(--primary-900);">${esc(u.paket_kemitraan ? u.paket_kemitraan.name : (u.category || '-'))}</div>
                  <div style="font-weight:800;color:var(--accent-600);font-size:0.9rem;">${u.paket_kemitraan ? formatIDR(u.paket_kemitraan.price) : ''}</div>
                </td>
                <td>${statusLabel[u.status] || esc(u.status)}</td>
                <td class="admin-actions-cell">
                  ${u.status === 'pending' ? `
                    <button class="btn btn-primary btn-xs" onclick="window.adminApproveUmkm(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.business_name))}, ${esc(JSON.stringify(u.user_id))})">
                      <i class="fa-solid fa-check"></i> Setujui
                    </button>
                    <button class="btn btn-outline btn-xs" onclick="window.adminRejectUmkm(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.business_name))}, ${esc(JSON.stringify(u.user_id))})" style="color:#dc2626;border-color:#dc2626;">
                      <i class="fa-solid fa-times"></i> Tolak
                    </button>
                  ` : ''}
                  ${u.status === 'awaiting_payment' || u.status === 'verifying' ? `
                    <button class="btn btn-accent btn-xs" onclick="window.adminActivateUmkm(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.business_name))}, ${esc(JSON.stringify(u.user_id))})">
                      <i class="fa-solid fa-bolt"></i> Konfirmasi &amp; Aktifkan
                    </button>
                  ` : ''}
                  ${u.status === 'active' ? `
                    <span style="color:var(--success-600);font-size:0.82rem;font-weight:800;"><i class="fa-solid fa-circle-check"></i> Tayang Publik</span>
                    <button class="btn btn-outline btn-xs" onclick="window.adminDeactivateUmkm(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.business_name))}, ${esc(JSON.stringify(u.user_id))})" style="color:#dc2626;border-color:#dc2626;margin-top:4px;">
                      <i class="fa-solid fa-ban"></i> Nonaktifkan
                    </button>
                  ` : ''}
                  ${u.status === 'rejected' ? `<span style="color:var(--neutral-400);font-size:0.82rem;">Ditolak</span>` : ''}
                  ${u.status === 'expired' ? `
                    <span style="color:#9ca3af;font-size:0.82rem;font-weight:700;"><i class="fa-solid fa-clock"></i> Nonaktif</span>
                    <button class="btn btn-primary btn-xs" onclick="window.adminReactivateUmkm(${esc(JSON.stringify(u.id))}, ${esc(JSON.stringify(u.business_name))}, ${esc(JSON.stringify(u.user_id))})" style="margin-top:4px;">
                      <i class="fa-solid fa-rotate-right"></i> Aktifkan Kembali
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // Reviews Moderation Table
  if (reviewsTableEl) {
    const { data: allReviews, error: reviewsError } = await DB.getAdminReviews(LS.getSession()?.token);
    if (reviewsError) {
      console.warn('[Admin] Load reviews error:', reviewsError);
      reviewsTableEl.innerHTML = '<p style="color:#b91c1c;padding:12px;">Gagal memuat ulasan admin.</p>';
      return;
    }

    const reviews = allReviews || [];
    if (reviews.length === 0) {
      reviewsTableEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;padding:12px;">Belum ada ulasan dari mahasiswa.</p>';
    } else {
      reviewsTableEl.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Warung</th>
              <th>Penulis &amp; Rating</th>
              <th>Komentar Ulasan</th>
              <th>Aksi Moderasi</th>
            </tr>
          </thead>
          <tbody>
            ${reviews.map(r => `
              <tr>
                <td style="font-weight:700;color:var(--primary-900);white-space:nowrap;">${esc(r.warungs?.name || 'Warung')}</td>
                <td>
                  <div style="font-weight:700;">${esc(r.reviewer_name || r.users?.name || 'Mahasiswa')}</div>
                  <div style="color:var(--gold-500);font-size:0.75rem;">${'<i class="fa-solid fa-star"></i>'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))} (Kenyang ${r.kenyang}/5)</div>
                  <div style="font-size:0.7rem;color:var(--neutral-400);">${timeAgo(r.created_at)}</div>
                </td>
                <td style="font-size:0.85rem;color:var(--neutral-700);max-width:300px;">"${esc(r.comment)}"</td>
                <td>
                  <button class="btn btn-outline btn-xs" style="color:#dc2626;border-color:#dc2626;" onclick="window.adminDeleteReview(${Number(r.id)})">
                    <i class="fa-solid fa-trash-can"></i> Hapus
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }
}

window.adminApproveUmkm = async function (regId, warungName, userId) {
  if (!supabaseClient) return;
  try {
    await DB.runAdminAction('approve', regId);

    await renderAdminDashboard();
    showToast(`UMKM "${warungName}" disetujui. Menunggu bukti transfer.`);
  } catch (err) {
    console.warn('[Admin] Approve error:', err);
    showToast('Gagal menyetujui: ' + (err?.message || 'Coba lagi.'), 'error');
  }
};

window.adminRejectUmkm = async function (regId, warungName) {
  if (!supabaseClient) return;
  try {
    await DB.runAdminAction('reject', regId);
    await renderAdminDashboard();
    showToast(`Pendaftaran "${warungName}" ditolak.`);
  } catch (err) {
    showToast('Gagal menolak: ' + (err?.message || 'Coba lagi.'), 'error');
  }
};

window.adminActivateUmkm = async function (regId, warungName, userId) {
  if (!supabaseClient) return;
  try {
    const { data: reg, error: regError } = await DB.getAdminRegistration(LS.getSession()?.token, regId);
    if (regError) throw regError;

    // 4. Check if warung already exists for this owner
    const existingWarung = null;

    if (!reg) throw new Error('Data pendaftaran tidak ditemukan.');
    {
      // Detect category from business_name
      const cat = detectCategory(reg.business_name);
      const area = detectArea(reg.address);
      // Pakai titik asli dari pendaftar; pendaftar lama tanpa titik tetap memakai titik di jalan (cara lama)
      const hasRegCoords = reg.lat != null && reg.lng != null && validateCoords(Number(reg.lat), Number(reg.lng)) === null;
      const coords = hasRegCoords
        ? buildGeoFields(Number(reg.lat), Number(reg.lng))
        : assignCoordinates(area, Math.floor(Math.random() * 10));

      const defaultFeatures = ['Mitra Terverifikasi Muyang', 'Porsi Kenyang Terjamin', 'Bisa QRIS / Tunai', 'Harga Ramah Mahasiswa'];
      const warungPayload = {
        owner_id: userId,
        name: reg.business_name,
        category: cat.key,
        category_label: cat.label,
        location: reg.address,
        area: area,
        lat: coords.lat,
        lng: coords.lng,
        google_maps_url: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
        whatsapp: reg.phone,
        distance: `${coords.distance}m dari Kampus`,
        min_price: 0,
        max_price: 0,
        rating: 4.5,
        reviews_count: 0,
        kenyang_score: 9.0,
        is_featured: PAKET_BENEFITS[reg.paket_kemitraan?.name]?.featured ?? false,
        is_active: true,
        promo_badge: PAKET_BENEFITS[reg.paket_kemitraan?.name]?.badge || 'Mitra Baru Muyang',
        image_url: cat.image,
        hours: '08.00 - 21.00 WIB',
        features: defaultFeatures,
        description: `Warung mitra resmi Muyang di area ${area}. Menyajikan menu lezat dan porsi mengenyangkan khusus mahasiswa UNEJ.`,
        coordinates: coords.canvas
      };
      await DB.runAdminAction('activate', regId, warungPayload);
    }

    // 5. Refresh catalog
    await refreshWarungsCache();
    renderCulinaryGrid();
    renderRadarMapPins();

    await renderAdminDashboard();
    showToast(`Pembayaran diverifikasi! Warung "${warungName}" kini resmi AKTIF dan tampil di website publik!`);
  } catch (err) {
    console.warn('[Admin] Activate error:', err);
    showToast('Gagal mengaktifkan: ' + (err?.message || 'Coba lagi.'), 'error');
  }
};

let pendingConfirmAction = null;

function openConfirmAction({ title, message, buttonLabel, icon = 'fa-circle-question', onConfirm }) {
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmActionTitle').textContent = title;
  document.getElementById('confirmActionMessage').textContent = message;
  document.getElementById('confirmActionIcon').className = `fa-solid ${icon}`;
  document.getElementById('confirmActionBtn').innerHTML = buttonLabel;
  openModal('confirmActionModal');
}

window.cancelConfirmAction = function () {
  pendingConfirmAction = null;
  closeAllModals();
};

window.confirmAction = async function () {
  if (!pendingConfirmAction) return;
  const action = pendingConfirmAction;
  const button = document.getElementById('confirmActionBtn');
  if (button) button.disabled = true;
  try {
    pendingConfirmAction = null;
    closeAllModals();
    await action();
  } catch (err) {
    console.warn('[Confirm action] Error:', err);
    showToast(err?.message || 'Aksi gagal. Coba lagi.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
};

// ============================================================
// ADMIN: DEACTIVATE UMKM (Nonaktifkan / Masa Kemitraan Berakhir)
// ============================================================
window.adminDeactivateUmkm = function (regId, warungName) {
  if (!supabaseClient) return;
  openConfirmAction({
    title: 'Nonaktifkan kemitraan?',
    message: `Warung ${warungName} akan hilang dari katalog publik, namun data, menu, dan ulasan tetap tersimpan.`,
    buttonLabel: '<i class="fa-solid fa-ban"></i> Nonaktifkan',
    icon: 'fa-store-slash',
    onConfirm: async () => {
      await DB.runAdminAction('deactivate', regId);
      await refreshWarungsCache();
      renderCulinaryGrid();
      renderRadarMapPins();
      await renderAdminDashboard();
      showToast(`Kemitraan "${warungName}" telah dinonaktifkan.`);
    }
  });
};

window.adminReactivateUmkm = function (regId, warungName) {
  if (!supabaseClient) return;
  openConfirmAction({
    title: 'Aktifkan kembali mitra?',
    message: `Warung ${warungName} akan kembali tampil di katalog publik.`,
    buttonLabel: '<i class="fa-solid fa-rotate-right"></i> Aktifkan Kembali',
    icon: 'fa-store',
    onConfirm: async () => {
      await DB.runAdminAction('reactivate', regId);
      await refreshWarungsCache();
      renderCulinaryGrid();
      renderRadarMapPins();
      await renderAdminDashboard();
      showToast(`Kemitraan "${warungName}" berhasil diaktifkan kembali!`);
    }
  });
};

window.adminDeleteReview = async function (reviewId) {
  const { error } = await withLoading(
    () => DB.deleteReview(reviewId, LS.getSession()?.token),
    'Menghapus ulasan...'
  );
  if (error) { showToast('Gagal menghapus ulasan: ' + error.message, 'error'); return; }
  await refreshWarungsCache();
  renderCulinaryGrid();
  await renderAdminDashboard();
  showToast('Ulasan berhasil dihapus.');
};

// ============================================================
// LOKASI WARUNG: pin di peta (Leaflet, tanpa API key)
// ============================================================
const MAX_CAMPUS_DISTANCE_M = 15000; // titik di luar 15 km dari kampus ditolak

// Return string pesan error, atau null kalau titik valid
function validateCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Koordinat tidak valid.';
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'Koordinat tidak valid.';
  const d = haversineM(lat, lng, PUSAT_UNEJ_COORDS[0], PUSAT_UNEJ_COORDS[1]);
  if (d > MAX_CAMPUS_DISTANCE_M) {
    return `Titik lokasi terlalu jauh dari kampus UNEJ (${(d / 1000).toFixed(1)} km). Pastikan pin ada di area Jember.`;
  }
  return null;
}

// Hitung semua field lokasi dari lat/lng (dipakai aktivasi, dashboard UMKM, dan koreksi admin)
function buildGeoFields(lat, lng) {
  lat = +Number(lat).toFixed(6); lng = +Number(lng).toFixed(6);
  const fromHub = haversineM(lat, lng, PUSAT_UNEJ_COORDS[0], PUSAT_UNEJ_COORDS[1]);
  const distance = Math.max(100, Math.round((fromHub - CAMPUS_RADIUS_M) / 10) * 10);
  // Posisi di kanvas fallback (hanya dipakai kalau Leaflet gagal dimuat) - perkiraan kasar
  const clamp = v => Math.max(5, Math.min(95, Math.round(v)));
  const canvas = {
    x: clamp((lng - 113.711) / 0.015 * 100),
    y: clamp((-8.160 - lat) / 0.016 * 100)
  };
  return { lat, lng, distance, canvas };
}

// Mini-peta dengan pin yang bisa digeser. Mengembalikan null kalau Leaflet belum termuat.
function createLocationPicker(containerId, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el || typeof L === 'undefined') return null;

  const map = L.map(el, {
    center: opts.initial || UNEJ_CENTER,
    zoom: opts.initial ? 18 : 16,
    scrollWheelZoom: false
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);

  // Penanda kampus supaya pemilik tahu arah
  L.marker(PUSAT_UNEJ_COORDS, {
    interactive: false,
    icon: L.divIcon({ className: 'loc-picker-campus', html: '<span>UNEJ</span>', iconSize: [44, 20], iconAnchor: [22, 10] })
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: 'loc-picker-pin',
    html: '<i class="fa-solid fa-location-dot"></i>',
    iconSize: [32, 40],
    iconAnchor: [16, 38]
  });
  let marker = null;

  function notify() {
    if (opts.onChange) opts.onChange(marker ? marker.getLatLng() : null);
  }
  function place(lat, lng) {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      marker.on('dragend', notify);
    } else {
      marker.setLatLng([lat, lng]);
    }
    notify();
  }

  map.on('click', (e) => place(e.latlng.lat, e.latlng.lng));
  if (opts.initial) place(opts.initial[0], opts.initial[1]);

  return {
    map,
    getLatLng: () => (marker ? marker.getLatLng() : null),
    setLatLng(lat, lng, zoom) {
      place(lat, lng);
      map.setView([lat, lng], zoom || 18);
    },
    clear() {
      if (marker) { map.removeLayer(marker); marker = null; }
      map.setView(UNEJ_CENTER, 16);
      notify();
    },
    invalidate: () => map.invalidateSize()
  };
}

// Buat peta hanya saat kontainernya benar-benar terlihat (modal/dashboard awalnya tersembunyi)
function lazyInitWhenVisible(el, init, onVisibleAgain) {
  if (!el || typeof ResizeObserver === 'undefined') { init(); return; }
  let created = false;
  new ResizeObserver(() => {
    if (el.clientWidth === 0) return;
    if (!created) { created = true; init(); }
    else if (onVisibleAgain) onVisibleAgain();
  }).observe(el);
}

function useMyLocation(picker, textEl) {
  if (!navigator.geolocation) { showToast('Browser tidak mendukung GPS.', 'error'); return; }
  if (textEl) textEl.textContent = 'Mencari lokasi Anda...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const err = validateCoords(latitude, longitude);
      if (err) { showToast(err, 'error'); if (textEl) textEl.textContent = 'Lokasi GPS di luar area Jember.'; return; }
      picker.setLatLng(latitude, longitude);
      showToast('Lokasi ditemukan. Geser pin kalau kurang pas.');
    },
    () => {
      showToast('Tidak bisa mengambil lokasi. Izinkan akses lokasi atau ketuk peta secara manual.', 'error');
      if (textEl) textEl.textContent = 'Belum ada titik. Ketuk peta atau geser pin.';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function coordsText(ll) {
  return ll ? `Titik: ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}` : 'Belum ada titik. Ketuk peta atau geser pin.';
}

// ---- Form pendaftaran UMKM ----
let regLocPicker = null;
function initUmkmRegisterPicker() {
  const el = document.getElementById('regMapPicker');
  const textEl = document.getElementById('regCoordsText');
  lazyInitWhenVisible(el, () => {
    regLocPicker = createLocationPicker('regMapPicker', {
      onChange: (ll) => { if (textEl) textEl.textContent = coordsText(ll); }
    });
  }, () => regLocPicker && regLocPicker.invalidate());
  document.getElementById('regUseMyLocation')?.addEventListener('click', () => {
    if (regLocPicker) useMyLocation(regLocPicker, textEl);
  });
}

// ---- Dashboard UMKM: ubah lokasi setelah aktif ----
let umkmLocPicker = null;
let umkmLocWarung = null;
function setupUmkmLocationEditor(warung) {
  const section = document.getElementById('umkmLocationSection');
  const el = document.getElementById('umkmLocationMap');
  const textEl = document.getElementById('umkmCoordsText');
  if (!section || !el) return;
  section.style.display = '';
  umkmLocWarung = warung;
  const initial = (warung.lat != null && warung.lng != null) ? [Number(warung.lat), Number(warung.lng)] : null;

  if (umkmLocPicker) {
    if (initial) umkmLocPicker.setLatLng(initial[0], initial[1]);
    return;
  }
  lazyInitWhenVisible(el, () => {
    umkmLocPicker = createLocationPicker('umkmLocationMap', {
      initial: (umkmLocWarung && umkmLocWarung.lat != null) ? [Number(umkmLocWarung.lat), Number(umkmLocWarung.lng)] : null,
      onChange: (ll) => { if (textEl) textEl.textContent = coordsText(ll); }
    });
  }, () => umkmLocPicker && umkmLocPicker.invalidate());

  const gpsBtn = document.getElementById('umkmUseMyLocation');
  if (gpsBtn && !gpsBtn.dataset.bound) {
    gpsBtn.dataset.bound = '1';
    gpsBtn.addEventListener('click', () => { if (umkmLocPicker) useMyLocation(umkmLocPicker, textEl); });
  }
}

// Simpan lokasi baru ke warungs + umkm_registrations, lalu segarkan katalog & peta
async function saveWarungLocation(warungId, ownerId, lat, lng) {
  const geo = buildGeoFields(lat, lng);
  const { error } = await DB.saveUmkmLocation(LS.getSession()?.token, geo.lat, geo.lng, `${geo.distance}m dari Kampus`, geo.canvas);
  if (error) throw error;
  await refreshWarungsCache();
  renderCulinaryGrid();
  renderRadarMapPins();
}

window.saveUmkmLocation = async function () {
  const session = LS.getSession();
  if (!session || session.role !== 'umkm' || !supabaseClient) return;
  const ll = umkmLocPicker ? umkmLocPicker.getLatLng() : null;
  if (!ll) { showToast('Tentukan titik lokasi di peta dulu.', 'error'); return; }
  const err = validateCoords(ll.lat, ll.lng);
  if (err) { showToast(err, 'error'); return; }
  const warung = umkmLocWarung || await DB.getWarungByOwnerId(session.id);
  if (!warung) { showToast('Data warung tidak ditemukan.', 'error'); return; }
  const btn = document.getElementById('umkmSaveLocationBtn');
  if (btn) btn.disabled = true;
  setLoading(true, 'Menyimpan lokasi warung...');
  try {
    await saveWarungLocation(warung.id, session.id, ll.lat, ll.lng);
    umkmLocWarung = await DB.getWarungByOwnerId(session.id);
    showToast('Lokasi warung berhasil diperbarui!');
  } catch (e) {
    console.warn('[UMKM] Save location error:', e);
    showToast('Gagal menyimpan lokasi: ' + (e?.message || 'Coba lagi.'), 'error');
  } finally {
    setLoading(false);
    if (btn) btn.disabled = false;
  }
};

// ---- Admin: isi / koreksi titik lewat modal (peta + pin, atau tempel "lat, lng") ----
let adminLocPicker = null;
let adminLocTarget = null; // { regId, userId, initial: [lat, lng] | null }
let adminLocObserverSet = false;

function parseLatLngText(text) {
  const m = (text || '').match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}

function applyAdminLocInitial() {
  if (!adminLocPicker || !adminLocTarget) return;
  adminLocPicker.invalidate();
  if (adminLocTarget.initial) adminLocPicker.setLatLng(adminLocTarget.initial[0], adminLocTarget.initial[1]);
  else adminLocPicker.clear();
}

window.adminEditCoords = async function (regId, userId) {
  if (!supabaseClient) return;
  const { data: reg, error } = await withLoading(
    () => DB.getAdminRegistration(LS.getSession()?.token, regId),
    'Memuat data pendaftar...'
  );
  if (error) { showToast('Gagal memuat data pendaftaran.', 'error'); return; }
  if (!reg) { showToast('Data pendaftaran tidak ditemukan.', 'error'); return; }

  adminLocTarget = {
    regId, userId,
    initial: (reg.lat != null && reg.lng != null) ? [Number(reg.lat), Number(reg.lng)] : null
  };

  document.getElementById('adminLocName').textContent = reg.business_name || '';
  document.getElementById('adminLocAddress').textContent = reg.address || '';
  document.getElementById('adminLocSearchLink').href =
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(reg.address || reg.business_name || '');
  const input = document.getElementById('adminLocInput');
  input.value = adminLocTarget.initial ? `${adminLocTarget.initial[0].toFixed(6)}, ${adminLocTarget.initial[1].toFixed(6)}` : '';

  openModal('adminLocationModal');

  const el = document.getElementById('adminLocationMap');
  if (!adminLocObserverSet) {
    adminLocObserverSet = true;
    lazyInitWhenVisible(el, () => {
      adminLocPicker = createLocationPicker('adminLocationMap', {
        onChange: (ll) => { input.value = ll ? `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}` : ''; }
      });
      applyAdminLocInitial();
    }, () => adminLocPicker && adminLocPicker.invalidate());
    input.addEventListener('change', () => {
      const pt = parseLatLngText(input.value);
      if (!pt) { showToast('Format salah. Contoh: -8.170684, 113.721057', 'error'); return; }
      const err = validateCoords(pt.lat, pt.lng);
      if (err) { showToast(err, 'error'); return; }
      if (adminLocPicker) adminLocPicker.setLatLng(pt.lat, pt.lng);
    });
  } else {
    setTimeout(applyAdminLocInitial, 80); // tunggu modal terlihat dulu
  }
};

window.saveAdminLocation = async function () {
  if (!supabaseClient || !adminLocTarget) return;
  const ll = adminLocPicker ? adminLocPicker.getLatLng() : null;
  const pt = ll ? { lat: ll.lat, lng: ll.lng } : parseLatLngText(document.getElementById('adminLocInput').value);
  if (!pt) { showToast('Tentukan titik di peta atau tempel koordinat dulu.', 'error'); return; }
  const err = validateCoords(pt.lat, pt.lng);
  if (err) { showToast(err, 'error'); return; }
  const btn = document.getElementById('adminLocSaveBtn');
  if (btn) btn.disabled = true;
  setLoading(true, 'Menyimpan koreksi lokasi...');
  try {
    const { regId } = adminLocTarget;
    const lat = +pt.lat.toFixed(6), lng = +pt.lng.toFixed(6);
    const geo = buildGeoFields(lat, lng);
    const { error } = await DB.saveAdminLocation(LS.getSession()?.token, regId, lat, lng, `${geo.distance}m dari Kampus`, geo.canvas);
    if (error) throw error;
    closeAllModals();
    await renderAdminDashboard();
    showToast('Titik lokasi diperbarui.');
  } catch (e) {
    console.warn('[Admin] Save coords error:', e);
    showToast('Gagal menyimpan titik: ' + (e?.message || 'Coba lagi.'), 'error');
  } finally {
    setLoading(false);
    if (btn) btn.disabled = false;
  }
};

// ============================================================
// CATEGORY DETECTION (for new UMKM warung)
// ============================================================
function detectCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('geprek') || n.includes('ayam') || n.includes('bebek') || n.includes('lalapan')) {
    return { key: 'ayam', label: 'Ayam & Bebek', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80' };
  }
  if (n.includes('mie') || n.includes('bakso') || n.includes('indomie') || n.includes('warmindo')) {
    return { key: 'mie', label: 'Mie & Bakso / Warmindo', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80' };
  }
  if (n.includes('pecel') || n.includes('soto') || n.includes('nasi') || n.includes('depot') || n.includes('padang')) {
    return { key: 'nasi', label: 'Nasi Lauk & Masakan Daerah', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80' };
  }
  if (n.includes('warteg') || n.includes('prasmanan')) {
    return { key: 'warteg', label: 'Warteg & Prasmanan', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80' };
  }
  return { key: 'hiddengem', label: 'Hidden Gem Kuliner', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80' };
}

function detectArea(alamat) {
  const a = (alamat || '').toLowerCase();
  if (a.includes('jawa')) return 'Jl. Jawa';
  if (a.includes('kalimantan')) return 'Jl. Kalimantan';
  if (a.includes('mastrip')) return 'Jl. Mastrip';
  if (a.includes('danau toba') || a.includes('toba')) return 'Jl. Danau Toba';
  if (a.includes('riau')) return 'Jl. Riau';
  if (a.includes('karimata')) return 'Jl. Karimata';
  return 'Jl. Kalimantan';
}

// Garis tengah jalan (lat,lng) hasil kalibrasi screenshot peta OSM - warung baru ditempatkan DI ATAS jalan, di luar kampus.
// Jl. Karimata: titik acuan Unmuh Jember (arah jalan belum dicek). Jl. Danau Toba masih sementara; ganti setelah koordinat aslinya diambil.
const AREA_ROADS = {
  'Jl. Kalimantan': [[-8.160706, 113.714258], [-8.162409, 113.713793], [-8.163907, 113.713139], [-8.164793, 113.712761], [-8.165474, 113.712434], [-8.166155, 113.712124], [-8.166836, 113.7119]],
  'Jl. Jawa': [[-8.168454, 113.711762], [-8.168675, 113.712451], [-8.16893, 113.713139], [-8.16922, 113.714516], [-8.169577, 113.715893], [-8.169952, 113.717271], [-8.17031, 113.718648], [-8.170548, 113.720025], [-8.170633, 113.720713], [-8.170786, 113.721574]],
  'Jl. Mastrip': [[-8.160825, 113.72209], [-8.161063, 113.722779], [-8.161387, 113.723381], [-8.162068, 113.72388], [-8.162749, 113.724207], [-8.16343, 113.7245], [-8.164111, 113.724707], [-8.165474, 113.725103], [-8.166155, 113.725223], [-8.166836, 113.725395], [-8.167517, 113.725653]],
  'Jl. Riau': [[-8.167449, 113.725533], [-8.167704, 113.724844], [-8.168011, 113.724156], [-8.168283, 113.723467], [-8.168879, 113.722727], [-8.16956, 113.722383], [-8.170242, 113.722056], [-8.171604, 113.721522], [-8.172285, 113.721178], [-8.173647, 113.719904]],
  'Jl. Karimata': [[-8.174833, 113.717661], [-8.174833, 113.717961]], // titik acuan: Unmuh Jember (Jl. Karimata No. 49)
  'Jl. Danau Toba': [[-8.1730, 113.7210], [-8.1738, 113.7220]]
};
const CAMPUS_RADIUS_M = 300; // perkiraan jari-jari kampus dari titik pusat
const ROAD_SLOTS = [0.5, 0.15, 0.85, 0.32, 0.68]; // posisi sepanjang jalan agar pin tidak berdempetan

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pointAlongRoad(line, t) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = haversineM(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    seg.push(d); total += d;
  }
  let target = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(target / seg[i], 1) : 0;
      return [line[i][0] + (line[i + 1][0] - line[i][0]) * f, line[i][1] + (line[i + 1][1] - line[i][1]) * f];
    }
    target -= seg[i];
  }
  return line[0];
}

function assignCoordinates(area, idx) {
  const co = (idx % 3) * 6;
  const line = AREA_ROADS[area] || AREA_ROADS['Jl. Kalimantan'];
  const [rawLat, rawLng] = pointAlongRoad(line, ROAD_SLOTS[idx % ROAD_SLOTS.length]);
  const lat = +rawLat.toFixed(6), lng = +rawLng.toFixed(6);
  const fromHub = haversineM(lat, lng, PUSAT_UNEJ_COORDS[0], PUSAT_UNEJ_COORDS[1]);
  const distance = Math.max(100, Math.round((fromHub - CAMPUS_RADIUS_M) / 10) * 10);
  const canvasBase = {
    'Jl. Jawa': [38, 46], 'Jl. Mastrip': [64, 62], 'Jl. Danau Toba': [74, 68],
    'Jl. Riau': [28, 24], 'Jl. Karimata': [54, 78]
  }[area] || [48, 32];
  return { lat, lng, distance, canvas: { x: canvasBase[0] + co, y: canvasBase[1] + co } };
}

// ============================================================
// CATALOGUE FILTERING & RENDERING
// ============================================================
const state = {
  searchQuery: '',
  selectedCategory: 'all',
  selectedArea: 'all',
  maxBudget: 25000,
  sortBy: 'cheapest',
  selectedSpotId: 1,
  plannerBudget: 25000,
  bookmarkedIds: new Set()
};

// Keep bookmark set in-memory for fast rendering
async function refreshBookmarkSet() {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') {
    state.bookmarkedIds = new Set();
    return;
  }
  const rows = await DB.getUserBookmarks(session.id);
  state.bookmarkedIds = new Set(rows.map(r => String(r.warung_id)));
}

function filterCulinaryData() {
  const allData = getAllCulinaryData();
  return allData.filter(item => {
    const query = state.searchQuery.toLowerCase().trim();
    const matchSearch = !query ||
      item.name.toLowerCase().includes(query) ||
      item.categoryLabel.toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query) ||
      item.popularMenus.some(m => m.name.toLowerCase().includes(query));
    const matchCategory = state.selectedCategory === 'all' || item.category === state.selectedCategory;
    const matchArea = state.selectedArea === 'all' || item.area === state.selectedArea;
    const matchBudget = item.minPrice <= state.maxBudget;
    return matchSearch && matchCategory && matchArea && matchBudget;
  }).sort((a, b) => {
    if (state.sortBy === 'cheapest') return a.minPrice - b.minPrice;
    if (state.sortBy === 'priciest') return b.minPrice - a.minPrice;
    if (state.sortBy === 'rating') return b.rating - a.rating;
    if (state.sortBy === 'kenyang') return b.kenyangScore - a.kenyangScore;
    return 0;
  });
}

function renderCulinaryGrid() {
  const culinaryGrid = document.getElementById('culinaryGrid');
  const filteredCount = document.getElementById('filteredCount');
  const heroCount = document.getElementById('heroResultCount');
  const data = filterCulinaryData();
  if (filteredCount) filteredCount.textContent = data.length;
  if (heroCount) heroCount.textContent = data.length + ' Tempat';
  if (!culinaryGrid) return;

  if (data.length === 0) {
    culinaryGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-utensils"></i>
        <h3>Tidak Ada Tempat Makan yang Sesuai Budget</h3>
        <p>Coba naikkan slider budget uang saku kamu atau pilih kategori kuliner lain di sekitar UNEJ.</p>
        <button class="btn btn-primary btn-sm" id="emptyResetBtn">
          <i class="fa-solid fa-rotate-left"></i> Reset Filter Budget
        </button>
      </div>
    `;
    document.getElementById('emptyResetBtn')?.addEventListener('click', resetAllFilters);
    return;
  }

  culinaryGrid.innerHTML = data.map(item => {
    const isBookmarked = state.bookmarkedIds.has(String(item.id));
    const featuredBadge = item.isFeatured
      ? '<span class="badge-featured"><i class="fa-solid fa-fire"></i> Featured UMKM</span>'
      : '<span class="badge-featured" style="background:#0284c7;"><i class="fa-solid fa-store"></i> Mitra Aktif</span>';
    return `
      <article class="culinary-card" data-id="${esc(item.id)}">
        <div class="card-img-wrapper">
          <img src="${safeUrl(item.image)}" alt="${esc(item.name)}" class="card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'" />
          <div class="card-top-badges">
            ${featuredBadge}
            <span class="badge-distance"><i class="fa-solid fa-person-walking"></i> ${esc(item.distance)}</span>
          </div>
          <div class="card-bottom-badges">
            <span class="badge-kenyang-score" title="Kenyang Meter Score">
              <i class="fa-solid fa-bowl-food"></i> Kenyang ${item.kenyangScore}/10
            </span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-category-row">
            <span class="card-category-label">${esc(item.categoryLabel)}</span>
            <div class="card-rating">
              <i class="fa-solid fa-star"></i>
              <span>${item.rating}</span>
              <span style="color: var(--neutral-400); font-weight: 500;">(${item.reviewsCount})</span>
            </div>
          </div>

          <h3 class="card-title">${esc(item.name)}</h3>
          
          <p class="card-location">
            <i class="fa-solid fa-location-dot"></i>
            <span>${esc(item.location)}</span>
          </p>

          <div class="card-price-box">
            <div>
              <div class="price-label">Mulai Dari</div>
              <div class="price-val">${formatIDR(item.minPrice)}</div>
            </div>
            <div style="text-align: right;">
              <div class="price-label">Menu Terpopuler</div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-600);">${esc((item.popularMenus[0]?.name || 'Menu Variatif').substring(0, 24))}...</div>
            </div>
          </div>

          <div class="card-features-list">
            ${(Array.isArray(item.features) ? item.features : []).slice(0, 3).map(feat => `
              <span class="feature-tag"><i class="fa-solid fa-check"></i> ${esc(feat)}</span>
            `).join('')}
          </div>

          <div class="card-footer">
            <button class="btn-card-detail view-detail-btn" data-id="${esc(item.id)}">
              <i class="fa-solid fa-book-open"></i> Lihat Menu &amp; Ulasan
            </button>
            <button class="btn btn-outline btn-sm bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${esc(item.id)}" title="${isBookmarked ? 'Hapus Simpanan' : 'Simpan Tempat Ini'}">
              <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  culinaryGrid.scrollTo({ left: 0, behavior: 'smooth' });

  document.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => window.openDetailModal(btn.getAttribute('data-id')));
  });

  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(btn.getAttribute('data-id'));
    });
  });
}

async function toggleBookmark(id) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') {
    showToast('Silakan masuk sebagai Mahasiswa untuk menyimpan tempat makan favorit!', 'error');
    openModal('loginModal');
    return;
  }

  const warungId = parseInt(id);
  const alreadyBookmarked = state.bookmarkedIds.has(String(id));

  if (alreadyBookmarked) {
    await DB.removeBookmark(session.id, warungId);
    state.bookmarkedIds.delete(String(id));
    showToast('Warung dihapus dari simpanan.');
  } else {
    await DB.addBookmark(session.id, warungId);
    state.bookmarkedIds.add(String(id));
    showToast('Berhasil disimpan ke favorit anak kos!');
  }

  renderCulinaryGrid();
}

function resetAllFilters() {
  state.searchQuery = '';
  state.selectedCategory = 'all';
  state.selectedArea = 'all';
  state.maxBudget = 25000;
  state.sortBy = 'cheapest';

  const catalogueSearch = document.getElementById('catalogueSearch');
  const areaSelect = document.getElementById('areaSelect');
  const sortSelect = document.getElementById('sortSelect');
  const heroSlider = document.getElementById('heroBudgetSlider');
  const heroDisplay = document.getElementById('heroBudgetDisplay');

  if (catalogueSearch) catalogueSearch.value = '';
  if (areaSelect) areaSelect.value = 'all';
  if (sortSelect) sortSelect.value = 'cheapest';
  if (heroSlider) heroSlider.value = 25000;
  if (heroDisplay) heroDisplay.textContent = formatIDR(25000);

  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-category') === 'all');
  });
  document.querySelectorAll('.hero-budget-pill').forEach(p => p.classList.remove('active'));

  renderCulinaryGrid();
  updateRadarMap();
  showToast('Semua filter berhasil direset.');
}

// ============================================================
// DETAIL MODAL & REVIEWS (100% dari Supabase)
// ============================================================
window.openDetailModal = async function (id) {
  const detailModal = document.getElementById('detailModal');
  const detailModalContent = document.getElementById('detailModalContent');
  if (!detailModal || !detailModalContent) return;

  // Show loading state
  detailModalContent.innerHTML = '<div style="padding:60px;text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-500);"></i><p style="margin-top:12px;color:var(--neutral-500);">Memuat detail warung...</p></div>';
  detailModal.classList.add('active');

  // Fetch warung from cache (already includes menus)
  let item = warungsCache.find(w => String(w.id) === String(id));
  if (!item) {
    // Fallback: fetch directly
    item = await DB.getWarungById(id);
  }
  if (!item) { detailModalContent.innerHTML = '<p style="padding:20px;">Data warung tidak ditemukan.</p>'; return; }

  const normalized = normalizeWarung(item);

  // Fetch reviews from DB
  const reviews = await DB.getReviewsForWarung(id);

  const session = LS.getSession();
  const isMahasiswa = session && session.role === 'mahasiswa';
  const mapsUrl = normalized.googleMapsUrl;
  const rawPhone = normalized.whatsapp;
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const waMsg = encodeURIComponent(`Halo ${normalized.name}, saya mahasiswa UNEJ dari platform MUYANG. Mau tanya apakah warung buka dan menu hari ini masih tersedia? Terima kasih!`);
  const waUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

  const hasReviewed = isMahasiswa ? (await DB.hasUserReviewedWarung(session.id, id)) : false;

  detailModalContent.innerHTML = `
    <div style="position: relative; height: 220px; overflow: hidden; border-radius: var(--radius-xl) var(--radius-xl) 0 0;">
      <img src="${safeUrl(normalized.image)}" alt="${esc(normalized.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'" />
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); color: #fff;">
        <span style="background: var(--accent-500); color: #fff; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: var(--radius-full); text-transform: uppercase;">
          ${esc(normalized.categoryLabel)}
        </span>
        <h2 style="font-size: 1.6rem; font-weight: 800; margin-top: 4px; line-height: 1.2;">${esc(normalized.name)}</h2>
        <div style="font-size: 0.85rem; color: #fdba74; display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <i class="fa-solid fa-location-dot"></i> ${esc(normalized.location)} (${esc(normalized.distance)})
        </div>
      </div>
    </div>

    <div class="modal-content-pad">
      <!-- Quick Info Ribbon -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: var(--bg-surface-soft); padding: 12px; border-radius: var(--radius-lg); margin-bottom: 20px; text-align: center;">
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Harga Mulai</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: var(--primary-900);">${formatIDR(normalized.minPrice)}</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Kenyang Score</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: var(--success-600);"><i class="fa-solid fa-bowl-food"></i> ${normalized.kenyangScore}/10</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Jam Buka</div>
          <div style="font-size: 0.85rem; font-weight: 800; color: var(--neutral-800); margin-top: 2px;">${esc(normalized.hours)}</div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-action-grid">
        <a href="${safeUrl(mapsUrl)}" target="_blank" rel="noopener" class="btn btn-outline" style="display:flex;align-items:center;justify-content:center;gap:8px;color:#1a73e8;border-color:#1a73e8;font-weight:700;text-decoration:none;">
          <i class="fa-solid fa-map-location-dot" style="color:#1a73e8;"></i> Rute Google Maps
        </a>
        <a href="${safeUrl(waUrl)}" target="_blank" rel="noopener" class="btn btn-wa-chat" title="Chat via WhatsApp">
          <i class="fa-brands fa-whatsapp" style="font-size:1.15rem;"></i> Chat Warung (WA)
        </a>
      </div>

      <!-- Description -->
      <p style="font-size: 0.925rem; color: var(--neutral-700); line-height: 1.6; margin-bottom: 20px;">
        ${esc(normalized.description)}
      </p>

      <!-- Facilities -->
      <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900); margin-bottom: 10px;">
        <i class="fa-solid fa-circle-check" style="color: var(--accent-500);"></i> Fasilitas Ramah Mahasiswa
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
        ${(Array.isArray(normalized.features) ? normalized.features : []).map(f => `
          <span style="background: var(--neutral-100); border: 1px solid var(--neutral-300); padding: 5px 12px; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; color: var(--neutral-800);">
            <i class="fa-solid fa-check" style="color: var(--success-600);"></i> ${esc(f)}
          </span>
        `).join('')}
      </div>

      <!-- Menu List -->
      <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span><i class="fa-solid fa-utensils" style="color: var(--accent-500);"></i> Daftar Menu &amp; Harga Aktual</span>
        <span style="font-size: 0.75rem; color: var(--neutral-500); font-weight: 600;">Terverifikasi Tim Muyang</span>
      </h4>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px;">
        ${normalized.popularMenus.length === 0
      ? '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada menu yang ditambahkan.</p>'
      : normalized.popularMenus.map(menu => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fff; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md);">
            <div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--neutral-900);">
                ${esc(menu.name)}
                ${menu.isBestSeller ? '<span style="background: var(--gold-100); color: var(--gold-600); font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;">Favorit Kos</span>' : ''}
              </div>
              <div style="font-size: 0.75rem; color: var(--neutral-500);">${esc(menu.portion)}</div>
            </div>
            <div style="font-size: 1.1rem; font-weight: 900; color: var(--primary-800);">${formatIDR(menu.price)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Student Reviews -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900);">
          <i class="fa-solid fa-comments" style="color: var(--accent-500);"></i> Ulasan Mahasiswa (${reviews.length})
        </h4>
        ${isMahasiswa
      ? (hasReviewed
        ? `<span style="font-size:0.8rem;color:var(--success-600);font-weight:700;"><i class="fa-solid fa-check-circle"></i> Sudah Diulas</span>`
        : `<button class="btn btn-primary btn-sm open-review-form-btn" data-id="${esc(item.id)}"><i class="fa-solid fa-pen"></i> Tulis Ulasan</button>`)
      : `<button class="btn btn-outline btn-sm" onclick="window.openLoginModal('mahasiswa')"><i class="fa-solid fa-lock"></i> Login untuk Ulasan</button>`
    }
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px;">
        ${reviews.length === 0 ? '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada ulasan. Jadilah mahasiswa pertama yang mengulas!</p>' : ''}
        ${reviews.map(rev => `
          <div style="background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.9rem; font-weight: 800; color: var(--neutral-900);">${esc(rev.reviewer_name || rev.users?.name || 'Mahasiswa')}</span>
              <span style="font-size: 0.75rem; color: var(--neutral-400);">${timeAgo(rev.created_at)}</span>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <span style="color: var(--gold-500); font-size: 0.8rem;">
                ${'<i class="fa-solid fa-star"></i>'.repeat(Math.max(0, Math.min(5, Number(rev.rating) || 0)))}
              </span>
              <span style="background: var(--success-100); color: var(--success-600); font-size: 0.7rem; font-weight: 700; padding: 1px 8px; border-radius: var(--radius-full);">
                Kenyang: ${rev.kenyang}/5
              </span>
            </div>
            <p style="font-size: 0.85rem; color: var(--neutral-700); line-height: 1.5;">"${esc(rev.comment)}"</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const reviewBtn = detailModalContent.querySelector('.open-review-form-btn');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      detailModal.classList.remove('active');
      openReviewModal(item.id, normalized.name);
    });
  }
};

// ============================================================
// REVIEW MODAL & ANTI-SPAM (via DB UNIQUE constraint)
// ============================================================
function openReviewModal(spotId, spotName) {
  const reviewModal = document.getElementById('reviewModal');
  if (!reviewModal) return;
  const spotNameEl = document.getElementById('reviewModalSpotName');
  const spotIdInput = document.getElementById('reviewSpotIdInput');
  if (spotNameEl) spotNameEl.textContent = spotName;
  if (spotIdInput) spotIdInput.value = spotId;
  reviewModal.classList.add('active');
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') {
    showToast('Harus login sebagai mahasiswa untuk menulis ulasan.', 'error');
    return;
  }

  const spotId = parseInt(document.getElementById('reviewSpotIdInput').value);
  const faculty = document.getElementById('reviewerFaculty').value.trim();
  const kenyang = parseInt(document.getElementById('reviewKenyangScore').value);
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();

  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }
  setLoading(true, 'Mengirim ulasan...');

  try {
    const { error } = await DB.insertReview({
      warung_id: spotId,
      user_id: session.id,
      rating,
      kenyang,
      comment,
      faculty: faculty || session.fakultas
    });

    if (error) {
      if (error.code === '23505') {
        showToast('Kamu sudah pernah memberi ulasan untuk tempat makan ini.', 'error');
      } else {
        showToast('Gagal mengirim ulasan: ' + error.message, 'error');
      }
      return;
    }

    // Refresh warung cache for updated rating
    await refreshWarungsCache();
    renderCulinaryGrid();

    document.getElementById('reviewForm')?.reset();
    document.getElementById('reviewModal')?.classList.remove('active');
    showToast('Ulasan kamu berhasil diterbitkan! Terima kasih bantu sesama anak kos.');
    setTimeout(() => window.openDetailModal(spotId), 400);
  } catch (err) {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
    console.warn('[Review] Submit error:', err);
  } finally {
    setLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = 'Kirim Ulasan'; }
  }
}

// ============================================================
// REAL CAMPUS RADAR MAP (Leaflet.js + OpenStreetMap - 100% Free / No API Key)
// ============================================================
const PUSAT_UNEJ_COORDS = [-8.164297126393304, 113.71661967155912];
const UNEJ_CENTER = [-8.1655, 113.7175];
const DEFAULT_MAP_ZOOM = 15.8;
let leafletMap = null;
let leafletMarkers = {};
let campusHubMarker = null;

const AREA_COORDINATES = {
  'all': { center: [-8.1655, 113.7175], zoom: 15.8 },
  ...Object.fromEntries(Object.entries(AREA_ROADS).map(([name, line]) => [name, { center: pointAlongRoad(line, 0.5), zoom: 17 }]))
};

// Zoom peta mengikuti posisi pin warung di area terpilih (bukan titik/zoom tetap),
// jadi selalu pas walau koordinat warung berubah. Cadangan: titik tengah jalan.
function focusMapOnArea(area) {
  if (!leafletMap) return;
  const opts = { duration: 0.9, maxZoom: 17, paddingTopLeft: [70, 70], paddingBottomRight: [180, 90] };
  const latlngs = getAllCulinaryData()
    .filter(item => area === 'all' || item.area === area)
    .map(item => leafletMarkers[item.id] && leafletMarkers[item.id].getLatLng())
    .filter(Boolean);

  if (area === 'all') {
    latlngs.push(L.latLng(PUSAT_UNEJ_COORDS[0], PUSAT_UNEJ_COORDS[1]));
    leafletMap.flyToBounds(L.latLngBounds(latlngs), opts);
    return;
  }
  if (latlngs.length === 0) {
    const target = AREA_COORDINATES[area] || AREA_COORDINATES['all'];
    leafletMap.flyTo(target.center, 16.5, { duration: 0.9 });
  } else if (latlngs.length === 1) {
    leafletMap.flyTo(latlngs[0], 17, { duration: 0.9 });
  } else {
    leafletMap.flyToBounds(L.latLngBounds(latlngs), opts);
  }
}

function initLeafletMap() {
  const container = document.getElementById('radarMapContainer');
  if (!container) return;
  if (leafletMap) {
    leafletMap.invalidateSize();
    return;
  }
  if (typeof L === 'undefined') {
    console.warn('[MUYANG] Leaflet library not loaded.');
    return;
  }

  // Initialize Map
  leafletMap = L.map('radarMapContainer', {
    center: UNEJ_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: false
  });

  // Add subtle attribution in corner
  L.control.attribution({ position: 'bottomright' }).addTo(leafletMap);

  // Add custom zoom control at bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  // Mode bantu: buka situs dengan ?pickcoords=1, lalu klik jalan di peta untuk menyalin koordinatnya.
  if (new URLSearchParams(location.search).has('pickcoords')) {
    leafletMap.on('click', (e) => {
      const txt = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      console.log('[MUYANG] koordinat:', txt);
      try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (_) { }
      showToast('Koordinat: ' + txt);
    });
  }

  // OpenStreetMap standard tiles (100% Free, No API Key, Clean & Detailed campus streets)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(leafletMap);

  // Add Campus Center Landmark (Pusat UNEJ Tegalboto)
  const campusIcon = L.divIcon({
    className: 'leaflet-campus-marker',
    html: `
      <div class="leaflet-campus-hub">
        <i class="fa-solid fa-building-columns"></i>
        <span>Pusat Kampus UNEJ</span>
      </div>
    `,
    iconSize: [165, 34],
    iconAnchor: [82, 17]
  });
  campusHubMarker = L.marker(PUSAT_UNEJ_COORDS, { icon: campusIcon, interactive: false, zIndexOffset: 200 }).addTo(leafletMap);

  // Setup Toolbar event listeners
  document.querySelectorAll('.map-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      focusMapOnArea(btn.getAttribute('data-area'));
    });
  });

  document.getElementById('mapRecenterBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.map-chip-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-area') === 'all'));
    leafletMap.flyTo(PUSAT_UNEJ_COORDS, 16.5, { duration: 0.8 });
  });

  // Invalidate size on window resize
  window.addEventListener('resize', () => {
    if (leafletMap) leafletMap.invalidateSize();
  });
}

function renderRadarMapPins() {
  const allData = getAllCulinaryData();

  // 1. Initialize Leaflet map if not ready
  if (typeof L !== 'undefined' && !leafletMap) {
    initLeafletMap();
  }

  // 2. If Leaflet is available, update Leaflet markers
  if (leafletMap && typeof L !== 'undefined') {
    // Remove existing markers
    Object.values(leafletMarkers).forEach(m => leafletMap.removeLayer(m));
    leafletMarkers = {};

    allData.forEach((item, idx) => {
      let lat = Number(item.lat);
      let lng = Number(item.lng);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        const fallback = assignCoordinates(item.area || 'Jl. Kalimantan', idx);
        lat = fallback.lat;
        lng = fallback.lng;
      }

      const isSelected = String(item.id) === String(state.selectedSpotId);
      const isWithinBudget = item.minPrice <= state.maxBudget;
      const opacity = isWithinBudget ? 1 : 0.45;

      const shortName = item.name.length > 15 ? item.name.substring(0, 14) + '…' : item.name;
      const priceText = item.minPrice > 0 ? formatIDR(item.minPrice) : 'Menu Murah';

      const html = `
        <div class="leaflet-warung-pin ${item.isFeatured ? 'featured' : ''} ${isSelected ? 'active' : ''}"
             style="opacity: ${opacity};"
             title="${esc(item.name)} - Mulai ${esc(priceText)}">
          <i class="fa-solid ${item.isFeatured ? 'fa-star' : 'fa-utensils'} pin-icon-tag"></i>
          <span class="pin-text-name">${esc(shortName)}</span>
          <span class="pin-text-price">${esc(priceText)}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-warung-marker',
        html: html,
        iconSize: [160, 32],
        iconAnchor: [80, 16]
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : (item.isFeatured ? 500 : 100)
      }).addTo(leafletMap);

      marker.on('click', () => {
        selectRadarSpot(item.id);
      });

      leafletMarkers[item.id] = marker;
    });
  }

  // Fallback container update (in case Leaflet couldn't load)
  const radarPinsContainer = document.getElementById('radarPinsContainer');
  if (radarPinsContainer && (!leafletMap || typeof L === 'undefined')) {
    radarPinsContainer.style.display = 'block';
    radarPinsContainer.innerHTML = allData.map(item => {
      const isSelected = String(item.id) === String(state.selectedSpotId);
      const isWithinBudget = item.minPrice <= state.maxBudget;
      return `
        <div class="culinary-map-pin ${isSelected ? 'active' : ''}" 
             style="left: ${item.coordinates.x}%; top: ${item.coordinates.y}%; opacity: ${isWithinBudget ? '1' : '0.45'};" 
             data-id="${esc(item.id)}"
             title="${esc(item.name)} (${formatIDR(item.minPrice)})">
          <div class="pin-bubble ${item.isFeatured ? 'featured' : ''}">
            <i class="fa-solid fa-utensils"></i>
            <span>${formatIDR(item.minPrice)}</span>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.culinary-map-pin').forEach(pin => {
      pin.addEventListener('click', () => selectRadarSpot(pin.getAttribute('data-id')));
    });
  }
}

function selectRadarSpot(id) {
  state.selectedSpotId = id;
  const allData = getAllCulinaryData();
  const item = allData.find(i => String(i.id) === String(id));
  const radarDetailContainer = document.getElementById('radarDetailContainer');
  if (!item || !radarDetailContainer) return;

  // Re-render pins so active class updates
  renderRadarMapPins();

  // Smoothly pan map to selected spot
  if (leafletMap && item.lat && item.lng) {
    leafletMap.panTo([Number(item.lat), Number(item.lng)], { animate: true, duration: 0.6 });
  }

  const mapsUrl = item.googleMapsUrl || `https://www.google.com/maps?q=${item.lat},${item.lng}`;
  const rawPhone = item.whatsapp || '081234567890';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const waMsg = encodeURIComponent(`Halo ${item.name}, saya mahasiswa UNEJ dari platform MUYANG. Mau tanya apakah warung buka dan menu hari ini masih tersedia? Terima kasih!`);
  const waUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

  const popularMenus = item.popularMenus || [];
  const topMenusHtml = popularMenus.slice(0, 3).map(m => `
    <span class="spot-menu-tag"><i class="fa-solid fa-check"></i> ${esc(m.name)} (${formatIDR(m.price)})</span>
  `).join('');

  radarDetailContainer.innerHTML = `
    <div class="radar-spot-card">
      <div class="spot-card-hero">
        <img src="${safeUrl(item.image)}" alt="${esc(item.name)}" class="spot-card-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'" />
        <div class="spot-card-badges">
          <span class="spot-badge-cat">${esc(item.categoryLabel)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${item.kenyangScore}</span>
        </div>
      </div>

      <div class="spot-card-body">
        <h4 class="radar-spot-title">${esc(item.name)}</h4>
        <div class="spot-meta-row">
          <span class="spot-meta-distance"><i class="fa-solid fa-person-walking"></i> ${esc(item.distance)}</span>
          <span class="spot-meta-area"><i class="fa-solid fa-location-dot"></i> ${esc(item.area)}</span>
        </div>

        <p style="font-size: 0.82rem; color: var(--neutral-600); margin-bottom: 12px; line-height: 1.45;">
          ${esc((item.description || '').substring(0, 95))}...
        </p>

        <div class="spot-price-box">
          <span class="spot-price-label">Mulai Dari</span>
          <span class="spot-price-val">${formatIDR(item.minPrice)}</span>
        </div>

        ${popularMenus.length > 0 ? `
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--neutral-400); text-transform: uppercase; margin-bottom: 6px;">Menu Populer:</div>
          <div class="spot-popular-tags">
            ${topMenusHtml}
          </div>
        ` : ''}

        <div class="spot-actions-grid">
          <a href="${safeUrl(mapsUrl)}" target="_blank" rel="noopener" class="btn-spot-route" title="Buka rute navigasi Google Maps">
            <i class="fa-solid fa-map-location-dot"></i> Rute Maps
          </a>
          <a href="${safeUrl(waUrl)}" target="_blank" rel="noopener" class="btn-spot-wa" title="Hubungi warung via WhatsApp">
            <i class="fa-brands fa-whatsapp"></i> Chat WA
          </a>
        </div>

        <button class="btn btn-primary btn-sm btn-spot-full" id="radarDetailBtn" data-id="${esc(item.id)}">
          <i class="fa-solid fa-book-open"></i> Lihat Menu &amp; Ulasan
        </button>
      </div>
    </div>
  `;

  document.getElementById('radarDetailBtn')?.addEventListener('click', () => window.openDetailModal(item.id));
}

function updateRadarMap() {
  renderRadarMapPins();
}

// ============================================================
// MEAL PLANNER (static options — not DB-dependent)
// ============================================================
function calculateMealPlan(dailyBudget) {
  const sarapanOptions = [
    { food: "Nasi Pecel Sayur Lengkap + Peyek", place: "Nasi Pecel Mbok Darmi", price: 7000, kenyang: 9.4 },
    { food: "Indomie Rebus Telur Setengah Matang", place: "Warmindo Sahabat Kos", price: 7500, kenyang: 9.0 },
    { food: "Soto Ayam Campur Nasi + Koya Melimpah", place: "Soto Ayam Cak Dul Lamongan", price: 9000, kenyang: 9.4 }
  ];
  const siangOptions = [
    { food: "Paket Nasi + Tempe Orek + Sayur Lodeh", place: "Warteg Barokah Jaya", price: 7000, kenyang: 9.6 },
    { food: "Paket Nasi Geprek Ayam + Es Teh Dingin", place: "Geprek Mas Bro Jl. Kalimantan", price: 11000, kenyang: 9.8 },
    { food: "Mie Ayam Pangsit + Es Jeruk", place: "Bakso & Mie Ayam Urat Arema", price: 11000, kenyang: 9.3 },
    { food: "Nasi + Tempe Penyet + Terong Sambal Bajak", place: "Lalapan Sambal Bu Siti", price: 7000, kenyang: 9.7 }
  ];
  const malamOptions = [
    { food: "Nasi Goreng Mawut Porsi Meluap", place: "Depot Mas Gareng Jl. Danau Toba", price: 10000, kenyang: 9.7 },
    { food: "Nasi + Telur Dadar + Sayur Sop Hangat", place: "Warteg Barokah Jaya", price: 9000, kenyang: 9.5 },
    { food: "Magelangan (Mie + Nasi Goreng Jawa)", place: "Warmindo Sahabat Kos Mastrip", price: 10000, kenyang: 9.2 },
    { food: "Nasi + Tempe Crispy Sambal Korek", place: "Lalapan Bu Siti", price: 5000, kenyang: 9.2 }
  ];

  let bestCombo = null;
  let minDiff = Infinity;
  for (let s of sarapanOptions) {
    for (let m of siangOptions) {
      for (let n of malamOptions) {
        const total = s.price + m.price + n.price;
        if (total <= dailyBudget) {
          const diff = dailyBudget - total;
          if (diff < minDiff) {
            minDiff = diff;
            bestCombo = { sarapan: s, siang: m, malam: n, total, leftover: diff, avgKenyang: (s.kenyang + m.kenyang + n.kenyang) / 3 };
          }
        }
      }
    }
  }
  if (!bestCombo) {
    bestCombo = { sarapan: sarapanOptions[0], siang: siangOptions[3], malam: malamOptions[3], total: 19000, leftover: Math.max(0, dailyBudget - 19000), avgKenyang: 9.4 };
  }
  return bestCombo;
}

function updateMealPlanner() {
  const plannerTotalCost = document.getElementById('plannerTotalCost');
  const plannerLeftover = document.getElementById('plannerLeftover');
  const plannerKenyangScore = document.getElementById('plannerKenyangScore');
  const plannerTimeline = document.getElementById('plannerTimeline');
  const plan = calculateMealPlan(state.plannerBudget);

  if (plannerTotalCost) plannerTotalCost.textContent = formatIDR(plan.total);
  if (plannerLeftover) {
    plannerLeftover.textContent = formatIDR(plan.leftover);
    plannerLeftover.style.color = plan.leftover >= 0 ? 'var(--success-600)' : 'var(--primary-700)';
  }
  if (plannerKenyangScore) plannerKenyangScore.textContent = `${plan.avgKenyang.toFixed(1)} / 10`;

  if (plannerTimeline) {
    plannerTimeline.innerHTML = `
      <div class="meal-slot-card">
        <span class="meal-time-badge time-sarapan"><i class="fa-regular fa-sun"></i> 07:00 • Sarapan Pagi</span>
        <h5 class="meal-food-name">${esc(plan.sarapan.food)}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${esc(plan.sarapan.place)}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.sarapan.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.sarapan.kenyang}</span>
        </div>
      </div>
      <div class="meal-slot-card">
        <span class="meal-time-badge time-siang"><i class="fa-solid fa-sun"></i> 12:30 • Makan Siang</span>
        <h5 class="meal-food-name">${esc(plan.siang.food)}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${esc(plan.siang.place)}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.siang.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.siang.kenyang}</span>
        </div>
      </div>
      <div class="meal-slot-card">
        <span class="meal-time-badge time-malam"><i class="fa-solid fa-moon"></i> 19:00 • Makan Malam</span>
        <h5 class="meal-food-name">${esc(plan.malam.food)}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${esc(plan.malam.place)}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.malam.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.malam.kenyang}</span>
        </div>
      </div>
    `;
  }
}

// ============================================================
// SUPABASE STORAGE — IMAGE UPLOAD HELPERS
// ============================================================
const STORAGE_BUCKET = 'muyang-uploads';

async function uploadImageToStorage(file, folder) {
  if (!supabaseClient) return null;
  if (!file) return null;

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran file terlalu besar. Maksimal 2MB.', 'error');
    return null;
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
    return null;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { upsert: true, contentType: file.type });

    if (error) {
      console.warn('[Storage] Upload error:', error.message);
      // Jika bucket belum ada, beri instruksi
      if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
        showToast('Storage bucket belum dibuat. Buat bucket "muyang-uploads" di Supabase.', 'error');
      } else {
        showToast('Gagal upload gambar: ' + error.message, 'error');
      }
      return null;
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('[Storage] Upload exception:', err);
    showToast('Gagal upload gambar.', 'error');
    return null;
  }
}

// ============================================================
// ADMIN PRIVATE ACCESS (Stealth / Hidden Triggers)
// Tidak ada link / tombol publik di website untuk login admin.
// Akses admin bersifat private via:
//  1. URL Hash: #admin atau #admin-login
//  2. URL Query: ?admin=1 atau ?admin=true
//  3. Keyboard Shortcut: Ctrl + Shift + A (atau Ctrl + Alt + A)
//  4. 5x Klik Cepat pada Logo Brand di Header
// ============================================================
function initAdminSecretTrigger() {
  let clickCount = 0;
  let clickTimer = null;

  function handleAdminClick(e) {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
    if (clickCount >= 5) {
      if (e) e.preventDefault();
      clickCount = 0;
      clearTimeout(clickTimer);
      const session = LS.getSession();
      if (session && session.role === 'admin') {
        showToast('Sudah masuk sebagai Administrator.');
        routeToDashboard();
        return;
      }
      openModal('adminLoginModal');
    }
  }

  // 1. Stealth 5x klik cepat pada logo Muyang di header
  document.getElementById('headerBrandLogo')?.addEventListener('click', handleAdminClick);

  // 2. Secret Keyboard Shortcut: Ctrl + Shift + A atau Ctrl + Alt + A
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) ||
      (e.ctrlKey && e.altKey && (e.key === 'A' || e.key === 'a'))) {
      e.preventDefault();
      const session = LS.getSession();
      if (session && session.role === 'admin') {
        showToast('Sudah masuk sebagai Administrator.');
        routeToDashboard();
      } else {
        openModal('adminLoginModal');
      }
    }
  });

  // 3. Secret URL query: ?admin=1 atau ?admin=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === '1' || urlParams.get('admin') === 'true') {
    const session = LS.getSession();
    if (session && session.role === 'admin') {
      routeToDashboard();
    } else {
      openModal('adminLoginModal');
    }
  }

  // 4. Secret URL hash: #admin atau #admin-login
  if (window.location.hash === '#admin' || window.location.hash === '#admin-login') {
    const session = LS.getSession();
    if (session && session.role === 'admin') {
      routeToDashboard();
    } else {
      openModal('adminLoginModal');
    }
  }
}

// ============================================================
// INIT EVENT LISTENERS (DOMContentLoaded)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Navbar
  const savedSession = LS.getSession();
  updateNavbarState();

  // 2. Global click interceptor for '#' anchor links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    if (link.id && link.id.startsWith('switchTo')) return;
    if (href === '#admin' || href === '#admin-login') {
      e.preventDefault();
      const session = LS.getSession();
      if (session && session.role === 'admin') routeToDashboard();
      else openModal('adminLoginModal');
      return;
    }
    if (href === '#dashboard') { e.preventDefault(); routeToDashboard(); return; }
    if (href.startsWith('#')) { e.preventDefault(); navigateToSection(href); }
  });

  // 3. Close user dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('navUserDropdown');
    if (dropdown && dropdown.classList.contains('open')) {
      if (!e.target.closest('.user-dropdown-wrap')) dropdown.classList.remove('open');
    }
  });

  // 4. Restore a valid saved login session after reload/reopen
  const currentHash = window.location.hash;
  const localSessionValid = savedSession?.token &&
    (!savedSession.expiresAt || savedSession.expiresAt > Date.now());
  if (localSessionValid) {
    try {
      const { error } = await withLoading(
        () => DB.validateSession(savedSession.token, savedSession.role),
        'Memulihkan sesi akun...'
      );
      if (error) throw error;
      startSessionWatcher();
      if (currentHash === '#home' || currentHash === '#katalog' || currentHash === '#radar-map' || currentHash === '#meal-planner' || currentHash === '#kemitraan-umkm') {
        showLanding();
        if (currentHash !== '#home') setTimeout(() => navigateToSection(currentHash), 100);
      } else {
        await routeToDashboard();
      }
    } catch (error) {
      console.info('[AUTH] Saved session expired or invalid:', error?.message);
      let endReason = 'expired';
      try {
        const chk = await DB.checkSession(savedSession.token);
        if (chk.data?.reason === 'replaced') endReason = 'replaced';
      } catch (_) { /* abaikan */ }
      LS.clearSession();
      updateNavbarState();
      showLanding();
      if (endReason === 'replaced') {
        showSessionKickedModal();
      } else {
        showToast('Sesi kamu sudah berakhir. Silakan masuk kembali.', 'error');
        if (currentHash === '#dashboard') openModal('loginModal');
      }
    }
  } else if (savedSession) {
    LS.clearSession();
    updateNavbarState();
    showLanding();
    showToast('Sesi kamu sudah berakhir. Silakan masuk kembali.', 'error');
    if (currentHash === '#dashboard') openModal('loginModal');
  } else if (currentHash === '#dashboard') {
    routeToDashboard();
  } else {
    showLanding();
    if (currentHash && currentHash !== '#home' && currentHash !== '#dashboard') {
      setTimeout(() => navigateToSection(currentHash), 100);
    }
  }

  // 5. Hero Slider
  const heroSlider = document.getElementById('heroBudgetSlider');
  const heroDisplay = document.getElementById('heroBudgetDisplay');
  if (heroSlider) {
    heroSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.maxBudget = val;
      if (heroDisplay) heroDisplay.textContent = formatIDR(val);
      document.querySelectorAll('.hero-budget-pill').forEach(p => p.classList.remove('active'));
      renderCulinaryGrid();
      updateRadarMap();
    });
  }

  document.querySelectorAll('.hero-budget-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.hero-budget-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const budget = parseInt(pill.getAttribute('data-budget'));
      state.maxBudget = budget;
      if (heroSlider) heroSlider.value = budget;
      if (heroDisplay) heroDisplay.textContent = formatIDR(budget);
      renderCulinaryGrid();
      updateRadarMap();
    });
  });

  // 6. Catalogue Filters
  document.getElementById('catalogueSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCulinaryGrid();
  });

  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedCategory = chip.getAttribute('data-category');
      renderCulinaryGrid();
    });
  });

  document.getElementById('areaSelect')?.addEventListener('change', (e) => {
    state.selectedArea = e.target.value;
    renderCulinaryGrid();
  });

  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderCulinaryGrid();
  });

  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetAllFilters);

  // 7. Meal Planner
  document.getElementById('plannerBudgetInput')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) || 20000;
    state.plannerBudget = val;
    document.querySelectorAll('.planner-preset-btn').forEach(p => p.classList.remove('active'));
    updateMealPlanner();
  });

  document.querySelectorAll('.planner-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.planner-preset-btn').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const val = parseInt(btn.getAttribute('data-value'));
      state.plannerBudget = val;
      const inp = document.getElementById('plannerBudgetInput');
      if (inp) inp.value = val;
      updateMealPlanner();
    });
  });

  // 8. Modal Close Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // 9. Auth Tab Switching (Login)
  document.querySelectorAll('#loginModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#loginModal .auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('loginPanelMahasiswa')?.classList.toggle('active', target === 'mahasiswa');
      document.getElementById('loginPanelUmkm')?.classList.toggle('active', target === 'umkm');
    });
  });

  // 10. Auth Tab Switching (Register)
  document.querySelectorAll('#registerModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('registerPanelMahasiswa')?.classList.toggle('active', target === 'mahasiswa');
      document.getElementById('registerPanelUmkm')?.classList.toggle('active', target === 'umkm');
    });
  });

  // 11. Switch Login <-> Register links
  document.getElementById('switchToRegisterMhs')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('registerModal');
    document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mahasiswa'));
    document.getElementById('registerPanelMahasiswa')?.classList.add('active');
    document.getElementById('registerPanelUmkm')?.classList.remove('active');
  });
  document.getElementById('switchToRegisterUmkm')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('registerModal');
    document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
    document.getElementById('registerPanelUmkm')?.classList.add('active');
    document.getElementById('registerPanelMahasiswa')?.classList.remove('active');
  });
  document.getElementById('switchToLoginMhs')?.addEventListener('click', (e) => { e.preventDefault(); openModal('loginModal'); });
  document.getElementById('switchToLoginUmkm')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('loginModal');
    document.querySelectorAll('#loginModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
    document.getElementById('loginPanelUmkm')?.classList.add('active');
    document.getElementById('loginPanelMahasiswa')?.classList.remove('active');
  });

  // 12. Pricing buttons → register modal UMKM
  document.querySelectorAll('.open-register-umkm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('registerModal');
      document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
      document.getElementById('registerPanelUmkm')?.classList.add('active');
      document.getElementById('registerPanelMahasiswa')?.classList.remove('active');
    });
  });

  // 13. Login Forms
  document.getElementById('loginFormMahasiswa')?.addEventListener('submit', handleLoginMahasiswa);
  document.getElementById('loginFormUmkm')?.addEventListener('submit', handleLoginUmkm);
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleLoginAdmin);
  document.getElementById('forgotFormMahasiswa')?.addEventListener('submit', (e) => handleForgotPassword(e, 'mahasiswa'));
  document.getElementById('forgotFormUmkm')?.addEventListener('submit', (e) => handleForgotPassword(e, 'umkm'));
  document.getElementById('forgotBackBtn')?.addEventListener('click', (e) => window.openLoginModal(e.currentTarget.dataset.role || 'mahasiswa'));

  // 14. Register Forms
  document.getElementById('registerFormMahasiswa')?.addEventListener('submit', handleRegisterMahasiswa);
  document.getElementById('registerFormUmkm')?.addEventListener('submit', handleRegisterUmkm);
  initUmkmRegisterPicker();

  // 15. Review Form
  document.getElementById('reviewForm')?.addEventListener('submit', handleReviewSubmit);

  // 16. UMKM Add Menu Form (insert to warung_menus table + foto opsional)
  document.getElementById('addMenuForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const session = LS.getSession();
    if (!session || session.role !== 'umkm') return;

    const name = document.getElementById('menuNameInput').value.trim();
    const price = parseInt(document.getElementById('menuPriceInput').value);
    const portion = document.getElementById('menuPortionInput').value.trim();
    const photoFile = document.getElementById('menuPhotoInput')?.files?.[0] || null;
    if (!name || !price) return;

    // Get warung_id for this UMKM
    const warung = await DB.getWarungByOwnerId(session.id);
    if (!warung) {
      showToast('Warung belum aktif. Hubungi admin untuk aktivasi.', 'error');
      return;
    }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    setLoading(true, 'Menyimpan menu...');

    try {
      // Upload foto menu jika ada
      let imageUrl = null;
      if (photoFile) {
        showToast('Mengupload foto menu...');
        imageUrl = await uploadImageToStorage(photoFile, 'menus');
      }

      const { error } = await DB.insertMenu({
        warung_id: warung.id,
        name,
        price,
        portion: portion || 'Porsi Standar',
        image_url: imageUrl,
        is_best_seller: false,
        is_available: true
      });

      if (error) {
        showToast('Gagal menambah menu: ' + error.message, 'error');
        return;
      }

      await refreshWarungsCache();
      await renderUmkmDashboard();
      renderCulinaryGrid();
      document.getElementById('addMenuForm')?.reset();
      // Reset preview foto menu
      const menuPhotoPreview = document.getElementById('menuPhotoPreview');
      const menuPhotoName = document.getElementById('menuPhotoName');
      if (menuPhotoPreview) { menuPhotoPreview.style.display = 'none'; menuPhotoPreview.src = ''; }
      if (menuPhotoName) menuPhotoName.textContent = '';
      showToast(`Menu "${name}" berhasil ditambahkan${imageUrl ? ' dengan foto' : ''}!`);
    } finally {
      setLoading(false);
      if (btn) { btn.disabled = false; btn.textContent = 'Tambah Menu'; }
    }
  });

  // Preview foto menu saat file dipilih
  document.getElementById('menuPhotoInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('menuPhotoPreview');
    const nameEl = document.getElementById('menuPhotoName');
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
      if (nameEl) nameEl.textContent = file.name;
    }
  });

  // 17. Mobile Menu Drawer Toggle
  document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
    document.getElementById('mobileNavDrawer')?.classList.toggle('active');
  });

  // 18. Admin Secret Triggers
  initAdminSecretTrigger();

  // 18b. UMKM Warung Photo Upload
  document.getElementById('warungPhotoInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('warungPhotoPreview');
    const uploadBtn = document.getElementById('uploadWarungPhotoBtn');
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
      if (uploadBtn) uploadBtn.style.display = 'inline-flex';
    }
  });

  document.getElementById('uploadWarungPhotoBtn')?.addEventListener('click', async () => {
    const session = LS.getSession();
    if (!session || session.role !== 'umkm') return;

    const file = document.getElementById('warungPhotoInput')?.files?.[0];
    if (!file) return;

    const statusEl = document.getElementById('uploadWarungStatus');
    const btn = document.getElementById('uploadWarungPhotoBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengupload...'; }
    setLoading(true, 'Mengunggah foto warung...');
    if (statusEl) statusEl.textContent = '';

    try {
      const imageUrl = await uploadImageToStorage(file, 'warungs');
      if (!imageUrl) return;

      // Update warung image_url di database
      const warung = await DB.getWarungByOwnerId(session.id);
      if (warung) {
        const { error } = await DB.setWarungImage(session.token, imageUrl);
        if (error) throw error;
        await refreshWarungsCache();
        renderCulinaryGrid();
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--success-600);font-weight:700;"><i class="fa-solid fa-check-circle"></i> Foto berhasil disimpan!</span>';
        showToast('Foto warung berhasil diupload dan tampil di katalog!');
      }
    } finally {
      setLoading(false);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-upload-alt"></i> Simpan Foto Warung'; }
    }
  });

  // 19. Load data from Supabase Cloud, then render
  console.log('[MUYANG] Loading data from Supabase...');
  await Promise.all([
    refreshWarungsCache(),
    refreshBookmarkSet()
  ]);

  // 20. Initial Renders
  renderCulinaryGrid();
  renderRadarMapPins();
  if (warungsCache.length > 0) selectRadarSpot(warungsCache[0].id);
  setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 400);
  updateMealPlanner();

  // 21. Scroll-reveal animation
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.section-reveal').forEach(el => revealObserver.observe(el));
  } else {
    document.querySelectorAll('.section-reveal').forEach(el => el.classList.add('section-visible'));
  }

  console.log('[MUYANG] Web App Successfully Loaded.');
});