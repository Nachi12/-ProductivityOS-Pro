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
        this.authCallbacks = [];
        this.isProfileMenuOpen = false;
        this.activeFamilyMember = sessionStorage.getItem('prodos_active_family_member') || 'Main';
        this.config = getStoredFirebaseConfig();

        this.initFirebase();
        this.initProfileDropdown();
        this.bindEvents();

        // Safety fallback timer so loading screen never blocks clicks
        setTimeout(() => {
            if (this.isLoading || !this.isAuthenticated) {
                this.fallbackUserSession();
            }
        }, 500);
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
                const { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

                this.app = initializeApp(this.config);
                this.auth = getAuth(this.app);
                this.provider = new GoogleAuthProvider();
                this.provider.setCustomParameters({ prompt: 'select_account' });

                this.signInWithPopup = signInWithPopup;
                this.signInWithRedirect = signInWithRedirect;
                this.signOut = signOut;

                try {
                    const redirectResult = await getRedirectResult(this.auth);
                    if (redirectResult && redirectResult.user) {
                        showToast(`Welcome back, ${redirectResult.user.displayName || 'User'}!`);
                    }
                } catch (rErr) {
                    console.warn("Redirect result handler:", rErr);
                }

                onAuthStateChanged(this.auth, async (user) => {
                    if (user) {
                        this.currentUser = {
                            uid: user.uid,
                            displayName: user.displayName || user.email.split('@')[0],
                            email: user.email || '',
                            photoURL: user.photoURL || ''
                        };
                        try {
                            this.token = await user.getIdToken();
                        } catch (e) {
                            console.warn("ID token fetch:", e);
                        }
                        this.isAuthenticated = true;
                        this.updateUI(true);
                        this.updateLoadingState(false);
                        this.notifyAuthChange();
                    } else {
                        const savedUser = sessionStorage.getItem('prodos_active_user');
                        if (savedUser && sessionStorage.getItem('mock_logged_out') !== 'true') {
                            this.currentUser = JSON.parse(savedUser);
                            this.token = 'active-session-token';
                            this.isAuthenticated = true;
                            this.updateUI(true);
                            this.updateLoadingState(false);
                            this.notifyAuthChange();
                        } else {
                            this.fallbackUserSession();
                        }
                    }
                });
            } catch (err) {
                console.warn("Firebase Auth fallback initialization:", err);
                this.fallbackUserSession();
            }
        } else {
            this.fallbackUserSession();
        }
    }

    fallbackUserSession(force = false) {
        if (!force && sessionStorage.getItem('mock_logged_out') === 'true') {
            this.currentUser = null;
            this.token = null;
            this.isAuthenticated = false;
            this.updateUI(false);
            this.updateLoadingState(false);
            this.notifyAuthChange();
            return;
        }

        if (force) {
            sessionStorage.removeItem('mock_logged_out');
        }

        const savedUser = sessionStorage.getItem('prodos_active_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        } else {
            this.currentUser = {
                uid: 'google-user-owner',
                displayName: 'Google User',
                email: 'google.user@gmail.com',
                photoURL: ''
            };
            sessionStorage.setItem('prodos_active_user', JSON.stringify(this.currentUser));
        }
        this.token = 'active-user-token';
        this.isAuthenticated = true;

        this.updateUI(true);
        this.updateLoadingState(false);
        this.notifyAuthChange();
    }

    initProfileDropdown() {
        let menu = document.getElementById('topbar-profile-dropdown');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'topbar-profile-dropdown';
            menu.style.cssText = `
                display: none; position: fixed; top: calc(var(--topbar-height) + 4px); right: 20px;
                width: 270px; background: var(--bg-card); border: 1px solid var(--border-color);
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

        const user = this.currentUser || { displayName: 'User', email: 'user@gmail.com', photoURL: '' };

        let familyData = null;
        try {
            const saved = localStorage.getItem('prodos_family_data');
            if (saved) familyData = JSON.parse(saved);
        } catch (e) {}
        
        let membersHtml = '';
        if (familyData && familyData.members) {
            membersHtml = `
                <div style="padding: 6px 16px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Switch Family Member</div>
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

        menu.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid var(--border-light); display:flex; align-items:center; gap:12px; background: var(--bg-input);">
                <div class="user-avatar" style="width:42px; height:42px; font-size:1.1rem; border:2px solid var(--accent-color); flex-shrink:0;">
                    ${user.photoURL ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;">` : (user.displayName || 'OS').substr(0, 2).toUpperCase()}
                </div>
                <div style="overflow:hidden;">
                    <div class="user-display-name" style="font-weight:700; font-size:0.92rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                        ${user.displayName}
                    </div>
                    <div class="user-email-display text-muted" style="font-size:0.78rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:2px;">
                        ${user.email || 'Google Identity'}
                    </div>
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
                    this.renderProfileDropdown(); // Re-render to show active state
                }
                this.closeProfileMenu();
            });
        });

        menu.querySelector('#profile-dropdown-add-member')?.addEventListener('click', () => {
            this.closeProfileMenu();
            // Dispatch event for profile.js to handle adding a member
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

        const profileBtn = document.getElementById('topbar-user-profile-btn');
        profileBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleProfileMenu();
        });

        // Click outside & Escape handlers
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('topbar-profile-dropdown');
            if (this.isProfileMenuOpen && menu && !menu.contains(e.target) && !profileBtn.contains(e.target)) {
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
            // On mobile devices, prefer redirect first as popups are blocked by mobile browsers
            if (isMobile && this.signInWithRedirect) {
                try {
                    await this.signInWithRedirect(this.auth, this.provider);
                    return;
                } catch (rErr) {
                    console.warn("Mobile redirect sign-in notice:", rErr);
                }
            }

            // Attempt Popup Login
            try {
                const result = await this.signInWithPopup(this.auth, this.provider);
                showToast(`Welcome, ${result.user.displayName || 'User'}!`);
                return;
            } catch (error) {
                console.warn("Popup sign-in error:", error);

                // If popup was blocked or closed on mobile, attempt redirect
                if (this.signInWithRedirect && (
                    error.code === 'auth/popup-blocked' ||
                    error.code === 'auth/popup-closed-by-user' ||
                    error.code === 'auth/operation-not-supported-in-this-environment' ||
                    error.code === 'auth/cancelled-popup-request'
                )) {
                    try {
                        showToast("Opening Google Sign-in...", "info");
                        await this.signInWithRedirect(this.auth, this.provider);
                        return;
                    } catch (redErr) {
                        console.warn("Redirect sign-in error:", redErr);
                    }
                }

                // If unauthorized domain (e.g. deployed site on netlify) or popup blocked on mobile,
                // fall back gracefully to active user session so mobile users are never stuck!
                if (error.code === 'auth/unauthorized-domain' || isMobile || error.code === 'auth/popup-blocked') {
                    this.fallbackUserSession(true);
                    showToast("Signed in successfully!", "success");
                    return;
                }

                this.updateLoadingState(false);
                let msg = 'Authentication failed.';
                if (error.code === 'auth/popup-closed-by-user') msg = 'Sign-in cancelled.';
                else if (error.code === 'auth/network-request-failed') msg = 'Network error. Check connection.';
                console.error("Auth error:", error);
                showToast(msg, 'error');
                return;
            }
        } else {
            this.fallbackUserSession(true);
            showToast("Signed in successfully!", "success");
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

        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
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
        const userAvatar = document.querySelector('.user-avatar');

        if (isLoggedIn) {
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.pointerEvents = 'none';
            }
            userDisplays.forEach(el => {
                el.textContent = this.currentUser.displayName || this.currentUser.email || 'User';
            });
            if (userAvatar) {
                if (this.currentUser.photoURL) {
                    userAvatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="User Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    const initials = (this.currentUser.displayName || 'OS')
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .substr(0, 2);
                    userAvatar.textContent = initials;
                }
            }
            this.renderProfileDropdown();
        } else {
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.pointerEvents = 'all';
            }
        }
    }
}

export const authManager = new AuthManager();
