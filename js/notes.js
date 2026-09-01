// js/notes.js
import { showToast } from './toast.js';
import { showConfirmModal, showFormModal } from './modal.js';

export class NotesManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.activeNoteId = null;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getNotes() {
        return this.storage.get('notes') || [];
    }

    saveNotes(notes) {
        this.storage.set('notes', notes);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'notes-styles';
        style.textContent = `
            .notes-layout { display: grid; grid-template-columns: 320px 1fr; gap: 0; height: calc(100vh - var(--topbar-height) - 140px); min-height: 520px; }
            .notes-list-panel { border-right: 1px solid var(--border-color); overflow-y: auto; display: flex; flex-direction: column; }
            .notes-list-header { padding: var(--spacing-3); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; }
            .notes-list-header h3 { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
            .notes-search { width: 100%; padding: 10px 14px; border: none; border-bottom: 1px solid var(--border-light); background: transparent; font-size: 0.85rem; color: var(--text-primary); }
            .notes-search:focus { outline: none; border-bottom-color: var(--accent-color); }
            .notes-list { list-style: none; padding: 0; margin: 0; flex: 1; overflow-y: auto; }
            .notes-list-item { padding: var(--spacing-3); cursor: pointer; border-bottom: 1px solid var(--border-light); transition: background var(--transition-fast); position: relative; }
            .notes-list-item:hover { background: var(--bg-hover); }
            .notes-list-item.active { background: var(--accent-light); border-left: 3px solid var(--accent-color); }
            .notes-list-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px; }
            .notes-list-item h4 { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
            .notes-item-actions { display: flex; align-items: center; gap: 4px; opacity: 0.8; transition: opacity var(--transition-fast); }
            .notes-list-item:hover .notes-item-actions { opacity: 1; }
            .notes-item-btn { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); font-size: 0.75rem; transition: all var(--transition-fast); }
            .notes-item-btn:hover { background: var(--accent-color); color: var(--accent-text, #fff); border-color: var(--accent-color); }
            .notes-item-btn.btn-del:hover { background: var(--clr-red); color: white; border-color: var(--clr-red); }
            .notes-list-item p { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0 0; }
            .notes-list-item .note-date { font-size: 0.7rem; color: var(--text-muted); margin-top: 6px; }
            .notes-editor-panel { display: flex; flex-direction: column; overflow: hidden; }
            .notes-editor-toolbar { display: flex; align-items: center; gap: var(--spacing-2); padding: var(--spacing-2) var(--spacing-3); border-bottom: 1px solid var(--border-light); flex-wrap: wrap; background: var(--bg-card); }
            .notes-tool-btn { width: 32px; height: 32px; border: none; border-radius: var(--radius-sm); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all var(--transition-fast); font-size: 0.85rem; }
            .notes-tool-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .notes-tool-btn.active { background: var(--accent-light); color: var(--accent-color); }
            .notes-tool-sep { width: 1px; height: 24px; background: var(--border-light); margin: 0 4px; }
            .notes-title-input { width: 100%; padding: var(--spacing-3); border: none; background: transparent; font-size: 1.4rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-sans); }
            .notes-title-input:focus { outline: none; }
            .notes-content-area { flex: 1; padding: 0 var(--spacing-3) var(--spacing-3); overflow-y: auto; min-height: 220px; outline: none; font-size: 0.95rem; line-height: 1.7; color: var(--text-primary); }
            .notes-content-area:empty::before { content: 'Start writing your note here...'; color: var(--text-muted); }
            .notes-empty-editor { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: var(--spacing-3); }
            .notes-empty-editor i { font-size: 3.5rem; opacity: 0.3; }
            .notes-footer { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-2) var(--spacing-3); border-top: 1px solid var(--border-light); font-size: 0.8rem; color: var(--text-muted); background: var(--bg-card); }
            .notes-del-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem; transition: color var(--transition-fast); display: flex; align-items: center; gap: 6px; }
            .notes-del-btn:hover { color: var(--clr-red); }
            @media (max-width: 768px) { .notes-layout { grid-template-columns: 1fr; } .notes-list-panel { max-height: 240px; } }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-notes');
        if (!container) return;

        const notes = this.getNotes();

        // Auto-select first note if none selected
        if (!this.activeNoteId && notes.length > 0) {
            this.activeNoteId = notes[0].id;
        }

        const activeNote = notes.find(n => n.id === this.activeNoteId);

        // Render Sidebar Notes list
        const listHTML = notes.length === 0
            ? '<li style="padding:var(--spacing-4);text-align:center;color:var(--text-muted);font-size:0.85rem;">No notes available. Click "New Note" above to create one.</li>'
            : notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(n => {
                const preview = (n.content || '').replace(/<[^>]*>/g, '').substring(0, 60) || 'Empty note';
                const date = new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <li class="notes-list-item ${n.id === this.activeNoteId ? 'active' : ''}" data-id="${n.id}">
                        <div class="notes-list-item-header">
                            <h4>${n.title || 'Untitled Note'}</h4>
                            <div class="notes-item-actions">
                                <button class="notes-item-btn note-edit-item-btn" data-id="${n.id}" title="Edit Note Modal">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="notes-item-btn btn-del note-delete-item-btn" data-id="${n.id}" title="Delete Note">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <p>${preview}</p>
                        <div class="note-date">${date}</div>
                    </li>
                `;
            }).join('');

        // Render Rich Text Editor Panel
        let editorHTML = '';
        if (activeNote) {
            editorHTML = `
                <div class="notes-editor-toolbar">
                    <button class="notes-tool-btn" data-cmd="bold" title="Bold"><i class="fa-solid fa-bold"></i></button>
                    <button class="notes-tool-btn" data-cmd="italic" title="Italic"><i class="fa-solid fa-italic"></i></button>
                    <button class="notes-tool-btn" data-cmd="underline" title="Underline"><i class="fa-solid fa-underline"></i></button>
                    <button class="notes-tool-btn" data-cmd="strikeThrough" title="Strikethrough"><i class="fa-solid fa-strikethrough"></i></button>
                    <div class="notes-tool-sep"></div>
                    <button class="notes-tool-btn" data-cmd="insertUnorderedList" title="Bullet List"><i class="fa-solid fa-list-ul"></i></button>
                    <button class="notes-tool-btn" data-cmd="insertOrderedList" title="Numbered List"><i class="fa-solid fa-list-ol"></i></button>
                    <div class="notes-tool-sep"></div>
                    <button class="notes-tool-btn" data-cmd="formatBlock" data-value="H2" title="Heading"><i class="fa-solid fa-heading"></i></button>
                    <button class="notes-tool-btn" data-cmd="formatBlock" data-value="BLOCKQUOTE" title="Quote"><i class="fa-solid fa-quote-left"></i></button>
                    <button class="notes-tool-btn" data-cmd="removeFormat" title="Clear Format"><i class="fa-solid fa-eraser"></i></button>
                    <div style="margin-left:auto; display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm" id="note-header-edit-btn" style="font-size:0.8rem; padding:4px 10px; gap:6px;">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Note
                        </button>
                    </div>
                </div>
                <input class="notes-title-input" id="note-title" value="${activeNote.title || ''}" placeholder="Note title...">
                <div class="notes-content-area" id="note-content" contenteditable="true">${activeNote.content || ''}</div>
                <div class="notes-footer">
                    <span><i class="fa-regular fa-clock"></i> Last saved: ${new Date(activeNote.updatedAt).toLocaleString()}</span>
                    <button class="notes-del-btn" id="note-delete-btn"><i class="fa-solid fa-trash"></i> Delete Note</button>
                </div>
            `;
        } else {
            editorHTML = `
                <div class="notes-empty-editor">
                    <i class="fa-regular fa-note-sticky"></i>
                    <p style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">Select or Create a Note</p>
                    <p style="font-size:0.85rem;">Click "+ New Note" above to start writing.</p>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-regular fa-note-sticky" style="color:var(--accent-color); margin-right:8px;"></i>Notes & Ideas</h1>
                    <p class="subtitle text-muted">Rich text editor with real-time MongoDB synchronization</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-note-btn"><i class="fa-solid fa-plus"></i> New Note</button>
                </div>
            </div>
            <div class="card notes-layout">
                <div class="notes-list-panel">
                    <div class="notes-list-header">
                        <h3><i class="fa-regular fa-note-sticky"></i> All Notes (${notes.length})</h3>
                    </div>
                    <input class="notes-search" id="notes-search" placeholder="Search notes...">
                    <ul class="notes-list" id="notes-list-ul">${listHTML}</ul>
                </div>
                <div class="notes-editor-panel">${editorHTML}</div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Create New Note
        document.getElementById('new-note-btn')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'Create New Note',
                icon: 'fa-solid fa-plus-circle',
                submitLabel: 'Create Note',
                fields: [
                    { key: 'title', label: 'Note Title', type: 'text', placeholder: 'e.g. Q3 Architecture Notes', required: true },
                    { key: 'content', label: 'Initial Content', type: 'textarea', placeholder: 'Write details here...', rows: 4 }
                ]
            });

            if (!result || !result.title) return;

            const notes = this.getNotes();
            const newNote = {
                id: 'note_' + Date.now(),
                title: result.title,
                content: result.content ? `<p>${result.content.replace(/\n/g, '<br>')}</p>` : '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            notes.unshift(newNote);
            this.saveNotes(notes);
            this.activeNoteId = newNote.id;
            showToast('New note created successfully!', 'success');
            this.render();
        });

        // Select note on item click
        document.querySelectorAll('#view-notes .notes-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore if clicked on edit or delete action buttons
                if (e.target.closest('.notes-item-btn')) return;

                this.saveCurrentNote();
                this.activeNoteId = item.dataset.id;
                this.render();
            });
        });

        // Edit Note Modal Handler from Sidebar Item List
        document.querySelectorAll('#view-notes .note-edit-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteId = btn.dataset.id;
                await this.openEditNoteModal(noteId);
            });
        });

        // Delete Note Handler from Sidebar Item List
        document.querySelectorAll('#view-notes .note-delete-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteId = btn.dataset.id;
                await this.deleteNoteById(noteId);
            });
        });

        // Edit Note Button from Header Toolbar
        document.getElementById('note-header-edit-btn')?.addEventListener('click', async () => {
            if (this.activeNoteId) {
                await this.openEditNoteModal(this.activeNoteId);
            }
        });

        // Toolbar formatting commands
        document.querySelectorAll('#view-notes .notes-tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                const value = btn.dataset.value || null;
                document.execCommand(cmd, false, value);
                document.getElementById('note-content')?.focus();
                this.saveCurrentNote();
            });
        });

        // Auto-save on title input
        document.getElementById('note-title')?.addEventListener('input', () => {
            this.saveCurrentNote();
        });

        // Auto-save on content input
        document.getElementById('note-content')?.addEventListener('input', () => {
            this.saveCurrentNote();
        });

        // Footer Delete Button
        document.getElementById('note-delete-btn')?.addEventListener('click', async () => {
            if (this.activeNoteId) {
                await this.deleteNoteById(this.activeNoteId);
            }
        });

        // Real-time Search filter
        document.getElementById('notes-search')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const listItems = document.querySelectorAll('#view-notes .notes-list-item');
            listItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(q) ? '' : 'none';
            });
        });
    }

    async openEditNoteModal(noteId) {
        const notes = this.getNotes();
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        // Strip HTML tags for text form editing
        const rawContent = (note.content || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');

        const result = await showFormModal({
            title: 'Edit Note Details',
            icon: 'fa-solid fa-pen-to-square',
            submitLabel: 'Save Changes',
            fields: [
                { key: 'title', label: 'Note Title', type: 'text', value: note.title || '', required: true },
                { key: 'content', label: 'Note Content', type: 'textarea', value: rawContent, rows: 6 }
            ]
        });

        if (!result || !result.title) return;

        note.title = result.title;
        if (result.content !== undefined) {
            note.content = `<p>${result.content.replace(/\n/g, '<br>')}</p>`;
        }
        note.updatedAt = new Date().toISOString();

        this.saveNotes(notes);
        this.activeNoteId = noteId;
        showToast('Note updated successfully!', 'success');
        this.render();
    }

    async deleteNoteById(noteId) {
        const notes = this.getNotes();
        const note = notes.find(n => n.id === noteId);
        const title = note ? note.title : 'this note';

        const ok = await showConfirmModal(`Are you sure you want to delete "${title}" permanently?`, {
            title: 'Delete Note',
            confirmLabel: 'Delete Note',
            danger: true
        });

        if (!ok) return;

        const updatedNotes = notes.filter(n => n.id !== noteId);
        this.saveNotes(updatedNotes);

        if (this.activeNoteId === noteId) {
            this.activeNoteId = updatedNotes.length > 0 ? updatedNotes[0].id : null;
        }

        showToast('Note deleted.', 'info');
        this.render();
    }

    saveCurrentNote() {
        if (!this.activeNoteId) return;
        const notes = this.getNotes();
        const note = notes.find(n => n.id === this.activeNoteId);
        if (!note) return;

        const titleEl = document.getElementById('note-title');
        const contentEl = document.getElementById('note-content');

        if (titleEl) note.title = titleEl.value;
        if (contentEl) note.content = contentEl.innerHTML;
        note.updatedAt = new Date().toISOString();

        this.saveNotes(notes);

        // Update list item preview in DOM
        const listItem = document.querySelector(`#view-notes .notes-list-item[data-id="${this.activeNoteId}"]`);
        if (listItem) {
            const h4 = listItem.querySelector('h4');
            if (h4) h4.textContent = note.title || 'Untitled Note';
            const p = listItem.querySelector('p');
            if (p) p.textContent = (note.content || '').replace(/<[^>]*>/g, '').substring(0, 60) || 'Empty note';
        }
    }
}
