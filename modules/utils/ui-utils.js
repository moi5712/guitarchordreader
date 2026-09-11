function bindModalOverlayClose() {
    const modal = document.getElementById("customModal");
    if (!modal || modal.dataset.overlayCloseBound) return;
    modal.dataset.overlayCloseBound = "1";
    modal.addEventListener("click", (e) => {
        if (e.target !== modal) return;
        const cancel = document.getElementById("modalCancelBtn");
        const ok = document.getElementById("modalAlertOkBtn");
        if (cancel && !cancel.classList.contains("hidden")) cancel.click();
        else if (ok && !ok.classList.contains("hidden")) ok.click();
    });
}

export function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("visible");
}

export function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("visible");
    modal.classList.add("hidden");
}

export function syncTopbarHeight(root = document.documentElement) {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    if (!root?.style || typeof root.style.setProperty !== "function") {
        root = document.documentElement;
        if (!root?.style || typeof root.style.setProperty !== "function") return;
    }
    root.style.setProperty("--topbar-height", `${topbar.offsetHeight}px`);
}

function parseFlexGap(el) {
    const raw = getComputedStyle(el).gap || getComputedStyle(el).columnGap || "0";
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
}

function isTopbarMeasureSkip(el) {
    if (!(el instanceof HTMLElement)) return true;
    if (el.hidden || el.classList.contains("hidden")) return true;
    if (el.id === "mobileSettingsBtn" || el.id === "importFile") return true;
    if (el.getAttribute("type") === "file") return true;
    return false;
}

function sumFlexChildrenWidth(el) {
    const gap = parseFlexGap(el);
    let width = 0;
    let count = 0;
    for (const child of el.children) {
        if (isTopbarMeasureSkip(child)) continue;
        const w = child.offsetWidth;
        if (w <= 0) continue;
        width += w;
        count += 1;
    }
    if (count > 1) width += (count - 1) * gap;
    return width;
}

function measureExpandedTopbarWidth(topbar) {
    const style = getComputedStyle(topbar);
    const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const gap = parseFlexGap(topbar);
    let used = pad;
    let count = 0;
    for (const child of topbar.children) {
        if (isTopbarMeasureSkip(child)) continue;
        const w = child.classList.contains("topbar-right")
            ? sumFlexChildrenWidth(child)
            : child.offsetWidth;
        if (w <= 0) continue;
        used += w;
        count += 1;
    }
    if (count > 1) used += (count - 1) * gap;
    return used;
}

function closeTopbarOverflowSheet() {
    const sheet = document.getElementById("mobileSettingsSheet");
    if (!sheet?.classList.contains("is-open")) return;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.getElementById("mobileSettingsBtn")?.setAttribute("aria-expanded", "false");
}

export function syncTopbarOverflow(topbar = document.querySelector(".topbar")) {
    if (!topbar || topbar.dataset.topbarMeasuring === "1") return;
    topbar.dataset.topbarMeasuring = "1";
    topbar.classList.add("is-measuring");
    const needed = measureExpandedTopbarWidth(topbar);
    const available = topbar.clientWidth;
    topbar.classList.remove("is-measuring");
    topbar.dataset.topbarMeasuring = "";
    const compact = Math.ceil(needed) > available;
    const html = document.documentElement;
    const wasCompact = html.classList.contains("topbar-compact");
    html.classList.toggle("topbar-compact", compact);
    html.classList.add("topbar-measured");
    topbar.classList.toggle("is-compact", compact);
    if (wasCompact && !compact) closeTopbarOverflowSheet();
    syncTopbarHeight();
}

export function observeTopbarHeight() {
    const topbar = document.querySelector(".topbar");
    syncTopbarHeight();
    syncTopbarOverflow(topbar);
    if (!topbar) return;
    let rafId = 0;
    const schedule = () => {
        if (topbar.dataset.topbarMeasuring === "1") return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            syncTopbarOverflow(topbar);
        });
    };
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(schedule);
        ro.observe(topbar);
    }
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    if (document.fonts?.ready) {
        document.fonts.ready.then(schedule).catch(() => {});
    }
}

