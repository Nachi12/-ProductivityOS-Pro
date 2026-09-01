// js/theme.js
import { showToast } from './toast.js';

export class ThemeManager {
    constructor(storage) {
        this.storage = storage;
        this.initTheme();
        this.bindEvents();
    }

    initTheme() {
        const settings = this.storage.get('settings') || {};
        const savedTheme = localStorage.getItem('prodos_theme');
        const theme = savedTheme || settings.theme || 'dark';
        const color = settings.accentColor || 'electric';

        this.applyTheme(theme);
        this.applyAccent(color);
    }

    applyTheme(theme) {
        let activeTheme = theme;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            activeTheme = prefersDark ? 'dark' : 'light';
        }

        document.body.setAttribute('data-theme', activeTheme);
        localStorage.setItem('prodos_theme', activeTheme);

        const btn = document.getElementById('theme-switcher');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = activeTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            btn.setAttribute('data-tooltip', activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
    }

    applyAccent(colorName) {
        const colors = {
            electric: { bg: '#C7FF2E', hover: '#b1e626', text: '#0F0F0F' },
            peach: { bg: '#ff8a65', hover: '#ff7043', text: '#ffffff' },
            blue: { bg: '#2383e2', hover: '#1b6bbd', text: '#ffffff' },
            purple: { bg: '#8e24aa', hover: '#7b1fa2', text: '#ffffff' },
            green: { bg: '#43a047', hover: '#388e3c', text: '#ffffff' },
            orange: { bg: '#f4511e', hover: '#e64a19', text: '#ffffff' }
        };
        const root = document.documentElement;
        const selected = colors[colorName] || colors['electric'];

        root.style.setProperty('--accent-color', selected.bg);
        root.style.setProperty('--accent-hover', selected.hover);
        root.style.setProperty('--accent-text', selected.text);
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        const settings = this.storage.get('settings') || {};
        settings.theme = newTheme;
        this.storage.set('settings', settings);

        this.applyTheme(newTheme);
        showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
        return newTheme;
    }

    bindEvents() {
        const switcher = document.getElementById('theme-switcher');
        if (switcher) {
            switcher.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const settings = this.storage.get('settings') || {};
            if (settings.theme === 'system') {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}
