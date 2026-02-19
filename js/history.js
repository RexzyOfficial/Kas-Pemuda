import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    formatRupiah,
    formatDate,
    showToast,
    getCurrentUser,
    isPengurus,
    logout,
    showConfirm,
    updateProfile,
    countUp,
    copyToClipboard,
    setButtonLoading
} from './utils.js';

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Global variables
let currentUser = null;
let transactions = [];
let monthlyReports = [];
let monthlyChart = null;

// Tunggu Firebase restore session dulu sebelum redirect
onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
        window.location.href = 'index.html';
        return;
    }

    // Ambil dari localStorage dulu (cepat)
    currentUser = getCurrentUser();

    // Kalau kosong (baru install/clear), restore dari Firestore
    if (!currentUser) {
        try {
            const { doc: fsDoc, getDoc: fsGetDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const snap = await fsGetDoc(fsDoc(db, 'users', firebaseUser.uid));
            if (snap.exists()) {
                currentUser = { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() };
                localStorage.setItem('user', JSON.stringify(currentUser));
            } else {
                window.location.href = 'index.html';
                return;
            }
        } catch (err) {
            console.error('Error restoring user:', err);
            window.location.href = 'index.html';
            return;
        }
    }

    displayUserInfo();
    setupEventListeners();
    await loadTransactions();
    populateYearFilter();
    animateElements();
});

