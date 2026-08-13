// js/bank-statement-analyzer.js
import { showToast } from './toast.js';
import { showConfirmModal } from './modal.js';
import { StatementParser } from './statement-parser.js';
import { formatINR } from './analytics-calc.js';

export class BankStatementAnalyzer {
    constructor(storage) {
        this.storage = storage;
        this.stylesInjected = false;
        
        this.activeStep = 'upload'; // 'upload', 'review', 'analysis'
        this.currentStatement = null; // currently parsed or selected statement
        this.filterStatus = 'all'; // 'all', 'review', 'duplicate'
        this.chartInstance = null;
    }

    init(container, activePerson = '') {
        if (!container) return;
        this.container = container;
        this.activePerson = (activePerson && activePerson !== 'All') ? activePerson : '';
        this.injectStyles();
        this.render();
    }

    injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.id = 'bsa-styles';
        style.textContent = `
            .bsa-container { display: flex; flex-direction: column; gap: var(--spacing-4); }

            /* Upload Dropzone */
            .bsa-upload-card { background: var(--bg-card); border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; transition: all 0.2s ease; cursor: pointer; }
            .bsa-upload-card.drag-over { border-color: var(--accent-color); background: var(--accent-light); }
            .bsa-upload-icon { font-size: 3rem; color: var(--accent-color); margin-bottom: 16px; }
            .bsa-upload-title { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
            .bsa-upload-subtitle { font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; line-height: 1.5; }

            /* Progress Bar */
            .bsa-progress-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px; }
            .bsa-progress-bar-bg { width: 100%; height: 10px; background: var(--bg-input); border-radius: 5px; overflow: hidden; margin: 12px 0; }
            .bsa-progress-bar-fill { height: 100%; width: 0%; background: var(--accent-color); transition: width 0.3s ease; border-radius: 5px; }

            /* Review Screen */
            .bsa-summary-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--spacing-3); margin-bottom: var(--spacing-4); }
            .bsa-summary-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px; }
            .bsa-summary-label { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
            .bsa-summary-val { font-size: 1.25rem; font-weight: 700; margin-top: 4px; color: var(--text-primary); }

            .bsa-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 18px; margin-bottom: 16px; }

            /* Table Layout */
            .bsa-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
            .bsa-table th, .bsa-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-light); white-space: nowrap; }
            .bsa-table th { text-align: left; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; background: var(--bg-input); }
            .bsa-table tr:hover { background: var(--bg-hover); }

            /* Badges */
            .bsa-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
            .bsa-badge.income { background: rgba(67,160,71,0.12); color: var(--clr-green); }
            .bsa-badge.expense { background: rgba(229,57,53,0.12); color: var(--clr-red); }
            .bsa-badge.review { background: rgba(244,81,30,0.12); color: var(--clr-orange); }
            .bsa-badge.dup { background: rgba(229,57,53,0.12); color: var(--clr-red); }

            /* Mobile Card Layout for Review */
            @media (max-width: 768px) {
                .bsa-table-wrap { overflow-x: auto; }
                .bsa-toolbar { flex-direction: column; align-items: stretch; }
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    render() {
        if (!this.container) return;

        if (this.activeStep === 'upload') {
            this.renderUploadStep();
        } else if (this.activeStep === 'review') {
            this.renderReviewStep();
        } else if (this.activeStep === 'analysis') {
            this.renderAnalysisStep();
        }
    }

    /**
     * Render Step 1: File Upload & Past Statements History
     */
    renderUploadStep() {
        const statements = this.storage.get('bank_statements') || [];

        this.container.innerHTML = `
            <div class="bsa-container">
                <!-- Header Banner -->
                <div class="card" style="padding: 24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                        <div>
                            <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--accent-color)"></i> Bank Statement Analyzer</h2>
                            <p style="font-size:0.88rem; color:var(--text-muted); margin:0;">Upload your PDF, CSV, or Excel bank statement. We'll automatically parse, categorize, and extract financial intelligence.</p>
                        </div>
                    </div>
                </div>

                <!-- Drag & Drop Upload Zone -->
                <div class="bsa-upload-card" id="bsa-dropzone">
                    <input type="file" id="bsa-file-input" accept="*" style="display:none;">
                    <div class="bsa-upload-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                    <div class="bsa-upload-title">AI Bank Statement Analyzer</div>
                    <div class="bsa-upload-subtitle">Drag and drop any bank statement file here or click to choose. Supports <strong>All Formats (PDF • CSV • XLSX • TXT • Scanned Images)</strong> with AI pattern extraction.</div>
                    <button class="btn btn-primary" id="bsa-choose-btn"><i class="fa-solid fa-folder-open"></i> Choose File</button>
                </div>

                <!-- Progress Bar Container (Hidden by default) -->
                <div class="bsa-progress-card" id="bsa-progress-card" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.9rem; font-weight:600; color:var(--text-primary);" id="bsa-progress-filename">Uploading statement...</span>
                        <span style="font-size:0.82rem; font-weight:700; color:var(--accent-color);" id="bsa-progress-pct">0%</span>
                    </div>
                    <div class="bsa-progress-bar-bg">
                        <div class="bsa-progress-bar-fill" id="bsa-progress-fill"></div>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted);" id="bsa-progress-status">Parsing document structure...</div>
                </div>

                <!-- Analyzed Statements History -->
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-clock-rotate-left"></i> Previously Analyzed Statements (${statements.length})</h2>
                    </div>
                    <div class="card-body" style="padding: 16px;">
                        ${statements.length > 0 ? `
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
                                ${statements.map(s => `
                                    <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                                        <div>
                                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                <h3 style="font-weight:700; font-size:1rem; color:var(--text-primary); margin:0;">${s.bankName || 'Bank Statement'}</h3>
                                                <span class="bsa-badge income">${s.fileType}</span>
                                            </div>
                                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${s.fileName} • ${s.fileSize}</div>
                                            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:8px;">
                                                <strong>Period:</strong> ${s.startDate} to ${s.endDate} (${s.transactionCount} txns)
                                            </div>
                                            <div style="font-size:0.85rem; font-weight:700; color:var(--clr-green); margin-top:6px;">
                                                Net Cashflow: ${formatINR(s.netCashflow)}
                                            </div>
                                        </div>

                                        <div style="display:flex; gap:8px; margin-top:8px;">
                                            <button class="btn btn-secondary bsa-view-analysis" data-id="${s.id}" style="flex:1; justify-content:center; padding:6px; font-size:0.8rem;"><i class="fa-solid fa-chart-line"></i> View Analysis</button>
                                            <button class="btn btn-secondary bsa-del-stmt" data-id="${s.id}" style="padding:6px; font-size:0.8rem; color:var(--clr-red);" title="Delete Statement"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div style="text-align:center; padding:32px; color:var(--text-muted);">No bank statements analyzed yet. Upload a statement above to get started.</div>'}
                    </div>
                </div>
            </div>
        `;

        this.bindUploadEvents();
    }

    bindUploadEvents() {
        const dropzone = document.getElementById('bsa-dropzone');
        const fileInput = document.getElementById('bsa-file-input');
        const chooseBtn = document.getElementById('bsa-choose-btn');

        if (!dropzone || !fileInput) return;

        chooseBtn.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('click', (e) => {
            if (e.target !== chooseBtn && !chooseBtn.contains(e.target)) {
                fileInput.click();
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Bind History View/Delete
        document.querySelectorAll('.bsa-view-analysis').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const statements = this.storage.get('bank_statements') || [];
                const stmt = statements.find(s => s.id === id);
                if (stmt) {
                    this.currentStatement = stmt;
                    this.activeStep = 'analysis';
                    this.render();
                }
            });
        });

        document.querySelectorAll('.bsa-del-stmt').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const ok = await showConfirmModal('Delete this analyzed statement record and ERASE all its imported transactions?', { danger: true });
                if (ok) {
                    let statements = this.storage.get('bank_statements') || [];
                    statements = statements.filter(s => s.id !== id);
                    this.storage.set('bank_statements', statements);

                    // Erase all transactions imported from this statement file
                    let dbTxns = this.storage.get('transactions') || [];
                    dbTxns = dbTxns.filter(t => t.sourceStatementId !== id);
                    this.storage.set('transactions', dbTxns);

                    showToast('Statement file and all its imported transactions were completely erased!', 'info');
                    this.render();
                }
            });
        });
    }

    /**
     * Handle File Upload & Parsing Execution
     */
    async handleFileUpload(file) {
        const progressCard = document.getElementById('bsa-progress-card');
        const filenameEl = document.getElementById('bsa-progress-filename');
        const pctEl = document.getElementById('bsa-progress-pct');
        const fillEl = document.getElementById('bsa-progress-fill');
        const statusEl = document.getElementById('bsa-progress-status');

        if (!progressCard) return;

        progressCard.style.display = 'block';
        filenameEl.textContent = file.name;

        const updateProgress = (pct, text) => {
            pctEl.textContent = `${pct}%`;
            fillEl.style.width = `${pct}%`;
            statusEl.textContent = text;
        };

        try {
            updateProgress(20, 'Reading statement document...');
            await new Promise(r => setTimeout(r, 200));

            updateProgress(55, 'Running AI Intelligent Pattern Recognizer & extracting cashflows...');
            const existingTxns = this.storage.get('transactions') || [];
            const result = await StatementParser.parseStatementFile(file, existingTxns);

            updateProgress(85, 'Running AI smart categorizer & duplicate checks...');
            await new Promise(r => setTimeout(r, 200));

            updateProgress(100, 'Processing complete!');
            await new Promise(r => setTimeout(r, 200));

            this.currentStatement = result;
            this.activeStep = 'review';
            showToast('Statement parsed successfully. Please review transactions before import.');
            this.render();
        } catch (err) {
            progressCard.style.display = 'none';
            showToast(err.message || 'Error processing statement file.', 'error');
        }
    }

    getAvailablePersons() {
        const customPersons = this.storage.get('custom_persons') || [];
        const deletedPersons = this.storage.get('deleted_persons') || [];
        let familyMembers = [];
        try {
            const familyData = JSON.parse(localStorage.getItem('prodos_family_data'));
            if (familyData && Array.isArray(familyData.members)) {
                familyMembers = familyData.members.map(m => m.name);
            }
        } catch (e) {}

        const set = new Set([...familyMembers, ...customPersons]);
        return Array.from(set).filter(p => p && p.trim() !== '' && !deletedPersons.includes(p));
    }

    /**
     * Render Step 2: Review Before Import Screen
     */
    renderReviewStep() {
        const stmt = this.currentStatement;
        if (!stmt) {
            this.activeStep = 'upload';
            this.render();
            return;
        }

        let txns = stmt.transactions;
        if (this.filterStatus === 'review') {
            txns = txns.filter(t => t.confidence === 'low');
        } else if (this.filterStatus === 'duplicate') {
            txns = txns.filter(t => t.isDuplicate);
        }

        const selectedCount = stmt.transactions.filter(t => t.selectedForImport).length;
        const availablePersons = this.getAvailablePersons();

        this.container.innerHTML = `
            <div class="bsa-container">
                <!-- Top Summary Cards -->
                <div class="card" style="padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h2 style="font-size:1.2rem; font-weight:700; margin-bottom:2px;"><i class="fa-solid fa-file-signature" style="color:var(--accent-color)"></i> Statement Review & Import</h2>
                            <p style="font-size:0.83rem; color:var(--text-muted); margin:0;">${stmt.fileName} (${stmt.startDate} to ${stmt.endDate})</p>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label style="font-size:0.83rem; font-weight:700; color:var(--text-muted);"><i class="fa-solid fa-building-columns" style="color:var(--accent-color)"></i> Bank Name:</label>
                                <select id="bsa-bank-name-select" class="an-select" style="padding:6px 12px; font-size:0.85rem; font-weight:600; min-width:160px; border:1px solid var(--border-color);">
                                    ${['Canara Bank', 'HDFC Bank', 'State Bank of India (SBI)', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'YES Bank', 'Punjab National Bank', 'Bank of Baroda', 'Union Bank of India', 'Paytm Payments Bank', 'Other Bank'].map(b => `
                                        <option value="${b}" ${stmt.bankName === b ? 'selected' : ''}>${b}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <button class="btn btn-secondary" id="bsa-btn-back"><i class="fa-solid fa-arrow-left"></i> Upload Another</button>
                        </div>
                    </div>
                </div>

                <div class="bsa-summary-bar">
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Total Transactions</div>
                        <div class="bsa-summary-val">${stmt.transactionCount}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Total Credits (Income)</div>
                        <div class="bsa-summary-val" style="color:var(--clr-green);">${formatINR(stmt.totalCredits)}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Total Debits (Expense)</div>
                        <div class="bsa-summary-val" style="color:var(--clr-red);">${formatINR(stmt.totalDebits)}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Needs Review</div>
                        <div class="bsa-summary-val" style="color:${stmt.lowConfidenceCount > 0 ? 'var(--clr-orange)' : 'var(--text-primary)'};">${stmt.lowConfidenceCount}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Duplicates Detected</div>
                        <div class="bsa-summary-val" style="color:${stmt.duplicateCount > 0 ? 'var(--clr-red)' : 'var(--text-primary)'};">${stmt.duplicateCount}</div>
                    </div>
                </div>

                <!-- Review Toolbar -->
                <div class="bsa-toolbar">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn btn-secondary" id="bsa-select-all" style="font-size:0.8rem; padding:6px 12px;">Select All</button>
                        <button class="btn btn-secondary" id="bsa-deselect-all" style="font-size:0.8rem; padding:6px 12px;">Deselect All</button>
                        
                        <div class="an-pill-toggle" style="margin-left:12px;">
                            <button class="an-pill-btn ${this.filterStatus === 'all' ? 'active' : ''}" id="bsa-filter-all">All (${stmt.transactions.length})</button>
                            <button class="an-pill-btn ${this.filterStatus === 'review' ? 'active' : ''}" id="bsa-filter-review">Needs Review (${stmt.lowConfidenceCount})</button>
                            <button class="an-pill-btn ${this.filterStatus === 'duplicate' ? 'active' : ''}" id="bsa-filter-dup">Duplicates (${stmt.duplicateCount})</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="font-size:0.83rem; font-weight:700; color:var(--accent-color); text-transform:uppercase; letter-spacing:0.04em;">
                                <i class="fa-solid fa-user-tag"></i> Assign to Member <span style="color:var(--clr-red)">*</span>:
                            </label>
                            <select id="bsa-assign-person-select" class="an-select" style="padding:6px 12px; font-size:0.85rem; min-width:170px; font-weight:600; border: 1px solid var(--accent-color);">
                                <option value="">-- Select Member / Person --</option>
                                ${availablePersons.map(p => `<option value="${p}" ${this.activePerson === p ? 'selected' : ''}>${p}</option>`).join('')}
                                <option value="_NEW_MEMBER_" style="font-weight:700; color:var(--accent-color);">+ Create New Member...</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" id="bsa-btn-confirm-import" style="padding:8px 20px;"><i class="fa-solid fa-check-double"></i> Import ${selectedCount} Selected Transactions</button>
                    </div>
                </div>

                <!-- Transactions Review Table -->
                <div class="card">
                    <div class="bsa-table-wrap">
                        <table class="bsa-table">
                            <thead>
                                <tr>
                                    <th style="width:40px;"><input type="checkbox" id="bsa-master-check"></th>
                                    <th>Date</th>
                                    <th>Description & Ref</th>
                                    <th>Type / Direction</th>
                                    <th>Amount (₹)</th>
                                    <th>Category</th>
                                    <th>Confidence</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${txns.map(t => `
                                    <tr style="${t.isDuplicate ? 'background: rgba(229,57,53,0.05);' : ''}">
                                        <td><input type="checkbox" class="bsa-row-check" data-id="${t.id}" ${t.selectedForImport ? 'checked' : ''}></td>
                                        <td style="font-weight:600;">${t.date}</td>
                                        <td style="max-width:340px; overflow:hidden; text-overflow:ellipsis;" title="${(t.rawDescription || t.description).replace(/"/g, '&quot;')}">
                                            <div style="font-weight:700; color:var(--text-primary); font-size:0.88rem;">${t.description}</div>
                                            ${t.reference ? `<div style="font-size:0.75rem; color:var(--text-muted)">Ref: ${t.reference}</div>` : ''}
                                            ${t.isDuplicate ? `<div style="font-size:0.75rem; color:var(--clr-red); font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${t.duplicateReason}</div>` : ''}
                                        </td>
                                        <td>
                                            <span class="bsa-badge ${t.type === 'income' ? 'income' : 'expense'}">
                                                ${t.type === 'income' ? '↑ Credit (Income)' : '↓ Debit (Expense)'}
                                            </span>
                                        </td>
                                        <td style="font-weight:700; color:${t.type === 'income' ? 'var(--clr-green)' : 'var(--clr-red)'}">${formatINR(t.amount)}</td>
                                        <td>
                                            <select class="an-select bsa-cat-select" data-id="${t.id}" style="padding:4px 8px; font-size:0.8rem;">
                                                ${['Food', 'Rent', 'Bills', 'Transport', 'Shopping', 'Entertainment', 'Health', 'EMI', 'Salary', 'Business Income', 'Investments', 'Transfer', 'Other'].map(c => `
                                                    <option value="${c}" ${t.category === c ? 'selected' : ''}>${c}</option>
                                                `).join('')}
                                            </select>
                                        </td>
                                        <td>
                                            <span class="bsa-badge ${t.confidence === 'high' ? 'income' : 'review'}">
                                                ${t.confidence === 'high' ? 'High Confidence' : 'Needs Review'}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="bsa-row-del btn btn-secondary" data-id="${t.id}" style="padding:4px 8px; font-size:0.75rem; color:var(--text-muted);" title="Ignore item"><i class="fa-solid fa-xmark"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.bindReviewEvents();
    }

    bindReviewEvents() {
        const stmt = this.currentStatement;
        if (!stmt) return;

        document.getElementById('bsa-btn-back')?.addEventListener('click', () => {
            this.activeStep = 'upload';
            this.render();
        });

        // Handle Bank Name change
        document.getElementById('bsa-bank-name-select')?.addEventListener('change', (e) => {
            stmt.bankName = e.target.value;
        });

        // Handle dropdown new member creation
        document.getElementById('bsa-assign-person-select')?.addEventListener('change', async (e) => {
            if (e.target.value === '_NEW_MEMBER_') {
                const result = await showFormModal({
                    title: 'Create Family Member / Person',
                    icon: 'fa-solid fa-user-plus',
                    submitLabel: 'Create Member',
                    fields: [
                        { key: 'name', label: 'Member Name', type: 'text', placeholder: 'e.g. Isaac, Mom, Self', required: true }
                    ]
                });

                if (result && result.name.trim()) {
                    const name = result.name.trim();
                    const customPersons = this.storage.get('custom_persons') || [];
                    if (!customPersons.includes(name)) {
                        customPersons.push(name);
                        this.storage.set('custom_persons', customPersons);
                    }
                    this.activePerson = name;
                    this.renderReviewStep();
                } else {
                    e.target.value = this.activePerson || '';
                }
            } else {
                this.activePerson = e.target.value;
            }
        });

        // Filter toggles
        document.getElementById('bsa-filter-all')?.addEventListener('click', () => { this.filterStatus = 'all'; this.renderReviewStep(); });
        document.getElementById('bsa-filter-review')?.addEventListener('click', () => { this.filterStatus = 'review'; this.renderReviewStep(); });
        document.getElementById('bsa-filter-dup')?.addEventListener('click', () => { this.filterStatus = 'duplicate'; this.renderReviewStep(); });

        // Select / Deselect All
        document.getElementById('bsa-select-all')?.addEventListener('click', () => {
            stmt.transactions.forEach(t => t.selectedForImport = true);
            this.renderReviewStep();
        });

        document.getElementById('bsa-deselect-all')?.addEventListener('click', () => {
            stmt.transactions.forEach(t => t.selectedForImport = false);
            this.renderReviewStep();
        });

        document.getElementById('bsa-master-check')?.addEventListener('change', (e) => {
            stmt.transactions.forEach(t => t.selectedForImport = e.target.checked);
            this.renderReviewStep();
        });

        // Row checkbox toggles
        document.querySelectorAll('.bsa-row-check').forEach(box => {
            box.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const txn = stmt.transactions.find(x => x.id === id);
                if (txn) txn.selectedForImport = e.target.checked;
            });
        });

        // Category dropdown change
        document.querySelectorAll('.bsa-cat-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const id = sel.dataset.id;
                const txn = stmt.transactions.find(x => x.id === id);
                if (txn) {
                    txn.category = e.target.value;
                    txn.confidence = 'high';
                }
            });
        });

        // Remove row item
        document.querySelectorAll('.bsa-row-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                stmt.transactions = stmt.transactions.filter(x => x.id !== id);
                stmt.transactionCount = stmt.transactions.length;
                this.renderReviewStep();
            });
        });

        // Confirm & Import Selected Transactions
        document.getElementById('bsa-btn-confirm-import')?.addEventListener('click', async () => {
            const selected = stmt.transactions.filter(t => t.selectedForImport);
            if (selected.length === 0) {
                showToast('Please select at least one transaction to import.', 'error');
                return;
            }

            let targetPerson = document.getElementById('bsa-assign-person-select')?.value || this.activePerson || '';

            if (!targetPerson || targetPerson === '_NEW_MEMBER_') {
                const result = await showFormModal({
                    title: 'Assign Statement to Member',
                    icon: 'fa-solid fa-user-tag',
                    submitLabel: 'Assign & Import',
                    fields: [
                        { key: 'name', label: 'Family Member / Person Name', type: 'text', placeholder: 'e.g. Self, Isaac, Mom', required: true }
                    ]
                });

                if (!result || !result.name.trim()) {
                    showToast('Please specify a family member for this statement import.', 'warning');
                    return;
                }

                targetPerson = result.name.trim();
                const customPersons = this.storage.get('custom_persons') || [];
                if (!customPersons.includes(targetPerson)) {
                    customPersons.push(targetPerson);
                    this.storage.set('custom_persons', customPersons);
                }
            }

            // Save to database/storage with strict deduplication
            const dbTxns = this.storage.get('transactions') || [];
            let addedCount = 0;

            selected.forEach(t => {
                const numAmt = parseFloat(t.amount) || 0;
                if (numAmt <= 0) return;

                const isDup = dbTxns.some(ex => {
                    const sameDate = ex.date === t.date;
                    const sameAmt = Math.abs((parseFloat(ex.amount) || 0) - numAmt) < 0.01;
                    const samePerson = (ex.person || '').toLowerCase() === targetPerson.toLowerCase();
                    const sameTitle = ex.title && t.description && (ex.title.toLowerCase() === t.description.toLowerCase());
                    return sameDate && sameAmt && samePerson && sameTitle;
                });

                if (!isDup) {
                    addedCount++;
                    dbTxns.push({
                        id: 'txn_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                        title: t.description,
                        amount: numAmt,
                        category: t.category,
                        date: t.date,
                        type: t.type,
                        person: targetPerson,
                        reference: t.reference || '',
                        sourceStatementId: stmt.id
                    });
                }
            });
            this.storage.set('transactions', dbTxns);

            // Save statement record with person metadata
            stmt.person = targetPerson;
            const statements = this.storage.get('bank_statements') || [];
            if (!statements.some(s => s.id === stmt.id)) {
                statements.unshift(stmt);
                this.storage.set('bank_statements', statements);
            }

            showToast(`Imported ${selected.length} transactions for ${targetPerson}!`, 'success');
            this.activeStep = 'analysis';
            this.render();
        });
    }

    /**
     * Render Step 3: Post-Import Statement Financial Analysis Page
     */
    renderAnalysisStep() {
        const stmt = this.currentStatement;
        if (!stmt) {
            this.activeStep = 'upload';
            this.render();
            return;
        }

        const txns = stmt.transactions.filter(t => t.selectedForImport !== false);
        const credits = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const debits = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const netCashflow = credits - debits;

        // Categories Breakdown
        const categoryMap = {};
        txns.filter(t => t.type === 'expense').forEach(t => {
            categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
        });

        const categories = Object.entries(categoryMap)
            .map(([cat, amt]) => ({ category: cat, amount: amt, percentage: debits > 0 ? Math.round((amt / debits) * 100) : 0 }))
            .sort((a, b) => b.amount - a.amount);

        // Detect Recurring Payments
        const descCounts = {};
        txns.forEach(t => {
            const key = (t.merchant || t.description.substring(0, 15)).toUpperCase();
            if (!descCounts[key]) descCounts[key] = { merchant: t.merchant || t.description, count: 0, total: 0, category: t.category };
            descCounts[key].count++;
            descCounts[key].total += t.amount;
        });
        const recurringList = Object.values(descCounts).filter(x => x.count >= 2);

        // Detect Unusual Spending Spikes (> 2x average expense)
        const avgExpense = txns.filter(t => t.type === 'expense').length > 0 ? (debits / txns.filter(t => t.type === 'expense').length) : 0;
        const unusualSpikes = txns.filter(t => t.type === 'expense' && t.amount > (avgExpense * 2.5) && t.amount > 2000);

        this.container.innerHTML = `
            <div class="bsa-container">
                <div class="card" style="padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:2px;"><i class="fa-solid fa-chart-pie" style="color:var(--accent-color)"></i> Statement Analysis: ${stmt.bankName}</h2>
                            <p style="font-size:0.83rem; color:var(--text-muted); margin:0;">Statement Period: ${stmt.startDate} to ${stmt.endDate} (${txns.length} transactions)</p>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary" id="bsa-an-back"><i class="fa-solid fa-arrow-left"></i> Back to Analyzer</button>
                            <button class="btn btn-secondary" id="bsa-an-delete" style="background:rgba(229,57,53,0.12); color:var(--clr-red); border:1px solid var(--clr-red); font-size:0.83rem;"><i class="fa-solid fa-trash"></i> Delete Statement & Data</button>
                        </div>
                    </div>
                </div>

                <!-- KPI Summary Cards -->
                <div class="bsa-summary-bar">
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Total Statement Credits</div>
                        <div class="bsa-summary-val" style="color:var(--clr-green);">${formatINR(credits)}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Total Statement Debits</div>
                        <div class="bsa-summary-val" style="color:var(--clr-red);">${formatINR(debits)}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Net Cash Flow</div>
                        <div class="bsa-summary-val" style="color:${netCashflow >= 0 ? 'var(--clr-green)' : 'var(--clr-red)'};">${formatINR(netCashflow)}</div>
                    </div>
                    <div class="bsa-summary-card">
                        <div class="bsa-summary-label">Top Spending Category</div>
                        <div class="bsa-summary-val" style="font-size:1.05rem;">${categories[0]?.category || 'N/A'}</div>
                    </div>
                </div>

                <!-- Cash Flow Chart -->
                <div class="an-chart-card">
                    <h3 style="margin:0 0 12px; font-size:1.05rem; font-weight:700;"><i class="fa-solid fa-chart-line" style="color:var(--accent-color)"></i> Statement Cash Flow Trend</h3>
                    <div class="an-chart-container">
                        <canvas id="bsaAnalyticsChart"></canvas>
                    </div>
                </div>

                <!-- Analysis Grid -->
                <div class="an-grid-3">
                    <!-- Spending by Category -->
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fa-solid fa-pie-chart"></i> Category Breakdown</h2>
                        </div>
                        <div class="card-body">
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${categories.map(c => `
                                    <div>
                                        <div style="display:flex; justify-content:space-between; font-size:0.83rem; margin-bottom:4px;">
                                            <span style="font-weight:600;">${c.category}</span>
                                            <span>${formatINR(c.amount)} (${c.percentage}%)</span>
                                        </div>
                                        <div style="height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden;">
                                            <div style="height:100%; width:${c.percentage}%; background:var(--accent-color);"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Recurring Payments -->
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fa-solid fa-repeat"></i> Recurring Payments</h2>
                        </div>
                        <div class="card-body">
                            ${recurringList.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    ${recurringList.map(r => `
                                        <div style="padding:10px; background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color); font-size:0.83rem;">
                                            <div style="font-weight:700; color:var(--text-primary);">${r.merchant}</div>
                                            <div style="color:var(--text-muted); margin-top:2px;">${r.count} Occurrences • Avg: ${formatINR(r.total / r.count)}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div style="text-align:center; padding:16px; color:var(--text-muted);">No recurring patterns detected.</div>'}
                        </div>
                    </div>

                    <!-- Unusual Spending Spikes -->
                    <div class="card">
                        <div class="card-header">
                            <h2><i class="fa-solid fa-triangle-exclamation"></i> Spending Spikes</h2>
                        </div>
                        <div class="card-body">
                            ${unusualSpikes.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    ${unusualSpikes.map(s => `
                                        <div style="padding:10px; background:rgba(244,81,30,0.06); border-radius:var(--radius-md); border:1px solid var(--clr-orange); font-size:0.83rem;">
                                            <div style="font-weight:700; color:var(--clr-orange);">${s.description}</div>
                                            <div style="font-weight:700; color:var(--text-primary); margin-top:2px;">${formatINR(s.amount)} (${s.date})</div>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">Spike vs average expense</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div style="text-align:center; padding:16px; color:var(--text-muted);">No unusual spending spikes detected.</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('bsa-an-back')?.addEventListener('click', () => {
            this.activeStep = 'upload';
            this.render();
        });

        document.getElementById('bsa-an-delete')?.addEventListener('click', async () => {
            const ok = await showConfirmModal(`Delete analyzed statement "${stmt.fileName}" and ERASE all its imported transactions?`, { danger: true });
            if (ok) {
                // Delete statement record
                let statements = this.storage.get('bank_statements') || [];
                statements = statements.filter(s => s.id !== stmt.id);
                this.storage.set('bank_statements', statements);

                // Erase all transactions imported from this statement file
                let dbTxns = this.storage.get('transactions') || [];
                dbTxns = dbTxns.filter(t => t.sourceStatementId !== stmt.id);
                this.storage.set('transactions', dbTxns);

                showToast('Statement document and all its imported transactions were completely erased!', 'info');
                this.activeStep = 'upload';
                this.render();
            }
        });

        // Aggregate transactions by unique date for clean chart
        const dateBuckets = {};
        txns.forEach(t => {
            if (!t.date) return;
            if (!dateBuckets[t.date]) {
                dateBuckets[t.date] = { date: t.date, credits: 0, debits: 0 };
            }
            if (t.type === 'income') {
                dateBuckets[t.date].credits += t.amount;
            } else {
                dateBuckets[t.date].debits += t.amount;
            }
        });

        const sortedDates = Object.keys(dateBuckets).sort();
        const formattedLabels = sortedDates.map(dStr => {
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        });

        const creditData = sortedDates.map(dStr => dateBuckets[dStr].credits);
        const debitData = sortedDates.map(dStr => dateBuckets[dStr].debits);

        const ctx = document.getElementById('bsaAnalyticsChart');
        if (ctx && window.Chart) {
            Chart.defaults.color = '#ffffff';
            Chart.defaults.font.family = 'Inter';

            if (this.chartInstance) this.chartInstance.destroy();
            this.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: formattedLabels,
                    datasets: [
                        {
                            label: 'Credits (Income)',
                            data: creditData,
                            backgroundColor: 'rgba(67, 160, 71, 0.9)',
                            borderRadius: 4
                        },
                        {
                            label: 'Debits (Expenses)',
                            data: debitData,
                            backgroundColor: 'rgba(229, 57, 53, 0.9)',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#ffffff',
                                font: { weight: '600', size: 12 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${formatINR(context.parsed.y)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.12)' },
                            ticks: {
                                color: '#ffffff',
                                font: { weight: '600', size: 11 },
                                callback: (v) => formatINR(v)
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#ffffff',
                                font: { weight: '600', size: 11 },
                                maxRotation: 0,
                                autoSkip: true
                            }
                        }
                    }
                }
            });
        }
    }
}
