import { db, auth } from './firebase-config.js';
import {
    formatRupiah,
    formatDate,
    showToast,
    setButtonLoading,
    getCurrentUser,
    isPengurus,
    logout,
    showConfirm,
    updateProfile,
    countUp,
    validateTransaction,
    parseRupiah,
    debounce
} from './utils.js';

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Global variables
let currentUser = getCurrentUser();
let transactions = [];
let chart = null;
let unsubscribe = null;
let isFirstLoad = true;

// --- GLOBAL EXPOSURE ---
window.logout = logout;

/**
 * Helper to safely set element values
 */
function safeSetVal(id, val) {
    const el = document.getElementById(id);
    if (el) {
        el.value = val;
    } else {
        console.warn(`Element with id "${id}" not found.`);
    }
}

/**
 * Open modal for adding/editing transaction
 */
window.openModal = function (type, transaction = null) {
    console.log('openModal called:', type, transaction);
    try {
        const modal = document.getElementById('transactionModal');
        if (!modal) {
            console.error('Modal "transactionModal" not found in DOM');
            return;
        }

        const modalTitle = document.getElementById('modalTitle');
        const jumlahOrangGroup = document.getElementById('jumlahOrangGroup');

        // Set UI state
        if (modalTitle) {
            modalTitle.textContent = transaction ?
                (type === 'pemasukan' ? 'Edit Pemasukan' : 'Edit Pengeluaran') :
                (type === 'pemasukan' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran');
        }

        if (jumlahOrangGroup) {
            jumlahOrangGroup.style.display = (type === 'pemasukan') ? 'block' : 'none';
        }

        // Pengaman Super: Jika kolom tanggal hilang, cari lokasi nominal untuk menyisipkan
        let tanggalField = document.getElementById('tanggal');
        if (!tanggalField) {
            console.warn('Tanggal group missing, recreating aggressively...');
            const modalBody = modal.querySelector('.modal-body');
            const nominalInput = document.getElementById('nominal');

            if (modalBody && nominalInput) {
                const nominalGroupRef = nominalInput.closest('.form-group') || nominalInput.parentNode;
                const newGroup = document.createElement('div');
                newGroup.className = 'form-group';
                newGroup.id = 'tanggalGroup';
                newGroup.innerHTML = `
                    <label for="tanggal" class="form-label">
                        <i class="fas fa-calendar-alt"></i>
                        Tanggal Transaksi (Pilih di Kalender)
                    </label>
                    <input type="date" id="tanggal" class="form-input" required>
                `;
                modalBody.insertBefore(newGroup, nominalGroupRef);
            }
        }

        // Pastikan dipaksa terlihat
        const tGroup = document.getElementById('tanggalGroup');
        if (tGroup) tGroup.style.display = 'block';

        // Reset form
        const form = document.getElementById('transactionForm');
        if (form) form.reset();

        // Populate fields safely
        safeSetVal('transactionId', transaction ? (transaction.id || '') : '');
        safeSetVal('transactionType', type);

        if (transaction) {
            safeSetVal('keterangan', transaction.keterangan || '');
            safeSetVal('jumlahOrang', transaction.jumlahOrang || '');
            safeSetVal('nominal', formatRupiah(transaction.nominal).replace('Rp', '').trim());

            const dateObj = (transaction.tanggal && transaction.tanggal.toDate) ? transaction.tanggal.toDate() : (transaction.tanggal ? new Date(transaction.tanggal) : new Date());
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            safeSetVal('tanggal', `${yyyy}-${mm}-${dd}`);
        } else {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            safeSetVal('tanggal', `${yyyy}-${mm}-${dd}`);
        }

        // Display modal
        modal.classList.add('show');

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.modal-content',
                { scale: 0.9, y: -20, opacity: 0 },
                { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
            );
        }
    } catch (error) {
        console.error('Error opening modal:', error);
        showToast('Terjadi kesalahan saat membuka form', 'error');
    }
};

/**
 * Close modal
 */
window.closeModal = function () {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;

    if (typeof gsap !== 'undefined') {
        gsap.to('.modal-content', {
            scale: 0.9,
            y: 20,
            opacity: 0,
            duration: 0.2,
            ease: 'power2.in',
            onComplete: () => {
                modal.classList.remove('show');
            }
        });
    } else {
        modal.classList.remove('show');
    }
};

/**
 * Global helpers for actions
 */
window.editTransaction = (id) => {
    const t = transactions.find(x => x.id === id);
    if (t) window.openModal(t.tipe, t);
};

