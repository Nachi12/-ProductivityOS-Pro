// js/modal.js
// Global in-page modal system — replaces all prompt() and confirm() calls
import { attachCurrencyFormatter, getRawValue } from './formatters.js';

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.id = 'global-modal-styles';
    style.textContent = `
        .gm-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.75);
            backdrop-filter: blur(8px); z-index: 20000;
            display: flex; align-items: center; justify-content: center;
            animation: gmFadeIn 0.2s ease;
        }
        .gm-overlay.closing { animation: gmFadeOut 0.15s ease forwards; }
        @keyframes gmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gmFadeOut { from { opacity: 1; } to { opacity: 0; } }
        .gm-dialog {
            background: var(--bg-card); border: 1px solid var(--border-color);
            border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
            width: 480px; max-width: 92vw; max-height: 85vh; overflow-y: auto;
            animation: gmSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes gmSlideUp {
            from { transform: translateY(16px) scale(0.97); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .gm-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 24px; border-bottom: 1px solid var(--border-light);
        }
        .gm-header h2 {
            font-size: 1.1rem; font-weight: 700; color: var(--text-primary);
            display: flex; align-items: center; gap: 8px; margin: 0;
        }
        .gm-close {
            width: 30px; height: 30px; border-radius: var(--radius-sm);
            border: none; background: transparent; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--text-muted); font-size: 1rem;
            transition: all var(--transition-fast);
        }
        .gm-close:hover { background: var(--bg-hover); color: var(--text-primary); }
        .gm-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
        .gm-field { display: flex; flex-direction: column; gap: 5px; }
        .gm-field label {
            font-size: 0.78rem; font-weight: 600; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.04em;
        }
        .gm-input {
            padding: 10px 14px; background: var(--bg-input);
            border: 1px solid var(--border-color); border-radius: var(--radius-sm);
            color: var(--text-primary); font-size: 0.92rem;
            font-family: var(--font-sans); transition: border-color var(--transition-fast);
        }
        .gm-input:focus { border-color: var(--accent-color); outline: none; box-shadow: 0 0 0 3px var(--accent-light); }
        .gm-input::placeholder { color: var(--text-muted); }
        .gm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .gm-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .gm-select-group { display: flex; gap: 8px; flex-wrap: wrap; }
        .gm-select-btn {
            flex: 1; min-width: 0; padding: 9px 10px; border: 1px solid var(--border-color);
            border-radius: var(--radius-sm); text-align: center; cursor: pointer;
            font-weight: 500; font-size: 0.82rem; background: var(--bg-input);
            color: var(--text-secondary); transition: all var(--transition-fast);
            white-space: nowrap;
        }
        .gm-select-btn:hover { background: var(--bg-hover); }
        .gm-select-btn.selected { background: var(--accent-light); border-color: var(--accent-color); color: var(--accent-color); }
        .gm-color-group { display: flex; gap: 8px; }
        .gm-color-btn {
            width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent;
            cursor: pointer; transition: all var(--transition-fast);
        }
        .gm-color-btn:hover { transform: scale(1.15); }
        .gm-color-btn.selected { border-color: var(--text-primary); box-shadow: 0 0 0 2px var(--bg-main); }
        .gm-footer {
            display: flex; justify-content: flex-end; gap: 10px;
            padding: 14px 24px; border-top: 1px solid var(--border-light);
        }
        .gm-footer .btn { padding: 10px 22px; font-size: 0.88rem; }
        .gm-confirm-icon { font-size: 2rem; color: var(--clr-red); margin-bottom: 4px; }
        .gm-confirm-msg { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; text-align: center; }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

// Creates overlay, mounts dialog, returns { overlay, dialog, close }
function createShell(title, icon) {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.className = 'gm-overlay';
    overlay.innerHTML = `
        <div class="gm-dialog">
            <div class="gm-header">
                <h2>${icon ? `<i class="${icon}"></i> ` : ''}${title}</h2>
                <button class="gm-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="gm-body"></div>
            <div class="gm-footer"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 160);
    };
    overlay.querySelector('.gm-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    return {
        overlay,
        body: overlay.querySelector('.gm-body'),
        footer: overlay.querySelector('.gm-footer'),
        close
    };
}

