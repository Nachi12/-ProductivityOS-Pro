// js/search.js
import { showToast } from './toast.js';

export class SearchManager {
    constructor(storage) {
        this.storage = storage;
        this.isOpen = false;
        this.overlayEl = null;

        this.initUI();
        this.bindEvents();
    }

    initUI() {
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'cmd-k-overlay';
        this.overlayEl.className = 'gm-overlay';
        this.overlayEl.style.display = 'none';
        this.overlayEl.innerHTML = `
            <div class="gm-dialog" style="max-width: 600px; width: 90%; top: -60px; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-lg);">
                <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; background: var(--bg-input);">
                    <i class="fa-solid fa-magnifying-glass" style="color: var(--accent-color); font-size: 1.2rem;"></i>
                    <input id="cmd-k-input" type="text" placeholder="Search tasks, projects, goals, notes, finance..." style="width:100%; background:none; border:none; outline:none; font-size:1.05rem; color:var(--text-primary);">
                    <span style="background:var(--bg-card); padding:2px 8px; border-radius:4px; font-size:0.75rem; color:var(--text-muted); border:1px solid var(--border-color);">ESC</span>
                </div>
                <div id="cmd-k-results" style="max-height: 400px; overflow-y: auto; padding: 12px 16px;">
                    <div style="text-align:center; padding: 24px 0; color: var(--text-muted); font-size: 0.9rem;">
                        Type something to search everywhere...
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlayEl);
    }

    bindEvents() {
        const globalSearchInput = document.getElementById('global-search');
        globalSearchInput?.addEventListener('focus', (e) => {
            e.preventDefault();
            globalSearchInput.blur();
            this.open();
        });
        globalSearchInput?.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        // Cmd+K / Ctrl+K shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        this.overlayEl.addEventListener('click', (e) => {
            if (e.target === this.overlayEl) this.close();
        });

        const input = this.overlayEl.querySelector('#cmd-k-input');
        input?.addEventListener('input', (e) => {
            this.performSearch(e.target.value.trim());
        });
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        this.overlayEl.style.display = 'flex';
        const input = this.overlayEl.querySelector('#cmd-k-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        this.performSearch('');
    }

    close() {
        this.isOpen = false;
        this.overlayEl.style.display = 'none';
    }

    performSearch(query) {
        const resultsEl = this.overlayEl.querySelector('#cmd-k-results');
        if (!resultsEl) return;

        if (!query) {
            resultsEl.innerHTML = `
                <div style="padding:12px; font-size:0.8rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Quick Views</div>
                <div class="cmd-k-item" data-hash="#dashboard" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                    <i class="fa-solid fa-house" style="color:var(--accent-color);"></i>
                    <span>Dashboard</span>
                </div>
                <div class="cmd-k-item" data-hash="#tasks" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                    <i class="fa-solid fa-circle-check" style="color:#4CAF50;"></i>
                    <span>Tasks</span>
                </div>
                <div class="cmd-k-item" data-hash="#projects" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                    <i class="fa-solid fa-folder-tree" style="color:#2196F3;"></i>
                    <span>Projects</span>
                </div>
                <div class="cmd-k-item" data-hash="#profile" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                    <i class="fa-solid fa-circle-user" style="color:#9C27B0;"></i>
                    <span>Profile & Family Sync</span>
                </div>
            `;
            this.bindResultItems(resultsEl);
            return;
        }

        const tasks = this.storage.get('tasks') || [];
        const projects = this.storage.get('projects') || [];
        const goals = this.storage.get('goals') || [];
        const notes = this.storage.get('notes') || [];
        const q = query.toLowerCase();

        const matchedTasks = tasks.filter(t => (t.title && t.title.toLowerCase().includes(q)) || (t.category && t.category.toLowerCase().includes(q)));
        const matchedProjects = projects.filter(p => (p.title && p.title.toLowerCase().includes(q)));
        const matchedGoals = goals.filter(g => (g.title && g.title.toLowerCase().includes(q)));
        const matchedNotes = notes.filter(n => (n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q)));

        let html = '';

        if (matchedTasks.length > 0) {
            html += `<div style="padding:8px 0; font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Tasks (${matchedTasks.length})</div>`;
            matchedTasks.slice(0, 5).forEach(t => {
                html += `
                    <div class="cmd-k-item" data-hash="#tasks" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; background:var(--bg-input);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fa-regular fa-circle-check" style="color:var(--accent-color);"></i>
                            <span style="font-weight:600; font-size:0.9rem;">${t.title}</span>
                        </div>
                        <span class="badge" style="font-size:0.75rem; background:var(--bg-hover); color:var(--text-muted);">${t.category || 'General'}</span>
                    </div>
                `;
            });
        }

        if (matchedProjects.length > 0) {
            html += `<div style="padding:8px 0; font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Projects (${matchedProjects.length})</div>`;
            matchedProjects.slice(0, 5).forEach(p => {
                html += `
                    <div class="cmd-k-item" data-hash="#projects" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; background:var(--bg-input);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fa-solid fa-folder" style="color:#2196F3;"></i>
                            <span style="font-weight:600; font-size:0.9rem;">${p.title}</span>
                        </div>
                        <span class="badge" style="font-size:0.75rem;">${p.status || 'Active'}</span>
                    </div>
                `;
            });
        }

        if (matchedGoals.length > 0) {
            html += `<div style="padding:8px 0; font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Goals (${matchedGoals.length})</div>`;
            matchedGoals.slice(0, 5).forEach(g => {
                html += `
                    <div class="cmd-k-item" data-hash="#goals" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; background:var(--bg-input);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fa-solid fa-bullseye" style="color:#FF9800;"></i>
                            <span style="font-weight:600; font-size:0.9rem;">${g.title}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (matchedNotes.length > 0) {
            html += `<div style="padding:8px 0; font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Notes (${matchedNotes.length})</div>`;
            matchedNotes.slice(0, 5).forEach(n => {
                html += `
                    <div class="cmd-k-item" data-hash="#notes" style="padding:10px 14px; border-radius:var(--radius-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; background:var(--bg-input);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fa-regular fa-note-sticky" style="color:#9C27B0;"></i>
                            <span style="font-weight:600; font-size:0.9rem;">${n.title || 'Untitled Note'}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (!html) {
            html = `
                <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:1.8rem; margin-bottom:8px;"></i>
                    <p style="margin:0; font-size:0.9rem;">No results matching "<strong>${query}</strong>"</p>
                </div>
            `;
        }

        resultsEl.innerHTML = html;
        this.bindResultItems(resultsEl);
    }

    bindResultItems(container) {
        container.querySelectorAll('.cmd-k-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const hash = e.currentTarget.dataset.hash;
                if (hash) {
                    window.location.hash = hash;
                    this.close();
                }
            });
        });
    }
}