// Display user information
function displayUserInfo() {
    document.getElementById('userName').textContent = currentUser.namaLengkap || currentUser.email;
    const role = (currentUser.role || '').toLowerCase();
    document.getElementById('userRole').textContent = role === 'pengurus' ? 'Pengurus' : 'Anggota';

    // Change badge color based on role
    const userBadge = document.getElementById('userRole');
    if (role === 'pengurus') {
        userBadge.style.background = 'var(--primary)';
    } else {
        userBadge.style.background = 'var(--secondary)';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', toggleMobileMenu);

    // Backdrop click to close menu
    const menuBackdrop = document.getElementById('menuBackdrop');
    if (menuBackdrop) {
        menuBackdrop.addEventListener('click', () => {
            if (document.getElementById('navMenu').classList.contains('show')) {
                toggleMobileMenu();
            }
        });
    }

    // Year filter
    document.getElementById('yearFilter').addEventListener('change', filterByYear);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailModal');
        if (e.target === modal) {
            closeDetailModal();
        }
    });

    // Profile Settings
    document.getElementById('settingsBtn').addEventListener('click', openProfileModal);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);

    // Close export menu when clicking outside
    window.addEventListener('click', (e) => {
        const menu = document.getElementById('exportMenu');
        const btn = document.getElementById('exportBtn');
        if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

// Global functions for inline HTML
window.closeProfileModal = closeProfileModal;
window.deleteTransaction = deleteTransaction;
window.toggleExportMenu = toggleExportMenu;
window.exportData = exportData;

// Toggle mobile menu
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const menuBackdrop = document.getElementById('menuBackdrop');

    navMenu.classList.toggle('show');
    menuBtn.classList.toggle('active');
    menuBackdrop.classList.toggle('show');

    // Prevent scrolling when menu is open
    if (navMenu.classList.contains('show')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// Load all transactions
async function loadTransactions() {
    try {
        const transactionsQuery = query(
            collection(db, 'transactions'),
            orderBy('tanggal', 'desc')
        );

        const snapshot = await getDocs(transactionsQuery);
        transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        generateMonthlyReports();
        updateMonthlyChart();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Gagal memuat transaksi', 'error');
    }
}

// Monthly Chart logic
function updateMonthlyChart() {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Sort reports by date (oldest first for chart)
    const chartData = [...monthlyReports].sort((a, b) => a.bulan.localeCompare(b.bulan)).slice(-12);

    const labels = chartData.map(r => {
        const [year, month] = r.bulan.split('-');
        return new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'short' });
    });

    if (monthlyChart) monthlyChart.destroy();

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet');
        return;
    }

    // Create Gradients
    const gradPemasukan = ctx.createLinearGradient(0, 0, 0, 400);
    gradPemasukan.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradPemasukan.addColorStop(1, 'rgba(16, 185, 129, 0)');

    const gradPengeluaran = ctx.createLinearGradient(0, 0, 0, 400);
    gradPengeluaran.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
    gradPengeluaran.addColorStop(1, 'rgba(239, 68, 68, 0)');

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: chartData.map(r => r.totalPemasukan),
                    borderColor: '#10b981',
                    backgroundColor: gradPemasukan,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6
                },
                {
                    label: 'Pengeluaran',
                    data: chartData.map(r => r.totalPengeluaran),
                    borderColor: '#ef4444',
                    backgroundColor: gradPengeluaran,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'inherit', size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#1f2937',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 8,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += formatRupiah(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11 },
                        callback: value => {
                            if (value >= 1000000) return 'Rp ' + (value / 1000000) + 'jt';
                            if (value >= 1000) return 'Rp ' + (value / 1000) + 'rb';
                            return 'Rp ' + value;
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// Generate monthly reports
function generateMonthlyReports() {
    // Group transactions by month
    const monthlyData = {};

    transactions.forEach(transaction => {
        const bulan = transaction.bulan;

        if (!monthlyData[bulan]) {
            monthlyData[bulan] = {
                bulan: bulan,
                transactions: [],
                totalPemasukan: 0,
                totalPengeluaran: 0,
                saldoAkhir: 0
            };
        }

        monthlyData[bulan].transactions.push(transaction);

        if (transaction.tipe === 'pemasukan') {
            monthlyData[bulan].totalPemasukan += transaction.nominal;
        } else {
            monthlyData[bulan].totalPengeluaran += transaction.nominal;
        }
    });

    // Calculate running balance
    let runningBalance = 0;
    const sortedMonths = Object.keys(monthlyData).sort();

    sortedMonths.forEach(month => {
        runningBalance = runningBalance +
            monthlyData[month].totalPemasukan -
            monthlyData[month].totalPengeluaran;

        monthlyData[month].saldoAkhir = runningBalance;
    });

    // Convert to array and sort descending (newest first)
    monthlyReports = sortedMonths
        .map(month => monthlyData[month])
        .sort((a, b) => b.bulan.localeCompare(a.bulan));

    displayMonthlyReports(monthlyReports);
}

// Display monthly reports
function displayMonthlyReports(reports) {
    const container = document.getElementById('monthlyReports');

    if (reports.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="grid-column: 1/-1;">
                <i class="fas fa-calendar-times" style="font-size: 48px; color: var(--text-light); margin: 20px 0;"></i>
                <p>Belum ada laporan bulanan</p>
            </div>
        `;
        return;
    }

    let html = '';
    reports.forEach(report => {
        const [year, month] = report.bulan.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long' });

        html += `
            <div class="card month-card">
                <div class="month-header">
                    <h3 class="month-title">${monthName} ${year}</h3>
                </div>
                <div class="month-stats">
                    <div class="stat-row">
                        <span class="stat-label">Total Pemasukan:</span>
                        <span class="stat-value text-success">${formatRupiah(report.totalPemasukan)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Pengeluaran:</span>
                        <span class="stat-value text-danger">${formatRupiah(report.totalPengeluaran)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Saldo Akhir:</span>
                        <span class="stat-value text-primary">${formatRupiah(report.saldoAkhir)}</span>
                    </div>
                </div>
                <div class="month-actions">
                    <button class="btn btn-sm btn-primary" onclick="showDetail('${report.bulan}')">
                        <i class="fas fa-eye"></i>
                        Detail
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="copyReport('${report.bulan}')">
                        <i class="fas fa-copy"></i>
                        Salin Laporan
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Add animation
    gsap.from('.month-card', {
        y: 20,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out'
    });
}

// Populate year filter dropdown
function populateYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    const years = new Set();

    transactions.forEach(t => {
        const year = t.bulan.split('-')[0];
        years.add(year);
    });

    const sortedYears = Array.from(years).sort().reverse();

    let options = '<option value="all">Semua Tahun</option>';
    sortedYears.forEach(year => {
        options += `<option value="${year}">${year}</option>`;
    });

    yearFilter.innerHTML = options;
}

// Filter reports by year
function filterByYear() {
    const selectedYear = document.getElementById('yearFilter').value;

    if (selectedYear === 'all') {
        displayMonthlyReports(monthlyReports);
    } else {
        const filtered = monthlyReports.filter(report =>
            report.bulan.startsWith(selectedYear)
        );
        displayMonthlyReports(filtered);
    }
}

// Show detail modal for specific month
window.showDetail = async function (bulan) {
    const [year, month] = bulan.split('-');
    const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long' });

    document.getElementById('detailModalTitle').textContent = `Detail Transaksi ${monthName} ${year}`;

    // Get transactions for this month
    const monthTransactions = transactions.filter(t => t.bulan === bulan);

    // Calculate totals
    const totalPemasukan = monthTransactions
        .filter(t => t.tipe === 'pemasukan')
        .reduce((sum, t) => sum + t.nominal, 0);

    const totalPengeluaran = monthTransactions
        .filter(t => t.tipe === 'pengeluaran')
        .reduce((sum, t) => sum + t.nominal, 0);

    const saldoAkhir = totalPemasukan - totalPengeluaran;

    // Update summary
    document.getElementById('detailPemasukan').textContent = formatRupiah(totalPemasukan);
    document.getElementById('detailPengeluaran').textContent = formatRupiah(totalPengeluaran);
    document.getElementById('detailSaldo').textContent = formatRupiah(saldoAkhir);

    // Display transactions
    displayDetailTransactions(monthTransactions);

    // Show modal
    const modal = document.getElementById('detailModal');
    modal.classList.add('show');

    gsap.from('.modal-content', {
        scale: 0.9,
        y: -20,
        duration: 0.3,
        ease: 'power2.out'
    });
};

// Display transactions in detail modal
function displayDetailTransactions(transactions) {
    const tableBody = document.getElementById('detailTableBody');

    if (transactions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <p>Tidak ada transaksi</p>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    transactions.forEach(transaction => {
        const isPemasukan = transaction.tipe === 'pemasukan';
        const nominal = formatRupiah(transaction.nominal);
        const tanggal = formatDate(transaction.tanggal);

        html += `
            <tr>
                <td>${tanggal}</td>
                <td>${transaction.keterangan}</td>
                <td>${isPemasukan ? transaction.jumlahOrang || '-' : '-'}</td>
                <td class="${isPemasukan ? 'text-success' : 'text-danger'}">${nominal}</td>
                <td>
                    <span class="badge ${isPemasukan ? 'badge-success' : 'badge-danger'}">
                        <i class="fas ${isPemasukan ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        ${isPemasukan ? 'Masuk' : 'Keluar'}
                    </span>
                </td>
                <td>
                    <span class="petugas-name" style="font-size: 13px;">
                         ${transaction.updatedByName || transaction.createdByName || '-'}
                    </span>
                </td>
                <td>
                    ${isPengurus() ? `
                        <button class="btn btn-sm btn-outline btn-danger-hover" onclick="deleteTransaction('${transaction.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Global functions for transactions
async function deleteTransaction(id) {
    if (!isPengurus()) return;

    const confirmed = await showConfirm(
        'Hapus Transaksi',
        'Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.'
    );

    if (confirmed) {
        try {
            await deleteDoc(doc(db, 'transactions', id));
            showToast('Transaksi berhasil dihapus');
            // Refresh data
            await loadTransactions();
            generateMonthlyReports();
            if (document.getElementById('detailModal').classList.contains('show')) {
                // If we were in detail modal, refresh it
                const currentMonth = document.getElementById('detailModalTitle').textContent.split(' ').pop();
                // This logic is a bit complex, simplest is just close modal
                closeDetailModal();
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
            showToast('Gagal menghapus transaksi', 'error');
        }
    }
}

// Profile Modal Functions (Same as dashboard)
function openProfileModal() {
    // Close mobile menu if open
    const navMenu = document.getElementById('navMenu');
    if (navMenu && navMenu.classList.contains('show')) {
        toggleMobileMenu();
    }

    const modal = document.getElementById('profileModal');
    document.getElementById('profileNama').value = currentUser.namaLengkap || '';
    modal.style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const namaLengkap = document.getElementById('profileNama').value;
    const newPassword = document.getElementById('newPassword').value;

    setButtonLoading(btn, true);

    const result = await updateProfile({
        namaLengkap,
        newPassword: newPassword || null
    });

    setButtonLoading(btn, false);

    if (result.success) {
        showToast('Profil berhasil diperbarui');
        currentUser = getCurrentUser();
        displayUserInfo();
        closeProfileModal();
    } else {
        showToast(result.error || 'Gagal memperbarui profil', 'error');
    }
}

// Close detail modal
window.closeDetailModal = function () {
    const modal = document.getElementById('detailModal');

    gsap.to('.modal-content', {
        scale: 0.9,
        y: 20,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
            modal.classList.remove('show');
        }
    });
};

// Copy report to clipboard
window.copyReport = async function (bulan) {
    const report = monthlyReports.find(r => r.bulan === bulan);
    if (!report) return;

    const [year, month] = bulan.split('-');
    const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long' });

    // Calculate saldo awal (balance from previous month)
    const previousMonth = getPreviousMonth(bulan);
    const previousReport = monthlyReports.find(r => r.bulan === previousMonth);
    const saldoAwal = previousReport ? previousReport.saldoAkhir : 0;

    const reportText = `Laporan kas
${monthName} ${year}
Saldo awal : ${formatRupiah(saldoAwal)}
Pemasukan : ${formatRupiah(report.totalPemasukan)} / ${report.totalPemasukan === 0 ? '-' : ''}
Pengeluaran : ${formatRupiah(report.totalPengeluaran)} / ${report.totalPengeluaran === 0 ? '-' : ''}
Saldo akhir ${monthName} : ${formatRupiah(report.saldoAkhir)}`;

    await copyToClipboard(reportText);
};

// Helper function to get previous month
function getPreviousMonth(bulan) {
    const [year, month] = bulan.split('-').map(Number);

    if (month === 1) {
        return `${year - 1}-12`;
    } else {
        const prevMonth = month - 1;
        return `${year}-${prevMonth.toString().padStart(2, '0')}`;
    }
}

// Export Logic
function toggleExportMenu() {
    let menu = document.getElementById('exportMenu');

    // If menu is currently visible, close it
    if (menu && menu.style.display !== 'none') {
        menu.style.display = 'none';
        return;
    }

    const btn = document.getElementById('exportBtn');
    if (!btn) return;

    // Create or reuse the floating menu
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'exportMenu';
        document.body.appendChild(menu);
    }

    // Style the floating menu
    menu.innerHTML = `
        <p style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-left: 5px;">Pilih Format File</p>
        <button onclick="exportData('excel')" style="display:flex;align-items:center;width:100%;padding:10px 15px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;font-size:14px;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
            <i class="fas fa-file-excel" style="color:#1d6f42;font-size:18px;"></i> Excel (.xlsx)
        </button>
        <button onclick="exportData('pdf')" style="display:flex;align-items:center;width:100%;padding:10px 15px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;font-size:14px;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
            <i class="fas fa-file-pdf" style="color:#e44134;font-size:18px;"></i> PDF (.pdf)
        </button>
    `;

    const rect = btn.getBoundingClientRect();
    const menuWidth = 240;
    let left = rect.right - menuWidth + window.scrollX;
    let top = rect.bottom + 8 + window.scrollY;

    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;

    Object.assign(menu.style, {
        position: 'absolute',
        top: top + 'px',
        left: left + 'px',
        width: menuWidth + 'px',
        background: 'white',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        border: '1px solid #e5e7eb',
        zIndex: '99999',
        display: 'block'
    });
}

async function exportData(format) {
    if (transactions.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'error');
        return;
    }

    // Sort transactions by date for export
    const exportItems = [...transactions].sort((a, b) => {
        const tA = a.tanggal.toMillis ? a.tanggal.toMillis() : new Date(a.tanggal).getTime();
        const tB = b.tanggal.toMillis ? b.tanggal.toMillis() : new Date(b.tanggal).getTime();
        return tA - tB;
    });

    if (format === 'excel') {
        const data = exportItems.map(t => ({
            'Tanggal': formatDate(t.tanggal),
            'Keterangan': t.keterangan || '-',
            'Anggota': t.tipe === 'pemasukan' ? (t.jumlahOrang || '-') : '-',
            'Nominal (Rp)': t.nominal,
            'Tipe': t.tipe === 'pemasukan' ? 'Masuk' : 'Keluar',
            'Petugas': t.updatedByName || t.createdByName || '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Keuangan');
        XLSX.writeFile(workbook, `Laporan_Kas_Pemuda_${new Date().toLocaleDateString('id-ID')}.xlsx`);
        showToast('Excel berhasil diunduh');
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Laporan Keuangan Kas Pemuda Remaja', 14, 20);
        doc.setFontSize(11);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 28);

        const tableData = exportItems.map(t => [
            formatDate(t.tanggal),
            t.keterangan || '-',
            t.tipe === 'pemasukan' ? (t.jumlahOrang || '-') : '-',
            formatRupiah(t.nominal).replace('Rp', '').trim(),
            t.tipe === 'pemasukan' ? 'Masuk' : 'Keluar',
            t.updatedByName || t.createdByName || '-'
        ]);

        doc.autoTable({
            startY: 35,
            head: [['Tanggal', 'Keterangan', 'Anggota', 'Nominal', 'Tipe', 'Petugas']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        doc.save(`Laporan_Kas_Pemuda_${new Date().toLocaleDateString('id-ID')}.pdf`);
        showToast('PDF berhasil diunduh');
    }

    toggleExportMenu();
}

// Initial animations
function animateElements() {
    gsap.from('.page-header', {
        y: -20,
        duration: 0.5,
        ease: 'power2.out'
    });

    gsap.from('.filter-card', {
        y: 20,
        duration: 0.4,
        delay: 0.2
    });
}