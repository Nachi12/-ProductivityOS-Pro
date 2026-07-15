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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Core Storage DB
    const storage = new StorageManager();
    
    // 2. Initialize Theme Engine (loads preferences instantly)
    const themeManager = new ThemeManager(storage);
    
    // 3. Initialize Router (handles sidebar and view switching)
    const router = new Router();
    
    // 4. Initialize All Modules
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

    // Initial renders
    dashboard.init();
    taskManager.init();

    // Module map for view switching
    const moduleMap = {
        dashboard: dashboard,
        tasks: taskManager,
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

    // Event Listener to refresh modules when navigating to them
    document.addEventListener('viewChanged', (e) => {
        const view = e.detail;
        if (moduleMap[view]) {
            moduleMap[view].init();
        }
    });

    // Sidebar toggler desktop
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Mobile hamburger menu
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    function openMobileSidebar() {
        sidebar.classList.add('collapsed'); // collapsed = visible on mobile
        document.body.classList.add('sidebar-open');
    }
    function closeMobileSidebar() {
        sidebar.classList.remove('collapsed');
        document.body.classList.remove('sidebar-open');
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            if (sidebar.classList.contains('collapsed')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    // Close sidebar on overlay click (body::after acts as overlay)
    document.body.addEventListener('click', (e) => {
        if (document.body.classList.contains('sidebar-open') && e.target === document.body) {
            closeMobileSidebar();
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

    // Show/hide mobile toggle based on screen size
    function handleResize() {
        if (mobileToggle) {
            mobileToggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
        }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
});
