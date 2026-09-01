// js/notifications.js
import { showToast } from './toast.js';

export class NotificationManager {
    constructor(storage) {
        this.storage = storage;
        this.notifications = this.loadNotifications();
        this.isOpen = false;
        this.panelEl = null;

        this.initUI();
        this.bindEvents();
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('prodos_notifications');
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error("Load notifications error:", e); }

        return [
            {
                id: 'notif_1',
                title: 'Welcome to ProductivityOS Pro',
                message: 'Your Google workspace authentication and MongoDB synchronization are active.',
                type: 'success',
                timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                read: false
            },
            {
                id: 'notif_2',
                title: 'Family Data Shared Access',
                message: 'All linked family accounts share synchronized workspace data.',
                type: 'info',
                timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                read: false
            },
            {
                id: 'notif_3',
                title: 'Daily Productivity Ready',
                message: 'Track tasks, manage finance budgets, and monitor habits.',
                type: 'info',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                read: true
            }
        ];
    }

    saveNotifications() {
        try {
            localStorage.setItem('prodos_notifications', JSON.stringify(this.notifications));
        } catch (e) { console.error("Save notifications error:", e); }
        this.updateBadge();
    }

    addNotification(title, message, type = 'info') {
        const notif = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            title,
            message,
            type,
            timestamp: new Date().toISOString(),
            read: false
        };
        this.notifications.unshift(notif);
        if (this.notifications.length > 50) this.notifications.pop();
        this.saveNotifications();
        if (this.isOpen) this.renderPanel();
    }

    initUI() {
        const btn = document.getElementById('notifications-btn');
        if (!btn) return;

        btn.style.position = 'relative';

        // Add unread badge element
        let badge = btn.querySelector('.notification-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.style.cssText = `
                position: absolute; top: -2px; right: -2px;
                background: #f44336; color: #fff; font-size: 0.68rem;
                font-weight: 700; border-radius: 10px; padding: 2px 6px;
                line-height: 1; display: none; border: 2px solid var(--bg-main);
            `;
            btn.appendChild(badge);
        }

        // Create Panel Element
        this.panelEl = document.createElement('div');
        this.panelEl.id = 'notifications-panel';
        this.panelEl.style.cssText = `
            display: none; position: absolute; top: calc(var(--topbar-height) - 8px); right: 20px;
            width: 360px; max-width: calc(100vw - 32px); background: var(--bg-card);
            border: 1px solid var(--border-color); border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg); z-index: 10005; overflow: hidden;
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        `;
        document.body.appendChild(this.panelEl);

        this.updateBadge();
    }

    updateBadge() {
        const btn = document.getElementById('notifications-btn');
        if (!btn) return;
        const badge = btn.querySelector('.notification-badge');
        const unreadCount = this.notifications.filter(n => !n.read).length;

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        this.isOpen = true;
        this.renderPanel();
        if (this.panelEl) this.panelEl.style.display = 'block';
    }

    closePanel() {
        this.isOpen = false;
        if (this.panelEl) this.panelEl.style.display = 'none';
    }

    renderPanel() {
        if (!this.panelEl) return;

        const unreadCount = this.notifications.filter(n => !n.read).length;

        this.panelEl.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <h3 style="font-size: 1rem; font-weight: 700; margin:0;">Notifications</h3>
                    ${unreadCount > 0 ? `<span class="badge badge-primary" style="font-size:0.75rem; padding:2px 8px; border-radius:10px;">${unreadCount} New</span>` : ''}
                </div>
                <div style="display:flex; gap:8px;">
                    ${unreadCount > 0 ? `<button id="notif-mark-all-btn" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 8px;">Mark all read</button>` : ''}
                    <button id="notif-close-btn" class="icon-btn" style="width:28px; height:28px;"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>

            <div style="max-height: 360px; overflow-y: auto; padding: 8px 0;">
                ${this.notifications.length === 0 ? `
                    <div style="text-align:center; padding: 32px 16px;">
                        <i class="fa-regular fa-bell-slash" style="font-size:2rem; color:var(--text-muted); margin-bottom:8px;"></i>
                        <p style="font-size:0.88rem; color:var(--text-muted); margin:0;">No notifications yet. You're all caught up!</p>
                    </div>
                ` : `
                    ${this.notifications.map(n => {
                        const timeAgo = this.formatTimeAgo(n.timestamp);
                        let iconClass = 'fa-info-circle';
                        let iconColor = 'var(--accent-color)';
                        if (n.type === 'success') { iconClass = 'fa-circle-check'; iconColor = '#4CAF50'; }
                        if (n.type === 'warning') { iconClass = 'fa-triangle-exclamation'; iconColor = '#FF9800'; }

                        return `
                            <div class="notif-item" data-id="${n.id}" style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); display:flex; gap:12px; cursor:pointer; background: ${n.read ? 'transparent' : 'var(--bg-hover)'}; transition: background 0.15s;">
                                <div style="font-size: 1.2rem; color: ${iconColor}; margin-top:2px;">
                                    <i class="fa-solid ${iconClass}"></i>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:0.88rem; font-weight: ${n.read ? '500' : '700'}; color:var(--text-primary); margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
                                        <span>${n.title}</span>
                                        ${!n.read ? `<span style="width:7px; height:7px; border-radius:50%; background:#f44336; display:inline-block;"></span>` : ''}
                                    </div>
                                    <p style="font-size:0.82rem; color:var(--text-secondary); margin:0; line-height:1.4;">${n.message}</p>
                                    <span style="font-size:0.72rem; color:var(--text-muted); display:block; margin-top:4px;">${timeAgo}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                `}
            </div>

            <div style="padding: 10px 16px; border-top: 1px solid var(--border-light); text-align:center; background: var(--bg-input);">
                <button id="notif-clear-all-btn" style="background:none; border:none; color:var(--text-muted); font-size:0.78rem; cursor:pointer;">
                    Clear all notifications
                </button>
            </div>
        `;

        this.bindPanelEvents();
    }

    bindPanelEvents() {
        document.getElementById('notif-close-btn')?.addEventListener('click', () => this.closePanel());
        document.getElementById('notif-mark-all-btn')?.addEventListener('click', () => {
            this.notifications.forEach(n => n.read = true);
            this.saveNotifications();
            this.renderPanel();
            showToast("All notifications marked as read.");
        });
        document.getElementById('notif-clear-all-btn')?.addEventListener('click', () => {
            this.notifications = [];
            this.saveNotifications();
            this.renderPanel();
        });

        this.panelEl.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const notif = this.notifications.find(n => n.id === id);
                if (notif) {
                    notif.read = true;
                    this.saveNotifications();
                    this.renderPanel();
                }
            });
        });
    }

    bindEvents() {
        const btn = document.getElementById('notifications-btn');
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.panelEl && !this.panelEl.contains(e.target) && !btn.contains(e.target)) {
                this.closePanel();
            }
        });

        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closePanel();
            }
        });
    }

    formatTimeAgo(isoString) {
        if (!isoString) return 'Just now';
        const date = new Date(isoString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
}
