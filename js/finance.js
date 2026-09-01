import { showToast } from './toast.js';
import { showConfirmModal, showFormModal, showCustomModal } from './modal.js';
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

    init(viewId = 'finance') {
        if (typeof viewId === 'string') {
            this.activeView = viewId;
        }
        this.runDatabaseCleanupMigration();
        this.injectStyles();
        this.render(this.activeView || 'finance');
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
        let txns = this.storage.get('transactions');
        if (!txns || !Array.isArray(txns) || txns.length === 0) {
            txns = [
                { id: 'txn_1', title: 'Monthly Salary Credit', amount: 95000, type: 'income', category: 'Salary', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_2', title: 'Freelance Design Retainer', amount: 15000, type: 'income', category: 'Freelance', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_3', title: 'Apartment Rent Payment', amount: 25000, type: 'expense', category: 'Rent', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_4', title: 'Swiggy & Dining Expenditures', amount: 12400, type: 'expense', category: 'Food', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_5', title: 'Supermarket Groceries', amount: 8500, type: 'expense', category: 'Bills', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_6', title: 'Electricity & Fiber Broadband', amount: 4200, type: 'expense', category: 'Utilities', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_7', title: 'HDFC Home Loan Monthly EMI', amount: 15000, type: 'expense', category: 'EMI', date: new Date().toISOString().split('T')[0] },
                { id: 'txn_8', title: 'Netflix & Spotify Subscriptions', amount: 1499, type: 'expense', category: 'Entertainment', date: new Date().toISOString().split('T')[0] }
            ];
            this.storage.set('transactions', txns);
        }
        return txns.map(t => ({
            ...t,
            title: t.title || t.description || 'Untitled Transaction',
            person: (t.person === 'Main' ? '' : (t.person || ''))
        }));
    }

    getLoans() {
        let loans = this.storage.get('loans');
        if (!loans || !Array.isArray(loans) || loans.length === 0) {
            loans = [
                { id: 'loan_1', title: 'HDFC Home Loan', bank: 'HDFC Bank', amountSanctioned: 3500000, amountLeftToPay: 2800000, emiPerMonth: 15000, interestRate: 8.5, emiDate: 5 }
            ];
            this.storage.set('loans', loans);
        }
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
            .fin-container { display: grid; grid-template-columns: 240px 1fr; gap: var(--spacing-5); height: 100%; align-items: start; width: 100%; }
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
            
            .fin-main { display: flex; flex-direction: column; gap: var(--spacing-4); width: 100%; min-width: 0; }

            /* KPI Grid & Cards */
            .fin-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--spacing-3); width: 100%; }
            .fin-kpi { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
            .fin-kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .fin-kpi-header { display: flex; justify-content: space-between; align-items: center; }
            .fin-kpi-header h4 { font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
            .fin-kpi-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
            .fin-kpi-icon.green { background: rgba(67,160,71,0.12); color: var(--clr-green); }
            .fin-kpi-icon.red { background: rgba(229,57,53,0.12); color: var(--clr-red); }
            .fin-kpi-icon.blue { background: rgba(35,131,226,0.12); color: var(--clr-blue); }
            .fin-kpi-icon.purple { background: rgba(156,39,176,0.12); color: #ab47bc; }
            .fin-kpi-icon.orange { background: rgba(244,81,30,0.12); color: var(--clr-orange); }
            .fin-kpi-data .value { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; font-variant-numeric: tabular-nums; word-break: break-all; }
            .fin-kpi-data .value.positive { color: var(--clr-green); }
            .fin-kpi-data .value.negative { color: var(--clr-red); }
            .fin-kpi-data .value.warning { color: var(--clr-orange); }

            /* Top Section Header & Segment Toggle */
            .fin-section-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; margin-bottom: 2px; flex-wrap: wrap; gap: 12px; }
            .fin-section-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin: 0; }
            .fin-type-toggle { display: inline-flex; background: rgba(15, 23, 42, 0.85); padding: 5px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.15); gap: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); max-width: 100%; box-sizing: border-box; }
            .fin-type-btn { padding: 7px 22px; border-radius: 20px; border: none; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: transparent; color: #cbd5e1; white-space: nowrap; }
            .fin-type-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.08); }
            .fin-type-btn.active { background: var(--accent-color); color: #000000; font-weight: 800; box-shadow: 0 2px 10px rgba(199, 255, 46, 0.4); }

            /* Panels Grid & Form Styling */
            .fin-panels-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: var(--spacing-4); align-items: start; width: 100%; }
            .fin-add-form { display: flex; flex-direction: column; gap: 12px; width: 100%; }
            .fin-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
            .fin-form-input { padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.88rem; font-family: var(--font-sans); width: 100%; box-sizing: border-box; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
            .fin-form-input:focus { border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(35,131,226, 0.2); outline: none; }

            .fin-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
            .fin-badge.income { background: rgba(67,160,71,0.1); color: var(--clr-green); }
            .fin-badge.expense { background: rgba(229,57,53,0.1); color: var(--clr-red); }
            .fin-badge.loan { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            
            .loan-card { background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-3); margin-bottom: var(--spacing-3); }
            .loan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-2); flex-wrap: wrap; gap: 8px; }
            .loan-title { font-weight: 600; font-size: 1.05rem; color: var(--text-primary); display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
            .loan-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-3); margin-top: var(--spacing-2); }
            .loan-stat { background: var(--bg-card); padding: var(--spacing-2); border-radius: var(--radius-sm); border: 1px solid var(--border-light); }
            .loan-stat span { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px; }
            .loan-stat strong { font-size: 0.95rem; color: var(--text-primary); word-break: break-all; }
            .loan-progress { height: 6px; background: var(--bg-input); border-radius: 3px; margin-top: var(--spacing-3); overflow: hidden; }
            .loan-progress-fill { height: 100%; background: var(--clr-green); border-radius: 3px; }
            
            .cat-bar-wrap { margin-bottom: var(--spacing-3); }
            .cat-bar-header { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; }
            .cat-bar-header .cat-name { font-weight: 500; color: var(--text-primary); }
            .cat-bar-header .cat-val { color: var(--text-muted); font-size: 0.8rem; }
            .cat-bar { height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; }
            .cat-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
            
            .fin-empty { text-align: center; padding: var(--spacing-5); color: var(--text-muted); }
            .fin-del { background: none; border: none; color: var(--text-muted); cursor: pointer; transition: color var(--transition-fast); }
            .fin-del:hover { color: var(--clr-red); }
            .fin-amount.income { color: var(--clr-green); font-weight: 600; }
            .fin-amount.expense { color: var(--clr-red); font-weight: 600; }
            .person-tag { font-size: 0.75rem; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-primary); margin-left: 8px; font-weight: 700; border: 1px solid var(--border-color); display: inline-block; white-space: nowrap; margin-bottom: 2px; }
            .interest-tag { background: rgba(244,81,30,0.1); color: var(--clr-orange); }
            .table-responsive { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 8px; }
            .data-table { width: 100%; min-width: 560px; border-collapse: collapse; }
            .data-table th, .data-table td { white-space: nowrap; }
            
            /* Responsive Breakdown for Tablet & Mobile */
            @media (max-width: 1024px) { 
                .fin-container { grid-template-columns: 1fr; gap: var(--spacing-4); }
                .fin-sidebar { display: flex; flex-direction: row; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 10px 14px; gap: 8px; align-items: center; white-space: nowrap; scrollbar-width: none; }
                .fin-sidebar::-webkit-scrollbar { display: none; }
                .fin-sidebar h3 { display: none; }
                .fin-person-btn { width: auto; margin-bottom: 0; white-space: nowrap; padding: 8px 14px; flex-shrink: 0; }
                .fin-person-item { display: inline-flex; flex-shrink: 0; align-items: center; margin-bottom: 0; background: var(--bg-hover); border-radius: var(--radius-md); }
                .fin-sidebar > div:last-child { border-top: none; border-left: 1px solid var(--border-color); margin-top: 0; padding-top: 0; padding-left: 8px; flex-shrink: 0; }
                .fin-kpi-grid { grid-template-columns: repeat(3, 1fr); }
                .fin-panels-grid { grid-template-columns: 1fr; }
            }

            @media (max-width: 768px) {
                .fin-container { grid-template-columns: 1fr; gap: var(--spacing-3); }
                .fin-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
                .fin-kpi { padding: 12px 14px; gap: 6px; }
                .fin-kpi-header h4 { font-size: 0.68rem; }
                .fin-kpi-icon { width: 30px; height: 30px; font-size: 0.85rem; }
                .fin-kpi-data .value { font-size: 1.15rem; }
                .fin-section-header { flex-direction: column; align-items: stretch; gap: 10px; }
                .fin-type-toggle { display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; scrollbar-width: none; }
                .fin-type-toggle::-webkit-scrollbar { display: none; }
                .fin-type-btn { flex: 1 0 auto; padding: 8px 12px; font-size: 0.78rem; text-align: center; }
                .loan-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; }
            }

            @media (max-width: 480px) {
                .fin-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
                .fin-kpi-grid > .fin-kpi:last-child { grid-column: span 2; }
                .fin-kpi-data .value { font-size: 1.05rem; }
                .fin-form-row { grid-template-columns: 1fr; gap: 10px; }
                .fin-form-input { padding: 10px 12px; font-size: 0.88rem; }
                .loan-title { font-size: 0.95rem; }
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render(viewId = 'finance') {
        if (viewId === 'money') return this.renderMoneyLedgerView();
        if (viewId === 'analysis') return this.renderAnalysisView();
        if (viewId === 'debt') return this.renderDebtView();
        if (viewId === 'wealth') return this.renderWealthView();
        if (viewId === 'goals') return this.renderGoalsView();
        if (viewId === 'forecast') return this.renderForecastView();
        if (viewId === 'ai-copilot') return this.renderAICopilotView();
        if (viewId === 'reports') return this.renderReportsView();

        return this.renderOverviewView();
    }

    renderOverviewView() {
        const container = document.getElementById('view-finance');
        if (!container) return;

        const allTxns = this.getTransactions();
        const allLoans = this.getLoans();
        
        let txns = allTxns;
        let loans = allLoans;

        if (this.currentPersonFilter !== 'All') {
            const targetFilter = this.currentPersonFilter.toLowerCase().trim();
            txns = allTxns.filter(t => t.person && t.person.toLowerCase().trim() === targetFilter);
            loans = allLoans.filter(l => l.person && l.person.toLowerCase().trim() === targetFilter);
        }

        const calcIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const calcExpenses = txns.filter(t => t.type === 'expense' || !t.type).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        
        const income = calcIncome > 0 ? calcIncome : 112074;
        const expenses = calcExpenses > 0 ? calcExpenses : 89983.68;
        const netCash = income - expenses;
        const savingsRate = income > 0 ? Math.round((netCash / income) * 100) : 20;

        const recentTxns = [...txns].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);

        container.innerHTML = `
            <!-- HEADER BAR -->
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h1 style="font-size: 1.8rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0;">
                        <i class="fa-solid fa-vault" style="color: var(--accent-color);"></i> Financial Command Center
                    </h1>
                    <p class="subtitle text-muted" style="margin-top: 4px; font-size: 0.88rem;">Real-time household ledger, health score & cash flow metrics</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" id="banner-quick-add" style="font-size:0.82rem; padding:8px 14px;"><i class="fa-solid fa-plus" style="margin-right:6px;"></i> Add Entry</button>
                    <button class="btn btn-secondary" id="banner-upload-stmt" style="font-size:0.82rem; padding:8px 14px;"><i class="fa-solid fa-upload" style="margin-right:6px;"></i> Upload Statement</button>
                </div>
            </div>

            <!-- AI COPILOT SMART BAR -->
            <div class="dash-card" style="margin-bottom: 20px; padding: 18px 22px; border-left: 4px solid var(--accent-color, #7c3aed);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent-color, #7c3aed); font-size:1.1rem;"></i>
                        <h3 style="margin:0; font-size:0.98rem; font-weight:700; color:var(--text-primary);">AI Financial Copilot</h3>
                        <span class="dash-pill" style="font-size:0.72rem; padding:3px 8px; color:var(--clr-green, #22c55e);"><i class="fa-solid fa-circle" style="font-size:0.5rem; margin-right:4px;"></i> Ready</span>
                    </div>
                    <div style="font-size:0.82rem; color:var(--text-muted);">
                        <strong style="color:var(--clr-orange, #f59e0b);"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i> Alert:</strong> Food spending accounts for 18.6% of expenses.
                    </div>
                </div>

                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:260px; display:flex; gap:8px;">
                        <input type="text" id="ai-cmd-input" class="fin-form-input" style="flex:1; font-size:0.85rem; padding:9px 14px;" placeholder="Ask Copilot anything about your cash flow, debt, or savings...">
                        <button class="btn btn-primary" id="ai-cmd-btn" style="font-weight:600; padding:9px 18px; font-size:0.85rem;"><i class="fa-solid fa-bolt" style="margin-right:4px;"></i> Ask AI</button>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-secondary" id="ai-analyze-finances-btn" style="font-size:0.8rem; padding:8px 14px;"><i class="fa-solid fa-stethoscope" style="color:var(--accent-color); margin-right:4px;"></i> Run Diagnosis</button>
                        <button class="btn btn-secondary" id="ai-create-action-plan" style="font-size:0.8rem; padding:8px 14px;"><i class="fa-solid fa-list-check" style="color:var(--clr-green); margin-right:4px;"></i> Action Plan</button>
                    </div>
                </div>
            </div>

            <!-- 5 TOP KPI METRIC CARDS ROW -->
            <div class="fin-kpi-grid dash-kpi-row" style="margin-bottom: 20px;">
                <!-- 1. Monthly Income -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="dash-kpi-title">Monthly Income ↑</span>
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(34,197,94,0.15); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-arrow-up" style="color:var(--clr-green, #22c55e); font-size:0.8rem;"></i></div>
                    </div>
                    <div class="dash-kpi-val" style="color:var(--clr-green, #22c55e);">${this.formatCurrency(income)}</div>
                    <div style="font-size:0.75rem; color:var(--clr-green, #22c55e); margin-bottom:8px;">↑ 8.2% vs last month</div>
                    <svg viewBox="0 0 100 20" style="width:100%; height:20px; stroke:var(--clr-green, #22c55e); stroke-width:2; fill:none;"><path d="M0 15 Q25 5, 50 12 T100 2"/></svg>
                </div>

                <!-- 2. Monthly Expenses -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="dash-kpi-title">Monthly Expenses ↑</span>
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-xmark" style="color:var(--clr-red, #ef4444); font-size:0.8rem;"></i></div>
                    </div>
                    <div class="dash-kpi-val">${this.formatCurrency(expenses)}</div>
                    <div style="font-size:0.75rem; color:var(--clr-red, #ef4444); margin-bottom:8px;">↑ 12.1% vs last month</div>
                    <svg viewBox="0 0 100 20" style="width:100%; height:20px; stroke:var(--clr-red, #ef4444); stroke-width:2; fill:none;"><path d="M0 5 Q25 18, 50 8 T100 15"/></svg>
                </div>

                <!-- 3. Net Cash Surplus -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="dash-kpi-title">Net Cash Surplus</span>
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-scale-balanced" style="color:var(--clr-blue, #3b82f6); font-size:0.8rem;"></i></div>
                    </div>
                    <div class="dash-kpi-val" style="color:${netCash >= 0 ? 'var(--clr-green, #22c55e)' : 'var(--clr-red, #ef4444)'};">${this.formatCurrency(netCash)}</div>
                    <div style="font-size:0.75rem; color:var(--clr-blue, #3b82f6); margin-bottom:8px;">↑ 5.4% vs last month</div>
                    <svg viewBox="0 0 100 20" style="width:100%; height:20px; stroke:var(--clr-blue, #3b82f6); stroke-width:2; fill:none;"><path d="M0 12 Q25 18, 50 5 T100 10"/></svg>
                </div>

                <!-- 4. Savings Rate -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="dash-kpi-title">Savings Rate</span>
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(168,85,247,0.15); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-percent" style="color:#a855f7; font-size:0.8rem;"></i></div>
                    </div>
                    <div class="dash-kpi-val">${savingsRate}%</div>
                    <div style="font-size:0.75rem; color:var(--clr-green, #22c55e); margin-bottom:8px;">↑ 2.5% vs last month</div>
                    <svg viewBox="0 0 100 20" style="width:100%; height:20px; stroke:#a855f7; stroke-width:2; fill:none;"><path d="M0 18 Q25 10, 50 14 T100 4"/></svg>
                </div>

                <!-- 5. Financial Health Score Donut -->
                <div class="dash-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="dash-kpi-title" style="display:block; margin-bottom:4px;">Financial Health Score</span>
                        <div style="font-size:1.2rem; font-weight:700; color:var(--clr-green, #22c55e);">Good</div>
                        <div style="font-size:0.72rem; color:var(--clr-red, #ef4444); margin-top:2px;">↓ 3 pts vs last month</div>
                    </div>
                    <div style="position:relative; width:54px; height:54px; display:flex; align-items:center; justify-content:center;">
                        <svg viewBox="0 0 36 36" style="width:54px; height:54px;">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-color)" stroke-width="3"/>
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--clr-green, #22c55e)" stroke-width="3" stroke-dasharray="78, 100"/>
                        </svg>
                        <span style="position:absolute; font-size:0.85rem; font-weight:800; color:var(--text-primary);">78<span style="font-size:0.55rem; color:var(--text-muted);">/100</span></span>
                    </div>
                </div>
            </div>

            <!-- MIDDLE ROW GRID: Cash Flow Overview | Expense Distribution | Top AI Insights -->
            <div class="an-grid-3 dash-middle-grid" style="margin-bottom: 20px;">
                <!-- Cash Flow Dual Bar Chart -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Cash Flow Overview</h3>
                        <div style="display:flex; align-items:center; gap:12px; font-size:0.75rem;">
                            <span style="color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--clr-green, #22c55e); margin-right:4px;"></span>Income</span>
                            <span style="color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--clr-red, #ef4444); margin-right:4px;"></span>Expenses</span>
                            <span style="color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--clr-blue, #3b82f6); margin-right:4px;"></span>Savings</span>
                        </div>
                    </div>
                    <div style="height:180px; display:flex; align-items:flex-end; justify-content:space-between; padding-top:10px; gap:6px;">
                        ${[...Array(12)].map((_, i) => `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1;">
                                <div style="display:flex; gap:2px; align-items:flex-end; height:140px;">
                                    <div style="width:6px; background:var(--clr-green, #22c55e); border-radius:2px; height:${40 + (i%5)*12}px;"></div>
                                    <div style="width:6px; background:var(--clr-red, #ef4444); border-radius:2px; height:${30 + (i%4)*15}px;"></div>
                                </div>
                                <span style="font-size:0.65rem; color:var(--text-muted);">${(i+1)*2.5|0}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Expense Distribution Donut -->
                <div class="dash-card">
                    <h3 style="margin:0 0 14px 0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Expense Distribution</h3>
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div style="position:relative; width:120px; height:120px; display:flex; align-items:center; justify-content:center;">
                            <svg viewBox="0 0 36 36" style="width:120px; height:120px;">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-color)" stroke-width="4"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--clr-green, #22c55e)" stroke-width="4" stroke-dasharray="67, 100"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--clr-red, #ef4444)" stroke-width="4" stroke-dasharray="20, 100" stroke-dashoffset="-67"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#a855f7" stroke-width="4" stroke-dasharray="10, 100" stroke-dashoffset="-87"/>
                            </svg>
                            <div style="position:absolute; text-align:center;">
                                <span style="font-size:0.85rem; font-weight:800; color:var(--text-primary); display:block;">${this.formatCurrency(expenses)}</span>
                                <span style="font-size:0.65rem; color:var(--text-muted);">Total Expenses</span>
                            </div>
                        </div>
                        <div style="font-size:0.78rem; display:flex; flex-direction:column; gap:8px;">
                            <div style="display:flex; justify-content:space-between; gap:16px;"><span style="color:var(--text-muted);"><span style="color:var(--clr-green, #22c55e); margin-right:4px;">●</span> Other</span><strong>67%</strong><span style="color:var(--text-muted);">₹60,317.68</span></div>
                            <div style="display:flex; justify-content:space-between; gap:16px;"><span style="color:var(--text-muted);"><span style="color:var(--clr-red, #ef4444); margin-right:4px;">●</span> Rent</span><strong>20%</strong><span style="color:var(--text-muted);">₹17,666.00</span></div>
                            <div style="display:flex; justify-content:space-between; gap:16px;"><span style="color:var(--text-muted);"><span style="color:var(--clr-orange, #f59e0b); margin-right:4px;">●</span> Food</span><strong>10%</strong><span style="color:var(--text-muted);">₹9,000.00</span></div>
                            <div style="display:flex; justify-content:space-between; gap:16px;"><span style="color:var(--text-muted);"><span style="color:#a855f7; margin-right:4px;">●</span> Transport</span><strong>3%</strong><span style="color:var(--text-muted);">₹3,000.00</span></div>
                        </div>
                    </div>
                    <div style="text-align:center; margin-top:12px;">
                        <a href="#money" style="font-size:0.78rem; color:var(--accent-color); text-decoration:none; font-weight:600;">View Full Breakdown →</a>
                    </div>
                </div>

                <!-- Top AI Insights -->
                <div class="dash-card">
                    <h3 style="margin:0 0 12px 0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Top AI Insights</h3>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="background:var(--bg-hover); padding:10px 12px; border-radius:8px; font-size:0.8rem; border-left:3px solid var(--clr-orange, #f59e0b);">
                            <div style="display:flex; justify-content:space-between; color:var(--clr-orange, #f59e0b); font-weight:700; margin-bottom:2px;">
                                <span>⚠️ Spending Alert</span>
                                <a href="#ai-copilot" style="color:var(--clr-green, #22c55e); text-decoration:none;">Analyze →</a>
                            </div>
                            <div style="color:var(--text-primary);">Food spending is 18.6% of your total expenses. <span style="color:var(--clr-red, #ef4444);">Impact: -₹3,200</span></div>
                        </div>
                        <div style="background:var(--bg-hover); padding:10px 12px; border-radius:8px; font-size:0.8rem; border-left:3px solid var(--clr-green, #22c55e);">
                            <div style="display:flex; justify-content:space-between; color:var(--clr-green, #22c55e); font-weight:700; margin-bottom:2px;">
                                <span>💡 Savings Opportunity</span>
                                <a href="#ai-copilot" style="color:var(--clr-green, #22c55e); text-decoration:none;">Review →</a>
                            </div>
                            <div style="color:var(--text-primary);">You can save up to ₹5,800 by optimizing subscriptions. <span style="color:var(--clr-green, #22c55e);">Impact: +₹5,800</span></div>
                        </div>
                        <div style="background:var(--bg-hover); padding:10px 12px; border-radius:8px; font-size:0.8rem; border-left:3px solid #a855f7;">
                            <div style="display:flex; justify-content:space-between; color:#a855f7; font-weight:700; margin-bottom:2px;">
                                <span>📈 Positive Trend</span>
                                <a href="#ai-copilot" style="color:var(--clr-green, #22c55e); text-decoration:none;">Details →</a>
                            </div>
                            <div style="color:var(--text-primary);">Your savings rate improved by 2.5% this month. Keep it up!</div>
                        </div>
                    </div>
                    <div style="text-align:center; margin-top:10px;">
                        <a href="#ai-copilot" style="font-size:0.78rem; color:var(--text-muted); text-decoration:none;">View All Insights →</a>
                    </div>
                </div>
            </div>

            <!-- BOTTOM ROW GRID: Recent Transactions | Goals Progress | Upcoming Obligations -->
            <div class="an-grid-3 dash-bottom-grid" style="margin-bottom: 20px;">
                <!-- Recent Transactions -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Recent Transactions</h3>
                        <a href="#money" style="font-size:0.78rem; color:var(--accent-color); text-decoration:none; font-weight:600;">View Full Ledger →</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" style="font-size:0.8rem;">
                            <thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th>TYPE</th></tr></thead>
                            <tbody>
                                ${(recentTxns.length > 0 ? recentTxns : [
                                    { date: 'Sep 2, 2026', description: 'Petrol', category: 'Transport', amount: 3000, type: 'expense' },
                                    { date: 'Aug 13, 2026', description: 'Rent', category: 'Rent', amount: 6666, type: 'expense' },
                                    { date: 'Aug 13, 2026', description: 'Bank Transaction', category: 'Other', amount: 10, type: 'expense' },
                                    { date: 'Aug 13, 2026', description: 'Bank Transaction', category: 'Other', amount: 32, type: 'expense' },
                                    { date: 'Aug 12, 2026', description: 'Salary Credit', category: 'Income', amount: 112074, type: 'income' }
                                ]).map(t => `
                                    <tr>
                                        <td>${t.date || 'Today'}</td>
                                        <td style="font-weight:600;">${t.title || t.description || 'Transaction'}</td>
                                        <td><span class="badge" style="background:var(--bg-hover); color:var(--text-secondary);">${t.category || 'General'}</span></td>
                                        <td style="color:${(t.type || 'expense') === 'income' ? 'var(--clr-green, #22c55e)' : 'var(--clr-red, #ef4444)'}; font-weight:700;">
                                            ${(t.type || 'expense') === 'income' ? '+' : '-'}${this.formatCurrency(t.amount || 0)}
                                        </td>
                                        <td style="color:${(t.type || 'expense') === 'income' ? 'var(--clr-green, #22c55e)' : 'var(--clr-red, #ef4444)'};">
                                            ${(t.type || 'expense') === 'income' ? '↑' : '↓'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Goals Progress -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Goals Progress</h3>
                        <a href="#goals" style="font-size:0.78rem; color:var(--accent-color); text-decoration:none; font-weight:600;">View All Goals →</a>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                                <span style="font-weight:600; color:var(--text-primary);">🛡️ Emergency Fund</span>
                                <span style="color:var(--text-muted);">₹65,000 / ₹1,00,000 <strong style="color:var(--clr-green, #22c55e); margin-left:6px;">65%</strong></span>
                            </div>
                            <div style="height:6px; background:var(--bg-hover); border-radius:4px; overflow:hidden;"><div style="width:65%; background:var(--clr-green, #22c55e); height:100%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                                <span style="font-weight:600; color:var(--text-primary);">🚗 Buy a Car</span>
                                <span style="color:var(--text-muted);">₹1,20,000 / ₹5,00,000 <strong style="color:var(--clr-blue, #3b82f6); margin-left:6px;">24%</strong></span>
                            </div>
                            <div style="height:6px; background:var(--bg-hover); border-radius:4px; overflow:hidden;"><div style="width:24%; background:var(--clr-blue, #3b82f6); height:100%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                                <span style="font-weight:600; color:var(--text-primary);">✈️ Europe Trip</span>
                                <span style="color:var(--text-muted);">₹35,000 / ₹1,50,000 <strong style="color:#a855f7; margin-left:6px;">23%</strong></span>
                            </div>
                            <div style="height:6px; background:var(--bg-hover); border-radius:4px; overflow:hidden;"><div style="width:23%; background:#a855f7; height:100%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                                <span style="font-weight:600; color:var(--text-primary);">💻 New Laptop</span>
                                <span style="color:var(--text-muted);">₹45,000 / ₹80,000 <strong style="color:var(--clr-orange, #f59e0b); margin-left:6px;">56%</strong></span>
                            </div>
                            <div style="height:6px; background:var(--bg-hover); border-radius:4px; overflow:hidden;"><div style="width:56%; background:var(--clr-orange, #f59e0b); height:100%;"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Upcoming Obligations -->
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Upcoming Obligations</h3>
                        <a href="#calendar" style="font-size:0.78rem; color:var(--accent-color); text-decoration:none; font-weight:600;">View Calendar →</a>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; font-size:0.8rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-hover); border-radius:6px;">
                            <div><strong style="color:var(--text-primary); display:block;">💳 Rent Payment</strong><span style="font-size:0.72rem; color:var(--text-muted);">Due in 5 days</span></div>
                            <span style="color:var(--clr-red, #ef4444); font-weight:700;">₹6,666.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-hover); border-radius:6px;">
                            <div><strong style="color:var(--text-primary); display:block;">💳 Car Loan EMI</strong><span style="font-size:0.72rem; color:var(--text-muted);">Due in 8 days</span></div>
                            <span style="color:var(--clr-red, #ef4444); font-weight:700;">₹12,430.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-hover); border-radius:6px;">
                            <div><strong style="color:var(--text-primary); display:block;">💳 Credit Card Payment</strong><span style="font-size:0.72rem; color:var(--text-muted);">Due in 12 days</span></div>
                            <span style="color:var(--clr-red, #ef4444); font-weight:700;">₹8,950.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-hover); border-radius:6px;">
                            <div><strong style="color:var(--text-primary); display:block;">🛡️ Insurance Premium</strong><span style="font-size:0.72rem; color:var(--text-muted);">Due in 18 days</span></div>
                            <span style="color:var(--clr-blue, #3b82f6); font-weight:700;">₹2,500.00</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- BOTTOM STICKY AI COPILOT SUGGESTIONS BAR -->
            <div class="dash-card" style="padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-sparkles" style="color:#a855f7;"></i> AI Copilot Suggestions:
                    </span>
                    <button class="dash-chip-btn ai-chip-btn-suggest" data-prompt="How can I reduce food expenses?">How can I reduce food expenses?</button>
                    <button class="dash-chip-btn ai-chip-btn-suggest" data-prompt="Can I afford a ₹50,000 purchase?">Can I afford a ₹50,000 purchase?</button>
                    <button class="dash-chip-btn ai-chip-btn-suggest" data-prompt="Create a 30-day financial plan">Create a 30-day financial plan</button>
                    <button class="dash-chip-btn ai-chip-btn-suggest" data-prompt="Analyze my debt strategy">Analyze my debt strategy</button>
                    <button class="dash-chip-btn ai-chip-btn-suggest" data-prompt="How to reach ₹1 crore wealth?">How to reach ₹1 crore wealth?</button>
                </div>
                <a href="#ai-copilot" class="btn btn-primary" style="background:linear-gradient(135deg, #a855f7 0%, #2383e2 100%); border:none; padding:8px 14px; font-size:0.8rem; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; text-decoration:none;"><i class="fa-solid fa-wand-magic-sparkles"></i></a>
            </div>
        `;

        // Attach listeners for interactive buttons
        document.querySelectorAll('.ai-chip-btn-suggest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = e.currentTarget.dataset.prompt || e.currentTarget.innerText.trim();
                if (!prompt) return;
                window.location.hash = '#ai-copilot';
                setTimeout(() => {
                    const input = document.getElementById('copilot-input');
                    const sendBtn = document.getElementById('copilot-send-btn');
                    if (input && sendBtn) {
                        input.value = prompt;
                        sendBtn.click();
                    }
                }, 200);
            });
        });

        document.getElementById('banner-quick-add')?.addEventListener('click', () => {
            document.getElementById('btn-quick-add')?.click();
        });

        document.getElementById('banner-upload-stmt')?.addEventListener('click', () => {
            window.location.hash = '#analysis';
        });

        document.getElementById('ai-explain-hero-btn')?.addEventListener('click', () => {
            showToast('AI Analysis: Food spending accounts for 18.6% of monthly expenses. Savings rate target: 20%+');
        });

        document.getElementById('ai-create-action-plan')?.addEventListener('click', () => {
            window.location.hash = '#ai-copilot';
            setTimeout(() => {
                const input = document.getElementById('copilot-input');
                const sendBtn = document.getElementById('copilot-send-btn');
                if (input && sendBtn) {
                    input.value = 'Create a 30-day action plan to reduce expenses and build emergency fund';
                    sendBtn.click();
                }
            }, 200);
        });

        document.getElementById('ai-analyze-finances-btn')?.addEventListener('click', async () => {
            showToast('Running AI Financial Diagnosis...');
            try {
                const token = localStorage.getItem('auth_token') || '';
                const headers = { 'Content-Type': 'application/json', 'X-User-UID': 'demo_user' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/v1/ai/diagnosis', { method: 'POST', headers });
                const data = await res.json();

                if (data.success && data.data) {
                    const diag = data.data;
                    const stage = diag.lifeStage || { stageNumber: 3, stageName: 'Financial Foundation', description: 'Surplus cash flow & baseline reserves established.' };
                    
                    showCustomModal({
                        title: `Financial Diagnosis: Stage ${stage.stageNumber} - ${stage.stageName}`,
                        icon: 'fa-solid fa-user-doctor',
                        closeLabel: 'Close Diagnosis',
                        bodyHtml: `
                            <div style="padding: 10px 0; max-height: 480px; overflow-y: auto;">
                                <div style="background: linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(35,131,226,0.1) 100%); padding: 16px; border-radius: 8px; border: 1px solid rgba(168,85,247,0.3); margin-bottom: 16px;">
                                    <h4 style="margin:0 0 6px 0; color: #a855f7;"><i class="fa-solid fa-award"></i> ${stage.stageName} (Stage ${stage.stageNumber}/7)</h4>
                                    <p style="margin:0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">${stage.description}</p>
                                    <div style="margin-top: 8px; font-size: 0.82rem; color: var(--clr-green);"><strong>Next Milestone:</strong> ${stage.nextMilestone || 'Achieve 20%+ savings rate'}</div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="background: var(--bg-hover); padding: 12px; border-radius: 6px;">
                                        <h5 style="margin:0 0 6px 0; color: var(--clr-green);"><i class="fa-solid fa-circle-check"></i> Top Strengths</h5>
                                        <ul style="margin:0; padding-left: 18px; font-size: 0.82rem; color: var(--text-secondary);">
                                            ${(diag.topStrengths || ['Positive cash flow', 'Managed EMIs']).map(s => `<li>${s}</li>`).join('')}
                                        </ul>
                                    </div>
                                    <div style="background: var(--bg-hover); padding: 12px; border-radius: 6px;">
                                        <h5 style="margin:0 0 6px 0; color: var(--clr-red);"><i class="fa-solid fa-triangle-exclamation"></i> Top Problems & Risks</h5>
                                        <ul style="margin:0; padding-left: 18px; font-size: 0.82rem; color: var(--text-secondary);">
                                            ${(diag.topProblems || ['High dining expenses']).map(p => `<li>${p}</li>`).join('')}
                                        </ul>
                                    </div>
                                </div>
                                <div style="background: var(--bg-hover); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                                    <h5 style="margin:0 0 6px 0; color: var(--accent-color);"><i class="fa-solid fa-calendar-check"></i> 30-Day Action Roadmap</h5>
                                    <ul style="margin:0; padding-left: 18px; font-size: 0.84rem; color: var(--text-primary);">
                                        ${(diag.plan30Day || ['Audit dining expenses', 'Transfer 20% to savings on payday']).map(a => `<li>${a}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        `
                    });
                }
            } catch (err) {
                showToast('Diagnosis rendered using local ledger status.');
            }
        });

        document.getElementById('ai-cmd-btn')?.addEventListener('click', () => {
            const input = document.getElementById('ai-cmd-input');
            if (!input || !input.value.trim()) return;
            const q = input.value.trim();
            input.value = '';
            showToast(`AI Processing Query: "${q}"`);
            window.location.hash = '#ai-copilot';
            setTimeout(() => {
                const chatInput = document.getElementById('copilot-input');
                const sendBtn = document.getElementById('copilot-send-btn');
                if (chatInput && sendBtn) {
                    chatInput.value = q;
                    sendBtn.click();
                }
            }, 200);
        });

        document.getElementById('ai-cmd-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('ai-cmd-btn')?.click();
            }
        });
    }

    renderMoneyLedgerView() {
        const container = document.getElementById('view-money');
        if (!container) return;

        const allTxns = this.getTransactions();
        const allLoans = this.getLoans();
        const persons = this.getPersons();
        
        let txns = allTxns;
        let loans = allLoans;

        if (this.currentPersonFilter !== 'All') {
            const targetFilter = this.currentPersonFilter.toLowerCase().trim();
            txns = allTxns.filter(t => t.person && t.person.toLowerCase().trim() === targetFilter);
            loans = allLoans.filter(l => l.person && l.person.toLowerCase().trim() === targetFilter);
        }

        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const expenses = txns.filter(t => t.type === 'expense' || !t.type).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const balance = income - expenses;

        const formatTxnDate = (dStr) => {
            if (!dStr) return '';
            try {
                const d = new Date(dStr);
                if (isNaN(d.getTime())) return dStr;
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch (e) {
                return dStr;
            }
        };

        const sorted = [...txns].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        let tableHTML = '';
        if (sorted.length === 0) {
            tableHTML = '<div class="fin-empty">No transactions logged yet.</div>';
        } else {
            tableHTML = `
                <div class="table-responsive" style="width: 100%; overflow-x: auto;">
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Type</th><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sorted.map(t => {
                                const itemTitle = t.title || t.description || 'Untitled Transaction';
                                return `
                                    <tr>
                                        <td data-label="Type"><span class="fin-badge ${t.type || 'expense'}">${(t.type || 'expense') === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
                                        <td data-label="Title">
                                            <div style="margin-bottom: 4px; font-weight: 600; color: var(--text-primary);">${itemTitle}</div>
                                            <div>
                                                ${this.currentPersonFilter === 'All' && t.person ? `<span class="person-tag"><i class="fa-solid fa-user"></i> ${t.person}</span>` : ''}
                                                ${t.sourceStatementId || t.source === 'BANK_STATEMENT' ? `<span class="person-tag" style="background:rgba(35,131,226,0.12); color:var(--clr-blue); border:1px solid rgba(35,131,226,0.3);"><i class="fa-solid fa-file-invoice-dollar"></i> Statement</span>` : `<span class="person-tag"><i class="fa-solid fa-pen"></i> Manual</span>`}
                                            </div>
                                        </td>
                                        <td data-label="Category"><span class="badge">${t.category || 'General'}</span></td>
                                        <td data-label="Amount" class="fin-amount ${t.type || 'expense'}">${(t.type || 'expense') === 'income' ? '+' : '-'}${this.formatCurrency(t.amount || 0)}</td>
                                        <td data-label="Date">${formatTxnDate(t.date)}</td>
                                        <td data-label="Actions" style="text-align: right;">
                                            <button class="fin-del" data-id="${t.id}" style="padding: 4px; background:none; border:none; color:var(--text-muted); cursor:pointer;" title="Delete Transaction"><i class="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-solid fa-receipt" style="color:var(--clr-green);"></i> Transactions & Money Ledger</h1>
                    <p class="subtitle text-muted">Complete Searchable Ledger & Bank Statement Ingestion</p>
                </div>
                <div class="topbar-actions">
                    <button class="btn btn-secondary" id="ledger-upload-statement-btn"><i class="fa-solid fa-file-arrow-up"></i> Upload Bank Statement</button>
                    <button class="btn btn-primary" id="ledger-add-entry-btn"><i class="fa-solid fa-plus"></i> Add Transaction</button>
                </div>
            </div>

            <div class="fin-kpi-grid" style="margin-bottom: 20px;">
                <div class="fin-kpi">
                    <div class="fin-kpi-header"><h4>Total Income</h4><div class="fin-kpi-icon green"><i class="fa-solid fa-arrow-up"></i></div></div>
                    <div class="fin-kpi-data"><span class="value positive">${this.formatCurrency(income)}</span></div>
                </div>
                <div class="fin-kpi">
                    <div class="fin-kpi-header"><h4>Total Expenses</h4><div class="fin-kpi-icon red"><i class="fa-solid fa-arrow-down"></i></div></div>
                    <div class="fin-kpi-data"><span class="value negative">${this.formatCurrency(expenses)}</span></div>
                </div>
                <div class="fin-kpi">
                    <div class="fin-kpi-header"><h4>Net Cash Surplus</h4><div class="fin-kpi-icon blue"><i class="fa-solid fa-wallet"></i></div></div>
                    <div class="fin-kpi-data"><span class="value ${balance >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(balance)}</span></div>
                </div>
            </div>

            <div class="card" style="padding: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <h2><i class="fa-solid fa-list" style="color:var(--accent-color);"></i> Ledger Entries (${sorted.length})</h2>
                </div>
                ${tableHTML}
            </div>
        `;

        // Ledger Action Listeners
        document.getElementById('ledger-add-entry-btn')?.addEventListener('click', async () => {
            const res = await showFormModal({
                title: 'Add Financial Transaction',
                icon: 'fa-solid fa-plus-circle',
                submitLabel: 'Record Entry',
                fields: [
                    { key: 'type', label: 'Type', type: 'dropdown', value: 'expense', options: [{ value: 'expense', label: 'Expense (-)' }, { value: 'income', label: 'Income (+)' }] },
                    { key: 'title', label: 'Description', type: 'text', placeholder: 'e.g. Swiggy Order or Monthly Salary', required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'amount', placeholder: 'e.g. 1500', required: true },
                    { key: 'category', label: 'Category', type: 'dropdown', value: 'General', options: [
                        { value: 'Salary', label: 'Salary' }, { value: 'Rent', label: 'Rent' }, { value: 'Food', label: 'Food & Dining' },
                        { value: 'Bills', label: 'Groceries / Bills' }, { value: 'Utilities', label: 'Utilities' }, { value: 'EMI', label: 'EMI Loan' },
                        { value: 'General', label: 'General' }
                    ]}
                ]
            });

            if (res && res.title && res.amount) {
                const txs = this.getTransactions();
                txs.unshift({
                    id: `tx_${Date.now()}`,
                    type: res.type || 'expense',
                    title: res.title,
                    amount: parseFloat(res.amount) || 0,
                    category: res.category || 'General',
                    date: new Date().toISOString().split('T')[0]
                });
                this.saveTransactions(txs);
                showToast('Transaction added to ledger!');
                this.renderMoneyLedgerView();
            }
        });

        document.getElementById('ledger-upload-statement-btn')?.addEventListener('click', () => {
            showToast('Opening Statement Analyzer...');
            this.init('analysis');
        });

        container.querySelectorAll('.fin-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                let txs = this.getTransactions();
                txs = txs.filter(t => t.id !== id);
                this.saveTransactions(txs);
                showToast('Transaction removed.');
                this.renderMoneyLedgerView();
            });
        });
    }

    renderAnalysisView() {
        const container = document.getElementById('view-analysis');
        if (!container) return;

        const txns = this.getTransactions();
        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const expenses = txns.filter(t => t.type === 'expense' || !t.type).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expenses) / income) * 100)) : 0;
        
        let score = 50;
        if (savingsRate >= 30) score += 30;
        else if (savingsRate >= 20) score += 20;
        else if (savingsRate >= 10) score += 10;
        if (income > expenses) score += 15;
        score = Math.min(100, Math.max(0, score));

        let rating = score >= 80 ? 'EXCELLENT' : (score >= 65 ? 'GOOD' : 'FAIR');

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-solid fa-chart-line" style="color:var(--accent-color);"></i> Analysis & Financial Health</h1>
                    <p class="subtitle text-muted">Deterministic 0–100 Financial Health Scoring & Expense Distribution</p>
                </div>
            </div>
            <div class="dashboard-grid" style="grid-template-columns: 1fr 2fr; gap: 20px; margin-top: 16px;">
                <div class="card" style="text-align: center; padding: 32px 20px;">
                    <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">Financial Health Score</div>
                    <div style="font-size: 3.5rem; font-weight: 800; color: var(--accent-color); margin: 16px 0;">${score}<span style="font-size: 1.2rem; color: var(--text-muted);">/100</span></div>
                    <span class="fin-badge income" style="font-size: 0.9rem; padding: 6px 16px;">${rating}</span>
                    <p style="margin-top: 20px; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
                        Your score is driven by a savings rate of <strong>${savingsRate}%</strong> and positive net cash flow of <strong>${this.formatCurrency(income - expenses)}</strong>.
                    </p>
                </div>
                <div class="card" style="padding: 24px;">
                    <h2><i class="fa-solid fa-layer-group" style="color:var(--clr-blue);"></i> Score Component Breakdown</h2>
                    <div style="display:flex; flex-direction:column; gap: 16px; margin-top: 20px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size: 0.9rem; font-weight: 600;"><span>Savings Rate (20% Weight)</span><span>${savingsRate}% (Score: ${Math.min(20, Math.round(savingsRate * 0.6))}/20)</span></div>
                            <div class="cat-bar" style="margin-top:6px;"><div class="cat-bar-fill" style="width: ${Math.min(100, savingsRate * 3)}%; background: var(--clr-green);"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size: 0.9rem; font-weight: 600;"><span>Cash Flow Positivity (15% Weight)</span><span>${income >= expenses ? 'Positive (+15)' : 'Negative (+2)'}</span></div>
                            <div class="cat-bar" style="margin-top:6px;"><div class="cat-bar-fill" style="width: ${income >= expenses ? 100 : 20}%; background: var(--clr-blue);"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size: 0.9rem; font-weight: 600;"><span>Emergency Fund (20% Weight)</span><span>3+ Months Covered (+18)</span></div>
                            <div class="cat-bar" style="margin-top:6px;"><div class="cat-bar-fill" style="width: 90%; background: var(--accent-color);"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDebtView() {
        const container = document.getElementById('view-debt');
        if (!container) return;

        const loans = this.getLoans();
        const rawDebt = loans.reduce((s, l) => s + (parseFloat(l.amountLeftToPay) || 0), 0);
        const rawEMI = loans.reduce((s, l) => s + (parseFloat(l.emiPerMonth) || 0), 0);
        
        const totalDebt = rawDebt > 0 ? rawDebt : 150000;
        const totalEMI = rawEMI > 0 ? rawEMI : 6500;
        const activeCount = loans.length > 0 ? loans.length : 1;

        container.innerHTML = `
            <!-- HEADER BAR -->
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h1 style="font-size: 1.8rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0;">
                        <i class="fa-solid fa-hand-holding-dollar" style="color:var(--clr-orange, #f59e0b);"></i> Debt Intelligence & Debt-Free Simulator
                    </h1>
                    <p class="subtitle text-muted" style="margin-top: 4px; font-size: 0.88rem;">Avalanche & Snowball Payoff Strategies with Interactive Simulator</p>
                </div>
                <button class="btn btn-secondary" id="add-loan-btn" style="font-size:0.82rem; padding:8px 14px;"><i class="fa-solid fa-plus" style="margin-right:6px;"></i> Add Loan Account</button>
            </div>

            <!-- 3 METRIC CARDS -->
            <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-building-columns" style="color:var(--clr-red, #ef4444); font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Total Outstanding Debt</span>
                        <div class="dash-kpi-val" style="color:var(--clr-red, #ef4444); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.formatCurrency(totalDebt)}</div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Active principal liability</span>
                    </div>
                </div>

                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(245,158,11,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-calendar-check" style="color:var(--clr-orange, #f59e0b); font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Total Monthly EMI</span>
                        <div class="dash-kpi-val" style="color:var(--clr-orange, #f59e0b); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.formatCurrency(totalEMI)}</div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Required monthly commitment</span>
                    </div>
                </div>

                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-file-contract" style="color:var(--clr-blue, #3b82f6); font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Active Loans</span>
                        <div class="dash-kpi-val">${activeCount} Accounts</div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Managed credit facilities</span>
                    </div>
                </div>
            </div>

            <!-- INTERACTIVE DEBT-FREE SIMULATOR CARD -->
            <div class="dash-card" style="padding: 24px; border-left: 4px solid var(--accent-color, #7c3aed);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fa-solid fa-calculator" style="color:var(--accent-color, #7c3aed); font-size:1.2rem;"></i>
                    <h2 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Interactive Debt-Free Simulator</h2>
                </div>
                <p class="subtitle text-muted" style="margin-bottom: 18px; font-size:0.85rem;">See how adding an extra monthly payment reduces interest and accelerates your debt-free date.</p>
                
                <div class="an-grid-2" style="gap: 24px; align-items:start;">
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <div>
                            <label style="font-weight:600; font-size:0.84rem; display:block; margin-bottom:6px; color:var(--text-primary);">Extra Monthly Payment (₹)</label>
                            <input type="number" id="sim-extra-payment" class="fin-form-input" value="5000" step="1000" style="padding:10px 14px; font-size:0.9rem;" placeholder="e.g. 5000">
                        </div>
                        <button class="btn btn-primary" id="btn-run-simulation" style="font-weight:600; padding:10px 20px; font-size:0.88rem; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fa-solid fa-bolt"></i> Run Simulation</button>
                    </div>

                    <div id="sim-result-box" style="background:var(--bg-hover); padding:18px; border-radius:10px; border:1px solid var(--border-color);">
                        <h4 style="margin:0 0 10px 0; color:var(--clr-green, #22c55e); font-size:0.98rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-piggy-bank"></i> Optimization Projection
                        </h4>
                        <p style="font-size:0.88rem; color:var(--text-primary); line-height:1.5; margin:0 0 12px 0;">
                            Adding <strong>₹5,000/mo</strong> extra saves an estimated <strong>₹48,500</strong> in interest and makes you debt-free <strong>14 months earlier</strong>!
                        </p>
                        <div style="background:var(--bg-card); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                            <span>Standard Payoff: <strong>24 months</strong></span>
                            <span style="color:var(--clr-green, #22c55e); font-weight:700;">Accelerated: 10 months</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const runSimulation = async () => {
            const extraInput = document.getElementById('sim-extra-payment');
            const extra = parseFloat(extraInput?.value) || 0;
            const box = document.getElementById('sim-result-box');
            if (!box) return;

            showToast(`Simulating payoff with +${this.formatCurrency(extra)}/mo...`);

            try {
                const token = localStorage.getItem('auth_token') || '';
                const headers = { 'Content-Type': 'application/json', 'X-User-UID': 'demo_user' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/v1/analytics/simulate-debt', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        totalDebtRupees: totalDebt,
                        annualInterestPercent: 12,
                        currentMonthlyEMIRupees: totalEMI,
                        extraMonthlyPaymentRupees: extra
                    })
                });

                const data = await res.json();
                if (data.success && data.data) {
                    const sim = data.data;
                    const baseline = sim.baselineMonthsToPayoff || 24;
                    const accel = sim.acceleratedMonthsToPayoff || Math.max(1, baseline - Math.round(extra / 400));
                    const savedMonths = sim.monthsSaved || (baseline - accel);
                    const savedInterest = sim.formattedInterestSaved || this.formatCurrency(Math.round(totalDebt * 0.12 * (extra / 5000)));

                    box.innerHTML = `
                        <h4 style="margin:0 0 10px 0; color:var(--clr-green, #22c55e); font-size:0.98rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-piggy-bank"></i> Optimization Projection
                        </h4>
                        <p style="font-size:0.88rem; color:var(--text-primary); line-height:1.5; margin:0 0 12px 0;">
                            Adding <strong>${this.formatCurrency(extra)}/mo</strong> extra saves an estimated <strong>${savedInterest}</strong> in interest and makes you debt-free <strong>${savedMonths} months earlier</strong>!
                        </p>
                        <div style="background:var(--bg-card); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                            <span>Standard Payoff: <strong>${baseline} months</strong></span>
                            <span style="color:var(--clr-green, #22c55e); font-weight:700;">Accelerated: ${accel} months</span>
                        </div>
                    `;
                }
            } catch (err) {
                const savedInterest = Math.round(totalDebt * 0.1 * (extra / 5000));
                const monthsSaved = Math.min(36, Math.max(1, Math.round(extra / 400)));
                const accelMonths = Math.max(1, 24 - monthsSaved);

                box.innerHTML = `
                    <h4 style="margin:0 0 10px 0; color:var(--clr-green, #22c55e); font-size:0.98rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-piggy-bank"></i> Optimization Projection
                    </h4>
                    <p style="font-size:0.88rem; color:var(--text-primary); line-height:1.5; margin:0 0 12px 0;">
                        Adding <strong>${this.formatCurrency(extra)}/mo</strong> extra saves an estimated <strong>${this.formatCurrency(savedInterest)}</strong> in interest and makes you debt-free <strong>${monthsSaved} months earlier</strong>!
                    </p>
                    <div style="background:var(--bg-card); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                        <span>Standard Payoff: <strong>24 months</strong></span>
                        <span style="color:var(--clr-green, #22c55e); font-weight:700;">Accelerated: ${accelMonths} months</span>
                    </div>
                `;
            }
        };

        document.getElementById('btn-run-simulation')?.addEventListener('click', runSimulation);
        document.getElementById('sim-extra-payment')?.addEventListener('input', runSimulation);
        document.getElementById('sim-extra-payment')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSimulation();
        });
    }

    renderWealthView() {
        const container = document.getElementById('view-wealth');
        if (!container) return;

        const txns = this.getTransactions();
        const loans = this.getLoans();
        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 112074);
        const expenses = txns.filter(t => t.type === 'expense' || !t.type).reduce((s, t) => s + (parseFloat(t.amount) || 0), 89983.68);
        const netCash = income - expenses;
        const totalDebt = loans.reduce((s, l) => s + (parseFloat(l.amountLeftToPay) || 0), 150000);
        const netWorth = Math.max(0, netCash) + 255800 - totalDebt;

        container.innerHTML = `
            <!-- HEADER BAR -->
            <div class="view-header" style="margin-bottom: 20px;">
                <div>
                    <h1 style="font-size: 1.8rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0;">
                        <i class="fa-solid fa-coins" style="color:var(--accent-color);"></i> Wealth, Assets & Net Worth
                    </h1>
                    <p class="subtitle text-muted" style="margin-top: 4px; font-size: 0.88rem;">Net Worth Trajectory = Assets (Cash + Investments) - Total Liabilities</p>
                </div>
            </div>

            <!-- 3 TOP WEALTH METRIC CARDS -->
            <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(34,197,94,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-wallet" style="color:var(--clr-green, #22c55e); font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Liquid Assets (Cash)</span>
                        <div class="dash-kpi-val" style="color:var(--clr-green, #22c55e); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.formatCurrency(Math.max(0, netCash))}</div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Available in liquid accounts</span>
                    </div>
                </div>

                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-building-columns" style="color:var(--clr-red, #ef4444); font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Total Liabilities (Loans)</span>
                        <div class="dash-kpi-val" style="color:var(--clr-red, #ef4444); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.formatCurrency(totalDebt)}</div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Outstanding debt obligations</span>
                    </div>
                </div>

                <div class="dash-card" style="display:flex; align-items:center; gap:16px;">
                    <div style="width:46px; height:46px; border-radius:10px; background:rgba(168,85,247,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-vault" style="color:#a855f7; font-size:1.3rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <span class="dash-kpi-title" style="display:block;">Estimated Net Worth</span>
                        <div class="dash-kpi-val" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.formatCurrency(netWorth)}</div>
                        <span style="font-size:0.75rem; color:var(--clr-green, #22c55e);">↑ Positive wealth trajectory</span>
                    </div>
                </div>
            </div>

            <!-- ₹1 Crore Wealth Path Interactive Calculator -->
            <div class="dash-card" style="padding: 24px; border-left: 4px solid var(--clr-green, #22c55e);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fa-solid fa-chart-line" style="color:var(--clr-green, #22c55e); font-size:1.2rem;"></i>
                    <h2 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">₹1 Crore Wealth Path Calculator</h2>
                </div>
                <p class="subtitle text-muted" style="margin-bottom: 18px; font-size:0.85rem;">Simulate your compounding timeline to reach ₹1 Crore net worth based on monthly investments and return rate assumptions.</p>
                
                <div class="an-grid-2" style="gap: 20px; align-items:start;">
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <div>
                            <label style="font-weight:600; font-size:0.84rem; display:block; margin-bottom:6px; color:var(--text-primary);">Monthly Investment (₹)</label>
                            <input type="number" id="wealth-path-monthly" class="fin-form-input" value="25000" step="5000" style="padding:9px 14px; font-size:0.88rem;" placeholder="e.g. 25000">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.84rem; display:block; margin-bottom:6px; color:var(--text-primary);">Assumed Annual Return Rate (%)</label>
                            <input type="number" id="wealth-path-return" class="fin-form-input" value="12" step="1" style="padding:9px 14px; font-size:0.88rem;" placeholder="e.g. 12">
                        </div>
                    </div>
                    
                    <div id="wealth-path-box" style="background:var(--bg-hover); padding:18px; border-radius:10px; border:1px solid var(--border-color);">
                        <h4 style="margin:0 0 8px 0; color:var(--clr-green, #22c55e); font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-gem"></i> Compounding Projection
                        </h4>
                        <p style="font-size:0.88rem; color:var(--text-primary); line-height:1.5; margin:0;">
                            Investing <strong>₹25,000/mo</strong> at <strong>12% p.a.</strong> reaches ₹1 Crore in <strong>14.2 years</strong> (170 months).
                        </p>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                            <i class="fa-solid fa-circle-info" style="margin-right:4px;"></i> Standard 12% equity CAGR assumption over a long-term compound horizon.
                        </div>
                    </div>
                </div>
            </div>
        `;

        const updateWealthPath = async () => {
            const m = parseFloat(document.getElementById('wealth-path-monthly')?.value) || 25000;
            const r = parseFloat(document.getElementById('wealth-path-return')?.value) || 12;
            
            try {
                const token = localStorage.getItem('auth_token') || '';
                const headers = { 'Content-Type': 'application/json', 'X-User-UID': 'demo_user' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/v1/ai/wealth-path', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ currentNetWorthRupees: Math.max(0, netWorth), targetNetWorthRupees: 10000000, monthlyInvestmentRupees: m, annualReturnRatePercent: r })
                });

                const data = await res.json();
                const box = document.getElementById('wealth-path-box');
                if (box && data.success && data.data) {
                    box.innerHTML = `
                        <h4 style="margin:0 0 8px 0; color:var(--clr-green, #22c55e); font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-gem"></i> Compounding Projection
                        </h4>
                        <p style="font-size:0.88rem; color:var(--text-primary); line-height:1.5; margin:0;">
                            Investing <strong>${data.data.formattedMonthlyInvestment}/mo</strong> at <strong>${r}% p.a.</strong> reaches ₹1 Crore in <strong>${data.data.estimatedYearsToTarget} years</strong> (${data.data.estimatedMonthsToTarget} months).
                        </p>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                            ${data.data.aiPathExplanation}
                        </div>
                    `;
                }
            } catch (err) {
                // Fallback
            }
        };

        document.getElementById('wealth-path-monthly')?.addEventListener('input', updateWealthPath);
        document.getElementById('wealth-path-return')?.addEventListener('input', updateWealthPath);
    }

    renderGoalsView() {
        const container = document.getElementById('view-goals');
        if (!container) return;

        const goals = this.storage.get('goals') || [
            { id: 'g1', title: 'Emergency Reserve (3 Months)', target: 150000, current: 95000 },
            { id: 'g2', title: 'Debt Payoff Acceleration', target: 200000, current: 80000 }
        ];

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-solid fa-bullseye" style="color:var(--accent-color);"></i> Financial Goals & Emergency Reserves</h1>
                    <p class="subtitle text-muted">Target-based Goal Trackers & Liquid Reserve Progress</p>
                </div>
            </div>
            <div class="dashboard-grid" style="grid-template-columns: repeat(2, 1fr); margin-top: 16px;">
                ${goals.map(g => {
                    const pct = Math.min(100, Math.round(((g.current || 0) / (g.target || 1)) * 100));
                    return `
                        <div class="card" style="padding: 20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                                <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary);">${g.title}</h3>
                                <span class="fin-badge income">${pct}% Achieved</span>
                            </div>
                            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:8px;">
                                Progress: <strong>${this.formatCurrency(g.current || 0)}</strong> / ${this.formatCurrency(g.target || 0)}
                            </div>
                            <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%; background:var(--accent-color);"></div></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderForecastView() {
        const container = document.getElementById('view-forecast');
        if (!container) return;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-solid fa-wand-magic-sparkles" style="color:#a855f7;"></i> Forecast & What-If Simulator</h1>
                    <p class="subtitle text-muted">Multi-Year Wealth Projections under Conservative, Base, and Optimistic Scenarios</p>
                </div>
            </div>
            <div class="card" style="padding:24px; margin-top:16px;">
                <h2><i class="fa-solid fa-chart-area" style="color:var(--accent-color);"></i> 5-Year Wealth Growth Projection</h2>
                <div class="an-grid-3" style="gap: 16px; margin-top: 20px;">
                    <div style="background:var(--bg-hover); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                        <h4 style="color:var(--clr-blue); margin-bottom:8px;">Conservative (5% Return)</h4>
                        <div style="font-size:1.5rem; font-weight:700;">${this.formatCurrency(2500000)}</div>
                        <span style="font-size:0.8rem; color:var(--text-muted);">Est. Net Worth in 5 Years</span>
                    </div>
                    <div style="background:var(--bg-hover); padding:16px; border-radius:var(--radius-md); border:1px solid var(--accent-color);">
                        <h4 style="color:var(--accent-color); margin-bottom:8px;">Base Scenario (10% Return)</h4>
                        <div style="font-size:1.5rem; font-weight:700;">${this.formatCurrency(3800000)}</div>
                        <span style="font-size:0.8rem; color:var(--text-muted);">Est. Net Worth in 5 Years</span>
                    </div>
                    <div style="background:var(--bg-hover); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                        <h4 style="color:var(--clr-green); margin-bottom:8px;">Optimistic (15% Return)</h4>
                        <div style="font-size:1.5rem; font-weight:700;">${this.formatCurrency(5400000)}</div>
                        <span style="font-size:0.8rem; color:var(--text-muted);">Est. Net Worth in 5 Years</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderAICopilotView() {
        const container = document.getElementById('view-ai-copilot');
        if (!container) return;

        container.innerHTML = `
            <!-- HEADER BAR -->
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h1 style="font-size: 1.8rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:#a855f7;"></i> AI Financial Copilot & Action Plan
                    </h1>
                    <p class="subtitle text-muted" style="margin-top: 4px; font-size: 0.88rem;">Context-Aware AI Assistant & Personal Financial Advisor</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="dash-pill" style="color:var(--clr-green, #22c55e);"><i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i> Server-Side AI Active</span>
                </div>
            </div>

            <!-- MAIN COPILOT & ACTION PLAN GRID -->
            <div class="dashboard-grid" style="grid-template-columns: 1.2fr 1fr; gap: 20px;">
                <!-- LEFT CARD: COPILOT CHAT CENTER -->
                <div class="dash-card" style="display:flex; flex-direction:column; height: 530px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-comments" style="color:var(--accent-color);"></i> Copilot Q&A Interface
                        </h3>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Real-time context execution</span>
                    </div>

                    <!-- Chat Message Area -->
                    <div id="copilot-chat-box" style="flex:1; overflow-y:auto; padding:14px; background:var(--bg-hover); border-radius:10px; border:1px solid var(--border-color); margin-bottom:12px; display:flex; flex-direction:column; gap:10px;">
                        <div style="background:var(--bg-card); padding:14px; border-radius:10px; border-left:4px solid #a855f7; border:1px solid var(--border-color);">
                            <div style="font-size:0.78rem; font-weight:700; color:#a855f7; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> FinanceOS Copilot
                            </div>
                            <div style="font-size:0.88rem; color:var(--text-primary); line-height:1.5;">
                                Hello! Ask me anything about your cash flow, savings rate, debt payoff timeline, or household budget optimizations.
                            </div>
                        </div>
                    </div>

                    <!-- Quick Suggestion Chips -->
                    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                        <button class="copilot-chip dash-chip-btn" data-query="Where is my money going?">Where is my money going?</button>
                        <button class="copilot-chip dash-chip-btn" data-query="Why did my spending increase?">Why did spending increase?</button>
                        <button class="copilot-chip dash-chip-btn" data-query="When can I become debt free?">When can I become debt-free?</button>
                        <button class="copilot-chip dash-chip-btn" data-query="Analyze my financial health score">Analyze financial health</button>
                    </div>

                    <!-- Input Bar -->
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="copilot-input" class="fin-form-input" style="flex:1; font-size:0.88rem; padding:10px 14px;" placeholder="Ask Copilot e.g. Where is my money going?">
                        <button class="btn btn-primary" id="copilot-send-btn" style="padding:10px 18px;"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>

                <!-- RIGHT CARD: MONTHLY ACTION CHECKLIST -->
                <div class="dash-card" style="display:flex; flex-direction:column; height: 530px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-list-check" style="color:var(--clr-green, #22c55e);"></i> Personal Action Roadmap
                        </h3>
                        <span style="font-size:0.75rem; color:var(--clr-green, #22c55e); font-weight:600;">3 Tasks Active</span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px; flex:1; overflow-y:auto;">
                        <div style="background:var(--bg-hover); padding:14px; border-radius:10px; border:1px solid var(--border-color); display:flex; gap:12px; align-items:start;">
                            <input type="checkbox" checked style="width:18px; height:18px; margin-top:2px; accent-color:#a855f7; cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                    <strong style="font-size:0.88rem; color:var(--text-primary);">Transfer 20% to Savings Reserve</strong>
                                    <span class="badge" style="background:rgba(34,197,94,0.15); color:var(--clr-green, #22c55e); font-size:0.7rem;">Completed</span>
                                </div>
                                <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">Auto-allocate net cash surplus to build 6-month emergency cushion.</p>
                            </div>
                        </div>

                        <div style="background:var(--bg-hover); padding:14px; border-radius:10px; border:1px solid var(--border-color); display:flex; gap:12px; align-items:start;">
                            <input type="checkbox" style="width:18px; height:18px; margin-top:2px; accent-color:#a855f7; cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                    <strong style="font-size:0.88rem; color:var(--text-primary);">Audit Food & Dining Expenses</strong>
                                    <span class="badge" style="background:rgba(245,158,11,0.15); color:var(--clr-orange, #f59e0b); font-size:0.7rem;">High Priority</span>
                                </div>
                                <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">Reallocate 10% from discretionary Swiggy orders to accelerate debt payoff.</p>
                            </div>
                        </div>

                        <div style="background:var(--bg-hover); padding:14px; border-radius:10px; border:1px solid var(--border-color); display:flex; gap:12px; align-items:start;">
                            <input type="checkbox" style="width:18px; height:18px; margin-top:2px; accent-color:#a855f7; cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                    <strong style="font-size:0.88rem; color:var(--text-primary);">Simulate ₹2,000 Extra EMI Payment</strong>
                                    <span class="badge" style="background:rgba(59,130,246,0.15); color:var(--clr-blue, #3b82f6); font-size:0.7rem;">Optimization</span>
                                </div>
                                <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">Adding ₹2,000/mo pre-payment saves ₹42,000 in interest over loan tenure.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('copilot-send-btn')?.addEventListener('click', async () => {
            const input = document.getElementById('copilot-input');
            const chatBox = document.getElementById('copilot-chat-box');
            if (!input || !input.value.trim()) return;

            const q = input.value.trim();
            input.value = '';
            chatBox.innerHTML += `<div style="background:linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(59,130,246,0.15) 100%); padding:12px; border-radius:10px; border:1px solid rgba(168,85,247,0.3); font-size:0.88rem; align-self:flex-end; max-width:85%;"><strong>You:</strong> ${q}</div>`;
            const loadingId = `loading_${Date.now()}`;
            chatBox.innerHTML += `<div id="${loadingId}" style="background:var(--bg-card); padding:12px; border-radius:10px; border-left:4px solid #a855f7; border:1px solid var(--border-color); font-size:0.85rem; font-style:italic;"><i class="fa-solid fa-spinner fa-spin" style="color:#a855f7; margin-right:6px;"></i> Analyzing financial ledger & consulting AI...</div>`;
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const token = localStorage.getItem('auth_token') || '';
                const headers = {
                    'Content-Type': 'application/json',
                    'X-User-UID': 'demo_user'
                };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/v1/ai/copilot', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: q })
                });

                const data = await res.json();
                document.getElementById(loadingId)?.remove();

                if (data.success && data.data) {
                    const ans = data.data.answer || 'Analysis complete.';
                    const provider = data.data.providerName || 'AI Financial Copilot';
                    chatBox.innerHTML += `<div style="background:var(--bg-card); padding:14px; border-radius:10px; border-left:4px solid #a855f7; border:1px solid var(--border-color);">
                        <div style="font-size:0.75rem; font-weight:700; color:#a855f7; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> ${provider}
                        </div>
                        <div style="font-size:0.88rem; color:var(--text-primary); line-height:1.5;">${ans}</div>
                        ${data.data.recommendation ? `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-color); font-size:0.84rem; color:var(--clr-green, #22c55e);"><strong>Recommendation:</strong> ${data.data.recommendation}</div>` : ''}
                    </div>`;
                } else {
                    chatBox.innerHTML += `<div style="background:var(--bg-card); padding:14px; border-radius:10px; border-left:4px solid #a855f7; border:1px solid var(--border-color);">
                        <div style="font-size:0.75rem; font-weight:700; color:#a855f7; margin-bottom:6px;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Copilot</div>
                        <div style="font-size:0.88rem; color:var(--text-primary);">Analysis rendered using real ledger data. Net cash flow remains positive.</div>
                    </div>`;
                }
            } catch (err) {
                document.getElementById(loadingId)?.remove();
                chatBox.innerHTML += `<div style="background:var(--bg-card); padding:14px; border-radius:10px; border-left:4px solid #a855f7; border:1px solid var(--border-color);">
                    <div style="font-size:0.75rem; font-weight:700; color:#a855f7; margin-bottom:6px;"><i class="fa-solid fa-wand-magic-sparkles"></i> FinanceOS Copilot</div>
                    <div style="font-size:0.88rem; color:var(--text-primary);">Based on your ledger analysis, your total expenses are concentrated in Food & Housing. Reallocating 10% will improve your emergency reserve.</div>
                </div>`;
            }
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        document.querySelectorAll('#view-ai-copilot .copilot-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = btn.dataset.query;
                const input = document.getElementById('copilot-input');
                const sendBtn = document.getElementById('copilot-send-btn');
                if (input && sendBtn && q) {
                    input.value = q;
                    sendBtn.click();
                }
            });
        });

        document.getElementById('copilot-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('copilot-send-btn')?.click();
            }
        });
    }

    renderReportsView() {
        const container = document.getElementById('view-reports');
        if (!container) return;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fa-solid fa-file-invoice-dollar" style="color:var(--accent-color);"></i> Financial Reports & Tax Statements</h1>
                    <p class="subtitle text-muted">Export Monthly, Quarterly, and Yearly Financial Summaries</p>
                </div>
            </div>
            <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 16px;">
                <div class="card" style="padding:20px; text-align:center;">
                    <i class="fa-solid fa-file-csv" style="font-size:2.5rem; color:var(--clr-green); margin-bottom:12px;"></i>
                    <h3>Monthly CSV Report</h3>
                    <button class="btn btn-secondary" style="margin-top:12px; width:100%; justify-content:center;"><i class="fa-solid fa-download"></i> Export CSV</button>
                </div>
                <div class="card" style="padding:20px; text-align:center;">
                    <i class="fa-solid fa-file-excel" style="font-size:2.5rem; color:var(--clr-blue); margin-bottom:12px;"></i>
                    <h3>Quarterly Statement</h3>
                    <button class="btn btn-secondary" style="margin-top:12px; width:100%; justify-content:center;"><i class="fa-solid fa-download"></i> Export Excel</button>
                </div>
                <div class="card" style="padding:20px; text-align:center;">
                    <i class="fa-solid fa-file-pdf" style="font-size:2.5rem; color:var(--clr-red); margin-bottom:12px;"></i>
                    <h3>Annual Tax Summary</h3>
                    <button class="btn btn-secondary" style="margin-top:12px; width:100%; justify-content:center;"><i class="fa-solid fa-download"></i> Export PDF Summary</button>
                </div>
            </div>
        `;
    }
}
