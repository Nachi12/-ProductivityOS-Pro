// js/storage.js
import { authManager } from './auth.js';
import { showToast } from './toast.js';

export class StorageManager {
    constructor() {
        this.BASE_NAMESPACE = 'prodos_data_v1';
        this.syncTimeout = null;
        this.backendUrl = window.location.origin + '/api/sync';
        this.initializeDB();

        // Listen for auth changes
        authManager.onAuthChange((user) => {
            if (user) {
                this.handleUserLogin(user);
            }
        });
    }

    getNamespace() {
        if (authManager && authManager.currentUser && authManager.currentUser.uid) {
            return `prodos_data_${authManager.currentUser.uid}`;
        }
        return this.BASE_NAMESPACE;
    }

    getDefaultState() {
        const today = new Date().toISOString().split('T')[0];
        return {
            settings: { theme: 'dark', accentColor: 'electric' },
            tasks: [
                { id: 't1', title: 'Complete Q3 Product Architecture Deck', priority: 'High', project: 'Enterprise OS', completed: true, date: today, dueDate: today, category: 'Business' },
                { id: 't2', title: 'Finalize Mobile App Responsive Controls', priority: 'High', project: 'Mobile App', completed: false, date: today, dueDate: today, category: 'Engineering' },
                { id: 't3', title: 'Review MongoDB Cloud Synchronization Pipeline', priority: 'Medium', project: 'Enterprise OS', completed: true, date: today, dueDate: today, category: 'Backend' },
                { id: 't4', title: 'Schedule Q3 Team Performance Reviews', priority: 'Medium', project: 'Operations', completed: false, date: today, dueDate: today, category: 'Management' },
                { id: 't5', title: 'Update Design System Tokens & Typography', priority: 'Low', project: 'Design System', completed: true, date: today, dueDate: today, category: 'Design' }
            ],
            brainDump: 'Explore AI integration for automated task categorization and budget predictions.',
            habits: [
                { id: 'h1', name: 'Morning Deep Meditation', target: '15 mins', streak: 12, completions: [today], frequency: 'daily' },
                { id: 'h2', name: 'Daily Technical Reading', target: '30 mins', streak: 8, completions: [today], frequency: 'daily' },
                { id: 'h3', name: 'Physical Fitness / Gym', target: '45 mins', streak: 5, completions: [today], frequency: 'daily' }
            ],
            projects: [
                { id: 'p1', name: 'Enterprise OS', title: 'Enterprise OS', status: 'In Progress', progress: 85, color: '#2383e2', tasksCount: 12 },
                { id: 'p2', name: 'Mobile App', title: 'Mobile App Launch', status: 'In Progress', progress: 60, color: '#C7FF2E', tasksCount: 8 },
                { id: 'p3', name: 'Marketing Campaign', title: 'Q3 Growth Marketing', status: 'Planning', progress: 30, color: '#ff8a65', tasksCount: 5 }
            ],
            goals: [
                { id: 'g1', title: 'Product Launch v2.0', target: 100, current: 80, unit: '%', keyResults: [{ name: 'Pass all build tests', done: true }, { name: 'Deploy backend server', done: true }] },
                { id: 'g2', title: 'Scale Active User Base', target: 500, current: 320, unit: 'Users', keyResults: [{ name: 'Publish Google invite links', done: true }] }
            ],
            transactions: [
                { id: 'tx1', type: 'income', title: 'Enterprise Client Milestone Payment', description: 'Enterprise Client Milestone Payment', amount: 4500, category: 'Consulting', date: today },
                { id: 'tx2', type: 'expense', title: 'MongoDB Cloud Database Hosting', description: 'MongoDB Cloud Database Hosting', amount: 120, category: 'Infrastructure', date: today },
                { id: 'tx3', type: 'expense', title: 'Google Developer Workspace Subscription', description: 'Google Developer Workspace Subscription', amount: 45, category: 'Software', date: today },
                { id: 'tx4', type: 'expense', title: 'Office Supplies & Equipment', description: 'Office Supplies & Equipment', amount: 180, category: 'Operations', date: today }
            ],
            loans: [],
            books: [
                { id: 'b1', title: 'Atomic Habits', author: 'James Clear', totalPages: 320, currentPage: 280, status: 'reading' },
                { id: 'b2', title: 'Deep Work', author: 'Cal Newport', totalPages: 300, currentPage: 300, status: 'completed' }
            ],
            knowledgeVault: [
                { id: 'kv1', title: 'System Architecture & Data Flows', category: 'Architecture', tags: ['Backend', 'MongoDB'], content: 'Documentation for multi-user family sync and MongoDB schemas.' },
                { id: 'kv2', title: 'Design System Guidelines', category: 'Design', tags: ['CSS', 'Tokens'], content: 'Color palettes, spacing units, and responsive glassmorphism rules.' }
            ],
            notes: [
                { id: 'n1', title: 'Product Strategy & Roadmap 2026', content: 'Key priorities: Google Auth integration, Family accounts sync, and mobile responsiveness.', updatedAt: new Date().toISOString() },
                { id: 'n2', title: 'Weekly Engineering Action Items', content: '1. Verify ES module loader.\n2. Ensure document readyState check for fast startup.', updatedAt: new Date().toISOString() }
            ],
            meetings: [
                { id: 'm1', title: 'Q3 Product Review Meeting', date: today, time: '14:00', attendees: ['Nachiketa NR', 'Engineering Team'], notes: 'Review milestone progress and release timeline.' }
            ]
        };
    }

