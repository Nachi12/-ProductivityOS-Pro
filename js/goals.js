// js/goals.js
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal } from './modal.js';

export class GoalsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getGoals() {
        return this.storage.get('goals') || [];
    }

    saveGoals(goals) {
        this.storage.set('goals', goals);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'goals-styles';
        style.textContent = `
            .goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: var(--spacing-4); margin-top: var(--spacing-4); }
            .goal-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); }
            .goal-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .goal-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--spacing-3); }
            .goal-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
            .goal-deadline { font-size: 0.8rem; color: var(--text-muted); }
            .goal-deadline.overdue { color: var(--clr-red); font-weight: 600; }
            .goal-progress-ring { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
            .goal-progress-ring svg { transform: rotate(-90deg); }
            .goal-progress-ring .ring-bg { fill: none; stroke: var(--bg-hover); stroke-width: 5; }
            .goal-progress-ring .ring-fill { fill: none; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }
            .goal-pct-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: var(--text-primary); }
            .goal-kr-list { list-style: none; padding: 0; margin: 0; }
            .goal-kr-item { display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light); font-size: 0.9rem; }
            .goal-kr-item:last-child { border-bottom: none; }
            .goal-kr-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition-fast); font-size: 0.7rem; flex-shrink: 0; background: none; color: transparent; }
            .goal-kr-check.done { background: var(--clr-green); border-color: var(--clr-green); color: white; }
            .goal-kr-text { flex: 1; color: var(--text-secondary); }
            .goal-kr-text.done { text-decoration: line-through; color: var(--text-muted); }
            .goal-kr-del { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; opacity: 0; transition: opacity var(--transition-fast); }
            .goal-kr-item:hover .goal-kr-del { opacity: 1; }
            .goal-kr-del:hover { color: var(--clr-red); }
            .goal-actions { display: flex; gap: var(--spacing-2); margin-top: var(--spacing-3); padding-top: var(--spacing-3); border-top: 1px solid var(--border-light); }
            .goal-act-btn { padding: 6px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: all var(--transition-fast); background: var(--bg-input); color: var(--text-secondary); }
            .goal-act-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .goal-act-btn.danger:hover { color: var(--clr-red); border-color: var(--clr-red); }
            .goals-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--spacing-3); }
            .goals-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .goals-kpi-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
            .goals-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .goals-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .goals-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .goals-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .goals-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
            .goals-kpi-data .value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
            .goals-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .goals-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.4; }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-goals');
        if (!container) return;

        const goals = this.getGoals();
        const total = goals.length;
        const allKRs = goals.reduce((sum, g) => sum + (g.keyResults || []).length, 0);
        const doneKRs = goals.reduce((sum, g) => sum + (g.keyResults || []).filter(kr => kr.done).length, 0);
        const completedGoals = goals.filter(g => {
            const krs = g.keyResults || [];
            return krs.length > 0 && krs.every(kr => kr.done);
        }).length;
        const overallPct = allKRs > 0 ? Math.round((doneKRs / allKRs) * 100) : 0;

        let cardsHTML = '';
        if (goals.length === 0) {
            cardsHTML = `<div class="goals-empty card"><div class="card-body"><i class="fa-solid fa-bullseye"></i><h3>No goals set yet</h3><p>Set objectives and key results to track your progress</p></div></div>`;
        } else {
            cardsHTML = goals.map(g => {
                const krs = g.keyResults || [];
                const doneCount = krs.filter(kr => kr.done).length;
                const pct = krs.length > 0 ? Math.round((doneCount / krs.length) * 100) : 0;
                const r = 23;
                const circ = 2 * Math.PI * r;
                const offset = circ - (pct / 100) * circ;

                const today = new Date();
                const deadline = g.deadline ? new Date(g.deadline + 'T00:00:00') : null;
                const isOverdue = deadline && deadline < today && pct < 100;
                const deadlineLabel = deadline ? deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline';

                const krsHTML = krs.map((kr, i) => `
                    <li class="goal-kr-item">
                        <button class="goal-kr-check ${kr.done ? 'done' : ''}" data-goal="${g.id}" data-kr="${i}"><i class="fa-solid fa-check"></i></button>
                        <span class="goal-kr-text ${kr.done ? 'done' : ''}">${kr.text}</span>
                        <button class="goal-kr-del" data-goal="${g.id}" data-kr="${i}"><i class="fa-solid fa-xmark"></i></button>
                    </li>
                `).join('');

                return `
                    <div class="card goal-card">
                        <div class="card-body">
                            <div class="goal-top">
                                <div>
                                    <div class="goal-title">${g.title}</div>
                                    <div class="goal-deadline ${isOverdue ? 'overdue' : ''}"><i class="fa-regular fa-calendar"></i> ${isOverdue ? 'Overdue: ' : ''}${deadlineLabel}</div>
                                </div>
                                <div class="goal-progress-ring">
                                    <svg width="56" height="56"><circle class="ring-bg" cx="28" cy="28" r="${r}"/><circle class="ring-fill" cx="28" cy="28" r="${r}" style="stroke:${g.color};stroke-dasharray:${circ};stroke-dashoffset:${offset}"/></svg>
                                    <div class="goal-pct-label">${pct}%</div>
                                </div>
                            </div>
                            <ul class="goal-kr-list">${krsHTML || '<li class="goal-kr-item" style="color:var(--text-muted);justify-content:center;">No key results added</li>'}</ul>
                            <div class="goal-actions">
                                <button class="goal-act-btn goal-add-kr-btn" data-id="${g.id}"><i class="fa-solid fa-plus"></i> Key Result</button>
                                <button class="goal-act-btn danger goal-del-btn" data-id="${g.id}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Goals (OKRs)</h1>
                    <p class="subtitle text-muted">Set objectives and track key results</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-goal-btn"><i class="fa-solid fa-plus"></i> New Goal</button>
                </div>
            </div>
            <div class="card" style="margin-bottom:var(--spacing-4);">
                <div class="card-body">
                    <div class="goals-kpi-grid">
                        <div class="goals-kpi"><div class="goals-kpi-icon blue"><i class="fa-solid fa-bullseye"></i></div><div class="goals-kpi-data"><h4>Total Goals</h4><div class="value">${total}</div></div></div>
                        <div class="goals-kpi"><div class="goals-kpi-icon green"><i class="fa-solid fa-check-double"></i></div><div class="goals-kpi-data"><h4>Completed</h4><div class="value">${completedGoals}</div></div></div>
                        <div class="goals-kpi"><div class="goals-kpi-icon orange"><i class="fa-solid fa-key"></i></div><div class="goals-kpi-data"><h4>Key Results</h4><div class="value">${doneKRs}/${allKRs}</div></div></div>
                        <div class="goals-kpi"><div class="goals-kpi-icon purple"><i class="fa-solid fa-chart-line"></i></div><div class="goals-kpi-data"><h4>Progress</h4><div class="value">${overallPct}%</div></div></div>
                    </div>
                </div>
            </div>
            <div class="goals-grid">${cardsHTML}</div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // New goal
        document.getElementById('new-goal-btn')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'New Goal', icon: 'fa-solid fa-bullseye',
                submitLabel: 'Create Goal', submitIcon: 'fa-solid fa-check',
                fields: [
                    { key: 'title', label: 'Objective', type: 'text', placeholder: 'e.g. Launch MVP by Q3...', required: true },
                    { key: 'deadline', label: 'Deadline', type: 'date', value: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0] },
                    { key: 'color', label: 'Color', type: 'color', value: '#2383e2', colors: [
                        { value: '#2383e2', label: 'Blue' }, { value: '#8e24aa', label: 'Purple' },
                        { value: '#43a047', label: 'Green' }, { value: '#f4511e', label: 'Orange' }, { value: '#00897b', label: 'Teal' }
                    ]}
                ]
            });
            if (!result) return;
            const goals = this.getGoals();
            goals.push({ id: 'goal_' + Date.now(), title: result.title, deadline: result.deadline || '', color: result.color || '#2383e2', keyResults: [], createdAt: new Date().toISOString() });
            this.saveGoals(goals);
            showToast('Goal created!');
            this.render();
        });

        // Add key result
        document.querySelectorAll('#view-goals .goal-add-kr-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const result = await showFormModal({
                    title: 'Add Key Result', icon: 'fa-solid fa-key',
                    submitLabel: 'Add', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'text', label: 'Key Result', type: 'text', placeholder: 'Measurable outcome...', required: true }]
                });
                if (!result) return;
                const goals = this.getGoals();
                const goal = goals.find(g => g.id === btn.dataset.id);
                if (goal) {
                    goal.keyResults = goal.keyResults || [];
                    goal.keyResults.push({ text: result.text, done: false });
                    this.saveGoals(goals);
                    showToast('Key result added!');
                    this.render();
                }
            });
        });

        // Toggle KR
        document.querySelectorAll('#view-goals .goal-kr-check').forEach(btn => {
            btn.addEventListener('click', () => {
                const goals = this.getGoals();
                const goal = goals.find(g => g.id === btn.dataset.goal);
                if (goal && goal.keyResults) {
                    const kr = goal.keyResults[parseInt(btn.dataset.kr)];
                    if (kr) {
                        kr.done = !kr.done;
                        this.saveGoals(goals);
                        this.render();
                    }
                }
            });
        });

        // Delete KR
        document.querySelectorAll('#view-goals .goal-kr-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const goals = this.getGoals();
                const goal = goals.find(g => g.id === btn.dataset.goal);
                if (goal && goal.keyResults) {
                    goal.keyResults.splice(parseInt(btn.dataset.kr), 1);
                    this.saveGoals(goals);
                    this.render();
                }
            });
        });

        // Delete goal
        document.querySelectorAll('#view-goals .goal-del-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this goal and all key results?', { title: 'Delete Goal', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const goals = this.getGoals().filter(g => g.id !== btn.dataset.id);
                this.saveGoals(goals);
                showToast('Goal deleted.');
                this.render();
            });
        });
    }
}
