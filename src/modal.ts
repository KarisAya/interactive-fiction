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

export function configTemplate({ backdrop, modal } = creatModal()) {
    const content = document.createElement("div");
    content.className = "modal-content";
    const ifUrl = localStorage.getItem("ifApiUrl") || "";
    const sdUrl = localStorage.getItem("sdApiUrl") || "http://127.0.0.1:7860/sdapi/";
    content.innerHTML = `\
    <strong>IF 配置</strong>
    <div class="modal-item">
        <label for="ifApiUrl">IF 互动小说 API URL</label>
        <input type="text" id="ifApiUrl" value="${ifUrl}" placeholder="${ifUrl || "http://127.0.0.1:8788/api/"}">
    </div>
    <div class="modal-item">
        <label for="sdApiUrl">SD 图片生成 API URL</label>
        <input type="text" id="sdApiUrl" value="${sdUrl}" placeholder="${sdUrl}">
    </div>`;
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "modal-button confirm";
    confirmBtn.textContent = "确定";
    confirmBtn.onclick = () => {
        const ifApiUrl = document.getElementById("ifApiUrl") as HTMLInputElement;
        if (ifApiUrl) {
            const url = ifApiUrl.value.trim()
            if (!url) { localStorage.removeItem("ifApiUrl"); }
            else if (url.startsWith("http")) { localStorage.setItem("ifApiUrl", url); }
        }
        const sdApiUrl = document.getElementById("sdApiUrl") as HTMLInputElement;
        if (sdApiUrl) {
            const url = sdApiUrl.value.trim()
            if (!url) { localStorage.removeItem("sdApiUrl"); }
            else if (url.startsWith("http")) { localStorage.setItem("sdApiUrl", url); }
        }
        document.body.removeChild(backdrop);
    }
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-button cancel";
    cancelBtn.textContent = "取消";
    cancelBtn.onclick = () => document.body.removeChild(backdrop);
    const btns = document.createElement("div");
    btns.className = "modal-buttons";
    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    content.appendChild(btns);
    modal.appendChild(content);
}

export function aboutTemplate({ backdrop, modal } = creatModal()) {
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