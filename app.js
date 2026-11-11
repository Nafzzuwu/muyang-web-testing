/**
 * MUYANG (Murah Kenyang) - Full Application Logic v2.2
 * Kelompok 6 - Universitas Jember
 * Features:
 *  - Dynamic Culinary Sync (Active UMKM instantly appears on public catalogue & map)
 *  - Role-based Auth (Mahasiswa, UMKM Mitra, Admin)
 *  - Interactive Campus Radar Map with Google Maps Real Coordinates
 *  - Budget Filter & Meal Planner (Kalkulator Kenyang Anak Kos)
 *  - Anti-Spam Reviews (1 NIM = 1 review per warung)
 *  - Student Reviews Management (Ulasan Saya)
 *  - UMKM Partner Management & Menu CRUD
 *  - Admin Approval, WA Payment Activation, and Review Moderation
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

// ============================================================
// LOCAL STORAGE HELPERS (Dummy DB)
// ============================================================
const LS = {
  getMhs: () => JSON.parse(localStorage.getItem('muyang_users_mhs') || '[]'),
  setMhs: (d) => localStorage.setItem('muyang_users_mhs', JSON.stringify(d)),
  getUmkm: () => JSON.parse(localStorage.getItem('muyang_users_umkm') || '[]'),
  setUmkm: (d) => localStorage.setItem('muyang_users_umkm', JSON.stringify(d)),
  getSession: () => JSON.parse(localStorage.getItem('muyang_session') || 'null'),
  setSession: (d) => localStorage.setItem('muyang_session', JSON.stringify(d)),
  clearSession: () => localStorage.removeItem('muyang_session'),
  getBookmarks: (nim) => {
    const users = LS.getMhs();
    const u = users.find(x => x.nim === nim);
    return u ? u.bookmarks : [];
  },
  getReviews: () => JSON.parse(localStorage.getItem('muyang_user_reviews') || '{}'),
  setReviews: (d) => localStorage.setItem('muyang_user_reviews', JSON.stringify(d))
};

// ============================================================
// SEED DEMO DATA (only on first load)
// ============================================================
function initSeedData() {
  if (!localStorage.getItem('muyang_seeded_v2')) {
    LS.setMhs(DEMO_MAHASISWA);
    LS.setUmkm(DEMO_UMKM);
    localStorage.setItem('muyang_seeded_v2', '1');
  }
}

// ============================================================
// DYNAMIC CULINARY DATA SYNCHRONIZATION
// Combines static CULINARY_DATA with all active UMKM in localStorage
// ============================================================
function detectCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('geprek') || n.includes('ayam') || n.includes('bebek') || n.includes('lalapan')) {
    return {
      key: 'ayam',
      label: 'Ayam & Bebek',
      image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80'
    };
  }
  if (n.includes('mie') || n.includes('bakso') || n.includes('indomie') || n.includes('warmindo')) {
    return {
      key: 'mie',
      label: 'Mie & Bakso / Warmindo',
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80'
    };
  }
  if (n.includes('pecel') || n.includes('soto') || n.includes('nasi') || n.includes('depot') || n.includes('padang')) {
    return {
      key: 'nasi',
      label: 'Nasi Lauk & Masakan Daerah',
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80'
    };
  }
  if (n.includes('warteg') || n.includes('prasmanan')) {
    return {
      key: 'warteg',
      label: 'Warteg & Prasmanan',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
    };
  }
  return {
    key: 'hiddengem',
    label: 'Hidden Gem Kuliner',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80'
  };
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

function assignCoordinates(area, idx) {
  const offset = (idx % 4) * 0.0012;
  const canvasOffset = (idx % 3) * 6;
  switch (area) {
    case 'Jl. Jawa':
      return { lat: -8.1730 - offset, lng: 113.7200 + offset, distance: 220 + (idx * 30), canvas: { x: 38 + canvasOffset, y: 46 + canvasOffset } };
    case 'Jl. Mastrip':
      return { lat: -8.1755 - offset, lng: 113.7245 + offset, distance: 380 + (idx * 30), canvas: { x: 64 - canvasOffset, y: 62 + canvasOffset } };
    case 'Jl. Danau Toba':
      return { lat: -8.1788 - offset, lng: 113.7268 + offset, distance: 520 + (idx * 30), canvas: { x: 74 - canvasOffset, y: 68 + canvasOffset } };
    case 'Jl. Riau':
      return { lat: -8.1672 + offset, lng: 113.7190 - offset, distance: 310 + (idx * 30), canvas: { x: 28 + canvasOffset, y: 24 + canvasOffset } };
    case 'Jl. Karimata':
      return { lat: -8.1742 - offset, lng: 113.7252 + offset, distance: 360 + (idx * 30), canvas: { x: 54 + canvasOffset, y: 78 - canvasOffset } };
    case 'Jl. Kalimantan':
    default:
      return { lat: -8.1702 + offset, lng: 113.7220 + offset, distance: 180 + (idx * 30), canvas: { x: 48 + canvasOffset, y: 32 + canvasOffset } };
  }
}

function getAllCulinaryData() {
  // Clone static CULINARY_DATA
  const list = JSON.parse(JSON.stringify(CULINARY_DATA));
  const umkmList = LS.getUmkm();

  umkmList.forEach((u, index) => {
    if (u.status !== 'active') return;

    // Check if linked to an existing static entry
    let existing = null;
    if (u.linkedCulinaryId) {
      existing = list.find(c => String(c.id) === String(u.linkedCulinaryId));
    }
    if (!existing) {
      existing = list.find(c => c.name.toLowerCase().trim() === u.warungName.toLowerCase().trim());
    }

    if (existing) {
      // Sync menus and details from active UMKM dashboard
      if (u.menus && u.menus.length > 0) {
        existing.popularMenus = u.menus.map(m => ({
          name: m.name,
          price: m.price,
          portion: m.portion || 'Porsi Kenyang',
          isBestSeller: true
        }));
        const prices = u.menus.map(m => m.price);
        existing.minPrice = Math.min(...prices);
        existing.maxPrice = Math.max(...prices);
        existing.priceRange = `${formatIDR(existing.minPrice)} - ${formatIDR(existing.maxPrice)}`;
      }
      if (u.hours) existing.hours = u.hours;
      if (u.alamat) existing.location = u.alamat;
      if (u.description) existing.description = u.description;
      if (u.whatsapp) existing.whatsapp = u.whatsapp;
    } else {
      // Synthesize new culinary entry for this newly activated partner
      const cat = detectCategory(u.warungName);
      const area = detectArea(u.alamat);
      const coords = assignCoordinates(area, index);
      const menus = (u.menus && u.menus.length > 0)
        ? u.menus.map(m => ({ name: m.name, price: m.price, portion: m.portion || 'Porsi Kenyang', isBestSeller: true }))
        : [{ name: 'Menu Andalan Warung', price: 9000, portion: 'Porsi Kenyang', isBestSeller: true }];

      const prices = menus.map(m => m.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      const dynamicItem = {
        id: u.id,
        name: u.warungName,
        category: cat.key,
        categoryLabel: cat.label,
        location: u.alamat || `${area} (Dekat Kampus UNEJ)`,
        area: area,
        lat: coords.lat,
        lng: coords.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
        distance: `${coords.distance}m dari Kampus`,
        priceRange: `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}`,
        minPrice: minPrice,
        maxPrice: maxPrice,
        avgPrice: Math.round((minPrice + maxPrice) / 2),
        rating: 4.9,
        reviewsCount: 1,
        kenyangScore: 9.6,
        isFeatured: u.paket === 'Featured Listing',
        promoBadge: u.paket === 'Featured Listing' ? 'Featured UMKM Mitra' : 'Mitra Baru Muyang',
        image: cat.image,
        hours: u.hours || '08.00 - 21.00 WIB',
        whatsapp: u.whatsapp || '081234567890',
        features: ["Mitra Terverifikasi Muyang", "Porsi Kenyang Terjamin", "Bisa QRIS / Tunai", "Harga Ramah Mahasiswa"],
        description: u.description || `Warung kuliner mitra resmi Muyang di area ${area}. Menyajikan menu lezat dan porsi mengenyangkan khusus mahasiswa UNEJ & anak kos.`,
        popularMenus: menus,
        reviews: [
          {
            name: "Tim Verifikasi Muyang",
            rating: 5,
            kenyang: 5,
            comment: "Warung mitra resmi terverifikasi Muyang. Porsi dan harga telah dicek sesuai standar kenyang mahasiswa UNEJ.",
            date: "Baru saja"
          }
        ],
        coordinates: coords.canvas
      };

      list.push(dynamicItem);
    }
  });

  return list;
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
    setActiveNav('#katalog');
    return;
  }

  const targetEl = document.querySelector(hash);
  if (targetEl) {
    history.replaceState(null, '', hash);
    setTimeout(() => {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
    setActiveNav(hash);
  }
}

window.navigateToSection = navigateToSection;

// ============================================================
// NAVBAR STATE
// ============================================================
function updateNavbarState() {
  const session = LS.getSession();
  const navActions = document.getElementById('navActions');
  const mobileAuthArea = document.getElementById('mobileNavAuthArea');
  if (!navActions) return;

  if (!session) {
    // Guest view
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
    if (session.role === 'mahasiswa') {
      displayName = session.nama || session.nim;
      roleLabel = 'Mahasiswa UNEJ';
      roleIcon = '<i class="fa-solid fa-user-graduate"></i>';
    } else if (session.role === 'umkm') {
      displayName = session.warungName || session.email;
      roleLabel = 'Mitra UMKM';
      roleIcon = '<i class="fa-solid fa-store"></i>';
    } else if (session.role === 'admin') {
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
            ${roleIcon} <span class="nav-user-name">${displayName}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;"></i>
          </button>
          <div class="user-dropdown-menu" id="navUserDropdown">
            <div style="padding: 10px 14px; background: var(--neutral-50); border-bottom: 1px solid var(--neutral-200);">
              <div style="font-size: 0.7rem; color: var(--neutral-400); font-weight: 700; text-transform: uppercase;">Login Sebagai:</div>
              <div style="font-size: 0.85rem; font-weight: 800; color: var(--primary-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
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
      const mobileNavDrawer = document.getElementById('mobileNavDrawer');
      if (mobileNavDrawer) mobileNavDrawer.classList.remove('active');
      routeToDashboard();
    });
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => window.logoutUser());
  }
}

function routeToDashboard() {
  const session = LS.getSession();
  if (!session) {
    openModal('loginModal');
    return;
  }
  history.replaceState(null, '', '#dashboard');
  if (session.role === 'admin') {
    renderAdminDashboard();
    showDashboard('viewDashboardAdmin');
  } else if (session.role === 'mahasiswa') {
    renderMahasiswaDashboard();
    showDashboard('viewDashboardMahasiswa');
  } else if (session.role === 'umkm') {
    renderUmkmDashboard();
  }
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
// AUTH: LOGIN HANDLERS
// ============================================================
function handleLoginMahasiswa(e) {
  e.preventDefault();
  const nim = document.getElementById('loginNim').value.trim();
  const password = document.getElementById('loginPasswordMhs').value;
  const users = LS.getMhs();
  const user = users.find(u => u.nim === nim && u.password === password);
  if (!user) {
    showToast('NIM atau password salah. Coba lagi.', 'error');
    return;
  }
  LS.setSession({ role: 'mahasiswa', nim: user.nim, nama: user.nama, fakultas: user.fakultas });
  closeAllModals();
  updateNavbarState();
  routeToDashboard();
  showToast(`Selamat datang, ${user.nama}!`);
}

function handleLoginUmkm(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmailUmkm').value.trim().toLowerCase();
  const password = document.getElementById('loginPasswordUmkm').value;
  const users = LS.getUmkm();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    showToast('Email atau password UMKM salah.', 'error');
    return;
  }
  LS.setSession({ role: 'umkm', id: user.id, email: user.email, warungName: user.warungName, status: user.status });
  closeAllModals();
  updateNavbarState();
  routeToDashboard();
  showToast(`Selamat datang, ${user.warungName}!`);
}

function handleLoginAdmin(e) {
  e.preventDefault();
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;
  if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
    LS.setSession({ role: 'admin', username });
    closeAllModals();
    updateNavbarState();
    routeToDashboard();
    showToast('Selamat datang, Admin MUYANG!');
  } else {
    showToast('Kredensial admin salah.', 'error');
  }
}

// ============================================================
// AUTH: REGISTER HANDLERS
// ============================================================
function handleRegisterMahasiswa(e) {
  e.preventDefault();
  const nama = document.getElementById('regNamaLengkap').value.trim();
  const nim = document.getElementById('regNim').value.trim();
  const fakultas = document.getElementById('regFakultas').value.trim();
  const password = document.getElementById('regPasswordMhs').value;
  const users = LS.getMhs();
  if (users.find(u => u.nim === nim)) {
    showToast('NIM sudah terdaftar. Silakan login.', 'error');
    return;
  }
  const newUser = { nim, password, nama, fakultas, bookmarks: [], reviewedSpots: [] };
  users.push(newUser);
  LS.setMhs(users);
  LS.setSession({ role: 'mahasiswa', nim, nama, fakultas });
  closeAllModals();
  document.getElementById('registerFormMahasiswa').reset();
  updateNavbarState();
  routeToDashboard();
  showToast(`Daftar berhasil! Selamat datang, ${nama}!`);
}

function handleRegisterUmkm(e) {
  e.preventDefault();
  const warungName = document.getElementById('regWarungName').value.trim();
  const ownerName = document.getElementById('regOwnerName').value.trim();
  const email = document.getElementById('regEmailUmkm').value.trim().toLowerCase();
  const whatsapp = document.getElementById('regWa').value.trim();
  const alamat = document.getElementById('regAlamat').value.trim();
  const paketEl = document.getElementById('regPaket');
  const paket = paketEl.value;
  const paketPrice = parseInt(paketEl.options[paketEl.selectedIndex].dataset.price);
  const password = document.getElementById('regPasswordUmkm').value;
  const users = LS.getUmkm();
  if (users.find(u => u.email === email)) {
    showToast('Email sudah terdaftar. Silakan login.', 'error');
    return;
  }
  const id = 'UMKM-' + String(Date.now()).slice(-5);
  const newUser = {
    id,
    email,
    password,
    warungName,
    ownerName,
    whatsapp,
    alamat,
    paket,
    paketPrice,
    status: 'pending',
    menus: [
      { id: Date.now(), name: 'Paket Menu Hemat', price: 10000, portion: 'Porsi Kenyang' }
    ]
  };
  users.push(newUser);
  LS.setUmkm(users);
  LS.setSession({ role: 'umkm', id, email, warungName, status: 'pending' });
  closeAllModals();
  document.getElementById('registerFormUmkm').reset();
  updateNavbarState();
  routeToDashboard();
  showToast(`Pendaftaran "${warungName}" berhasil! Menunggu verifikasi admin.`);
}

// ============================================================
// AUTH: LOGOUT
// ============================================================
window.logoutUser = function () {
  LS.clearSession();
  updateNavbarState();
  showLanding();
  history.replaceState(null, '', '#home');
  showToast('Berhasil keluar. Sampai jumpa!');
};

// ============================================================
// DASHBOARD: MAHASISWA
// ============================================================
function renderMahasiswaDashboard() {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;

  const welcomeEl = document.getElementById('dashMahasiswaWelcome');
  if (welcomeEl) welcomeEl.textContent = `Halo, ${session.nama} (${session.nim}) — ${session.fakultas}`;

  const users = LS.getMhs();
  const user = users.find(u => u.nim === session.nim);
  const bookmarks = user ? user.bookmarks : [];
  const culinaryList = getAllCulinaryData();

  // 1. Render Bookmarks
  const bookmarkListEl = document.getElementById('dashBookmarkList');
  if (bookmarkListEl) {
    if (bookmarks.length === 0) {
      bookmarkListEl.innerHTML = '<p style="color:var(--neutral-500);font-size:0.9rem;">Belum ada simpanan. Jelajahi katalog kuliner dan klik ikon bookmark pada warung favoritmu!</p>';
    } else {
      bookmarkListEl.innerHTML = bookmarks.map(id => {
        const item = culinaryList.find(c => String(c.id) === String(id));
        if (!item) return '';
        return `
          <div class="dash-bookmark-card">
            <img src="${item.image}" alt="${item.name}" class="dash-bm-img">
            <div class="dash-bm-info">
              <h4>${item.name}</h4>
              <p><i class="fa-solid fa-location-dot"></i> ${item.area} (${item.distance})</p>
              <p style="color:var(--accent-600);font-weight:800;margin-top:4px;">Mulai ${formatIDR(item.minPrice)}</p>
            </div>
            <div class="dash-bm-actions">
              <button class="btn btn-primary btn-sm" onclick="window.openDetailModal('${item.id}')">
                <i class="fa-solid fa-eye"></i> Lihat Menu
              </button>
              <button class="btn btn-outline btn-sm" onclick="window.removeDashBookmark('${item.id}')" title="Hapus Simpanan">
                <i class="fa-solid fa-trash-can" style="color:#dc2626;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render Riwayat Ulasan Mahasiswa
  const reviewListEl = document.getElementById('dashReviewList');
  if (reviewListEl) {
    const allReviews = LS.getReviews();
    const myReviews = [];
    Object.entries(allReviews).forEach(([spotId, reviews]) => {
      reviews.forEach(r => {
        if (r.nim === session.nim) {
          const warung = culinaryList.find(c => String(c.id) === String(spotId));
          myReviews.push({ ...r, spotId, warungName: warung ? warung.name : `Warung #${spotId}` });
        }
      });
    });

    if (myReviews.length === 0) {
      reviewListEl.innerHTML = '<p style="color:var(--neutral-500);font-size:0.9rem;">Kamu belum menulis ulasan kuliner. Berikan ulasan pada tempat makan yang pernah kamu kunjungi untuk membantu sesama anak kos!</p>';
    } else {
      reviewListEl.innerHTML = myReviews.map(r => `
        <div class="dash-review-card">
          <div class="dash-review-top">
            <span class="dash-review-warung"><i class="fa-solid fa-store" style="color:var(--accent-500);"></i> ${r.warungName}</span>
            <span class="dash-review-date">${r.date}</span>
          </div>
          <div class="dash-review-badges">
            <span style="color:var(--gold-500);font-size:0.85rem;">${'<i class="fa-solid fa-star"></i>'.repeat(r.rating)}</span>
            <span style="background:var(--success-100);color:var(--success-700);font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:var(--radius-full);">Kenyang: ${r.kenyang}/5</span>
          </div>
          <p class="dash-review-comment">"${r.comment}"</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
            <button class="btn btn-primary btn-xs" onclick="window.openDetailModal('${r.spotId}')">
              <i class="fa-solid fa-eye"></i> Buka Warung
            </button>
            <button class="btn btn-outline btn-xs" style="color:#dc2626;border-color:#dc2626;" onclick="window.deleteMahasiswaReview('${r.spotId}')" title="Hapus Ulasan">
              <i class="fa-solid fa-trash-can"></i> Hapus
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

window.removeDashBookmark = function (id) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;
  const users = LS.getMhs();
  const idx = users.findIndex(u => u.nim === session.nim);
  if (idx === -1) return;
  users[idx].bookmarks = users[idx].bookmarks.filter(b => String(b) !== String(id));
  LS.setMhs(users);
  renderMahasiswaDashboard();
  renderCulinaryGrid();
  showToast('Warung dihapus dari simpanan favorit.');
};

window.deleteMahasiswaReview = function (spotId) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return;
  const reviews = LS.getReviews();
  if (!reviews[spotId]) return;

  reviews[spotId] = reviews[spotId].filter(r => r.nim !== session.nim);
  LS.setReviews(reviews);

  // Remove from user reviewedSpots
  const users = LS.getMhs();
  const idx = users.findIndex(u => u.nim === session.nim);
  if (idx !== -1 && users[idx].reviewedSpots) {
    users[idx].reviewedSpots = users[idx].reviewedSpots.filter(s => String(s) !== String(spotId));
    LS.setMhs(users);
  }

  renderMahasiswaDashboard();
  showToast('Ulasan kamu berhasil dihapus.');
};

// ============================================================
// DASHBOARD: UMKM
// ============================================================
function renderUmkmDashboard() {
  const session = LS.getSession();
  if (!session || session.role !== 'umkm') return;

  const users = LS.getUmkm();
  const user = users.find(u => u.id === session.id);
  if (!user) return;

  if (user.status !== session.status) {
    session.status = user.status;
    LS.setSession(session);
  }

  const status = user.status;

  if (status === 'pending') {
    const el = document.getElementById('pendingUmkmName');
    if (el) el.textContent = user.warungName;
    showDashboard('viewDashboardUmkmPending');

  } else if (status === 'awaiting_payment') {
    const el = document.getElementById('paymentUmkmName');
    if (el) el.textContent = user.warungName;
    const paketEl = document.getElementById('paymentPaket');
    const nominalEl = document.getElementById('paymentNominal');
    const waEl = document.getElementById('paymentWaLink');
    if (paketEl) paketEl.textContent = user.paket;
    if (nominalEl) nominalEl.textContent = formatIDR(user.paketPrice);
    const waMsg = encodeURIComponent(
      `Halo Tim Muyang! Saya ${user.ownerName} dari ${user.warungName} (ID: ${user.id}) ingin mengkonfirmasi pembayaran paket ${user.paket} senilai ${formatIDR(user.paketPrice)}. Berikut saya lampirkan bukti transfer.`
    );
    if (waEl) waEl.href = `https://wa.me/6282336669588?text=${waMsg}`;
    showDashboard('viewDashboardUmkmPayment');

  } else if (status === 'verifying') {
    const el = document.getElementById('verifyingUmkmName');
    if (el) el.textContent = user.warungName;
    showDashboard('viewDashboardUmkmVerifying');

  } else if (status === 'rejected') {
    const el = document.getElementById('rejectedUmkmName');
    if (el) el.textContent = user.warungName;
    showDashboard('viewDashboardUmkmRejected');

  } else if (status === 'active') {
    const welcomeEl = document.getElementById('dashUmkmWelcome');
    if (welcomeEl) welcomeEl.textContent = `${user.warungName} — ${user.paket}`;
    renderUmkmMenuList(user);
    renderUmkmIncomingReviews(user);
    showDashboard('viewDashboardUmkmActive');
  }
}

function renderUmkmMenuList(user) {
  const listEl = document.getElementById('umkmMenuList');
  if (!listEl) return;
  if (!user.menus || user.menus.length === 0) {
    listEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada menu warung. Tambahkan menu pertama Anda pada formulir di atas.</p>';
    return;
  }
  listEl.innerHTML = user.menus.map(m => `
    <div class="dash-menu-item">
      <div>
        <span class="dash-menu-name">${m.name}</span>
        <span class="dash-menu-portion">${m.portion || ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="dash-menu-price">${formatIDR(m.price)}</span>
        <button class="btn-icon-danger" onclick="window.deleteUmkmMenu(${m.id})" title="Hapus Menu">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderUmkmIncomingReviews(user) {
  const reviewsEl = document.getElementById('umkmReviewsList');
  if (!reviewsEl) return;
  const allReviews = LS.getReviews();
  const spotId = user.linkedCulinaryId ? String(user.linkedCulinaryId) : String(user.id);
  const reviews = allReviews[spotId] || [];

  if (reviews.length === 0) {
    reviewsEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada ulasan baru dari mahasiswa untuk warung Anda.</p>';
    return;
  }

  reviewsEl.innerHTML = reviews.map(r => `
    <div class="dash-review-card">
      <div class="dash-review-top">
        <span style="font-weight:800;color:var(--primary-900);">${r.name}</span>
        <span class="dash-review-date">${r.date}</span>
      </div>
      <div class="dash-review-badges">
        <span style="color:var(--gold-500);font-size:0.85rem;">${'<i class="fa-solid fa-star"></i>'.repeat(r.rating)}</span>
        <span style="background:var(--success-100);color:var(--success-700);font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:var(--radius-full);">Kenyang: ${r.kenyang}/5</span>
      </div>
      <p class="dash-review-comment">"${r.comment}"</p>
    </div>
  `).join('');
}

window.deleteUmkmMenu = function (menuId) {
  const session = LS.getSession();
  if (!session || session.role !== 'umkm') return;
  const users = LS.getUmkm();
  const idx = users.findIndex(u => u.id === session.id);
  if (idx === -1) return;
  users[idx].menus = users[idx].menus.filter(m => m.id !== menuId);
  LS.setUmkm(users);
  renderUmkmMenuList(users[idx]);
  renderCulinaryGrid(); // Sync to public catalogue
  showToast('Menu berhasil dihapus.');
};

// ============================================================
// DASHBOARD: ADMIN
// ============================================================
function renderAdminDashboard() {
  const tableEl = document.getElementById('adminUmkmTable');
  const statsEl = document.getElementById('adminStatsContainer');
  const reviewsTableEl = document.getElementById('adminReviewsTable');
  const users = LS.getUmkm();
  const culinaryList = getAllCulinaryData();

  // 1. Stats Grid
  if (statsEl) {
    const total = users.length;
    const pending = users.filter(u => u.status === 'pending').length;
    const payment = users.filter(u => u.status === 'awaiting_payment' || u.status === 'verifying').length;
    const active = users.filter(u => u.status === 'active').length;

    statsEl.innerHTML = `
      <div class="admin-stat-card">
        <div class="admin-stat-icon total"><i class="fa-solid fa-store"></i></div>
        <div>
          <div class="admin-stat-val">${total}</div>
          <div class="admin-stat-label">Total Pendaftar</div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon pending"><i class="fa-solid fa-clock"></i></div>
        <div>
          <div class="admin-stat-val">${pending}</div>
          <div class="admin-stat-label">Menunggu Review</div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon payment"><i class="fa-solid fa-wallet"></i></div>
        <div>
          <div class="admin-stat-val">${payment}</div>
          <div class="admin-stat-label">Menunggu Bayar</div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon active"><i class="fa-solid fa-circle-check"></i></div>
        <div>
          <div class="admin-stat-val">${active}</div>
          <div class="admin-stat-label">Mitra Aktif Publik</div>
        </div>
      </div>
    `;
  }

  // 2. UMKM Table
  if (tableEl) {
    if (users.length === 0) {
      tableEl.innerHTML = '<p style="color:var(--neutral-500);padding:16px;">Belum ada pendaftar UMKM.</p>';
    } else {
      const statusLabel = {
        pending: '<span class="status-badge status-pending">Pending Review</span>',
        awaiting_payment: '<span class="status-badge status-payment">Menunggu Bayar</span>',
        verifying: '<span class="status-badge status-verifying">Verifikasi Bayar</span>',
        active: '<span class="status-badge status-active">Mitra Aktif</span>',
        rejected: '<span class="status-badge status-rejected">Ditolak</span>'
      };

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
            ${users.map(u => `
              <tr>
                <td>
                  <div style="font-weight:800;color:var(--neutral-900);">${u.warungName}</div>
                  <div style="font-size:0.75rem;color:var(--neutral-500);margin-top:2px;">
                    <span style="font-weight:600;">${u.id}</span> • ${u.email}
                  </div>
                  <div style="font-size:0.75rem;color:var(--neutral-400);margin-top:2px;">
                    <i class="fa-solid fa-location-dot"></i> ${u.alamat}
                  </div>
                </td>
                <td>
                  <div style="font-weight:700;">${u.ownerName}</div>
                  <a href="https://wa.me/62${u.whatsapp.replace(/^0/, '')}" target="_blank" style="font-size:0.8rem;color:var(--success-600);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:2px;">
                    <i class="fa-brands fa-whatsapp"></i> ${u.whatsapp}
                  </a>
                </td>
                <td>
                  <div style="font-weight:700;color:var(--primary-900);">${u.paket}</div>
                  <div style="font-weight:800;color:var(--accent-600);font-size:0.9rem;">${formatIDR(u.paketPrice)}</div>
                </td>
                <td>${statusLabel[u.status] || u.status}</td>
                <td class="admin-actions-cell">
                  ${u.status === 'pending' ? `
                    <button class="btn btn-primary btn-xs" onclick="window.adminApproveUmkm('${u.id}')" title="Setujui pendaftaran dan minta bukti transfer">
                      <i class="fa-solid fa-check"></i> Setujui
                    </button>
                    <button class="btn btn-outline btn-xs" onclick="window.adminRejectUmkm('${u.id}')" style="color:#dc2626;border-color:#dc2626;" title="Tolak pendaftaran">
                      <i class="fa-solid fa-times"></i> Tolak
                    </button>
                  ` : ''}
                  ${u.status === 'awaiting_payment' || u.status === 'verifying' ? `
                    <button class="btn btn-accent btn-xs" onclick="window.adminActivateUmkm('${u.id}')" title="Konfirmasi bukti bayar dan aktifkan warung ke publik">
                      <i class="fa-solid fa-bolt"></i> Konfirmasi &amp; Aktifkan
                    </button>
                  ` : ''}
                  ${u.status === 'active' ? `<span style="color:var(--success-600);font-size:0.82rem;font-weight:800;"><i class="fa-solid fa-circle-check"></i> Tayang Publik</span>` : ''}
                  ${u.status === 'rejected' ? `<span style="color:var(--neutral-400);font-size:0.82rem;">Ditolak</span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // 3. Admin Reviews Moderation Table
  if (reviewsTableEl) {
    const allReviews = LS.getReviews();
    const flattened = [];
    Object.entries(allReviews).forEach(([spotId, reviews]) => {
      reviews.forEach((r, idx) => {
        const warung = culinaryList.find(c => String(c.id) === String(spotId));
        flattened.push({
          ...r,
          spotId,
          reviewIdx: idx,
          warungName: warung ? warung.name : `Warung #${spotId}`
        });
      });
    });

    if (flattened.length === 0) {
      reviewsTableEl.innerHTML = '<p style="color:var(--neutral-400);font-size:0.85rem;padding:12px;">Belum ada ulasan baru dari mahasiswa yang perlu dimoderasi.</p>';
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
            ${flattened.map(r => `
              <tr>
                <td style="font-weight:700;color:var(--primary-900);white-space:nowrap;">${r.warungName}</td>
                <td>
                  <div style="font-weight:700;">${r.name}</div>
                  <div style="color:var(--gold-500);font-size:0.75rem;">${'<i class="fa-solid fa-star"></i>'.repeat(r.rating)} (Kenyang ${r.kenyang}/5)</div>
                  <div style="font-size:0.7rem;color:var(--neutral-400);">${r.date}</div>
                </td>
                <td style="font-size:0.85rem;color:var(--neutral-700);max-width:300px;">"${r.comment}"</td>
                <td>
                  <button class="btn btn-outline btn-xs" style="color:#dc2626;border-color:#dc2626;" onclick="window.adminDeleteReview('${r.spotId}', ${r.reviewIdx})">
                    <i class="fa-solid fa-trash-can"></i> Hapus Ulasan
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

window.adminApproveUmkm = function (id) {
  const users = LS.getUmkm();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;
  users[idx].status = 'awaiting_payment';
  LS.setUmkm(users);
  renderAdminDashboard();
  showToast(`UMKM "${users[idx].warungName}" disetujui. Menunggu bukti transfer.`);
};

window.adminRejectUmkm = function (id) {
  const users = LS.getUmkm();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;
  users[idx].status = 'rejected';
  LS.setUmkm(users);
  renderAdminDashboard();
  showToast(`Pendaftaran "${users[idx].warungName}" ditolak.`);
};

window.adminActivateUmkm = function (id) {
  const users = LS.getUmkm();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;
  users[idx].status = 'active';
  LS.setUmkm(users);
  renderAdminDashboard();

  // Real-time synchronization to public catalogue and campus map!
  renderCulinaryGrid();
  renderRadarMapPins();

  showToast(`Pembayaran diverifikasi! Warung "${users[idx].warungName}" kini resmi AKTIF dan tampil di website publik Muyang!`);
};

window.adminDeleteReview = function (spotId, reviewIdx) {
  const reviews = LS.getReviews();
  if (!reviews[spotId]) return;

  const deleted = reviews[spotId].splice(reviewIdx, 1);
  LS.setReviews(reviews);

  renderAdminDashboard();
  renderCulinaryGrid();
  showToast('Ulasan berhasil dimoderasi dan dihapus dari platform.');
};

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
  plannerBudget: 25000
};

function getBookmarksForCurrentUser() {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') return [];
  const users = LS.getMhs();
  const user = users.find(u => u.nim === session.nim);
  return user ? user.bookmarks : [];
}

function filterCulinaryData() {
  const allData = getAllCulinaryData();
  return allData.filter(item => {
    const query = state.searchQuery.toLowerCase().trim();
    const matchSearch = !query ||
      item.name.toLowerCase().includes(query) ||
      item.categoryLabel.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
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

  const bookmarks = getBookmarksForCurrentUser();

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
    const isBookmarked = bookmarks.some(b => String(b) === String(item.id));
    return `
      <article class="culinary-card" data-id="${item.id}">
        <div class="card-img-wrapper">
          <img src="${item.image}" alt="${item.name}" class="card-img" loading="lazy" />
          <div class="card-top-badges">
            ${item.isFeatured ? '<span class="badge-featured"><i class="fa-solid fa-fire"></i> Featured UMKM</span>' : '<span class="badge-featured" style="background:#0284c7;"><i class="fa-solid fa-store"></i> Mitra Aktif</span>'}
            <span class="badge-distance"><i class="fa-solid fa-person-walking"></i> ${item.distance}</span>
          </div>
          <div class="card-bottom-badges">
            <span class="badge-kenyang-score" title="Kenyang Meter Score: Berdasarkan survei porsi piring makan mahasiswa UNEJ">
              <i class="fa-solid fa-bowl-food"></i> Kenyang ${item.kenyangScore}/10
            </span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-category-row">
            <span class="card-category-label">${item.categoryLabel}</span>
            <div class="card-rating">
              <i class="fa-solid fa-star"></i>
              <span>${item.rating}</span>
              <span style="color: var(--neutral-400); font-weight: 500;">(${item.reviewsCount})</span>
            </div>
          </div>

          <h3 class="card-title">${item.name}</h3>
          
          <p class="card-location">
            <i class="fa-solid fa-location-dot"></i>
            <span>${item.location}</span>
          </p>

          <div class="card-price-box">
            <div>
              <div class="price-label">Mulai Dari</div>
              <div class="price-val">${formatIDR(item.minPrice)}</div>
            </div>
            <div style="text-align: right;">
              <div class="price-label">Porsi Termurah</div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-600);">${item.popularMenus[0]?.name.substring(0, 24)}...</div>
            </div>
          </div>

          <div class="card-features-list">
            ${item.features.slice(0, 3).map(feat => `
              <span class="feature-tag"><i class="fa-solid fa-check"></i> ${feat}</span>
            `).join('')}
          </div>

          <div class="card-footer">
            <button class="btn-card-detail view-detail-btn" data-id="${item.id}">
              <i class="fa-solid fa-book-open"></i> Lihat Menu &amp; Ulasan
            </button>
            <button class="btn btn-outline btn-sm bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${item.id}" title="${isBookmarked ? 'Hapus Simpanan' : 'Simpan Tempat Ini'}">
              <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  culinaryGrid.scrollTo({ left: 0, behavior: 'smooth' });

  document.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      window.openDetailModal(id);
    });
  });

  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      toggleBookmark(id);
    });
  });
}

function toggleBookmark(id) {
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') {
    showToast('Silakan masuk sebagai Mahasiswa untuk menyimpan tempat makan favorit!', 'error');
    openModal('loginModal');
    return;
  }
  const users = LS.getMhs();
  const idx = users.findIndex(u => u.nim === session.nim);
  if (idx === -1) return;
  const exists = users[idx].bookmarks.some(b => String(b) === String(id));
  if (exists) {
    users[idx].bookmarks = users[idx].bookmarks.filter(b => String(b) !== String(id));
    showToast('Warung dihapus dari simpanan.');
  } else {
    users[idx].bookmarks.push(id);
    showToast('Berhasil disimpan ke favorit anak kos!');
  }
  LS.setMhs(users);
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
// DETAIL MODAL & REVIEWS
// ============================================================
window.openDetailModal = function (id) {
  const allData = getAllCulinaryData();
  const item = allData.find(i => String(i.id) === String(id));
  const detailModal = document.getElementById('detailModal');
  const detailModalContent = document.getElementById('detailModalContent');
  if (!item || !detailModal || !detailModalContent) return;

  const userReviews = LS.getReviews();
  const extraReviews = userReviews[String(id)] || [];
  const allReviews = [...extraReviews, ...item.reviews];

  const session = LS.getSession();
  const isMahasiswa = session && session.role === 'mahasiswa';
  const mapsUrl = item.googleMapsUrl || `https://www.google.com/maps?q=${item.lat},${item.lng}`;
  const rawPhone = item.whatsapp || '081234567890';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const waMsg = encodeURIComponent(`Halo ${item.name}, saya mahasiswa UNEJ dari platform MUYANG. Mau tanya apakah warung buka dan menu hari ini masih tersedia? Terima kasih!`);
  const waUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

  detailModalContent.innerHTML = `
    <div style="position: relative; height: 220px; overflow: hidden; border-radius: var(--radius-xl) var(--radius-xl) 0 0;">
      <img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" />
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); color: #fff;">
        <span style="background: var(--accent-500); color: #fff; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: var(--radius-full); text-transform: uppercase;">
          ${item.categoryLabel}
        </span>
        <h2 style="font-size: 1.6rem; font-weight: 800; margin-top: 4px; line-height: 1.2;">${item.name}</h2>
        <div style="font-size: 0.85rem; color: #fdba74; display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <i class="fa-solid fa-location-dot"></i> ${item.location} (${item.distance})
        </div>
      </div>
    </div>

    <div class="modal-content-pad">
      <!-- Quick Info Ribbon -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: var(--bg-surface-soft); padding: 12px; border-radius: var(--radius-lg); margin-bottom: 20px; text-align: center;">
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Harga Mulai</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: var(--primary-900);">${formatIDR(item.minPrice)}</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Kenyang Score</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: var(--success-600);"><i class="fa-solid fa-bowl-food"></i> ${item.kenyangScore}/10</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: var(--neutral-500); font-weight: 700; text-transform: uppercase;">Jam Buka</div>
          <div style="font-size: 0.85rem; font-weight: 800; color: var(--neutral-800); margin-top: 2px;">${item.hours}</div>
        </div>
      </div>

      <!-- Action Buttons: Google Maps & WhatsApp Chat -->
      <div class="modal-action-grid">
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline" style="display:flex;align-items:center;justify-content:center;gap:8px;color:#1a73e8;border-color:#1a73e8;font-weight:700;text-decoration:none;">
          <i class="fa-solid fa-map-location-dot" style="color:#1a73e8;"></i> Rute Google Maps
        </a>
        <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-wa-chat" title="Chat via WhatsApp">
          <i class="fa-brands fa-whatsapp" style="font-size:1.15rem;"></i> Chat Warung (WA)
        </a>
      </div>

      <!-- Description -->
      <p style="font-size: 0.925rem; color: var(--neutral-700); line-height: 1.6; margin-bottom: 20px;">
        ${item.description}
      </p>

      <!-- Facilities -->
      <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900); margin-bottom: 10px;">
        <i class="fa-solid fa-circle-check" style="color: var(--accent-500);"></i> Fasilitas Ramah Mahasiswa
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
        ${item.features.map(f => `
          <span style="background: var(--neutral-100); border: 1px solid var(--neutral-300); padding: 5px 12px; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; color: var(--neutral-800);">
            <i class="fa-solid fa-check" style="color: var(--success-600);"></i> ${f}
          </span>
        `).join('')}
      </div>

      <!-- Menu List -->
      <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span><i class="fa-solid fa-utensils" style="color: var(--accent-500);"></i> Daftar Menu &amp; Harga Aktual</span>
        <span style="font-size: 0.75rem; color: var(--neutral-500); font-weight: 600;">Terverifikasi Tim Muyang</span>
      </h4>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px;">
        ${item.popularMenus.map(menu => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fff; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md);">
            <div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--neutral-900);">
                ${menu.name}
                ${menu.isBestSeller ? '<span style="background: var(--gold-100); color: var(--gold-600); font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;">Favorit Kos</span>' : ''}
              </div>
              <div style="font-size: 0.75rem; color: var(--neutral-500);">${menu.portion}</div>
            </div>
            <div style="font-size: 1.1rem; font-weight: 900; color: var(--primary-800);">${formatIDR(menu.price)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Student Reviews -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary-900);">
          <i class="fa-solid fa-comments" style="color: var(--accent-500);"></i> Ulasan Mahasiswa (${allReviews.length})
        </h4>
        ${isMahasiswa
      ? `<button class="btn btn-primary btn-sm open-review-form-btn" data-id="${item.id}"><i class="fa-solid fa-pen"></i> Tulis Ulasan</button>`
      : `<button class="btn btn-outline btn-sm" onclick="window.openLoginModal('mahasiswa')"><i class="fa-solid fa-lock"></i> Login untuk Ulasan</button>`
    }
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px;">
        ${allReviews.length === 0 ? '<p style="color:var(--neutral-400);font-size:0.85rem;">Belum ada ulasan. Jadilah mahasiswa pertama yang mengulas!</p>' : ''}
        ${allReviews.map(rev => `
          <div style="background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.9rem; font-weight: 800; color: var(--neutral-900);">${rev.name}</span>
              <span style="font-size: 0.75rem; color: var(--neutral-400);">${rev.date}</span>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <span style="color: var(--gold-500); font-size: 0.8rem;">
                ${'<i class="fa-solid fa-star"></i>'.repeat(rev.rating)}
              </span>
              <span style="background: var(--success-100); color: var(--success-600); font-size: 0.7rem; font-weight: 700; padding: 1px 8px; border-radius: var(--radius-full);">
                Kenyang: ${rev.kenyang}/5
              </span>
            </div>
            <p style="font-size: 0.85rem; color: var(--neutral-700); line-height: 1.5;">"${rev.comment}"</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  detailModal.classList.add('active');

  const reviewBtn = detailModalContent.querySelector('.open-review-form-btn');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      detailModal.classList.remove('active');
      openReviewModal(item.id, item.name);
    });
  }
};

// ============================================================
// REVIEW MODAL & ANTI-SPAM
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

function handleReviewSubmit(e) {
  e.preventDefault();
  const session = LS.getSession();
  if (!session || session.role !== 'mahasiswa') {
    showToast('Harus login sebagai mahasiswa untuk menulis ulasan.', 'error');
    return;
  }

  const spotId = document.getElementById('reviewSpotIdInput').value;
  const faculty = document.getElementById('reviewerFaculty').value.trim();
  const kenyang = parseInt(document.getElementById('reviewKenyangScore').value);
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();

  // Anti-spam validation: 1 NIM = 1 review per warung
  const users = LS.getMhs();
  const idx = users.findIndex(u => u.nim === session.nim);
  if (idx === -1) return;
  if (users[idx].reviewedSpots && users[idx].reviewedSpots.some(s => String(s) === String(spotId))) {
    showToast('Kamu sudah pernah memberi ulasan untuk tempat makan ini.', 'error');
    return;
  }

  const newReview = {
    id: Date.now(),
    nim: session.nim,
    name: `${session.nama} (${faculty})`,
    rating,
    kenyang,
    comment,
    date: 'Baru saja'
  };

  const reviews = LS.getReviews();
  if (!reviews[spotId]) reviews[spotId] = [];
  reviews[spotId].unshift(newReview);
  LS.setReviews(reviews);

  if (!users[idx].reviewedSpots) users[idx].reviewedSpots = [];
  users[idx].reviewedSpots.push(spotId);
  LS.setMhs(users);

  document.getElementById('reviewForm').reset();
  document.getElementById('reviewModal').classList.remove('active');
  showToast('Ulasan kamu berhasil diterbitkan! Terima kasih bantu sesama anak kos.');
  setTimeout(() => window.openDetailModal(spotId), 400);
}

// ============================================================
// RADAR MAP
// ============================================================
function renderRadarMapPins() {
  const radarPinsContainer = document.getElementById('radarPinsContainer');
  if (!radarPinsContainer) return;
  const allData = getAllCulinaryData();

  radarPinsContainer.innerHTML = allData.map(item => {
    const isSelected = String(item.id) === String(state.selectedSpotId);
    const isWithinBudget = item.minPrice <= state.maxBudget;
    return `
      <div class="culinary-map-pin ${isSelected ? 'active' : ''}" 
           style="left: ${item.coordinates.x}%; top: ${item.coordinates.y}%; opacity: ${isWithinBudget ? '1' : '0.45'};" 
           data-id="${item.id}"
           title="${item.name} (${formatIDR(item.minPrice)})">
        <div class="pin-bubble ${item.isFeatured ? 'featured' : ''}">
          <i class="fa-solid fa-utensils"></i>
          <span>${formatIDR(item.minPrice)}</span>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.culinary-map-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const id = pin.getAttribute('data-id');
      selectRadarSpot(id);
    });
  });
}

function selectRadarSpot(id) {
  state.selectedSpotId = id;
  renderRadarMapPins();
  const allData = getAllCulinaryData();
  const item = allData.find(i => String(i.id) === String(id));
  const radarDetailContainer = document.getElementById('radarDetailContainer');
  if (!item || !radarDetailContainer) return;

  const mapsUrl = item.googleMapsUrl || `https://www.google.com/maps?q=${item.lat},${item.lng}`;
  const rawPhone = item.whatsapp || '081234567890';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const waMsg = encodeURIComponent(`Halo ${item.name}, saya mahasiswa UNEJ dari platform MUYANG. Mau tanya apakah warung buka dan menu hari ini masih tersedia? Terima kasih!`);
  const waUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

  radarDetailContainer.innerHTML = `
    <div class="radar-spot-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <span class="card-category-label">${item.categoryLabel}</span>
        <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${item.kenyangScore}</span>
      </div>
      <h4 class="radar-spot-title">${item.name}</h4>
      <p class="card-location" style="margin-bottom: 8px;"><i class="fa-solid fa-location-dot"></i> ${item.location}</p>
      <p style="font-size: 0.85rem; color: var(--neutral-600); margin-bottom: 12px;">${item.description.substring(0, 100)}...</p>
      
      <div style="background: #fff; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--neutral-200); margin-bottom: 14px;">
        <div class="price-label">Harga Menu Favorit</div>
        <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-600);">Mulai ${formatIDR(item.minPrice)}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="color:#1a73e8;border-color:#1a73e8;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;text-decoration:none;">
          <i class="fa-solid fa-map-location-dot" style="color:#1a73e8;"></i> Rute Maps
        </a>
        <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-wa-chat btn-sm" style="display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;text-decoration:none;">
          <i class="fa-brands fa-whatsapp"></i> Chat WA
        </a>
      </div>

      <button class="btn btn-primary btn-sm" style="width: 100%;" data-id="${item.id}" id="radarDetailBtn">
        <i class="fa-solid fa-eye"></i> Menu Lengkap &amp; Ulasan
      </button>
    </div>
  `;

  document.getElementById('radarDetailBtn')?.addEventListener('click', () => window.openDetailModal(item.id));
}

function updateRadarMap() {
  renderRadarMapPins();
}

// ============================================================
// MEAL PLANNER
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
        <h5 class="meal-food-name">${plan.sarapan.food}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${plan.sarapan.place}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.sarapan.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.sarapan.kenyang}</span>
        </div>
      </div>
      <div class="meal-slot-card">
        <span class="meal-time-badge time-siang"><i class="fa-solid fa-sun"></i> 12:30 • Makan Siang</span>
        <h5 class="meal-food-name">${plan.siang.food}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${plan.siang.place}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.siang.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.siang.kenyang}</span>
        </div>
      </div>
      <div class="meal-slot-card">
        <span class="meal-time-badge time-malam"><i class="fa-solid fa-moon"></i> 19:00 • Makan Malam</span>
        <h5 class="meal-food-name">${plan.malam.food}</h5>
        <p class="meal-place-name"><i class="fa-solid fa-store"></i> ${plan.malam.place}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <span class="meal-price-tag">${formatIDR(plan.malam.price)}</span>
          <span class="badge-kenyang-score"><i class="fa-solid fa-bowl-food"></i> Kenyang ${plan.malam.kenyang}</span>
        </div>
      </div>
    `;
  }
}

// ============================================================
// ADMIN ACCESS TRIGGERS (3x CLICK & DIRECT LINK & URL PARAM)
// ============================================================
function initAdminSecretTrigger() {
  let clickCount = 0;
  let clickTimer = null;

  function handleAdminClick() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 1800);
    if (clickCount >= 3) {
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

  // Trigger 1: 3x click on footer brand icon
  document.getElementById('footerBrandIcon')?.addEventListener('click', handleAdminClick);
  // Trigger 2: 3x click on header logo
  document.getElementById('headerBrandLogo')?.addEventListener('click', handleAdminClick);

  // Trigger 3: Direct link in footer
  document.getElementById('footerAdminLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const session = LS.getSession();
    if (session && session.role === 'admin') {
      routeToDashboard();
    } else {
      openModal('adminLoginModal');
    }
  });

  // Trigger 4: URL query param ?admin=1
  if (new URLSearchParams(window.location.search).get('admin') === '1') {
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
document.addEventListener('DOMContentLoaded', () => {

  // 1. Seed demo data
  initSeedData();

  // 2. Navbar State
  updateNavbarState();

  // 3. Global Click Interceptor for all in-page '#' anchor links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Skip auth tab switch links and footer admin link
    if (link.id && (link.id.startsWith('switchTo') || link.id === 'footerAdminLink')) {
      return;
    }

    // Direct dashboard link
    if (href === '#dashboard') {
      e.preventDefault();
      routeToDashboard();
      return;
    }

    // In-page section anchor links (#katalog, #radar-map, #meal-planner, #kemitraan-umkm, #home)
    if (href.startsWith('#')) {
      e.preventDefault();
      navigateToSection(href);
    }
  });

  // 4. Global click listener to close user dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('navUserDropdown');
    if (dropdown && dropdown.classList.contains('open')) {
      if (!e.target.closest('.user-dropdown-wrap')) {
        dropdown.classList.remove('open');
      }
    }
  });

  // 5. Initial View Determination
  const currentHash = window.location.hash;
  if (currentHash === '#dashboard') {
    routeToDashboard();
  } else {
    showLanding();
    if (currentHash && currentHash !== '#home' && currentHash !== '#dashboard') {
      setTimeout(() => navigateToSection(currentHash), 100);
    }
  }

  // 6. Hero Slider
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

  // 7. Catalogue Filters
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

  // 8. Meal Planner
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

  // 9. Modal Close Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // 10. Auth Tab Switching (Login Modal)
  document.querySelectorAll('#loginModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#loginModal .auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('loginPanelMahasiswa').classList.toggle('active', target === 'mahasiswa');
      document.getElementById('loginPanelUmkm').classList.toggle('active', target === 'umkm');
    });
  });

  // 11. Auth Tab Switching (Register Modal)
  document.querySelectorAll('#registerModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('registerPanelMahasiswa').classList.toggle('active', target === 'mahasiswa');
      document.getElementById('registerPanelUmkm').classList.toggle('active', target === 'umkm');
    });
  });

  // 12. Switch Login <-> Register links
  document.getElementById('switchToRegisterMhs')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('registerModal');
    document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mahasiswa'));
    document.getElementById('registerPanelMahasiswa').classList.add('active');
    document.getElementById('registerPanelUmkm').classList.remove('active');
  });
  document.getElementById('switchToRegisterUmkm')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('registerModal');
    document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
    document.getElementById('registerPanelUmkm').classList.add('active');
    document.getElementById('registerPanelMahasiswa').classList.remove('active');
  });
  document.getElementById('switchToLoginMhs')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('loginModal');
  });
  document.getElementById('switchToLoginUmkm')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('loginModal');
    document.querySelectorAll('#loginModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
    document.getElementById('loginPanelUmkm').classList.add('active');
    document.getElementById('loginPanelMahasiswa').classList.remove('active');
  });

  // 13. Pricing section buttons to open UMKM register modal
  document.querySelectorAll('.open-register-umkm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('registerModal');
      document.querySelectorAll('#registerModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'umkm'));
      document.getElementById('registerPanelUmkm').classList.add('active');
      document.getElementById('registerPanelMahasiswa').classList.remove('active');
    });
  });

  // 14. Login Forms Submission
  document.getElementById('loginFormMahasiswa')?.addEventListener('submit', handleLoginMahasiswa);
  document.getElementById('loginFormUmkm')?.addEventListener('submit', handleLoginUmkm);
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleLoginAdmin);

  // 14.5 Quick-Login Demo Buttons (Tester Shortcuts)
  const triggerFormSubmit = (form) => {
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  };

  document.getElementById('btnQuickMhs')?.addEventListener('click', () => {
    const nimInput = document.getElementById('loginNim');
    const pwdInput = document.getElementById('loginPasswordMhs');
    if (nimInput && pwdInput) {
      nimInput.value = '242410102001';
      pwdInput.value = 'demo123';
      triggerFormSubmit(document.getElementById('loginFormMahasiswa'));
    }
  });

  document.getElementById('btnQuickUmkmActive')?.addEventListener('click', () => {
    const emailInput = document.getElementById('loginEmailUmkm');
    const pwdInput = document.getElementById('loginPasswordUmkm');
    if (emailInput && pwdInput) {
      emailInput.value = 'busiti@demo.id';
      pwdInput.value = 'demo123';
      triggerFormSubmit(document.getElementById('loginFormUmkm'));
    }
  });

  document.getElementById('btnQuickUmkmPending')?.addEventListener('click', () => {
    const emailInput = document.getElementById('loginEmailUmkm');
    const pwdInput = document.getElementById('loginPasswordUmkm');
    if (emailInput && pwdInput) {
      emailInput.value = 'pakbudi@demo.id';
      pwdInput.value = 'demo123';
      triggerFormSubmit(document.getElementById('loginFormUmkm'));
    }
  });

  document.getElementById('btnQuickUmkmPayment')?.addEventListener('click', () => {
    const emailInput = document.getElementById('loginEmailUmkm');
    const pwdInput = document.getElementById('loginPasswordUmkm');
    if (emailInput && pwdInput) {
      emailInput.value = 'mieayam@demo.id';
      pwdInput.value = 'demo123';
      triggerFormSubmit(document.getElementById('loginFormUmkm'));
    }
  });

  document.getElementById('btnQuickAdmin')?.addEventListener('click', () => {
    const userInput = document.getElementById('adminUsername');
    const pwdInput = document.getElementById('adminPassword');
    if (userInput && pwdInput) {
      userInput.value = ADMIN_CREDS.username;
      pwdInput.value = ADMIN_CREDS.password;
      triggerFormSubmit(document.getElementById('adminLoginForm'));
    }
  });

  // 15. Register Forms Submission
  document.getElementById('registerFormMahasiswa')?.addEventListener('submit', handleRegisterMahasiswa);
  document.getElementById('registerFormUmkm')?.addEventListener('submit', handleRegisterUmkm);

  // 16. Review Form Submission
  document.getElementById('reviewForm')?.addEventListener('submit', handleReviewSubmit);

  // 17. UMKM Active: Add Menu Form
  document.getElementById('addMenuForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const session = LS.getSession();
    if (!session || session.role !== 'umkm') return;
    const name = document.getElementById('menuNameInput').value.trim();
    const price = parseInt(document.getElementById('menuPriceInput').value);
    const portion = document.getElementById('menuPortionInput').value.trim();
    if (!name || !price) return;
    const users = LS.getUmkm();
    const idx = users.findIndex(u => u.id === session.id);
    if (idx === -1) return;
    const menuId = Date.now();
    users[idx].menus.push({ id: menuId, name, price, portion: portion || 'Porsi Standar' });
    LS.setUmkm(users);
    document.getElementById('addMenuForm').reset();
    renderUmkmMenuList(users[idx]);
    renderCulinaryGrid(); // Immediately update public catalogue
    showToast(`Menu "${name}" berhasil ditambahkan dan langsung tampil di katalog publik!`);
  });

  // 18. Mobile Menu Drawer Toggle
  const mobileToggleBtn = document.getElementById('mobileMenuToggle');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  mobileToggleBtn?.addEventListener('click', () => {
    mobileNavDrawer?.classList.toggle('active');
  });

  // 19. Admin Secret Triggers & Direct Access
  initAdminSecretTrigger();

  // 20. Initial Data Renders
  renderCulinaryGrid();
  renderRadarMapPins();
  selectRadarSpot(1);
  updateMealPlanner();

  // 21. Scroll-reveal entrance animation for sections
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    document.querySelectorAll('.section-reveal').forEach(el => {
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show all
    document.querySelectorAll('.section-reveal').forEach(el => el.classList.add('section-visible'));
  }

  console.log('MUYANG Web App v2.3 Loaded - Tim MUYANG');
});
