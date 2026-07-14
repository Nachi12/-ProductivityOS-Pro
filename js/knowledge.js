// js/knowledge.js
import { showToast } from './toast.js';

export class KnowledgeManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.currentCategory = 'all';
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getItems() {
        return this.storage.get('knowledgeVault') || [];
    }

    saveItems(items) {
        this.storage.set('knowledgeVault', items);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'knowledge-styles';
        style.textContent = `
            .kv-layout { display: grid; grid-template-columns: 220px 1fr; gap: var(--spacing-4); }
            .kv-sidebar-cats { list-style: none; padding: 0; margin: 0; }
            .kv-sidebar-cats li { padding: 10px var(--spacing-3); border-radius: var(--radius-sm); cursor: pointer; font-size: 0.9rem; color: var(--text-secondary); transition: all var(--transition-fast); display: flex; align-items: center; gap: var(--spacing-2); font-weight: 500; }
            .kv-sidebar-cats li:hover { background: var(--bg-hover); color: var(--text-primary); }
            .kv-sidebar-cats li.active { background: var(--accent-light); color: var(--accent-color); }
            .kv-sidebar-cats li .count { margin-left: auto; font-size: 0.75rem; background: var(--bg-hover); padding: 2px 8px; border-radius: 10px; color: var(--text-muted); }
            .kv-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--spacing-3); }
            .kv-item-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); cursor: default; }
            .kv-item-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .kv-item-type { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: var(--spacing-2); }
            .kv-item-type.resource { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .kv-item-type.area { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .kv-item-type.project { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .kv-item-type.archive { background: rgba(158,158,158,0.1); color: #9e9e9e; }
            .kv-item-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
            .kv-item-content { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: var(--spacing-3); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            .kv-item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: var(--spacing-2); }
            .kv-tag { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background: var(--bg-hover); color: var(--text-muted); }
            .kv-item-footer { display: flex; justify-content: space-between; align-items: center; padding-top: var(--spacing-2); border-top: 1px solid var(--border-light); font-size: 0.8rem; color: var(--text-muted); }
            .kv-item-del { background: none; border: none; color: var(--text-muted); cursor: pointer; transition: color var(--transition-fast); }
            .kv-item-del:hover { color: var(--clr-red); }
            .kv-search { width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: 0.9rem; color: var(--text-primary); margin-bottom: var(--spacing-4); }
            .kv-search:focus { border-color: var(--accent-color); outline: none; }
            .kv-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .kv-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.4; }
            @media (max-width: 768px) { .kv-layout { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-knowledge');
        if (!container) return;

        const items = this.getItems();
        const categories = [
            { key: 'all', label: 'All Items', icon: 'fa-solid fa-layer-group' },
            { key: 'resource', label: 'Resources', icon: 'fa-solid fa-bookmark' },
            { key: 'area', label: 'Areas', icon: 'fa-solid fa-compass' },
            { key: 'project', label: 'Projects', icon: 'fa-solid fa-diagram-project' },
            { key: 'archive', label: 'Archive', icon: 'fa-solid fa-box-archive' }
        ];

        const filtered = this.currentCategory === 'all' ? items : items.filter(it => it.type === this.currentCategory);

        const catCounts = {};
        items.forEach(it => { catCounts[it.type] = (catCounts[it.type] || 0) + 1; });

        const sidebarHTML = categories.map(c => {
            const count = c.key === 'all' ? items.length : (catCounts[c.key] || 0);
            return `<li class="${this.currentCategory === c.key ? 'active' : ''}" data-cat="${c.key}"><i class="${c.icon}"></i> ${c.label} <span class="count">${count}</span></li>`;
        }).join('');

        let itemsHTML = '';
        if (filtered.length === 0) {
            itemsHTML = `<div class="kv-empty"><i class="fa-solid fa-brain"></i><h3>Nothing here yet</h3><p>Add knowledge items to build your second brain</p></div>`;
        } else {
            itemsHTML = filtered.map(it => {
                const tagsHTML = (it.tags || []).map(t => `<span class="kv-tag">${t}</span>`).join('');
                return `
                    <div class="card kv-item-card">
                        <div class="card-body">
                            <span class="kv-item-type ${it.type}"><i class="fa-solid ${it.type === 'resource' ? 'fa-bookmark' : it.type === 'area' ? 'fa-compass' : it.type === 'project' ? 'fa-diagram-project' : 'fa-box-archive'}"></i> ${it.type}</span>
                            <div class="kv-item-title">${it.title}</div>
                            <div class="kv-item-content">${it.content}</div>
                            ${tagsHTML ? `<div class="kv-item-tags">${tagsHTML}</div>` : ''}
                            <div class="kv-item-footer">
                                <span>${new Date(it.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                <button class="kv-item-del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Knowledge Vault</h1>
                    <p class="subtitle text-muted">Your second brain — PARA method</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-kv-btn"><i class="fa-solid fa-plus"></i> Add Entry</button>
                </div>
            </div>
            <div class="kv-layout">
                <div class="card" style="align-self:start;">
                    <div class="card-body" style="padding:var(--spacing-2);">
                        <ul class="kv-sidebar-cats">${sidebarHTML}</ul>
                    </div>
                </div>
                <div>
                    <input type="text" class="kv-search" id="kv-search" placeholder="Search knowledge vault...">
                    <div class="kv-items-grid" id="kv-items-container">${itemsHTML}</div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Category filter
        document.querySelectorAll('#view-knowledge .kv-sidebar-cats li').forEach(li => {
            li.addEventListener('click', () => {
                this.currentCategory = li.dataset.cat;
                this.render();
            });
        });

        // Search
        document.getElementById('kv-search')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const items = this.getItems();
            const filtered = this.currentCategory === 'all' ? items : items.filter(it => it.type === this.currentCategory);
            const results = q ? filtered.filter(it => it.title.toLowerCase().includes(q) || it.content.toLowerCase().includes(q) || (it.tags || []).some(t => t.toLowerCase().includes(q))) : filtered;

            const container = document.getElementById('kv-items-container');
            if (!container) return;

            if (results.length === 0) {
                container.innerHTML = `<div class="kv-empty"><p>No results found</p></div>`;
            } else {
                container.innerHTML = results.map(it => {
                    const tagsHTML = (it.tags || []).map(t => `<span class="kv-tag">${t}</span>`).join('');
                    return `
                        <div class="card kv-item-card">
                            <div class="card-body">
                                <span class="kv-item-type ${it.type}">${it.type}</span>
                                <div class="kv-item-title">${it.title}</div>
                                <div class="kv-item-content">${it.content}</div>
                                ${tagsHTML ? `<div class="kv-item-tags">${tagsHTML}</div>` : ''}
                                <div class="kv-item-footer">
                                    <span>${new Date(it.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    <button class="kv-item-del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                // Re-bind delete
                container.querySelectorAll('.kv-item-del').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (confirm('Delete this entry?')) {
                            const items = this.getItems().filter(i => i.id !== btn.dataset.id);
                            this.saveItems(items);
                            showToast('Entry deleted.');
                            this.render();
                        }
                    });
                });
            }
        });

        // Add entry
        document.getElementById('new-kv-btn')?.addEventListener('click', () => {
            const title = prompt('Entry title:');
            if (!title) return;
            const content = prompt('Content / notes:', '') || '';
            const typeChoice = prompt('Type:\n1. Resource\n2. Area\n3. Project\n4. Archive', '1');
            const types = { '1': 'resource', '2': 'area', '3': 'project', '4': 'archive' };
            const type = types[typeChoice] || 'resource';
            const tagsStr = prompt('Tags (comma separated):', '') || '';
            const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

            const items = this.getItems();
            items.push({
                id: 'kv_' + Date.now(),
                title,
                content,
                type,
                tags,
                createdAt: new Date().toISOString()
            });
            this.saveItems(items);
            showToast('Knowledge entry added!');
            this.render();
        });

        // Delete
        document.querySelectorAll('#view-knowledge .kv-item-del').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this entry?')) {
                    const items = this.getItems().filter(i => i.id !== btn.dataset.id);
                    this.saveItems(items);
                    showToast('Entry deleted.');
                    this.render();
                }
            });
        });
    }
}