/**
 * showFormModal — open a form modal with configurable fields.
 * 
 * @param {Object} opts
 * @param {string} opts.title - Modal heading
 * @param {string} [opts.icon] - FontAwesome class for heading icon
 * @param {string} [opts.submitLabel] - Submit button text (default "Save")
 * @param {string} [opts.submitIcon] - Submit button icon class
 * @param {Array} opts.fields - Array of field definitions:
 *   { key, label, type, placeholder, value, required, options, colors }
 *   type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'color'
 *   options: [{value, label}] for 'select' type
 *   colors: [{value, label}] for 'color' type
 * @returns {Promise<Object|null>} - Resolved with field values or null if cancelled
 */
export function showFormModal(opts) {
    return new Promise((resolve) => {
        const { overlay, body, footer, close } = createShell(opts.title, opts.icon);
        const fieldEls = {};

        // Build fields
        (opts.fields || []).forEach(f => {
            const wrapper = document.createElement('div');
            wrapper.className = f._rowClass || 'gm-field';

            if (f.type === 'row') {
                // Row container — build children inside a row div
                wrapper.className = f.columns === 3 ? 'gm-row-3' : 'gm-row';
                f.children.forEach(child => {
                    const cell = document.createElement('div');
                    cell.className = 'gm-field';
                    cell.innerHTML = `<label>${child.label}</label>`;
                    const input = buildInput(child);
                    cell.appendChild(input);
                    wrapper.appendChild(cell);
                    fieldEls[child.key] = input;
                });
            } else if (f.type === 'select') {
                wrapper.innerHTML = `<label>${f.label}</label>`;
                const group = document.createElement('div');
                group.className = 'gm-select-group';
                (f.options || []).forEach(opt => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'gm-select-btn' + (opt.value === f.value ? ' selected' : '');
                    btn.dataset.value = opt.value;
                    btn.textContent = opt.label;
                    btn.addEventListener('click', () => {
                        group.querySelectorAll('.gm-select-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    });
                    group.appendChild(btn);
                });
                wrapper.appendChild(group);
                fieldEls[f.key] = group;
            } else if (f.type === 'dropdown') {
                wrapper.innerHTML = `<label>${f.label}</label>`;
                const select = document.createElement('select');
                select.className = 'gm-input';
                (f.options || []).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (opt.value === f.value) option.selected = true;
                    select.appendChild(option);
                });
                wrapper.appendChild(select);
                fieldEls[f.key] = select;
            } else if (f.type === 'color') {
                wrapper.innerHTML = `<label>${f.label}</label>`;
                const group = document.createElement('div');
                group.className = 'gm-color-group';
                (f.colors || []).forEach(c => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'gm-color-btn' + (c.value === f.value ? ' selected' : '');
                    btn.style.background = c.value;
                    btn.dataset.value = c.value;
                    btn.title = c.label || '';
                    btn.addEventListener('click', () => {
                        group.querySelectorAll('.gm-color-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    });
                    group.appendChild(btn);
                });
                wrapper.appendChild(group);
                fieldEls[f.key] = group;
            } else {
                wrapper.innerHTML = `<label>${f.label}</label>`;
                const input = buildInput(f);
                wrapper.appendChild(input);
                fieldEls[f.key] = input;
                if (f.type === 'amount') {
                    attachCurrencyFormatter(input);
                }
            }

            body.appendChild(wrapper);
        });

        // Footer buttons
        footer.innerHTML = `
            <button class="btn btn-secondary gm-cancel-btn">Cancel</button>
            <button class="btn btn-primary gm-submit-btn">${opts.submitIcon ? `<i class="${opts.submitIcon}"></i> ` : ''}${opts.submitLabel || 'Save'}</button>
        `;

        footer.querySelector('.gm-cancel-btn').addEventListener('click', () => { close(); resolve(null); });

        footer.querySelector('.gm-submit-btn').addEventListener('click', () => {
            const result = {};
            let valid = true;

            (opts.fields || []).forEach(f => {
                if (f.type === 'row') {
                    f.children.forEach(child => {
                        result[child.key] = getFieldValue(fieldEls[child.key], child);
                        if (child.required && !result[child.key]) {
                            fieldEls[child.key].style.borderColor = 'var(--clr-red)';
                            valid = false;
                        }
                    });
                } else if (f.type === 'select') {
                    const sel = fieldEls[f.key].querySelector('.selected');
                    result[f.key] = sel ? sel.dataset.value : (f.value || '');
                } else if (f.type === 'color') {
                    const sel = fieldEls[f.key].querySelector('.selected');
                    result[f.key] = sel ? sel.dataset.value : (f.value || '');
                } else {
                    result[f.key] = getFieldValue(fieldEls[f.key], f);
                    if (f.required && !result[f.key]) {
                        fieldEls[f.key].style.borderColor = 'var(--clr-red)';
                        valid = false;
                    }
                }
            });

            if (!valid) return;
            close();
            resolve(result);
        });

        // Focus first text input
        setTimeout(() => {
            const first = body.querySelector('input[type="text"], input[type="number"], textarea');
            if (first) first.focus();
        }, 120);

        // Enter on last single-line input submits
        body.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') footer.querySelector('.gm-submit-btn').click();
            });
        });
    });
}

