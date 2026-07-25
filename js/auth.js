import { showToast } from './toast.js';

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.app = null;
        this.auth = null;
        this.provider = null;
        this.onLoginCallback = null;
        
        this.initFirebase();
        this.bindEvents();
    }
    
    async initFirebase() {
        if(firebaseConfig.apiKey !== "YOUR_API_KEY") {
            try {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
                const { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                
                this.app = initializeApp(firebaseConfig);
                this.auth = getAuth(this.app);
                this.provider = new GoogleAuthProvider();
                
                // Store module methods for later use in login/logout
                this.signInWithPopup = signInWithPopup;
                this.signOut = signOut;
                
                onAuthStateChanged(this.auth, async (user) => {
                    if (user) {
                        this.currentUser = user;
                        this.token = await user.getIdToken();
                        this.updateUI(true);
                        if (this.onLoginCallback) this.onLoginCallback();
                    } else {
                        this.currentUser = null;
                        this.token = null;
                        this.updateUI(false);
                    }
                });
            } catch (err) {
                console.error("Firebase init error", err);
            }
        } else {
            console.warn("Firebase not configured. Bypassing real auth for local UI testing.");
            this.currentUser = { uid: 'local-test-user', displayName: 'Test User' };
            this.token = 'mock-token';
            // We fake a login state initially for the MVP demo if keys aren't set
            setTimeout(() => { 
                this.updateUI(true); 
                if(this.onLoginCallback) this.onLoginCallback(); 
            }, 500);
        }
    }
    
    bindEvents() {
        document.getElementById('auth-login-btn')?.addEventListener('click', () => this.login());
        document.getElementById('auth-logout-btn')?.addEventListener('click', () => this.logout());
    }

    async login() {
        if (!this.auth) {
            showToast("Firebase keys not set! Logging in as mock user.", "warning");
            this.currentUser = { uid: 'local-test-user', displayName: 'Test User' };
            this.token = 'mock-token';
            this.updateUI(true);
            if(this.onLoginCallback) this.onLoginCallback();
            return;
        }
        try {
            await this.signInWithPopup(this.auth, this.provider);
            showToast("Successfully logged in!");
        } catch (error) {
            console.error("Login failed", error);
            showToast("Login failed: " + error.message, "error");
        }
    }
    
    async logout() {
        if (this.auth) {
            await this.signOut(this.auth);
        }
        localStorage.clear();
        location.reload();
    }
    
    updateUI(isLoggedIn) {
        const overlay = document.getElementById('auth-overlay');
        const userDisplay = document.getElementById('auth-user-name');
        
        if (isLoggedIn) {
            if (overlay) overlay.style.display = 'none';
            if (userDisplay) userDisplay.textContent = this.currentUser.displayName || 'User';
        } else {
            if (overlay) overlay.style.display = 'flex';
        }
    }
}

export const authManager = new AuthManager();
