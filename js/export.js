// js/export.js
import { StorageManager } from './storage.js';
import { showToast } from './toast.js';

export function exportDataToCSV(storageInstance) {
    const storage = storageInstance || new StorageManager();
    try {
        if (typeof XLSX !== 'undefined') {
            const wb = XLSX.utils.book_new();

            const tasks = storage.get('tasks') || [];
            if (tasks.length > 0) {
                const taskData = tasks.map(t => ({
                    'Title': t.title,
                    'Category': t.category || t.project || 'General',
                    'Status': t.completed ? 'Completed' : 'Pending',
                    'Priority': t.priority || 'Medium',
                    'Due Date': t.dueDate || t.date || 'N/A'
                }));
                const wsTasks = XLSX.utils.json_to_sheet(taskData);
                XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");
            }

            const txns = storage.get('transactions') || [];
            if (txns.length > 0) {
                const financeData = txns.map(t => ({
                    'Date': t.date,
                    'Description': t.description || t.title,
                    'Type': t.type,
                    'Category': t.category,
                    'Amount': t.amount
                }));
                const wsFinance = XLSX.utils.json_to_sheet(financeData);
                XLSX.utils.book_append_sheet(wb, wsFinance, "Finance");
            }

            XLSX.writeFile(wb, `ProductivityOS_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Data exported successfully!', 'success');
        } else {
            const data = storage.getAll ? storage.getAll() : storage.get();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `ProductivityOS_Export_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast('JSON Backup downloaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Export Error:', error);
        showToast('Failed to export data.', 'error');
    }
}

export class ExportManager {
    constructor(storage) {
        this.storage = storage || new StorageManager();
        this.bindEvents();
    }

    bindEvents() {
        const btn = document.getElementById('export-excel-btn');
        if (btn) {
            btn.addEventListener('click', () => exportDataToCSV(this.storage));
        }
    }
}
