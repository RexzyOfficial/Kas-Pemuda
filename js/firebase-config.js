import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAUNFe5zZOnXanl2JRQSkxKvErgjlXR6wU",
    authDomain: "kas-pemuda.firebaseapp.com",
    projectId: "kas-pemuda",
    storageBucket: "kas-pemuda.firebasestorage.app",
    messagingSenderId: "123391588399",
    appId: "1:123391588399:web:84f8a2f0c2dccaa9e5eeda"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Set persistence ke LOCAL agar user tetap login meski app ditutup
setPersistence(auth, browserLocalPersistence).catch(console.error);

export { app, auth, db };