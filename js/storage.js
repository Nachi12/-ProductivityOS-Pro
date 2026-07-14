// js/storage.js
export class StorageManager {
    constructor() {
        this.NAMESPACE = 'prodos_data_v1';
        this.initializeDB();
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
                projects: []
            };
            localStorage.setItem(this.NAMESPACE, JSON.stringify(defaultState));
        }
    }

    getAllData() {
        return JSON.parse(localStorage.getItem(this.NAMESPACE));
    }

    saveAllData(data) {
        localStorage.setItem(this.NAMESPACE, JSON.stringify(data));
    }

    get(collection) {
        const data = this.getAllData();
        return data[collection] || null;
    }

    set(collection, value) {
        const data = this.getAllData();
        data[collection] = value;
        this.saveAllData(data);
    }
    
    // Exports all data as a Blob URL
    exportBackup() {
        const data = JSON.stringify(this.getAllData(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }

    // Imports from JSON string
    importBackup(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if(data && data.settings && data.tasks) {
                this.saveAllData(data);
                return true;
            }
            return false;
        } catch(e) {
            return false;
        }
    }

    reset() {
        localStorage.removeItem(this.NAMESPACE);
        this.initializeDB();
    }
}
