// js/theme.js
export class ThemeManager {
    constructor(storage) {
        this.storage = storage;
        this.initTheme();
        this.bindEvents();
    }

    initTheme() {
        const settings = this.storage.get('settings');
        const theme = settings.theme || 'system';
        const color = settings.accentColor || 'electric';
        
        this.applyTheme(theme);
        this.applyAccent(color);
    }

    applyTheme(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.body.setAttribute('data-theme', theme);
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
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        const settings = this.storage.get('settings');
        settings.theme = newTheme;
        this.storage.set('settings', settings);
        
        this.applyTheme(newTheme);
        return newTheme;
    }

    bindEvents() {
        document.getElementById('theme-switcher').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Listen for OS theme changes if on system mode
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if(this.storage.get('settings').theme === 'system') {
                document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }
}
