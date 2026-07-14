// js/router.js
export class Router {
    constructor() {
        this.views = document.querySelectorAll('.view');
        this.navItems = document.querySelectorAll('.nav-item[data-view]');
        this.bindEvents();
        this.init();
    }

    init() {
        // Simple hash routing
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigateTo(hash);
    }

    bindEvents() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const viewId = e.currentTarget.getAttribute('data-view');
                if (viewId) {
                    this.navigateTo(viewId);
                }
            });
        });

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            this.navigateTo(hash);
        });
    }

    navigateTo(viewId) {
        // Hide all
        this.views.forEach(v => v.classList.remove('active'));
        this.navItems.forEach(n => n.classList.remove('active'));

        // Show target
        const targetView = document.getElementById(`view-${viewId}`);
        const targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);

        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');
        
        // Dispatch custom event so modules can re-render if needed
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: viewId }));
    }
}
