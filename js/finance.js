// js/finance.js
import { showToast } from './toast.js';
import { showConfirmModal, showFormModal } from './modal.js';

export class FinanceManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.currentPersonFilter = 'All'; // 'All' or specific person
        this.currentEntryType = 'expense'; // 'expense', 'income', or 'loan'
    }

    init() {
        this.injectStyles();
        this.render();
    }

    getTransactions() {
        let txns = this.storage.get('transactions') || [];
        return txns.map(t => ({ ...t, person: t.person || 'Main' }));
    }

    getLoans() {
        let loans = this.storage.get('loans') || [];
        return loans.map(l => ({ ...l, person: l.person || 'Main' }));
    }

    saveTransactions(txns) {
        this.storage.set('transactions', txns);
    }

    saveLoans(loans) {
        this.storage.set('loans', loans);
    }

    getPersons() {
        const txns = this.getTransactions();
        const loans = this.getLoans();
        const persons = new Set([...txns.map(t => t.person), ...loans.map(l => l.person)]);
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
            .fin-container { display: grid; grid-template-columns: 240px 1fr; gap: var(--spacing-6); height: 100%; align-items: start; }
            .fin-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-4); }
            .fin-sidebar h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: var(--spacing-3); font-weight: 600; }
            .fin-person-btn { display: flex; align-items: center; gap: var(--spacing-3); width: 100%; padding: var(--spacing-2) var(--spacing-3); background: none; border: none; text-align: left; color: var(--text-secondary); border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-fast); margin-bottom: var(--spacing-1); font-size: 0.95rem; font-weight: 500; }
            .fin-person-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .fin-person-btn.active { background: var(--accent-light); color: var(--accent-color); font-weight: 600; }
            .fin-person-btn i { width: 20px; text-align: center; }
            
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
            
            .fin-add-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-3); margin-bottom: var(--spacing-3); }
            .fin-form-input { padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.9rem; font-family: var(--font-sans); width: 100%; box-sizing: border-box; }
            .fin-form-input:focus { border-color: var(--accent-color); outline: none; }
            
            .fin-type-toggle { display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-4); background: var(--bg-input); padding: 4px; border-radius: var(--radius-sm); }
            .fin-type-btn { flex: 1; padding: 10px; border: none; border-radius: var(--radius-sm); text-align: center; cursor: pointer; font-weight: 500; font-size: 0.9rem; transition: all var(--transition-fast); background: transparent; color: var(--text-secondary); }
            .fin-type-btn.active { background: var(--bg-card); color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            
            .fin-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
            .fin-badge.income { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .fin-badge.expense { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .fin-badge.loan { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            
            .loan-card { background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-3); margin-bottom: var(--spacing-3); }
            .loan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-2); }
            .loan-title { font-weight: 600; font-size: 1.1rem; color: var(--text-primary); }
            .loan-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-3); margin-top: var(--spacing-2); }
            .loan-stat { background: var(--bg-card); padding: var(--spacing-2); border-radius: var(--radius-sm); border: 1px solid var(--border-light); }
            .loan-stat span { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px; }
            .loan-stat strong { font-size: 0.95rem; color: var(--text-primary); }
            .loan-progress { height: 6px; background: var(--bg-input); border-radius: 3px; margin-top: var(--spacing-3); overflow: hidden; }
            .loan-progress-fill { height: 100%; background: var(--clr-green); border-radius: 3px; }
            
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
            .person-tag { font-size: 0.75rem; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); margin-left: 8px; font-weight: 700; border: 1px solid var(--border-color); }
            .interest-tag { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .data-table { width: 100%; min-width: 600px; border-collapse: collapse; }
            .fin-panels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); margin-bottom: var(--spacing-4); }
            
            @media (max-width: 900px) { 
                .fin-container { grid-template-columns: 1fr; }
                .fin-sidebar { display: flex; overflow-x: auto; padding: var(--spacing-3); gap: var(--spacing-2); align-items: center; white-space: nowrap; }
                .fin-sidebar h3 { margin-bottom: 0; margin-right: var(--spacing-3); }
                .fin-person-btn { width: auto; margin-bottom: 0; white-space: nowrap; }
                .loan-stats { grid-template-columns: 1fr 1fr; }
                .fin-panels-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 600px) {
                .fin-add-form { grid-template-columns: 1fr; }
                .loan-stats { grid-template-columns: 1fr; }
                .fin-kpi-grid { grid-template-columns: 1fr 1fr; }
            }
            @media (max-width: 480px) {
                .fin-kpi-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-finance');
        if (!container) return;

        const allTxns = this.getTransactions();
        const allLoans = this.getLoans();
        const persons = this.getPersons();
        
        let txns = allTxns;
        let loans = allLoans;
        
        if (this.currentPersonFilter !== 'All') {
            txns = allTxns.filter(t => t.person === this.currentPersonFilter);
            loans = allLoans.filter(l => l.person === this.currentPersonFilter);
        }

        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const balance = income - expenses;
        const totalDebt = loans.reduce((s, l) => s + l.amountLeftToPay, 0);
        const totalInterest = txns.reduce((s, t) => s + (parseFloat(t.interest) || 0), 0);

        // Categories Visualization
        const categories = {};
        const catColors = {
            'Rent': '#e53935', 'Food': '#f4511e', 'Transport': '#2383e2', 'Entertainment': '#8e24aa',
            'Bills': '#fb8c00', 'Salary': '#43a047', 'Freelance': '#00897b',
            'Shopping': '#ff7043', 'Health': '#26a69a', 'EMI': '#d32f2f', 
            'Credit Card': '#ab47bc', 'Other': '#78909c'
        };
        txns.forEach(t => {
            if (t.type === 'expense') {
                categories[t.category] = (categories[t.category] || 0) + t.amount;
            }
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
            catHTML = '<div class="fin-empty">No expenses to visualize.</div>';
        }

        // Active Loans HTML
        let loansHTML = '';
        if (loans.length === 0) {
            loansHTML = '<div class="fin-empty">No active loans.</div>';
        } else {
            loansHTML = loans.map(l => {
                const paid = l.amountSanctioned - l.amountLeftToPay;
                const pct = Math.min(100, Math.max(0, (paid / l.amountSanctioned) * 100));
                return `
                    <div class="loan-card">
                        <div class="loan-header">
                            <span class="loan-title"><i class="fa-solid fa-building-columns" style="color:var(--clr-orange); margin-right:8px;"></i>${l.title} 
                                ${l.bank ? `<span class="person-tag interest-tag"><i class="fa-solid fa-building"></i> ${l.bank}</span>` : ''}
                                ${this.currentPersonFilter === 'All' ? `<span class="person-tag"><i class="fa-solid fa-user"></i> ${l.person}</span>` : ''}
                            </span>
                            <div style="display:flex; gap:8px;">
                                <button class="fin-edit-loan btn btn-secondary" data-id="${l.id}" title="Edit Loan" style="padding:4px 8px; font-size:0.8rem; background:transparent; border-color:var(--border-light); color:var(--text-muted);"><i class="fa-solid fa-pen"></i></button>
                                <button class="fin-del-loan btn btn-secondary" data-id="${l.id}" style="padding:4px 8px; font-size:0.8rem;"><i class="fa-solid fa-check"></i> Close Loan</button>
                            </div>
                        </div>
                        <div class="loan-stats">
                            <div class="loan-stat"><span>Sanctioned</span><strong>${this.formatCurrency(l.amountSanctioned)}</strong></div>
                            <div class="loan-stat"><span>EMI / Mo</span><strong>${this.formatCurrency(l.emiPerMonth)}</strong></div>
                            <div class="loan-stat"><span>Interest Rate</span><strong>${l.interestRate}%</strong></div>
                            <div class="loan-stat"><span>Left to Pay</span><strong style="color:var(--clr-red)">${this.formatCurrency(l.amountLeftToPay)}</strong></div>
                        </div>
                        <div class="loan-progress"><div class="loan-progress-fill" style="width: ${pct}%"></div></div>
                        <div style="font-size:0.75rem; color:var(--text-muted); text-align:right; margin-top:4px;">${pct.toFixed(1)}% Repaid</div>
                    </div>
                `;
            }).join('');
        }

        // Transaction table
        const sorted = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));
        let tableHTML = '';
        if (sorted.length === 0) {
            tableHTML = '<div class="fin-empty">No transactions logged yet.</div>';
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
                                <td>
                                    <button class="fin-edit" data-id="${t.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:8px;"><i class="fa-solid fa-pen"></i></button>
                                    <button class="fin-del" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
                                </td>
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

        // Form Fields HTML (Dynamic based on entry type)
        let formHTML = '';
        const loanOptionsHTML = loans.length > 0 
            ? `<optgroup label="Active Loans">${loans.map(l => `<option value="${l.id}">${l.title}</option>`).join('')}</optgroup>`
            : '';

        if (this.currentEntryType === 'loan') {
            formHTML = `
                <input class="fin-form-input" id="fin-title" placeholder="Loan Title (e.g. Home Loan)" type="text">
                <input class="fin-form-input" id="fin-bank" placeholder="Bank Name (e.g. SBI, HDFC)" type="text">
                <input class="fin-form-input" id="fin-sanctioned" placeholder="Amount Sanctioned (₹)" type="number" min="0" step="0.01">
                <input class="fin-form-input" id="fin-paid-already" placeholder="Amount Already Paid (₹) (Optional)" type="number" min="0" step="0.01">
                <input class="fin-form-input" id="fin-emi" placeholder="EMI per month (₹)" type="number" min="0" step="0.01">
                <input class="fin-form-input" id="fin-rate" placeholder="Interest Rate (%)" type="number" min="0" step="0.1">
            `;
        } else {
            formHTML = `
                <input class="fin-form-input" id="fin-title" placeholder="Title (e.g. June Salary, Rent)" type="text">
                <input class="fin-form-input" id="fin-amount" placeholder="Total Amount (₹)" type="number" min="0" step="0.01">
                
                <select class="fin-form-input" id="fin-category">
                    ${this.currentEntryType === 'income' ? `
                        <option value="Salary">💰 Salary (Per Month)</option>
                        <option value="Freelance">💻 Freelance</option>
                        <option value="Other">📦 Other Income</option>
                    ` : `
                        <option value="Rent">🏠 Rent</option>
                        <option value="EMI">💳 EMI / Loan Payment</option>
                        <option value="Credit Card">💳 Credit Card Bill</option>
                        <option value="Food">🍔 Food</option>
                        <option value="Transport">🚗 Transport</option>
                        <option value="Entertainment">🎬 Entertainment</option>
                        <option value="Bills">📄 Bills</option>
                        <option value="Shopping">🛍️ Shopping</option>
                        <option value="Health">🏥 Health</option>
                        <option value="Other">📦 Other</option>
                    `}
                </select>
                
                ${this.currentEntryType === 'expense' ? `
                    <select class="fin-form-input" id="fin-linked-loan" style="display: none;">
                        <option value="">-- Select Linked Loan (Optional) --</option>
                        ${loanOptionsHTML}
                    </select>
                    <input class="fin-form-input" id="fin-interest" placeholder="Interest Part (₹)" type="number" min="0" step="0.01" style="display: none;">
                ` : ''}
            `;
        }

        const personDatalist = persons.map(p => `<option value="${p}">`).join('');

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Finance Tracker ${this.currentPersonFilter !== 'All' ? `<span style="color: var(--accent-color); font-weight: 800;">— ${this.currentPersonFilter}</span>` : ''}</h1>
                    <p class="subtitle text-muted">Audit household salaries, loans, rent, and expenses</p>
                </div>
            </div>

            <div class="fin-container">
                <!-- Left Sidebar -->
                <div class="fin-sidebar">
                    <h3>Household Members</h3>
                    <div class="fin-people-list">
                        <button class="fin-person-btn ${this.currentPersonFilter === 'All' ? 'active' : ''}" data-person="All"><i class="fa-solid fa-users"></i> All Members</button>
                        ${persons.map(p => `
                            <button class="fin-person-btn ${this.currentPersonFilter === p ? 'active' : ''}" data-person="${p}"><i class="fa-solid fa-user"></i> ${p}</button>
                        `).join('')}
                    </div>
                </div>

                <!-- Main Content -->
                <div class="fin-main">
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
                            <div class="fin-kpi-data"><h4>${this.currentPersonFilter} Balance</h4><div class="value ${balance >= 0 ? 'positive' : 'negative'}">${balance >= 0 ? '+' : '-'}${this.formatCurrency(balance)}</div></div>
                        </div></div></div>
                        <div class="card"><div class="card-body"><div class="fin-kpi">
                            <div class="fin-kpi-icon orange"><i class="fa-solid fa-building-columns"></i></div>
                            <div class="fin-kpi-data"><h4>Total Debt / Loans</h4><div class="value warning">${this.formatCurrency(totalDebt)}</div></div>
                        </div></div></div>
                    </div>

                    <div class="fin-panels-grid">
                        <div class="card">
                            <div class="card-header"><h2><i class="fa-solid fa-plus-circle"></i> Add Entry</h2></div>
                            <div class="card-body">
                                <div class="fin-type-toggle">
                                    <button class="fin-type-btn ${this.currentEntryType === 'expense' ? 'active' : ''}" data-type="expense">Expense</button>
                                    <button class="fin-type-btn ${this.currentEntryType === 'income' ? 'active' : ''}" data-type="income">Income</button>
                                    <button class="fin-type-btn ${this.currentEntryType === 'loan' ? 'active' : ''}" data-type="loan">New Loan</button>
                                </div>
                                
                                <div class="fin-add-form">
                                    ${formHTML}
                                    
                                    <select class="fin-form-input" id="fin-person">
                                        <option value="Main">Main</option>
                                        ${persons.filter(p => p !== 'Main').map(p => `<option value="${p}" ${this.currentPersonFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
                                        <option value="_NEW_" style="font-weight: bold; color: var(--accent-color);">+ Add New Person...</option>
                                    </select>
                                    
                                    <input class="fin-form-input" id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="grid-column: 1 / -1;">
                                    <button class="btn btn-primary" id="fin-add-btn" style="grid-column: 1 / -1; justify-content: center;"><i class="fa-solid fa-check"></i> Save Entry</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header"><h2><i class="fa-solid fa-chart-pie"></i> ${this.currentPersonFilter} Expenses</h2></div>
                            <div class="card-body">${catHTML}</div>
                        </div>
                    </div>

                    ${loans.length > 0 ? `
                        <div class="card" style="margin-bottom: var(--spacing-4);">
                            <div class="card-header"><h2><i class="fa-solid fa-piggy-bank"></i> Active Loans</h2></div>
                            <div class="card-body">${loansHTML}</div>
                        </div>
                    ` : ''}

                    <div class="card">
                        <div class="card-header"><h2><i class="fa-solid fa-list"></i> Transactions Log</h2></div>
                        <div class="card-body">${tableHTML}</div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.updateFormDynamicFields();
    }

    updateFormDynamicFields() {
        if (this.currentEntryType !== 'expense') return;
        const catSelect = document.getElementById('fin-category');
        const intInput = document.getElementById('fin-interest');
        const loanSelect = document.getElementById('fin-linked-loan');
        
        if (!catSelect) return;
        
        const updateVisibility = () => {
            const val = catSelect.value;
            if (val === 'EMI' || val === 'Credit Card') {
                intInput.style.display = 'block';
                if (val === 'EMI') {
                    loanSelect.style.display = 'block';
                } else {
                    loanSelect.style.display = 'none';
                    loanSelect.value = '';
                }
            } else {
                intInput.style.display = 'none';
                loanSelect.style.display = 'none';
                intInput.value = '';
                loanSelect.value = '';
            }
        };
        
        catSelect.addEventListener('change', updateVisibility);
        updateVisibility();
    }

    bindEvents() {
        // Sidebar Person Selection
        document.querySelectorAll('.fin-person-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentPersonFilter = e.currentTarget.dataset.person;
                this.render();
            });
        });

        // Type toggle
        document.querySelectorAll('.fin-type-toggle .fin-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentEntryType = e.currentTarget.dataset.type;
                this.render(); // Re-render to show correct form fields
            });
        });
        
        // Handle Person Dropdown (+ Add New Person)
        const personSelect = document.getElementById('fin-person');
        if (personSelect) {
            personSelect.addEventListener('change', async (e) => {
                if (e.target.value === '_NEW_') {
                    const result = await showFormModal({
                        title: 'Add New Person',
                        icon: 'fa-solid fa-user-plus',
                        submitLabel: 'Add',
                        fields: [
                            { key: 'name', label: 'Person Name', type: 'text', placeholder: 'e.g. John', required: true }
                        ]
                    });
                    if (result && result.name) {
                        const opt = document.createElement('option');
                        opt.value = result.name;
                        opt.textContent = result.name;
                        personSelect.insertBefore(opt, personSelect.lastElementChild); // Insert before _NEW_
                        personSelect.value = result.name;
                    } else {
                        personSelect.value = 'Main';
                    }
                }
            });
        }

        // Auto-categorize based on title
        const titleInput = document.getElementById('fin-title');
        titleInput?.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const catSelect = document.getElementById('fin-category');
            if (!catSelect || this.currentEntryType === 'loan') return;
            
            if (this.currentEntryType === 'income') {
                if(val.includes('salary')) catSelect.value = 'Salary';
                else if(val.includes('freelance')) catSelect.value = 'Freelance';
            } else {
                if(val.includes('rent')) catSelect.value = 'Rent';
                else if(val.includes('emi') || val.includes('repay')) catSelect.value = 'EMI';
                else if(val.includes('credit card') || val.includes('cc bill')) catSelect.value = 'Credit Card';
                else if(val.includes('food') || val.includes('lunch') || val.includes('dinner')) catSelect.value = 'Food';
                catSelect.dispatchEvent(new Event('change'));
            }
        });

        // Add Entry
        document.getElementById('fin-add-btn')?.addEventListener('click', () => {
            const title = document.getElementById('fin-title').value.trim();
            const date = document.getElementById('fin-date').value || new Date().toISOString().split('T')[0];
            const person = document.getElementById('fin-person').value.trim() || 'Main';

            if (!title) {
                showToast('Please enter a title.', 'error');
                return;
            }

            if (this.currentEntryType === 'loan') {
                const bank = document.getElementById('fin-bank').value.trim();
                const sanctioned = parseFloat(document.getElementById('fin-sanctioned').value);
                const paidAlready = parseFloat(document.getElementById('fin-paid-already').value) || 0;
                const emi = parseFloat(document.getElementById('fin-emi').value) || 0;
                const rate = parseFloat(document.getElementById('fin-rate').value) || 0;

                if (!sanctioned || sanctioned <= 0) {
                    showToast('Please enter a valid sanctioned amount.', 'error');
                    return;
                }
                
                if (paidAlready > sanctioned) {
                    showToast('Amount already paid cannot exceed sanctioned amount.', 'error');
                    return;
                }

                const loans = this.storage.get('loans') || [];
                loans.push({
                    id: 'loan_' + Date.now(),
                    title,
                    person,
                    bank,
                    amountSanctioned: sanctioned,
                    amountLeftToPay: sanctioned - paidAlready,
                    emiPerMonth: emi,
                    interestRate: rate,
                    date
                });
                this.saveLoans(loans);
                showToast('New Loan Account Added!');

            } else {
                const amount = parseFloat(document.getElementById('fin-amount').value);
                const category = document.getElementById('fin-category').value;

                if (!amount || amount <= 0) {
                    showToast('Please enter a valid amount.', 'error');
                    return;
                }

                let interestAmount = 0;
                let linkedLoanId = null;

                if (this.currentEntryType === 'expense') {
                    interestAmount = parseFloat(document.getElementById('fin-interest')?.value) || 0;
                    linkedLoanId = document.getElementById('fin-linked-loan')?.value;
                }

                const txns = this.storage.get('transactions') || [];
                txns.push({
                    id: 'txn_' + Date.now(),
                    title,
                    amount,
                    interest: interestAmount,
                    category,
                    person,
                    type: this.currentEntryType,
                    linkedLoanId,
                    date
                });
                this.saveTransactions(txns);

                // Deduct from linked loan if EMI
                if (linkedLoanId && category === 'EMI') {
                    const loans = this.storage.get('loans') || [];
                    const lIdx = loans.findIndex(l => l.id === linkedLoanId);
                    if (lIdx > -1) {
                        // Deduct the principal portion (Amount - Interest) from the outstanding loan balance
                        const principalPaid = amount - interestAmount;
                        loans[lIdx].amountLeftToPay = Math.max(0, loans[lIdx].amountLeftToPay - principalPaid);
                        this.saveLoans(loans);
                    }
                }
                showToast(`${this.currentEntryType === 'income' ? 'Income' : 'Expense'} logged!`);
            }

            if (this.currentPersonFilter !== 'All' && this.currentPersonFilter !== person) {
                this.currentPersonFilter = person;
            }
            this.render();
        });

        // Delete Transaction
        document.querySelectorAll('#view-finance .fin-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Delete this transaction?', { title: 'Delete', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                
                const id = btn.dataset.id;
                const txns = this.storage.get('transactions');
                const txn = txns.find(t => t.id === id);
                
                // If it was an EMI linked to a loan, restore the principal amount
                if (txn && txn.linkedLoanId && txn.category === 'EMI') {
                    const loans = this.storage.get('loans') || [];
                    const lIdx = loans.findIndex(l => l.id === txn.linkedLoanId);
                    if (lIdx > -1) {
                        const principalPaid = txn.amount - (txn.interest || 0);
                        loans[lIdx].amountLeftToPay += principalPaid;
                        this.saveLoans(loans);
                    }
                }

                const updatedTxns = txns.filter(t => t.id !== id);
                this.saveTransactions(updatedTxns);
                showToast('Transaction deleted.');
                this.render();
            });
        });

        // Edit Transaction
        document.querySelectorAll('#view-finance .fin-edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const txns = this.storage.get('transactions');
                const txn = txns.find(t => t.id === id);
                if (!txn) return;

                const loans = this.storage.get('loans') || [];
                const loanOptions = [{ value: '', label: '-- None --' }, ...loans.map(l => ({ value: l.id, label: l.title }))];
                
                const categoryOptions = [
                    { value: 'Salary', label: '💰 Salary' },
                    { value: 'Freelance', label: '💻 Freelance' },
                    { value: 'Rent', label: '🏠 Rent' },
                    { value: 'EMI', label: '💳 EMI' },
                    { value: 'Credit Card', label: '💳 Credit Card' },
                    { value: 'Food', label: '🍔 Food' },
                    { value: 'Transport', label: '🚗 Transport' },
                    { value: 'Entertainment', label: '🎬 Entertainment' },
                    { value: 'Bills', label: '📄 Bills' },
                    { value: 'Shopping', label: '🛍️ Shopping' },
                    { value: 'Health', label: '🏥 Health' },
                    { value: 'Other', label: '📦 Other' }
                ];

                const fields = [
                    { key: 'title', label: 'Title', type: 'text', value: txn.title, required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'number', value: txn.amount, required: true },
                    { type: 'row', children: [
                        { key: 'category', label: 'Category', type: 'dropdown', value: txn.category, options: categoryOptions },
                        { key: 'date', label: 'Date', type: 'date', value: txn.date }
                    ]},
                    { key: 'person', label: 'Person', type: 'text', value: txn.person || 'Main' }
                ];

                if (txn.type === 'expense') {
                    fields.push({
                        type: 'row', children: [
                            { key: 'interest', label: 'Interest Part (₹)', type: 'number', value: txn.interest || 0 },
                            { key: 'linkedLoanId', label: 'Linked Loan', type: 'dropdown', value: txn.linkedLoanId || '', options: loanOptions }
                        ]
                    });
                }

                const result = await showFormModal({
                    title: 'Edit Transaction',
                    icon: 'fa-solid fa-pen',
                    submitLabel: 'Save Changes',
                    submitIcon: 'fa-solid fa-check',
                    fields
                });

                if (!result) return;

                // Handle EMI loan adjustment if linked loan changed or amount changed
                if (txn.category === 'EMI' && txn.linkedLoanId) {
                    const lIdx = loans.findIndex(l => l.id === txn.linkedLoanId);
                    if (lIdx > -1) {
                        const oldPrincipalPaid = txn.amount - (txn.interest || 0);
                        loans[lIdx].amountLeftToPay += oldPrincipalPaid; // Revert old payment
                    }
                }

                txn.title = result.title;
                txn.amount = parseFloat(result.amount);
                txn.category = result.category;
                txn.date = result.date;
                txn.person = result.person || 'Main';
                if (txn.type === 'expense') {
                    txn.interest = parseFloat(result.interest) || 0;
                    txn.linkedLoanId = result.linkedLoanId || null;
                    
                    if (txn.category === 'EMI' && txn.linkedLoanId) {
                        const lIdx = loans.findIndex(l => l.id === txn.linkedLoanId);
                        if (lIdx > -1) {
                            const newPrincipalPaid = txn.amount - txn.interest;
                            loans[lIdx].amountLeftToPay = Math.max(0, loans[lIdx].amountLeftToPay - newPrincipalPaid);
                        }
                    }
                }
                
                this.saveLoans(loans);
                this.saveTransactions(txns);
                showToast('Transaction updated.');
                this.render();
            });
        });

        // Edit Loan
        document.querySelectorAll('#view-finance .fin-edit-loan').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const loans = this.storage.get('loans') || [];
                const loan = loans.find(l => l.id === id);
                if (!loan) return;

                const fields = [
                    { type: 'row', children: [
                        { key: 'title', label: 'Loan Title', type: 'text', value: loan.title, required: true },
                        { key: 'bank', label: 'Bank Name', type: 'text', value: loan.bank || '' }
                    ]},
                    { key: 'person', label: 'Person', type: 'text', value: loan.person },
                    { type: 'row', children: [
                        { key: 'amountSanctioned', label: 'Sanctioned Amount (₹)', type: 'number', value: loan.amountSanctioned, required: true },
                        { key: 'amountLeftToPay', label: 'Left to Pay (₹)', type: 'number', value: loan.amountLeftToPay, required: true }
                    ]},
                    { type: 'row', children: [
                        { key: 'emiPerMonth', label: 'EMI per month (₹)', type: 'number', value: loan.emiPerMonth },
                        { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', value: loan.interestRate }
                    ]}
                ];

                const result = await showFormModal({
                    title: 'Edit Loan',
                    icon: 'fa-solid fa-building-columns',
                    submitLabel: 'Save Changes',
                    submitIcon: 'fa-solid fa-check',
                    fields
                });

                if (!result) return;

                loan.title = result.title;
                loan.bank = result.bank || '';
                loan.person = result.person || 'Main';
                loan.amountSanctioned = parseFloat(result.amountSanctioned);
                loan.amountLeftToPay = parseFloat(result.amountLeftToPay);
                loan.emiPerMonth = parseFloat(result.emiPerMonth) || 0;
                loan.interestRate = parseFloat(result.interestRate) || 0;

                this.saveLoans(loans);
                showToast('Loan updated.');
                this.render();
            });
        });

        // Delete/Close Loan
        document.querySelectorAll('#view-finance .fin-del-loan').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirmModal('Close this loan account? (Linked transactions will be kept)', { title: 'Close Loan', confirmLabel: 'Close Loan', danger: true });
                if (!ok) return;
                
                const id = btn.dataset.id;
                const loans = this.storage.get('loans').filter(l => l.id !== id);
                this.saveLoans(loans);
                showToast('Loan account closed.');
                this.render();
            });
        });
    }
}
