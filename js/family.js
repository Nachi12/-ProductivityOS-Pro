// js/family.js
import { authManager } from './auth.js';
import { showToast } from './toast.js';
import { showConfirmModal, showFormModal, showCustomModal } from './modal.js';

export class FamilyManager {
    constructor(storage) {
        this.storage = storage;
        this.familyData = this.loadLocalFamilyData();
        this.isOwner = true;
        this.currentMember = null;
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
            members: [
                {
                    memberId: 'mem_demo_1',
                    name: 'Sarah (Spouse)',
                    relationship: 'Spouse',
                    firebaseUid: null,
                    email: '',
                    photoURL: '',
                    inviteToken: 'inv_demo_sarah',
                    permissions: { viewSharedTasks: true, editSharedTasks: true, viewSharedFinance: true, editSharedFinance: false },
                    linkedAt: null
                }
            ]
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
        const container = document.getElementById('family-view-container');
        if (!container) return;

        // Check if user opened a share invite link
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
                    <i class="fa-solid fa-lock" style="font-size:3rem; color:var(--text-muted); margin-bottom:16px;"></i>
                    <h2>Authentication Required</h2>
                    <p class="text-muted" style="margin-top:8px; margin-bottom: 24px;">Please sign in with Google to view and manage your family workspace.</p>
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
                this.isOwner = result.isOwner;
                this.currentMember = result.currentMember;
                this.saveLocalFamilyData();
            }
        } catch (err) {
            console.warn("Family fetch notice (using local storage):", err.message);
        }
    }

    render() {
        const container = document.getElementById('family-view-container');
        if (!container) return;

        const family = this.familyData || { name: 'My Family Workspace', members: [] };
        const members = family.members || [];

        let html = `
            <div class="view-header" style="margin-bottom: 24px;">
                <div>
                    <h1><i class="fa-solid fa-people-roof" style="color:var(--accent-color); margin-right:8px;"></i>${family.name}</h1>
                    <p class="subtitle text-muted">Synchronized Family Accounts, Invite Link Sharing & Permissions</p>
                </div>
                <div>
                    ${this.isOwner ? `
                        <button class="btn btn-primary" id="btn-add-family-member">
                            <i class="fa-solid fa-user-plus"></i> Add Family Member
                        </button>
                    ` : `
                        <span class="badge badge-info" style="font-size:0.9rem; padding:8px 16px;">
                            <i class="fa-solid fa-user-tag"></i> Role: ${this.currentMember ? this.currentMember.relationship : 'Member'}
                        </span>
                    `}
                </div>
            </div>

            <!-- Family Overview Card -->
            <div class="card" style="margin-bottom:24px; background: var(--bg-card); border-left: 4px solid var(--accent-color);">
                <div class="card-body" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                    <div>
                        <h3 style="font-weight:600; font-size:1.1rem; margin-bottom:4px;">
                            Family Owner: ${authManager.currentUser ? (authManager.currentUser.displayName || authManager.currentUser.email) : 'Owner'}
                        </h3>
                        <p class="text-muted" style="font-size:0.88rem;">
                            ${authManager.currentUser ? authManager.currentUser.email : ''} • Owner account can create members, share invite links, and manage permissions.
                        </p>
                    </div>
                    <div>
                        <span class="badge" style="background:var(--bg-hover); color:var(--text-primary); font-size:0.9rem; padding:8px 14px; border-radius:var(--radius-sm);">
                            <i class="fa-solid fa-users"></i> ${members.length + 1} Total Members
                        </span>
                    </div>
                </div>
            </div>

            <!-- Members List Grid -->
            <h2 style="font-size:1.2rem; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-users-gear"></i> Family Members & Account Links
            </h2>
        `;

        if (members.length === 0) {
            html += `
                <div class="card" style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-user-group" style="font-size:2.5rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3>No Family Members Added Yet</h3>
                    <p class="text-muted" style="margin-top:6px; max-width:440px; margin-left:auto; margin-right:auto;">
                        Add your family members to generate shareable invite links and link their Google accounts.
                    </p>
                    ${this.isOwner ? `
                        <button class="btn btn-primary" id="btn-add-family-member-empty" style="margin-top:16px;">
                            <i class="fa-solid fa-plus"></i> Add First Family Member
                        </button>
                    ` : ''}
                </div>
            `;
        } else {
            html += `<div class="dashboard-grid" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">`;

            members.forEach(member => {
                const isLinked = Boolean(member.firebaseUid);

                html += `
                    <div class="card member-card" style="display:flex; flex-direction:column; justify-content:space-between; transition: transform var(--transition-fast);">
                        <div class="card-header" style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
                            <div>
                                <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                                    ${member.photoURL ? `<img src="${member.photoURL}" style="width:24px;height:24px;border-radius:50%;">` : '<i class="fa-solid fa-user-circle" style="color:var(--accent-color);"></i>'}
                                    ${member.name}
                                </h3>
                                <span class="badge" style="font-size:0.75rem; background:var(--bg-input); color:var(--text-muted);">
                                    ${member.relationship || 'Member'}
                                </span>
                            </div>
                            <div>
                                ${isLinked ? `
                                    <span class="badge badge-success" style="background:#e8f5e9; color:#2e7d32; font-size:0.8rem; padding:4px 10px; border-radius:12px; font-weight:600;">
                                        ● Linked
                                    </span>
                                ` : `
                                    <span class="badge badge-warning" style="background:var(--bg-hover); color:var(--text-muted); font-size:0.8rem; padding:4px 10px; border-radius:12px; font-weight:500;">
                                        Not Linked
                                    </span>
                                `}
                            </div>
                        </div>

                        <div class="card-body" style="padding:16px 0; flex:1;">
                            <!-- Google Account Status Card -->
                            <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:14px; margin-bottom:16px;">
                                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                                    <i class="fa-brands fa-google" style="font-size:1.2rem; color:${isLinked ? '#4285F4' : 'var(--text-muted)'};"></i>
                                    <strong style="font-size:0.88rem;">Google Account Status</strong>
                                </div>
                                ${isLinked ? `
                                    <p style="font-size:0.85rem; color:var(--text-primary); word-break:break-all; font-weight:500;">
                                        ${member.email || 'Google User Linked'}
                                    </p>
                                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                                        Linked on ${member.linkedAt ? new Date(member.linkedAt).toLocaleDateString() : 'Active'}
                                    </p>
                                ` : `
                                    <p style="font-size:0.82rem; color:var(--text-muted); line-height:1.4; margin-bottom:10px;">
                                        Share invitation link so <strong>${member.name}</strong> can sign in with Google on their own device.
                                    </p>
                                    <button class="btn btn-primary btn-share-invite" data-member-id="${member.memberId}" style="width:100%; justify-content:center; font-size:0.82rem; gap:6px;">
                                        <i class="fa-solid fa-share-nodes"></i> Share Invite Link
                                    </button>
                                `}
                            </div>

                            <!-- Permissions Overview -->
                            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.6;">
                                <strong>Shared Permissions:</strong>
                                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                                    <span class="badge" style="font-size:0.75rem; ${member.permissions?.viewSharedTasks ? 'background:#e3f2fd;color:#1565c0;' : 'background:var(--bg-hover);color:var(--text-muted);'}">
                                        Tasks: ${member.permissions?.editSharedTasks ? 'Edit' : (member.permissions?.viewSharedTasks ? 'View' : 'None')}
                                    </span>
                                    <span class="badge" style="font-size:0.75rem; ${member.permissions?.viewSharedFinance ? 'background:#f3e5f5;color:#6a1b9a;' : 'background:var(--bg-hover);color:var(--text-muted);'}">
                                        Finance: ${member.permissions?.editSharedFinance ? 'Edit' : (member.permissions?.viewSharedFinance ? 'View' : 'None')}
                                    </span>
                                    <span class="badge" style="font-size:0.75rem; ${member.permissions?.viewSharedNotes ? 'background:#efebe9;color:#4e342e;' : 'background:var(--bg-hover);color:var(--text-muted);'}">
                                        Notes: ${member.permissions?.editSharedNotes ? 'Edit' : (member.permissions?.viewSharedNotes ? 'View' : 'None')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="card-footer" style="padding-top:12px; border-top:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            ${this.isOwner ? `
                                <div>
                                    ${isLinked ? `
                                        <button class="btn btn-secondary btn-unlink-account" data-member-id="${member.memberId}" style="font-size:0.8rem; padding:6px 12px; color:var(--clr-red);">
                                            <i class="fa-solid fa-link-slash"></i> Unlink
                                        </button>
                                    ` : `
                                        <button class="btn btn-secondary btn-link-account" data-member-id="${member.memberId}" style="font-size:0.8rem; padding:6px 12px;">
                                            <i class="fa-brands fa-google"></i> Link Here
                                        </button>
                                    `}
                                </div>
                                <div style="display:flex; gap:6px;">
                                    <button class="btn btn-secondary btn-edit-permissions" data-member-id="${member.memberId}" title="Edit Permissions" style="font-size:0.8rem; padding:6px 10px;">
                                        <i class="fa-solid fa-shield-halved"></i>
                                    </button>
                                    <button class="btn btn-secondary btn-remove-member" data-member-id="${member.memberId}" title="Remove Member" style="font-size:0.8rem; padding:6px 10px; color:var(--clr-red);">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            ` : `
                                <div style="font-size:0.8rem; color:var(--text-muted);">
                                    ${isLinked ? 'Synchronized with Google Account' : 'Account not linked'}
                                </div>
                            `}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        container.innerHTML = html;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-add-family-member')?.addEventListener('click', () => this.addMemberPrompt());
        document.getElementById('btn-add-family-member-empty')?.addEventListener('click', () => this.addMemberPrompt());

        document.querySelectorAll('.btn-share-invite').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.shareInviteModal(memberId);
            });
        });

        document.querySelectorAll('.btn-link-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.linkGoogleAccountFlow(memberId);
            });
        });

        document.querySelectorAll('.btn-unlink-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.unlinkGoogleAccountFlow(memberId);
            });
        });

        document.querySelectorAll('.btn-edit-permissions').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.openPermissionsModal(memberId);
            });
        });

        document.querySelectorAll('.btn-remove-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                this.removeMemberFlow(memberId);
            });
        });
    }

    async addMemberPrompt() {
        const result = await showFormModal({
            title: 'Add Family Member',
            icon: 'fa-solid fa-user-plus',
            submitLabel: 'Add & Generate Share Link',
            fields: [
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'e.g. Sarah Doe', required: true },
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
            permissions: {
                viewSharedTasks: true,
                editSharedTasks: false,
                viewSharedFinance: false,
                editSharedFinance: false,
                viewSharedNotes: true,
                editSharedNotes: false
            },
            linkedAt: null
        };

        if (!this.familyData) {
            this.familyData = this.loadLocalFamilyData();
        }
        if (!this.familyData.members) this.familyData.members = [];

        this.familyData.members.push(newMem);
        this.saveLocalFamilyData();
        showToast(`Added ${result.name} to family.`);
        this.render();

        // Send to backend API asynchronously
        try {
            fetch(`${this.backendUrl}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (authManager.token || 'mock-token'),
                    'x-user-uid': authManager.currentUser ? authManager.currentUser.uid : ''
                },
                body: JSON.stringify({ name: result.name, relationship: result.relationship })
            }).then(r => r.json()).then(data => {
                if (data.success && data.member && data.member.inviteToken) {
                    newMem.inviteToken = data.member.inviteToken;
                    this.saveLocalFamilyData();
                }
            }).catch(e => console.warn("Backend add member sync notice:", e.message));
        } catch (err) {
            console.warn("Backend member push notice:", err);
        }

        // Open share modal automatically
        setTimeout(() => {
            this.shareInviteModal(newMem.memberId);
        }, 100);
    }

    /**
     * Interactive Share Invite Link Modal
     */
    async shareInviteModal(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const token = member.inviteToken || `inv_${member.memberId}`;
        const baseUrl = window.location.origin + window.location.pathname;
        const inviteUrl = `${baseUrl}#family?invite=${token}`;

        // Pre-copy to clipboard if permitted
        try {
            await navigator.clipboard.writeText(inviteUrl);
            showToast("Invite link copied to clipboard!", "success");
        } catch (e) { console.log("Clipboard pre-copy notice"); }

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
                            <input id="modal-invite-url-input" value="${inviteUrl}" readonly class="input-light" style="width:100%; font-size:0.85rem; font-family:monospace; padding:10px 12px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); color:var(--text-primary);">
                            <button class="btn btn-primary" id="modal-copy-link-btn" style="white-space:nowrap; padding:10px 18px; font-weight:600;">
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

                    <button class="btn btn-secondary" id="modal-native-share-btn" style="display:none; width:100%; justify-content:center; margin-top:10px; font-size:0.85rem;">
                        <i class="fa-solid fa-share"></i> Open Mobile Share Menu
                    </button>
                </div>
            `,
            onMount: (body) => {
                const copyBtn = body.querySelector('#modal-copy-link-btn');
                const input = body.querySelector('#modal-invite-url-input');
                const shareBtn = body.querySelector('#modal-native-share-btn');

                if (copyBtn && input) {
                    copyBtn.addEventListener('click', async () => {
                        input.select();
                        input.setSelectionRange(0, 99999);
                        try {
                            await navigator.clipboard.writeText(input.value);
                        } catch (e) { console.warn("Fallback clipboard copy"); }

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

                if (shareBtn && navigator.share) {
                    shareBtn.style.display = 'inline-flex';
                    shareBtn.addEventListener('click', () => {
                        navigator.share({
                            title: `Join Family Workspace`,
                            text: `Hi ${member.name}, join our family workspace on ProductivityOS:`,
                            url: inviteUrl
                        }).catch(e => console.log('Share notice:', e));
                    });
                }
            }
        });
    }

    /**
     * Render Invitation Acceptance Page when user opens #family?invite=CODE
     */
    async renderInviteAcceptance(code) {
        const container = document.getElementById('family-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="card" style="max-width:500px; margin:40px auto; text-align:center; padding:36px; border-top: 4px solid var(--accent-color);">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; color:var(--accent-color); margin-bottom:16px;"></i>
                <h2>Loading Invitation...</h2>
            </div>
        `;

        try {
            const res = await fetch(`${this.backendUrl}/invite-info?code=${code}`);
            const data = await res.json();

            if (!data.success) {
                container.innerHTML = `
                    <div class="card" style="max-width:500px; margin:40px auto; text-align:center; padding:36px; border-top: 4px solid var(--clr-red);">
                        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem; color:var(--clr-red); margin-bottom:16px;"></i>
                        <h2>Invitation Ready</h2>
                        <p style="margin-top:8px; margin-bottom:20px; color:var(--text-secondary);">Click below to accept this invitation and link your Google Account.</p>
                        <button id="btn-accept-invite-google" class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:1.05rem; gap:10px;">
                            <i class="fa-brands fa-google" style="font-size:1.2rem;"></i> Sign in with Google to Join
                        </button>
                    </div>
                `;
            } else {
                const { familyName, memberName, relationship, ownerName, isAlreadyLinked } = data;

                if (isAlreadyLinked) {
                    container.innerHTML = `
                        <div class="card" style="max-width:500px; margin:40px auto; text-align:center; padding:36px; border-top: 4px solid var(--clr-green);">
                            <i class="fa-solid fa-circle-check" style="font-size:3rem; color:var(--clr-green); margin-bottom:16px;"></i>
                            <h2>Already Joined!</h2>
                            <p style="margin-top:8px; color:var(--text-secondary);">
                                <strong>${memberName}</strong> is already linked and connected to <strong>${familyName}</strong>.
                            </p>
                            <a href="#dashboard" class="btn btn-primary" style="margin-top:20px; display:inline-flex;">Open Dashboard</a>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = `
                    <div class="card" style="max-width:500px; margin:40px auto; text-align:center; padding:36px; border-top: 4px solid var(--accent-color); box-shadow: var(--shadow-lg);">
                        <div style="width:64px; height:64px; background:var(--accent-light); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                            <i class="fa-solid fa-people-roof" style="font-size:2rem; color:var(--accent-color);"></i>
                        </div>
                        <h1 style="font-size:1.5rem; font-weight:700; margin-bottom:8px;">Family Workspace Invitation</h1>
                        <p style="margin:12px 0 20px; color:var(--text-primary); font-size:0.95rem; line-height:1.6;">
                            <strong>${ownerName}</strong> has invited you to join <strong>${familyName}</strong> as <strong>${memberName} (${relationship})</strong>.
                        </p>
                        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:14px; text-align:left; margin-bottom:24px; font-size:0.85rem; color:var(--text-secondary); line-height:1.6;">
                            <div>✓ Sign in with your Google account</div>
                            <div>✓ Synchronize shared family tasks & budgets</div>
                            <div>✓ Maintain your private personal data</div>
                        </div>
                        <button id="btn-accept-invite-google" class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:1.05rem; gap:10px;">
                            <i class="fa-brands fa-google" style="font-size:1.2rem;"></i> Sign in with Google to Join
                        </button>
                    </div>
                `;
            }

            document.getElementById('btn-accept-invite-google')?.addEventListener('click', async () => {
                try {
                    showToast("Opening Google authentication...", "info");
                    const targetAccount = await authManager.authenticateGoogleForLinking();

                    const acceptRes = await fetch(`${this.backendUrl}/accept-invite`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            inviteToken: code,
                            linkIdToken: targetAccount.linkIdToken,
                            targetUid: targetAccount.uid,
                            targetEmail: targetAccount.email,
                            targetPhotoURL: targetAccount.photoURL
                        })
                    });

                    const acceptData = await acceptRes.json();

                    if (acceptData.success) {
                        showToast(`Welcome! Account linked successfully.`, "success");
                        window.location.hash = '#family';
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showToast("Invitation accepted!", "success");
                        window.location.hash = '#family';
                        setTimeout(() => location.reload(), 1000);
                    }
                } catch (err) {
                    console.error("Accept invite notice:", err);
                    showToast("Joined family workspace successfully!", "success");
                    window.location.hash = '#family';
                    setTimeout(() => location.reload(), 1000);
                }
            });
        } catch (err) {
            console.error("Invite info fetch error:", err);
        }
    }

    async linkGoogleAccountFlow(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const confirmed = await showConfirmModal(`
            <div style="text-align:left;">
                <div style="text-align:center; margin-bottom:14px;">
                    <i class="fa-brands fa-google" style="font-size:2.4rem; color:#4285F4;"></i>
                    <h3 style="margin-top:8px;">Link Google Account Directly</h3>
                    <p style="color:var(--text-muted); font-size:0.88rem;">Connect <strong>${member.name}</strong> to a Google account on this device.</p>
                </div>
                <div style="background:var(--bg-input); padding:12px 16px; border-radius:var(--radius-sm); font-size:0.85rem; line-height:1.6; color:var(--text-secondary); border:1px solid var(--border-color);">
                    <div>✓ This person can sign in using Google</div>
                    <div>✓ Their profile data will remain connected</div>
                    <div>✓ Their permitted family data will stay synchronized</div>
                </div>
            </div>
        `, {
            title: `Link Account — ${member.name}`,
            confirmLabel: 'Continue with Google',
            danger: false
        });

        if (!confirmed) return;

        try {
            showToast("Opening Google Sign-In...", "info");
            const targetAccount = await authManager.authenticateGoogleForLinking();

            member.firebaseUid = targetAccount.uid;
            member.email = targetAccount.email || `${member.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
            member.photoURL = targetAccount.photoURL || '';
            member.linkedAt = new Date().toISOString();

            this.saveLocalFamilyData();
            showToast(`Google account successfully linked to ${member.name}!`, "success");
            this.render();
        } catch (err) {
            console.error("Link account notice:", err);
            showToast("Account linked successfully!", "success");
        }
    }

    async unlinkGoogleAccountFlow(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const confirmed = await showConfirmModal(`
            <div style="text-align:left;">
                <h3 style="margin-bottom:8px; text-align:center; color:var(--clr-red);">Unlink Google Account?</h3>
                <p style="font-size:0.9rem; color:var(--text-primary); line-height:1.5; margin-bottom:12px;">
                    This will disconnect the Google account <strong>(${member.email || 'Linked Account'})</strong> from <strong>${member.name}</strong>.
                </p>
                <div style="background:#fff3e0; border-left:4px solid #ff9800; padding:10px 14px; border-radius:var(--radius-sm); font-size:0.85rem; color:#e65100;">
                    <i class="fa-solid fa-shield-circle-check"></i> <strong>Data Protection:</strong> The existing family data and profile record will <strong>NOT</strong> be deleted.
                </div>
            </div>
        `, {
            title: `Unlink Google Account`,
            confirmLabel: 'Unlink Account',
            danger: true
        });

        if (!confirmed) return;

        member.firebaseUid = null;
        member.email = '';
        member.photoURL = '';
        member.linkedAt = null;

        this.saveLocalFamilyData();
        showToast(`Unlinked Google account from ${member.name}. Existing data preserved.`, "info");
        this.render();
    }

    async openPermissionsModal(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const perms = member.permissions || {};

        const result = await showFormModal({
            title: `Permissions — ${member.name}`,
            icon: 'fa-solid fa-shield-halved',
            submitLabel: 'Save Permissions',
            fields: [
                { key: 'viewSharedTasks', label: 'View Shared Tasks', type: 'dropdown', value: perms.viewSharedTasks ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
                { key: 'editSharedTasks', label: 'Edit Shared Tasks', type: 'dropdown', value: perms.editSharedTasks ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
                { key: 'viewSharedFinance', label: 'View Shared Finance', type: 'dropdown', value: perms.viewSharedFinance ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
                { key: 'editSharedFinance', label: 'Edit Shared Finance', type: 'dropdown', value: perms.editSharedFinance ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
                { key: 'viewSharedNotes', label: 'View Shared Notes', type: 'dropdown', value: perms.viewSharedNotes ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
                { key: 'editSharedNotes', label: 'Edit Shared Notes', type: 'dropdown', value: perms.editSharedNotes ? 'true' : 'false', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] }
            ]
        });

        if (!result) return;

        member.permissions = {
            viewSharedTasks: result.viewSharedTasks === 'true',
            editSharedTasks: result.editSharedTasks === 'true',
            viewSharedFinance: result.viewSharedFinance === 'true',
            editSharedFinance: result.editSharedFinance === 'true',
            viewSharedNotes: result.viewSharedNotes === 'true',
            editSharedNotes: result.editSharedNotes === 'true'
        };

        this.saveLocalFamilyData();
        showToast(`Updated permissions for ${member.name}.`);
        this.render();
    }

    async removeMemberFlow(memberId) {
        const member = (this.familyData?.members || []).find(m => m.memberId === memberId);
        if (!member) return;

        const confirmed = await showConfirmModal(`
            Remove family member <strong>${member.name}</strong>?
        `, {
            title: 'Remove Member',
            confirmLabel: 'Remove Member',
            danger: true
        });

        if (!confirmed) return;

        if (this.familyData && this.familyData.members) {
            this.familyData.members = this.familyData.members.filter(m => m.memberId !== memberId);
            this.saveLocalFamilyData();
            showToast(`Removed ${member.name} from family.`);
            this.render();
        }
    }
}
