export class AIFinancialEngine {
    constructor() {
        this.essentialCategories = ['Rent', 'Utilities', 'Healthcare', 'Insurance', 'Education', 'Transport', 'Groceries', 'EMI', 'Loan', 'Bills'];
        this.discretionaryCategories = ['Food', 'Dining', 'Shopping', 'Entertainment', 'Subscriptions', 'Luxury', 'Travel'];
    }

    generateInsights(financialContext) {
        const insights = [];
        const { txns } = financialContext;

        if (!txns || txns.length === 0) {
            insights.push(this._createEmptyStateInsight());
            return insights;
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

        const currTxns = txns.filter(t => new Date(t.date || 0) >= thirtyDaysAgo);
        const prevTxns = txns.filter(t => new Date(t.date || 0) >= sixtyDaysAgo && new Date(t.date || 0) < thirtyDaysAgo);

        if (currTxns.length === 0 && prevTxns.length === 0) {
            insights.push({
                insightType: 'info',
                priority: 'low',
                icon: 'fa-solid fa-clock-rotate-left',
                iconColor: 'var(--text-muted)',
                iconBg: 'rgba(150, 150, 150, 0.1)',
                title: 'Insufficient Data',
                summary: 'Not enough transaction history to reliably identify your spending patterns.',
                evidence: {},
                recommendation: { action: 'investigate', targetAmount: null },
                estimatedImpact: null,
                confidence: 0.1,
                details: {
                    whatWeFound: 'We need more data to analyze your spending.',
                    whyItMatters: 'Accurate financial recommendations require at least a few weeks of consistent transaction history.',
                    whatYouCanDo: [{
                        label: 'Import Data',
                        description: 'Import another month\'s statement to improve analysis.',
                        impact: 'High',
                        actionText: 'Upload Statement'
                    }]
                }
            });
            return insights;
        }

        const currExpenses = currTxns.filter(t => t.type === 'expense' || !t.type);
        const prevExpenses = prevTxns.filter(t => t.type === 'expense' || !t.type);
        const currTotalExpenses = currExpenses.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const currCatTotals = this._groupByCategory(currExpenses);
        const prevCatTotals = this._groupByCategory(prevExpenses);

        // 1. Analyze "Other" Category Quality
        const otherInsight = this._analyzeOtherCategory(currCatTotals, currTotalExpenses, currExpenses);
        if (otherInsight) insights.push(otherInsight);

        // 2. Spending Spikes
        const spendingInsights = this._analyzeSpendingSpikes(currCatTotals, prevCatTotals, currExpenses);
        insights.push(...spendingInsights);

        // 3. Savings Rate Analysis
        const currIncomeTxns = currTxns.filter(t => t.type === 'income');
        const currTotalIncome = currIncomeTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        if (currTotalIncome > 0) {
            const savingsInsight = this._analyzeSavingsRate(currTotalIncome, currTotalExpenses, currCatTotals);
            if (savingsInsight) insights.push(savingsInsight);
        }

        return this._prioritizeInsights(insights).slice(0, 4);
    }

    _groupByCategory(expenses) {
        return expenses.reduce((acc, t) => {
            const cat = t.category || 'Other';
            acc[cat] = (acc[cat] || 0) + (parseFloat(t.amount) || 0);
            return acc;
        }, {});
    }

    _analyzeOtherCategory(currCatTotals, totalExpenses, currExpenses) {
        const otherTotal = currCatTotals['Other'] || 0;
        if (totalExpenses === 0 || otherTotal === 0) return null;

        const share = (otherTotal / totalExpenses) * 100;
        const otherCount = currExpenses.filter(t => !t.category || t.category === 'Other').length;

        if (share > 25) {
            return {
                insightType: 'review',
                priority: 'high',
                icon: 'fa-solid fa-magnifying-glass-chart',
                iconColor: 'var(--clr-orange, #f57c00)',
                iconBg: 'rgba(245, 124, 0, 0.1)',
                title: 'Review Categorization',
                summary: `'Other' accounts for ${share.toFixed(0)}% of your recorded expenses. This is unusually large.`,
                amount: otherTotal,
                impactText: 'Improves accuracy',
                evidence: {
                    currentAmount: otherTotal,
                    sharePercent: share
                },
                recommendation: { action: 'review', targetAmount: null },
                confidence: 0.95,
                details: {
                    whatWeFound: `Your Other category represents ${share.toFixed(0)}% of spending (₹${otherTotal.toLocaleString('en-IN')}).`,
                    whyItMatters: `Before reducing this spending, review the ${otherCount} transactions currently classified as Other because they may contain rent, transfers, bills, or other legitimate expenses.`,
                    whatYouCanDo: [
                        {
                            label: 'Categorize Transactions',
                            description: 'Assign proper categories to these transactions.',
                            impact: 'High',
                            actionText: 'Review Now'
                        }
                    ]
                }
            };
        }
        return null;
    }

    _analyzeSpendingSpikes(currTotals, prevTotals, currExpenses) {
        const insights = [];
        
        for (const [cat, currAmt] of Object.entries(currTotals)) {
            // Skip 'Other' since we handle it separately
            if (cat === 'Other') continue;

            const prevAmt = prevTotals[cat] || 0;
            const isDiscretionary = this.discretionaryCategories.includes(cat);
            
            if (prevAmt > 0 && currAmt > prevAmt) {
                const changePct = ((currAmt - prevAmt) / prevAmt) * 100;
                
                // Significant spike in discretionary spending
                if (isDiscretionary && changePct > 20 && currAmt > 2000) {
                    const potentialMonthlySavings = currAmt - prevAmt; // Suggest reducing to previous level
                    const targetAmt = prevAmt;
                    
                    insights.push({
                        insightType: 'spending_alert',
                        priority: changePct > 40 ? 'high' : 'medium',
                        icon: 'fa-solid fa-triangle-exclamation',
                        iconColor: 'var(--clr-red, #e53935)',
                        iconBg: 'rgba(229, 57, 53, 0.1)',
                        title: `${cat} spending increased`,
                        summary: `${cat} increased ${changePct.toFixed(0)}% vs previous period.`,
                        amount: currAmt,
                        impactText: `Potential reduction: ₹${potentialMonthlySavings.toLocaleString('en-IN')}/mo`,
                        evidence: {
                            currentAmount: currAmt,
                            previousAmount: prevAmt,
                            changePercent: changePct
                        },
                        recommendation: { action: 'reduce', targetAmount: targetAmt },
                        estimatedImpact: { monthlySavings: potentialMonthlySavings, annualSavings: potentialMonthlySavings * 12 },
                        confidence: 0.90,
                        details: {
                            whatWeFound: `${cat} spending is ₹${currAmt.toLocaleString('en-IN')} this period.`,
                            whyItMatters: `This is ${changePct.toFixed(0)}% higher than your recent average. High discretionary spending limits your savings rate.`,
                            whatYouCanDo: [
                                {
                                    label: `Reduce to ₹${targetAmt.toLocaleString('en-IN')}`,
                                    description: `Set a monthly limit to match your previous spending levels.`,
                                    impact: `₹${potentialMonthlySavings.toLocaleString('en-IN')}/mo savings`,
                                    actionText: 'Set Limit'
                                },
                                {
                                    label: `Reduce to ₹${Math.round(targetAmt * 0.9).toLocaleString('en-IN')}`,
                                    description: `Aggressively cut spending in this category.`,
                                    impact: `₹${Math.round(currAmt - (targetAmt*0.9)).toLocaleString('en-IN')}/mo savings`,
                                    actionText: 'Set Limit'
                                }
                            ]
                        }
                    });
                }
            } else if (prevAmt > 0 && currAmt < prevAmt && isDiscretionary) {
                // Positive behavior
                const changePct = ((prevAmt - currAmt) / prevAmt) * 100;
                if (changePct >= 15) {
                    insights.push({
                        insightType: 'positive_trend',
                        priority: 'low',
                        icon: 'fa-solid fa-arrow-trend-down',
                        iconColor: 'var(--clr-green, #43a047)',
                        iconBg: 'rgba(67, 160, 71, 0.1)',
                        title: `Reduced ${cat} Spending`,
                        summary: `You successfully reduced ${cat} by ${changePct.toFixed(0)}%.`,
                        amount: currAmt,
                        impactText: `Saved ₹${(prevAmt - currAmt).toLocaleString('en-IN')} this month`,
                        evidence: { currentAmount: currAmt, previousAmount: prevAmt },
                        recommendation: { action: 'maintain', targetAmount: currAmt },
                        confidence: 0.85,
                        details: {
                            whatWeFound: `You spent ₹${currAmt.toLocaleString('en-IN')} on ${cat}, down from ₹${prevAmt.toLocaleString('en-IN')}.`,
                            whyItMatters: `Consistent reduction in discretionary spending is key to lifestyle optimization and goal achievement.`,
                            whatYouCanDo: [
                                {
                                    label: 'Maintain Current Level',
                                    description: 'Keep your spending around this new baseline.',
                                    impact: 'High long-term',
                                    actionText: 'Track'
                                }
                            ]
                        }
                    });
                }
            }
        }
        return insights;
    }

    _analyzeSavingsRate(income, expenses, catTotals) {
        const savings = income - expenses;
        const savingsRate = (savings / income) * 100;
        
        // Calculate essential vs discretionary load
        let essentialTotal = 0;
        let discretionaryTotal = 0;
        for (const [cat, amt] of Object.entries(catTotals)) {
            if (this.essentialCategories.includes(cat)) essentialTotal += amt;
            else discretionaryTotal += amt;
        }

        // Realistic target calculation: Income - Essentials - (Discretionary * 0.8)
        const realisticTarget = income - essentialTotal - (discretionaryTotal * 0.8);
        const realisticTargetRate = (realisticTarget / income) * 100;
        const gap = realisticTarget - savings;

        if (savingsRate < 5) {
            return {
                insightType: 'savings',
                priority: 'high',
                icon: 'fa-solid fa-piggy-bank',
                iconColor: 'var(--clr-purple, #8e24aa)',
                iconBg: 'rgba(142, 36, 170, 0.1)',
                title: 'Savings Rate Alert',
                summary: `Current savings rate is ${savingsRate.toFixed(1)}%. Target: ${realisticTargetRate.toFixed(1)}%.`,
                amount: savings,
                impactText: gap > 0 ? `Potential improvement: ₹${gap.toLocaleString('en-IN')}/mo` : 'Negative cash flow',
                evidence: { currentRate: savingsRate, targetRate: realisticTargetRate, gapAmount: gap },
                recommendation: { action: 'increase', targetAmount: realisticTarget },
                estimatedImpact: { monthlySavings: gap, annualSavings: gap * 12 },
                confidence: 0.88,
                details: {
                    whatWeFound: `Your savings rate is ${savingsRate.toFixed(1)}% (₹${savings.toLocaleString('en-IN')}).`,
                    whyItMatters: `Building a buffer is essential. Based on your fixed expenses, you could safely save around ₹${realisticTarget.toLocaleString('en-IN')} per month without impacting your essential needs.`,
                    whatYouCanDo: gap > 0 ? [
                        {
                            label: `Aim for ₹${realisticTarget.toLocaleString('en-IN')} savings`,
                            description: `Cut discretionary spending by 20% to hit this target.`,
                            impact: `+${(realisticTargetRate - savingsRate).toFixed(1)}% savings rate`,
                            actionText: 'See Plan'
                        }
                    ] : [
                        {
                            label: `Review Cash Flow`,
                            description: `Your essential expenses might be too high for your current income.`,
                            impact: 'Critical',
                            actionText: 'Review'
                        }
                    ]
                }
            };
        } else if (savingsRate >= 20) {
             return {
                insightType: 'positive_trend',
                priority: 'low',
                icon: 'fa-solid fa-arrow-trend-up',
                iconColor: 'var(--clr-green, #43a047)',
                iconBg: 'rgba(67, 160, 71, 0.1)',
                title: 'Excellent Savings Rate',
                summary: `Your savings rate is ${savingsRate.toFixed(1)}%.`,
                amount: savings,
                impactText: `Keep it up!`,
                evidence: { currentRate: savingsRate },
                recommendation: { action: 'maintain', targetAmount: savings },
                confidence: 0.95,
                details: {
                    whatWeFound: `You are saving a very healthy ${savingsRate.toFixed(1)}% of your income.`,
                    whyItMatters: `Maintaining a savings rate >20% accelerates financial independence.`,
                    whatYouCanDo: [
                        {
                            label: 'Invest Excess Cash',
                            description: 'Ensure these savings are properly invested to beat inflation.',
                            impact: 'Wealth generation',
                            actionText: 'Invest'
                        }
                    ]
                }
            };
        }

        return null;
    }

    _createEmptyStateInsight() {
        return {
            insightType: 'info',
            priority: 'low',
            icon: 'fa-solid fa-robot',
            iconColor: 'var(--clr-purple, #8e24aa)',
            iconBg: 'rgba(142, 36, 170, 0.1)',
            title: 'Welcome to AI Insights',
            summary: 'Add transactions or link your bank accounts to receive personalized AI financial recommendations.',
            amount: 0,
            impactText: '',
            evidence: {},
            recommendation: { action: 'investigate', targetAmount: null },
            confidence: 1.0,
            details: {
                whatWeFound: 'No financial data available yet.',
                whyItMatters: 'We need transaction data to analyze your spending habits.',
                whatYouCanDo: [{
                    label: 'Add Data',
                    description: 'Start tracking your money to unlock insights.',
                    impact: 'High',
                    actionText: 'Add Entry'
                }]
            }
        };
    }

    _prioritizeInsights(insights) {
        const priorityScore = { 'high': 3, 'medium': 2, 'low': 1 };
        return insights.sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);
    }
}
