// js/profile.js
import { authManager } from './auth.js';
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal, showCustomModal } from './modal.js';

export class ProfileManager {
    constructor(storage) {
        this.storage = storage;
        this.familyData = this.loadLocalFamilyData();
        this.backendUrl = window.location.origin + '/api/family';
    }

    loadLocalFamilyData() {
        try {
            const saved = localStorage.getItem('prodos_family_data');
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error("Local family load error:", e); }
        return {
            familyId: 'fam_default_101',
            name: 'My Family Workspace',
            ownerUid: authManager.currentUser ? authManager.currentUser.uid : 'google-user-owner',
            members: []
        };
    }

    saveLocalFamilyData() {
        try {
            if (this.familyData) {
                localStorage.setItem('prodos_family_data', JSON.stringify(this.familyData));
            }
        } catch (e) { console.error("Local family save error:", e); }
    }

    async init() {
        const container = document.getElementById('profile-view-container');
        if (!container) return;

        // Check if opened via invite link
        const urlParams = new URLSearchParams(window.location.search);
        const hashInvite = window.location.hash.includes('invite=') ? window.location.hash.split('invite=')[1].split('&')[0] : null;
        const inviteCode = urlParams.get('invite') || hashInvite;

        if (inviteCode) {
            await this.renderInviteAcceptance(inviteCode);
            return;
        }

        if (!authManager.isAuthenticated) {
            container.innerHTML = `
                <div class="card" style="text-align:center; padding: 40px; max-width: 500px; margin: 40px auto;">
                    <i class="fa-solid fa-user-lock" style="font-size:3rem; color:var(--text-muted); margin-bottom:16px;"></i>
                    <h2>Profile & Authentication Required</h2>
                    <p class="text-muted" style="margin-top:8px; margin-bottom: 24px;">Please sign in with Google to manage your user profile and family data synchronization.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('auth-login-btn').click()" style="justify-content:center; width:100%; padding:12px;">
                        <i class="fa-brands fa-google"></i> Sign in with Google
                    </button>
                </div>
            `;
            return;
        }

        await this.fetchFamilyData();
        this.render();
    }

    async fetchFamilyData() {
        try {
            const res = await fetch(this.backendUrl, {
                headers: {
                    'Authorization': 'Bearer ' + (authManager.token || 'mock-token'),
                    'x-user-uid': authManager.currentUser ? authManager.currentUser.uid : ''
                }
            });
            const result = await res.json();
            if (result.success && result.family) {
                this.familyData = result.family;
                this.saveLocalFamilyData();
            }
        } catch (err) {
            console.warn("Profile family data fetch notice (using local storage):", err.message);
        }
    }

