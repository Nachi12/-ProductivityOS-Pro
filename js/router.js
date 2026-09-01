// js/router.js
export class Router {
    constructor() {
        this.bindEvents();
        this.init();
    }

    init() {
        // Detect pending invitation parameter in search or hash
        const urlParams = new URLSearchParams(window.location.search);
        let inviteCode = urlParams.get('invite') || urlParams.get('inviteToken');

        if (!inviteCode && window.location.hash.includes('invite=')) {
            inviteCode = window.location.hash.split('invite=')[1].split('&')[0];
        } else if (!inviteCode && window.location.hash.includes('inviteToken=')) {
            inviteCode = window.location.hash.split('inviteToken=')[1].split('&')[0];
        }

        if (inviteCode) {
            localStorage.setItem('prodos_pending_invite', inviteCode);
            sessionStorage.setItem('prodos_pending_invite', inviteCode);
            this.navigateTo('family');
            return;
        }

        const rawHash = window.location.hash.replace('#', '') || 'finance';
        const baseView = rawHash.split('?')[0];
        this.navigateTo(baseView || 'finance');
    }

    bindEvents() {
        // Event delegation on document so static and dynamic links work 100% reliably
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item[data-view]');
            if (navItem) {
                const viewId = navItem.getAttribute('data-view');
                if (viewId) {
                    this.navigateTo(viewId);
                }
            }
        });

        window.addEventListener('hashchange', () => {
            const rawHash = window.location.hash.replace('#', '') || 'finance';
            const baseView = rawHash.split('?')[0];
            this.navigateTo(baseView || 'finance');
        });
    }

    navigateTo(viewId) {
        const views = document.querySelectorAll('.view');
        const navItems = document.querySelectorAll('.nav-item[data-view]');

        views.forEach(v => v.classList.remove('active'));
        navItems.forEach(n => n.classList.remove('active'));

        const targetView = document.getElementById(`view-${viewId}`);
        const targetNavs = document.querySelectorAll(`.nav-item[data-view="${viewId}"]`);

        if (targetView) {
            targetView.classList.add('active');
        } else {
            const finView = document.getElementById('view-finance');
            if (finView) finView.classList.add('active');
        }

        targetNavs.forEach(n => n.classList.add('active'));

        const currentHash = window.location.hash.replace('#', '').split('?')[0];
        if (currentHash !== viewId) {
            try {
                window.history.pushState(null, '', `#${viewId}`);
            } catch (e) {
                window.location.hash = viewId;
            }
        }

        // Update breadcrumb bar
        const routeMap = {
            finance: { cat: 'Home', name: 'Overview' },
            money: { cat: 'Money', name: 'Transactions & Ledger' },
            analysis: { cat: 'Understand', name: 'Financial Health' },
            debt: { cat: 'Debt', name: 'Debt & Simulator' },
            wealth: { cat: 'Wealth', name: 'Wealth & Assets' },
            goals: { cat: 'Wealth', name: 'Financial Goals' },
            forecast: { cat: 'AI Intelligence', name: 'Forecast & What-If' },
            'ai-copilot': { cat: 'AI Intelligence', name: 'AI Financial Copilot' },
            reports: { cat: 'AI Intelligence', name: 'Financial Reports' },
            family: { cat: 'Family', name: 'Family Finance' },
            dashboard: { cat: 'Personal', name: 'Task Dashboard' },
            tasks: { cat: 'Personal', name: 'Tasks' },
            projects: { cat: 'Personal', name: 'Projects' },
            notes: { cat: 'Personal', name: 'Notes' },
            knowledge: { cat: 'Personal', name: 'Knowledge Vault' },
            calendar: { cat: 'Personal', name: 'Calendar' },
            habits: { cat: 'Personal', name: 'Habits' },
            meetings: { cat: 'Personal', name: 'Meetings' },
            reading: { cat: 'Personal', name: 'Reading' },
            profile: { cat: 'System', name: 'Profile' },
            settings: { cat: 'System', name: 'Settings' }
        };

        const info = routeMap[viewId] || { cat: 'System', name: viewId };
        const bcCat = document.getElementById('bc-category');
        const bcCur = document.getElementById('bc-current');
        if (bcCat) bcCat.textContent = info.cat;
        if (bcCur) bcCur.textContent = info.name;

        // Auto-expand section containing active view
        const activeNavItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNavItem) {
            const section = activeNavItem.closest('.nav-section');
            if (section && section.classList.contains('section-collapsed')) {
                section.classList.remove('section-collapsed');
            }
        }

        // Dispatch custom event to notify view module to render
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: viewId }));
    }
}
