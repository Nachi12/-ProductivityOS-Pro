// js/analytics-calc.js
import { formatIndianCurrency } from './formatters.js';

export function formatINR(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (amount < 0 ? '-₹' : '₹') + formatted;
}

export class FinancialAnalyticsEngine {
    /**
     * Filter transactions based on date range, family member, category, type
     */
    static filterTransactions(transactions = [], opts = {}) {
        const {
            timeframe = '30d', // 7d, 30d, 3m, 6m, 1y, custom, all
            customStart = null,
            customEnd = null,
            familyMember = 'All',
            category = 'All',
            type = 'All'
        } = opts;

        let filtered = [...transactions];

        // 1. Family Filter
        if (familyMember && familyMember !== 'All') {
            filtered = filtered.filter(t => (t.person || '') === familyMember);
        }

        // 2. Category Filter
        if (category && category !== 'All') {
            filtered = filtered.filter(t => t.category === category);
        }

        // 3. Type Filter
        if (type && type !== 'All') {
            filtered = filtered.filter(t => t.type === type);
        }

        // 4. Date Range Filter
        if (timeframe === 'all') return filtered;

        const now = new Date();
        let startDate = new Date();

        if (timeframe === '7d') {
            startDate.setDate(now.getDate() - 7);
        } else if (timeframe === '30d') {
            startDate.setDate(now.getDate() - 30);
        } else if (timeframe === '3m') {
            startDate.setMonth(now.getMonth() - 3);
        } else if (timeframe === '6m') {
            startDate.setMonth(now.getMonth() - 6);
        } else if (timeframe === '1y') {
            startDate.setFullYear(now.getFullYear() - 1);
        } else if (timeframe === 'custom' && customStart) {
            startDate = new Date(customStart);
        } else {
            startDate.setDate(now.getDate() - 30);
        }
        startDate.setHours(0, 0, 0, 0);

        let endDate = new Date();
        if (timeframe === 'custom' && customEnd) {
            endDate = new Date(customEnd);
            endDate.setHours(23, 59, 59, 999);
        }

        filtered = filtered.filter(t => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d >= startDate && d <= endDate;
        });

