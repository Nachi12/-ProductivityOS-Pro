import { StorageManager } from './storage.js';
import { showToast } from './toast.js';

const storage = new StorageManager();

export class ExportManager {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        const btn = document.getElementById('export-excel-btn');
        if (btn) {
            btn.addEventListener('click', () => this.exportToExcel());
        }
    }

    exportToExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showToast('Export library is still loading. Please try again.', 'warning');
                return;
            }

            const wb = XLSX.utils.book_new();

            // Export Finance
            const txns = storage.get('transactions') || [];
            if (txns.length > 0) {
                const financeData = txns.map(t => ({
                    'Date': t.date,
                    'Person': t.person || 'Main',
                    'Title': t.title,
                    'Type': t.type,
                    'Category': t.category,
                    'Amount (₹)': t.amount,
                    'Interest Included (₹)': t.interest || 0
                }));
                const wsFinance = XLSX.utils.json_to_sheet(financeData);
                XLSX.utils.book_append_sheet(wb, wsFinance, "Finance Audit");
            } else {
                const wsFinance = XLSX.utils.json_to_sheet([{'Info': 'No finance data available'}]);
                XLSX.utils.book_append_sheet(wb, wsFinance, "Finance Audit");
            }

            // Export Tasks
            const tasks = storage.get('tasks') || [];
            if (tasks.length > 0) {
                const taskData = tasks.map(t => ({
                    'Title': t.title,
                    'List': t.listId,
                    'Status': t.completed ? 'Completed' : 'Pending',
                    'Priority': t.priority,
                    'Due Date': t.dueDate || 'N/A'
                }));
                const wsTasks = XLSX.utils.json_to_sheet(taskData);
                XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");
            }

            // Download file
            XLSX.writeFile(wb, `ProductivityOS_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Excel Export Successful!', 'success');
        } catch (error) {
            console.error('Export Error:', error);
            showToast('Failed to export Excel file.', 'error');
        }
    }
}

new ExportManager();
