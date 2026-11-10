// Data Kuliner Sekitar Kampus Universitas Jember (UNEJ) untuk MUYANG
const CULINARY_DATA = [
  {
    id: 1,
    name: "Warteg Barokah Jaya",
    category: "warteg",
    categoryLabel: "Warteg & Prasmanan",
    location: "Jl. Jawa No. 24 (Dekat Pintu Masuk Belakang UNEJ)",
    area: "Jl. Jawa",
    lat: -8.1734,
    lng: 113.7198,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1734,113.7198",
    whatsapp: "081234567801",
    distance: "250m dari Kampus",
    priceRange: "Rp 6.000 - Rp 14.000",
    minPrice: 6000,
    maxPrice: 14000,
    avgPrice: 9000,
    rating: 4.8,
    reviewsCount: 142,
    kenyangScore: 9.6,
    isFeatured: true,
    promoBadge: "Promo Khusus Mahasiswa",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
    hours: "07.00 - 21.00 WIB",
    features: ["Nasi Ambil Sendiri", "Free Es Teh Tawar", "Pilihan Sayur 20+ Macam", "Parkir Luas"],
    description: "Favorit utama anak kos UNEJ! Nasi bisa ambil sepuasnya, aneka sayur oseng, tempe orek, telur balado, dan ayam suwir dengan harga yang super ramah di kantong.",
    popularMenus: [
      { name: "Paket Nasi + Tempe Orek + Sayur Lodeh", price: 7000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Paket Nasi + Telur Dadar Tebal + Sayur Sop", price: 9000, isBestSeller: true, portion: "Porsi Jumbo" },
      { name: "Paket Nasi + Ayam Goreng Bumbu Lengkuas + Sambal", price: 13000, isBestSeller: false, portion: "Porsi Sultan Kos" },
      { name: "Tempe Mendoan Hangat (per biji)", price: 1500, isBestSeller: false, portion: "Camilan" }
    ],
    reviews: [
      { name: "Dimas Anggara (Fasilkom '23)", rating: 5, kenyang: 5, comment: "Penyelamat tanggal tua! Cuma bayar 7 ribu udah dapet nasi segunung sama tempe orek + sayur. Sambelnya mantul abis.", date: "2 hari lalu" },
      { name: "Siti Nurhaliza (FEB '24)", rating: 5, kenyang: 5, comment: "Ibu wartegnya ramah banget ke maba. Tempatnya bersih dan es tehnya gratis refill!", date: "1 minggu lalu" }
    ],
    coordinates: { x: 38, y: 45 } // Visual map coordinates (%)
  },
  {
    id: 2,
    name: "Lalapan & Geprek Barokah Mas Bro",
    category: "ayam",
    categoryLabel: "Ayam & Bebek",
    location: "Jl. Kalimantan No. 48 (Depan Asrama Mahasiswa UNEJ)",
    area: "Jl. Kalimantan",
    lat: -8.1698,
    lng: 113.7221,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1698,113.7221",
    whatsapp: "081234567802",
    distance: "150m dari Bundaran UNEJ",
    priceRange: "Rp 10.000 - Rp 16.000",
    minPrice: 10000,
    maxPrice: 16000,
    avgPrice: 12000,
    rating: 4.9,
    reviewsCount: 218,
    kenyangScore: 9.8,
    isFeatured: true,
    promoBadge: "Top Choice UNEJ",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
    hours: "09.30 - 22.00 WIB",
    features: ["Level Pedas 0 - 20", "Free Lalapan Segar", "Nasi Bisa Tambah", "WiFi Kencang"],
    description: "Ayam geprek krispi dengan sambal bawang ulek dadakan. Mahasiswa bisa pilih cabe sesuka hati. Nasi porsi jumbo dijamin bikin kenyang seharian.",
    popularMenus: [
      { name: "Paket Geprek Nasi + Es Teh Manis", price: 11000, isBestSeller: true, portion: "Porsi Jumbo" },
      { name: "Geprek Keju Lumer + Nasi", price: 14000, isBestSeller: false, portion: "Porsi Kenyang" },
      { name: "Lalapan Lele Goreng Krispi + Sambal Terasi", price: 10000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Tahu & Tempe Geprek Sambal Korek", price: 6000, isBestSeller: false, portion: "Hemat Banget" }
    ],
    reviews: [
      { name: "Rizky Ramadhan (Teknik '22)", rating: 5, kenyang: 5, comment: "Ayamnya gede, tepungnya gak pelit, dan sambel koreknya juara. 11 ribu dapet nasi + es teh manis dingin!", date: "Kemarin" },
      { name: "Anisa Putri (FKIP '24)", rating: 5, kenyang: 4, comment: "Pas banget buat anak kos deket Kalimantan. Tempatnya asyik buat makan siang bareng temen sekelas.", date: "4 hari lalu" }
    ],
    coordinates: { x: 50, y: 35 }
  },
  {
    id: 3,
    name: "Pojok Indomie & Warmindo Sahabat Kos",
    category: "mie",
    categoryLabel: "Mie & Bakso",
    location: "Jl. Mastrip Timur No. 12 (Belakang Fakultas Kedokteran Gigi)",
    area: "Jl. Mastrip",
    lat: -8.1756,
    lng: 113.7244,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1756,113.7244",
    whatsapp: "081234567803",
    distance: "400m dari Kampus",
    priceRange: "Rp 5.000 - Rp 11.000",
    minPrice: 5000,
    maxPrice: 11000,
    avgPrice: 7500,
    rating: 4.7,
    reviewsCount: 185,
    kenyangScore: 9.2,
    isFeatured: false,
    promoBadge: "Buka 24 Jam",
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80",
    hours: "24 Jam Nonstop",
    features: ["Buka 24 Jam", "Banyak Colokan", "Free WiFi", "Nobar Bola"],
    description: "Tempat nongkrong sekaligus penyelamat kelaparan tengah malam anak kos. Menyajikan Indomie rebus/goreng dengan topping telur, kornet, sayur sawi segar, dan racikan bumbu spesial.",
    popularMenus: [
      { name: "Indomie Polos Single Rebus / Goreng", price: 5000, isBestSeller: false, portion: "Porsi Standar" },
      { name: "Indomie Dobel Goreng + Telur Setengah Matang", price: 9000, isBestSeller: true, portion: "Porsi Ganda Kenyang" },
      { name: "Magelangan (Mie + Nasi Goreng Jawa)", price: 10000, isBestSeller: true, portion: "Porsi Kuli" },
      { name: "Kopi Hitam Tubruk / Good Day Freeze", price: 3500, isBestSeller: false, portion: "Minuman" }
    ],
    reviews: [
      { name: "Bagus Setiawan (Fasilkom '21)", rating: 5, kenyang: 5, comment: "Langganan begadang pas ngerjain tugas akhir. Magelangan 10 ribu porsinya kuli banget, kenyang sampe pagi!", date: "3 hari lalu" }
    ],
    coordinates: { x: 62, y: 60 }
  },
  {
    id: 4,
    name: "Nasi Pecel & Tahu Lontong Mbok Darmi",
    category: "nasi",
    categoryLabel: "Nasi & Lauk Kenyang",
    location: "Jl. Riau No. 18 (Dekat Fasilkom & FIB)",
    area: "Jl. Riau",
    lat: -8.1671,
    lng: 113.7189,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1671,113.7189",
    whatsapp: "081234567804",
    distance: "300m dari Fasilkom UNEJ",
    priceRange: "Rp 7.000 - Rp 13.000",
    minPrice: 7000,
    maxPrice: 13000,
    avgPrice: 8500,
    rating: 4.8,
    reviewsCount: 97,
    kenyangScore: 9.4,
    isFeatured: false,
    promoBadge: "Sarapan Favorit",
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80",
    hours: "06.00 - 14.00 WIB",
    features: ["Bumbu Kacang Kental Khas Jember", "Peyek Kacang Renyah", "Sayur Segar", "Cocok Buat Sarapan"],
    description: "Pilihan sarapan terfavorit mahasiswa sebelum masuk kuliah pagi. Bumbu kacangnya manis gurih mantap dengan peyek kacang renyah dan aneka lauk tempe bacem atau telur puyuh.",
    popularMenus: [
      { name: "Nasi Pecel Sayur Lengkap + Peyek Krispi", price: 7000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Nasi Pecel + Telur Asin Masir", price: 10000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Tahu Telur Bumbu Petis Khas Jember", price: 10000, isBestSeller: false, portion: "Porsi Mantap" },
      { name: "Sate Puyuh / Tempe Bacem", price: 2000, isBestSeller: false, portion: "Lauk Tambahan" }
    ],
    reviews: [
      { name: "Farhan Maulana (Hukum '23)", rating: 5, kenyang: 5, comment: "Bumbu pecelnya otentik banget! Cuma 7 ribu kenyang buat ganjel perut sebelum kuliah jam 7 pagi.", date: "5 hari lalu" }
    ],
    coordinates: { x: 30, y: 25 }
  },
  {
    id: 5,
    name: "Depot Nasi Goreng & Bakmi Mas Gareng",
    category: "nasi",
    categoryLabel: "Nasi & Lauk Kenyang",
    location: "Jl. Danau Toba No. 9 (Depan Gang Kos Putri Melati)",
    area: "Jl. Danau Toba",
    lat: -8.1712,
    lng: 113.7258,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1712,113.7258",
    whatsapp: "081234567805",
    distance: "500m dari Kampus",
    priceRange: "Rp 10.000 - Rp 15.000",
    minPrice: 10000,
    maxPrice: 15000,
    avgPrice: 11000,
    rating: 4.9,
    reviewsCount: 164,
    kenyangScore: 9.7,
    isFeatured: true,
    promoBadge: "Porsi Jumbo",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80",
    hours: "17.00 - 23.30 WIB",
    features: ["Porsi Piring Meluap", "Aroma Wok Hei Kuat", "Acar & Kerupuk Bebas Ambil", "Halal"],
    description: "Nasi goreng porsi kuli legendaris di kalangan anak kos Danau Toba. Dimasak menggunakan wajan baja panas dengan bumbu rempah medok, suwiran ayam, bakso, dan telur orak-arik.",
    popularMenus: [
      { name: "Nasi Goreng Mawut Spesial Telur", price: 10000, isBestSeller: true, portion: "Porsi Meluap" },
      { name: "Mie Goreng Jawa Bumbu Medok", price: 10000, isBestSeller: true, portion: "Porsi Jumbo" },
      { name: "Nasi Goreng Babat / Sosis Dobel", price: 13000, isBestSeller: false, portion: "Porsi Sultan" },
      { name: "Capcay Kuah Hangat", price: 11000, isBestSeller: false, portion: "Sehat Kenyang" }
    ],
    reviews: [
      { name: "Wahyu Pratama (Fasilkom '24)", rating: 5, kenyang: 5, comment: "10 ribu dapet nasgor sepiring meluap! Kalo bungkus bisa buat makan berdua sama temen kos. Enak banget parah.", date: "Kemarin malam" }
    ],
    coordinates: { x: 75, y: 70 }
  },
  {
    id: 6,
    name: "Bakso & Mie Ayam Urat 'Arema Kampus'",
    category: "mie",
    categoryLabel: "Mie & Bakso",
    location: "Jl. Karimata No. 35 (Samping Fotocopy Pelangi)",
    area: "Jl. Karimata",
    lat: -8.1745,
    lng: 113.7175,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1745,113.7175",
    whatsapp: "081234567806",
    distance: "350m dari UNEJ",
    priceRange: "Rp 8.000 - Rp 14.000",
    minPrice: 8000,
    maxPrice: 14000,
    avgPrice: 10000,
    rating: 4.7,
    reviewsCount: 130,
    kenyangScore: 9.3,
    isFeatured: false,
    promoBadge: "Kuah Kaldu Gurih",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
    hours: "10.00 - 21.00 WIB",
    features: ["Pangsit Goreng Renyah", "Tetelan Sapi Gurih", "Kuah Kaldu Asli", "Es Jeruk Segar"],
    description: "Mie ayam kuah kental dengan topping ayam bumbu cokelat manis gurih, ditambah bakso urat kenyal dan pangsit goreng mekar.",
    popularMenus: [
      { name: "Mie Ayam Pangsit Gurih", price: 8000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Mie Ayam + Bakso Urat Jumbo", price: 12000, isBestSeller: true, portion: "Porsi Jumbo" },
      { name: "Bakso Campur Urat & Tahu Bakso", price: 11000, isBestSeller: false, portion: "Porsi Kenyang" },
      { name: "Es Jeruk Peras Alami", price: 3000, isBestSeller: false, portion: "Segar" }
    ],
    reviews: [
      { name: "Dinda Kartika (Farmasi '23)", rating: 5, kenyang: 5, comment: "Mie ayamnya legit bgt, 8 ribu udah kenyang pol! Kuahnya wangi rempah kaldu sapi asli.", date: "3 hari lalu" }
    ],
    coordinates: { x: 55, y: 80 }
  },
  {
    id: 7,
    name: "Soto Ayam Kampung Cak Dul Lamongan",
    category: "nasi",
    categoryLabel: "Nasi & Lauk Kenyang",
    location: "Jl. Kalimantan No. 89 (Dekat Gedung Soetardjo UNEJ)",
    area: "Jl. Kalimantan",
    lat: -8.1685,
    lng: 113.7205,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1685,113.7205",
    whatsapp: "081234567807",
    distance: "200m dari UNEJ",
    priceRange: "Rp 9.000 - Rp 13.000",
    minPrice: 9000,
    maxPrice: 13000,
    avgPrice: 10000,
    rating: 4.8,
    reviewsCount: 112,
    kenyangScore: 9.4,
    isFeatured: false,
    promoBadge: "Koya Bebas Ambil",
    image: "https://images.unsplash.com/photo-1572656631137-7935297eff55?auto=format&fit=crop&w=800&q=80",
    hours: "06.30 - 20.00 WIB",
    features: ["Bubuk Koya Gurih Ambil Bebas", "Jeruk Nipis Segar", "Ayam Suwir Melimpah", "Pelayanan Cepat"],
    description: "Soto ayam berkuah kuning bening gurih bertabur koya kelapa udang sepuasnya. Kuah panasnya sangat melegakan tenggorokan setelah seharian praktikum di kampus.",
    popularMenus: [
      { name: "Soto Ayam Campur Nasi + Koya Sepuasnya", price: 9000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Soto Ayam Pisah Nasi Jumbo", price: 12000, isBestSeller: false, portion: "Porsi Kenyang" },
      { name: "Sate Ati Ampela Bumbu Kuning", price: 2500, isBestSeller: false, portion: "Pelengkap" }
    ],
    reviews: [
      { name: "M. Irfan (Fasilkom '24)", rating: 5, kenyang: 5, comment: "Koyanya melimpah bisa ambil sendiri, kuah sotonya seger banget. 9 ribu udah kenyang!", date: "6 hari lalu" }
    ],
    coordinates: { x: 42, y: 30 }
  },
  {
    id: 8,
    name: "Lalapan Tahu Tempe & Telur Penyet Bu Siti",
    category: "hiddengem",
    categoryLabel: "Hidden Gem Kos",
    location: "Gang Buntu Jl. Jawa VII No. 3 (Dalam Gang Kosan)",
    area: "Jl. Jawa",
    lat: -8.1725,
    lng: 113.7190,
    googleMapsUrl: "https://www.google.com/maps?q=-8.1725,113.7190",
    whatsapp: "081234567890",
    distance: "180m dari Kampus",
    priceRange: "Rp 5.000 - Rp 10.000",
    minPrice: 5000,
    maxPrice: 10000,
    avgPrice: 7000,
    rating: 4.9,
    reviewsCount: 95,
    kenyangScore: 9.7,
    isFeatured: true,
    promoBadge: "Hidden Gem Murah Pol",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
    hours: "11.00 - 20.30 WIB",
    features: ["Sambal Terasi Tomat Juara", "Nasi Hangat Pulen", "Harga Pelajar", "Lalapan Daun Kemangi"],
    description: "Hidden gem sejati di dalam gang Jl. Jawa! Tempatnya sederhana tapi antrean anak kos selalu ramai karena cuma 8 ribu sudah dapet tempe goreng tepung renyah + telur dadar + nasi banyak.",
    popularMenus: [
      { name: "Nasi + Tempe Goreng Tepung Crispy + Sambal", price: 5000, isBestSeller: true, portion: "Paling Hemat" },
      { name: "Nasi + Tahu Tempe Penyet + Terong Goreng", price: 7000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Nasi + Telur Penyet Sambal Bajak Pedas", price: 8000, isBestSeller: true, portion: "Porsi Kenyang" },
      { name: "Es Teh Manis Jumbo", price: 2500, isBestSeller: false, portion: "Minuman" }
    ],
    reviews: [
      { name: "Nafariel Dwi (Fasilkom '24)", rating: 5, kenyang: 5, comment: "Rahasia anak kos akhir bulan! 5-8 ribu udah makan enak dan kenyang sampe sore. Sambel Bu Siti gak ada tandingannya.", date: "1 hari lalu" }
    ],
    coordinates: { x: 33, y: 52 }
  }
];

// Data Analisis Pitch Deck Muyang
const PITCH_DECK_DATA = {
  title: "MUYANG (Murah Kenyang)",
  institution: "Universitas Jember",
  cohort: "Kelompok 6 - DIGITAL SOLUTIONS / DIGITAL BUSINESS MODEL",
  team: [
    {
      name: "Fressy Ravalino Firmansyah",
      nim: "242410102096",
      role: "Project Lead & Fullstack Developer",
      avatarBg: "from-amber-600 to-orange-700"
    },
    {
      name: "Maulana Irfanhaqi",
      nim: "242410102042",
      role: "Business Strategist & UI/UX Designer",
      avatarBg: "from-red-600 to-rose-800"
    },
    {
      name: "Nafariel Dwi Ambariyono",
      nim: "242410102071",
      role: "Market Researcher & Partnership Lead",
      avatarBg: "from-orange-600 to-amber-700"
    }
  ],
  problem: {
    condition: "Mahasiswa baru & anak kos di sekitar Universitas Jember sering kesulitan menemukan makanan enak dengan harga sesuai budget harian. Informasi menu, harga, lokasi, dan jam buka tersebar di berbagai tempat dan tidak selalu diperbarui.",
    umkmCondition: "Banyak UMKM kuliner lokal punya produk lezat & terjangkau, tetapi kurang terlihat secara digital dan kalah pamor dari gerai franchise besar.",
    impactMahasiswa: "Mahasiswa menghabiskan waktu dan uang untuk mencoba-coba tempat makan (boncos), atau akhirnya hanya makan di tempat yang itu-itu saja karena takut mahal.",
    impactUmkm: "UMKM kehilangan potensi pelanggan baru mahasiswa setiap pergantian semester dan sulit bersaing secara digital tanpa biaya iklan mahal."
  },
  valueProposition: {
    customerJobs: "Mencari tempat makan harian sesuai budget saku, eksplorasi kuliner baru dekat kos/kampus, makan kenyang hemat gizi terjaga.",
    pains: "Sulit nemu hidden gem terjangkau, maba belum kenal denah sekitar kampus, ulasan maps sering tidak mencantumkan harga riil, menu usang.",
    gains: "Mudah nemu makanan hemat, info harga aktual terpusat, ulasan jujur porsi kenyang sesama mahasiswa, kepastian jam buka.",
    painRelievers: "Pencarian filter budget nominal, peta interaktif kampus UNEJ, profil warung lengkap aktual.",
    gainCreators: "Kalkulator budget harian, porsi kenyang terjamin lewat badge 'Kenyang Score', promo diskon UMKM terverifikasi."
  },
  productSolutionFit: [
    {
      problem: "Sulit menemukan makanan enak yang sesuai budget",
      solution: "Pencarian berdasarkan harga nominal transparan",
      feature: "Filter Budget & Rentang Harga Interaktif",
      icon: "fa-wallet"
    },
    {
      problem: "Info menu, harga, lokasi, dan jam buka tersebar",
      solution: "Semua informasi dalam satu tempat terpadu",
      feature: "Profil Tempat Makan & Katalog Menu Terpadu",
      icon: "fa-book-open"
    },
    {
      problem: "Mahasiswa baru belum mengenal area kampus",
      solution: "Eksplorasi kuliner sekitar kampus berbasis radius",
      feature: "Pencarian dan Peta Kuliner Kampus UNEJ",
      icon: "fa-map-location-dot"
    },
    {
      problem: "Minim rekomendasi dan ulasan yang bisa dipercaya",
      solution: "Ulasan jujur & Kenyang Meter dari sesama mahasiswa",
      feature: "Rating, Review, & Kenyang Meter Score",
      icon: "fa-star-half-stroke"
    },
    {
      problem: "UMKM kuliner kurang terlihat secara digital",
      solution: "Visibilitas tinggi dan jangkauan pelanggan mahasiswa",
      feature: "Featured Listing & Promosi Berbayar Terjangkau",
      icon: "fa-bullhorn"
    }
  ],
  marketSize: {
    assumptions: {
      totalUmkm: 200,
      featuredPricePerMonth: 50000,
      totalStudentsUnej: 38995,
      fasilkomStudents: 1362,
      fasilkomAdoptionRange: "70% → 20% (±953 → ±190 mahasiswa)"
    },
    tam: {
      name: "TAM (Total Addressable Market)",
      calc: "200 UMKM × Rp 50.000 × 12 bulan",
      value: 120000000,
      display: "Rp 120 Juta / tahun",
      desc: "Potensi maksimal jika seluruh 200 UMKM kuliner di sekitar kampus UNEJ berlangganan featured listing Muyang."
    },
    sam: {
      name: "SAM (Serviceable Addressable Market)",
      calc: "Asumsi 40% UMKM aktif medsos = 80 UMKM × Rp 50.000 × 12 bulan",
      value: 48000000,
      display: "Rp 48 Juta / tahun",
      desc: "UMKM sekitar kampus yang aktif digital, sadar promosi, dan punya smartphone untuk mengelola pesanan & promo."
    },
    som: {
      name: "SOM (Serviceable Obtainable Market)",
      calc: "Target awal 20 UMKM featured listing: 20 × Rp 50.000 × 12",
      value: 12000000,
      display: "Rp 12 Juta / tahun",
      monthly: "Rp 1.000.000 / bulan",
      desc: "Target realistis tahap validasi awal peluncuran Muyang di tahun pertama pada kantong-kantong kos strategis UNEJ."
    }
  },
  competitorAnalysis: [
    {
      criteria: "Filter budget nominal (Cari makanan < Rp 10rb)",
      muyang: "full",
      gmaps: "partial",
      deliveryApps: "partial",
      socialMedia: "none",
      friends: "partial"
    },
    {
      criteria: "Info menu, harga aktual & jam buka terpadu",
      muyang: "full",
      gmaps: "partial",
      deliveryApps: "full",
      socialMedia: "none",
      friends: "none"
    },
    {
      criteria: "Fokus spesifik area sekitar kampus & kosan",
      muyang: "full",
      gmaps: "none",
      deliveryApps: "none",
      socialMedia: "partial",
      friends: "full"
    },
    {
      criteria: "Ulasan jujur & porsi kenyang dari sesama mahasiswa",
      muyang: "full",
      gmaps: "none",
      deliveryApps: "none",
      socialMedia: "partial",
      friends: "full"
    },
    {
      criteria: "Visibilitas terjangkau untuk UMKM kecil (Rp 50rb/bln)",
      muyang: "full",
      gmaps: "partial",
      deliveryApps: "partial",
      socialMedia: "partial",
      friends: "none"
    }
  ],
  pricingTiers: [
    {
      name: "Mahasiswa / User",
      price: "GRATIS",
      period: "Selamanya",
      badge: "Untuk Mahasiswa",
      highlight: false,
      features: [
        "Akses penuh filter budget nominal",
        "Peta kuliner kampus & petunjuk arah",
        "Kalkulator hemat kenyang harian",
        "Ulasan jujur & rekomendasi sesama maba",
        "Kupon diskon UMKM eksklusif"
      ],
      ctaText: "Mulai Cari Kuliner",
      ctaAction: "browse"
    },
    {
      name: "Featured Listing UMKM",
      price: "Rp 50.000",
      period: "per bulan",
      badge: "Paling Populer",
      highlight: true,
      features: [
        "Tampil di posisi teratas hasil pencarian",
        "Badge verifikasi 'Mitra Resmi Muyang'",
        "Katalog menu foto kualitas HD",
        "Jangkau 38.000+ mahasiswa UNEJ",
        "Laporan analitik pengunjung profil bulanan"
      ],
      ctaText: "Daftar Mitra Sekarang",
      ctaAction: "partner"
    },
    {
      name: "Paket Promosi Kilat",
      price: "Rp 30.000",
      period: "per event promosi",
      badge: "Spesial Event",
      highlight: false,
      features: [
        "Banner pop-up kuliner diskon 3 hari",
        "Blast notifikasi ke mahasiswa terdekat",
        "Cocok untuk launching menu baru",
        "Tagging 'Promo Hari Ini' di peta"
      ],
      ctaText: "Pilih Promosi",
      ctaAction: "partner"
    },
    {
      name: "Kampanye Bersama UMKM",
      price: "Rp 100.000",
      period: "per paket kampanye",
      badge: "Hasil Maksimal",
      highlight: false,
      features: [
        "Kombinasi Featured Listing 1 Bulan",
        "Promosi konten reels/TikTok kolaborasi",
        "Voucher potongan harga khusus maba",
        "Review mendalam oleh food influencer kampus"
      ],
      ctaText: "Konsultasi Kampanye",
      ctaAction: "partner"
    }
  ]
};


// ============================================================
// AUTH SEED DATA - Demo Accounts for Testing
// ============================================================

const ADMIN_CREDS = {
  username: 'admin_muyang',
  password: 'muyang2026'
};

// Demo mahasiswa accounts (stored in localStorage as MUYANG_USERS_MHS)
const DEMO_MAHASISWA = [
  {
    nim: '242410102001',
    password: 'demo123',
    nama: 'Budi Santoso',
    fakultas: "Fasilkom - Informatika '24",
    bookmarks: [1, 2],
    reviewedSpots: []
  },
  {
    nim: '242410102002',
    password: 'demo123',
    nama: 'Siti Rahma',
    fakultas: "FEB - Manajemen '24",
    bookmarks: [],
    reviewedSpots: []
  }
];

// Demo UMKM accounts (stored in localStorage as MUYANG_USERS_UMKM)
// Status: pending | awaiting_payment | verifying | active | rejected
const DEMO_UMKM = [
  {
    id: 'UMKM-001',
    linkedCulinaryId: 8,
    email: 'busiti@demo.id',
    password: 'demo123',
    warungName: 'Lalapan Tahu Tempe & Telur Penyet Bu Siti',
    ownerName: 'Bu Siti Rahayu',
    whatsapp: '081234567890',
    alamat: 'Gang Buntu Jl. Jawa VII No. 3 (Dalam Gang Kosan)',
    paket: 'Featured Listing',
    paketPrice: 50000,
    status: 'active',
    hours: '11.00 - 20.30 WIB',
    description: 'Hidden gem sejati di dalam gang Jl. Jawa! Tempatnya sederhana tapi antrean anak kos selalu ramai karena cuma 8 ribu sudah dapet tempe goreng tepung renyah + telur dadar + nasi banyak.',
    menus: [
      { id: 1, name: 'Nasi + Tempe Goreng Tepung Crispy + Sambal', price: 5000, portion: 'Paling Hemat' },
      { id: 2, name: 'Nasi + Tahu Tempe Penyet + Terong Goreng', price: 7000, portion: 'Porsi Kenyang' },
      { id: 3, name: 'Nasi + Telur Penyet Sambal Bajak Pedas', price: 8000, portion: 'Porsi Kenyang' },
      { id: 4, name: 'Es Teh Manis Jumbo Segar', price: 2500, portion: 'Minuman' }
    ]
  },
  {
    id: 'UMKM-002',
    email: 'pakbudi@demo.id',
    password: 'demo123',
    warungName: 'Depot Nasi Goreng Pak Budi',
    ownerName: 'Pak Budi Hartono',
    whatsapp: '081298765432',
    alamat: 'Jl. Kalimantan No. 55 (Dekat Rektorat UNEJ)',
    paket: 'Promosi Kilat',
    paketPrice: 30000,
    status: 'pending',
    hours: '17.00 - 23.30 WIB',
    description: 'Nasi goreng dan mie goreng gerobakan legendaris bumbu medok gurih dengan porsi meluap khas mahasiswa UNEJ.',
    menus: [
      { id: 101, name: 'Nasi Goreng Mawut Spesial Telur', price: 10000, portion: 'Porsi Meluap' },
      { id: 102, name: 'Mie Goreng Bumbu Medok Gurih', price: 10000, portion: 'Porsi Jumbo' },
      { id: 103, name: 'Nasi Goreng Sosis & Bakso Dobel', price: 12000, portion: 'Porsi Sultan Kos' }
    ]
  },
  {
    id: 'UMKM-003',
    email: 'mieayam@demo.id',
    password: 'demo123',
    warungName: 'Mie Ayam Mas Joko',
    ownerName: 'Joko Susanto',
    whatsapp: '085712345678',
    alamat: 'Jl. Mastrip No. 7 (Depan FKG UNEJ)',
    paket: 'Kampanye Bersama',
    paketPrice: 100000,
    status: 'awaiting_payment',
    hours: '10.00 - 21.00 WIB',
    description: 'Mie ayam kenyal kuah rempah kental dengan topping daging ayam melimpah dan pangsit krispi mekar.',
    menus: [
      { id: 201, name: 'Mie Ayam Pangsit Gurih', price: 9000, portion: 'Porsi Kenyang' },
      { id: 202, name: 'Mie Ayam + Bakso Urat Jumbo', price: 12000, portion: 'Porsi Jumbo' },
      { id: 203, name: 'Es Jeruk Peras Alami', price: 3000, portion: 'Minuman' }
    ]
  }
];
