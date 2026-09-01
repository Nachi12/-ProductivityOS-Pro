// js/dashboard.js
import { showToast } from './toast.js';
import { showFormModal } from './modal.js';
import { FinancialAnalyticsEngine, formatINR } from './analytics-calc.js';

export class Dashboard {
    constructor(storage) {
        this.storage = storage;
        this.chartInstance = null;
        this.finChartInstance = null;
        this.bindEvents();
    }

    init() {
        this.renderGreeting();
        this.renderTasks();
        this.renderKPIs();
        this.initChart();
        this.renderFinancialAnalytics();
        this.checkEmiDues();
    }

    renderGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        document.getElementById('greeting').textContent = `${greeting}.`;
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date-display').textContent = new Date().toLocaleDateString(undefined, options);
    }

    renderTasks() {
        const tasks = this.storage.get('tasks');
        const list = document.getElementById('dashboard-task-list');
        list.innerHTML = '';
        
        const activeTasks = tasks.filter(t => !t.completed).slice(0, 5); // Show top 5
        
        if (activeTasks.length === 0) {
            list.innerHTML = '<li class="text-muted" style="padding:16px;">No active tasks. You are all caught up!</li>';
            return;
        }

        activeTasks.forEach(t => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" data-id="${t.id}">
                <span class="task-title" style="text-decoration: ${t.completed ? 'line-through' : 'none'}">${t.title}</span>
                <span class="task-project">${t.project}</span>
            `;
            list.appendChild(li);
        });

        // Bind quick check
        list.querySelectorAll('input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const idx = tasks.findIndex(t => t.id === id);
                if(idx > -1) {
                    tasks[idx].completed = e.target.checked;
                    this.storage.set('tasks', tasks);
                    this.renderKPIs();
                    showToast('Task updated!');
                    // Trigger re-render with slight delay for visual satisfaction
                    setTimeout(() => this.renderTasks(), 400); 
                }
            });
        });
    }

    renderKPIs() {
        const tasks = this.storage.get('tasks');
        const completedCount = tasks.filter(t => t.completed).length;
        document.getElementById('kpi-tasks').textContent = completedCount;
        
        // Mocking others for demo
        document.getElementById('kpi-streak').textContent = '12 Days';
        document.getElementById('kpi-focus').textContent = '4h 30m';
    }

    bindEvents() {
        const dump = document.getElementById('brain-dump-input');
        const saveTaskBtn = document.getElementById('brain-dump-save-task');
        const saveNoteBtn = document.getElementById('brain-dump-save-note');

        if (!dump) return;

        const quickAddBtn = document.getElementById('btn-quick-add');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                dump.focus();
                dump.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        // Render existing dump entries on load
        this.renderDumpList();

        // Save as Task
        if (saveTaskBtn) {
            saveTaskBtn.addEventListener('click', () => {
                const text = dump.value.trim();
                if (!text) { dump.focus(); return; }

                const tasks = this.storage.get('tasks');
                tasks.push({
                    id: 't' + Date.now(),
                    title: text,
                    priority: 'Medium',
                    project: 'Inbox',
                    completed: false,
                    date: new Date().toISOString()
                });
                this.storage.set('tasks', tasks);

                this.saveDumpEntry(text, 'task');
                dump.value = '';
                this.renderTasks();
                this.renderKPIs();
                this.renderDumpList();
                showToast('Saved as task!');
            });
        }

        // Save as Note
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', () => {
                const text = dump.value.trim();
                if (!text) { dump.focus(); return; }

                const notes = this.storage.get('notes') || [];
                notes.unshift({
                    id: 'note_' + Date.now(),
                    title: text.substring(0, 50),
                    content: text,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                this.storage.set('notes', notes);

                this.saveDumpEntry(text, 'note');
                dump.value = '';
                this.renderDumpList();
                showToast('Saved as note!');
            });
        }
    }

    saveDumpEntry(text, type) {
        const entries = this.storage.get('brainDumpEntries') || [];
        entries.unshift({
            id: 'bd_' + Date.now(),
            text: text.substring(0, 120),
            type,
            time: new Date().toISOString()
        });
        // Keep last 20
        if (entries.length > 20) entries.length = 20;
        this.storage.set('brainDumpEntries', entries);
    }

    renderDumpList() {
        const list = document.getElementById('brain-dump-list');
        if (!list) return;

        const entries = this.storage.get('brainDumpEntries') || [];
        if (entries.length === 0) {
            list.innerHTML = '<li style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Your captured ideas will appear here</li>';
            return;
        }

        list.innerHTML = entries.slice(0, 10).map(e => {
            const icon = e.type === 'task' ? 'fa-circle-check' : 'fa-note-sticky';
            const color = e.type === 'task' ? 'var(--clr-green)' : 'var(--clr-blue)';
            const ago = this.timeAgo(e.time);
            return `
                <li style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border-light);font-size:0.85rem;">
                    <i class="fa-solid ${icon}" style="color:${color};flex-shrink:0;"></i>
                    <span style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.text}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0;">${ago}</span>
                    <button class="brain-dump-del" data-id="${e.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;padding:2px;" title="Remove"><i class="fa-solid fa-xmark"></i></button>
                </li>
            `;
        }).join('');

        // Delete handler
        list.querySelectorAll('.brain-dump-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const entries = this.storage.get('brainDumpEntries') || [];
                const filtered = entries.filter(e => e.id !== btn.dataset.id);
                this.storage.set('brainDumpEntries', filtered);
                this.renderDumpList();
            });
        });
    }

    timeAgo(dateStr) {
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    initChart() {
        const ctx = document.getElementById('productivityChart');
        if(!ctx) return;
        
        if(this.chartInstance) this.chartInstance.destroy();

        // Chart.js implementation (requires CDN loaded in index.html)
        if(window.Chart) {
            Chart.defaults.color = '#ffffff';
            Chart.defaults.font.family = 'Inter';
            
            const style = getComputedStyle(document.documentElement);
            const accentColor = style.getPropertyValue('--accent-color').trim() || '#C7FF2E';
            const accentLight = style.getPropertyValue('--accent-light').trim() || 'rgba(199, 255, 46, 0.15)';
            
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Tasks Completed',
                        data: [5, 9, 3, 12, 8, 2, 4],
                        borderColor: accentColor,
                        backgroundColor: accentLight,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.12)' }, ticks: { color: '#ffffff', font: { weight: '600' } } },
                        x: { grid: { display: false }, ticks: { color: '#ffffff', font: { weight: '600' } } }
                    }
                }
            });
        }
    }

    async checkEmiDues() {
        const loans = this.storage.get('loans') || [];
        const alertContainer = document.getElementById('dashboard-alerts');
        if (!alertContainer) return;
        
        alertContainer.innerHTML = '';
        
        const today = new Date();
        const currentMonthStr = today.getFullYear() + '-' + (today.getMonth() + 1);
        const currentDate = today.getDate();

        for (let lIdx = 0; lIdx < loans.length; lIdx++) {
            const loan = loans[lIdx];
            if (loan.amountLeftToPay <= 0 || !loan.emiDate) continue;
            
            // Check if due: Date has passed AND hasn't paid this month
            if (currentDate >= loan.emiDate && loan.lastEmiPaidMonth !== currentMonthStr) {
                
                const alertDiv = document.createElement('div');
                alertDiv.className = 'card';
                alertDiv.style.border = '1px solid var(--clr-orange)';
                alertDiv.style.marginBottom = 'var(--spacing-3)';
                alertDiv.style.background = 'rgba(244, 81, 30, 0.05)';
                
                alertDiv.innerHTML = `
                    <div class="card-body" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 16px;">
                        <div>
                            <h3 style="color:var(--clr-orange); margin-bottom:4px; font-size:1rem;"><i class="fa-solid fa-triangle-exclamation"></i> EMI Due: ${loan.title}</h3>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Your monthly EMI of <strong>₹${loan.emiPerMonth}</strong> is due. Please log the payment to keep your balance accurate.</p>
                        </div>
                        <button class="btn btn-primary btn-log-emi" data-idx="${lIdx}" style="background:var(--clr-orange); color:#fff; border:none;">Log Payment</button>
                    </div>
                `;
                alertContainer.appendChild(alertDiv);
            }
        }
        
        // Bind Log Payment buttons
        alertContainer.querySelectorAll('.btn-log-emi').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const loan = loans[idx];
                
                const result = await showFormModal({
                    title: `Log EMI for ${loan.title}`,
                    icon: 'fa-solid fa-money-check-dollar',
                    submitLabel: 'Confirm Payment',
                    submitIcon: 'fa-solid fa-check',
                    fields: [
                        { key: 'amount', label: 'Total EMI Paid (₹)', type: 'amount', value: loan.emiPerMonth, required: true },
                        { key: 'interest', label: 'Interest Part (₹) (Crucial for correct balance deduction)', type: 'amount', value: 0, required: true }
                    ]
                });
                
                if (!result) return;
                
                const amountPaid = parseFloat(result.amount) || 0;
                const interestPaid = parseFloat(result.interest) || 0;
                
                if (amountPaid <= 0) return;
                
                // 1. Log Expense Transaction
                const txns = this.storage.get('transactions') || [];
                txns.push({
                    id: 'txn_' + Date.now(),
                    title: `EMI Payment: ${loan.title}`,
                    amount: amountPaid,
                    interest: interestPaid,
                    category: 'EMI',
                    person: loan.person || '',
                    type: 'expense',
                    linkedLoanId: loan.id,
                    date: today.toISOString().split('T')[0]
                });
                this.storage.set('transactions', txns);
                
                // 2. Deduct Principal from Loan
                const principalPaid = amountPaid - interestPaid;
                loan.amountLeftToPay = Math.max(0, loan.amountLeftToPay - principalPaid);
                
                // 3. Update last paid month so it disappears
                loan.lastEmiPaidMonth = currentMonthStr;
                this.storage.set('loans', loans);
                
                showToast(`EMI Logged. ₹${principalPaid} deducted from loan balance.`);
                
                // Refresh Dashboard Alerts
                this.checkEmiDues(); 
            });
        });
    }

    renderFinancialAnalytics() {
        const container = document.getElementById('dashboard-financial-section');
        if (!container) return;

        const txns = this.storage.get('transactions') || [];
        const loans = this.storage.get('loans') || [];
        const activeFamilyMember = sessionStorage.getItem('prodos_active_family_member') || 'All';
        const familyMember = activeFamilyMember === 'Main' ? 'All' : activeFamilyMember;

        const filteredTxns = FinancialAnalyticsEngine.filterTransactions(txns, { timeframe: '30d', familyMember });
        const income = FinancialAnalyticsEngine.calculateTotalIncome(filteredTxns);
        const expenses = FinancialAnalyticsEngine.calculateTotalExpenses(filteredTxns);
        const netSavings = FinancialAnalyticsEngine.calculateNetSavings(income, expenses);
        const savingsRate = FinancialAnalyticsEngine.calculateSavingsRate(income, expenses);
        const loanMetrics = FinancialAnalyticsEngine.calculateLoanMetrics(loans, familyMember, income);
        const insights = FinancialAnalyticsEngine.generateFinancialInsights(txns, loans, familyMember);

        const timeSeriesData = FinancialAnalyticsEngine.calculateTimeSeriesData(txns, '30d');

        container.innerHTML = `
            <div class="card" style="padding:var(--spacing-4);">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h2><i class="fa-solid fa-chart-line" style="color:var(--accent-color);"></i> Financial Analytics & Intelligence Overview</h2>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary" id="dash-btn-add-income" style="padding:6px 12px; font-size:0.8rem;"><i class="fa-solid fa-arrow-down" style="color:var(--clr-green)"></i> + Income</button>
                        <button class="btn btn-secondary" id="dash-btn-add-expense" style="padding:6px 12px; font-size:0.8rem;"><i class="fa-solid fa-arrow-up" style="color:var(--clr-red)"></i> + Expense</button>
                        <a href="#analytics" class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem; text-decoration:none;"><i class="fa-solid fa-chart-pie"></i> Full Analytics</a>
                    </div>
                </div>

                <div class="card-body" style="display:flex; flex-direction:column; gap:var(--spacing-4);">
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                        <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">30D Income</div>
                            <div style="font-size:1.2rem; font-weight:700; color:var(--clr-green); margin-top:2px;">${formatINR(income)}</div>
                        </div>

                        <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">30D Expenses</div>
                            <div style="font-size:1.2rem; font-weight:700; color:var(--clr-red); margin-top:2px;">${formatINR(expenses)}</div>
                        </div>

                        <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Net Savings</div>
                            <div style="font-size:1.2rem; font-weight:700; color:${netSavings >= 0 ? 'var(--clr-green)' : 'var(--clr-red)'}; margin-top:2px;">${formatINR(netSavings)}</div>
                        </div>

                        <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Savings Rate</div>
                            <div style="font-size:1.2rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${savingsRate}%</div>
                        </div>

                        <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Monthly EMI</div>
                            <div style="font-size:1.2rem; font-weight:700; color:var(--clr-orange); margin-top:2px;">${formatINR(loanMetrics.monthlyEMI)}</div>
                        </div>
                    </div>

                    <div style="position:relative; width:100%; height:260px;">
                        <canvas id="dashboardFinancialChart"></canvas>
                    </div>

                    ${insights.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${insights.slice(0, 2).map(ins => `
                                <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-hover); border-radius:var(--radius-md); border:1px solid var(--border-color); font-size:0.85rem;">
                                    <i class="${ins.icon}" style="font-size:1rem; color:var(--accent-color);"></i>
                                    <div style="flex:1;"><strong>${ins.title}:</strong> ${ins.message}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Render Canvas Chart
        const ctx = document.getElementById('dashboardFinancialChart');
        if (ctx && window.Chart) {
            if (this.finChartInstance) this.finChartInstance.destroy();
            this.finChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeSeriesData.map(d => d.label),
                    datasets: [
                        {
                            label: 'Income',
                            data: timeSeriesData.map(d => d.income),
                            borderColor: '#43a047',
                            backgroundColor: 'rgba(67, 160, 71, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35
                        },
                        {
                            label: 'Expenses',
                            data: timeSeriesData.map(d => d.expenses),
                            borderColor: '#e53935',
                            backgroundColor: 'rgba(229, 57, 53, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.12)' }, ticks: { color: '#ffffff', font: { weight: '600' } } },
                        x: { grid: { display: false }, ticks: { color: '#ffffff', font: { weight: '600' } } }
                    }
                }
            });
        }

        // Bind quick action buttons on dashboard
        document.getElementById('dash-btn-add-income')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'Add Income',
                icon: 'fa-solid fa-arrow-down',
                submitLabel: 'Save Income',
                fields: [
                    { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. June Salary', required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
                    { key: 'category', label: 'Category', type: 'dropdown', options: ['Salary', 'Freelance', 'Other'] },
                    { key: 'date', label: 'Date', type: 'date', value: new Date().toISOString().split('T')[0] }
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
                    type: 'income'
                });
                this.storage.set('transactions', txns);
                showToast('Income entry saved!');
                this.renderFinancialAnalytics();
            }
        });

        document.getElementById('dash-btn-add-expense')?.addEventListener('click', async () => {
            const result = await showFormModal({
                title: 'Add Expense',
                icon: 'fa-solid fa-arrow-up',
                submitLabel: 'Save Expense',
                fields: [
                    { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Grocery, Rent', required: true },
                    { key: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
                    { key: 'category', label: 'Category', type: 'dropdown', options: ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'EMI', 'Other'] },
                    { key: 'date', label: 'Date', type: 'date', value: new Date().toISOString().split('T')[0] }
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
                    type: 'expense'
                });
                this.storage.set('transactions', txns);
                showToast('Expense entry saved!');
                this.renderFinancialAnalytics();
            }
        });
    }
}
