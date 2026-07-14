// js/analytics.js
import { showToast } from './toast.js';

export class AnalyticsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'analytics-styles';
        style.textContent = `
            .analytics-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-4); margin-bottom: var(--spacing-4); }
            .analytics-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .analytics-kpi-icon { width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
            .analytics-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .analytics-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .analytics-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .analytics-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .analytics-kpi-icon.red { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .analytics-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
            .analytics-kpi-data .value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
            .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--spacing-4); }
            .an-bar-chart { display: flex; flex-direction: column; gap: var(--spacing-3); }
            .an-bar-row { display: flex; align-items: center; gap: var(--spacing-3); }
            .an-bar-label { width: 100px; font-size: 0.85rem; color: var(--text-secondary); flex-shrink: 0; text-align: right; }
            .an-bar-track { flex: 1; height: 28px; background: var(--bg-hover); border-radius: var(--radius-sm); overflow: hidden; position: relative; }
            .an-bar-fill { height: 100%; border-radius: var(--radius-sm); transition: width 0.8s ease; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 0.75rem; color: white; font-weight: 600; min-width: 30px; }
            .an-donut { display: flex; align-items: center; gap: var(--spacing-4); }
            .an-donut-ring { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
            .an-donut-ring svg { transform: rotate(-90deg); }
            .an-donut-ring .ring-bg { fill: none; stroke: var(--bg-hover); stroke-width: 12; }
            .an-donut-ring .ring-fill { fill: none; stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset 0.8s ease; }
            .an-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .an-donut-pct { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
            .an-donut-label { font-size: 0.7rem; color: var(--text-muted); }
            .an-donut-legend { display: flex; flex-direction: column; gap: var(--spacing-2); }
            .an-legend-item { display: flex; align-items: center; gap: var(--spacing-2); font-size: 0.85rem; color: var(--text-secondary); }
            .an-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
            .an-stat-row { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light); font-size: 0.9rem; }
            .an-stat-row:last-child { border-bottom: none; }
            .an-stat-label { color: var(--text-secondary); }
            .an-stat-value { font-weight: 600; color: var(--text-primary); }
            .an-streak-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
            .an-streak-cell { aspect-ratio: 1; border-radius: 4px; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: var(--text-muted); }
            .an-streak-cell.active { background: var(--accent-color); color: white; font-weight: 600; }
            .an-streak-cell.partial { background: var(--accent-light); color: var(--accent-color); }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-analytics');
        if (!container) return;

        // Gather data from all modules
        const tasks = this.storage.get('tasks') || [];
        const habits = this.storage.get('habits') || [];
        const books = this.storage.get('books') || [];
        const transactions = this.storage.get('transactions') || [];
        const meetings = this.storage.get('meetings') || [];
        const goals = this.storage.get('goals') || [];
        const notes = this.storage.get('notes') || [];
        const projects = this.storage.get('projects') || [];
        const knowledge = this.storage.get('knowledgeVault') || [];

        // Task stats
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const pendingTasks = totalTasks - completedTasks;

        // Priority breakdown
        const highPriority = tasks.filter(t => t.priority === 'High').length;
        const medPriority = tasks.filter(t => t.priority === 'Medium').length;
        const lowPriority = tasks.filter(t => t.priority === 'Low').length;

        // Habit stats
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const habitsCompletedToday = habits.filter(h => h.completions && h.completions.includes(todayStr)).length;
        const totalHabits = habits.length;

        // Finance
        const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        // Books
        const booksReading = books.filter(b => b.status === 'reading').length;
        const booksCompleted = books.filter(b => b.status === 'completed').length;
        const totalPagesRead = books.reduce((s, b) => s + b.currentPage, 0);

        // Goals
        const allKRs = goals.reduce((sum, g) => sum + (g.keyResults || []).length, 0);
        const doneKRs = goals.reduce((sum, g) => sum + (g.keyResults || []).filter(kr => kr.done).length, 0);
        const goalProgress = allKRs > 0 ? Math.round((doneKRs / allKRs) * 100) : 0;

        // Task completion donut
        const r = 48;
        const circ = 2 * Math.PI * r;
        const taskOffset = circ - (taskCompletionRate / 100) * circ;

        // Project task bars
        const projectBars = projects.map(p => {
            const pTasks = tasks.filter(t => t.project === p.name);
            const pDone = pTasks.filter(t => t.completed).length;
            const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
            return { name: p.name, pct: pPct, total: pTasks.length, done: pDone, color: p.color };
        });

        // Weekly activity (last 7 days)
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let weeklyHTML = '';
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const habitsForDay = habits.filter(h => h.completions && h.completions.includes(ds)).length;
            const isActive = habitsForDay >= totalHabits && totalHabits > 0;
            const isPartial = habitsForDay > 0 && !isActive;
            weeklyHTML += `<div class="an-streak-cell ${isActive ? 'active' : isPartial ? 'partial' : ''}" title="${ds}">${weekDays[d.getDay()]}</div>`;
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Analytics</h1>
                    <p class="subtitle text-muted">Your productivity at a glance</p>
                </div>
            </div>

            <div class="analytics-kpi-grid">
                <div class="card"><div class="card-body"><div class="analytics-kpi">
                    <div class="analytics-kpi-icon blue"><i class="fa-solid fa-check-double"></i></div>
                    <div class="analytics-kpi-data"><h4>Tasks Done</h4><div class="value">${completedTasks}/${totalTasks}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="analytics-kpi">
                    <div class="analytics-kpi-icon green"><i class="fa-solid fa-repeat"></i></div>
                    <div class="analytics-kpi-data"><h4>Habits Today</h4><div class="value">${habitsCompletedToday}/${totalHabits}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="analytics-kpi">
                    <div class="analytics-kpi-icon purple"><i class="fa-solid fa-bullseye"></i></div>
                    <div class="analytics-kpi-data"><h4>Goal Progress</h4><div class="value">${goalProgress}%</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="analytics-kpi">
                    <div class="analytics-kpi-icon orange"><i class="fa-solid fa-book"></i></div>
                    <div class="analytics-kpi-data"><h4>Pages Read</h4><div class="value">${totalPagesRead.toLocaleString()}</div></div>
                </div></div></div>
            </div>

            <div class="analytics-grid">
                <!-- Task Completion Donut -->
                <div class="card">
                    <div class="card-header"><h2><i class="fa-solid fa-chart-pie"></i> Task Completion</h2></div>
                    <div class="card-body">
                        <div class="an-donut">
                            <div class="an-donut-ring">
                                <svg width="120" height="120">
                                    <circle class="ring-bg" cx="60" cy="60" r="${r}"/>
                                    <circle class="ring-fill" cx="60" cy="60" r="${r}" style="stroke:var(--clr-green);stroke-dasharray:${circ};stroke-dashoffset:${taskOffset}"/>
                                </svg>
                                <div class="an-donut-center">
                                    <span class="an-donut-pct">${taskCompletionRate}%</span>
                                    <span class="an-donut-label">Complete</span>
                                </div>
                            </div>
                            <div class="an-donut-legend">
                                <div class="an-legend-item"><div class="an-legend-dot" style="background:var(--clr-green)"></div> Completed (${completedTasks})</div>
                                <div class="an-legend-item"><div class="an-legend-dot" style="background:var(--bg-hover)"></div> Pending (${pendingTasks})</div>
                                <div class="an-legend-item"><div class="an-legend-dot" style="background:var(--clr-red)"></div> High Priority (${highPriority})</div>
                                <div class="an-legend-item"><div class="an-legend-dot" style="background:var(--clr-orange)"></div> Medium (${medPriority})</div>
                                <div class="an-legend-item"><div class="an-legend-dot" style="background:var(--clr-green)"></div> Low (${lowPriority})</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Project Progress -->
                <div class="card">
                    <div class="card-header"><h2><i class="fa-solid fa-folder-tree"></i> Project Progress</h2></div>
                    <div class="card-body">
                        ${projectBars.length > 0 ? `<div class="an-bar-chart">${projectBars.map(p => `
                            <div class="an-bar-row">
                                <span class="an-bar-label">${p.name}</span>
                                <div class="an-bar-track">
                                    <div class="an-bar-fill" style="width:${Math.max(p.pct, 5)}%;background:${p.color}">${p.pct}%</div>
                                </div>
                            </div>
                        `).join('')}</div>` : '<div style="text-align:center;color:var(--text-muted);padding:var(--spacing-4);">No projects yet</div>'}
                    </div>
                </div>

                <!-- Weekly Activity -->
                <div class="card">
                    <div class="card-header"><h2><i class="fa-solid fa-calendar-week"></i> Weekly Activity</h2></div>
                    <div class="card-body">
                        <div class="an-streak-grid" style="margin-bottom:var(--spacing-3);">${weeklyHTML}</div>
                        <div style="display:flex;gap:var(--spacing-3);font-size:0.8rem;color:var(--text-muted);">
                            <span><span class="an-streak-cell active" style="display:inline-block;width:12px;height:12px;margin-right:4px;vertical-align:middle;"></span> All habits done</span>
                            <span><span class="an-streak-cell partial" style="display:inline-block;width:12px;height:12px;margin-right:4px;vertical-align:middle;"></span> Partial</span>
                        </div>
                    </div>
                </div>

                <!-- Overview Stats -->
                <div class="card">
                    <div class="card-header"><h2><i class="fa-solid fa-chart-line"></i> Overview</h2></div>
                    <div class="card-body">
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-folder-tree"></i> Projects</span><span class="an-stat-value">${projects.length}</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-bullseye"></i> Goals</span><span class="an-stat-value">${goals.length}</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-users"></i> Meetings</span><span class="an-stat-value">${meetings.length}</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-regular fa-note-sticky"></i> Notes</span><span class="an-stat-value">${notes.length}</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-brain"></i> Knowledge Items</span><span class="an-stat-value">${knowledge.length}</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-book-open"></i> Books</span><span class="an-stat-value">${books.length} (${booksCompleted} done)</span></div>
                        <div class="an-stat-row"><span class="an-stat-label"><i class="fa-solid fa-wallet"></i> Net Balance</span><span class="an-stat-value" style="color:${income - expenses >= 0 ? 'var(--clr-green)' : 'var(--clr-red)'}">₹${Math.abs(income - expenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                </div>
            </div>
        `;
    }
}
