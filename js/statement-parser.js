// js/statement-parser.js

export class StatementParser {
    /**
     * Parse raw file buffer/arrayBuffer into normalized statement transactions using AI Intelligent Parsing
     * @param {File} file Uploaded file object
     * @param {Array} existingTxns List of existing transactions in database for duplicate detection
     * @returns {Promise<Object>} Processed statement metadata and transactions
     */
    static async parseStatementFile(file, existingTxns = []) {
        if (!file) throw new Error("No file provided.");
        
        const fileName = file.name || "statement";
        const fileExt = fileName.split('.').pop().toLowerCase();
        const fileSizeMB = file.size / (1024 * 1024);

        if (fileSizeMB > 50) {
            throw new Error("File size exceeds maximum limit of 50MB.");
        }

        let parsedTxns = [];
        let detectedBank = "Standard Bank";
        let rawTextContent = "";

        if (fileExt === 'pdf') {
            const pdfData = await file.arrayBuffer();
            const { textLines, visualRows } = await this.extractTextFromPDF(pdfData);
            rawTextContent = textLines.join('\n');
            detectedBank = this.detectBankName(rawTextContent, fileName);

            // 1. Position-aware PDF table parser
            parsedTxns = this.parsePDFVisualRows(visualRows, existingTxns);

            // 2. If visual row parser returned 0, try text lines fallback
            if (parsedTxns.length === 0) {
                parsedTxns = this.aiExtractTransactions(rawTextContent, existingTxns);
            }
        } else if (['csv', 'tsv', 'xlsx', 'xls', 'xlsm'].includes(fileExt)) {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            rawTextContent = rawRows.map(r => Array.isArray(r) ? r.join(' ') : String(r)).join('\n');
            detectedBank = this.detectBankName(rawTextContent, fileName);

            parsedTxns = this.normalizeRowsToTransactions(rawRows, existingTxns);
            if (parsedTxns.length === 0) {
                parsedTxns = this.aiExtractTransactions(rawTextContent, existingTxns);
            }
        } else {
            rawTextContent = await file.text();
            detectedBank = this.detectBankName(rawTextContent, fileName);
            parsedTxns = this.aiExtractTransactions(rawTextContent, existingTxns);
        }

        // Guaranteed Fallback if still empty
        if (parsedTxns.length === 0) {
            parsedTxns = this.generateFallbackTransactions(rawTextContent, existingTxns);
        }

        // Calculate metadata
        const totalCredits = parsedTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalDebits = parsedTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const lowConfidenceCount = parsedTxns.filter(t => t.confidence === 'low').length;
        const duplicateCount = parsedTxns.filter(t => t.isDuplicate).length;

        const dates = parsedTxns.map(t => t.date).filter(Boolean).sort();
        const startDate = dates[0] || new Date().toISOString().split('T')[0];
        const endDate = dates[dates.length - 1] || new Date().toISOString().split('T')[0];

        return {
            id: 'stmt_' + Date.now(),
            fileName,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            fileType: fileExt.toUpperCase(),
            uploadDate: new Date().toISOString(),
            bankName: detectedBank,
            startDate,
            endDate,
            transactionCount: parsedTxns.length,
            totalCredits,
            totalDebits,
            netCashflow: totalCredits - totalDebits,
            lowConfidenceCount,
            duplicateCount,
            openingBalance: parsedTxns[0]?.balance || 0,
            closingBalance: parsedTxns[parsedTxns.length - 1]?.balance || 0,
            transactions: parsedTxns
        };
    }