// 顯示警告
export function showAlert(message) {
    const modal = document.getElementById("customModal");
    if (!modal) return Promise.resolve(true);
    bindModalOverlayClose();
    document.getElementById("modalTitle").textContent = "提示";
    document.getElementById("modalMessage").textContent = message;
    document.getElementById("modalConfirmBtn").classList.add("hidden");
    document.getElementById("modalCancelBtn").classList.add("hidden");
    document.getElementById("modalAlertOkBtn").textContent = "關閉";
    document.getElementById("modalAlertOkBtn").classList.remove("hidden");
    openModal(modal);
  
    return new Promise((resolve) => {
      document.getElementById("modalAlertOkBtn").onclick = () => {
        closeModal(modal);
        resolve(true);
      };
    });
  }
  
// 自訂下拉選單元件：替換原生 select，完整套用專案樣式
export function initCustomSelect(selectEl) {
    if (!selectEl || selectEl._customSelectInit) return;
    selectEl._customSelectInit = true;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.hidden = true;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'custom-select-value';
    trigger.appendChild(valueSpan);
    trigger.insertAdjacentHTML('beforeend',
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="custom-select-chevron"><path d="M6 9l6 6 6-6"/></svg>`
    );

    const dropdown = document.createElement('ul');
    dropdown.className = 'custom-select-dropdown';
    dropdown.setAttribute('role', 'listbox');

    Array.from(selectEl.options).forEach(opt => {
        const li = document.createElement('li');
        li.className = 'custom-select-option';
        li.dataset.value = opt.value;
        li.textContent = opt.text;
        li.setAttribute('role', 'option');
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            selectEl.value = opt.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            wrapper.classList.remove('is-open');
        });
        dropdown.appendChild(li);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    function refresh() {
        const selected = selectEl.options[selectEl.selectedIndex];
        valueSpan.textContent = selected ? selected.text : '';
        valueSpan.classList.toggle('is-placeholder', !selected || selected.value === '');
        dropdown.querySelectorAll('.custom-select-option').forEach(li => {
            li.classList.toggle('is-selected', li.dataset.value === selectEl.value);
        });
    }

    refresh();

    // 攔截程式碼直接賦值（如 persist.js / editor/ui.js），確保自動同步 UI
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(selectEl, 'value', {
        get() { return proto.get.call(this); },
        set(v) { proto.set.call(this, v); refresh(); },
        configurable: true,
    });

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('is-open');
        document.querySelectorAll('.custom-select.is-open').forEach(el => el.classList.remove('is-open'));
        if (!isOpen) wrapper.classList.add('is-open');
    });

    document.addEventListener('click', () => wrapper.classList.remove('is-open'));
}

// 顯示確認對話框
export function showConfirm(message, title = "確認", options = {}) {
    const modal = document.getElementById("customModal");
    if (!modal) return Promise.resolve(false);
    bindModalOverlayClose();
    const confirmText = options.confirmText || "確定";
    const cancelText = options.cancelText || "取消";
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalMessage").textContent = message;
    document.getElementById("modalConfirmBtn").textContent = confirmText;
    document.getElementById("modalCancelBtn").textContent = cancelText;
    document.getElementById("modalAlertOkBtn").classList.add("hidden");
    document.getElementById("modalConfirmBtn").classList.remove("hidden");
    document.getElementById("modalCancelBtn").classList.remove("hidden");
    openModal(modal);
  
    return new Promise((resolve) => {
      document.getElementById("modalConfirmBtn").onclick = () => {
        closeModal(modal);
        resolve(true);
      };
      document.getElementById("modalCancelBtn").onclick = () => {
        closeModal(modal);
        resolve(false);
      };
    });
  }
