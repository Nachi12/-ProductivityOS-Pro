// js/auth.js
import { showToast } from './toast.js';

function getStoredFirebaseConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
        return window.FIREBASE_CONFIG;
    }
    return {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
}

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.app = null;
        this.auth = null;
        this.provider = null;
        this.isAuthenticated = false;
        this.isLoading = true;
        this.isGuest = false;
        this.authCallbacks = [];
        this.isProfileMenuOpen = false;
        this.activeFamilyMember = sessionStorage.getItem('prodos_active_family_member') || 'Main';
        this.config = getStoredFirebaseConfig();

        this.initProfileDropdown();
        this.bindEvents();
        this.initFirebase();
    }

    onAuthChange(callback) {
        if (typeof callback === 'function') {
            this.authCallbacks.push(callback);
            if (!this.isLoading) {
                callback(this.currentUser);
            }
        }
    }

    notifyAuthChange() {
        this.authCallbacks.forEach(cb => {
            try { cb(this.currentUser); } catch (e) { console.error('Auth callback error:', e); }
        });
    }

    async initFirebase() {
        this.updateLoadingState(true);
        this.config = getStoredFirebaseConfig();

        const hasConfig = this.config && this.config.apiKey && this.config.apiKey !== "YOUR_API_KEY";

        if (hasConfig) {
            try {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
                const { 
                    getAuth, 
                    signInWithPopup, 
                    signInWithRedirect, 
                    getRedirectResult, 
                    GoogleAuthProvider, 
                    signOut, 
                    onAuthStateChanged,
                    setPersistence,
                    browserLocalPersistence
                } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

                this.app = initializeApp(this.config);
                this.auth = getAuth(this.app);
                
                // Ensure persistence
                try {
                    await setPersistence(this.auth, browserLocalPersistence);
                } catch (pErr) {
                    console.warn("Persistence config notice:", pErr);
                }

                this.provider = new GoogleAuthProvider();
                this.provider.setCustomParameters({ prompt: 'select_account' });

                this.signInWithPopup = signInWithPopup;
                this.signInWithRedirect = signInWithRedirect;
                this.signOut = signOut;

                // Handle Mobile Redirect Result when returning from Google OAuth
                try {
                    const redirectResult = await getRedirectResult(this.auth);
                    if (redirectResult && redirectResult.user) {
                        const user = redirectResult.user;
                        this.currentUser = {
                            uid: user.uid,
                            displayName: user.displayName || user.email.split('@')[0],
                            email: user.email || '',
                            photoURL: user.photoURL || '',
                            isGoogle: true
                        };
                        try {
                            this.token = await user.getIdToken();
                        } catch (e) {}
                        this.isAuthenticated = true;
                        this.isGuest = false;
                        sessionStorage.setItem('prodos_active_user', JSON.stringify(this.currentUser));
                        sessionStorage.removeItem('prodos_is_guest');
                        this.updateUI(true);
                        this.updateLoadingState(false);
                        this.notifyAuthChange();
                        showToast(`Welcome, ${this.currentUser.displayName}!`, 'success');
                        return;
                    }
                } catch (rErr) {
                    console.warn("Redirect result handler:", rErr);
                    if (rErr.code === 'auth/unauthorized-domain') {
                        showToast(`Domain (${window.location.hostname}) not authorized in Firebase Console. Add to Firebase Auth Settings.`, 'error');
                    }
                }

                // Auth state listener
                onAuthStateChanged(this.auth, async (user) => {
                    if (user) {
                        this.currentUser = {
                            uid: user.uid,
                            displayName: user.displayName || user.email.split('@')[0],
                            email: user.email || '',
                            photoURL: user.photoURL || '',
                            isGoogle: true
                        };
                        try {
                            this.token = await user.getIdToken();
                        } catch (e) {
                            console.warn("ID token fetch:", e);
                        }
                        this.isAuthenticated = true;
                        this.isGuest = false;
                        sessionStorage.setItem('prodos_active_user', JSON.stringify(this.currentUser));
                        sessionStorage.removeItem('prodos_is_guest');
                        this.updateUI(true);
                        this.updateLoadingState(false);
                        this.notifyAuthChange();
                    } else {
                        // Check if active guest session exists
                        const isGuest = sessionStorage.getItem('prodos_is_guest') === 'true';
                        const savedUser = sessionStorage.getItem('prodos_active_user');

                        if (isGuest && savedUser && sessionStorage.getItem('mock_logged_out') !== 'true') {
                            this.currentUser = JSON.parse(savedUser);
                            this.token = 'guest-session-token';
                            this.isAuthenticated = true;
                            this.isGuest = true;
                            this.updateUI(true);
                            this.updateLoadingState(false);
                            this.notifyAuthChange();
                        } else {
                            this.currentUser = null;
                            this.token = null;
                            this.isAuthenticated = false;
                            this.isGuest = false;
                            sessionStorage.removeItem('prodos_active_user');
                            this.updateUI(false);
                            this.updateLoadingState(false);
                            this.notifyAuthChange();
                        }
                    }
                });
            } catch (err) {
                console.error("Firebase Auth initialization error:", err);
                this.handleAuthInitFallback();
            }
        } else {
            this.handleAuthInitFallback();
        }
    }

    handleAuthInitFallback() {
        const isGuest = sessionStorage.getItem('prodos_is_guest') === 'true';
        const savedUser = sessionStorage.getItem('prodos_active_user');

        if (isGuest && savedUser && sessionStorage.getItem('mock_logged_out') !== 'true') {
            this.currentUser = JSON.parse(savedUser);
            this.token = 'guest-token';
            this.isAuthenticated = true;
            this.isGuest = true;
            this.updateUI(true);
        } else {
            this.currentUser = null;
            this.token = null;
            this.isAuthenticated = false;
            this.isGuest = false;
            this.updateUI(false);
        }
        this.updateLoadingState(false);
        this.notifyAuthChange();
    }

    loginAsGuest() {
        this.currentUser = {
            uid: 'guest_user_' + Date.now().toString(36),
            displayName: 'Guest User',
            email: 'guest@productivityos.local',
            photoURL: '',
            isGoogle: false
        };
        this.token = 'guest-local-token';
        this.isAuthenticated = true;
        this.isGuest = true;
        sessionStorage.setItem('prodos_is_guest', 'true');
        sessionStorage.setItem('prodos_active_user', JSON.stringify(this.currentUser));
        sessionStorage.removeItem('mock_logged_out');
        this.updateUI(true);
        this.updateLoadingState(false);
        this.notifyAuthChange();
        showToast("Signed in as Guest (Local Workspace)", "info");
    }

    initProfileDropdown() {
        let menu = document.getElementById('topbar-profile-dropdown');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'topbar-profile-dropdown';
            menu.style.cssText = `
                display: none; position: fixed; top: calc(var(--topbar-height) + 6px); right: 12px;
                width: 280px; max-width: calc(100vw - 24px); background: var(--bg-card); border: 1px solid var(--border-color);
                border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 10005;
                overflow: hidden; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            `;
            document.body.appendChild(menu);
        }
        this.renderProfileDropdown();
    }

    renderProfileDropdown() {
        const menu = document.getElementById('topbar-profile-dropdown');
        if (!menu) return;

        const user = this.currentUser || { displayName: 'User', email: 'user@gmail.com', photoURL: '', isGoogle: false };

        let familyData = null;
        try {
            const saved = localStorage.getItem('prodos_family_data');
            if (saved) familyData = JSON.parse(saved);
        } catch (e) {}
        
        let membersHtml = '';
        if (familyData && familyData.members && familyData.members.length > 0) {
            membersHtml = `
                <div style="padding: 6px 16px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Switch Member</div>
                <button class="profile-dropdown-member-btn ${this.activeFamilyMember === 'Main' ? 'active' : ''}" data-name="Main" style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 16px; background:${this.activeFamilyMember === 'Main' ? 'var(--bg-hover)' : 'none'}; border:none; color:var(--text-primary); font-size:0.88rem; cursor:pointer; text-align:left;">
                    <i class="fa-solid fa-user"></i> Main / ${user.displayName}
                </button>
            `;
            familyData.members.forEach(m => {
                const isActive = this.activeFamilyMember === m.name;
                membersHtml += `
                    <button class="profile-dropdown-member-btn ${isActive ? 'active' : ''}" data-name="${m.name}" style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 16px; background:${isActive ? 'var(--bg-hover)' : 'none'}; border:none; color:var(--text-primary); font-size:0.88rem; cursor:pointer; text-align:left;">
                        <i class="fa-solid fa-user"></i> ${m.name} <span style="font-size: 0.7rem; color: var(--text-muted);">(${m.relationship})</span>
                    </button>
                `;
            });
            membersHtml += `
                <button id="profile-dropdown-add-member" style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 16px; background:none; border:none; color:var(--accent-color); font-size:0.88rem; cursor:pointer; text-align:left; font-weight: 500;">
                    <i class="fa-solid fa-plus"></i> Add Family Member
                </button>
                <div style="height:1px; background:var(--border-light); margin:6px 0;"></div>
            `;
        }

        const isGoogleAccount = user.isGoogle || (user.photoURL && user.photoURL.length > 0);

        menu.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid var(--border-light); display:flex; align-items:center; gap:12px; background: var(--bg-input);">
                <div class="user-avatar" style="width:42px; height:42px; font-size:1.1rem; border:2px solid var(--accent-color); flex-shrink:0; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    ${user.photoURL ? `<img src="${user.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;">` : (user.displayName || 'OS').substr(0, 2).toUpperCase()}
                </div>
                <div style="overflow:hidden; flex:1;">
                    <div class="user-display-name" style="font-weight:700; font-size:0.92rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                        ${user.displayName}
                    </div>
                    <div class="user-email-display text-muted" style="font-size:0.78rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:2px;">
                        ${user.email || (isGoogleAccount ? 'Google Identity' : 'Guest Account')}
                    </div>
                    <span class="badge ${isGoogleAccount ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem; margin-top:4px; display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:10px;">
                        <i class="${isGoogleAccount ? 'fa-brands fa-google' : 'fa-solid fa-user'}"></i> ${isGoogleAccount ? 'Google Connected' : 'Guest Account'}
                    </span>
                </div>
            </div>
            <div style="padding: 6px 0;">
                ${membersHtml}
                <a href="#profile" class="profile-dropdown-item" style="display:flex; align-items:center; gap:10px; padding:10px 16px; text-decoration:none; color:var(--text-primary); font-size:0.88rem;">
                    <i class="fa-solid fa-circle-user" style="color:var(--accent-color);"></i> Profile & Family
                </a>
                <a href="#settings" class="profile-dropdown-item" style="display:flex; align-items:center; gap:10px; padding:10px 16px; text-decoration:none; color:var(--text-primary); font-size:0.88rem;">
                    <i class="fa-solid fa-gear"></i> Account Settings
                </a>
                <div style="height:1px; background:var(--border-light); margin:6px 0;"></div>
                <button id="profile-dropdown-signout-btn" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 16px; background:none; border:none; color:var(--clr-red); font-size:0.88rem; font-weight:600; cursor:pointer; text-align:left;">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>
            </div>
        `;

        menu.querySelector('#profile-dropdown-signout-btn')?.addEventListener('click', () => {
            this.closeProfileMenu();
            this.logout();
        });

        menu.querySelectorAll('.profile-dropdown-item').forEach(item => {
            item.addEventListener('click', () => this.closeProfileMenu());
        });
        
        menu.querySelectorAll('.profile-dropdown-member-btn').forEach(item => {
            item.addEventListener('click', (e) => {
                const newMember = e.currentTarget.dataset.name;
                if (newMember !== this.activeFamilyMember) {
                    this.activeFamilyMember = newMember;
                    sessionStorage.setItem('prodos_active_family_member', newMember);
                    document.dispatchEvent(new CustomEvent('familyMemberSwitched', { detail: newMember }));
                    this.renderProfileDropdown();
                }
                this.closeProfileMenu();
            });
        });

        menu.querySelector('#profile-dropdown-add-member')?.addEventListener('click', () => {
            this.closeProfileMenu();
            document.dispatchEvent(new CustomEvent('openAddFamilyMemberModal'));
        });
    }

    toggleProfileMenu() {
        if (this.isProfileMenuOpen) this.closeProfileMenu();
        else this.openProfileMenu();
    }

    openProfileMenu() {
        this.isProfileMenuOpen = true;
        this.renderProfileDropdown();
        const menu = document.getElementById('topbar-profile-dropdown');
        if (menu) menu.style.display = 'block';
    }

    closeProfileMenu() {
        this.isProfileMenuOpen = false;
        const menu = document.getElementById('topbar-profile-dropdown');
        if (menu) menu.style.display = 'none';
    }

    bindEvents() {
        document.getElementById('auth-login-btn')?.addEventListener('click', () => this.login());
        document.getElementById('auth-guest-btn')?.addEventListener('click', () => this.loginAsGuest());

        const profileBtn = document.getElementById('topbar-user-profile-btn');
        profileBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleProfileMenu();
        });

        // Click outside & Escape handlers
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('topbar-profile-dropdown');
            if (this.isProfileMenuOpen && menu && !menu.contains(e.target) && !profileBtn?.contains(e.target)) {
                this.closeProfileMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isProfileMenuOpen) {
                this.closeProfileMenu();
            }
        });
    }

    async login() {
        this.updateLoadingState(true);
        sessionStorage.removeItem('mock_logged_out');

        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (this.auth && (this.signInWithPopup || this.signInWithRedirect)) {
            // First attempt popup (works in most browsers when initiated by user click)
            try {
                const result = await this.signInWithPopup(this.auth, this.provider);
                if (result && result.user) {
                    showToast(`Welcome, ${result.user.displayName || 'User'}!`, 'success');
                    return;
                }
            } catch (error) {
                console.warn("Popup sign-in notice:", error);

                if (error.code === 'auth/unauthorized-domain') {
                    this.updateLoadingState(false);
                    const domain = window.location.hostname;
                    showToast(`Unauthorized domain (${domain}). Add "${domain}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`, 'error');
                    return;
                }

                // If popup was blocked or mobile browser prevents popup, use signInWithRedirect
                if (this.signInWithRedirect && (
                    isMobile ||
                    error.code === 'auth/popup-blocked' ||
                    error.code === 'auth/popup-closed-by-user' ||
                    error.code === 'auth/operation-not-supported-in-this-environment' ||
                    error.code === 'auth/cancelled-popup-request'
                )) {
                    try {
                        showToast("Redirecting to Google Sign-in...", "info");
                        await this.signInWithRedirect(this.auth, this.provider);
                        return;
                    } catch (redErr) {
                        console.error("Redirect sign-in error:", redErr);
                        this.updateLoadingState(false);
                        if (redErr.code === 'auth/unauthorized-domain') {
                            showToast(`Unauthorized domain (${window.location.hostname}). Add it to Firebase Authorized domains.`, 'error');
                        } else {
                            showToast("Google Sign-In failed: " + (redErr.message || redErr.code), 'error');
                        }
                        return;
                    }
                }

                this.updateLoadingState(false);
                let msg = 'Authentication failed.';
                if (error.code === 'auth/popup-closed-by-user') msg = 'Sign-in cancelled.';
                else if (error.code === 'auth/network-request-failed') msg = 'Network error. Check connection.';
                else if (error.message) msg = error.message;
                showToast(msg, 'error');
            }
        } else {
            // No Firebase configured or initialized
            this.updateLoadingState(false);
            showToast("Google Auth not initialized. Continuing as Guest.", "info");
            this.loginAsGuest();
        }
    }

    async authenticateGoogleForLinking() {
        if (this.auth && this.signInWithPopup) {
            try {
                const { signInWithPopup, GoogleAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                const linkProvider = new GoogleAuthProvider();
                linkProvider.setCustomParameters({ prompt: 'select_account' });

                const result = await signInWithPopup(this.auth, linkProvider);
                const idToken = await result.user.getIdToken();

                return {
                    uid: result.user.uid,
                    email: result.user.email || '',
                    displayName: result.user.displayName || '',
                    photoURL: result.user.photoURL || '',
                    linkIdToken: idToken
                };
            } catch (err) {
                console.warn("Firebase popup linking notice:", err.message);
                if (err.code === 'auth/unauthorized-domain') {
                    showToast(`Domain (${window.location.hostname}) not authorized in Firebase Console`, 'error');
                }
            }
        }

        const mockId = `google_linked_${Date.now().toString(36)}`;
        return {
            uid: mockId,
            email: `family_${mockId.substr(-5)}@gmail.com`,
            displayName: `Google Linked Member`,
            photoURL: '',
            linkIdToken: 'google-link-token'
        };
    }

    async logout() {
        if (this.auth) {
            try {
                await this.signOut(this.auth);
            } catch (e) {
                console.error("Logout error:", e);
            }
        }

        sessionStorage.setItem('mock_logged_out', 'true');
        sessionStorage.removeItem('prodos_active_user');
        sessionStorage.removeItem('prodos_is_guest');

        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        this.isGuest = false;
        this.updateUI(false);
        showToast("Signed out successfully.", "info");
        setTimeout(() => location.reload(), 300);
    }

    updateLoadingState(isLoading) {
        this.isLoading = isLoading;
        const loader = document.getElementById('auth-loading-screen');
        if (loader) {
            loader.style.display = isLoading ? 'flex' : 'none';
            loader.style.pointerEvents = isLoading ? 'all' : 'none';
        }
    }

    updateUI(isLoggedIn) {
        const overlay = document.getElementById('auth-overlay');
        const userDisplays = document.querySelectorAll('.user-display-name, #auth-user-name');
        const userAvatars = document.querySelectorAll('.user-avatar');

        if (isLoggedIn && this.currentUser) {
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.pointerEvents = 'none';
            }
            userDisplays.forEach(el => {
                el.textContent = this.currentUser.displayName || this.currentUser.email || 'User';
            });
            userAvatars.forEach(avatar => {
                if (this.currentUser.photoURL) {
                    avatar.innerHTML = `<img src="${this.currentUser.photoURL}" referrerpolicy="no-referrer" alt="${this.currentUser.displayName || 'User'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    const initials = (this.currentUser.displayName || 'OS')
                        .split(' ')
                        .filter(Boolean)
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .substr(0, 2) || 'U';
                    avatar.textContent = initials;
                }
            });
            this.renderProfileDropdown();
        } else {
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.pointerEvents = 'all';
            }
            userDisplays.forEach(el => {
                el.textContent = 'Sign In';
            });
            userAvatars.forEach(avatar => {
                avatar.textContent = 'OS';
            });
        }
    }
}

export const authManager = new AuthManager();