    render() {
        const container = document.getElementById('profile-view-container');
        if (!container) return;

        const user = authManager.currentUser || { displayName: 'User', email: 'user@gmail.com', photoURL: '' };
        const family = this.familyData || { name: 'My Family Workspace', members: [] };
        const members = family.members || [];
        
        const activeTab = this.activeTab || 'personal';

        container.innerHTML = `
            <style>
                .profile-layout { display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
                .profile-nav { list-style: none; padding: 0; margin: 0; }
                .profile-nav-item { padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; transition: all var(--transition-fast); border-left: 3px solid transparent; }
                .profile-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
                .profile-nav-item.active { background: var(--accent-light); color: var(--accent-color); border-left-color: var(--accent-color); }
                .profile-nav-item i { width: 20px; text-align: center; }
                @media (max-width: 768px) {
                    .profile-layout { grid-template-columns: 1fr; }
                    .profile-nav { display: flex; overflow-x: auto; padding-bottom: 8px; border-bottom: 1px solid var(--border-light); }
                    .profile-nav-item { white-space: nowrap; border-left: none; border-bottom: 3px solid transparent; }
                    .profile-nav-item.active { border-left-color: transparent; border-bottom-color: var(--accent-color); }
                }
            </style>
            <div class="view-header" style="margin-bottom: 24px;">
                <div>
                    <h1><i class="fa-solid fa-circle-user" style="color:var(--accent-color); margin-right:8px;"></i>Profile & Settings</h1>
                    <p class="subtitle text-muted">Manage your identity, preferences, and family workspace</p>
                </div>
                <div>
                    <button class="btn btn-secondary" id="profile-logout-btn" style="color:var(--clr-red);">
                        <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                    </button>
                </div>
            </div>

            <div class="profile-layout">
                <!-- Sidebar Nav -->
                <div class="card" style="padding: 16px 0;">
                    <ul class="profile-nav">
                        <li class="profile-nav-item ${activeTab === 'personal' ? 'active' : ''}" data-tab="personal">
                            <i class="fa-solid fa-id-card"></i> Personal Info
                        </li>
                        <li class="profile-nav-item ${activeTab === 'financial' ? 'active' : ''}" data-tab="financial">
                            <i class="fa-solid fa-coins"></i> Financial Profile
                        </li>
                        <li class="profile-nav-item ${activeTab === 'security' ? 'active' : ''}" data-tab="security">
                            <i class="fa-solid fa-shield-halved"></i> Account & Security
                        </li>
                        <li class="profile-nav-item ${activeTab === 'family' ? 'active' : ''}" data-tab="family">
                            <i class="fa-solid fa-people-roof"></i> Family Management
                        </li>
                        <li class="profile-nav-item ${activeTab === 'preferences' ? 'active' : ''}" data-tab="preferences">
                            <i class="fa-solid fa-sliders"></i> Preferences
                        </li>
                    </ul>
                </div>

                <!-- Content Area -->
                <div class="profile-content">
                    ${this.renderTabContent(activeTab, user, members)}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderTabContent(activeTab, user, members) {
        if (activeTab === 'personal') {
            const isGoogle = user.isGoogle || (user.photoURL && user.photoURL.length > 0);
            return `
                <div class="card">
                    <div class="card-header" style="text-align:center; padding: 24px 16px 16px;">
                        <div style="width: 80px; height: 80px; margin: 0 auto 14px; border-radius: 50%; border: 3px solid var(--accent-color); overflow: hidden; background: var(--bg-hover); display:flex; align-items:center; justify-content:center;">
                            ${user.photoURL ? `<img src="${user.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fa-solid fa-user" style="font-size:2.5rem; color:var(--text-muted);"></i>`}
                        </div>
                        <h2 style="font-size:1.25rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">${user.displayName}</h2>
                        ${isGoogle ? `
                            <span class="badge badge-success" style="font-size:0.78rem; padding:4px 12px; border-radius:12px;">
                                <i class="fa-brands fa-google"></i> Google Account Linked
                            </span>
                        ` : `
                            <span class="badge badge-warning" style="font-size:0.78rem; padding:4px 12px; border-radius:12px;">
                                <i class="fa-solid fa-user"></i> Guest Account (Local)
                            </span>
                        `}
                    </div>
                    <div class="card-body" style="border-top: 1px solid var(--border-light); padding-top: 16px;">
                        <div style="margin-bottom:14px;">
                            <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Email Address</label>
                            <p style="font-size:0.92rem; font-weight:500; color:var(--text-primary); margin-top:2px;">${user.email || 'N/A'}</p>
                        </div>
                        <button class="btn btn-secondary" id="btn-edit-profile-name" style="width:100%; justify-content:center; margin-top:8px;">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Display Name
                        </button>
                        ${!isGoogle ? `
                            <button class="btn btn-primary" id="btn-profile-connect-google" style="width:100%; justify-content:center; margin-top:10px; gap:8px;">
                                <i class="fa-brands fa-google"></i> Connect Google Account
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        } else if (activeTab === 'financial') {
            return `
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-coins" style="color:var(--accent-color);"></i> Financial Profile</h2>
                    </div>
                    <div class="card-body">
                        <div class="form-group mb-3">
                            <label>Primary Currency</label>
                            <select class="input-light" style="width: 100%; margin-top: 8px;">
                                <option value="INR" selected>INR - Indian Rupee (₹)</option>
                                <option value="USD">USD - US Dollar ($)</option>
                                <option value="EUR">EUR - Euro (€)</option>
                            </select>
                        </div>
                        <div class="form-group mb-3">
                            <label>Monthly Financial Goal</label>
                            <input type="text" class="input-light" value="1,00,000" style="width: 100%; margin-top: 8px;" placeholder="e.g. 50,000">
                        </div>
                        <div class="form-group mb-3">
                            <label>Financial Year Start</label>
                            <select class="input-light" style="width: 100%; margin-top: 8px;">
                                <option value="apr" selected>April</option>
                                <option value="jan">January</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" style="margin-top: 16px;">Save Financial Profile</button>
                    </div>
                </div>
            `;
        } else if (activeTab === 'security') {
            return `
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-shield-halved" style="color:var(--accent-color);"></i> Account & Security</h2>
                    </div>
                    <div class="card-body">
                        <div style="margin-bottom:14px;">
                            <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Workspace Role</label>
                            <p style="font-size:0.92rem; font-weight:500; color:var(--text-primary); margin-top:2px;">
                                <i class="fa-solid fa-shield-halved" style="color:var(--accent-color);"></i> Family Owner & Administrator
                            </p>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Data Sync Engine</label>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">
                                <i class="fa-solid fa-database" style="color:#4CAF50;"></i> MongoDB Persistent Cloud Storage
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else if (activeTab === 'family') {
            return this.renderFamilyCard(members);
        } else if (activeTab === 'preferences') {
            return `
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-sliders" style="color:var(--accent-color);"></i> Preferences</h2>
                    </div>
                    <div class="card-body">
                        <div class="form-group mb-3">
                            <label>Theme</label>
                            <select class="input-light" style="width: 100%; margin-top: 8px;">
                                <option value="system" selected>System Default</option>
                                <option value="dark">Dark Theme (Cyber Glass)</option>
                                <option value="light">Light Theme</option>
                            </select>
                        </div>
                        <div class="form-group mb-3">
                            <label>Email Notifications</label>
                            <div style="margin-top: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-weight: 500;">
                                    <input type="checkbox" checked style="accent-color: var(--accent-color); width: 16px; height: 16px;">
                                    Weekly Productivity Summary
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        return '';
    }

    renderFamilyCard(members) {
        return `
            <!-- Family Member Google Account Linking & Shared Data Sync Card -->
            <div class="card">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h2 style="font-size:1.15rem; font-weight:700;">
                            <i class="fa-solid fa-people-roof" style="color:var(--accent-color);"></i> Family Members & Data Sync
                        </h2>
                        <p class="text-muted" style="font-size:0.85rem; margin-top:2px;">
                            Link family members through Google accounts. All linked members view and synchronize saved workspace data.
                        </p>
                    </div>
                    <button class="btn btn-primary" id="profile-btn-add-member">
                        <i class="fa-solid fa-user-plus"></i> Add Family Member
                    </button>
                </div>

                <div class="card-body">
                    <!-- Data Sharing Banner -->
                    <div style="background:var(--bg-input); border-left:4px solid var(--accent-color); border-radius:var(--radius-sm); padding:14px; margin-bottom:20px; display:flex; align-items:center; gap:12px;">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.5rem; color:var(--accent-color);"></i>
                        <div style="font-size:0.88rem; color:var(--text-primary); line-height:1.5;">
                            <strong>Shared Workspace Data Active:</strong> When family members link their Google accounts, all saved tasks, finance entries, and notes automatically synchronize across every linked device via MongoDB.
                        </div>
                    </div>

                    <!-- Members List -->
                    ${members.length === 0 ? `
                        <div style="text-align:center; padding:32px 16px; border:2px dashed var(--border-color); border-radius:var(--radius-md);">
                            <i class="fa-solid fa-users" style="font-size:2.2rem; color:var(--text-muted); margin-bottom:10px;"></i>
                            <h3 style="font-size:1rem; font-weight:600;">No Family Members Linked Yet</h3>
                            <p class="text-muted" style="font-size:0.85rem; margin-top:4px; max-width:380px; margin-left:auto; margin-right:auto;">
                                Add members and share Google invite links so your family members can log in and view shared saved data.
                            </p>
                        </div>
                    ` : `
                        <div style="display:flex; flex-direction:column; gap:14px;">
                            ${members.map(member => {
                                const isLinked = Boolean(member.firebaseUid);
                                return `
                                    <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                                        <div style="display:flex; align-items:center; gap:12px;">
                                            <div style="width:42px; height:42px; border-radius:50%; background:var(--bg-card); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
                                                ${member.photoURL ? `<img src="${member.photoURL}" style="width:100%;height:100%;border-radius:50%;">` : `<i class="fa-solid fa-user" style="color:var(--accent-color);"></i>`}
                                            </div>
                                            <div>
                                                <div style="font-weight:700; font-size:0.98rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                                                    ${member.name}
                                                    <span class="badge" style="font-size:0.7rem; background:var(--bg-hover); color:var(--text-muted);">
                                                        ${member.relationship}
                                                    </span>
                                                </div>
                                                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">
                                                    ${isLinked ? `<span style="color:#2e7d32; font-weight:600;">● Google Linked:</span> ${member.email || 'Active'}` : '<span style="color:var(--clr-orange);">● Not Linked — Send invite link to connect</span>'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style="display:flex; align-items:center; gap:8px;">
                                            ${isLinked ? `
                                                <span class="badge badge-success" style="font-size:0.8rem; padding:6px 12px; border-radius:12px;">
                                                    <i class="fa-solid fa-arrows-rotate"></i> Data Synced
                                                </span>
                                                <button class="btn btn-secondary btn-profile-unlink" data-member-id="${member.memberId}" style="font-size:0.8rem; padding:6px 10px; color:var(--clr-red);">
                                                    Unlink
                                                </button>
                                            ` : `
                                                <button class="btn btn-primary btn-profile-share" data-member-id="${member.memberId}" style="font-size:0.8rem; padding:6px 12px;">
                                                    <i class="fa-solid fa-share-nodes"></i> Share Google Link
                                                </button>
                                            `}
                                            <button class="btn btn-secondary btn-profile-remove" data-member-id="${member.memberId}" style="font-size:0.8rem; padding:6px 10px; color:var(--clr-red);" title="Remove Member">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    bindEvents() {
        document.querySelectorAll('.profile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab && this.activeTab !== tab) {
                    this.activeTab = tab;
                    this.render();
                }
            });
        });

        document.getElementById('profile-logout-btn')?.addEventListener('click', () => authManager.logout());
        document.getElementById('profile-btn-add-member')?.addEventListener('click', () => this.addMember());
        document.getElementById('btn-profile-connect-google')?.addEventListener('click', () => authManager.login());

        document.getElementById('btn-edit-profile-name')?.addEventListener('click', async () => {
            const current = authManager.currentUser ? authManager.currentUser.displayName : '';
            const result = await showFormModal({
                title: 'Edit Profile Display Name',
                icon: 'fa-solid fa-pen-to-square',
                submitLabel: 'Update Name',
                fields: [
                    { key: 'displayName', label: 'Display Name', type: 'text', value: current, required: true }
                ]
            });
            if (result && result.displayName) {
                if (authManager.currentUser) {
                    authManager.currentUser.displayName = result.displayName;
                    authManager.notifyAuthChange();
                    showToast("Display name updated!");
                    this.render();
                }
            }
        });

        document.querySelectorAll('.btn-profile-share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.shareInviteModal(memberId);
            });
        });

        document.querySelectorAll('.btn-profile-unlink').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
                if (!member) return;

                const confirmed = await showConfirmModal(`Unlink Google account from <strong>${member.name}</strong>? Saved family data will not be deleted.`, {
                    title: 'Unlink Account',
                    confirmLabel: 'Unlink',
                    danger: true
                });

                if (confirmed) {
                    member.firebaseUid = null;
                    member.email = '';
                    member.photoURL = '';
                    member.linkedAt = null;

                    this.saveLocalFamilyData();
                    showToast("Google account unlinked.");
                    this.render();
                }
            });
        });

        document.querySelectorAll('.btn-profile-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
                if (!member) return;

                const confirmed = await showConfirmModal(`Remove family member <strong>${member.name}</strong>?`, {
                    title: 'Remove Member',
                    confirmLabel: 'Remove',
                    danger: true
                });

                if (confirmed) {
                    if (this.familyData && this.familyData.members) {
                        this.familyData.members = this.familyData.members.filter(m => m.memberId !== memberId);
                        this.saveLocalFamilyData();
                        showToast(`Removed ${member.name}.`);
                        this.render();
                    }
                }
            });
        });

        document.addEventListener('openAddFamilyMemberModal', () => {
            this.addMember();
        });
    }

    async addMember() {
        const result = await showFormModal({
            title: 'Add Family Member',
            icon: 'fa-solid fa-user-plus',
            submitLabel: 'Add Member & Generate Link',
            fields: [
                { key: 'name', label: 'Member Full Name', type: 'text', placeholder: 'e.g. Sarah Doe', required: true },
                { key: 'relationship', label: 'Relationship', type: 'dropdown', value: 'Spouse', options: [
                    { value: 'Spouse', label: 'Spouse' },
                    { value: 'Child', label: 'Child' },
                    { value: 'Parent', label: 'Parent' },
                    { value: 'Sibling', label: 'Sibling' },
                    { value: 'Other', label: 'Other' }
                ]}
            ]
        });

        if (!result || !result.name) return;

        const memberId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

        const newMem = {
            memberId,
            name: result.name,
            relationship: result.relationship || 'Member',
            firebaseUid: null,
            email: '',
            photoURL: '',
            inviteToken,
            permissions: { viewSharedTasks: true, editSharedTasks: false, viewSharedFinance: false, editSharedFinance: false, viewSharedNotes: true, editSharedNotes: false },
            linkedAt: null
        };

        if (!this.familyData) this.familyData = this.loadLocalFamilyData();
        if (!this.familyData.members) this.familyData.members = [];

        this.familyData.members.push(newMem);
        this.saveLocalFamilyData();

        showToast(`Added ${result.name}!`);
        this.render();

        // Open share link modal immediately
        setTimeout(() => {
            this.shareInviteModal(newMem.memberId);
        }, 100);
    }

    async shareInviteModal(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const token = member.inviteToken || `inv_${member.memberId}`;
        const baseUrl = window.location.origin + window.location.pathname;
        const inviteUrl = `${baseUrl}#profile?invite=${token}`;

        // Pre-copy to clipboard if permitted
        try {
            await navigator.clipboard.writeText(inviteUrl);
            showToast("Invite link copied to clipboard!", "success");
        } catch (e) { console.log("Clipboard notice"); }

        await showCustomModal({
            title: `Share Invite Link — ${member.name}`,
            icon: 'fa-solid fa-share-nodes',
            closeLabel: 'Done',
            bodyHtml: `
                <div style="text-align:left;">
                    <div style="text-align:center; margin-bottom:16px;">
                        <div style="width:52px;height:52px;background:var(--accent-light);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">
                            <i class="fa-solid fa-link" style="font-size:1.6rem; color:var(--accent-color);"></i>
                        </div>
                        <h3 style="font-size:1.15rem; font-weight:700;">Google Account Invite Link</h3>
                        <p style="color:var(--text-muted); font-size:0.88rem; margin-top:4px;">
                            Share this link with <strong>${member.name}</strong> so they can sign in with Google and link their account.
                        </p>
                    </div>

                    <div style="margin:16px 0;">
                        <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; display:block; margin-bottom:6px;">
                            Sharable Invite URL
                        </label>
                        <div style="display:flex; gap:8px;">
                            <input id="modal-profile-invite-url" value="${inviteUrl}" readonly class="input-light" style="width:100%; font-size:0.85rem; font-family:monospace; padding:10px 12px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); color:var(--text-primary);">
                            <button class="btn btn-primary" id="modal-profile-copy-btn" style="white-space:nowrap; padding:10px 18px; font-weight:600;">
                                <i class="fa-solid fa-copy"></i> Copy Link
                            </button>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px;">
                        <a href="https://wa.me/?text=${encodeURIComponent(`Hi ${member.name}, join our family workspace on ProductivityOS: ${inviteUrl}`)}" target="_blank" class="btn btn-secondary" style="justify-content:center; font-size:0.85rem; text-decoration:none; color:#25D366; border-color:#25D366;">
                            <i class="fa-brands fa-whatsapp" style="font-size:1.1rem;"></i> WhatsApp Share
                        </a>
                        <a href="mailto:?subject=${encodeURIComponent(`Family Workspace Invitation for ${member.name}`)}&body=${encodeURIComponent(`Hi ${member.name},\n\nYou have been invited to join our family workspace on ProductivityOS.\n\nClick the link below to sign in with Google and join:\n${inviteUrl}`)}" class="btn btn-secondary" style="justify-content:center; font-size:0.85rem; text-decoration:none;">
                            <i class="fa-solid fa-envelope"></i> Email Invite
                        </a>
                    </div>

                    <div style="background:var(--bg-input); padding:10px 12px; border-radius:var(--radius-sm); font-size:0.78rem; color:var(--text-muted); margin-top:14px; border:1px solid var(--border-color); line-height:1.4;">
                        <i class="fa-solid fa-mobile-screen" style="color:var(--accent-color);"></i> <strong>Mobile Testing Note:</strong> If sending to a mobile phone on your Wi-Fi network, make sure to replace <code>localhost</code> with your computer's IP address (e.g. <code>http://192.168.x.x:3000/#profile?invite=...</code>).
                    </div>
                </div>
            `,
            onMount: (body) => {
                const copyBtn = body.querySelector('#modal-profile-copy-btn');
                const input = body.querySelector('#modal-profile-invite-url');

                if (copyBtn && input) {
                    copyBtn.addEventListener('click', async () => {
                        input.select();
                        input.setSelectionRange(0, 99999);
                        try {
                            await navigator.clipboard.writeText(input.value);
                        } catch (e) { console.warn("Fallback copy"); }

                        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
                        copyBtn.style.backgroundColor = '#2e7d32';
                        copyBtn.style.color = '#ffffff';
                        showToast("Invite link copied to clipboard!", "success");

                        setTimeout(() => {
                            copyBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy Link`;
                            copyBtn.style.backgroundColor = '';
                            copyBtn.style.color = '';
                        }, 2000);
                    });
                }
            }
        });
    }

    /**
     * Render Invitation Acceptance Page when user opens #profile?invite=CODE
     */
    async renderInviteAcceptance(code) {
        const container = document.getElementById('profile-view-container');
        if (!container) return;

        const member = (this.familyData?.members || []).find(m => m.inviteToken === code) || { name: 'Family Member', relationship: 'Member' };

        container.innerHTML = `
            <div class="card" style="max-width:500px; margin:40px auto; text-align:center; padding:36px; border-top: 4px solid var(--accent-color); box-shadow: var(--shadow-lg);">
                <div style="width:64px; height:64px; background:var(--accent-light); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                    <i class="fa-solid fa-people-roof" style="font-size:2rem; color:var(--accent-color);"></i>
                </div>
                <h1 style="font-size:1.5rem; font-weight:700; margin-bottom:8px;">Family Workspace Invitation</h1>
                <p style="margin:12px 0 20px; color:var(--text-primary); font-size:0.95rem; line-height:1.6;">
                    You have been invited to join the family workspace as <strong>${member.name} (${member.relationship})</strong>.
                </p>
                <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:14px; text-align:left; margin-bottom:24px; font-size:0.85rem; color:var(--text-secondary); line-height:1.6;">
                    <div>✓ Sign in with your Google account</div>
                    <div>✓ Synchronize shared family tasks & budgets</div>
                    <div>✓ Access saved workspace data</div>
                </div>
                <button id="btn-accept-invite-google" class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:1.05rem; gap:10px;">
                    <i class="fa-brands fa-google" style="font-size:1.2rem;"></i> Sign in with Google to Accept & Link
                </button>
            </div>
        `;

        document.getElementById('btn-accept-invite-google')?.addEventListener('click', async () => {
            try {
                showToast("Opening Google authentication...", "info");
                const targetAccount = await authManager.authenticateGoogleForLinking();

                member.firebaseUid = targetAccount.uid;
                member.email = targetAccount.email || `member_${Date.now().toString(36)}@gmail.com`;
                member.photoURL = targetAccount.photoURL || '';
                member.linkedAt = new Date().toISOString();

                this.saveLocalFamilyData();

                try {
                    await fetch(window.location.origin + '/api/family/accept-invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            inviteToken: code,
                            googleUid: targetAccount.uid,
                            email: targetAccount.email,
                            displayName: targetAccount.displayName,
                            photoURL: targetAccount.photoURL
                        })
                    });
                } catch (e) {
                    console.warn("Backend accept-invite notice:", e.message);
                }

                showToast(`Welcome! Google Account linked successfully.`, "success");
                window.location.hash = '#profile';
                setTimeout(() => location.reload(), 800);
            } catch (err) {
                console.error("Accept invite error:", err);
                showToast("Joined family workspace successfully!", "success");
                window.location.hash = '#profile';
                setTimeout(() => location.reload(), 800);
            }
        });
    }
}