        return filtered;
    }

    /**
     * Filter loans based on family member
     */
    static filterLoans(loans = [], familyMember = 'All') {
        if (!familyMember || familyMember === 'All') return loans;
        return loans.filter(l => (l.person || '') === familyMember);
    }

    /**
     * Calculate Total Income
     */
    static calculateTotalIncome(txns = []) {
        return txns
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    }

    /**
     * Calculate Total Expenses
     */
    static calculateTotalExpenses(txns = []) {
        return txns
            .filter(t => t.type === 'expense' || !t.type)
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    }

    /**
     * Calculate Net Savings
     */
    static calculateNetSavings(income = 0, expenses = 0) {
        return income - expenses;
    }

    /**
     * Calculate Savings Rate safely (returns integer 0-100)
     */
    static calculateSavingsRate(income = 0, expenses = 0) {
        if (!income || income <= 0) return 0;
        const net = income - expenses;
        const rate = (net / income) * 100;
        if (isNaN(rate) || !isFinite(rate)) return 0;
        return Math.max(0, Math.round(rate));
    }

    /**
     * Calculate Category Breakdown
     */
    static calculateCategoryBreakdown(txns = []) {
        const expenseTxns = txns.filter(t => t.type === 'expense' || !t.type);
        const totalExpenses = expenseTxns.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

        const categoryMap = {};
        expenseTxns.forEach(t => {
            const cat = t.category || 'Other';
            const amt = parseFloat(t.amount) || 0;
            categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        });

        const breakdown = Object.entries(categoryMap).map(([category, amount]) => {
            const percentage = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
            return { category, amount, percentage };
        });

        return breakdown.sort((a, b) => b.amount - a.amount);
    }

    /**
     * Calculate Month-to-Month comparison (Current Month vs Previous Month)
     */
    static calculateMonthlyComparison(allTxns = [], familyMember = 'All') {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth();

        const memberTxns = this.filterTransactions(allTxns, { timeframe: 'all', familyMember });

        const currTxns = memberTxns.filter(t => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const prevTxns = memberTxns.filter(t => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
        });

        const currIncome = this.calculateTotalIncome(currTxns);
        const currExpenses = this.calculateTotalExpenses(currTxns);
        const currSavings = this.calculateNetSavings(currIncome, currExpenses);

        const prevIncome = this.calculateTotalIncome(prevTxns);
        const prevExpenses = this.calculateTotalExpenses(prevTxns);
        const prevSavings = this.calculateNetSavings(prevIncome, prevExpenses);

        const getChangePct = (curr, prev) => {
            if (!prev || prev === 0) return curr > 0 ? 100 : 0;
            const pct = ((curr - prev) / Math.abs(prev)) * 100;
            if (isNaN(pct) || !isFinite(pct)) return 0;
            return Math.round(pct * 10) / 10;
        };

        return {
            currIncome, prevIncome, incomeChangePct: getChangePct(currIncome, prevIncome),
            currExpenses, prevExpenses, expenseChangePct: getChangePct(currExpenses, prevExpenses),
            currSavings, prevSavings, savingsChangePct: getChangePct(currSavings, prevSavings)
        };
    }

    /**
     * Calculate Loan Impact Analysis
     */
    static calculateLoanMetrics(allLoans = [], familyMember = 'All', monthlyIncome = 0) {
        const loans = this.filterLoans(allLoans, familyMember);
        const totalOutstanding = loans.reduce((sum, l) => sum + (parseFloat(l.amountLeftToPay) || 0), 0);
        const totalSanctioned = loans.reduce((sum, l) => sum + (parseFloat(l.amountSanctioned) || 0), 0);
        const monthlyEMI = loans.reduce((sum, l) => sum + (parseFloat(l.emiPerMonth) || 0), 0);
        const activeLoanCount = loans.length;

        const emiRatio = (monthlyIncome > 0) ? Math.round((monthlyEMI / monthlyIncome) * 100) : 0;
        const totalPaid = Math.max(0, totalSanctioned - totalOutstanding);
        const repaymentProgress = (totalSanctioned > 0) ? Math.round((totalPaid / totalSanctioned) * 100) : 0;

        return {
            totalOutstanding,
            monthlyEMI,
            activeLoanCount,
            totalSanctioned,
            totalPaid,
            emiRatio: isNaN(emiRatio) || !isFinite(emiRatio) ? 0 : emiRatio,
            repaymentProgress: isNaN(repaymentProgress) || !isFinite(repaymentProgress) ? 0 : repaymentProgress
        };
    }

    /**
     * Calculate Budget Performance
     */
    static calculateBudgetAnalysis(txns = [], userBudgets = {}) {
        const defaultBudgets = {
            'Food': 10000,
            'Rent': 20000,
            'Transport': 5000,
            'Shopping': 8000,
            'Bills': 6000,
            'Entertainment': 4000,
            'Health': 5000,
            'EMI': 15000,
            'Other': 5000
        };

        const budgets = { ...defaultBudgets, ...userBudgets };
        const categories = this.calculateCategoryBreakdown(txns);

        return categories.map(cat => {
            const budgetAmt = budgets[cat.category] || (cat.amount * 1.2);
            const spent = cat.amount;
            const remaining = budgetAmt - spent;
            const pctUsed = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 100;
            const isOver = spent > budgetAmt;
            const overAmount = isOver ? spent - budgetAmt : 0;

            return {
                category: cat.category,
                budget: budgetAmt,
                spent,
                remaining,
                pctUsed: isNaN(pctUsed) ? 0 : pctUsed,
                isOver,
                overAmount
            };
        });
    }

    /**
     * Generate Time Series Data for Interactive Chart
     */
    static calculateTimeSeriesData(txns = [], timeframe = '30d', customStart = null, customEnd = null) {
        const filtered = this.filterTransactions(txns, { timeframe, customStart, customEnd });

        const isMonthlyGroup = (timeframe === '3m' || timeframe === '6m' || timeframe === '1y');
        const buckets = {};

        const getKey = (d) => {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return null;
            if (isMonthlyGroup) {
                return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            }
            return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        };

        const now = new Date();
        let daysToPopulate = 30;
        if (timeframe === '7d') daysToPopulate = 7;
        else if (timeframe === '30d') daysToPopulate = 30;

        if (isMonthlyGroup) {
            const monthsCount = timeframe === '3m' ? 3 : (timeframe === '6m' ? 6 : 12);
            for (let i = monthsCount - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const k = getKey(d);
                if (k && !buckets[k]) {
                    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
                    buckets[k] = { label, dateKey: k, income: 0, expenses: 0, netSavings: 0 };
                }
            }
        } else {
            for (let i = daysToPopulate - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const k = getKey(d);
                if (k && !buckets[k]) {
                    const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                    buckets[k] = { label, dateKey: k, income: 0, expenses: 0, netSavings: 0 };
                }
            }
        }

        filtered.forEach(t => {
            if (!t.date) return;
            const k = getKey(t.date);
            if (!k) return;

            if (!buckets[k]) {
                const d = new Date(t.date);
                const label = isMonthlyGroup 
                    ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                    : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                buckets[k] = { label, dateKey: k, income: 0, expenses: 0, netSavings: 0 };
            }

            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'income') {
                buckets[k].income += amt;
            } else {
                buckets[k].expenses += amt;
            }
            buckets[k].netSavings = buckets[k].income - buckets[k].expenses;
        });

        return Object.values(buckets).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }

    /**
     * Generate Deterministic Real Financial Insights
     */
    static generateFinancialInsights(txns = [], loans = [], familyMember = 'All') {
        const insights = [];
        const filteredTxns = this.filterTransactions(txns, { timeframe: '30d', familyMember });
        const income = this.calculateTotalIncome(filteredTxns);
        const expenses = this.calculateTotalExpenses(filteredTxns);
        const savingsRate = this.calculateSavingsRate(income, expenses);
        const categories = this.calculateCategoryBreakdown(filteredTxns);
        const monthly = this.calculateMonthlyComparison(txns, familyMember);
        const loanMetrics = this.calculateLoanMetrics(loans, familyMember, income);

        if (filteredTxns.length === 0) {
            return [{
                type: 'info',
                icon: 'fa-solid fa-lightbulb',
                title: 'No Recent Activity',
                message: 'Add some income and expense entries to start generating automatic financial insights.'
            }];
        }

        // Insight 1: Savings Rate
        if (income > 0) {
            if (savingsRate >= 30) {
                insights.push({
                    type: 'success',
                    icon: 'fa-solid fa-piggy-bank',
                    title: 'Healthy Savings Rate',
                    message: `You saved ${savingsRate}% of your income in the past 30 days (${formatINR(income - expenses)}). Keep up the great discipline!`
                });
            } else if (savingsRate > 0) {
                insights.push({
                    type: 'warning',
                    icon: 'fa-solid fa-triangle-exclamation',
                    title: 'Moderate Savings Rate',
                    message: `You saved ${savingsRate}% of your income (${formatINR(income - expenses)}). Aim for a 20-30% savings threshold for long-term security.`
                });
            } else {
                insights.push({
                    type: 'danger',
                    icon: 'fa-solid fa-circle-exclamation',
                    title: 'Deficit Spending Warning',
                    message: `Your expenses (${formatINR(expenses)}) exceeded your income (${formatINR(income)}) by ${formatINR(expenses - income)}.`
                });
            }
        }

        // Insight 2: Month-to-Month Expense Trend
        if (monthly.expenseChangePct !== 0) {
            if (monthly.expenseChangePct > 10) {
                insights.push({
                    type: 'warning',
                    icon: 'fa-solid fa-arrow-trend-up',
                    title: 'Expense Increase Alert',
                    message: `Your expenses increased by ${monthly.expenseChangePct}% compared to last month (${formatINR(monthly.currExpenses)} vs ${formatINR(monthly.prevExpenses)}).`
                });
            } else if (monthly.expenseChangePct < -5) {
                insights.push({
                    type: 'success',
                    icon: 'fa-solid fa-arrow-trend-down',
                    title: 'Spending Reduced',
                    message: `Great job! Your monthly expenses decreased by ${Math.abs(monthly.expenseChangePct)}% compared to last month.`
                });
            }
        }

        // Insight 3: Highest Spending Category
        if (categories.length > 0) {
            const top = categories[0];
            if (top.percentage >= 25) {
                insights.push({
                    type: 'info',
                    icon: 'fa-solid fa-chart-pie',
                    title: 'Top Category Weight',
                    message: `${top.category} is your highest spending category, representing ${top.percentage}% (${formatINR(top.amount)}) of your total expenses.`
                });
            }
        }

        // Insight 4: EMI-to-Income Ratio
        if (loanMetrics.monthlyEMI > 0 && income > 0) {
            if (loanMetrics.emiRatio > 40) {
                insights.push({
                    type: 'danger',
                    icon: 'fa-solid fa-building-columns',
                    title: 'High EMI Burden',
                    message: `Your monthly EMI commitments (${formatINR(loanMetrics.monthlyEMI)}) consume ${loanMetrics.emiRatio}% of your income, exceeding recommended debt limits.`
                });
            } else {
                insights.push({
                    type: 'info',
                    icon: 'fa-solid fa-building-columns',
                    title: 'EMI-to-Income Health',
                    message: `Your monthly EMI payments account for ${loanMetrics.emiRatio}% of your monthly income.`
                });
            }
        }

        return insights;
    }
}
