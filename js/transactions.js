import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import {
    formatRupiah,
    parseRupiah,
    showToast,
    getCurrentUser,
    isPengurus,
    validateTransaction
} from './utils.js';

// Collection reference
const transactionsRef = collection(db, 'transactions');

// Add new transaction
export async function addTransaction(transactionData) {
    try {
        if (!isPengurus()) {
            throw new Error('Unauthorized');
        }

        const user = getCurrentUser();
        const now = new Date();
        const bulan = now.toISOString().slice(0, 7); // YYYY-MM

        const data = {
            ...transactionData,
            tanggal: Timestamp.fromDate(now),
            bulan: bulan,
            createdBy: user.uid,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now)
        };

        const docRef = await addDoc(transactionsRef, data);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding transaction:', error);
        return { success: false, error: error.message };
    }
}

// Update transaction
export async function updateTransaction(transactionId, transactionData) {
    try {
        if (!isPengurus()) {
            throw new Error('Unauthorized');
        }

        const transactionRef = doc(db, 'transactions', transactionId);
        const data = {
            ...transactionData,
            updatedAt: Timestamp.fromDate(new Date())
        };

        await updateDoc(transactionRef, data);
        return { success: true };
    } catch (error) {
        console.error('Error updating transaction:', error);
        return { success: false, error: error.message };
    }
}

// Delete transaction
export async function deleteTransaction(transactionId) {
    try {
        if (!isPengurus()) {
            throw new Error('Unauthorized');
        }

        const transactionRef = doc(db, 'transactions', transactionId);
        await deleteDoc(transactionRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return { success: false, error: error.message };
    }
}

// Get all transactions
export async function getAllTransactions() {
    try {
        const q = query(transactionsRef, orderBy('tanggal', 'desc'));
        const snapshot = await getDocs(q);

        const transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return { success: true, data: transactions };
    } catch (error) {
        console.error('Error getting transactions:', error);
        return { success: false, error: error.message };
    }
}

// Get transactions by month
export async function getTransactionsByMonth(month) {
    try {
        const q = query(
            transactionsRef,
            where('bulan', '==', month),
            orderBy('tanggal', 'desc')
        );
        const snapshot = await getDocs(q);

        const transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return { success: true, data: transactions };
    } catch (error) {
        console.error('Error getting transactions by month:', error);
        return { success: false, error: error.message };
    }
}

// Get transactions by date range
export async function getTransactionsByDateRange(startDate, endDate) {
    try {
        const q = query(
            transactionsRef,
            where('tanggal', '>=', Timestamp.fromDate(startDate)),
            where('tanggal', '<=', Timestamp.fromDate(endDate)),
            orderBy('tanggal', 'desc')
        );
        const snapshot = await getDocs(q);

        const transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return { success: true, data: transactions };
    } catch (error) {
        console.error('Error getting transactions by date range:', error);
        return { success: false, error: error.message };
    }
}

// Calculate total saldo
export function calculateTotalSaldo(transactions) {
    return transactions.reduce((total, t) => {
        return t.tipe === 'pemasukan' ? total + t.nominal : total - t.nominal;
    }, 0);
}

// Calculate monthly summary
export function calculateMonthlySummary(transactions, month) {
    const monthlyTransactions = transactions.filter(t => t.bulan === month);

    const pemasukan = monthlyTransactions
        .filter(t => t.tipe === 'pemasukan')
        .reduce((sum, t) => sum + t.nominal, 0);

    const pengeluaran = monthlyTransactions
        .filter(t => t.tipe === 'pengeluaran')
        .reduce((sum, t) => sum + t.nominal, 0);

    return {
        pemasukan,
        pengeluaran,
        saldo: pemasukan - pengeluaran,
        totalTransaksi: monthlyTransactions.length
    };
}

// Export transactions to CSV
export function exportTransactionsToCSV(transactions, filename = 'transactions.csv') {
    if (!transactions || transactions.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    const headers = ['Tanggal', 'Keterangan', 'Tipe', 'Jumlah Orang', 'Nominal'];
    const csvContent = [
        headers.join(','),
        ...transactions.map(t => [
            t.tanggal.toDate().toLocaleDateString('id-ID'),
            `"${t.keterangan}"`,
            t.tipe,
            t.jumlahOrang || '-',
            t.nominal
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();

    showToast('Data berhasil diekspor', 'success');
}

// Format transaction for display
export function formatTransactionForDisplay(transaction) {
    return {
        ...transaction,
        tanggalFormatted: transaction.tanggal.toDate().toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        nominalFormatted: formatRupiah(transaction.nominal),
        tipeBadge: transaction.tipe === 'pemasukan'
            ? '<span class="badge badge-success"><i class="fas fa-arrow-down"></i> Masuk</span>'
            : '<span class="badge badge-danger"><i class="fas fa-arrow-up"></i> Keluar</span>'
    };
}

// Handle transaction form submit
export async function handleTransactionSubmit(formData) {
    try {
        if (!isPengurus()) {
            showToast('Anda tidak memiliki akses', 'error');
            return false;
        }

        // Validate
        const validation = validateTransaction(formData);
        if (!validation.isValid) {
            showToast(validation.errors[0], 'error');
            return false;
        }

        const transactionId = formData.id;
        const transactionData = {
            keterangan: formData.keterangan.trim(),
            tipe: formData.tipe,
            nominal: formData.nominal
        };

        if (formData.tipe === 'pemasukan') {
            transactionData.jumlahOrang = formData.jumlahOrang;
        }

        let result;
        if (transactionId) {
            // Update
            result = await updateTransaction(transactionId, transactionData);
            if (result.success) {
                showToast('Transaksi berhasil diupdate', 'success');
            }
        } else {
            // Add new
            result = await addTransaction(transactionData);
            if (result.success) {
                showToast('Transaksi berhasil ditambahkan', 'success');
            }
        }

        return result.success;
    } catch (error) {
        console.error('Error in handleTransactionSubmit:', error);
        showToast('Gagal menyimpan transaksi', 'error');
        return false;
    }
}

// Delete with confirmation
export async function deleteWithConfirmation(transactionId) {
    if (!isPengurus()) {
        showToast('Anda tidak memiliki akses', 'error');
        return false;
    }

    const confirmed = confirm('Apakah Anda yakin ingin menghapus transaksi ini?');
    if (!confirmed) return false;

    const result = await deleteTransaction(transactionId);
    if (result.success) {
        showToast('Transaksi berhasil dihapus', 'success');
        return true;
    } else {
        showToast('Gagal menghapus transaksi', 'error');
        return false;
    }
}