window.deleteTransaction = async (id) => {
    if (!isPengurus()) return;
    const ok = await showConfirm('Hapus Data', 'Yakin ingin menghapus transaksi ini?');
    if (ok) {
        try {
            await deleteDoc(doc(db, 'transactions', id));
            showToast('Transaksi berhasil dihapus');
        } catch (e) {
            showToast('Gagal hapus', 'error');
        }
    }
};

window.openProfileModal = () => {
    // Close mobile menu if open
    const navMenu = document.getElementById('navMenu');
    if (navMenu && navMenu.classList.contains('show')) {
        toggleMobileMenu();
    }

    const m = document.getElementById('profileModal');
    if (m) {
        safeSetVal('profileNama', currentUser.namaLengkap || '');
        m.style.display = 'flex';
    }
};

window.closeProfileModal = () => {
    const m = document.getElementById('profileModal');
    if (m) m.style.display = 'none';
};

// --- SUBSYSTEMS ---

function setupEventListeners() {
    const elements = {
        'transactionForm': handleTransactionSubmit,
        'profileForm': handleProfileUpdate,
        'logoutBtn': logout,
        'mobileMenuBtn': toggleMobileMenu,
        'settingsBtn': window.openProfileModal
    };

    for (const [id, handler] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('submit', handler);
        else if (el) el.addEventListener('click', handler);
    }

    // Specific click listeners
    const logBtn = document.getElementById('logoutBtn');
    if (logBtn) logBtn.onclick = logout;

    const mobBtn = document.getElementById('mobileMenuBtn');
    if (mobBtn) mobBtn.onclick = toggleMobileMenu;

    const setBtn = document.getElementById('settingsBtn');
    if (setBtn) setBtn.onclick = window.openProfileModal;

    const nomInput = document.getElementById('nominal');
    if (nomInput) {
        nomInput.oninput = (e) => {
            let v = e.target.value.replace(/[^0-9]/g, '');
            if (v) e.target.value = formatRupiah(parseInt(v)).replace('Rp', '').trim();
        };
    }

    // Sort/Search
    const search = document.getElementById('searchInput');
    if (search) search.oninput = debounce(filterTransactions, 500);

    const sort = document.getElementById('sortSelect');
    if (sort) sort.onchange = filterTransactions;

    document.querySelectorAll('.filter-badge').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('.filter-badge').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            filterTransactions();
        };
    });

    window.onclick = (e) => {
        if (e.target.id === 'transactionModal') window.closeModal();
        if (e.target.id === 'profileModal') window.closeProfileModal();
    };
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    setButtonLoading(btn, true);

    try {
        const id = document.getElementById('transactionId').value;
        const type = document.getElementById('transactionType').value;
        const ket = document.getElementById('keterangan').value;
        const tgl = document.getElementById('tanggal').value;
        const nom = parseRupiah(document.getElementById('nominal').value);
        const jml = type === 'pemasukan' ? parseInt(document.getElementById('jumlahOrang').value) : null;

        if (!tgl) throw new Error('Tanggal belum diisi');

        const dateParts = tgl.split('-');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

        const data = {
            keterangan: ket.trim(),
            tipe: type,
            nominal: nom,
            tanggal: Timestamp.fromDate(dateObj),
            bulan: `${dateParts[0]}-${dateParts[1]}`,
            updatedAt: Timestamp.now(),
            updatedBy: currentUser.uid,
            updatedByName: currentUser.namaLengkap || currentUser.email
        };

        if (type === 'pemasukan') data.jumlahOrang = jml;

        if (id) {
            await updateDoc(doc(db, 'transactions', id), data);
            showToast('Transaksi berhasil diperbarui');
        } else {
            data.createdAt = Timestamp.now();
            data.createdBy = currentUser.uid;
            data.createdByName = currentUser.namaLengkap || currentUser.email;
            await addDoc(collection(db, 'transactions'), data);
            showToast('Transaksi berhasil ditambahkan');
        }

        window.closeModal();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Gagal menyimpan', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const nama = document.getElementById('profileNama').value;
    const pass = document.getElementById('newPassword').value;

    setButtonLoading(btn, true);
    const res = await updateProfile({ namaLengkap: nama, newPassword: pass || null });
    setButtonLoading(btn, false);

    if (res.success) {
        showToast('Profil diperbarui');
        currentUser = getCurrentUser();
        displayUserInfo();
        window.closeProfileModal();
    } else {
        showToast(res.error || 'Gagal update', 'error');
    }
}

