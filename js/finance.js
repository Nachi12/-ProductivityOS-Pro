// js/finance.js
import { showToast } from './toast.js';
import { showConfirmModal } from './modal.js';

export class FinanceManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getTransactions() {
        return this.storage.get('transactions') || [];
    }

    saveTransactions(txns) {
        this.storage.set('transactions', txns);
    }

    formatCurrency(amount) {
        return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'finance-styles';
        style.textContent = `
            .fin-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-4); margin-bottom: var(--spacing-4); }
            .fin-kpi { display: flex; align-items: center; gap: var(--spacing-3); }
            .fin-kpi-icon { width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
            .fin-kpi-icon.green { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .fin-kpi-icon.red { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .fin-kpi-icon.blue { background: rgba(35,131,226,0.1); color: var(--clr-blue); }
            .fin-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
            .fin-kpi-data .value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
            .fin-kpi-data .value.positive { color: var(--clr-green); }
            .fin-kpi-data .value.negative { color: var(--clr-red); }
            .fin-layout { display: grid; grid-template-columns: 1fr 340px; gap: var(--spacing-4); }
            .fin-add-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-3); margin-bottom: var(--spacing-3); }
            .fin-add-form .full-width { grid-column: 1 / -1; }
            .fin-form-input { padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.9rem; font-family: var(--font-sans); }
            .fin-form-input:focus { border-color: var(--accent-color); outline: none; }
            .fin-type-toggle { display: flex; gap: var(--spacing-2); }
            .fin-type-btn { flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); text-align: center; cursor: pointer; font-weight: 500; font-size: 0.9rem; transition: all var(--transition-fast); background: var(--bg-input); color: var(--text-secondary); }
            .fin-type-btn.active-income { background: rgba(67,160,71,0.1); border-color: var(--clr-green); color: var(--clr-green); }
            .fin-type-btn.active-expense { background: rgba(229,57,53,0.1); border-color: var(--clr-red); color: var(--clr-red); }
            .fin-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
            .fin-badge.income { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .fin-badge.expense { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .cat-bar-wrap { margin-bottom: var(--spacing-3); }
            .cat-bar-header { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; }
            .cat-bar-header .cat-name { font-weight: 500; color: var(--text-primary); }
            .cat-bar-header .cat-val { color: var(--text-muted); }
            .cat-bar { height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; }
            .cat-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
            .fin-empty { text-align: center; padding: var(--spacing-5); color: var(--text-muted); }
            .fin-del { background: none; border: none; color: var(--text-muted); cursor: pointer; transition: color var(--transition-fast); }
            .fin-del:hover { color: var(--clr-red); }
            .fin-amount.income { color: var(--clr-green); font-weight: 600; }
            .fin-amount.expense { color: var(--clr-red); font-weight: 600; }
            @media (max-width: 768px) { .fin-layout { grid-template-columns: 1fr; } .fin-add-form { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-finance');
        if (!container) return;

        const txns = this.getTransactions();
        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const balance = income - expenses;

        // Category breakdown (expenses only)
        const categories = {};
        const catColors = {
            'Food': '#f4511e', 'Transport': '#2383e2', 'Entertainment': '#8e24aa',
            'Bills': '#e53935', 'Salary': '#43a047', 'Freelance': '#00897b',
            'Shopping': '#ff7043', 'Health': '#26a69a', 'Other': '#78909c'
        };
        txns.filter(t => t.type === 'expense').forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });

        let catHTML = '';
        if (Object.keys(categories).length > 0) {
            const maxCat = Math.max(...Object.values(categories));
            catHTML = Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                const pct = Math.round((val / expenses) * 100);
                const color = catColors[cat] || '#78909c';
                return `
                    <div class="cat-bar-wrap">
                        <div class="cat-bar-header">
                            <span class="cat-name">${cat}</span>
                            <span class="cat-val">${this.formatCurrency(val)} (${pct}%)</span>
                        </div>
                        <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                    </div>
                `;
            }).join('');
        } else {
            catHTML = '<div class="fin-empty">No expenses yet</div>';
        }

        // Transaction table
        const sorted = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));
        let tableHTML = '';
        if (sorted.length === 0) {
            tableHTML = '<div class="fin-empty"><i class="fa-solid fa-receipt" style="font-size:1.5rem;margin-bottom:8px;display:block"></i>No transactions yet. Add one above!</div>';
        } else {
            tableHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Type</th><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${sorted.map(t => `
                                <tr>
                                    <td><span class="fin-badge ${t.type}">${t.type === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
                                    <td>${t.title}</td>
                                    <td>${t.category}</td>
                                    <td class="fin-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${this.formatCurrency(t.amount)}</td>
                                    <td>${new Date(t.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                                    <td><button class="fin-del" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Finance</h1>
                    <p class="subtitle text-muted">Track income, expenses & budgets</p>
                </div>
            </div>

            <div class="fin-kpi-grid">
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                    <div class="fin-kpi-data"><h4>Total Income</h4><div class="value positive">${this.formatCurrency(income)}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                    <div class="fin-kpi-data"><h4>Total Expenses</h4><div class="value negative">${this.formatCurrency(expenses)}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon blue"><i class="fa-solid fa-wallet"></i></div>
                    <div class="fin-kpi-data"><h4>Net Balance</h4><div class="value ${balance >= 0 ? 'positive' : 'negative'}">${balance >= 0 ? '+' : '-'}${this.formatCurrency(balance)}</div></div>
                </div></div></div>
            </div>

            <div class="fin-layout">
                <div>
                    <div class="card" style="margin-bottom: var(--spacing-4);">
                        <div class="card-header"><h2><i class="fa-solid fa-plus-circle"></i> Add Transaction</h2></div>
                        <div class="card-body">
                            <div class="fin-type-toggle" style="margin-bottom: var(--spacing-3);">
                                <div class="fin-type-btn active-expense" id="fin-type-expense" data-type="expense"><i class="fa-solid fa-minus"></i> Expense</div>
                                <div class="fin-type-btn" id="fin-type-income" data-type="income"><i class="fa-solid fa-plus"></i> Income</div>
                            </div>
                            <div class="fin-add-form">
                                <input class="fin-form-input" id="fin-title" placeholder="Title" type="text">
                                <input class="fin-form-input" id="fin-amount" placeholder="Amount" type="number" min="0" step="0.01">
                                <select class="fin-form-input" id="fin-category">
                                    <option value="Food">🍔 Food</option>
                                    <option value="Transport">🚗 Transport</option>
                                    <option value="Entertainment">🎬 Entertainment</option>
                                    <option value="Bills">📄 Bills</option>
                                    <option value="Shopping">🛍️ Shopping</option>
                                    <option value="Health">🏥 Health</option>
                                    <option value="Salary">💰 Salary</option>
                                    <option value="Freelance">💻 Freelance</option>
                                    <option value="Other">📦 Other</option>
                                </select>
                                <input class="fin-form-input" id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}">
                                <button class="btn btn-primary full-width" id="fin-add-btn"><i class="fa-solid fa-plus"></i> Add Transaction</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h2><i class="fa-solid fa-list"></i> Transactions</h2></div>
                        <div class="card-body">${tableHTML}</div>
                    </div>
                </div>
                <div class="card" style="align-self: start;">
                    <div class="card-header"><h2><i class="fa-solid fa-chart-pie"></i> Expense Breakdown</h2></div>
                    <div class="card-body">${catHTML}</div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Type toggle
        let currentType = 'expense';
        const expBtn = document.getElementById('fin-type-expense');
        const incBtn = document.getElementById('fin-type-income');

        const setType = (type) => {
            currentType = type;
            if (type === 'expense') {
                expBtn.className = 'fin-type-btn active-expense';
                incBtn.className = 'fin-type-btn';
            } else {
                incBtn.className = 'fin-type-btn active-income';
                expBtn.className = 'fin-type-btn';
            }
        };

        expBtn?.addEventListener('click', () => setType('expense'));
        incBtn?.addEventListener('click', () => setType('income'));

        // Add transaction
        document.getElementById('fin-add-btn')?.addEventListener('click', () => {
            const title = document.getElementById('fin-title').value.trim();
            const amount = parseFloat(document.getElementById('fin-amount').value);
            const category = document.getElementById('fin-category').value;
            const date = document.getElementById('fin-date').value;

            if (!title || !amount || amount <= 0) {
                showToast('Please fill in title and a valid amount.', 'error');
                return;
            }

            const txns = this.getTransactions();
            txns.push({
                id: 'txn_' + Date.now(),
                title,
                amount,
                category,
                type: currentType,
                date: date || new Date().toISOString().split('T')[0]
            });
            this.saveTransactions(txns);
            showToast(`${currentType === 'income' ? 'Income' : 'Expense'} added!`);
            this.render();
        });

        // Delete
        document.querySelectorAll('#view-finance .fin-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this transaction?', { title: 'Delete Transaction', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const txns = this.getTransactions().filter(t => t.id !== btn.dataset.id);
                this.saveTransactions(txns);
                showToast('Transaction deleted.');
                this.render();
            });
        });
    }
}
