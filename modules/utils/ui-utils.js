// 顯示警告
export function showAlert(message) {
    const modal = document.getElementById("customModal");
    if (!modal) return Promise.resolve(true);
    
    document.getElementById("modalMessage").textContent = message;
    document.getElementById("modalConfirmBtn").classList.add("hidden");
    document.getElementById("modalCancelBtn").classList.add("hidden");
    document.getElementById("modalAlertOkBtn").classList.remove("hidden");
    modal.classList.add("visible");
  
    return new Promise((resolve) => {
      document.getElementById("modalAlertOkBtn").onclick = () => {
        modal.classList.remove("visible");
        resolve(true);
      };
    });
  }
  
// 顯示確認對話框
export function showConfirm(message, title = "確認") {
    const modal = document.getElementById("customModal");
    if (!modal) return Promise.resolve(false);
    
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalMessage").textContent = message;
    document.getElementById("modalAlertOkBtn").classList.add("hidden");
    document.getElementById("modalConfirmBtn").classList.remove("hidden");
    document.getElementById("modalCancelBtn").classList.remove("hidden");
    modal.classList.add("visible");
  
    return new Promise((resolve) => {
      document.getElementById("modalConfirmBtn").onclick = () => {
        modal.classList.remove("visible");
        resolve(true);
      };
      document.getElementById("modalCancelBtn").onclick = () => {
        modal.classList.remove("visible");
        resolve(false);
      };
    });
  }
