import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { showToast, setButtonLoading } from './utils.js';

// ─── Session Helper (localStorage & sessionStorage) ───────────────────────────
function saveUser(data) {
    // Save to localStorage (primary)
    localStorage.setItem('user', JSON.stringify(data));
    // Also save to sessionStorage (backup)
    sessionStorage.setItem('user', JSON.stringify(data));
}

function clearUser() {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
}

// Login function
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const sessionData = {
                uid: user.uid,
                email: user.email,
                role: userData.role,
                namaLengkap: userData.namaLengkap
            };
            // Simpan ke localStorage agar persisten
            saveUser(sessionData);
            return { success: true, user: userData };
        } else {
            throw new Error('User data not found');
        }
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: error.message === 'User data not found'
                ? 'Akun tidak terdaftar'
                : 'Email atau password salah'
        };
    }
}

// Logout function
export async function logout() {
    try {
        await signOut(auth);
        clearUser();
        window.location.href = 'index.html';
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Check auth state — restore user from localStorage jika sudah pernah login
export function checkAuthState() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Cek localStorage dulu (cepat, offline-friendly)
                const stored = localStorage.getItem('user');
                if (stored) {
                    resolve(JSON.parse(stored));
                } else {
                    // Fallback: ambil dari Firestore (saat pertama login di device baru)
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            const sessionData = {
                                uid: user.uid,
                                email: user.email,
                                role: userData.role,
                                namaLengkap: userData.namaLengkap
                            };
                            saveUser(sessionData);
                            resolve(sessionData);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('Error getting user data:', error);
                        resolve(null);
                    }
                }
            } else {
                // User tidak login — hapus localStorage jika ada
                clearUser();
                resolve(null);
            }
        });
    });
}

// Get current user from localStorage
export function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is pengurus
export function isPengurus() {
    const user = getCurrentUser();
    return user && user.role === 'pengurus';
}

// Check if user is anggota
export function isAnggota() {
    const user = getCurrentUser();
    const role = (user?.role || '').toLowerCase();
    return role === 'anggota' || role === 'jemaat';
}

// Protect route based on role
export function protectRoute(allowedRoles = ['pengurus', 'anggota', 'jemaat']) {
    const user = getCurrentUser();

    if (!user) {
        window.location.href = 'index.html';
        return false;
    }

    if (!allowedRoles.includes(user.role)) {
        window.location.href = 'dashboard.html';
        return false;
    }

    return true;
}

// Initialize login form
export function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    // Auto-redirect jika sudah login
    const stored = localStorage.getItem('user');
    if (stored) {
        // Verifikasi dengan Firebase Auth
        onAuthStateChanged(auth, (user) => {
            if (user) {
                window.location.href = 'dashboard.html';
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const errorMessage = document.getElementById('errorMessage');

        setButtonLoading(loginBtn, true);
        errorMessage.style.display = 'none';

        const result = await login(email, password);
        const loadingOverlay = document.getElementById('loadingOverlay');

        if (result.success) {
            if (window.gsap) {
                gsap.to(loginBtn, {
                    scale: 0.95,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => {
                        window.location.href = 'dashboard.html';
                    }
                });
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            errorMessage.textContent = result.error;
            errorMessage.style.display = 'block';
            setButtonLoading(loginBtn, false);
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (window.gsap) {
                gsap.to('.login-card', {
                    x: 10,
                    duration: 0.1,
                    repeat: 3,
                    yoyo: true
                });
            }
        }
    });
}

// Initialize logout button
export function initLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
        await logout();
    });
}

// Toggle password visibility
export function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', function () {
        const passwordInput = document.getElementById('password');
        const icon = this.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
}