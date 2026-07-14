// js/dashboard.js
import { showToast } from './toast.js';

export class Dashboard {
    constructor(storage) {
        this.storage = storage;
        this.chartInstance = null;
        this.bindEvents();
    }

    init() {
        this.renderGreeting();
        this.renderTasks();
        this.renderKPIs();
        this.initChart();
    }

    renderGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        document.getElementById('greeting').textContent = `${greeting}.`;
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date-display').textContent = new Date().toLocaleDateString(undefined, options);
    }

    renderTasks() {
        const tasks = this.storage.get('tasks');
        const list = document.getElementById('dashboard-task-list');
        list.innerHTML = '';
        
        const activeTasks = tasks.filter(t => !t.completed).slice(0, 5); // Show top 5
        
        if (activeTasks.length === 0) {
            list.innerHTML = '<li class="text-muted" style="padding:16px;">No active tasks. You are all caught up!</li>';
            return;
        }

        activeTasks.forEach(t => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" data-id="${t.id}">
                <span class="task-title" style="text-decoration: ${t.completed ? 'line-through' : 'none'}">${t.title}</span>
                <span class="task-project">${t.project}</span>
            `;
            list.appendChild(li);
        });

        // Bind quick check
        list.querySelectorAll('input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const idx = tasks.findIndex(t => t.id === id);
                if(idx > -1) {
                    tasks[idx].completed = e.target.checked;
                    this.storage.set('tasks', tasks);
                    this.renderKPIs();
                    showToast('Task updated!');
                    // Trigger re-render with slight delay for visual satisfaction
                    setTimeout(() => this.renderTasks(), 400); 
                }
            });
        });
    }

    renderKPIs() {
        const tasks = this.storage.get('tasks');
        const completedCount = tasks.filter(t => t.completed).length;
        document.getElementById('kpi-tasks').textContent = completedCount;
        
        // Mocking others for demo
        document.getElementById('kpi-streak').textContent = '12 Days';
        document.getElementById('kpi-focus').textContent = '4h 30m';
    }

    bindEvents() {
        const dump = document.getElementById('brain-dump-input');
        const saveTaskBtn = document.getElementById('brain-dump-save-task');
        const saveNoteBtn = document.getElementById('brain-dump-save-note');

        if (!dump) return;

        // Render existing dump entries on load
        this.renderDumpList();

        // Save as Task
        if (saveTaskBtn) {
            saveTaskBtn.addEventListener('click', () => {
                const text = dump.value.trim();
                if (!text) { dump.focus(); return; }

                const tasks = this.storage.get('tasks');
                tasks.push({
                    id: 't' + Date.now(),
                    title: text,
                    priority: 'Medium',
                    project: 'Inbox',
                    completed: false,
                    date: new Date().toISOString()
                });
                this.storage.set('tasks', tasks);

                this.saveDumpEntry(text, 'task');
                dump.value = '';
                this.renderTasks();
                this.renderKPIs();
                this.renderDumpList();
                showToast('Saved as task!');
            });
        }

        // Save as Note
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', () => {
                const text = dump.value.trim();
                if (!text) { dump.focus(); return; }

                const notes = this.storage.get('notes') || [];
                notes.unshift({
                    id: 'note_' + Date.now(),
                    title: text.substring(0, 50),
                    content: text,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                this.storage.set('notes', notes);

                this.saveDumpEntry(text, 'note');
                dump.value = '';
                this.renderDumpList();
                showToast('Saved as note!');
            });
        }
    }

    saveDumpEntry(text, type) {
        const entries = this.storage.get('brainDumpEntries') || [];
        entries.unshift({
            id: 'bd_' + Date.now(),
            text: text.substring(0, 120),
            type,
            time: new Date().toISOString()
        });
        // Keep last 20
        if (entries.length > 20) entries.length = 20;
        this.storage.set('brainDumpEntries', entries);
    }

    renderDumpList() {
        const list = document.getElementById('brain-dump-list');
        if (!list) return;

        const entries = this.storage.get('brainDumpEntries') || [];
        if (entries.length === 0) {
            list.innerHTML = '<li style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Your captured ideas will appear here</li>';
            return;
        }

        list.innerHTML = entries.slice(0, 10).map(e => {
            const icon = e.type === 'task' ? 'fa-circle-check' : 'fa-note-sticky';
            const color = e.type === 'task' ? 'var(--clr-green)' : 'var(--clr-blue)';
            const ago = this.timeAgo(e.time);
            return `
                <li style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border-light);font-size:0.85rem;">
                    <i class="fa-solid ${icon}" style="color:${color};flex-shrink:0;"></i>
                    <span style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.text}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0;">${ago}</span>
                    <button class="brain-dump-del" data-id="${e.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;padding:2px;" title="Remove"><i class="fa-solid fa-xmark"></i></button>
                </li>
            `;
        }).join('');

        // Delete handler
        list.querySelectorAll('.brain-dump-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const entries = this.storage.get('brainDumpEntries') || [];
                const filtered = entries.filter(e => e.id !== btn.dataset.id);
                this.storage.set('brainDumpEntries', filtered);
                this.renderDumpList();
            });
        });
    }

    timeAgo(dateStr) {
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    initChart() {
        const ctx = document.getElementById('productivityChart');
        if(!ctx) return;
        
        if(this.chartInstance) this.chartInstance.destroy();

        // Chart.js implementation (requires CDN loaded in index.html)
        if(window.Chart) {
            Chart.defaults.color = 'var(--text-muted)';
            Chart.defaults.font.family = 'Inter';
            
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Tasks Completed',
                        data: [5, 9, 3, 12, 8, 2, 4],
                        borderColor: '#2383e2',
                        backgroundColor: 'rgba(35, 131, 226, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'var(--border-color)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }
}
