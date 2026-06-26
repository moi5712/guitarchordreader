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

export function observeTopbarHeight() {
    syncTopbarHeight();
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => syncTopbarHeight());
        ro.observe(topbar);
    }
    window.addEventListener("resize", () => syncTopbarHeight());
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
