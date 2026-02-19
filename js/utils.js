// Utility functions for the application

/**
 * Format number to Rupiah currency
 * @param {number} number - The number to format
 * @returns {string} Formatted currency string
 */
export function formatRupiah(number) {
    if (number === undefined || number === null || isNaN(number)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

/**
 * Parse Rupiah string to number
 * @param {string} rupiah - Rupiah formatted string
 * @returns {number} Parsed number
 */
export function parseRupiah(rupiah) {
    if (!rupiah) return 0;
    // Remove "Rp", dots, and convert to number
    const number = parseInt(rupiah.replace(/[^0-9]/g, ''));
    return isNaN(number) ? 0 : number;
}

/**
 * Format date to Indonesian format
 * @param {Date|Timestamp} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    if (!date) return '-';

    const d = date.toDate ? date.toDate() : new Date(date);

    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning)
 */
// Throttle untuk mencegah notifikasi muncul 2x
let lastToastTime = 0;
let lastToastMessage = '';

export function showToast(message, type = 'success') {
    const now = Date.now();
    // Jika pesan sama dan muncul kurang dari 1 detik, abaikan yang kedua
    if (message === lastToastMessage && now - lastToastTime < 1000) return;

    lastToastTime = now;
    lastToastMessage = message;

    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Hapus animasi CSS dari style agar tidak bentrok dengan GSAP
    toast.style.animation = 'none';

    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'fas fa-check-circle' :
        type === 'error' ? 'fas fa-exclamation-circle' :
            'fas fa-exclamation-triangle';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';

    const removeToast = () => {
        gsap.to(toast, {
            x: 100,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
                if (toast.parentNode) toast.remove();
            }
        });
    };

    closeBtn.onclick = removeToast;

    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // GSAP Entry Animation
    gsap.from(toast, {
        x: 100,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.7)'
    });

    // Auto remove after 6 seconds
    setTimeout(removeToast, 6000);
}

/**
 * Show loading state on button
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Loading state
 */
export function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.loading-spinner');

    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        if (btnText) btnText.style.display = 'inline-block';
        if (spinner) spinner.style.display = 'none';
    }
}

/**
 * Custom confirm dialog
 * @param {string} title - Confirm title
 * @param {string} message - Confirm message
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        if (!modal || !okBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';

        const close = (result) => {
            modal.style.display = 'none';
            // Cleanup listeners
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => close(true);
        const onCancel = () => close(false);

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) close(false);
        };
    });
}

/**
 * Get current user from session
 * @returns {Object|null} User object or null
 */
export function getCurrentUser() {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Check if current user has pengurus role
 * @returns {boolean} True if pengurus
 */
export function isPengurus() {
    const user = getCurrentUser();
    return user && user.role === 'pengurus';
}

/**
 * Logout user
 */
export async function logout() {
    try {
        // Clear session
        sessionStorage.removeItem('user');

        // Sign out from Firebase
        const { auth } = await import('./firebase-config.js');
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
        await signOut(auth);

        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Gagal keluar', 'error');
    }
}

/**
 * Update user profile
 * @param {Object} data - Profile data to update
 */
export async function updateProfile(data) {
    try {
        const user = getCurrentUser();
        if (!user) return { success: false, error: 'User not logged in' };

        const { db } = await import('./firebase-config.js');
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const { updatePassword, getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');

        const updates = {};
        if (data.namaLengkap) updates.namaLengkap = data.namaLengkap;

        // Update Firestore
        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'users', user.uid), updates);

            // Update session
            const newUser = { ...user, ...updates };
            sessionStorage.setItem('user', JSON.stringify(newUser));
        }

        // Update Password if provided
        if (data.newPassword) {
            const auth = getAuth();
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, data.newPassword);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Count up animation for numbers
 * @param {HTMLElement} element - Element to animate
 * @param {number} targetNumber - Target number
 * @param {number} duration - Animation duration in seconds
 */
export function countUp(element, targetNumber, duration = 1) {
    if (!element) return;

    const startValue = { value: 0 };

    gsap.to(startValue, {
        value: targetNumber,
        duration: duration,
        ease: 'power2.out',
        onUpdate: function () {
            element.textContent = formatRupiah(Math.floor(startValue.value));
        },
        onComplete: function () {
            element.textContent = formatRupiah(targetNumber);
        }
    });
}

/**
 * Validate form inputs
 * @param {Object} data - Form data to validate
 * @returns {Object} Validation result
 */
export function validateTransaction(data) {
    const errors = [];

    if (!data.keterangan || data.keterangan.trim() === '') {
        errors.push('Keterangan tidak boleh kosong');
    }

    if (data.tipe === 'pemasukan' && (!data.jumlahOrang || data.jumlahOrang < 1)) {
        errors.push('Jumlah orang minimal 1');
    }

    if (!data.nominal || data.nominal < 1000) {
        errors.push('Nominal minimal Rp 1.000');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Export to CSV
 * @param {Array} data - Array of objects
 * @param {string} filename - Filename
 */
export function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    // Get headers
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(key => {
            const value = row[key];
            // Handle special cases
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        }).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Data berhasil diekspor', 'success');
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Berhasil disalin ke clipboard', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Gagal menyalin teks', 'error');
    }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}