    initializeDB() {
        const activeNamespace = this.getNamespace();
        const existingData = localStorage.getItem(activeNamespace);

        if (!existingData) {
            const legacyData = localStorage.getItem(this.BASE_NAMESPACE);
            if (legacyData && activeNamespace !== this.BASE_NAMESPACE) {
                localStorage.setItem(activeNamespace, legacyData);
            } else {
                localStorage.setItem(activeNamespace, JSON.stringify(this.getDefaultState()));
            }
        }
    }

    get(key) {
        const ns = this.getNamespace();
        const raw = localStorage.getItem(ns) || localStorage.getItem(this.BASE_NAMESPACE);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return key ? parsed[key] : parsed;
        } catch (e) {
            console.error("Storage parse error:", e);
            return null;
        }
    }

    getAll() {
        return this.get(null) || this.getDefaultState();
    }

    set(key, value) {
        const ns = this.getNamespace();
        const data = this.get() || this.getDefaultState();
        data[key] = value;
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(ns, JSON.stringify(data));
        this.queueSync();
    }

    async handleUserLogin(user) {
        this.initializeDB();
        await this.fetchCloudData();
    }

    async fetchCloudData() {
        if (!authManager || !authManager.currentUser) return;
        try {
            const res = await fetch(this.backendUrl, {
                headers: {
                    'Authorization': 'Bearer ' + (authManager.token || 'mock-token'),
                    'x-user-uid': authManager.currentUser.uid
                }
            });
            const result = await res.json();
            if (result.success) {
                const cloudData = result.data || {};
                const localData = this.get() || {};

                const cloudTime = new Date(result.lastUpdated || cloudData.lastUpdated || 0).getTime();
                const localTime = new Date(localData.lastUpdated || 0).getTime();

                if (Object.keys(cloudData).length > 0 && cloudTime > localTime) {
                    const ns = this.getNamespace();
                    localStorage.setItem(ns, JSON.stringify(cloudData));
                }
            }
        } catch (err) {
            console.warn("Cloud sync notice (offline mode active):", err.message);
        }
    }

    queueSync() {
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this.syncToCloud(), 1500);
    }

    async syncToCloud() {
        if (!authManager || !authManager.currentUser) return;
        try {
            const data = this.getAll();
            await fetch(this.backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (authManager.token || 'mock-token'),
                    'x-user-uid': authManager.currentUser.uid
                },
                body: JSON.stringify(data)
            });
        } catch (err) {
            console.warn("Cloud sync save notice:", err.message);
        }
    }
}
