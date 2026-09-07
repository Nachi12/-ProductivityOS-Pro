// js/main.js
import { StorageManager } from './storage.js';
import { ThemeManager } from './theme.js';
import { Router } from './router.js';
import { Dashboard } from './dashboard.js';
import { TaskManager } from './tasks.js';
import { SettingsManager } from './settings.js';
import { CalendarManager } from './calendar.js';
import { HabitsManager } from './habits.js';
import { FinanceManager } from './finance.js';
import { ReadingManager } from './reading.js';
import { ProjectsManager } from './projects.js';
import { GoalsManager } from './goals.js';
import { KnowledgeManager } from './knowledge.js';
import { NotesManager } from './notes.js';
import { MeetingsManager } from './meetings.js';
import { AnalyticsManager } from './analytics.js';
import { FamilyManager } from './family.js';
import { ProfileManager } from './profile.js';
import { NotificationManager } from './notifications.js';
import { SearchManager } from './search.js';
import { showFormModal } from './modal.js';
import { showToast } from './toast.js';
import { exportDataToCSV } from './export.js';

function initApp() {
    // 1. Initialize Core Storage DB
    const storage = new StorageManager();
    
    // 2. Initialize Theme Engine (loads preferences instantly)
    const themeManager = new ThemeManager(storage);
    
    // 3. Initialize Notifications & Command Palette Search Engine
    const notificationManager = new NotificationManager(storage);
    const searchManager = new SearchManager(storage);
    
    // 4. Initialize All View Modules
    const dashboard = new Dashboard(storage);
    const taskManager = new TaskManager(storage);
    const settings = new SettingsManager(storage, themeManager);
    const calendarManager = new CalendarManager(storage);
    const habitsManager = new HabitsManager(storage);
    const financeManager = new FinanceManager(storage);
    const readingManager = new ReadingManager(storage);
    const projectsManager = new ProjectsManager(storage);
    const goalsManager = new GoalsManager(storage);
    const knowledgeManager = new KnowledgeManager(storage);
    const notesManager = new NotesManager(storage);
    const meetingsManager = new MeetingsManager(storage);
    const analyticsManager = new AnalyticsManager(storage);
    const familyManager = new FamilyManager(storage);
    const profileManager = new ProfileManager(storage);

    // Module map for view switching
    const moduleMap = {
        dashboard: dashboard,
        tasks: taskManager,
        profile: profileManager,
        family: familyManager,
        calendar: calendarManager,
        habits: habitsManager,
        finance: financeManager,
        reading: readingManager,
        projects: projectsManager,
        goals: goalsManager,
        knowledge: knowledgeManager,
        notes: notesManager,
        meetings: meetingsManager,
        analytics: analyticsManager
    };

    // Attach viewChanged event listener BEFORE Router initializes so initial route renders
    document.addEventListener('viewChanged', (e) => {
        const view = e.detail;
        if (moduleMap[view]) {
            try {
                moduleMap[view].init();
            } catch (err) {
                console.error(`Error rendering view ${view}:`, err);
            }
        }
    });

    // 5. Initialize Router (handles sidebar and view switching)
    const router = new Router();

    // Initial renders
    dashboard.init();

    // Quick Add Button Handler
    document.getElementById('btn-quick-add')?.addEventListener('click', async () => {
        const result = await showFormModal({
            title: 'Quick Add Item',
            icon: 'fa-solid fa-plus-circle',
            submitLabel: 'Create Item',
            fields: [
                { key: 'type', label: 'Item Type', type: 'dropdown', value: 'task', options: [
                    { value: 'task', label: 'Task' },
                    { value: 'note', label: 'Note' },
                    { value: 'goal', label: 'Goal' },
                    { value: 'expense', label: 'Finance Expense' }
                ]},
                { key: 'title', label: 'Title / Description', type: 'text', placeholder: 'e.g. Prepare Q3 Project Deck', required: true }
            ]
        });

        if (!result || !result.title) return;

        if (result.type === 'task') {
            const tasks = storage.get('tasks') || [];
            tasks.unshift({
                id: `task_${Date.now()}`,
                title: result.title,
                category: 'General',
                priority: 'medium',
                completed: false,
                dueDate: new Date().toISOString().split('T')[0]
            });
            storage.set('tasks', tasks);
            showToast("Quick Task added successfully!");
            taskManager.init();
        } else if (result.type === 'note') {
            const notes = storage.get('notes') || [];
            notes.unshift({
                id: `note_${Date.now()}`,
                title: result.title,
                content: '',
                tags: ['Quick'],
                updatedAt: new Date().toISOString()
            });
            storage.set('notes', notes);
            showToast("Quick Note added!");
            notesManager.init();
        } else if (result.type === 'goal') {
            const goals = storage.get('goals') || [];
            goals.unshift({
                id: `goal_${Date.now()}`,
                title: result.title,
                target: 100,
                current: 0,
                unit: '%'
            });
            storage.set('goals', goals);
            showToast("Goal created!");
            goalsManager.init();
        } else if (result.type === 'expense') {
            const txs = storage.get('transactions') || [];
            txs.unshift({
                id: `tx_${Date.now()}`,
                type: 'expense',
                description: result.title,
                amount: 50,
                category: 'General',
                date: new Date().toISOString().split('T')[0]
            });
            storage.set('transactions', txs);
            showToast("Expense recorded!");
            financeManager.init();
        }
        dashboard.init();
    });

    // Export Data Button Handler
    document.getElementById('export-excel-btn')?.addEventListener('click', () => {
        try {
            if (typeof exportDataToCSV === 'function') {
                exportDataToCSV(storage);
            } else {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storage.getAll(), null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `ProductivityOS_Data_${new Date().toISOString().split('T')[0]}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
            }
            showToast("Export download started!");
        } catch (e) {
            showToast("Export failed: " + e.message, "error");
        }
    });

    // Sidebar toggler desktop & mobile
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebarEl = document.getElementById('sidebar');

    function openMobileSidebar() {
        sidebarEl?.classList.add('mobile-open');
        document.body.classList.add('sidebar-open');
    }
    function closeMobileSidebar() {
        sidebarEl?.classList.remove('mobile-open');
        document.body.classList.remove('sidebar-open');
    }

    if (sidebarToggleBtn && sidebarEl) {
        if (localStorage.getItem('prodos_sidebar_collapsed') === 'true' && window.innerWidth > 768) {
            sidebarEl.classList.add('collapsed');
        }

        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            } else {
                const isCollapsed = sidebarEl.classList.toggle('collapsed');
                localStorage.setItem('prodos_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            }
        });
    }

    // Mobile hamburger menu
    const mobileToggle = document.getElementById('mobile-menu-toggle');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.body.classList.contains('sidebar-open')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    // Close sidebar on backdrop click or anywhere outside
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('sidebar-open')) {
            if (sidebarEl && !sidebarEl.contains(e.target) && mobileToggle && !mobileToggle.contains(e.target)) {
                closeMobileSidebar();
            }
        }
    });

    // Close sidebar when nav item is clicked (mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            }
        });
    });

    // Ensure responsive state on resize
    function handleResize() {
        if (window.innerWidth > 768) {
            closeMobileSidebar();
            if (localStorage.getItem('prodos_sidebar_collapsed') === 'true') {
                sidebarEl?.classList.add('collapsed');
            } else {
                sidebarEl?.classList.remove('collapsed');
            }
        }
    }
    window.addEventListener('resize', handleResize);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
