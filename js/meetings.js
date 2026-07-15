// js/meetings.js
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal } from './modal.js';

export class MeetingsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.currentFilter = 'all';
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getMeetings() {
        return this.storage.get('meetings') || [];
    }

    saveMeetings(meetings) {
        this.storage.set('meetings', meetings);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'meetings-styles';
        style.textContent = `
            .meet-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--spacing-3); margin-bottom: var(--spacing-4); }
            .meet-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .meet-kpi-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
            .meet-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .meet-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .meet-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .meet-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .meet-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
            .meet-kpi-data .value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
            .meet-filters { display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-4); flex-wrap: wrap; }
            .meet-filter-btn { padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
            .meet-filter-btn:hover { background: var(--bg-hover); }
            .meet-filter-btn.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }
            .meet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--spacing-4); }
            .meet-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); }
            .meet-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .meet-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-3); }
            .meet-title { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
            .meet-with { font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
            .meet-status { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
            .meet-status.upcoming { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .meet-status.completed { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .meet-status.cancelled { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .meet-details { display: flex; gap: var(--spacing-4); font-size: 0.85rem; color: var(--text-muted); margin-bottom: var(--spacing-3); }
            .meet-details span { display: flex; align-items: center; gap: 4px; }
            .meet-notes-preview { font-size: 0.85rem; color: var(--text-muted); padding: var(--spacing-2) var(--spacing-3); background: var(--bg-hover); border-radius: var(--radius-sm); margin-bottom: var(--spacing-3); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .meet-actions { display: flex; gap: var(--spacing-2); padding-top: var(--spacing-3); border-top: 1px solid var(--border-light); }
            .meet-act-btn { padding: 6px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: all var(--transition-fast); background: var(--bg-input); color: var(--text-secondary); }
            .meet-act-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .meet-act-btn.danger:hover { color: var(--clr-red); border-color: var(--clr-red); }
            .meet-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .meet-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.4; }
            .meet-agenda-list { list-style: none; padding: 0; margin: var(--spacing-2) 0; }
            .meet-agenda-item { font-size: 0.85rem; color: var(--text-secondary); padding: 4px 0; display: flex; align-items: center; gap: var(--spacing-2); }
            .meet-agenda-item i { color: var(--accent-color); font-size: 0.7rem; }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-meetings');
        if (!container) return;

        const meetings = this.getMeetings();
        const today = new Date().toISOString().split('T')[0];

        // Auto-classify
        meetings.forEach(m => {
            if (m.status === 'upcoming' && m.date < today) {
                m.status = 'completed';
            }
        });

        const total = meetings.length;
        const upcoming = meetings.filter(m => m.status === 'upcoming').length;
        const completed = meetings.filter(m => m.status === 'completed').length;
        const thisWeek = meetings.filter(m => {
            const d = new Date(m.date + 'T00:00:00');
            const now = new Date();
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return d >= now && d <= weekEnd;
        }).length;

        const filtered = this.currentFilter === 'all' ? meetings : meetings.filter(m => m.status === this.currentFilter);
        const sorted = [...filtered].sort((a, b) => {
            // Upcoming first, then by date
            if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
            if (b.status === 'upcoming' && a.status !== 'upcoming') return 1;
            return new Date(b.date) - new Date(a.date);
        });

        let cardsHTML = '';
        if (sorted.length === 0) {
            cardsHTML = `<div class="meet-empty card"><div class="card-body"><i class="fa-solid fa-users"></i><h3>${meetings.length === 0 ? 'No meetings yet' : 'No meetings match this filter'}</h3><p>Schedule a meeting to get started</p></div></div>`;
        } else {
            cardsHTML = sorted.map(m => {
                const dateObj = new Date(m.date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                const agendaHTML = (m.agenda || []).length > 0
                    ? `<ul class="meet-agenda-list">${m.agenda.map(a => `<li class="meet-agenda-item"><i class="fa-solid fa-circle"></i> ${a}</li>`).join('')}</ul>`
                    : '';

                return `
                    <div class="card meet-card">
                        <div class="card-body">
                            <div class="meet-card-top">
                                <div>
                                    <div class="meet-title">${m.title}</div>
                                    <div class="meet-with"><i class="fa-solid fa-user"></i> ${m.attendees || 'No attendees'}</div>
                                </div>
                                <span class="meet-status ${m.status}">${m.status}</span>
                            </div>
                            <div class="meet-details">
                                <span><i class="fa-regular fa-calendar"></i> ${dateLabel}</span>
                                <span><i class="fa-regular fa-clock"></i> ${m.time || 'TBD'}</span>
                                <span><i class="fa-solid fa-hourglass-half"></i> ${m.duration || '30'} min</span>
                            </div>
                            ${agendaHTML}
                            ${m.notes ? `<div class="meet-notes-preview"><i class="fa-solid fa-sticky-note" style="margin-right:4px;"></i> ${m.notes}</div>` : ''}
                            <div class="meet-actions">
                                <button class="meet-act-btn meet-notes-btn" data-id="${m.id}"><i class="fa-solid fa-pencil"></i> Notes</button>
                                <button class="meet-act-btn meet-agenda-btn" data-id="${m.id}"><i class="fa-solid fa-list"></i> Agenda</button>
                                <button class="meet-act-btn meet-status-btn" data-id="${m.id}"><i class="fa-solid fa-rotate"></i> Status</button>
                                <button class="meet-act-btn danger meet-del-btn" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const filters = [
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' }
        ];

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Meetings</h1>
                    <p class="subtitle text-muted">Schedule, track agendas & notes</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-meeting-btn"><i class="fa-solid fa-plus"></i> New Meeting</button>
                </div>
            </div>
            <div class="card" style="margin-bottom:var(--spacing-4);">
                <div class="card-body">
                    <div class="meet-kpi-grid">
                        <div class="meet-kpi"><div class="meet-kpi-icon blue"><i class="fa-solid fa-users"></i></div><div class="meet-kpi-data"><h4>Total</h4><div class="value">${total}</div></div></div>
                        <div class="meet-kpi"><div class="meet-kpi-icon orange"><i class="fa-solid fa-clock"></i></div><div class="meet-kpi-data"><h4>Upcoming</h4><div class="value">${upcoming}</div></div></div>
                        <div class="meet-kpi"><div class="meet-kpi-icon green"><i class="fa-solid fa-check-circle"></i></div><div class="meet-kpi-data"><h4>Completed</h4><div class="value">${completed}</div></div></div>
                        <div class="meet-kpi"><div class="meet-kpi-icon purple"><i class="fa-solid fa-calendar-week"></i></div><div class="meet-kpi-data"><h4>This Week</h4><div class="value">${thisWeek}</div></div></div>
                    </div>
                </div>
            </div>
            <div class="meet-filters">
                ${filters.map(f => `<button class="meet-filter-btn ${this.currentFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
            </div>
            <div class="meet-grid">${cardsHTML}</div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Filters
        document.querySelectorAll('#view-meetings .meet-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });

        // New meeting
        document.getElementById('new-meeting-btn')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'Schedule Meeting', icon: 'fa-solid fa-users',
                submitLabel: 'Schedule', submitIcon: 'fa-solid fa-check',
                fields: [
                    { key: 'title', label: 'Meeting Title', type: 'text', placeholder: 'e.g. Sprint Planning...', required: true },
                    { key: 'attendees', label: 'Attendees', type: 'text', placeholder: 'Names...' },
                    { type: 'row', children: [
                        { key: 'date', label: 'Date', type: 'date', value: new Date().toISOString().split('T')[0] },
                        { key: 'time', label: 'Time', type: 'text', placeholder: '10:00', value: '10:00' }
                    ]},
                    { key: 'duration', label: 'Duration (minutes)', type: 'number', value: '30', placeholder: '30' }
                ]
            });
            if (!result) return;
            const meetings = this.getMeetings();
            meetings.push({ id: 'meet_' + Date.now(), title: result.title, attendees: result.attendees || '', date: result.date || new Date().toISOString().split('T')[0], time: result.time || '10:00', duration: result.duration || '30', status: 'upcoming', notes: '', agenda: [], createdAt: new Date().toISOString() });
            this.saveMeetings(meetings);
            showToast('Meeting scheduled!');
            this.render();
        });

        // Add notes
        document.querySelectorAll('#view-meetings .meet-notes-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const meetings = this.getMeetings();
                const meet = meetings.find(m => m.id === btn.dataset.id);
                if (!meet) return;
                const result = await showFormModal({
                    title: 'Meeting Notes', icon: 'fa-solid fa-pencil',
                    submitLabel: 'Save Notes', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'notes', label: 'Notes', type: 'textarea', value: meet.notes || '', placeholder: 'Write meeting notes...' }]
                });
                if (!result) return;
                meet.notes = result.notes;
                this.saveMeetings(meetings);
                showToast('Notes saved!');
                this.render();
            });
        });

        // Add agenda
        document.querySelectorAll('#view-meetings .meet-agenda-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const meetings = this.getMeetings();
                const meet = meetings.find(m => m.id === btn.dataset.id);
                if (!meet) return;
                const result = await showFormModal({
                    title: 'Add Agenda Item', icon: 'fa-solid fa-list',
                    submitLabel: 'Add', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'item', label: 'Agenda Item', type: 'text', placeholder: 'Discussion topic...', required: true }]
                });
                if (!result) return;
                meet.agenda = meet.agenda || [];
                meet.agenda.push(result.item);
                this.saveMeetings(meetings);
                showToast('Agenda item added!');
                this.render();
            });
        });

        // Change status
        document.querySelectorAll('#view-meetings .meet-status-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const meetings = this.getMeetings();
                const meet = meetings.find(m => m.id === btn.dataset.id);
                if (!meet) return;
                const result = await showFormModal({
                    title: 'Change Status', icon: 'fa-solid fa-rotate',
                    submitLabel: 'Update', submitIcon: 'fa-solid fa-check',
                    fields: [{ key: 'status', label: 'Status', type: 'select', value: meet.status, options: [
                        { value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }
                    ]}]
                });
                if (!result) return;
                meet.status = result.status;
                this.saveMeetings(meetings);
                showToast('Status updated!');
                this.render();
            });
        });

        // Delete
        document.querySelectorAll('#view-meetings .meet-del-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this meeting?', { title: 'Delete Meeting', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const meetings = this.getMeetings().filter(m => m.id !== btn.dataset.id);
                this.saveMeetings(meetings);
                showToast('Meeting deleted.');
                this.render();
            });
        });
    }
}
