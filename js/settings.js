// js/settings.js
import { showToast } from './toast.js';

export class SettingsManager {
    constructor(storage, themeManager) {
        this.storage = storage;
        this.themeManager = themeManager;
        this.bindEvents();
    }

    bindEvents() {
        // Export Logic
        document.getElementById('btn-export-data').addEventListener('click', () => {
            const url = this.storage.exportBackup();
            const a = document.createElement('a');
            a.href = url;
            a.download = `productivityOS_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Backup downloaded successfully.', 'success');
        });

        // Import Logic
        const fileInput = document.getElementById('file-import-data');
        document.getElementById('btn-import-data').addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const success = this.storage.importBackup(event.target.result);
                if (success) {
                    showToast('Data imported successfully! Reloading...', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast('Invalid backup file.', 'error');
                }
            };
            reader.readAsText(file);
        });

        // Reset Data
        document.getElementById('btn-danger-reset').addEventListener('click', () => {
            if(confirm('WARNING: This will permanently delete ALL data stored locally. Are you absolute sure?')) {
                this.storage.reset();
                showToast('All data erased. Reloading...', 'error');
                setTimeout(() => window.location.reload(), 1500);
            }
        });

        // Accent Colors
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                
                const color = e.target.getAttribute('data-color');
                const settings = this.storage.get('settings');
                settings.accentColor = color;
                this.storage.set('settings', settings);
                
                this.themeManager.applyAccent(color);
                showToast(`Accent color changed to ${color}.`);
            });
        });
    }
}
