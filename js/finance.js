import { showToast } from './toast.js';
import { showConfirmModal, showFormModal } from './modal.js';
import { attachCurrencyFormatter, getRawValue } from './formatters.js';
import { BankStatementAnalyzer } from './bank-statement-analyzer.js';

export class FinanceManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        
        // Get initial global family member or default to 'All' if 'Main'
        let activeMember = sessionStorage.getItem('prodos_active_family_member') || 'All';
        if (activeMember === 'Main') activeMember = 'All';
        
        this.currentPersonFilter = activeMember;
        this.currentViewMode = 'expense'; // 'expense', 'income', 'loans', or 'analyzer'
        this.bsa = new BankStatementAnalyzer(this.storage);
    }

    init() {
        this.runDatabaseCleanupMigration();
        this.injectStyles();
        this.render();
    }

    runDatabaseCleanupMigration() {
        try {
            let txns = this.storage.get('transactions') || [];
            if (!Array.isArray(txns) || txns.length === 0) return;

            let modified = false;
            const cleanTxns = [];
            const seenFingerprints = new Set();

            txns.forEach(t => {
                const titleStr = String(t.title || t.description || '').toLowerCase().trim();

                // 1. Purge garbage PDF table headers that were incorrectly parsed
                if (
                    titleStr.includes('particulars deposits withdrawals balance') ||
                    (titleStr.includes('particulars') && titleStr.includes('deposits') && titleStr.includes('withdrawals')) ||
                    titleStr.includes('date particulars') ||
                    titleStr.includes('opening balance') ||
                    titleStr.includes('closing balance')
                ) {
                    modified = true;
                    return; // Skip/purge garbage header entry
                }

                // 2. Calculate or standardize transaction fingerprint
                const numAmt = parseFloat(t.amount) || 0;
                const personTag = (t.person === 'Main' ? '' : (t.person || '')).toLowerCase().trim();
                const typeTag = String(t.type || 'expense').toLowerCase().trim();
                const dateTag = String(t.date || '').trim();
                const refTag = String(t.reference || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                const normTitle = titleStr.replace(/[^a-z0-9]/g, '').substring(0, 30);

                const fp = t.fingerprint || `fp_${personTag}_${dateTag}_${numAmt.toFixed(2)}_${typeTag}_${normTitle}_${refTag}`;

                // 3. Deduplicate
                if (seenFingerprints.has(fp)) {
                    modified = true;
                    return; // Skip duplicate clone
                }

                seenFingerprints.add(fp);
                cleanTxns.push({
                    ...t,
                    amount: numAmt,
                    fingerprint: fp,
                    source: t.source || (t.sourceStatementId ? 'BANK_STATEMENT' : 'MANUAL')
                });
            });

            if (modified) {
                this.storage.set('transactions', cleanTxns);
            }
        } catch (err) {
            console.warn("Database cleanup migration notice:", err.message);
        }
    }

    getTransactions() {
        let txns = this.storage.get('transactions') || [];
        return txns.map(t => ({
            ...t,
            title: t.title || t.description || 'Untitled Transaction',
            person: (t.person === 'Main' ? '' : (t.person || ''))
        }));
    }

    getLoans() {
        let loans = this.storage.get('loans') || [];
        return loans.map(l => ({ ...l, person: (l.person === 'Main' ? '' : (l.person || '')) }));
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
        const customPersons = this.storage.get('custom_persons') || [];
        const deletedPersons = this.storage.get('deleted_persons') || [];
        
        let familyMembers = [];
        try {
            const familyData = JSON.parse(localStorage.getItem('prodos_family_data'));
            if (familyData && Array.isArray(familyData.members)) {
                familyMembers = familyData.members.map(m => m.name);
            }
        } catch (e) {}

        const persons = new Set([
            ...familyMembers,
            ...customPersons,
            ...txns.map(t => t.person).filter(p => p && p !== 'Main'),
            ...loans.map(l => l.person).filter(p => p && p !== 'Main')
        ]);

        const deletedLower = deletedPersons.map(d => String(d).toLowerCase().trim());

        return Array.from(persons)
            .filter(p => p && p !== 'Main' && p.trim() !== '' && !deletedLower.includes(String(p).toLowerCase().trim()))
            .sort((a, b) => a.localeCompare(b));
    }

    formatCurrency(amount) {
        return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'finance-styles';
        style.textContent = `
            .fin-container { display: grid; grid-template-columns: 240px 1fr; gap: var(--spacing-5); height: 100%; align-items: start; }
            .fin-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-4); }
            .fin-sidebar h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: var(--spacing-3); font-weight: 700; }
            .fin-person-item { display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md); margin-bottom: 4px; position: relative; transition: background 0.2s ease; }
            .fin-person-item:hover { background: var(--bg-hover); }
            .fin-person-item.active { background: var(--accent-light); }
            .fin-person-item .fin-person-btn { flex: 1; margin-bottom: 0; }
            .fin-person-actions { display: flex; gap: 2px; padding-right: 6px; opacity: 0.8; transition: opacity 0.2s ease; }
            .fin-person-item:hover .fin-person-actions { opacity: 1; }
            .fin-person-act-btn { background: transparent; border: none; color: var(--text-muted); font-size: 0.78rem; padding: 4px 6px; border-radius: 4px; cursor: pointer; transition: color 0.2s ease, background 0.2s ease; }
            .fin-person-act-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.12); }
            .fin-person-act-btn.fin-person-del:hover { color: var(--clr-red); background: rgba(229,57,53,0.18); }

            .fin-person-btn { display: flex; align-items: center; gap: var(--spacing-3); width: 100%; padding: 10px 14px; background: none; border: none; text-align: left; color: var(--text-secondary); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); margin-bottom: 4px; font-size: 0.9rem; font-weight: 500; }
            .fin-person-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
            .fin-person-btn.active { background: var(--accent-light); color: var(--accent-color); font-weight: 600; }
            .fin-person-btn i { width: 18px; text-align: center; }
            
            .fin-main { display: flex; flex-direction: column; gap: var(--spacing-4); }

            /* KPI Grid & Cards */
            .fin-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--spacing-3); }
            .fin-kpi { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
            .fin-kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .fin-kpi-header { display: flex; justify-content: space-between; align-items: center; }
            .fin-kpi-header h4 { font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
            .fin-kpi-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; }
            .fin-kpi-icon.green { background: rgba(67,160,71,0.12); color: var(--clr-green); }
            .fin-kpi-icon.red { background: rgba(229,57,53,0.12); color: var(--clr-red); }
            .fin-kpi-icon.blue { background: rgba(35,131,226,0.12); color: var(--clr-blue); }
            .fin-kpi-icon.purple { background: rgba(156,39,176,0.12); color: #ab47bc; }
            .fin-kpi-icon.orange { background: rgba(244,81,30,0.12); color: var(--clr-orange); }
            .fin-kpi-data .value { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; font-variant-numeric: tabular-nums; }
            .fin-kpi-data .value.positive { color: var(--clr-green); }
            .fin-kpi-data .value.negative { color: var(--clr-red); }
            .fin-kpi-data .value.warning { color: var(--clr-orange); }

            /* Top Section Header & Segment Toggle */
            .fin-section-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; margin-bottom: 2px; }
            .fin-section-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin: 0; }
            .fin-type-toggle { display: inline-flex; background: rgba(15, 23, 42, 0.85); padding: 5px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.15); gap: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
            .fin-type-btn { padding: 7px 22px; border-radius: 20px; border: none; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: transparent; color: #cbd5e1; }
            .fin-type-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.08); }
            .fin-type-btn.active { background: var(--accent-color); color: #000000; font-weight: 800; box-shadow: 0 2px 10px rgba(199, 255, 46, 0.4); }

            /* Panels Grid & Form Styling */
            .fin-panels-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: var(--spacing-4); align-items: start; }
            .fin-add-form { display: flex; flex-direction: column; gap: 12px; }
            .fin-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .fin-form-input { padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.88rem; font-family: var(--font-sans); width: 100%; box-sizing: border-box; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
            .fin-form-input:focus { border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(35,131,226, 0.2); outline: none; }

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
            .person-tag { font-size: 0.75rem; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); margin-left: 8px; font-weight: 700; border: 1px solid var(--border-color); display: inline-block; white-space: nowrap; margin-bottom: 2px; }
            .interest-tag { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 8px; }
            .data-table { width: 100%; min-width: 600px; border-collapse: collapse; }
            .data-table th, .data-table td { white-space: nowrap; }
            
            @media (max-width: 1200px) { 
                .fin-kpi-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 992px) { 
                .fin-container { grid-template-columns: 1fr; }
                .fin-panels-grid { grid-template-columns: 1fr; }
                .fin-sidebar { display: flex; overflow-x: auto; padding: var(--spacing-3); gap: var(--spacing-2); align-items: center; white-space: nowrap; }
                .fin-sidebar h3 { margin-bottom: 0; margin-right: var(--spacing-3); }
                .fin-person-btn { width: auto; margin-bottom: 0; white-space: nowrap; }
                .loan-stats { grid-template-columns: 1fr 1fr; }
            }
            @media (max-width: 600px) {
                .fin-kpi-grid { grid-template-columns: 1fr; }
                .fin-form-row { grid-template-columns: 1fr; }
                .fin-section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
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
        
        const personSet = new Set(persons.map(p => p.toLowerCase().trim()));
        let txns = [];
        let loans = [];

        if (this.currentPersonFilter !== 'All') {
            const targetFilter = this.currentPersonFilter.toLowerCase().trim();
            txns = allTxns.filter(t => t.person && t.person.toLowerCase().trim() === targetFilter);
            loans = allLoans.filter(l => l.person && l.person.toLowerCase().trim() === targetFilter);
        } else if (persons.length > 0) {
            // Under 'All Members', calculate ONLY items belonging to active members in the workspace
            txns = allTxns.filter(t => t.person && personSet.has(t.person.toLowerCase().trim()));
            loans = allLoans.filter(l => l.person && personSet.has(l.person.toLowerCase().trim()));
        } else {
            // When no custom members exist, calculate zero
            txns = [];
            loans = [];
        }

        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const expenses = txns.filter(t => t.type === 'expense' || !t.type).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const balance = income - expenses;
        const totalDebt = loans.reduce((s, l) => s + (parseFloat(l.amountLeftToPay) || 0), 0);
        const totalMonthlyEMI = loans.reduce((s, l) => s + (parseFloat(l.emiPerMonth) || 0), 0);
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
            if (t.type === 'expense' || !t.type) {
                categories[t.category || 'Other'] = (categories[t.category || 'Other'] || 0) + (parseFloat(t.amount) || 0);
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

        let loansHTML = '';
        if (loans.length === 0) {
            loansHTML = '<div class="fin-empty">No active loans.</div>';
        } else {
            loansHTML = loans.map(l => {
                const paid = l.amountSanctioned - l.amountLeftToPay;
                const pct = Math.min(100, Math.max(0, (paid / l.amountSanctioned) * 100));
                return `
                    <div class="loan-card card" style="margin-bottom: var(--spacing-4);">
                        <div class="loan-header">
                            <span class="loan-title"><i class="fa-solid fa-building-columns" style="color:var(--clr-orange); margin-right:8px;"></i>${l.title} 
                                ${l.bank ? `<span class="person-tag interest-tag"><i class="fa-solid fa-building"></i> ${l.bank}</span>` : ''}
                                ${this.currentPersonFilter === 'All' && l.person ? `<span class="person-tag"><i class="fa-solid fa-user"></i> ${l.person}</span>` : ''}
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
        const formatTxnDate = (dateStr) => {
            if (!dateStr) return '';
            const raw = String(dateStr).trim();
            const cleanStr = raw.includes('T') ? raw.split('T')[0] : raw;
            const d = new Date(cleanStr + 'T00:00:00');
            if (isNaN(d.getTime())) return raw;
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        };

        const sorted = [...txns].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        let tableHTML = '';
        if (sorted.length === 0) {
            tableHTML = '<div class="fin-empty">No transactions logged yet.</div>';
        } else {
            const renderRows = (groupTxns, title) => {
                if (!groupTxns || groupTxns.length === 0) return '';
                return `
                    <tbody>
                        <tr class="fin-group-header"><td colspan="6" style="background: rgba(255,255,255,0.03); font-weight: 600; padding: 10px 16px; color: var(--text-primary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">${title}</td></tr>
                        ${groupTxns.map(t => {
                            const itemTitle = t.title || t.description || 'Untitled Transaction';
                            return `
                            <tr>
                                <td data-label="Type"><span class="fin-badge ${t.type || 'expense'}">${(t.type || 'expense') === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
                                <td data-label="Title">
                                    <div style="margin-bottom: 4px; font-weight: 600; color: var(--text-primary);">${itemTitle}</div>
                                    <div>
                                        ${this.currentPersonFilter === 'All' && t.person ? `<span class="person-tag"><i class="fa-solid fa-user"></i> ${t.person}</span>` : ''}
                                        ${t.sourceStatementId || t.source === 'BANK_STATEMENT' ? `<span class="person-tag" style="background:rgba(35,131,226,0.12); color:var(--clr-blue); border:1px solid rgba(35,131,226,0.3);"><i class="fa-solid fa-file-invoice-dollar"></i> Statement</span>` : `<span class="person-tag"><i class="fa-solid fa-pen"></i> Manual</span>`}
                                        ${t.interest > 0 ? `<span class="person-tag interest-tag">Includes ${this.formatCurrency(t.interest)} Interest</span>` : ''}
                                    </div>
                                </td>
                                <td data-label="Category">${t.category || 'General'}</td>
                                <td data-label="Amount" class="fin-amount ${t.type || 'expense'}">${(t.type || 'expense') === 'income' ? '+' : '-'}${this.formatCurrency(t.amount || 0)}</td>
                                <td data-label="Date">${formatTxnDate(t.date)}</td>
                                <td data-label="Actions" style="text-align: right;">
                                    <button class="fin-edit" data-id="${t.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:8px; padding: 4px;" title="Edit Transaction"><i class="fa-solid fa-pen"></i></button>
                                    <button class="fin-del" data-id="${t.id}" style="padding: 4px;" title="Delete Transaction"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                `;
            };

            const uniquePersons = [...new Set(sorted.map(t => t.person).filter(p => p && p !== 'Main'))].sort();
            
            let tbodyHTML = '';
            
            const generalTxns = sorted.filter(t => !t.person || t.person === 'Main');
            if (generalTxns.length > 0) {
                if (uniquePersons.length > 0 && this.currentPersonFilter === 'All') {
                    tbodyHTML += `
                        <tbody>
                            <tr class="fin-person-header">
                                <td colspan="6" style="background: var(--bg-sidebar); padding: 16px 16px 8px 16px; border-bottom: 2px solid var(--border-color);">
                                    <h3 style="margin: 0; color: var(--accent-color); font-size: 1.1rem; font-weight: 700;"><i class="fa-solid fa-user"></i> Personal / General</h3>
                                </td>
                            </tr>
                        </tbody>
                    `;
                }
                const incomes = generalTxns.filter(t => t.type === 'income');
                const loans = generalTxns.filter(t => (t.type === 'expense' || !t.type) && (t.category === 'EMI' || t.category === 'Credit Card' || (t.title || t.description || '').toLowerCase().includes('loan')));
                const others = generalTxns.filter(t => (t.type === 'expense' || !t.type) && !(t.category === 'EMI' || t.category === 'Credit Card' || (t.title || t.description || '').toLowerCase().includes('loan')));

                tbodyHTML += renderRows(incomes, 'Income');
                tbodyHTML += renderRows(loans, 'Expenses: Loans & Cards');
                tbodyHTML += renderRows(others, 'Expenses: Other');
            }

            uniquePersons.forEach(person => {
                const pTxns = sorted.filter(t => t.person === person);
                if (pTxns.length === 0) return;
                
                if (this.currentPersonFilter === 'All') {
                    tbodyHTML += `
                        <tbody>
                            <tr class="fin-person-header">
                                <td colspan="6" style="background: var(--bg-sidebar); padding: 16px 16px 8px 16px; border-bottom: 2px solid var(--border-color);">
                                    <h3 style="margin: 0; color: var(--accent-color); font-size: 1.1rem; font-weight: 700;"><i class="fa-solid fa-user"></i> ${person}</h3>
                                </td>
                            </tr>
                        </tbody>
                    `;
                }

                const incomes = pTxns.filter(t => t.type === 'income');
                const loans = pTxns.filter(t => (t.type === 'expense' || !t.type) && (t.category === 'EMI' || t.category === 'Credit Card' || (t.title || t.description || '').toLowerCase().includes('loan')));
                const others = pTxns.filter(t => (t.type === 'expense' || !t.type) && !(t.category === 'EMI' || t.category === 'Credit Card' || (t.title || t.description || '').toLowerCase().includes('loan')));

                tbodyHTML += renderRows(incomes, 'Income');
                tbodyHTML += renderRows(loans, 'Expenses: Loans & Cards');
                tbodyHTML += renderRows(others, 'Expenses: Other');
            });

            if (!tbodyHTML) {
                tbodyHTML = `<tbody><tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No entries found for this selection.</td></tr></tbody>`;
            }

            tableHTML = `
                <div class="table-responsive" style="width: 100%; overflow-x: auto;">
                    <table class="data-table" style="width: 100%;">
                        <thead><tr>
                            <th>Type</th><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th style="text-align:right;">Actions</th>
                        </tr></thead>
                        ${tbodyHTML}
                    </table>
                </div>
            `;
        }
        // Form Fields HTML (Dynamic based on entry type)
        let formHTML = '';
        const loanOptionsHTML = loans.length > 0 
            ? `<optgroup label="Active Loans">${loans.map(l => `<option value="${l.id}">${l.title}</option>`).join('')}</optgroup>`
            : '';
        container.innerHTML = `
            <div class="fin-container">
                <div class="fin-sidebar">
                    <h3>Filter by Person</h3>
                    <button class="fin-person-btn ${this.currentPersonFilter === 'All' ? 'active' : ''}" data-person="All">
                        <i class="fa-solid fa-users"></i> All Members
                    </button>
                    ${persons.map(p => `
                        <div class="fin-person-item ${this.currentPersonFilter === p ? 'active' : ''}">
                            <button class="fin-person-btn ${this.currentPersonFilter === p ? 'active' : ''}" data-person="${p}">
                                <i class="fa-solid fa-user"></i> ${p}
                            </button>
                            <div class="fin-person-actions">
                                <button class="fin-person-act-btn fin-person-edit" data-person="${p}" title="Edit / Rename Person">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="fin-person-act-btn fin-person-del" data-person="${p}" title="Remove Person">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                    
                    <div style="border-top: 1px solid var(--border-color); margin-top: var(--spacing-3); padding-top: var(--spacing-2);">
                        <button class="fin-person-btn" id="fin-sidebar-add-person" style="color: var(--accent-color); font-weight: 600;">
                            <i class="fa-solid fa-user-plus"></i> + Add Person
                        </button>
                    </div>
                </div>
                
                <div class="fin-main">
                    <!-- Refined KPI Grid -->
                    <div class="fin-kpi-grid">
                        <div class="fin-kpi">
                            <div class="fin-kpi-header">
                                <h4>Total Income</h4>
                                <div class="fin-kpi-icon green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            </div>
                            <div class="fin-kpi-data"><div class="value positive">${this.formatCurrency(income)}</div></div>
                        </div>
                        <div class="fin-kpi">
                            <div class="fin-kpi-header">
                                <h4>Total Expenses</h4>
                                <div class="fin-kpi-icon red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                            </div>
                            <div class="fin-kpi-data"><div class="value negative">${this.formatCurrency(expenses)}</div></div>
                        </div>
                        <div class="fin-kpi">
                            <div class="fin-kpi-header">
                                <h4>Net Balance</h4>
                                <div class="fin-kpi-icon blue"><i class="fa-solid fa-scale-balanced"></i></div>
                            </div>
                            <div class="fin-kpi-data"><div class="value ${balance >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(balance)}</div></div>
                        </div>
                        <div class="fin-kpi">
                            <div class="fin-kpi-header">
                                <h4>Monthly EMI</h4>
                                <div class="fin-kpi-icon purple"><i class="fa-solid fa-calendar-check"></i></div>
                            </div>
                            <div class="fin-kpi-data"><div class="value negative">${this.formatCurrency(totalMonthlyEMI)}</div></div>
                        </div>
                        <div class="fin-kpi">
                            <div class="fin-kpi-header">
                                <h4>Total Debt</h4>
                                <div class="fin-kpi-icon orange"><i class="fa-solid fa-building-columns"></i></div>
                            </div>
                            <div class="fin-kpi-data"><div class="value warning">${this.formatCurrency(totalDebt)}</div></div>
                        </div>
                    </div>
                    
                    <!-- Clean Section Header with Compact Pill Segment Toggle -->
                    <div class="fin-section-header">
                        <h2 class="fin-section-title">
                            <i class="fa-solid fa-chart-line" style="color: var(--accent-color);"></i>
                            ${this.currentViewMode === 'expense' ? 'Expenses Management' : (this.currentViewMode === 'income' ? 'Income Management' : (this.currentViewMode === 'loans' ? 'Loans & Liabilities' : 'Bank Statement Analyzer'))}
                        </h2>
                        <div class="fin-type-toggle">
                            <button class="fin-type-btn ${this.currentViewMode === 'expense' ? 'active' : ''}" data-type="expense">Expenses</button>
                            <button class="fin-type-btn ${this.currentViewMode === 'income' ? 'active' : ''}" data-type="income">Income</button>
                            <button class="fin-type-btn ${this.currentViewMode === 'loans' ? 'active' : ''}" data-type="loans">Loans</button>
                            <button class="fin-type-btn ${this.currentViewMode === 'analyzer' ? 'active' : ''}" data-type="analyzer"><i class="fa-solid fa-file-invoice-dollar"></i> Statement Analyzer</button>
                        </div>
                    </div>

                    ${this.currentViewMode === 'analyzer' ? `
                        <div id="fin-statement-analyzer-container" style="width: 100%;"></div>
                    ` : `
                        <div class="fin-panels-grid">
                            ${this.currentViewMode === 'loans' ? `
                                <div class="card" style="grid-column: 1 / -1;">
                                    <div class="card-header"><h2><i class="fa-solid fa-plus-circle"></i> Add New Loan</h2></div>
                                    <div class="card-body">
                                        <div class="fin-add-form">
                                            <div class="fin-form-row">
                                                <input class="fin-form-input" id="fin-title" placeholder="Loan Title (e.g. Home Loan)" type="text">
                                                <input class="fin-form-input" id="fin-bank" placeholder="Bank Name (e.g. SBI, HDFC)" type="text">
                                            </div>
                                            <div class="fin-form-row">
                                                <input class="fin-form-input" id="fin-sanctioned" placeholder="Amount Sanctioned (₹)" type="text">
                                                <input class="fin-form-input" id="fin-paid-already" placeholder="Amount Already Paid (₹) (Optional)" type="text">
                                            </div>
                                            <div class="fin-form-row">
                                                <input class="fin-form-input" id="fin-emi" placeholder="EMI per month (₹)" type="text">
                                                <input class="fin-form-input" id="fin-rate" placeholder="Interest Rate (%)" type="number" min="0" step="0.1">
                                            </div>
                                            <div class="fin-form-row">
                                                <input class="fin-form-input" id="fin-emi-date" placeholder="EMI Due Date (1-31)" type="number" min="1" max="31">
                                                <select class="fin-form-input" id="fin-person">
                                                    <option value="">-- Personal / General --</option>
                                                    ${persons.map(p => `<option value="${p}" ${this.currentPersonFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
                                                    <option value="_NEW_" style="font-weight: bold; color: var(--accent-color);">+ Add New Person...</option>
                                                </select>
                                            </div>
                                            <button class="btn btn-primary" id="fin-add-btn" style="justify-content: center; margin-top: 4px;"><i class="fa-solid fa-check"></i> Add Loan</button>
                                        </div>
                                    </div>
                                </div>
                                <div style="grid-column: 1 / -1; margin-top: var(--spacing-2);">
                                    ${loansHTML}
                                </div>
                            ` : `
                                <div class="card">
                                    <div class="card-header"><h2><i class="fa-solid fa-plus-circle"></i> Add ${this.currentViewMode === 'expense' ? 'Expense' : 'Income'}</h2></div>
                                    <div class="card-body">
                                        <div class="fin-add-form">
                                            <input class="fin-form-input" id="fin-title" placeholder="Title (e.g. June Salary, Rent)" type="text">
                                            <div class="fin-form-row">
                                                <input class="fin-form-input" id="fin-amount" placeholder="Total Amount (₹)" type="text">
                                                <select class="fin-form-input" id="fin-category">
                                                    ${this.currentViewMode === 'income' ? `
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
                                            </div>
                                            
                                            ${this.currentViewMode === 'expense' ? `
                                                <div class="fin-form-row">
                                                    <select class="fin-form-input" id="fin-linked-loan" style="display: none;">
                                                        <option value="">-- Select Linked Loan (Optional) --</option>
                                                        ${loanOptionsHTML}
                                                    </select>
                                                    <input class="fin-form-input" id="fin-interest" placeholder="Interest Part (₹)" type="text" style="display: none;">
                                                </div>
                                            ` : ''}
                                            
                                            <div class="fin-form-row">
                                                <select class="fin-form-input" id="fin-person">
                                                    <option value="">-- Personal / General --</option>
                                                    ${persons.map(p => `<option value="${p}" ${this.currentPersonFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
                                                    <option value="_NEW_" style="font-weight: bold; color: var(--accent-color);">+ Add New Person...</option>
                                                </select>
                                                <input class="fin-form-input" id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}">
                                            </div>
                                            <button class="btn btn-primary" id="fin-add-btn" style="justify-content: center; margin-top: 4px;"><i class="fa-solid fa-check"></i> Save Entry</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="card">
                                    <div class="card-header"><h2><i class="fa-solid fa-chart-pie"></i> ${this.currentPersonFilter} Expenses</h2></div>
                                    <div class="card-body">${catHTML}</div>
                                </div>
                            `}
                        </div>

                        <div class="card" style="margin-top: var(--spacing-3);">
                            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                                <h2><i class="fa-solid fa-receipt"></i> ${this.currentPersonFilter === 'All' ? 'Transactions & Entries' : `${this.currentPersonFilter}'s Transactions`}</h2>
                            </div>
                            <div class="card-body" style="padding:0;">
                                ${tableHTML}
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;

        if (this.currentViewMode === 'analyzer') {
            this.bsa.init(document.getElementById('fin-statement-analyzer-container'), this.currentPersonFilter);
        }

        // Sidebar Person Filter Buttons
        document.querySelectorAll('.fin-person-btn[data-person]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const person = e.currentTarget.dataset.person;
                if (person) {
                    this.currentPersonFilter = person;
                    sessionStorage.setItem('prodos_active_family_member', person);
                    this.render();
                }
            });
        });

        // Edit Person Name handler
        document.querySelectorAll('.fin-person-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const person = e.currentTarget.dataset.person;
                if (!person) return;

                const result = await showFormModal({
                    title: `Rename ${person}`,
                    icon: 'fa-solid fa-user-pen',
                    submitLabel: 'Save Name',
                    fields: [
                        { key: 'name', label: 'Person / Member Name', type: 'text', value: person, required: true }
                    ]
                });

                if (result && result.name.trim() && result.name.trim() !== person) {
                    const newName = result.name.trim();

                    // 1. Update custom_persons storage
                    let customPersons = this.storage.get('custom_persons') || [];
                    const idx = customPersons.indexOf(person);
                    if (idx !== -1) customPersons[idx] = newName;
                    else customPersons.push(newName);
                    this.storage.set('custom_persons', customPersons);

                    // 2. Update familyData members
                    try {
                        let familyData = JSON.parse(localStorage.getItem('prodos_family_data')) || { members: [] };
                        if (familyData.members) {
                            const mem = familyData.members.find(m => m.name.toLowerCase() === person.toLowerCase());
                            if (mem) mem.name = newName;
                            localStorage.setItem('prodos_family_data', JSON.stringify(familyData));
                        }
                    } catch(e) {}

                    // 3. Update existing transactions with this person name
                    let txns = this.storage.get('transactions') || [];
                    txns = txns.map(t => {
                        if (t.person === person) return { ...t, person: newName };
                        return t;
                    });
                    this.storage.set('transactions', txns);

                    // 4. Update active filter if was selected
                    if (this.currentPersonFilter === person) {
                        this.currentPersonFilter = newName;
                        sessionStorage.setItem('prodos_active_family_member', newName);
                    }

                    showToast(`Renamed ${person} to ${newName}!`, 'success');
                    this.render();
                }
            });
        });

        // Delete Person handler
        document.querySelectorAll('.fin-person-del').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const person = e.currentTarget.dataset.person;
                if (!person) return;

                const confirmed = await showConfirmModal(`
                    <div style="text-align:left;">
                        <h3 style="margin-bottom:8px; text-align:center; color:var(--clr-red);">Remove Person / Member?</h3>
                        <p style="font-size:0.95rem; color:var(--text-primary); margin-bottom:12px;">
                            Are you sure you want to remove <strong>${person}</strong> from your family filter list?
                        </p>
                    </div>
                `, {
                    title: `Remove ${person}`,
                    confirmLabel: 'Remove Person',
                    danger: true
                });

                if (!confirmed) return;

                // 1. Add to deleted_persons blacklist
                let deletedPersons = this.storage.get('deleted_persons') || [];
                if (!deletedPersons.includes(person)) {
                    deletedPersons.push(person);
                    this.storage.set('deleted_persons', deletedPersons);
                }

                // 2. Remove from custom_persons
                let customPersons = this.storage.get('custom_persons') || [];
                customPersons = customPersons.filter(p => p !== person);
                this.storage.set('custom_persons', customPersons);

                // 3. Remove from familyData members
                try {
                    let familyData = JSON.parse(localStorage.getItem('prodos_family_data')) || { members: [] };
                    if (familyData.members) {
                        familyData.members = familyData.members.filter(m => m.name.toLowerCase() !== person.toLowerCase());
                        localStorage.setItem('prodos_family_data', JSON.stringify(familyData));
                    }
                } catch(e) {}

                // 4. Erase all transactions and loans belonging to this person
                let txns = this.storage.get('transactions') || [];
                txns = txns.filter(t => !t.person || t.person.toLowerCase() !== person.toLowerCase());
                this.storage.set('transactions', txns);

                let loans = this.storage.get('loans') || [];
                loans = loans.filter(l => !l.person || l.person.toLowerCase() !== person.toLowerCase());
                this.storage.set('loans', loans);

                // Reset filter if active
                if (this.currentPersonFilter === person) {
                    this.currentPersonFilter = 'All';
                    sessionStorage.setItem('prodos_active_family_member', 'All');
                }

                showToast(`Removed ${person}.`, 'info');
                this.render();
            });
        });

        // Add Person from Sidebar
        document.getElementById('fin-sidebar-add-person')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'Add Family Member / Person',
                icon: 'fa-solid fa-user-plus',
                submitLabel: 'Add Person',
                fields: [
                    { key: 'name', label: 'Person Name', type: 'text', placeholder: 'e.g. Dad, Sarah, Alex', required: true }
                ]
            });

            if (result && result.name.trim()) {
                const name = result.name.trim();

                // Clear from deleted_persons blacklist if re-added
                let deletedPersons = this.storage.get('deleted_persons') || [];
                deletedPersons = deletedPersons.filter(p => p.toLowerCase() !== name.toLowerCase());
                this.storage.set('deleted_persons', deletedPersons);
                
                // Save to custom_persons storage
                const customPersons = this.storage.get('custom_persons') || [];
                if (!customPersons.includes(name)) {
                    customPersons.push(name);
                    this.storage.set('custom_persons', customPersons);
                }

                // Also add to family members in prodos_family_data if not exists
                try {
                    let familyData = JSON.parse(localStorage.getItem('prodos_family_data')) || { members: [] };
                    if (!familyData.members) familyData.members = [];
                    if (!familyData.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
                        familyData.members.push({
                            memberId: `mem_${Date.now()}`,
                            name: name,
                            relationship: 'Member'
                        });
                        localStorage.setItem('prodos_family_data', JSON.stringify(familyData));
                    }
                } catch (e) {}

                showToast(`Added ${name}!`);
                this.currentPersonFilter = name;
                sessionStorage.setItem('prodos_active_family_member', name);
                this.render();
            }
        });

        // Type toggle
        document.querySelectorAll('.fin-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentViewMode = e.target.dataset.type;
                this.render();
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
                        submitLabel: 'Add Person',
                        fields: [
                            { key: 'name', label: 'Person Name', type: 'text', placeholder: 'e.g. Dad, Sarah', required: true }
                        ]
                    });
                    if (result && result.name.trim()) {
                        const name = result.name.trim();
                        const customPersons = this.storage.get('custom_persons') || [];
                        if (!customPersons.includes(name)) {
                            customPersons.push(name);
                            this.storage.set('custom_persons', customPersons);
                        }
                        this.currentPersonFilter = name;
                        sessionStorage.setItem('prodos_active_family_member', name);
                        this.render();
                    } else {
                        personSelect.value = (this.currentPersonFilter !== 'All' && this.currentPersonFilter !== 'Main') ? this.currentPersonFilter : '';
                    }
                }
            });
        }

        // Auto-categorize based on title
        const titleInput = document.getElementById('fin-title');
        titleInput?.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const catSelect = document.getElementById('fin-category');
            if (!catSelect || this.currentViewMode === 'loans') return;
            
            if (this.currentViewMode === 'income') {
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
        
        // Attach formatting
        attachCurrencyFormatter(document.getElementById('fin-amount'));
        attachCurrencyFormatter(document.getElementById('fin-interest'));
        attachCurrencyFormatter(document.getElementById('fin-sanctioned'));
        attachCurrencyFormatter(document.getElementById('fin-paid-already'));
        attachCurrencyFormatter(document.getElementById('fin-emi'));

        // Add Entry
        document.getElementById('fin-add-btn')?.addEventListener('click', () => {
            const dateInput = document.getElementById('fin-date');
            const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            const title = document.getElementById('fin-title').value.trim();
            const personSel = document.getElementById('fin-person');
            let person = personSel ? personSel.value : '';

            if (!title) { showToast('Please enter a title', 'error'); return; }
            if (person === '_NEW_') {
                person = prompt('Enter name of new person:');
                if (!person) return;
            }

            if (this.currentViewMode === 'loans') {
                const bank = document.getElementById('fin-bank').value.trim();
                const sanctioned = getRawValue(document.getElementById('fin-sanctioned'));
                const paidAlready = getRawValue(document.getElementById('fin-paid-already')) || 0;
                const emi = getRawValue(document.getElementById('fin-emi')) || 0;
                const rate = parseFloat(document.getElementById('fin-rate').value) || 0;
                const emiDate = parseInt(document.getElementById('fin-emi-date').value) || null;

                if (!sanctioned || sanctioned <= 0) {
                    showToast('Please enter a valid sanctioned amount.', 'error');
                    return;
                }
                
                if (paidAlready > sanctioned) {
                    showToast('Amount already paid cannot exceed sanctioned amount.', 'error');
                    return;
                }

                // Default lastEmiPaidMonth to current month to avoid immediately prompting them for a loan they just added
                const today = new Date();
                const currentMonthStr = today.getFullYear() + '-' + (today.getMonth() + 1);

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
                    emiDate: emiDate,
                    lastEmiPaidMonth: currentMonthStr,
                    date
                });
                this.saveLoans(loans);
                showToast('New Loan Account Added!');

            } else {
                const amount = getRawValue(document.getElementById('fin-amount'));
                const category = document.getElementById('fin-category').value;

                if (!amount || amount <= 0) {
                    showToast('Please enter a valid amount.', 'error');
                    return;
                }

                let interestAmount = 0;
                let linkedLoanId = null;

                if (this.currentViewMode === 'expense') {
                    interestAmount = getRawValue(document.getElementById('fin-interest')) || 0;
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
                    type: this.currentViewMode,
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
                showToast(`${this.currentViewMode === 'income' ? 'Income' : 'Expense'} logged!`);
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
                    { key: 'title', label: 'Title', type: 'text', value: txn.title || txn.description || '', required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'amount', value: txn.amount, required: true },
                    { type: 'row', children: [
                        { key: 'category', label: 'Category', type: 'dropdown', value: txn.category, options: categoryOptions },
                        { key: 'date', label: 'Date', type: 'date', value: txn.date }
                    ]},
                    { key: 'person', label: 'Person', type: 'text', value: txn.person || '' }
                ];

                if (txn.type === 'expense') {
                    fields.push({
                        type: 'row', children: [
                            { key: 'interest', label: 'Interest Part (₹)', type: 'amount', value: txn.interest || 0 },
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
                txn.person = result.person || '';
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
                        { key: 'amountSanctioned', label: 'Sanctioned Amount (₹)', type: 'amount', value: loan.amountSanctioned, required: true },
                        { key: 'amountLeftToPay', label: 'Left to Pay (₹)', type: 'amount', value: loan.amountLeftToPay, required: true }
                    ]},
                    { type: 'row', children: [
                        { key: 'emiPerMonth', label: 'EMI per month (₹)', type: 'amount', value: loan.emiPerMonth },
                        { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', value: loan.interestRate }
                    ]},
                    { key: 'emiDate', label: 'EMI Due Date (1-31)', type: 'number', value: loan.emiDate || '' }
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
                loan.person = result.person || '';
                loan.amountSanctioned = parseFloat(result.amountSanctioned);
                loan.amountLeftToPay = parseFloat(result.amountLeftToPay);
                loan.emiPerMonth = parseFloat(result.emiPerMonth) || 0;
                loan.interestRate = parseFloat(result.interestRate) || 0;
                loan.emiDate = parseInt(result.emiDate) || null;

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