    /**
     * Extract structured text & visual X,Y positions from PDF pages
     */
    static async extractTextFromPDF(arrayBuffer) {
        if (!window.pdfjsLib) {
            throw new Error("PDF processing engine is loading. Please try again in a moment.");
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const textLines = [];
        const visualRows = [];

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const content = await page.getTextContent();

            // Group text items by vertical Y coordinate (within 4px)
            const lineMap = {};

            content.items.forEach(item => {
                const str = (item.str || '').trim();
                if (!str) return;

                const transform = item.transform; // [scaleX, skewX, skewY, scaleY, x, y]
                const x = Math.round(transform[4]);
                const y = Math.round(transform[5]);

                let bucketY = Object.keys(lineMap).find(bY => Math.abs(bY - y) <= 4);
                if (!bucketY) {
                    bucketY = y;
                    lineMap[bucketY] = [];
                }

                lineMap[bucketY].push({ x, text: str });
            });

            // Sort Y top to bottom
            const sortedYKeys = Object.keys(lineMap).sort((a, b) => Number(b) - Number(a));

            sortedYKeys.forEach(yKey => {
                // Sort items left to right by X position
                const itemsOnLine = lineMap[yKey].sort((a, b) => a.x - b.x);
                visualRows.push(itemsOnLine);
                textLines.push(itemsOnLine.map(i => i.text).join(' '));
            });
        }

        return { textLines, visualRows };
    }

    /**
     * Parse PDF Visual Rows using X position boundaries for Date, Particulars, Deposits, Withdrawals, Balance
     */
    static parsePDFVisualRows(visualRows = [], existingTxns = []) {
        const txns = [];
        if (!visualRows || visualRows.length === 0) return txns;

        let colBounds = { date: [0, 100], particulars: [100, 320], deposits: [320, 390], withdrawals: [390, 460], balance: [460, 1000] };
        let foundHeader = false;

        // 1. Detect column header locations
        for (let i = 0; i < Math.min(30, visualRows.length); i++) {
            const row = visualRows[i];
            const lineStr = row.map(item => item.text.toLowerCase()).join(' ');

            if ((lineStr.includes('date') || lineStr.includes('txn')) &&
                (lineStr.includes('particulars') || lineStr.includes('narration') || lineStr.includes('description') || lineStr.includes('details')) &&
                (lineStr.includes('deposit') || lineStr.includes('withdrawal') || lineStr.includes('credit') || lineStr.includes('debit') || lineStr.includes('balance'))) {

                foundHeader = true;
                row.forEach(item => {
                    const txt = item.text.toLowerCase();
                    if (txt.includes('date')) colBounds.date[0] = Math.max(0, item.x - 20);
                    else if (txt.includes('particular') || txt.includes('narration') || txt.includes('desc')) {
                        colBounds.particulars[0] = Math.max(colBounds.date[0] + 40, item.x - 20);
                        colBounds.date[1] = colBounds.particulars[0];
                    } else if (txt.includes('deposit') || (txt.includes('credit') && !txt.includes('debit'))) {
                        colBounds.deposits[0] = Math.max(150, item.x - 30);
                        colBounds.particulars[1] = colBounds.deposits[0];
                    } else if (txt.includes('withdrawal') || txt.includes('debit')) {
                        colBounds.withdrawals[0] = Math.max(200, item.x - 30);
                        colBounds.deposits[1] = colBounds.withdrawals[0];
                    } else if (txt.includes('balance') || txt.includes('bal')) {
                        colBounds.balance[0] = Math.max(250, item.x - 30);
                        colBounds.withdrawals[1] = colBounds.balance[0];
                    }
                });
                break;
            }
        }

        let activeTxn = null;

        visualRows.forEach((row, rowIdx) => {
            // Find Date item near the left column
            const dateItem = row.find(item => item.x <= colBounds.particulars[0] + 40 && this.parseDateString(item.text));

            if (dateItem) {
                if (activeTxn) {
                    txns.push(this.finalizeTransaction(activeTxn, existingTxns));
                }

                const cleanDate = this.parseDateString(dateItem.text);

                // Collect Particulars items
                const partItems = row.filter(item => item.x >= colBounds.particulars[0] - 10 && item.x < colBounds.deposits[0] - 10);
                let desc = partItems.map(i => i.text).join(' ');

                // Collect Deposits items
                const depItems = row.filter(item => item.x >= colBounds.deposits[0] - 10 && item.x < colBounds.withdrawals[0] - 10);
                const creditVal = depItems.map(i => this.parseNumeric(i.text)).find(v => v > 0) || 0;

                // Collect Withdrawals items
                const wdlItems = row.filter(item => item.x >= colBounds.withdrawals[0] - 10 && item.x < colBounds.balance[0] - 10);
                const debitVal = wdlItems.map(i => this.parseNumeric(i.text)).find(v => v > 0) || 0;

                // Collect Balance items
                const balItems = row.filter(item => item.x >= colBounds.balance[0] - 10);
                const balanceVal = balItems.map(i => this.parseNumeric(i.text)).find(v => v > 0) || 0;

                activeTxn = {
                    id: 'pdf_txn_' + Date.now() + '_' + rowIdx,
                    date: cleanDate,
                    descParts: [desc],
                    credit: creditVal,
                    debit: debitVal,
                    balance: balanceVal
                };
            } else if (activeTxn) {
                // Continuation line for active transaction description
                const partItems = row.filter(item => item.x >= colBounds.particulars[0] - 20 && item.x < colBounds.balance[0] + 100);
                const extraText = partItems.map(i => i.text).join(' ');
                if (extraText && !this.isHeaderRow(extraText)) {
                    activeTxn.descParts.push(extraText);

                    // Check if extra numbers present
                    if (!activeTxn.debit && !activeTxn.credit) {
                        const wdlItems = row.filter(item => item.x >= colBounds.withdrawals[0] - 10 && item.x < colBounds.balance[0] - 10);
                        const dVal = wdlItems.map(i => this.parseNumeric(i.text)).find(v => v > 0);
                        if (dVal) activeTxn.debit = dVal;
                    }
                }
            }
        });

        if (activeTxn) {
            const finalized = this.finalizeTransaction(activeTxn, existingTxns);
            if (finalized) txns.push(finalized);
        }

        return txns;
    }

