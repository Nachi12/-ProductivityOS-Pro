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
        const color = settings.accentColor || 'blue';
        
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
            blue: '#2383e2', purple: '#8e24aa', green: '#43a047', orange: '#f4511e'
        };
        const root = document.documentElement;
        if(colors[colorName]) {
            root.style.setProperty('--accent-color', colors[colorName]);
            // Generate a lighter hover state computationally (simplified here)
            root.style.setProperty('--accent-hover', colors[colorName]); 
        }
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
