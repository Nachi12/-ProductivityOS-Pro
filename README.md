# ProductivityOS Pro
A complete, production-ready, enterprise-grade personal productivity web application built entirely with HTML5, CSS3, and Vanilla JavaScript (ES Modules).

## 🚀 Features
- **Zero Dependencies:** Built without React, Vue, or heavy frameworks. (Uses only Chart.js and SortableJS via CDN).
- **100% Offline Capable:** Entirely powered by browser LocalStorage. No backend, no latency, complete privacy.
- **Apple/Linear/Notion Aesthetic:** Premium UI with glassmorphism, soft shadows, pure CSS typography, and dark/light modes.
- **Full Modularity:** Codebase is split into logical ES Modules (`js/storage.js`, `js/tasks.js`, etc.) making it highly maintainable.
- **Import/Export:** Full JSON backup and restore capabilities built directly into the Settings module.

## 📁 Installation & Usage
1. Unzip the downloaded `ProductivityOS_Pro` directory.
2. Open `index.html` in any modern web browser (Chrome, Safari, Edge, Firefox).
3. Alternatively, serve it via VS Code Live Server for the best ES Module experience.

## 🏗️ Architecture
- **CSS Engine:** Utilizes CSS variables heavily (`variables.css`, `theme.css`) to allow instant dark-mode toggling and accent color adjustments.
- **JS Engine:** `main.js` acts as the bootstrapper, loading the `Router` and `StorageManager`, and initializing specific modules based on the active view.

## ⌨️ Keyboard Shortcuts
- `Cmd/Ctrl + K`: Open Global Search (placeholder logic).