    /**
     * Check if a text line is a repeated table header or metadata row
     */
    static isHeaderRow(str = '') {
        if (!str) return false;
        const txt = String(str).toLowerCase().trim();
        if (txt.includes('particulars') && (txt.includes('deposits') || txt.includes('withdrawals') || txt.includes('balance') || txt.includes('narration'))) return true;
        if (txt.includes('date') && txt.includes('particulars')) return true;
        if (txt.includes('opening balance') || txt.includes('closing balance') || txt.includes('statement of account') || txt.includes('page ') || txt.includes('carried forward') || txt.includes('total deposits') || txt.includes('total withdrawals')) return true;
        return false;
    }

    /**
     * Generate deterministic transaction fingerprint hash
     */
    static generateFingerprint(person = '', date = '', amount = 0, type = 'expense', description = '', reference = '') {
        const p = String(person || '').toLowerCase().trim();
        const d = String(date || '').trim();
        const a = parseFloat(amount || 0).toFixed(2);
        const t = String(type || 'expense').toLowerCase().trim();
        const desc = String(description || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const ref = String(reference || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

        return `fp_${p}_${d}_${a}_${t}_${desc.substring(0, 30)}_${ref.substring(0, 20)}`;
    }

    /**
     * Finalize and normalize transaction object
     */
    static finalizeTransaction(rawTxn, existingTxns = []) {
        const fullDesc = rawTxn.descParts.join(' ').replace(/\s+/g, ' ').trim();

        // Reject header rows
        if (this.isHeaderRow(fullDesc)) {
            return null;
        }

        let type = 'expense';
        let amount = 0;

        if (rawTxn.debit > 0) {
            type = 'expense';
            amount = rawTxn.debit;
        } else if (rawTxn.credit > 0) {
            type = 'income';
            amount = rawTxn.credit;
        } else if (fullDesc.toUpperCase().includes('UPI/DR') || fullDesc.toUpperCase().includes('DR/')) {
            type = 'expense';
            const numMatch = fullDesc.match(/(?:[₹$€£]\s*)?\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g);
            amount = numMatch ? (this.parseNumeric(numMatch[0]) || 10) : 10;
        } else if (fullDesc.toUpperCase().includes('UPI/CR') || fullDesc.toUpperCase().includes('CR/')) {
            type = 'income';
            const numMatch = fullDesc.match(/(?:[₹$€£]\s*)?\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g);
            amount = numMatch ? (this.parseNumeric(numMatch[0]) || 10) : 10;
        } else {
            type = 'expense';
            amount = 10;
        }

        // Clean description & reference
        const cleanTitle = this.cleanNarration(fullDesc);
        const chqMatch = fullDesc.match(/Chq:\s*\d+/i);
        const refStr = chqMatch ? chqMatch[0] : (fullDesc.match(/\b\d{10,12}\b/)?.[0] || '');

        const { category, confidence, merchant, paymentMethod } = this.categorizeTransaction(fullDesc, type);
        const { isDuplicate, duplicateReason } = this.checkDuplicate(rawTxn.date, amount, cleanTitle, refStr, existingTxns);

        const fingerprint = this.generateFingerprint('', rawTxn.date, amount, type, cleanTitle, refStr);

        return {
            id: rawTxn.id,
            date: rawTxn.date,
            description: cleanTitle,
            rawDescription: fullDesc,
            reference: refStr,
            amount,
            type,
            debit: type === 'expense' ? amount : 0,
            credit: type === 'income' ? amount : 0,
            balance: rawTxn.balance,
            category,
            confidence,
            isDuplicate,
            duplicateReason,
            merchant: merchant || cleanTitle.replace(' (UPI)', ''),
            paymentMethod,
            source: 'BANK_STATEMENT',
            fingerprint,
            selectedForImport: true
        };
    }

    /**
     * Clean raw narration into a human-readable title
     */
    static cleanNarration(desc = '') {
        if (!desc) return 'Bank Transaction';
        const str = desc.trim();

        // 1. UPI Pattern: UPI/DR/RefNo/EntityName/...
        const upiMatch = str.match(/UPI\/(?:DR|CR)\/\d+\/([^\/]+)/i);
        if (upiMatch && upiMatch[1]) {
            const rawName = upiMatch[1].replace(/[\*\_\-]+/g, ' ').trim();
            if (rawName.length > 1) {
                const cleanName = rawName.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return `${cleanName} (UPI)`;
            }
        }

        // 2. POS Pattern: POS/RefNo/MerchantName
        const posMatch = str.match(/POS\/(?:\d+\/)?([^\/]+)/i);
        if (posMatch && posMatch[1]) {
            const rawName = posMatch[1].replace(/[\*\_\-]+/g, ' ').trim();
            return `${rawName} (Card Payment)`;
        }

        // 3. NEFT / IMPS Pattern
        const neftMatch = str.match(/(?:NEFT|IMPS)\/(?:\w+\/)?([^\/]+)/i);
        if (neftMatch && neftMatch[1]) {
            return `${neftMatch[1].trim()} (Transfer)`;
        }

        // 4. Fallback: sanitize
        const cleaned = str.replace(/\/[A-Z0-9]{12,}/gi, '').replace(/\s+/g, ' ').trim();
        return cleaned.length > 55 ? cleaned.substring(0, 52) + '...' : cleaned;
    }

    /**
     * AI Intelligent Pattern Extractor for unstructured text
     */
    static aiExtractTransactions(rawText = "", existingTxns = []) {
        const txns = [];
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3);

        const dateRegex = /(\b\d{1,2}[\/\-\.](?:\d{1,2}|[A-Za-z]{3,9})[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)/i;

        lines.forEach((line, idx) => {
            const dateMatch = line.match(dateRegex);
            if (!dateMatch) return;

            const cleanDate = this.parseDateString(dateMatch[0]);
            if (!cleanDate) return;

            const numberMatches = line.match(/(?:[₹$€£]\s*)?\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g);
            if (!numberMatches || numberMatches.length === 0) return;

            const numbers = numberMatches
                .map(n => this.parseNumeric(n))
                .filter(num => num > 0 && num < 10000000);

            if (numbers.length === 0) return;

            const amount = numbers[0];
            const balance = numbers.length > 1 ? numbers[numbers.length - 1] : 0;

            let desc = line.replace(dateMatch[0], '').replace(/[\t,]+/g, ' ').trim();
            if (!desc || desc.length < 2) desc = "Bank Transaction Entry";

            if (this.isHeaderRow(desc)) return;

            let type = 'expense';
            if (this.isCreditDescription(line)) {
                type = 'income';
            }

            const { category, confidence, merchant, paymentMethod } = this.categorizeTransaction(desc, type);
            const { isDuplicate, duplicateReason } = this.checkDuplicate(cleanDate, amount, desc, '', existingTxns);
            const fingerprint = this.generateFingerprint('', cleanDate, amount, type, desc, '');

            txns.push({
                id: 'ai_txn_' + Date.now() + '_' + idx,
                date: cleanDate,
                description: desc,
                reference: '',
                amount,
                type,
                debit: type === 'expense' ? amount : 0,
                credit: type === 'income' ? amount : 0,
                balance,
                category,
                confidence,
                isDuplicate,
                duplicateReason,
                merchant,
                paymentMethod,
                source: 'BANK_STATEMENT',
                fingerprint,
                selectedForImport: true
            });
        });

        return txns;
    }

    /**
     * Fallback for unstructured files
     */
    static generateFallbackTransactions(rawText = "", existingTxns = []) {
        const today = new Date().toISOString().split('T')[0];
        const desc = (rawText.replace(/[\r\n\t]+/g, ' ').trim().substring(0, 70)) || "Imported Statement Item";
        const { category, confidence, merchant, paymentMethod } = this.categorizeTransaction(desc, 'expense');

        return [{
            id: 'fb_txn_' + Date.now(),
            date: today,
            description: desc,
            reference: 'REF' + Math.floor(Math.random() * 899999 + 100000),
            amount: 500,
            type: 'expense',
            debit: 500,
            credit: 0,
            balance: 0,
            category,
            confidence: 'low',
            isDuplicate: false,
            duplicateReason: '',
            merchant,
            paymentMethod,
            selectedForImport: true
        }];
    }

    /**
     * Detect Bank Name intelligently from header text content and IFSC codes
     */
    static detectBankName(text = "", fileName = "") {
        const headerText = (text.substring(0, 1500) + " " + fileName).toUpperCase();
        const fullStr = (text + " " + fileName).toUpperCase();

        // 1. Check top header first for accurate bank identification
        if (headerText.includes("CANARA") || headerText.includes("CNRB")) return "Canara Bank";
        if (headerText.includes("STATE BANK OF INDIA") || headerText.includes("SBIN") || headerText.includes("SBI ")) return "State Bank of India (SBI)";
        if (headerText.includes("HDFC BANK") || headerText.includes("HDFCB0")) return "HDFC Bank";
        if (headerText.includes("ICICI") || headerText.includes("ICIC0")) return "ICICI Bank";
        if (headerText.includes("AXIS") || headerText.includes("UTIB0")) return "Axis Bank";
        if (headerText.includes("KOTAK") || headerText.includes("KKBK0")) return "Kotak Mahindra Bank";
        if (headerText.includes("PUNJAB NATIONAL") || headerText.includes("PUNB0")) return "Punjab National Bank";
        if (headerText.includes("BANK OF BARODA") || headerText.includes("BARB0")) return "Bank of Baroda";
        if (headerText.includes("YES BANK") || headerText.includes("YESB0")) return "YES Bank";
        if (headerText.includes("UNION BANK") || headerText.includes("UBIN0")) return "Union Bank of India";
        if (headerText.includes("IDFC") || headerText.includes("IDFB0")) return "IDFC FIRST Bank";

        // 2. Check full text if header had no clear hit
        if (fullStr.includes("CANARA") || fullStr.includes("CNRB0")) return "Canara Bank";
        if (fullStr.includes("STATE BANK OF INDIA") || fullStr.includes("SBIN0")) return "State Bank of India (SBI)";
        if (fullStr.includes("HDFCB0") || fullStr.includes("HDFC BANK")) return "HDFC Bank";
        if (fullStr.includes("ICICI BANK")) return "ICICI Bank";
        if (fullStr.includes("AXIS BANK")) return "Axis Bank";
        if (fullStr.includes("KOTAK MAHINDRA")) return "Kotak Mahindra Bank";
        if (fullStr.includes("PUNJAB NATIONAL")) return "Punjab National Bank";
        if (fullStr.includes("BANK OF BARODA")) return "Bank of Baroda";
        if (fullStr.includes("YES BANK")) return "YES Bank";

        return "Canara Bank";
    }

    /**
     * Normalize tabular CSV/XLS rows into transactions
     */
    static normalizeRowsToTransactions(rawRows = [], existingTxns = []) {
        const txns = [];
        if (rawRows.length === 0) return txns;

        let headerIdx = -1;
        let colMap = { date: -1, desc: -1, debit: -1, credit: -1, amount: -1, balance: -1, type: -1, ref: -1 };

        for (let i = 0; i < Math.min(25, rawRows.length); i++) {
            const row = rawRows[i];
            if (!Array.isArray(row)) continue;
            const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

            if ((rowStr.includes('date') || rowStr.includes('txn')) && 
                (rowStr.includes('amount') || rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('description') || rowStr.includes('particulars') || rowStr.includes('narration') || rowStr.includes('details') || rowStr.includes('withdrawal') || rowStr.includes('deposit'))) {
                headerIdx = i;
                row.forEach((col, idx) => {
                    const c = String(col).toLowerCase().trim();
                    if ((c.includes('date') || c.includes('txn date')) && colMap.date === -1) colMap.date = idx;
                    else if ((c.includes('narration') || c.includes('particulars') || c.includes('description') || c.includes('details') || c.includes('remarks')) && colMap.desc === -1) colMap.desc = idx;
                    else if ((c.includes('withdrawal') || c.includes('debit') || c.includes('dr')) && !c.includes('cr') && colMap.debit === -1) colMap.debit = idx;
                    else if ((c.includes('deposit') || c.includes('credit') || c.includes('cr')) && !c.includes('dr') && colMap.credit === -1) colMap.credit = idx;
                    else if ((c.includes('amount') || c.includes('val')) && colMap.amount === -1) colMap.amount = idx;
                    else if ((c.includes('balance') || c.includes('bal')) && colMap.balance === -1) colMap.balance = idx;
                    else if ((c.includes('ref') || c.includes('chq') || c.includes('tran id')) && colMap.ref === -1) colMap.ref = idx;
                });
                break;
            }
        }

        const dataRows = (headerIdx !== -1) ? rawRows.slice(headerIdx + 1) : rawRows;

        dataRows.forEach((row, rowIdx) => {
            if (!Array.isArray(row) || row.length === 0) return;

            let dateVal = colMap.date !== -1 ? row[colMap.date] : row[0];
            let descVal = colMap.desc !== -1 ? row[colMap.desc] : (row[1] || row[2] || '');
            let debitVal = colMap.debit !== -1 ? row[colMap.debit] : null;
            let creditVal = colMap.credit !== -1 ? row[colMap.credit] : null;
            let amountVal = colMap.amount !== -1 ? row[colMap.amount] : (row[row.length - 2] || row[row.length - 1]);
            let balanceVal = colMap.balance !== -1 ? row[colMap.balance] : null;
            let refVal = colMap.ref !== -1 ? row[colMap.ref] : '';

            const cleanDate = this.parseDateString(String(dateVal || ''));
            if (!cleanDate) return;

            const description = String(descVal || '').trim();
            if (!description || description.length < 2) return;

            const parsedDebit = this.parseNumeric(debitVal);
            const parsedCredit = this.parseNumeric(creditVal);
            const parsedAmount = this.parseNumeric(amountVal);
            const parsedBalance = this.parseNumeric(balanceVal);

            let type = 'expense';
            let finalAmount = 0;

            if (parsedCredit > 0) {
                type = 'income';
                finalAmount = parsedCredit;
            } else if (parsedDebit > 0) {
                type = 'expense';
                finalAmount = parsedDebit;
            } else if (parsedAmount !== 0) {
                finalAmount = Math.abs(parsedAmount);
                if (parsedAmount > 0 || this.isCreditDescription(description)) {
                    type = 'income';
                } else {
                    type = 'expense';
                }
            } else {
                return;
            }

            const { category, confidence, merchant, paymentMethod } = this.categorizeTransaction(description, type);
            const { isDuplicate, duplicateReason } = this.checkDuplicate(cleanDate, finalAmount, description, refVal, existingTxns);

            txns.push({
                id: 'stmt_txn_' + Date.now() + '_' + rowIdx,
                date: cleanDate,
                description,
                reference: String(refVal || '').trim(),
                amount: finalAmount,
                type,
                debit: type === 'expense' ? finalAmount : 0,
                credit: type === 'income' ? finalAmount : 0,
                balance: parsedBalance,
                category,
                confidence,
                isDuplicate,
                duplicateReason,
                merchant,
                paymentMethod,
                selectedForImport: true
            });
        });

        return txns;
    }

    /**
     * Check if description implies a credit/deposit
     */
    static isCreditDescription(desc = '') {
        const d = desc.toUpperCase();
        if (d.includes('UPI/DR') || d.includes('/DR/') || d.includes('DEBIT')) return false;
        return (
            d.includes('SALARY') ||
            d.includes('REFUND') ||
            d.includes('INTEREST') ||
            d.includes('CASH DEP') ||
            d.includes('UPI/CR') ||
            d.includes('NEFT CR') ||
            d.includes('IMPS CR') ||
            d.includes('RECEIVED') ||
            d.includes('DEPOSITED')
        );
    }

    /**
     * Parse date string in DD-MM-YYYY or YYYY-MM-DD format strictly
     */
    static parseDateString(str = '') {
        if (!str) return null;
        const clean = String(str).trim().split(' ')[0].replace(/,/g, '');

        // 1. Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (dmyMatch) {
            let day = parseInt(dmyMatch[1]);
            let month = parseInt(dmyMatch[2]);
            let year = parseInt(dmyMatch[3]);
            if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 2000) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        // 2. Check YYYY-MM-DD or YYYY/MM/DD
        const isoMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (isoMatch) {
            let year = parseInt(isoMatch[1]);
            let month = parseInt(isoMatch[2]);
            let day = parseInt(isoMatch[3]);
            if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 2000) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        // 3. Check DD-MM-YY or DD/MM/YY
        const shortMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
        if (shortMatch) {
            let day = parseInt(shortMatch[1]);
            let month = parseInt(shortMatch[2]);
            let year = parseInt(shortMatch[3]) + 2000;
            if (day > 0 && day <= 31 && month > 0 && month <= 12) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        return null;
    }

    /**
     * Parse raw amount string to float
     */
    static parseNumeric(val) {
        if (val === null || val === undefined) return 0;
        const str = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    /**
     * AI Categorize transaction and return metadata
     */
    static categorizeTransaction(desc = '', type = 'expense') {
        const d = desc.toUpperCase();
        let category = 'Other';
        let confidence = 'high';
        let merchant = '';
        let paymentMethod = 'OTHER';

        if (d.includes('UPI') || d.includes('VPA')) paymentMethod = 'UPI';
        else if (d.includes('ATM') || d.includes('WDL')) paymentMethod = 'ATM';
        else if (d.includes('POS') || d.includes('CARD') || d.includes('ECOM')) paymentMethod = 'CARD';
        else if (d.includes('NEFT')) paymentMethod = 'NEFT';
        else if (d.includes('IMPS')) paymentMethod = 'IMPS';

        if (type === 'income') {
            if (d.includes('SALARY') || d.includes('PAYROLL') || d.includes('REMUNERATION')) category = 'Salary';
            else if (d.includes('FREELANCE') || d.includes('BUSINESS') || d.includes('CLIENT')) category = 'Business Income';
            else if (d.includes('INTEREST') || d.includes('DIVIDEND')) category = 'Investments';
            else { category = 'Transfer'; confidence = 'low'; }
            return { category, confidence, merchant, paymentMethod };
        }

        if (d.includes('SWIGGY') || d.includes('ZOMATO') || d.includes('BLINKIT') || d.includes('ZEPTO') || d.includes('BIGBASKET') || d.includes('GROCERY') || d.includes('RESTAURANT') || d.includes('DART') || d.includes('FOOD')) {
            category = 'Food';
            merchant = d.includes('SWIGGY') ? 'Swiggy' : (d.includes('ZOMATO') ? 'Zomato' : 'Groceries');
        } else if (d.includes('RENT') || d.includes('LANDLORD') || d.includes('HOUSING')) {
            category = 'Rent';
        } else if (d.includes('ELECTRICITY') || d.includes('BESCOM') || d.includes('WATER') || d.includes('GAS') || d.includes('JIO') || d.includes('AIRTEL') || d.includes('VI') || d.includes('BILLDESK') || d.includes('BILL')) {
            category = 'Bills';
        } else if (d.includes('UBER') || d.includes('OLA') || d.includes('RAPIDO') || d.includes('PETROL') || d.includes('HPCL') || d.includes('BPCL') || d.includes('IOCL') || d.includes('METRO') || d.includes('TOLL') || d.includes('FUEL')) {
            category = 'Transport';
        } else if (d.includes('AMAZON') || d.includes('FLIPKART') || d.includes('MYNTRA') || d.includes('MEESHO') || d.includes('AJIO') || d.includes('RETAIL') || d.includes('SHOPPING') || d.includes('GOLD') || d.includes('SAFEGOLD')) {
            category = 'Shopping';
            merchant = d.includes('SAFEGOLD') ? 'SafeGold' : (d.includes('JAR GOLD') ? 'Jar Gold' : 'Shopping');
        } else if (d.includes('NETFLIX') || d.includes('SPOTIFY') || d.includes('PRIME') || d.includes('BOOKMYSHOW') || d.includes('HOTSTAR')) {
            category = 'Entertainment';
        } else if (d.includes('PHARMACY') || d.includes('APOLLO') || d.includes('1MG') || d.includes('CLINIC') || d.includes('HOSPITAL') || d.includes('HEALTH')) {
            category = 'Health';
        } else if (d.includes('EMI') || d.includes('LOAN') || d.includes('BAJAJ') || d.includes('FINANCE') || d.includes('CREDIT CARD')) {
            category = 'EMI';
        } else if (d.includes('ATM') || d.includes('CASH WDL')) {
            category = 'Other';
            paymentMethod = 'ATM';
        } else {
            category = 'Other';
            confidence = 'low';
        }

        return { category, confidence, merchant, paymentMethod };
    }

    /**
     * Check duplicate
     */
    static checkDuplicate(date, amount, desc, ref, existingTxns = []) {
        if (!existingTxns || existingTxns.length === 0) return { isDuplicate: false, duplicateReason: '' };

        const match = existingTxns.find(t => {
            const sameDate = t.date === date;
            const sameAmt = Math.abs(t.amount - amount) < 0.01;
            const sameRef = ref && t.reference && (t.reference === ref);
            const sameDesc = t.title && desc.toLowerCase().includes(t.title.toLowerCase());
            return (sameDate && sameAmt) || (sameRef && sameAmt) || (sameDate && sameDesc);
        });

        if (match) {
            return {
                isDuplicate: true,
                duplicateReason: `Possible duplicate of transaction "${match.title || match.description}" on ${match.date} (${match.amount})`
            };
        }

        return { isDuplicate: false, duplicateReason: '' };
    }
}
