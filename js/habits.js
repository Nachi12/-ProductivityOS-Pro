// js/habits.js
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal } from './modal.js';

export class HabitsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getHabits() {
        return this.storage.get('habits') || [];
    }

    saveHabits(habits) {
        this.storage.set('habits', habits);
    }

    todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    getDateStr(daysAgo) {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    getStreak(completions) {
        let streak = 0;
        const sorted = [...completions].sort().reverse();
        const today = this.todayStr();
        let checkDate = today;

        for (let i = 0; i < 365; i++) {
            if (sorted.includes(checkDate)) {
                streak++;
                const d = new Date(checkDate + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                checkDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else {
                // Allow today to be unchecked yet (streak from yesterday)
                if (i === 0) {
                    const d = new Date(today + 'T00:00:00');
                    d.setDate(d.getDate() - 1);
                    checkDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    continue;
                }
                break;
            }
        }
        return streak;
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'habits-styles';
        style.textContent = `
            .habits-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--spacing-4); margin-top: var(--spacing-4); }
            .habit-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); }
            .habit-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .habit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-3); }
            .habit-info { display: flex; align-items: center; gap: var(--spacing-3); }
            .habit-emoji { font-size: 1.8rem; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--bg-hover); }
            .habit-meta h3 { font-size: 1rem; font-weight: 600; color: var(--text-primary); }
            .habit-meta span { font-size: 0.8rem; color: var(--text-muted); }
            .habit-actions { display: flex; gap: var(--spacing-2); }
            .habit-check { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition-fast); font-size: 1.1rem; background: none; color: var(--text-muted); }
            .habit-check.checked { border-color: transparent; color: white; }
            .habit-streak { display: flex; align-items: center; gap: var(--spacing-2); font-size: 0.85rem; font-weight: 600; margin-bottom: var(--spacing-3); padding: var(--spacing-2) var(--spacing-3); border-radius: var(--radius-sm); background: var(--bg-hover); }
            .habit-streak i { color: var(--clr-orange); }
            .heatmap { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; }
            .heatmap-cell { width: 14px; height: 14px; border-radius: 3px; background: var(--bg-hover); transition: background var(--transition-fast); }
            .heatmap-cell.completed { opacity: 1; }
            .heatmap-cell[title] { cursor: default; }
            .hab-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--spacing-3); }
            .hab-kpi { display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-3); }
            .hab-kpi-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
            .hab-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .hab-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .hab-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .hab-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .hab-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
            .hab-kpi-data .value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
            .habit-delete { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
            .habit-delete:hover { color: var(--clr-red); background: rgba(229,57,53,0.1); }
            .habits-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .habits-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.5; }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-habits');
        if (!container) return;

        const habits = this.getHabits();
        const today = this.todayStr();

        // KPIs
        const totalHabits = habits.length;
        const completedToday = habits.filter(h => h.completions.includes(today)).length;
        const bestStreak = habits.reduce((max, h) => Math.max(max, this.getStreak(h.completions)), 0);
        const totalCompletions = habits.reduce((sum, h) => sum + h.completions.length, 0);
        const totalPossible = habits.reduce((sum, h) => {
            const created = new Date(h.createdAt + 'T00:00:00');
            const now = new Date();
            const days = Math.floor((now - created) / 86400000) + 1;
            return sum + days;
        }, 0);
        const completionRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;

        // Habit cards
        let cardsHTML = '';
        if (habits.length === 0) {
            cardsHTML = `<div class="habits-empty card"><div class="card-body"><i class="fa-solid fa-repeat"></i><h3>No habits yet</h3><p>Start building positive habits by clicking "New Habit"</p></div></div>`;
        } else {
            cardsHTML = habits.map(h => {
                const streak = this.getStreak(h.completions);
                const isDoneToday = h.completions.includes(today);

                // Heatmap (last 30 days)
                let heatmapHTML = '';
                for (let i = 29; i >= 0; i--) {
                    const dateStr = this.getDateStr(i);
                    const done = h.completions.includes(dateStr);
                    const d = new Date(dateStr + 'T00:00:00');
                    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    heatmapHTML += `<div class="heatmap-cell ${done ? 'completed' : ''}" title="${label}" style="${done ? `background:${h.color}` : ''}"></div>`;
                }

                return `
                    <div class="card habit-card">
                        <div class="card-body">
                            <div class="habit-top">
                                <div class="habit-info">
                                    <div class="habit-emoji">${h.emoji}</div>
                                    <div class="habit-meta">
                                        <h3>${h.name}</h3>
                                        <span>${h.frequency}</span>
                                    </div>
                                </div>
                                <div class="habit-actions">
                                    <button class="habit-check ${isDoneToday ? 'checked' : ''}" data-id="${h.id}" style="${isDoneToday ? `background:${h.color};border-color:${h.color}` : ''}">
                                        <i class="fa-solid ${isDoneToday ? 'fa-check' : 'fa-plus'}"></i>
                                    </button>
                                    <button class="habit-delete" data-id="${h.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="habit-streak">
                                <i class="fa-solid fa-fire"></i>
                                <span>${streak} day streak</span>
                            </div>
                            <div class="heatmap">${heatmapHTML}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Habit Tracker</h1>
                    <p class="subtitle text-muted">Build consistency, track progress</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-habit-btn"><i class="fa-solid fa-plus"></i> New Habit</button>
                </div>
            </div>
            <div class="card" style="margin-bottom: var(--spacing-4);">
                <div class="card-body">
                    <div class="hab-kpi-grid">
                        <div class="hab-kpi">
                            <div class="hab-kpi-icon blue"><i class="fa-solid fa-repeat"></i></div>
                            <div class="hab-kpi-data"><h4>Total Habits</h4><div class="value">${totalHabits}</div></div>
                        </div>
                        <div class="hab-kpi">
                            <div class="hab-kpi-icon green"><i class="fa-solid fa-check-double"></i></div>
                            <div class="hab-kpi-data"><h4>Done Today</h4><div class="value">${completedToday}/${totalHabits}</div></div>
                        </div>
                        <div class="hab-kpi">
                            <div class="hab-kpi-icon orange"><i class="fa-solid fa-fire"></i></div>
                            <div class="hab-kpi-data"><h4>Best Streak</h4><div class="value">${bestStreak} Days</div></div>
                        </div>
                        <div class="hab-kpi">
                            <div class="hab-kpi-icon purple"><i class="fa-solid fa-chart-line"></i></div>
                            <div class="hab-kpi-data"><h4>Completion</h4><div class="value">${completionRate}%</div></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="habits-grid">${cardsHTML}</div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // New habit
        document.getElementById('new-habit-btn')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'New Habit', icon: 'fa-solid fa-repeat',
                submitLabel: 'Create Habit', submitIcon: 'fa-solid fa-check',
                fields: [
                    { key: 'name', label: 'Habit Name', type: 'text', placeholder: 'e.g. Exercise, Read, Meditate...', required: true },
                    { key: 'emoji', label: 'Emoji Icon', type: 'text', placeholder: '✅', value: '✅' },
                    { key: 'color', label: 'Color', type: 'color', value: '#43a047', colors: [
                        { value: '#2383e2', label: 'Blue' }, { value: '#8e24aa', label: 'Purple' },
                        { value: '#43a047', label: 'Green' }, { value: '#f4511e', label: 'Orange' }, { value: '#e53935', label: 'Red' }
                    ]}
                ]
            });
            if (!result) return;

            const habits = this.getHabits();
            habits.push({
                id: 'hab_' + Date.now(),
                name: result.name,
                emoji: result.emoji || '✅',
                color: result.color || '#43a047',
                frequency: 'daily',
                completions: [],
                createdAt: this.todayStr()
            });
            this.saveHabits(habits);
            showToast('Habit created!');
            this.render();
        });

        // Toggle today
        document.querySelectorAll('#view-habits .habit-check').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const habits = this.getHabits();
                const habit = habits.find(h => h.id === id);
                if (!habit) return;

                const today = this.todayStr();
                if (habit.completions.includes(today)) {
                    habit.completions = habit.completions.filter(d => d !== today);
                    showToast('Unmarked for today.');
                } else {
                    habit.completions.push(today);
                    showToast('Habit completed! 🎉');
                }
                this.saveHabits(habits);
                this.render();
            });
        });

        // Delete
        document.querySelectorAll('#view-habits .habit-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this habit and all its data?', { title: 'Delete Habit', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const habits = this.getHabits().filter(h => h.id !== btn.dataset.id);
                this.saveHabits(habits);
                showToast('Habit deleted.');
                this.render();
            });
        });
    }
}