function buildInput(f) {
    if (f.type === 'textarea') {
        const ta = document.createElement('textarea');
        ta.className = 'gm-input';
        ta.placeholder = f.placeholder || '';
        ta.value = f.value || '';
        ta.rows = f.rows || 3;
        return ta;
    }
    const inp = document.createElement('input');
    inp.className = 'gm-input';
    inp.type = (f.type === 'amount') ? 'text' : (f.type || 'text');
    inp.placeholder = f.placeholder || '';
    inp.value = f.value || '';
    if (f.min !== undefined) inp.min = f.min;
    if (f.max !== undefined) inp.max = f.max;
    if (f.step !== undefined) inp.step = f.step;
    return inp;
}

function getFieldValue(el, f) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (f.type === 'number') return el.value ? parseFloat(el.value) : '';
        if (f.type === 'amount') return getRawValue(el);
        return el.value.trim();
    }
    return '';
}

/**
 * showConfirmModal — replacement for confirm()
 * @param {string} message
 * @param {Object} [opts]
 * @param {string} [opts.title] - heading (default "Confirm")
 * @param {string} [opts.confirmLabel] - button text (default "Delete")
 * @param {boolean} [opts.danger] - if true, confirm button is red
 * @returns {Promise<boolean>}
 */
export function showConfirmModal(message, opts = {}) {
    return new Promise((resolve) => {
        const { overlay, body, footer, close } = createShell(opts.title || 'Confirm', 'fa-solid fa-triangle-exclamation');

        body.style.alignItems = 'center';
        body.style.padding = '28px 24px';
        body.innerHTML = `
            <div class="gm-confirm-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
            <div class="gm-confirm-msg">${message}</div>
        `;

        footer.innerHTML = `
            <button class="btn btn-secondary gm-cancel-btn">Cancel</button>
            <button class="btn ${opts.danger !== false ? 'btn-danger' : 'btn-primary'} gm-confirm-btn">${opts.confirmLabel || 'Delete'}</button>
        `;

        footer.querySelector('.gm-cancel-btn').addEventListener('click', () => { close(); resolve(false); });
        footer.querySelector('.gm-confirm-btn').addEventListener('click', () => { close(); resolve(true); });
    });
}

/**
 * showCustomModal — mount custom HTML with onMount callback for interactive elements
 */
export function showCustomModal(opts = {}) {
    return new Promise((resolve) => {
        const { overlay, body, footer, close } = createShell(opts.title || 'Notice', opts.icon || 'fa-solid fa-info-circle');
        body.innerHTML = opts.bodyHtml || '';

        footer.innerHTML = `
            <button class="btn btn-primary gm-done-btn">${opts.closeLabel || 'Done'}</button>
        `;

        footer.querySelector('.gm-done-btn').addEventListener('click', () => { close(); resolve(true); });

        if (typeof opts.onMount === 'function') {
            opts.onMount(body, close);
        }
    });
}

// Fail-safe re-export of showToast
export { showToast } from './toast.js';


