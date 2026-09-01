// js/analytics.js
import { showToast } from './toast.js';
import { showFormModal } from './modal.js';
import { FinancialAnalyticsEngine, formatINR } from './analytics-calc.js';

export class AnalyticsManager {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        this.chartInstance = null;
        
        this.timeframe = '30d'; // 7d, 30d, 3m, 6m, 1y, custom, all
        this.familyMember = sessionStorage.getItem('prodos_active_family_member') || 'All';
        if (this.familyMember === 'Main') this.familyMember = 'All';
        
        this.customStart = null;
        this.customEnd = null;
        this.selectedCategory = 'All';
        this.selectedType = 'All';
    }

    init() {
        this.injectStyles();
        this.render();
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'analytics-styles';
        style.textContent = `
            .an-container { display: flex; flex-direction: column; gap: var(--spacing-5); }
            
            /* Top Controls Bar */
            .an-controls-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--spacing-3); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 20px; }
            .an-controls-group { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-3); }
            .an-control-label { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
            
            .an-pill-toggle { display: inline-flex; background: rgba(15, 23, 42, 0.85); padding: 4px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.15); gap: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
            .an-pill-btn { padding: 6px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 700; font-size: 0.82rem; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: transparent; color: #cbd5e1; }
            .an-pill-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.08); }
            .an-pill-btn.active { background: var(--accent-color); color: #000000; font-weight: 800; box-shadow: 0 2px 10px rgba(199, 255, 46, 0.4); }
            
            .an-select { padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.85rem; font-weight: 500; outline: none; }
            .an-select:focus { border-color: var(--accent-color); }
            
            /* Financial Summary KPIs */
            .an-summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--spacing-3); }
            .an-summary-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
            .an-summary-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .an-summary-header { display: flex; justify-content: space-between; align-items: center; }
            .an-summary-header h4 { font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
            .an-summary-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
            .an-summary-icon.green { background: rgba(67,160,71,0.12); color: var(--clr-green); }
            .an-summary-icon.red { background: rgba(229,57,53,0.12); color: var(--clr-red); }
            .an-summary-icon.blue { background: rgba(35,131,226,0.12); color: var(--clr-blue); }
            .an-summary-icon.purple { background: rgba(156,39,176,0.12); color: #ab47bc; }
            .an-summary-icon.orange { background: rgba(244,81,30,0.12); color: var(--clr-orange); }
            .an-summary-val { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-primary); }
            .an-summary-val.positive { color: var(--clr-green); }
            .an-summary-val.negative { color: var(--clr-red); }
            
            /* Main Chart Panel */
            .an-chart-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-4); }
            .an-chart-container { position: relative; width: 100%; height: 320px; margin-top: 16px; }
            
            /* Grid layouts */
            .an-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); }
            .an-grid-3 { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: var(--spacing-4); }
            
            /* Month Comparison */
            .an-comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-3); margin-top: 12px; }
            .an-comp-box { background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; text-align: center; }
            .an-comp-title { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
            .an-comp-val { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
            .an-badge-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
            .an-badge-pill.up { background: rgba(67,160,71,0.15); color: var(--clr-green); }
            .an-badge-pill.down { background: rgba(229,57,53,0.15); color: var(--clr-red); }
            
            /* Ranked Spending List */
            .an-rank-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
            .an-rank-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-light); }
            .an-rank-num { font-weight: 800; font-size: 0.85rem; color: var(--accent-color); width: 28px; }
            .an-rank-name { font-weight: 600; font-size: 0.9rem; flex: 1; color: var(--text-primary); }
            .an-rank-meta { text-align: right; }
            .an-rank-amt { font-weight: 700; font-size: 0.92rem; color: var(--text-primary); }
            .an-rank-pct { font-size: 0.75rem; color: var(--text-muted); }

            /* Insights List */
            .an-insight-card { display: flex; align-items: flex-start; gap: 14px; padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-hover); margin-bottom: 10px; }
            .an-insight-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1rem; }
            .an-insight-card.success .an-insight-icon { background: rgba(67,160,71,0.15); color: var(--clr-green); }
            .an-insight-card.warning .an-insight-icon { background: rgba(244,81,30,0.15); color: var(--clr-orange); }
            .an-insight-card.danger .an-insight-icon { background: rgba(229,57,53,0.15); color: var(--clr-red); }
            .an-insight-card.info .an-insight-icon { background: rgba(35,131,226,0.15); color: var(--clr-blue); }
            .an-insight-title { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px; }
            .an-insight-msg { font-size: 0.83rem; color: var(--text-secondary); line-height: 1.4; }

            /* Empty state */
            .an-empty-state { text-align: center; padding: 48px 24px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); }
            .an-empty-icon { font-size: 3rem; color: var(--text-muted); margin-bottom: 16px; }
            .an-empty-title { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
            .an-empty-desc { font-size: 0.9rem; color: var(--text-muted); max-width: 440px; margin: 0 auto 24px; line-height: 1.5; }
            
            @media (max-width: 1200px) {
                .an-summary-grid { grid-template-columns: repeat(3, 1fr); }
                .an-grid-3 { grid-template-columns: 1fr; }
            }
            @media (max-width: 900px) {
                .an-summary-grid { grid-template-columns: repeat(2, 1fr); }
                .an-grid-2 { grid-template-columns: 1fr; }
            }
            @media (max-width: 600px) {
                .an-summary-grid { grid-template-columns: 1fr; }
                .an-controls-bar { flex-direction: column; align-items: stretch; }
                .an-comp-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        const container = document.getElementById('view-analytics');
        if (!container) return;

        const allTxns = this.storage.get('transactions') || [];
        const allLoans = this.storage.get('loans') || [];
        const userBudgets = this.storage.get('user_budgets') || {};

        // Family members list
        let familyMembers = [];
        try {
            const familyData = JSON.parse(localStorage.getItem('prodos_family_data'));
            if (familyData && Array.isArray(familyData.members)) {
                familyMembers = familyData.members.map(m => m.name);
            }
        } catch (e) {}

        // Filtered transactions for current view
        const txns = FinancialAnalyticsEngine.filterTransactions(allTxns, {
            timeframe: this.timeframe,
            customStart: this.customStart,
            customEnd: this.customEnd,
            familyMember: this.familyMember,
            category: this.selectedCategory,
            type: this.selectedType
        });

        // 1. Financial Summary Numbers
        const totalIncome = FinancialAnalyticsEngine.calculateTotalIncome(txns);
        const totalExpenses = FinancialAnalyticsEngine.calculateTotalExpenses(txns);
        const netSavings = FinancialAnalyticsEngine.calculateNetSavings(totalIncome, totalExpenses);
        const savingsRate = FinancialAnalyticsEngine.calculateSavingsRate(totalIncome, totalExpenses);
        const loanMetrics = FinancialAnalyticsEngine.calculateLoanMetrics(allLoans, this.familyMember, totalIncome);

        // 2. Additional calculations
        const timeSeriesData = FinancialAnalyticsEngine.calculateTimeSeriesData(allTxns, this.timeframe, this.customStart, this.customEnd);
        const categoryBreakdown = FinancialAnalyticsEngine.calculateCategoryBreakdown(txns);
        const monthlyComparison = FinancialAnalyticsEngine.calculateMonthlyComparison(allTxns, this.familyMember);
        const insights = FinancialAnalyticsEngine.generateFinancialInsights(allTxns, allLoans, this.familyMember);
        const budgetAnalysis = FinancialAnalyticsEngine.calculateBudgetAnalysis(txns, userBudgets);

        const isEmpty = (txns.length === 0);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Financial Analytics</h1>
                    <p class="subtitle text-muted">Comprehensive income, expense, savings & debt intelligence</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary" id="an-btn-add-income"><i class="fa-solid fa-arrow-down" style="color:var(--clr-green)"></i> + Income</button>
                    <button class="btn btn-secondary" id="an-btn-add-expense"><i class="fa-solid fa-arrow-up" style="color:var(--clr-red)"></i> + Expense</button>
                    <button class="btn btn-primary" id="an-btn-add-loan"><i class="fa-solid fa-building-columns"></i> + Loan</button>
                </div>
            </div>

            <div class="an-container">
                <!-- Controls Bar -->
                <div class="an-controls-bar">
                    <div class="an-controls-group">
                        <span class="an-control-label">Period:</span>
                        <div class="an-pill-toggle" id="an-timeframe-toggle">
                            <button class="an-pill-btn ${this.timeframe === '7d' ? 'active' : ''}" data-time="7d">7 Days</button>
                            <button class="an-pill-btn ${this.timeframe === '30d' ? 'active' : ''}" data-time="30d">30 Days</button>
                            <button class="an-pill-btn ${this.timeframe === '3m' ? 'active' : ''}" data-time="3m">3 Months</button>
                            <button class="an-pill-btn ${this.timeframe === '6m' ? 'active' : ''}" data-time="6m">6 Months</button>
                            <button class="an-pill-btn ${this.timeframe === '1y' ? 'active' : ''}" data-time="1y">1 Year</button>
                            <button class="an-pill-btn ${this.timeframe === 'custom' ? 'active' : ''}" data-time="custom">Custom</button>
                        </div>
                        
                        ${this.timeframe === 'custom' ? `
                            <div style="display:flex; gap:6px; align-items:center;">
                                <input type="date" id="an-custom-start" class="an-select" value="${this.customStart || ''}">
                                <span style="font-size:0.8rem; color:var(--text-muted)">to</span>
                                <input type="date" id="an-custom-end" class="an-select" value="${this.customEnd || ''}">
                                <button class="btn btn-secondary" id="an-apply-custom" style="padding:6px 12px; font-size:0.8rem;">Apply</button>
                            </div>
                        ` : ''}
                    </div>

                    <div class="an-controls-group">
                        <span class="an-control-label">Family Context:</span>
                        <select class="an-select" id="an-family-select">
                            <option value="All" ${this.familyMember === 'All' ? 'selected' : ''}>All Members (Combined)</option>
                            ${familyMembers.map(m => `<option value="${m}" ${this.familyMember === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                </div>

                ${isEmpty ? `
                    <!-- Empty State -->
                    <div class="an-empty-state">
                        <div class="an-empty-icon"><i class="fa-solid fa-chart-line"></i></div>
                        <div class="an-empty-title">No Financial Data Found</div>
                        <div class="an-empty-desc">Your financial analytics and trends will appear here once you add some income, expense, or loan transactions.</div>
                        <div style="display:flex; gap:12px; justify-content:center;">
                            <button class="btn btn-secondary" id="an-empty-add-income"><i class="fa-solid fa-plus"></i> Add Income</button>
                            <button class="btn btn-primary" id="an-empty-add-expense"><i class="fa-solid fa-plus"></i> Add Expense</button>
                            <button class="btn btn-secondary" id="an-empty-add-loan"><i class="fa-solid fa-building-columns"></i> Add Loan</button>
                        </div>
                    </div>
                ` : `
                    <!-- 1. Financial Summary Row -->
                    <div class="an-summary-grid">
                        <div class="an-summary-card">
                            <div class="an-summary-header">
                                <h4>Total Income</h4>
                                <div class="an-summary-icon green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            </div>
                            <div class="an-summary-val positive">${formatINR(totalIncome)}</div>
                        </div>

                        <div class="an-summary-card">
                            <div class="an-summary-header">
                                <h4>Total Expenses</h4>
                                <div class="an-summary-icon red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                            </div>
                            <div class="an-summary-val negative">${formatINR(totalExpenses)}</div>
                        </div>

                        <div class="an-summary-card">
                            <div class="an-summary-header">
                                <h4>Net Savings</h4>
                                <div class="an-summary-icon blue"><i class="fa-solid fa-wallet"></i></div>
                            </div>
                            <div class="an-summary-val ${netSavings >= 0 ? 'positive' : 'negative'}">${formatINR(netSavings)}</div>
                        </div>

                        <div class="an-summary-card">
                            <div class="an-summary-header">
                                <h4>Savings Rate</h4>
                                <div class="an-summary-icon purple"><i class="fa-solid fa-piggy-bank"></i></div>
                            </div>
                            <div class="an-summary-val">${savingsRate}%</div>
                        </div>

                        <div class="an-summary-card">
                            <div class="an-summary-header">
                                <h4>Monthly EMI</h4>
                                <div class="an-summary-icon orange"><i class="fa-solid fa-building-columns"></i></div>
                            </div>
                            <div class="an-summary-val">${formatINR(loanMetrics.monthlyEMI)}</div>
                        </div>
                    </div>

                    <!-- 2. Primary Interactive Graph: Income vs Expenses -->
                    <div class="an-chart-card">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h2 style="margin:0; font-size:1.15rem; font-weight:700;"><i class="fa-solid fa-chart-area" style="color:var(--accent-color)"></i> Income vs Expenses Trend</h2>
                                <p style="margin:2px 0 0; font-size:0.82rem; color:var(--text-muted)">Real-time financial flow comparison over selected timeframe</p>
                            </div>
                            <div style="display:flex; gap:16px; font-size:0.82rem; font-weight:600;">
                                <span style="display:flex; align-items:center; gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#43a047"></span> Income</span>
                                <span style="display:flex; align-items:center; gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#e53935"></span> Expenses</span>
                                <span style="display:flex; align-items:center; gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#2383e2"></span> Net Savings</span>
                            </div>
                        </div>

                        <div class="an-chart-container">
                            <canvas id="financialAnalyticsChart"></canvas>
                        </div>

                        <!-- Accessible Screen Reader Data Summary Table -->
                        <details style="margin-top:16px;">
                            <summary style="font-size:0.8rem; color:var(--text-muted); cursor:pointer;">View Accessible Table Data Summary</summary>
                            <table style="width:100%; margin-top:8px; font-size:0.85rem; border-collapse:collapse;">
                                <thead>
                                    <tr style="border-bottom:1px solid var(--border-color); text-align:left;">
                                        <th style="padding:6px;">Period</th>
                                        <th style="padding:6px;">Income</th>
                                        <th style="padding:6px;">Expenses</th>
                                        <th style="padding:6px;">Net Savings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${timeSeriesData.map(b => `
                                        <tr style="border-bottom:1px solid var(--border-light);">
                                            <td style="padding:6px;">${b.label}</td>
                                            <td style="padding:6px; color:var(--clr-green);">${formatINR(b.income)}</td>
                                            <td style="padding:6px; color:var(--clr-red);">${formatINR(b.expenses)}</td>
                                            <td style="padding:6px; font-weight:600;">${formatINR(b.netSavings)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </details>
                    </div>

                    <!-- 3. Middle Section: Month-to-Month Comparison + Top Spending Categories + Financial Insights -->
                    <div class="an-grid-3">
                        <!-- Month-to-Month Comparison -->
                        <div class="card">
                            <div class="card-header">
                                <h2><i class="fa-solid fa-code-compare"></i> Month-to-Month Comparison</h2>
                            </div>
                            <div class="card-body">
                                <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">Current Month vs Previous Month performance</p>
                                
                                <div class="an-comp-grid">
                                    <div class="an-comp-box">
                                        <div class="an-comp-title">Income</div>
                                        <div class="an-comp-val">${formatINR(monthlyComparison.currIncome)}</div>
                                        <span class="an-badge-pill ${monthlyComparison.incomeChangePct >= 0 ? 'up' : 'down'}">
                                            <i class="fa-solid ${monthlyComparison.incomeChangePct >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                                            ${monthlyComparison.incomeChangePct >= 0 ? '+' : ''}${monthlyComparison.incomeChangePct}%
                                        </span>
                                    </div>

                                    <div class="an-comp-box">
                                        <div class="an-comp-title">Expenses</div>
                                        <div class="an-comp-val">${formatINR(monthlyComparison.currExpenses)}</div>
                                        <span class="an-badge-pill ${monthlyComparison.expenseChangePct <= 0 ? 'up' : 'down'}">
                                            <i class="fa-solid ${monthlyComparison.expenseChangePct > 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                                            ${monthlyComparison.expenseChangePct >= 0 ? '+' : ''}${monthlyComparison.expenseChangePct}%
                                        </span>
                                    </div>

                                    <div class="an-comp-box">
                                        <div class="an-comp-title">Savings</div>
                                        <div class="an-comp-val">${formatINR(monthlyComparison.currSavings)}</div>
                                        <span class="an-badge-pill ${monthlyComparison.savingsChangePct >= 0 ? 'up' : 'down'}">
                                            <i class="fa-solid ${monthlyComparison.savingsChangePct >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                                            ${monthlyComparison.savingsChangePct >= 0 ? '+' : ''}${monthlyComparison.savingsChangePct}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Top Spending Categories ("Where Your Money Goes") -->
                        <div class="card">
                            <div class="card-header">
                                <h2><i class="fa-solid fa-pie-chart"></i> Where Money Goes</h2>
                            </div>
                            <div class="card-body">
                                <div class="an-rank-list">
                                    ${categoryBreakdown.length > 0 ? categoryBreakdown.slice(0, 4).map((cat, idx) => `
                                        <div class="an-rank-item">
                                            <span class="an-rank-num">0${idx + 1}</span>
                                            <span class="an-rank-name">${cat.category}</span>
                                            <div class="an-rank-meta">
                                                <div class="an-rank-amt">${formatINR(cat.amount)}</div>
                                                <div class="an-rank-pct">${cat.percentage}%</div>
                                            </div>
                                        </div>
                                    `).join('') : '<div style="text-align:center;color:var(--text-muted);padding:16px;">No expense categories recorded yet.</div>'}
                                </div>
                            </div>
                        </div>

                        <!-- Financial Insights Engine -->
                        <div class="card">
                            <div class="card-header">
                                <h2><i class="fa-solid fa-lightbulb"></i> Financial Insights</h2>
                            </div>
                            <div class="card-body">
                                ${insights.map(ins => `
                                    <div class="an-insight-card ${ins.type}">
                                        <div class="an-insight-icon"><i class="${ins.icon}"></i></div>
                                        <div>
                                            <div class="an-insight-title">${ins.title}</div>
                                            <div class="an-insight-msg">${ins.message}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- 4. Bottom Section: Budget Analysis & Loan Impact Analysis -->
                    <div class="an-grid-2">
                        <!-- Budget Analysis -->
                        <div class="card">
                            <div class="card-header">
                                <h2><i class="fa-solid fa-bullseye"></i> Budget Performance & Analysis</h2>
                            </div>
                            <div class="card-body">
                                <div style="display:flex; flex-direction:column; gap:12px;">
                                    ${budgetAnalysis.length > 0 ? budgetAnalysis.slice(0, 5).map(b => `
                                        <div>
                                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                                                <span style="font-weight:600; color:var(--text-primary);">${b.category}</span>
                                                <span style="color:var(--text-muted);">
                                                    ${formatINR(b.spent)} / ${formatINR(b.budget)} 
                                                    (${b.pctUsed}%)
                                                    ${b.isOver ? `<span style="color:var(--clr-red); font-weight:700; margin-left:6px;">Over by ${formatINR(b.overAmount)}</span>` : ''}
                                                </span>
                                            </div>
                                            <div style="height:8px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                                                <div style="height:100%; width:${Math.min(100, b.pctUsed)}%; background:${b.isOver ? 'var(--clr-red)' : 'var(--accent-color)'}; border-radius:4px; transition:width 0.4s ease;"></div>
                                            </div>
                                        </div>
                                    `).join('') : '<div style="text-align:center;color:var(--text-muted);padding:16px;">No category budgets active.</div>'}
                                </div>
                            </div>
                        </div>

                        <!-- Loan Impact Analysis -->
                        <div class="card">
                            <div class="card-header">
                                <h2><i class="fa-solid fa-building-columns"></i> Loan & Liability Impact</h2>
                            </div>
                            <div class="card-body">
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">
                                    <div style="background:var(--bg-input); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Outstanding Debt</div>
                                        <div style="font-size:1.15rem; font-weight:700; color:var(--clr-orange); margin-top:2px;">${formatINR(loanMetrics.totalOutstanding)}</div>
                                    </div>

                                    <div style="background:var(--bg-input); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">EMI-to-Income Ratio</div>
                                        <div style="font-size:1.15rem; font-weight:700; color:${loanMetrics.emiRatio > 35 ? 'var(--clr-red)' : 'var(--text-primary)'}; margin-top:2px;">${loanMetrics.emiRatio}%</div>
                                    </div>
                                </div>

                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                                        <span style="font-weight:600; color:var(--text-primary);">Overall Debt Repayment Progress</span>
                                        <span style="color:var(--text-muted);">${loanMetrics.repaymentProgress}% Repaid</span>
                                    </div>
                                    <div style="height:8px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                                        <div style="height:100%; width:${loanMetrics.repaymentProgress}%; background:var(--clr-green); border-radius:4px; transition:width 0.4s ease;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `}
            </div>
        `;

        this.bindEvents();
        if (!isEmpty) {
            this.renderChart(timeSeriesData);
        }
    }

    renderChart(timeSeriesData) {
        const ctx = document.getElementById('financialAnalyticsChart');
        if (!ctx) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const labels = timeSeriesData.map(d => d.label);
        const incomeData = timeSeriesData.map(d => d.income);
        const expenseData = timeSeriesData.map(d => d.expenses);
        const savingsData = timeSeriesData.map(d => d.netSavings);

        if (window.Chart) {
            Chart.defaults.color = '#ffffff';
            Chart.defaults.font.family = 'Inter';

            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Income',
                            data: incomeData,
                            borderColor: '#43a047',
                            backgroundColor: 'rgba(67, 160, 71, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35
                        },
                        {
                            label: 'Expenses',
                            data: expenseData,
                            borderColor: '#e53935',
                            backgroundColor: 'rgba(229, 57, 53, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35
                        },
                        {
                            label: 'Net Savings',
                            data: savingsData,
                            borderColor: '#2383e2',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            tension: 0.35
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const val = context.parsed.y;
                                    return `${context.dataset.label}: ${formatINR(val)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.12)' },
                            ticks: {
                                color: '#ffffff',
                                font: { weight: '600', size: 11 },
                                callback: (val) => formatINR(val)
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#ffffff',
                                font: { weight: '600', size: 11 }
                            }
                        }
                    }
                }
            });
        }
    }

    bindEvents() {
        // Timeframe Pill Toggle
        document.querySelectorAll('#an-timeframe-toggle .an-pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const time = e.currentTarget.dataset.time;
                this.timeframe = time;
                this.render();
            });
        });

        // Family Select
        const familySel = document.getElementById('an-family-select');
        if (familySel) {
            familySel.addEventListener('change', (e) => {
                this.familyMember = e.target.value;
                sessionStorage.setItem('prodos_active_family_member', this.familyMember);
                this.render();
            });
        }

        // Custom Date Range Apply
        const applyCustomBtn = document.getElementById('an-apply-custom');
        if (applyCustomBtn) {
            applyCustomBtn.addEventListener('click', () => {
                this.customStart = document.getElementById('an-custom-start')?.value;
                this.customEnd = document.getElementById('an-custom-end')?.value;
                this.render();
            });
        }

        // Quick Actions Modal Triggers
        const triggerAddTxn = async (type) => {
            const persons = (this.storage.get('custom_persons') || []);
            const result = await showFormModal({
                title: `Add ${type === 'income' ? 'Income' : 'Expense'}`,
                icon: type === 'income' ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up',
                submitLabel: 'Save Entry',
                fields: [
                    { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Salary, Rent, Grocery', required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
                    { key: 'category', label: 'Category', type: 'dropdown', options: type === 'income' ? ['Salary', 'Freelance', 'Other'] : ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'EMI', 'Other'] },
                    { key: 'date', label: 'Date', type: 'date', value: new Date().toISOString().split('T')[0] },
                    { key: 'person', label: 'Person', type: 'dropdown', options: ['Personal / General', ...persons] }
                ]
            });

            if (result) {
                const txns = this.storage.get('transactions') || [];
                txns.push({
                    id: 'txn_' + Date.now(),
                    title: result.title,
                    amount: parseFloat(result.amount),
                    category: result.category,
                    date: result.date,
                    person: result.person === 'Personal / General' ? '' : result.person,
                    type: type
                });
                this.storage.set('transactions', txns);
                showToast(`${type === 'income' ? 'Income' : 'Expense'} entry saved!`);
                this.render();
            }
        };

        const triggerAddLoan = async () => {
            const persons = (this.storage.get('custom_persons') || []);
            const result = await showFormModal({
                title: 'Add New Loan',
                icon: 'fa-solid fa-building-columns',
                submitLabel: 'Save Loan',
                fields: [
                    { key: 'title', label: 'Loan Title', type: 'text', placeholder: 'e.g. Home Loan, Car Loan', required: true },
                    { key: 'bank', label: 'Bank Name', type: 'text', placeholder: 'e.g. HDFC, SBI' },
                    { key: 'amountSanctioned', label: 'Sanctioned Amount (₹)', type: 'amount', required: true },
                    { key: 'emiPerMonth', label: 'EMI per Month (₹)', type: 'amount', required: true },
                    { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', value: 8.5 },
                    { key: 'person', label: 'Person', type: 'dropdown', options: ['Personal / General', ...persons] }
                ]
            });

            if (result) {
                const loans = this.storage.get('loans') || [];
                const amt = parseFloat(result.amountSanctioned);
                loans.push({
                    id: 'loan_' + Date.now(),
                    title: result.title,
                    bank: result.bank || '',
                    amountSanctioned: amt,
                    amountLeftToPay: amt,
                    emiPerMonth: parseFloat(result.emiPerMonth) || 0,
                    interestRate: parseFloat(result.interestRate) || 0,
                    person: result.person === 'Personal / General' ? '' : result.person
                });
                this.storage.set('loans', loans);
                showToast('Loan record saved!');
                this.render();
            }
        };

        // Bind Add Income / Add Expense / Add Loan buttons
        ['an-btn-add-income', 'an-empty-add-income'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => triggerAddTxn('income'));
        });

        ['an-btn-add-expense', 'an-empty-add-expense'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => triggerAddTxn('expense'));
        });

        ['an-btn-add-loan', 'an-empty-add-loan'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', triggerAddLoan);
        });
    }
}
