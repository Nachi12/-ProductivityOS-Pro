// js/projects.js
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal } from './modal.js';

export class ProjectsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getProjects() {
        return this.storage.get('projects') || [];
    }

    saveProjects(projects) {
        this.storage.set('projects', projects);
    }

    getTasks() {
        return this.storage.get('tasks') || [];
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'projects-styles';
        style.textContent = `
            .proj-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--spacing-3); margin-bottom: var(--spacing-4); }
            .proj-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .proj-kpi-icon { width: 44px; height: 44px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
            .proj-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .proj-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .proj-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .proj-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .proj-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
            .proj-kpi-data .value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
            .proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--spacing-4); }
            .proj-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); }
            .proj-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .proj-header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--spacing-3); }
            .proj-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
            .proj-info { flex: 1; margin-left: var(--spacing-3); }
            .proj-info h3 { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); }
            .proj-info p { font-size: 0.85rem; color: var(--text-muted); margin-top: 2px; }
            .proj-status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
            .proj-status-badge.active { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .proj-status-badge.planning { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .proj-status-badge.on-hold { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .proj-status-badge.completed { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .proj-progress { margin: var(--spacing-3) 0; }
            .proj-progress-bar { height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden; }
            .proj-progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
            .proj-progress-text { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; }
            .proj-meta { display: flex; gap: var(--spacing-4); font-size: 0.8rem; color: var(--text-muted); margin-top: var(--spacing-3); padding-top: var(--spacing-3); border-top: 1px solid var(--border-light); }
            .proj-meta span i { margin-right: 4px; }
            .proj-actions { display: flex; gap: var(--spacing-2); }
            .proj-act-btn { padding: 6px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: all var(--transition-fast); background: var(--bg-input); color: var(--text-secondary); }
            .proj-act-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .proj-act-btn.danger:hover { color: var(--clr-red); border-color: var(--clr-red); background: rgba(229,57,53,0.05); }
            .proj-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .proj-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.4; }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-projects');
        if (!container) return;

        const projects = this.getProjects();
        const tasks = this.getTasks();

        // KPIs
        const total = projects.length;
        const active = projects.filter(p => p.status === 'active').length;
        const completed = projects.filter(p => p.status === 'completed').length;
        const totalTaskCount = tasks.length;

        // Cards
        let cardsHTML = '';
        if (projects.length === 0) {
            cardsHTML = `<div class="proj-empty card"><div class="card-body"><i class="fa-solid fa-folder-tree"></i><h3>No projects yet</h3><p>Create your first project to organize your work</p></div></div>`;
        } else {
            cardsHTML = projects.map(p => {
                const projTasks = tasks.filter(t => t.project === p.name);
                const doneTasks = projTasks.filter(t => t.completed).length;
                const totalProjTasks = projTasks.length;
                const pct = totalProjTasks > 0 ? Math.round((doneTasks / totalProjTasks) * 100) : 0;

                return `
                    <div class="card proj-card">
                        <div class="card-body">
                            <div class="proj-header-row">
                                <div style="display:flex;align-items:flex-start;">
                                    <div class="proj-color-dot" style="background:${p.color}"></div>
                                    <div class="proj-info">
                                        <h3>${p.name}</h3>
                                        <p>${p.description || 'No description'}</p>
                                    </div>
                                </div>
                                <span class="proj-status-badge ${p.status}">${p.status.replace('-', ' ')}</span>
                            </div>
                            <div class="proj-progress">
                                <div class="proj-progress-bar"><div class="proj-progress-fill" style="width:${pct}%;background:${p.color}"></div></div>
                                <div class="proj-progress-text"><span>${doneTasks}/${totalProjTasks} tasks</span><span>${pct}%</span></div>
                            </div>
                            <div class="proj-meta">
                                <span><i class="fa-regular fa-calendar"></i>${new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                <span><i class="fa-solid fa-circle-check"></i>${doneTasks} done</span>
                            </div>
                            <div class="proj-meta" style="border-top:none;padding-top:var(--spacing-2);">
                                <div class="proj-actions">
                                    <button class="proj-act-btn proj-status-btn" data-id="${p.id}"><i class="fa-solid fa-rotate"></i> Status</button>
                                    <button class="proj-act-btn proj-add-task-btn" data-name="${p.name}"><i class="fa-solid fa-plus"></i> Task</button>
                                    <button class="proj-act-btn danger proj-del-btn" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Projects</h1>
                    <p class="subtitle text-muted">Organize work into focused projects</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-project-btn"><i class="fa-solid fa-plus"></i> New Project</button>
                </div>
            </div>
            <div class="card" style="margin-bottom:var(--spacing-4);">
                <div class="card-body">
                    <div class="proj-kpi-grid">
                        <div class="proj-kpi"><div class="proj-kpi-icon blue"><i class="fa-solid fa-folder-tree"></i></div><div class="proj-kpi-data"><h4>Total Projects</h4><div class="value">${total}</div></div></div>
                        <div class="proj-kpi"><div class="proj-kpi-icon green"><i class="fa-solid fa-play"></i></div><div class="proj-kpi-data"><h4>Active</h4><div class="value">${active}</div></div></div>
                        <div class="proj-kpi"><div class="proj-kpi-icon purple"><i class="fa-solid fa-flag-checkered"></i></div><div class="proj-kpi-data"><h4>Completed</h4><div class="value">${completed}</div></div></div>
                        <div class="proj-kpi"><div class="proj-kpi-icon orange"><i class="fa-solid fa-list-check"></i></div><div class="proj-kpi-data"><h4>Total Tasks</h4><div class="value">${totalTaskCount}</div></div></div>
                    </div>
                </div>
            </div>
            <div class="proj-grid">${cardsHTML}</div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // New project
        document.getElementById('new-project-btn')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'New Project', icon: 'fa-solid fa-folder-plus',
                submitLabel: 'Create Project', submitIcon: 'fa-solid fa-check',
                fields: [
                    { key: 'name', label: 'Project Name', type: 'text', placeholder: 'e.g. Website Redesign...', required: true },
                    { key: 'description', label: 'Description', type: 'text', placeholder: 'Short description...' },
                    { key: 'color', label: 'Color', type: 'color', value: '#2383e2', colors: [
                        { value: '#2383e2', label: 'Blue' }, { value: '#8e24aa', label: 'Purple' },
                        { value: '#43a047', label: 'Green' }, { value: '#f4511e', label: 'Orange' },
                        { value: '#e53935', label: 'Red' }, { value: '#00897b', label: 'Teal' }, { value: '#5c6bc0', label: 'Indigo' }
                    ]}
                ]
            });
            if (!result) return;
            const projects = this.getProjects();
            projects.push({ id: 'proj_' + Date.now(), name: result.name, description: result.description || '', color: result.color || '#2383e2', status: 'active', createdAt: new Date().toISOString() });
            this.saveProjects(projects);
            showToast('Project created!');
            this.render();
        });

        // Change status
        document.querySelectorAll('#view-projects .proj-status-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const projects = this.getProjects();
                const proj = projects.find(p => p.id === btn.dataset.id);
                if (!proj) return;
                const result = await showFormModal({
                    title: 'Change Status', icon: 'fa-solid fa-rotate',
                    submitLabel: 'Update', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'status', label: 'Status', type: 'select', value: proj.status, options: [
                        { value: 'planning', label: 'Planning' }, { value: 'active', label: 'Active' },
                        { value: 'on-hold', label: 'On Hold' }, { value: 'completed', label: 'Completed' }
                    ]}]
                });
                if (!result) return;
                proj.status = result.status;
                this.saveProjects(projects);
                showToast('Status updated!');
                this.render();
            });
        });

        // Add task to project
        document.querySelectorAll('#view-projects .proj-add-task-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const projName = btn.dataset.name;
                const result = await showFormModal({
                    title: `New Task for "${projName}"`, icon: 'fa-solid fa-plus',
                    submitLabel: 'Add Task', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'title', label: 'Task Title', type: 'text', placeholder: 'What needs to be done?', required: true }]
                });
                if (!result) return;
                const tasks = this.getTasks();
                tasks.push({ id: 't' + Date.now(), title: result.title, priority: 'Medium', project: projName, completed: false, date: new Date().toISOString() });
                this.storage.set('tasks', tasks);
                showToast('Task added to project!');
                this.render();
            });
        });

        // Delete
        document.querySelectorAll('#view-projects .proj-del-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this project? Tasks will remain.', { title: 'Delete Project', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const projects = this.getProjects().filter(p => p.id !== btn.dataset.id);
                this.saveProjects(projects);
                showToast('Project deleted.');
                this.render();
            });
        });
    }
}
