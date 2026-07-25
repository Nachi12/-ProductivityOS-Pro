// js/finance.js
import { showToast } from './toast.js';
import { showConfirmModal } from './modal.js';

export class FinanceManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.currentPersonFilter = 'All'; // 'All' or specific person
        this.currentType = 'expense';
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getTransactions() {
        let txns = this.storage.get('transactions') || [];
        // Legacy migration: ensure all txns have a person
        return txns.map(t => ({ ...t, person: t.person || 'Main' }));
    }

    saveTransactions(txns) {
        this.storage.set('transactions', txns);
    }

    getPersons() {
        const txns = this.getTransactions();
        const persons = new Set(txns.map(t => t.person));
        if (persons.size === 0) persons.add('Main');
        return Array.from(persons).sort();
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
            .fin-kpi-icon.orange { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .fin-kpi-data h4 { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px; }
            .fin-kpi-data .value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
            .fin-kpi-data .value.positive { color: var(--clr-green); }
            .fin-kpi-data .value.negative { color: var(--clr-red); }
            .fin-kpi-data .value.warning { color: var(--clr-orange); }
            .fin-layout { display: grid; grid-template-columns: 1fr 360px; gap: var(--spacing-4); }
            .fin-add-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-3); margin-bottom: var(--spacing-3); }
            .fin-form-input { padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.9rem; font-family: var(--font-sans); width: 100%; box-sizing: border-box; }
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
            .person-tag { font-size: 0.7rem; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-muted); margin-left: 8px; font-weight: 500; }
            .interest-tag { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            @media (max-width: 768px) { .fin-layout { grid-template-columns: 1fr; } .fin-add-form { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-finance');
        if (!container) return;

        const allTxns = this.getTransactions();
        
        // Filter by selected person if not 'All'
        let txns = allTxns;
        if (this.currentPersonFilter !== 'All') {
            txns = allTxns.filter(t => t.person === this.currentPersonFilter);
        }

        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const balance = income - expenses;
        const totalInterest = txns.reduce((s, t) => s + (parseFloat(t.interest) || 0), 0);

        // Breakdown logic (Split by Income and Expense to see Salary vs EMI vs Food)
        const categories = {};
        const catColors = {
            'Food': '#f4511e', 'Transport': '#2383e2', 'Entertainment': '#8e24aa',
            'Bills': '#e53935', 'Salary': '#43a047', 'Freelance': '#00897b',
            'Shopping': '#ff7043', 'Health': '#26a69a', 'Loan': '#fbc02d', 
            'EMI': '#d32f2f', 'Credit Card': '#ab47bc', 'Other': '#78909c'
        };
        txns.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + (t.type === 'expense' ? t.amount : 0); // show expense breakdown mainly
        });
        
        let catHTML = '';
        if (expenses > 0) {
            catHTML = Object.entries(categories)
                .filter(([cat, val]) => val > 0)
                .sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
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
            const renderRows = (groupTxns, title) => {
                if (groupTxns.length === 0) return '';
                return `
                    <tbody>
                        <tr><td colspan="6" style="background: rgba(255,255,255,0.03); font-weight: 600; padding: 10px 16px; color: var(--text-primary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">${title}</td></tr>
                        ${groupTxns.map(t => `
                            <tr>
                                <td><span class="fin-badge ${t.type}">${t.type === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
                                <td>
                                    ${t.title} 
                                    ${this.currentPersonFilter === 'All' ? `<span class="person-tag"><i class="fa-solid fa-user"></i> ${t.person}</span>` : ''}
                                    ${t.interest > 0 ? `<span class="person-tag interest-tag">Includes ${this.formatCurrency(t.interest)} Interest</span>` : ''}
                                </td>
                                <td>${t.category}</td>
                                <td class="fin-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${this.formatCurrency(t.amount)}</td>
                                <td>${new Date(t.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                                <td><button class="fin-del" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;
            };

            const incomes = sorted.filter(t => t.type === 'income');
            const loans = sorted.filter(t => t.type === 'expense' && (t.category === 'EMI' || t.category === 'Credit Card' || (t.title && t.title.toLowerCase().includes('loan'))));
            const others = sorted.filter(t => t.type === 'expense' && !(t.category === 'EMI' || t.category === 'Credit Card' || (t.title && t.title.toLowerCase().includes('loan'))));

            tableHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Type</th><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th></th>
                        </tr></thead>
                        ${renderRows(incomes, 'Income')}
                        ${renderRows(loans, 'Expenses: Loans & Cards')}
                        ${renderRows(others, 'Expenses: Other')}
                    </table>
                </div>
            `;
        }

        const persons = this.getPersons();
        const personFilterOptions = ['All', ...persons].map(p => 
            `<option value="${p}" ${p === this.currentPersonFilter ? 'selected' : ''}>${p}</option>`
        ).join('');
        
        const datalistOptions = persons.map(p => `<option value="${p}">`).join('');

        container.innerHTML = `
            <div class="view-header" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Finance Tracker</h1>
                    <p class="subtitle text-muted">Audit household salaries, EMIs, expenses and interest</p>
                </div>
                <div class="header-actions">
                    <select id="fin-person-filter" class="fin-form-input" style="width: auto; min-width: 150px;">
                        ${personFilterOptions}
                    </select>
                </div>
            </div>

            <div class="fin-kpi-grid">
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                    <div class="fin-kpi-data"><h4>${this.currentPersonFilter} Income</h4><div class="value positive">${this.formatCurrency(income)}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                    <div class="fin-kpi-data"><h4>${this.currentPersonFilter} Expenses</h4><div class="value negative">${this.formatCurrency(expenses)}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon blue"><i class="fa-solid fa-wallet"></i></div>
                    <div class="fin-kpi-data"><h4>${this.currentPersonFilter} Net Balance</h4><div class="value ${balance >= 0 ? 'positive' : 'negative'}">${balance >= 0 ? '+' : '-'}${this.formatCurrency(balance)}</div></div>
                </div></div></div>
                <div class="card"><div class="card-body"><div class="fin-kpi">
                    <div class="fin-kpi-icon orange"><i class="fa-solid fa-percent"></i></div>
                    <div class="fin-kpi-data"><h4>Loan Interest Paid</h4><div class="value warning">${this.formatCurrency(totalInterest)}</div></div>
                </div></div></div>
            </div>

            <div class="fin-layout">
                <div>
                    <div class="card" style="margin-bottom: var(--spacing-4);">
                        <div class="card-header"><h2><i class="fa-solid fa-plus-circle"></i> Add Transaction</h2></div>
                        <div class="card-body">
                            <div class="fin-type-toggle" style="margin-bottom: var(--spacing-3);">
                                <div class="fin-type-btn" id="fin-type-expense" data-type="expense"><i class="fa-solid fa-minus"></i> Expense / EMI</div>
                                <div class="fin-type-btn" id="fin-type-income" data-type="income"><i class="fa-solid fa-plus"></i> Income / Salary</div>
                            </div>
                            <div class="fin-add-form">
                                <input class="fin-form-input" id="fin-title" placeholder="Title (e.g. June Salary, Car EMI)" type="text">
                                <input class="fin-form-input" id="fin-amount" placeholder="Total Amount" type="number" min="0" step="0.01">
                                
                                <select class="fin-form-input" id="fin-category">
                                    <optgroup label="Income Sources">
                                        <option value="Salary">💰 Salary</option>
                                        <option value="Freelance">💻 Freelance</option>
                                        <option value="Loan">🏦 Loan (Received)</option>
                                    </optgroup>
                                    <optgroup label="Expenses & Repayments">
                                        <option value="EMI" selected>💳 EMI / Loan Payment</option>
                                        <option value="Credit Card">💳 Credit Card Bill</option>
                                        <option value="Food">🍔 Food</option>
                                        <option value="Transport">🚗 Transport</option>
                                        <option value="Entertainment">🎬 Entertainment</option>
                                        <option value="Bills">📄 Bills</option>
                                        <option value="Shopping">🛍️ Shopping</option>
                                        <option value="Health">🏥 Health</option>
                                        <option value="Other">📦 Other</option>
                                    </optgroup>
                                </select>
                                
                                <input class="fin-form-input" id="fin-interest" placeholder="Interest Part (%)" type="number" min="0" step="0.1" style="display: none;">
                                
                                <input class="fin-form-input" id="fin-person" list="fin-persons" placeholder="Person (e.g. John)" value="${this.currentPersonFilter === 'All' ? 'Main' : this.currentPersonFilter}">
                                <datalist id="fin-persons">
                                    ${datalistOptions}
                                </datalist>
                                
                                <input class="fin-form-input" id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="grid-column: 1 / -1;">
                                <button class="btn btn-primary" id="fin-add-btn" style="grid-column: 1 / -1; justify-content: center;"><i class="fa-solid fa-plus"></i> Add Transaction</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h2><i class="fa-solid fa-list"></i> Transactions Audit Log</h2></div>
                        <div class="card-body">${tableHTML}</div>
                    </div>
                </div>
                <div class="card" style="align-self: start;">
                    <div class="card-header"><h2><i class="fa-solid fa-chart-pie"></i> ${this.currentPersonFilter} Expenses</h2></div>
                    <div class="card-body">${catHTML}</div>
                </div>
            </div>
        `;

        // Ensure correct toggle visually on render
        this.updateTypeToggle(this.currentType);
        
        // Show interest field if EMI is selected by default
        const catSelect = document.getElementById('fin-category');
        const intInput = document.getElementById('fin-interest');
        if(catSelect && intInput && catSelect.value === 'EMI') {
            intInput.style.display = 'block';
        }

        this.bindEvents();
    }

    updateTypeToggle(type) {
        this.currentType = type;
        const expBtn = document.getElementById('fin-type-expense');
        const incBtn = document.getElementById('fin-type-income');
        if (expBtn && incBtn) {
            if (type === 'expense') {
                expBtn.className = 'fin-type-btn active-expense';
                incBtn.className = 'fin-type-btn';
            } else {
                incBtn.className = 'fin-type-btn active-income';
                expBtn.className = 'fin-type-btn';
            }
        }
    }

    bindEvents() {
        // Filter change
        const filterSelect = document.getElementById('fin-person-filter');
        filterSelect?.addEventListener('change', (e) => {
            this.currentPersonFilter = e.target.value;
            this.render();
        });

        // Type toggle
        document.getElementById('fin-type-expense')?.addEventListener('click', () => this.updateTypeToggle('expense'));
        document.getElementById('fin-type-income')?.addEventListener('click', () => this.updateTypeToggle('income'));

        // Category change logic for Interest field
        const catSelect = document.getElementById('fin-category');
        const intInput = document.getElementById('fin-interest');
        catSelect?.addEventListener('change', (e) => {
            if (e.target.value === 'EMI') {
                intInput.style.display = 'block';
            } else {
                intInput.style.display = 'none';
                intInput.value = ''; // clear
            }
        });

        // Auto-categorize based on title
        const titleInput = document.getElementById('fin-title');
        titleInput?.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            if(val.includes('salary')) { catSelect.value = 'Salary'; this.updateTypeToggle('income'); }
            else if(val.includes('loan') && !val.includes('emi') && !val.includes('pay')) { catSelect.value = 'Loan'; this.updateTypeToggle('income'); }
            else if(val.includes('emi') || val.includes('repay')) { catSelect.value = 'EMI'; this.updateTypeToggle('expense'); }
            else if(val.includes('credit card') || val.includes('cc bill')) { catSelect.value = 'Credit Card'; this.updateTypeToggle('expense'); }
            else if(val.includes('freelance')) { catSelect.value = 'Freelance'; this.updateTypeToggle('income'); }
            else if(val.includes('food') || val.includes('lunch') || val.includes('dinner')) { catSelect.value = 'Food'; this.updateTypeToggle('expense'); }
            
            // manually trigger change event on select to update interest field visibility
            catSelect.dispatchEvent(new Event('change'));
        });

        // Add transaction
        document.getElementById('fin-add-btn')?.addEventListener('click', () => {
            const title = document.getElementById('fin-title').value.trim();
            const amount = parseFloat(document.getElementById('fin-amount').value);
            const category = document.getElementById('fin-category').value;
            const date = document.getElementById('fin-date').value;
            const person = document.getElementById('fin-person').value.trim() || 'Main';
            const interestPercentage = parseFloat(document.getElementById('fin-interest').value) || 0;

            if (!title || !amount || amount <= 0) {
                showToast('Please fill in title and a valid amount.', 'error');
                return;
            }
            if (interestPercentage > 100) {
                showToast('Interest percentage cannot exceed 100%.', 'error');
                return;
            }
            
            let interestAmount = 0;
            if (category === 'EMI' && interestPercentage > 0) {
                interestAmount = (amount * interestPercentage) / 100;
            }

            const txns = this.storage.get('transactions') || []; // get all
            txns.push({
                id: 'txn_' + Date.now(),
                title,
                amount,
                interest: interestAmount,
                category,
                person,
                type: this.currentType,
                date: date || new Date().toISOString().split('T')[0]
            });
            this.saveTransactions(txns);
            showToast(`${this.currentType === 'income' ? 'Income' : 'Expense'} added for ${person}!`);
            
            // Auto-switch filter to that person so they see what they just added
            if (this.currentPersonFilter !== 'All' && this.currentPersonFilter !== person) {
                this.currentPersonFilter = person;
            }

            // Re-render
            this.render();
        });

        // Delete
        document.querySelectorAll('#view-finance .fin-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this transaction?', { title: 'Delete Transaction', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                const txns = this.storage.get('transactions').filter(t => t.id !== btn.dataset.id);
                this.saveTransactions(txns);
                showToast('Transaction deleted.');
                this.render();
            });
        });
    }
}
