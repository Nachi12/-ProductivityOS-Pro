// js/tasks.js
import { showToast } from './toast.js';
import { showConfirmModal } from './modal.js';

export class TaskManager {
    constructor(storage) {
        this.storage = storage;
        this.tbody = document.getElementById('master-task-table-body');
        this.modalInjected = false;
        this.bindEvents();
    }

    init() {
        this.renderTable();
    }

    injectModal() {
        if (this.modalInjected) return;

        // Inject modal styles
        const style = document.createElement('style');
        style.id = 'task-modal-styles';
        style.textContent = `
            .task-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.45);
                backdrop-filter: blur(4px); z-index: 1000;
                display: flex; align-items: center; justify-content: center;
                animation: taskModalFadeIn 0.2s ease;
                opacity: 1; transition: opacity 0.2s ease;
            }
            .task-modal-overlay.closing { opacity: 0; }
            @keyframes taskModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
            .task-modal {
                background: var(--bg-card); border: 1px solid var(--border-color);
                border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
                width: 520px; max-width: 92vw; max-height: 90vh; overflow-y: auto;
                animation: taskModalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes taskModalSlideUp {
                from { transform: translateY(20px) scale(0.97); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            .task-modal-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: var(--spacing-4); border-bottom: 1px solid var(--border-light);
            }
            .task-modal-header h2 {
                font-size: 1.15rem; font-weight: 700; color: var(--text-primary);
                display: flex; align-items: center; gap: var(--spacing-2);
            }
            .task-modal-close {
                width: 32px; height: 32px; border-radius: var(--radius-sm);
                border: none; background: transparent; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: var(--text-muted); font-size: 1.1rem;
                transition: all var(--transition-fast);
            }
            .task-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
            .task-modal-body { padding: var(--spacing-4); display: flex; flex-direction: column; gap: var(--spacing-4); }
            .task-form-group { display: flex; flex-direction: column; gap: 6px; }
            .task-form-group label {
                font-size: 0.8rem; font-weight: 600; color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.04em;
            }
            .task-form-input {
                padding: 10px 14px; background: var(--bg-input);
                border: 1px solid var(--border-color); border-radius: var(--radius-sm);
                color: var(--text-primary); font-size: 0.95rem;
                font-family: var(--font-sans); transition: border-color var(--transition-fast);
            }
            .task-form-input:focus { border-color: var(--accent-color); outline: none; box-shadow: 0 0 0 3px var(--accent-light); }
            .task-form-input::placeholder { color: var(--text-muted); }
            .task-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-3); }
            .task-priority-group { display: flex; gap: var(--spacing-2); }
            .task-prio-btn {
                flex: 1; padding: 10px 12px; border: 1px solid var(--border-color);
                border-radius: var(--radius-sm); text-align: center; cursor: pointer;
                font-weight: 500; font-size: 0.85rem; background: var(--bg-input);
                color: var(--text-secondary); transition: all var(--transition-fast);
                display: flex; align-items: center; justify-content: center; gap: 6px;
            }
            .task-prio-btn:hover { background: var(--bg-hover); }
            .task-prio-btn.selected-high { background: rgba(229,57,53,0.1); border-color: var(--clr-red); color: var(--clr-red); }
            .task-prio-btn.selected-medium { background: rgba(244,81,30,0.1); border-color: var(--clr-orange); color: var(--clr-orange); }
            .task-prio-btn.selected-low { background: rgba(67,160,71,0.1); border-color: var(--clr-green); color: var(--clr-green); }
            .task-modal-footer {
                display: flex; justify-content: flex-end; gap: var(--spacing-3);
                padding: var(--spacing-3) var(--spacing-4);
                border-top: 1px solid var(--border-light);
            }
            .task-modal-footer .btn { padding: 10px 24px; font-size: 0.9rem; }
        `;
        document.head.appendChild(style);

        // Inject modal HTML
        const modalDiv = document.createElement('div');
        modalDiv.id = 'task-modal-root';
        modalDiv.innerHTML = `
            <div class="task-modal-overlay" id="task-modal-overlay" style="display:none;">
                <div class="task-modal">
                    <div class="task-modal-header">
                        <h2><i class="fa-solid fa-circle-plus"></i> New Task</h2>
                        <button class="task-modal-close" id="task-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="task-modal-body">
                        <div class="task-form-group">
                            <label>Task Title</label>
                            <input type="text" class="task-form-input" id="task-form-title" placeholder="What needs to be done?" autofocus>
                        </div>
                        <div class="task-form-group">
                            <label>Priority</label>
                            <div class="task-priority-group" id="task-prio-group">
                                <button class="task-prio-btn" data-priority="High"><i class="fa-solid fa-arrow-up"></i> High</button>
                                <button class="task-prio-btn selected-medium" data-priority="Medium"><i class="fa-solid fa-minus"></i> Medium</button>
                                <button class="task-prio-btn" data-priority="Low"><i class="fa-solid fa-arrow-down"></i> Low</button>
                            </div>
                        </div>
                        <div class="task-form-row">
                            <div class="task-form-group">
                                <label>Project</label>
                                <input type="text" class="task-form-input" id="task-form-project" placeholder="e.g. Inbox, Work..." value="Inbox">
                            </div>
                            <div class="task-form-group">
                                <label>Due Date</label>
                                <input type="date" class="task-form-input" id="task-form-date">
                            </div>
                        </div>
                    </div>
                    <div class="task-modal-footer">
                        <button class="btn btn-secondary" id="task-modal-cancel-btn">Cancel</button>
                        <button class="btn btn-primary" id="task-modal-save-btn"><i class="fa-solid fa-check"></i> Add Task</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);

        // Bind modal events
        this.bindModalEvents();
        this.modalInjected = true;
    }

    bindModalEvents() {
        const overlay = document.getElementById('task-modal-overlay');
        const closeBtn = document.getElementById('task-modal-close-btn');
        const cancelBtn = document.getElementById('task-modal-cancel-btn');
        const saveBtn = document.getElementById('task-modal-save-btn');
        const prioGroup = document.getElementById('task-prio-group');

        // Close handlers
        const closeModal = () => {
            overlay.classList.add('closing');
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.classList.remove('closing');
                this.resetForm();
            }, 200);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display !== 'none') {
                closeModal();
            }
        });

        // Priority toggle
        prioGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.task-prio-btn');
            if (!btn) return;
            prioGroup.querySelectorAll('.task-prio-btn').forEach(b => {
                b.className = 'task-prio-btn';
            });
            const prio = btn.dataset.priority;
            btn.classList.add(`selected-${prio.toLowerCase()}`);
        });

        // Save
        saveBtn.addEventListener('click', () => {
            const title = document.getElementById('task-form-title').value.trim();
            if (!title) {
                document.getElementById('task-form-title').focus();
                document.getElementById('task-form-title').style.borderColor = 'var(--clr-red)';
                setTimeout(() => {
                    document.getElementById('task-form-title').style.borderColor = '';
                }, 1500);
                return;
            }

            const selectedPrio = prioGroup.querySelector('[class*="selected-"]');
            const priority = selectedPrio ? selectedPrio.dataset.priority : 'Medium';
            const project = document.getElementById('task-form-project').value.trim() || 'Inbox';
            const dueDate = document.getElementById('task-form-date').value;

            this.addTask(title, priority, project, dueDate);
            closeModal();
        });

        // Enter key to submit
        document.getElementById('task-form-title').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
    }

    openModal() {
        this.injectModal();
        this.resetForm();
        const overlay = document.getElementById('task-modal-overlay');
        overlay.style.display = 'flex';
        // Set today's date as default
        document.getElementById('task-form-date').value = new Date().toISOString().split('T')[0];
        setTimeout(() => document.getElementById('task-form-title').focus(), 100);
    }

    resetForm() {
        const title = document.getElementById('task-form-title');
        const project = document.getElementById('task-form-project');
        const date = document.getElementById('task-form-date');
        const prioGroup = document.getElementById('task-prio-group');

        if (title) title.value = '';
        if (project) project.value = 'Inbox';
        if (date) date.value = '';
        if (prioGroup) {
            prioGroup.querySelectorAll('.task-prio-btn').forEach(b => b.className = 'task-prio-btn');
            const medBtn = prioGroup.querySelector('[data-priority="Medium"]');
            if (medBtn) medBtn.classList.add('selected-medium');
        }
    }

    renderTable() {
        if(!this.tbody) return;
        const tasks = this.storage.get('tasks');
        this.tbody.innerHTML = '';
        
        tasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" data-id="${t.id}" ${t.completed ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent-color);"></td>
                <td style="text-decoration: ${t.completed ? 'line-through' : 'none'}; color: ${t.completed ? 'var(--text-muted)' : 'inherit'}">${t.title}</td>
                <td><span class="badge ${t.priority.toLowerCase()}">${t.priority}</span></td>
                <td>${t.project}</td>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>
                    <button class="icon-btn btn-delete-task" data-id="${t.id}" style="color:var(--clr-red)"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            this.tbody.appendChild(tr);
        });

        // Bind actions
        this.tbody.querySelectorAll('input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', (e) => {
                this.toggleTaskStatus(e.target.getAttribute('data-id'), e.target.checked);
            });
        });
        
        this.tbody.querySelectorAll('.btn-delete-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteTask(e.currentTarget.getAttribute('data-id'));
            });
        });
    }

    toggleTaskStatus(id, status) {
        const tasks = this.storage.get('tasks');
        const idx = tasks.findIndex(t => t.id === id);
        if(idx > -1) {
            tasks[idx].completed = status;
            this.storage.set('tasks', tasks);
            this.renderTable();
            showToast('Task updated successfully.');
        }
    }

    async deleteTask(id) {
        const ok = await showConfirmModal('Delete this task forever?', { title: 'Delete Task', confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        let tasks = this.storage.get('tasks');
        tasks = tasks.filter(t => t.id !== id);
        this.storage.set('tasks', tasks);
        this.renderTable();
        showToast('Task deleted.', 'success');
    }
    
    addTask(title, priority, project, dueDate) {
        const tasks = this.storage.get('tasks');
        tasks.push({
            id: 't' + Date.now(),
            title: title,
            priority: priority,
            project: project,
            completed: false,
            date: dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : new Date().toISOString()
        });
        this.storage.set('tasks', tasks);
        this.renderTable();
        showToast('New task added.', 'success');
    }

    bindEvents() {
        const addBtn = document.getElementById('new-task-btn');
        if(addBtn) {
            addBtn.addEventListener('click', () => {
                this.openModal();
            });
        }
    }
}
