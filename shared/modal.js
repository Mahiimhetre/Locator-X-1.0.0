class LocatorXModal {
    constructor() {
        this.overlay = null;
        this.resolvePromise = null;
        this.init();
    }

    init() {
        // Create modal DOM if not exists
        if (!document.querySelector('.locator-x-modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'locator-x-modal-overlay';
            overlay.innerHTML = `
                <div class="locator-x-modal">
                    <div class="modal-header">
                        <span class="modal-title"></span>
                        <i class="bi-x modal-close"></i>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <button class="modal-btn secondary" data-action="cancel">Cancel</button>
                        <button class="modal-btn primary" data-action="confirm">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            this.overlay = overlay;

            // Event Listeners
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close(null);
            });

            this.overlay.querySelector('.modal-close').addEventListener('click', () => this.close(null));

            this.overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close(null));

            this.overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => this.handleConfirm());

            // Input Enter key
            this.overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                    this.handleConfirm();
                }
                if (e.key === 'Escape') {
                    this.close(null);
                }
            });
        } else {
            this.overlay = document.querySelector('.locator-x-modal-overlay');
        }
    }

    show(options = {}) {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;

            const titleEl = this.overlay.querySelector('.modal-title');
            const bodyEl = this.overlay.querySelector('.modal-body');
            const confirmBtn = this.overlay.querySelector('[data-action="confirm"]');
            const cancelBtn = this.overlay.querySelector('[data-action="cancel"]');

            titleEl.textContent = options.title || 'Locator-X';
            confirmBtn.textContent = options.confirmText || 'Confirm';
            cancelBtn.style.display = options.hideCancel ? 'none' : 'block';

            // Optional Icon Support (User can pass 'bi-trash', etc.)
            let contentHtml = '';
            if (options.icon) {
                contentHtml += `<div style="text-align: center; margin-bottom: 12px;"><i class="${options.icon}" style="font-size: 24px; color: var(--accent);"></i></div>`;
            }

            // Message Content
            contentHtml += `<div style="margin-bottom: 8px; line-height: 1.5; color: var(--primary-text);">${options.message || ''}</div>`;

            if (options.type === 'prompt') {
                contentHtml += `
                    <input type="text" class="modal-input" value="${options.value || ''}" placeholder="${options.placeholder || ''}" autofocus>
                `;
            }

            bodyEl.innerHTML = contentHtml;

            this.overlay.classList.add('active');

            if (options.type === 'prompt') {
                setTimeout(() => {
                    const input = bodyEl.querySelector('input');
                    if (input) {
                        input.focus();
                        input.select();
                    }
                }, 100);
            }
        });
    }

    handleConfirm() {
        const input = this.overlay.querySelector('.modal-input');
        const value = input ? input.value : true;
        this.close(value);
    }

    close(value) {
        this.overlay.classList.remove('active');
        if (this.resolvePromise) {
            this.resolvePromise(value);
            this.resolvePromise = null;
        }
    }

    // Public API matching native functions
    async prompt(title, defaultValue = '', placeholder = '') {
        return this.show({
            type: 'prompt',
            title,
            value: defaultValue,
            placeholder
        });
    }

    async confirm(title, message, options = {}) {
        const result = await this.show({
            type: 'confirm',
            title,
            message,
            ...options
        });
        return !!result; // Ensure boolean
    }

    async alert(title, message, options = {}) {
        return this.show({
            type: 'alert',
            title,
            message,
            hideCancel: true,
            confirmText: 'OK',
            ...options
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXModal;
} else {
    window.LocatorXModal = LocatorXModal;
}
