import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { showToast, setButtonLoading } from './utils.js';

// Login function
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Store user data in session
            sessionStorage.setItem('user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                role: userData.role,
                namaLengkap: userData.namaLengkap
            }));

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
        sessionStorage.removeItem('user');
        window.location.href = 'index.html';
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Check auth state
export function checkAuthState() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Get user data from session or Firestore
                const sessionUser = sessionStorage.getItem('user');
                if (sessionUser) {
                    resolve(JSON.parse(sessionUser));
                } else {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            sessionStorage.setItem('user', JSON.stringify({
                                uid: user.uid,
                                email: user.email,
                                role: userData.role,
                                namaLengkap: userData.namaLengkap
                            }));
                            resolve({ uid: user.uid, ...userData });
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('Error getting user data:', error);
                        resolve(null);
                    }
                }
            } else {
                resolve(null);
            }
        });
    });
}

// Get current user from session
export function getCurrentUser() {
    const userStr = sessionStorage.getItem('user');
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
            // ... success handling ...
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

            // Shake animation
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