function displayUserInfo() {
    const un = document.getElementById('userName');
    const ur = document.getElementById('userRole');
    if (un) un.textContent = currentUser.namaLengkap || currentUser.email;
    if (ur) {
        const p = (currentUser.role || '').toLowerCase() === 'pengurus';
        ur.textContent = p ? 'Pengurus' : 'Anggota';
        ur.style.background = p ? 'var(--primary)' : 'var(--secondary)';
    }
}

function loadTransactions() {
    const q = query(collection(db, 'transactions'), orderBy('tanggal', 'desc'));
    unsubscribe = onSnapshot(q, (snap) => {
        transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        filterTransactions();
        loadSummary();
        loadChartData();
    });
}

function filterTransactions() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const cat = document.querySelector('.filter-badge.active')?.dataset.filter || 'all';
    const sort = document.getElementById('sortSelect')?.value || 'latest';

    let filtered = transactions.filter(t => {
        const matchT = (t.keterangan || '').toLowerCase().includes(term) || formatRupiah(t.nominal).includes(term);
        const matchC = cat === 'all' || t.tipe === cat;
        return matchT && matchC;
    });

    filtered.sort((a, b) => {
        const tA = a.tanggal.toMillis ? a.tanggal.toMillis() : new Date(a.tanggal).getTime();
        const tB = b.tanggal.toMillis ? b.tanggal.toMillis() : new Date(b.tanggal).getTime();
        if (sort === 'latest') return tB - tA;
        if (sort === 'oldest') return tA - tB;
        if (sort === 'highest') return b.nominal - a.nominal;
        if (sort === 'lowest') return a.nominal - b.nominal;
        return 0;
    });

    renderTable(filtered);
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada transaksi</td></tr>';
        return;
    }

    tbody.innerHTML = data.slice(0, 10).map(t => {
        const isIn = t.tipe === 'pemasukan';
        return `
            <tr>
                <td>${formatDate(t.tanggal)}</td>
                <td>${t.keterangan || '-'}</td>
                <td>${isIn ? (t.jumlahOrang || '-') : '-'}</td>
                <td class="${isIn ? 'text-success' : 'text-danger'}">${formatRupiah(t.nominal)}</td>
                <td>
                    <span class="badge ${isIn ? 'badge-success' : 'badge-danger'}">
                        ${isIn ? 'Masuk' : 'Keluar'}
                    </span>
                </td>
                <td><small>${t.updatedByName || t.createdByName || '-'}</small></td>
                <td>
                    ${isPengurus() ? `
                        <button class="btn btn-sm btn-outline" onclick="editTransaction('${t.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline" onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

function loadSummary() {
    const now = new Date();
    const cur = now.toISOString().slice(0, 7);
    const monthly = transactions.filter(t => t.bulan === cur);

    const inM = monthly.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + t.nominal, 0);
    const outM = monthly.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + t.nominal, 0);
    const total = transactions.reduce((s, t) => s + (t.tipe === 'pemasukan' ? t.nominal : -t.nominal), 0);

    countUp(document.getElementById('totalSaldo'), total);
    countUp(document.getElementById('totalPemasukan'), inM);
    countUp(document.getElementById('totalPengeluaran'), outM);
    countUp(document.getElementById('saldoAkhir'), total);
}

function loadChartData() {
    const canvas = document.getElementById('kasChart');
    if (!canvas || !window.Chart) return;

    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
        const str = d.toISOString().split('T')[0];
        const dayT = transactions.filter(t => {
            const td = t.tanggal.toDate ? t.tanggal.toDate() : new Date(t.tanggal);
            return td.toISOString().split('T')[0] === str;
        });
        data.push(dayT.reduce((s, t) => s + (t.tipe === 'pemasukan' ? t.nominal : -t.nominal), 0));
    }

    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update('none');
    } else {
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#2563eb',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1f2937',
                        bodyColor: '#1f2937',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function (context) {
                                return 'Saldo: ' + formatRupiah(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
                        ticks: { font: { size: 10 }, callback: v => formatRupiah(v) }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }
}

function toggleMobileMenu() {
    const m = document.getElementById('navMenu');
    if (m) {
        m.classList.toggle('show');
        document.body.style.overflow = m.classList.contains('show') ? 'hidden' : '';
    }
}

// --- INIT ---
async function init() {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    displayUserInfo();
    const btnBox = document.getElementById('actionButtons');
    if (btnBox && isPengurus()) btnBox.style.display = 'flex';

    setupEventListeners();
    loadTransactions();
}

init().catch(e => console.error(e));