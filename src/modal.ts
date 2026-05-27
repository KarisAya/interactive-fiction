export function creatModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.onclick = () => document.body.removeChild(backdrop);
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.addEventListener("click", (e) => e.stopPropagation())
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    return { backdrop, modal }
}
function updateFromInput(id: string) {
    const div = document.getElementById(id) as HTMLInputElement;
    if (!div) return;
    const value = div.value.trim();
    if (!value) { localStorage.removeItem(id); }
    else { localStorage.setItem(id, value); }
}
export function configTemplate({ backdrop, modal } = creatModal()) {
    const content = document.createElement("div");
    content.className = "modal-content";
    const ifApiUrl = localStorage.getItem("ifApiUrl") || "";
    const t2iApiUrl = localStorage.getItem("t2iApiUrl") || "";
    content.innerHTML = `\
    <strong>IF 配置</strong>
    <div class="modal-item">
        <label for="ifApiUrl">IF 互动小说 API URL</label>
        <input type="text" id="ifApiUrl" value="${ifApiUrl}" placeholder="${ifApiUrl || "http://127.0.0.1:11005/api/"}">
    </div>
    <div class="modal-item">
        <label for="t2iApiUrl">文生图服务器</label>
        <input type="text" id="t2iApiUrl" value="${t2iApiUrl}" placeholder="${t2iApiUrl || "http://127.0.0.1:11005/api/generate-image"}">
    </div>`;
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "modal-button confirm";
    confirmBtn.textContent = "确定";
    confirmBtn.onclick = () => {
        updateFromInput("ifApiUrl");
        updateFromInput("t2iApiUrl");
        backdrop.remove();
    }
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-button cancel";
    cancelBtn.textContent = "取消";
    cancelBtn.onclick = () => backdrop.remove();
    const btns = document.createElement("div");
    btns.className = "modal-buttons";
    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    content.appendChild(btns);
    modal.appendChild(content);
}

export function aboutTemplate(modal = creatModal().modal) {
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `\
    <strong>关于</strong>
    <a
        href=" https://qun.qq.com/universal-share/share?ac=1&authKey=Iq8lDUYcAI8SG0HN%2FKvL5pJ73t7PKP2rMAB6qNEi99NbICjplNnMyticRq3p0XU8&busi_data=eyJncm91cENvZGUiOiI3NDQ3NTExNzkiLCJ0b2tlbiI6IkFSRDFFbXB4YkgyNXZhVk54Ti91cmMzTzB3WU1OTzdJajRxSWxHRExzYTQrV1p1a1FYS3hoYm1aRGJQeVpVU0UiLCJ1aW4iOiIxMDQ4ODI3NDI0In0%3D&data=7NPR3RM7asHobWOB7K7CN8Y3xakqhQjBx160Xocnxt960S2Yo82Ce1erDIfMh4qHD4pJBxeQqUSMvHfozpsyVQ&svctype=4&tempid=h5_group_info"
        class="option-card"
    >
        <div class="card-icon">🎉</div>
        <div class="card-content">
            <div class="card-title">机器人bug研究中心</div>
            <div class="card-desc">这里是QQ群，欢迎光临</div>
            <div class="card-meta">GROUP: WELCOME</div>
        </div>
        <img
        src="https://raw.githubusercontent.com/clovers-project/clovers/master/attachment/qrcode.svg"
        style="height: 60px"
        />
    </a>`;
    modal.appendChild(content);
}