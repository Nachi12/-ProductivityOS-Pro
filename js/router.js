// js/router.js
export class Router {
    constructor() {
        this.bindEvents();
        this.init();
    }

    init() {
        const rawHash = window.location.hash.replace('#', '') || 'dashboard';
        const baseView = rawHash.split('?')[0];
        this.navigateTo(baseView || 'dashboard');
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
            const rawHash = window.location.hash.replace('#', '') || 'dashboard';
            const baseView = rawHash.split('?')[0];
            this.navigateTo(baseView || 'dashboard');
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
            const dashView = document.getElementById('view-dashboard');
            if (dashView) dashView.classList.add('active');
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

        // Dispatch custom event to notify view module to render
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: viewId }));
    }
}
