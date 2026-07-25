// js/storage.js
import { authManager } from './auth.js';
import { showToast } from './toast.js';

export class StorageManager {
    constructor() {
        this.NAMESPACE = 'prodos_data_v1';
        this.syncTimeout = null;
        this.backendUrl = 'http://localhost:3000/api/sync';
        this.initializeDB();
        
        // Listen for auth state changes to trigger fetch
        authManager.onLoginCallback = () => this.fetchCloudData();
    }

    initializeDB() {
        if (!localStorage.getItem(this.NAMESPACE)) {
            const defaultState = {
                settings: { theme: 'system', accentColor: 'blue' },
                tasks: [
                    { id: 't1', title: 'Plan Q3 Roadmap', priority: 'High', project: 'Business', completed: false, date: new Date().toISOString() },
                    { id: 't2', title: 'Review UI Designs', priority: 'Medium', project: 'ProductivityOS', completed: false, date: new Date().toISOString() }
                ],
                brainDump: '',
                habits: [],
                projects: [],
                transactions: [],
                loans: []
            };
            localStorage.setItem(this.NAMESPACE, JSON.stringify(defaultState));
        }
    }

    get(key) {
        const data = localStorage.getItem(this.NAMESPACE);
        if (!data) return null;
        const parsed = JSON.parse(data);
        return key ? parsed[key] : parsed;
    }

    set(key, value) {
        const data = this.get() || {};
        data[key] = value;
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(this.NAMESPACE, JSON.stringify(data));
        this.queueSync();
    }
    
    // New Sync Functionality
    async fetchCloudData() {
        if (!authManager || !authManager.currentUser) return;
        try {
            const res = await fetch(this.backendUrl, {
                headers: {
                    'Authorization': 'Bearer ' + authManager.token,
                    'x-user-uid': authManager.currentUser.uid
                }
            });
            const result = await res.json();
            if (result.success && result.data && Object.keys(result.data).length > 0) {
                const cloudData = result.data;
                const localData = this.get() || {};
                
                const cloudTime = new Date(cloudData.lastUpdated || 0).getTime();
                const localTime = new Date(localData.lastUpdated || 0).getTime();

                if (cloudTime > localTime) {
                    localStorage.setItem(this.NAMESPACE, JSON.stringify(cloudData));
                    console.log("Cloud sync complete. Reloading UI...");
                    showToast("Data synced from cloud!");
                    setTimeout(() => location.reload(), 1000);
                } else if (localTime > cloudTime) {
                    console.log("Local data is newer. Pushing to cloud.");
                    this.queueSync(0);
                } else {
                    console.log("Cloud data matches local data. No reload needed.");
                }
            } else if (result.success && (!result.data || Object.keys(result.data).length === 0)) {
                // First login: upload local data to cloud
                this.queueSync(0); 
            }
        } catch (err) {
            console.error("Cloud sync failed:", err);
            // Non-blocking, continue using local data
        }
    }

    queueSync(delay = 2000) {
        if (!authManager || !authManager.currentUser) return;
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        
        // Debounce sync
        this.syncTimeout = setTimeout(async () => {
            try {
                const syncData = this.get();
                await fetch(this.backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authManager.token,
                        'x-user-uid': authManager.currentUser.uid
                    },
                    body: JSON.stringify(syncData)
                });
                console.log("Local changes pushed to cloud.");
            } catch (err) {
                console.error("Cloud push failed:", err);
            }
        }, delay);
    }
}
