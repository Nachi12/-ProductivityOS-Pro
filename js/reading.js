// js/reading.js
import { showToast } from './toast.js';

export class ReadingManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.currentFilter = 'all';
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getBooks() {
        return this.storage.get('books') || [];
    }

    saveBooks(books) {
        this.storage.set('books', books);
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'reading-styles';
        style.textContent = `
            .read-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--spacing-3); margin-bottom: var(--spacing-4); }
            .read-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .read-kpi-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
            .read-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .read-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .read-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .read-kpi-icon.purple { background: rgba(142,36,170,0.1); color: var(--clr-purple); }
            .read-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
            .read-kpi-data .value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
            .read-filters { display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-4); flex-wrap: wrap; }
            .read-filter-btn { padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
            .read-filter-btn:hover { background: var(--bg-hover); }
            .read-filter-btn.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }
            .books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--spacing-4); }
            .book-card { transition: transform var(--transition-normal), box-shadow var(--transition-normal); }
            .book-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
            .book-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-3); }
            .book-title { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
            .book-author { font-size: 0.85rem; color: var(--text-muted); }
            .book-status { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
            .book-status.to-read { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .book-status.reading { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .book-status.completed { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .book-genre { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background: var(--bg-hover); color: var(--text-muted); margin-top: 6px; }
            .book-progress { margin: var(--spacing-3) 0; }
            .book-progress-bar { height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
            .book-progress-fill { height: 100%; border-radius: 3px; background: var(--accent-color); transition: width 0.5s ease; }
            .book-progress-text { font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between; }
            .book-stars { display: flex; gap: 2px; margin: var(--spacing-2) 0; }
            .book-star { cursor: pointer; font-size: 1rem; color: var(--border-color); transition: color var(--transition-fast); }
            .book-star.filled { color: #f59e0b; }
            .book-star:hover { color: #f59e0b; }
            .book-actions { display: flex; gap: var(--spacing-2); margin-top: var(--spacing-3); border-top: 1px solid var(--border-light); padding-top: var(--spacing-3); }
            .book-act-btn { flex: 1; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: all var(--transition-fast); background: var(--bg-input); color: var(--text-secondary); text-align: center; }
            .book-act-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .book-act-btn.danger:hover { background: rgba(229,57,53,0.1); color: var(--clr-red); border-color: var(--clr-red); }
            .books-empty { text-align: center; padding: var(--spacing-6); color: var(--text-muted); }
            .books-empty i { font-size: 2.5rem; margin-bottom: var(--spacing-3); display: block; opacity: 0.5; }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-reading');
        if (!container) return;

        const books = this.getBooks();

        // KPIs
        const total = books.length;
        const reading = books.filter(b => b.status === 'reading').length;
        const completed = books.filter(b => b.status === 'completed').length;
        const totalPages = books.reduce((s, b) => s + b.currentPage, 0);

        // Filtered books
        const filtered = this.currentFilter === 'all' ? books : books.filter(b => b.status === this.currentFilter);

        // Book cards
        let cardsHTML = '';
        if (filtered.length === 0) {
            cardsHTML = `<div class="books-empty"><i class="fa-solid fa-book-open"></i><h3>${books.length === 0 ? 'No books yet' : 'No books match this filter'}</h3><p>${books.length === 0 ? 'Add your first book to start tracking' : 'Try a different filter'}</p></div>`;
        } else {
            cardsHTML = filtered.map(b => {
                const pct = b.totalPages > 0 ? Math.round((b.currentPage / b.totalPages) * 100) : 0;
                const starsHTML = [1, 2, 3, 4, 5].map(i =>
                    `<span class="book-star ${i <= b.rating ? 'filled' : ''}" data-book="${b.id}" data-rating="${i}"><i class="${i <= b.rating ? 'fa-solid' : 'fa-regular'} fa-star"></i></span>`
                ).join('');

                const statusLabel = b.status === 'to-read' ? 'To Read' : b.status === 'reading' ? 'Reading' : 'Completed';
                const progressColor = b.status === 'completed' ? 'var(--clr-green)' : 'var(--accent-color)';

                return `
                    <div class="card book-card">
                        <div class="card-body">
                            <div class="book-top">
                                <div>
                                    <div class="book-title">${b.title}</div>
                                    <div class="book-author">by ${b.author}</div>
                                    <div class="book-genre">${b.genre}</div>
                                </div>
                                <span class="book-status ${b.status}">${statusLabel}</span>
                            </div>
                            <div class="book-progress">
                                <div class="book-progress-bar"><div class="book-progress-fill" style="width:${pct}%;background:${progressColor}"></div></div>
                                <div class="book-progress-text">
                                    <span>${b.currentPage} / ${b.totalPages} pages</span>
                                    <span>${pct}%</span>
                                </div>
                            </div>
                            <div class="book-stars">${starsHTML}</div>
                            <div class="book-actions">
                                <button class="book-act-btn book-update-btn" data-id="${b.id}"><i class="fa-solid fa-pencil"></i> Progress</button>
                                <button class="book-act-btn book-status-btn" data-id="${b.id}"><i class="fa-solid fa-rotate"></i> Status</button>
                                <button class="book-act-btn danger book-delete-btn" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const filters = [
            { key: 'all', label: 'All', count: total },
            { key: 'to-read', label: 'To Read', count: books.filter(b => b.status === 'to-read').length },
            { key: 'reading', label: 'Reading', count: reading },
            { key: 'completed', label: 'Completed', count: completed }
        ];

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Reading Tracker</h1>
                    <p class="subtitle text-muted">Track your reading journey</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" id="new-book-btn"><i class="fa-solid fa-plus"></i> Add Book</button>
                </div>
            </div>

            <div class="card" style="margin-bottom: var(--spacing-4);">
                <div class="card-body">
                    <div class="read-kpi-grid">
                        <div class="read-kpi">
                            <div class="read-kpi-icon blue"><i class="fa-solid fa-book"></i></div>
                            <div class="read-kpi-data"><h4>Total Books</h4><div class="value">${total}</div></div>
                        </div>
                        <div class="read-kpi">
                            <div class="read-kpi-icon orange"><i class="fa-solid fa-book-open-reader"></i></div>
                            <div class="read-kpi-data"><h4>Reading</h4><div class="value">${reading}</div></div>
                        </div>
                        <div class="read-kpi">
                            <div class="read-kpi-icon green"><i class="fa-solid fa-check-circle"></i></div>
                            <div class="read-kpi-data"><h4>Completed</h4><div class="value">${completed}</div></div>
                        </div>
                        <div class="read-kpi">
                            <div class="read-kpi-icon purple"><i class="fa-solid fa-file-lines"></i></div>
                            <div class="read-kpi-data"><h4>Pages Read</h4><div class="value">${totalPages.toLocaleString()}</div></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="read-filters">
                ${filters.map(f => `<button class="read-filter-btn ${this.currentFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label} (${f.count})</button>`).join('')}
            </div>

            <div class="books-grid">${cardsHTML}</div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Filters
        document.querySelectorAll('#view-reading .read-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });

        // Add book
        document.getElementById('new-book-btn')?.addEventListener('click', () => {
            const title = prompt('Book title:');
            if (!title) return;
            const author = prompt('Author:') || 'Unknown';
            const totalPages = parseInt(prompt('Total pages:', '300')) || 300;
            const genre = prompt('Genre (e.g. Fiction, Self-Help, Sci-Fi):', 'General') || 'General';

            const books = this.getBooks();
            books.push({
                id: 'book_' + Date.now(),
                title,
                author,
                totalPages,
                currentPage: 0,
                status: 'to-read',
                genre,
                rating: 0,
                addedAt: new Date().toISOString().split('T')[0]
            });
            this.saveBooks(books);
            showToast('Book added to library!');
            this.render();
        });

        // Star ratings
        document.querySelectorAll('#view-reading .book-star').forEach(star => {
            star.addEventListener('click', () => {
                const bookId = star.dataset.book;
                const rating = parseInt(star.dataset.rating);
                const books = this.getBooks();
                const book = books.find(b => b.id === bookId);
                if (book) {
                    book.rating = book.rating === rating ? 0 : rating;
                    this.saveBooks(books);
                    this.render();
                }
            });
        });

        // Update progress
        document.querySelectorAll('#view-reading .book-update-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const books = this.getBooks();
                const book = books.find(b => b.id === btn.dataset.id);
                if (!book) return;
                const newPage = parseInt(prompt(`Current page (0-${book.totalPages}):`, book.currentPage));
                if (isNaN(newPage) || newPage < 0) return;
                book.currentPage = Math.min(newPage, book.totalPages);
                if (book.currentPage === book.totalPages && book.status !== 'completed') {
                    book.status = 'completed';
                    showToast('Congratulations! Book completed! 🎉');
                } else if (book.currentPage > 0 && book.status === 'to-read') {
                    book.status = 'reading';
                    showToast('Progress updated!');
                } else {
                    showToast('Progress updated!');
                }
                this.saveBooks(books);
                this.render();
            });
        });

        // Change status
        document.querySelectorAll('#view-reading .book-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const books = this.getBooks();
                const book = books.find(b => b.id === btn.dataset.id);
                if (!book) return;
                const statusChoice = prompt('Status:\n1. To Read\n2. Reading\n3. Completed', book.status === 'to-read' ? '1' : book.status === 'reading' ? '2' : '3');
                const statuses = { '1': 'to-read', '2': 'reading', '3': 'completed' };
                if (statuses[statusChoice]) {
                    book.status = statuses[statusChoice];
                    if (book.status === 'completed') book.currentPage = book.totalPages;
                    this.saveBooks(books);
                    showToast('Status updated!');
                    this.render();
                }
            });
        });

        // Delete
        document.querySelectorAll('#view-reading .book-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Remove this book?')) {
                    const books = this.getBooks().filter(b => b.id !== btn.dataset.id);
                    this.saveBooks(books);
                    showToast('Book removed.');
                    this.render();
                }
            });
        });
    }
}
