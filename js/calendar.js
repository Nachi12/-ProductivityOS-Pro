// js/calendar.js
import { showToast } from './toast.js';
import { showFormModal, showConfirmModal } from './modal.js';

export class CalendarManager {
    constructor(storage) {
        this.storage = storage;
        this.currentDate = new Date();
        this.selectedDate = this.formatDate(new Date());
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    getEvents() {
        return this.storage.get('calendarEvents') || [];
    }

    saveEvents(events) {
        this.storage.set('calendarEvents', events);
    }

    getEventsForDate(dateStr) {
        return this.getEvents().filter(ev => ev.date === dateStr);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'calendar-styles';
        style.textContent = `
            .cal-container { display: grid; grid-template-columns: 1fr 340px; gap: var(--spacing-4); }
            .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-3); }
            .cal-nav h2 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
            .cal-nav button { background: none; border: 1px solid var(--border-color); width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
            .cal-nav button:hover { background: var(--bg-hover); color: var(--text-primary); }
            .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
            .cal-day-header { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; padding: var(--spacing-2) 0; letter-spacing: 0.05em; }
            .cal-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-fast); position: relative; font-size: 0.9rem; color: var(--text-secondary); gap: 3px; }
            .cal-cell:hover { background: var(--bg-hover); }
            .cal-cell.today { background: var(--accent-light); color: var(--accent-color); font-weight: 700; }
            .cal-cell.selected { background: var(--accent-color); color: white; font-weight: 600; }
            .cal-cell.selected .cal-dot { background: white; }
            .cal-cell.other-month { color: var(--text-muted); opacity: 0.4; }
            .cal-dots { display: flex; gap: 3px; }
            .cal-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-color); }
            .cal-sidebar-title { font-size: 1rem; font-weight: 600; margin-bottom: var(--spacing-3); color: var(--text-primary); }
            .cal-event-item { display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-3); border-radius: var(--radius-sm); background: var(--bg-hover); margin-bottom: var(--spacing-2); transition: all var(--transition-fast); }
            .cal-event-item:hover { box-shadow: var(--shadow-sm); }
            .cal-event-color { width: 4px; height: 36px; border-radius: 2px; flex-shrink: 0; }
            .cal-event-info { flex: 1; }
            .cal-event-info h4 { font-size: 0.9rem; font-weight: 500; color: var(--text-primary); }
            .cal-event-info span { font-size: 0.8rem; color: var(--text-muted); }
            .cal-event-del { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; transition: color var(--transition-fast); }
            .cal-event-del:hover { color: var(--clr-red); }
            .cal-empty { text-align: center; padding: var(--spacing-5); color: var(--text-muted); font-size: 0.9rem; }
            .cal-add-btn { width: 100%; margin-top: var(--spacing-3); }
            @media (max-width: 768px) { .cal-container { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-calendar');
        if (!container) return;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Build calendar grid cells
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1; // Monday = 0
        if (startDay < 0) startDay = 6;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const today = this.formatDate(new Date());
        const events = this.getEvents();

        let cellsHTML = '';

        // Previous month padding
        for (let i = startDay - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            cellsHTML += `<div class="cal-cell other-month">${d}</div>`;
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === this.selectedDate;
            const dayEvents = events.filter(e => e.date === dateStr);
            const dotsHTML = dayEvents.length > 0 ? `<div class="cal-dots">${dayEvents.slice(0, 3).map(e => `<div class="cal-dot" style="background:${e.color}"></div>`).join('')}</div>` : '';
            const classes = ['cal-cell'];
            if (isToday) classes.push('today');
            if (isSelected) classes.push('selected');
            cellsHTML += `<div class="${classes.join(' ')}" data-date="${dateStr}">${d}${dotsHTML}</div>`;
        }

        // Next month padding
        const totalCells = startDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let d = 1; d <= remaining; d++) {
            cellsHTML += `<div class="cal-cell other-month">${d}</div>`;
        }

        // Sidebar events
        const selectedEvents = this.getEventsForDate(this.selectedDate);
        const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
        const selectedLabel = selectedDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

        let eventsListHTML = '';
        if (selectedEvents.length === 0) {
            eventsListHTML = `<div class="cal-empty"><i class="fa-regular fa-calendar" style="font-size:1.5rem;margin-bottom:8px;display:block"></i>No events for this date</div>`;
        } else {
            eventsListHTML = selectedEvents.sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(ev => `
                <div class="cal-event-item">
                    <div class="cal-event-color" style="background:${ev.color}"></div>
                    <div class="cal-event-info">
                        <h4>${ev.title}</h4>
                        <span><i class="fa-regular fa-clock"></i> ${ev.time || 'All day'}</span>
                    </div>
                    <button class="cal-event-del" data-id="${ev.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Calendar</h1>
                    <p class="subtitle text-muted">Plan and schedule your events</p>
                </div>
            </div>
            <div class="cal-container">
                <div class="card">
                    <div class="card-body">
                        <div class="cal-nav">
                            <button id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                            <h2>${monthNames[month]} ${year}</h2>
                            <button id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div class="cal-grid">
                            ${dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('')}
                            ${cellsHTML}
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fa-regular fa-calendar-check"></i> ${selectedLabel}</h2>
                    </div>
                    <div class="card-body">
                        ${eventsListHTML}
                        <button class="btn btn-primary cal-add-btn" id="cal-add-event"><i class="fa-solid fa-plus"></i> Add Event</button>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Nav
        document.getElementById('cal-prev')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        });
        document.getElementById('cal-next')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        });

        // Date cells
        document.querySelectorAll('#view-calendar .cal-cell:not(.other-month)').forEach(cell => {
            cell.addEventListener('click', () => {
                this.selectedDate = cell.dataset.date;
                this.render();
            });
        });

        // Add event
        document.getElementById('cal-add-event')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'New Event', icon: 'fa-solid fa-calendar-plus',
                submitLabel: 'Add Event', submitIcon: 'fa-solid fa-check',
                fields: [
                    { key: 'title', label: 'Event Title', type: 'text', placeholder: 'Meeting, Birthday...', required: true },
                    { key: 'time', label: 'Time', type: 'text', placeholder: 'e.g. 14:00', value: '09:00' },
                    { key: 'color', label: 'Color', type: 'color', value: '#2383e2', colors: [
                        { value: '#2383e2', label: 'Blue' }, { value: '#8e24aa', label: 'Purple' },
                        { value: '#43a047', label: 'Green' }, { value: '#f4511e', label: 'Orange' }, { value: '#e53935', label: 'Red' }
                    ]}
                ]
            });
            if (!result) return;
            const events = this.getEvents();
            events.push({ id: 'ev_' + Date.now(), title: result.title, time: result.time, date: this.selectedDate, color: result.color });
            this.saveEvents(events);
            showToast('Event added!');
            this.render();
        });

        // Delete
        document.querySelectorAll('#view-calendar .cal-event-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const ok = await showConfirmModal('Delete this event?', { title: 'Delete Event', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const events = this.getEvents().filter(e => e.id !== id);
                this.saveEvents(events);
                showToast('Event deleted.');
                this.render();
            });
        });
    }
}
