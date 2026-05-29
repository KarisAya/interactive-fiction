import './styles/main.css';
import './styles/sidebar.css';
import './styles/modal.css';
import { openDB } from "idb";
import type { ExtendResp } from './core';
import { ifSTART, ifKEEP, ifBE, ifHE, generateColorsByStory, viewImageById, generateImageByContent } from './core';
import { creatModal, configTemplate, aboutTemplate } from './modal';

const themeVars = [
  '--theme-color',
  '--text-color',
  '--bg-color',
  '--sidebar-bg-color',
  '--border-color'
]
type IFStatus = {
  generateColor: boolean,
  generateImage: boolean,
  selectOption: boolean
  imageBlobURL?: string,
}
const buttonStatusFlagMap = new Map<number, IFStatus>();
function getIFStatus(id: number) {
  if (!buttonStatusFlagMap.has(id)) {
    buttonStatusFlagMap.set(id, {
      generateColor: false,
      generateImage: false,
      selectOption: false,
    });
  }
  return buttonStatusFlagMap.get(id)!;
}

type IFHistory = {
  id?: number,
  messages: string[],
  image: string | null,
  title: string,
  colors: string[],
  innerHTML: string,
  he?: true,
}
type SavedIFHistory = IFHistory & { id: number }
const DB_NAME = "IFDB";
const STORE_NAME = "histories";
const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

async function getHistoryByID(id: number): Promise<SavedIFHistory | undefined> {
  try {
    const db = await dbPromise;
    const history = await db.get(STORE_NAME, id);
    return history; // 如果找不到，idb 默认返回 undefined
  } catch (e) {
    console.error("Failed to get history by ID:", e);
    return undefined;
  }
}

async function deleteHistoryByID(id: number): Promise<boolean> {
  try {
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
    return true;
  } catch (e) {
    return false;
  }
}

async function updateHistory(history: IFHistory): Promise<number | undefined> {
  try {
    const db = await dbPromise;
    const key = await db.put(STORE_NAME, history);
    return key as number;
  } catch (e) {
    console.error("Failed to save history:", e);
    return undefined;
  }
}

let currentIFThemeID: number | undefined = undefined;
function createWelcomeScreen() {
  const welcomeScreen = document.createElement('div');
  welcomeScreen.className = 'welcome-screen';
  const welcomeText = document.createElement('div');
  welcomeText.className = 'welcome-text';
  welcomeText.id = 'welcomeText';
  const oldText = document.createElement('span');
  oldText.innerHTML = '<i class="fa-solid fa-book"></i> 创建一个互动小说主题';
  oldText.className = 'old-text';
  const newText = document.createElement('span');
  newText.innerHTML = '<i class="fa-solid fa-book"></i> 正在谱写属于你的世界...';
  newText.className = 'new-text';
  welcomeText.appendChild(oldText);
  welcomeText.appendChild(newText);
  welcomeScreen.appendChild(welcomeText);
  return welcomeScreen;
}

const endCardA = `\
<div class="card-content">
  <div class="card-title">进入终章</div>
  <div class="card-desc">下个选项会进入 Happy End</div>
</div>`;

const endCardB = `\
<div class="card-content active">
  <div class="card-title">离开终章</div>
  <div class="card-desc">故事还会继续...</div>
</div>`;

const colorCardA = `\
<div class="card-content">
  <div class="card-title">重新生成主题色</div>
  <div class="card-desc">根据本段故事重新生成配色</div>
</div>`;

const colorCardB = `\
<div class="card-content active">
  <div class="card-title">重新生成主题色</div>
  <div class="card-desc">正在生成中...</div>
</div>`;

const imageCardA = `\
<div class="card-content">
  <div class="card-title">生成图片</div>
  <div class="card-desc">根据本段故事生成图片</div>
</div>`;

const imageCardB = `\
<div class="card-content active">
  <div class="card-title">生成图片</div>
  <div class="card-desc">正在生成中...</div>
</div>`;

function createEmptyHistory() {
  const emptyHistory = document.createElement('div');
  emptyHistory.className = 'empty-history';
  emptyHistory.innerHTML = '<i class="fa-solid fa-circle-notch"></i><p>暂无历史剧本</p>';
  return emptyHistory;
}

function createChapterTitle(title: string) {
  const chapterTitle = document.createElement('div');
  chapterTitle.className = 'chapter-title';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  chapterTitle.appendChild(titleSpan);
  return chapterTitle;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function viewImage(prompt_id: string, callback: (result: string) => void) {
  const startTime = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;
  while (Date.now() - startTime < TEN_MINUTES) {
    await delay(10000);
    try {
      const resp = await viewImageById(prompt_id);
      if (!resp) { continue; }
      const { status, message, raw } = resp;
      console.log('轮询图片状态：', status, " ", message);
      if (status !== 'waiting') {
        if (raw) { callback(raw); }
        return
      }
    } catch (error) {
      console.error('轮询图片时出错：', error);
    }
  }
}

function base64ToBlob(base64Data: string, mimeType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}





document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素选取
  const sidebarEmpty = document.getElementById('sidebarEmpty') as HTMLDivElement;
  const sidebar = document.getElementById('sidebar') as HTMLDivElement;
  const sidebarHeader = document.getElementById('sidebarHeader') as HTMLDivElement;
  const historyContainer = document.getElementById('historyContainer') as HTMLDivElement;
  const newFictionBtn = document.getElementById('newFictionBtn') as HTMLButtonElement;
  // const sidebarSearchBtn = document.getElementById('sidebarSearchBtn') as HTMLButtonElement;
  const sidebarHiddenBtn = document.getElementById('sidebarHiddenBtn') as HTMLButtonElement;
  const about = document.getElementById('about') as HTMLSpanElement;
  const configBtn = document.getElementById('configBtn') as HTMLButtonElement;
  const mainContainer = document.getElementById('mainContainer') as HTMLDivElement;
  const contentArea = document.getElementById('contentArea') as HTMLDivElement;
  const selectArea = document.getElementById('selectArea') as HTMLDivElement;
  const inputArea = document.getElementById('inputArea') as HTMLDivElement;
  const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;

  // 初始化
  function handleResize() {
    if (window.innerHeight > window.innerWidth) {
      sidebarEmpty.classList.remove('expanded');
      sidebar.classList.remove('expanded');
      sidebarHeader.classList.remove('expanded');
    } else {
      sidebarEmpty.classList.add('expanded');
      sidebar.classList.add('expanded');
      sidebarHeader.classList.add('expanded');
    }
  };


  function createHistoryItem(ifThemeID: number, title: string) {
    const IFHistoryItem = document.createElement('div');
    IFHistoryItem.className = 'history-item';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'history-item-title';
    titleSpan.textContent = title;
    const moreBtn = document.createElement('button');
    moreBtn.className = 'sidebar-button'
    moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    moreBtn.onclick = async (e) => {
      e.stopPropagation();
      const history = await getHistoryByID(ifThemeID);
      if (!history) { alert("当前IF主题已丢失"); return; }
      const ifStatus = getIFStatus(ifThemeID);
      const { backdrop, modal } = creatModal();
      const content = document.createElement("div");
      content.className = "modal-content";
      content.innerHTML = `<strong>${title}</strong>`
      const endBtn = document.createElement('div');
      let [endCard, nextEndCard, endCardClassName, nextEndCardClassName] = history.he ? [endCardB, endCardA, 'option-card active', 'option-card'] : [endCardA, endCardB, 'option-card', 'option-card active'];
      endBtn.className = endCardClassName;
      endBtn.innerHTML = endCard;
      endBtn.onclick = async () => {
        endBtn.innerHTML = nextEndCard;
        endBtn.className = nextEndCardClassName;
        [endCard, nextEndCard] = [nextEndCard, endCard];
        [endCardClassName, nextEndCardClassName] = [nextEndCardClassName, endCardClassName];
        const newHistory = await getHistoryByID(history.id) || history;
        if (newHistory.he) { delete newHistory.he; }
        else { newHistory.he = true; }
        updateHistory(newHistory);
      }
      const colorBtn = document.createElement('div');
      [colorBtn.innerHTML, colorBtn.className] = ifStatus.generateColor ? [colorCardB, 'option-card active'] : [colorCardA, 'option-card'];
      colorBtn.onclick = async () => {
        if (ifStatus.generateColor) return;
        ifStatus.generateColor = true;
        colorBtn.innerHTML = colorCardB;
        colorBtn.classList.add('active');
        const newHistory = await getHistoryByID(history.id) || history;
        const story = newHistory.messages.at(-1)
        if (!story) return;
        generateColorsByStory(story).then(async (colors) => {
          if (colors.length != 5) return;
          const new2History = await getHistoryByID(history.id) || newHistory;
          new2History.colors = colors;
          updateHistory(new2History);
          if (currentIFThemeID === new2History.id) {
            themeVars.forEach((varName, index) => {
              document.documentElement.style.setProperty(varName, colors[index]);
            });
          }
        }).finally(() => {
          colorBtn.innerHTML = colorCardA;
          colorBtn.classList.remove('active');
          ifStatus.generateColor = false
        });
      }
      const imageBtn = document.createElement('div');
      [imageBtn.innerHTML, imageBtn.className] = ifStatus.generateImage ? [imageCardB, 'option-card active'] : [imageCardA, 'option-card'];
      imageBtn.onclick = () => {
        if (ifStatus.generateImage) return;
        const content = history.messages.at(-1)
        if (!content) return;
        ifStatus.generateImage = true;
        imageBtn.innerHTML = imageCardB;
        imageBtn.classList.add('active');
        generateImageByContent(content).then((prompt_id) => {
          viewImage(prompt_id, async (image) => {
            const newHistory = await getHistoryByID(history.id) || history;
            newHistory.image = image;
            updateHistory(newHistory);
            if (history.id !== currentIFThemeID) return;
            ifStatus.imageBlobURL = ifStatus.imageBlobURL || URL.createObjectURL(base64ToBlob(image))
            mainContainer.style.setProperty('--bg-image', `url(${ifStatus.imageBlobURL!})`);
            mainContainer.classList.add('has-image');
          }).finally(() => {
            ifStatus.generateImage = false;
            imageBtn.innerHTML = imageCardA;
            imageBtn.classList.remove('active');
          })
        }
        ).catch(() => {
          ifStatus.generateImage = false;
          imageBtn.innerHTML = imageCardA;
          imageBtn.classList.remove('active');
        }
        )
      }
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'option-card';
      deleteBtn.innerHTML = `\
    <div class="card-content">
      <div class="card-title">删除剧本</div>
      <div class="card-desc">此操作将永久删除该剧本</div>
    </div>`;
      deleteBtn.onclick = () => {
        deleteHistoryByID(history.id)
        IFHistoryItem.remove();
        backdrop.remove();
        newFiction()
      }
      content.appendChild(endBtn);
      content.appendChild(colorBtn);
      content.appendChild(imageBtn);
      content.appendChild(deleteBtn);
      modal.appendChild(content);
    }
    IFHistoryItem.appendChild(titleSpan);
    IFHistoryItem.appendChild(moreBtn);
    return IFHistoryItem;
  }

  async function renderHistory() {
    historyContainer.innerHTML = '';
    const db = await dbPromise;
    const allList: SavedIFHistory[] = await db.getAll(STORE_NAME);
    if (allList.length > 0) {
      allList.forEach(history => {
        const IFHistoryItem = createHistoryItem(history.id, history.title);
        IFHistoryItem.onclick = async () => { selectHistory(await getHistoryByID(history.id) || history); };
        historyContainer.appendChild(IFHistoryItem);
      });

    } else {
      historyContainer.appendChild(createEmptyHistory());
    }
  }
  function newFiction() {
    contentArea.innerHTML = "";
    selectArea.innerHTML = "";
    inputArea.className = "input-area";
    contentArea.appendChild(createWelcomeScreen());
    messageInput.value = "";
    messageInput.placeholder = "请输入要创建的互动小说主题";
    currentIFThemeID = undefined;
    themeVars.forEach((varName) => {
      document.documentElement.style.removeProperty(varName);
    });
    mainContainer.style.removeProperty('--bg-image');
    mainContainer.classList.remove('has-image');
  }
  function lastOptions(): string[] | void {
    const options = (contentArea.lastElementChild as HTMLElement)?.dataset?.options;
    if (!options) return;
    try {
      return JSON.parse(options);
    } catch (e) {
      return;
    }
  }
  function lastIncorrect(): string | void {
    return (contentArea.lastElementChild as HTMLElement)?.dataset?.incorrect;
  }
  function selectHistory(history: SavedIFHistory) {
    themeVars.forEach((varName, index) => {
      document.documentElement.style.setProperty(varName, history.colors[index]);
    });
    if (history.image) {
      const ifStatus = getIFStatus(history.id);
      ifStatus.imageBlobURL = ifStatus.imageBlobURL || URL.createObjectURL(base64ToBlob(history.image))
      mainContainer.style.setProperty('--bg-image', `url(${ifStatus.imageBlobURL!})`);
      mainContainer.classList.add('has-image');
    } else {
      mainContainer.style.removeProperty('--bg-image');
      mainContainer.classList.remove('has-image');
    }
    contentArea.innerHTML = history.innerHTML;
    currentIFThemeID = history.id;
    const options = lastOptions();
    renderOptions(options);
    // mainContainer.scrollTop = mainContainer.scrollHeight;
  }
  function renderOptions(options: string[] | void) {
    inputArea.className = "input-area";
    messageInput.placeholder = "输入接下来的剧情走向...";
    selectArea.innerHTML = '';
    if (options) {
      options.forEach((option, index) => {
        const optionItem = document.createElement('div');
        optionItem.className = 'select-item';
        optionItem.dataset.id = index.toString();
        const p = document.createElement('p');
        p.textContent = option;
        optionItem.appendChild(p);
        selectArea.appendChild(optionItem);
      });
    } else {
      selectArea.innerHTML = '';
      const optionItem = document.createElement('div');
      optionItem.className = 'select-back';
      const p = document.createElement('p');
      p.textContent = "返回上个选项";
      optionItem.appendChild(p);
      selectArea.appendChild(optionItem);
      inputArea.classList.add('hidden');
    }
  }
  function renderResponse(resp: ExtendResp, ifContent: HTMLDivElement, history: SavedIFHistory, rendering: boolean) {
    const [promptId, resp_data, markedContent] = resp;
    const ifStatus = getIFStatus(history.id);
    if (promptId) {
      viewImage(promptId, async (image) => {
        if (ifStatus.imageBlobURL) { URL.revokeObjectURL(ifStatus.imageBlobURL); }
        ifStatus.imageBlobURL = URL.createObjectURL(base64ToBlob(image))
        const newHistory = await getHistoryByID(history.id) || history;
        newHistory.image = image;
        updateHistory(newHistory);
        if (newHistory.id !== currentIFThemeID) return;
        mainContainer.style.setProperty('--bg-image', `url(${ifStatus.imageBlobURL!})`);
        mainContainer.classList.add('has-image');
      }).finally(() => { ifStatus.generateImage = false; });
    } else { ifStatus.generateImage = false; }
    ifContent.appendChild(createChapterTitle(resp_data.title));
    ifContent.innerHTML += markedContent;
    const options = resp_data.options;
    if (options.length > 0) {
      ifContent.dataset.options = JSON.stringify(options);
      const incorrect = resp_data.incorrect;
      if (incorrect > 0) { ifContent.dataset.incorrect = incorrect.toString(); }
      history.messages.push(resp_data.content);
    }
    history.innerHTML += ifContent.outerHTML;
    updateHistory(history);
    if (rendering) { selectHistory(history); }
  }
  async function selectOption(option: string, be: boolean, ifThemeID: number) {
    const ifStatus = getIFStatus(ifThemeID);
    if (ifStatus.selectOption) return;
    const history = await getHistoryByID(ifThemeID)
    if (!history) {
      alert("当前IF主题已丢失");
      ifStatus.selectOption = false;
      return;
    }
    ifStatus.selectOption = true;
    const ifContent = document.createElement('div');
    ifContent.className = 'if-content';
    ifContent.innerHTML = `\
    <button class="delete-this">
      <i class="fa-solid fa-trash" ></i>
    </button>
    <p>${option}</p>`;
    history.messages.push(option);
    const func = be ? ifBE : (history.he ? ifHE : ifKEEP);
    func(history.messages).then((resp) => {
      renderResponse(resp, ifContent, history, ifThemeID === currentIFThemeID);
    }).finally(() => { ifStatus.selectOption = false; });
  }
  handleResize();
  renderHistory()
  newFiction();
  sidebarHiddenBtn.onclick = () => {
    if (window.innerHeight > window.innerWidth) {
      sidebarEmpty.classList.remove('expanded');
      sidebar.classList.toggle('expanded');
      sidebarHeader.classList.toggle('expanded');
    } else {
      sidebarEmpty.classList.toggle('expanded');
      sidebar.classList.toggle('expanded');
      sidebarHeader.classList.toggle('expanded');
    }
  }
  window.addEventListener('resize', handleResize);
  newFictionBtn.onclick = newFiction
  messageInput.oninput = () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
  }
  sendBtn.onclick = () => {
    const message = messageInput.value.trim();
    if (message.length < 1) return;
    if (currentIFThemeID !== undefined) {
      messageInput.value = "";
      messageInput.placeholder = message
      inputArea.classList.add('selected');
      selectOption(message, false, currentIFThemeID);
    } else {
      sendBtn.disabled = true;
      const welcomeText = document.getElementById('welcomeText');
      if (welcomeText) {
        welcomeText.classList.add('loading');
        for (const child of welcomeText.children) {
          child.classList.add('loading');
        }
      }
      ifSTART(message).then(async ([resp, colors]) => {
        messageInput.value = "";
        const ifContent = document.createElement('div');
        ifContent.className = 'if-content';
        const ifThemeID = await updateHistory({
          messages: [],
          image: null,
          title: resp[1].title,
          colors: colors,
          innerHTML: ""
        })
        if (!ifThemeID) return;
        const history = await getHistoryByID(ifThemeID)
        if (!history) return;
        const ifStatus = getIFStatus(ifThemeID);
        ifStatus.generateColor = false;
        ifStatus.generateImage = true;
        const rendering = currentIFThemeID === undefined;
        currentIFThemeID = ifThemeID;
        if (rendering) { contentArea.innerHTML = "" }
        renderResponse(resp, ifContent, history, rendering);
        renderHistory();
      }).catch((err) => {
        console.error("初始化剧本失败:", err);
        alert("初始化剧本失败");
        newFiction();
      }).finally(() => {
        sendBtn.disabled = false;
      });
    }
  }
  selectArea.onclick = (e) => {
    if (currentIFThemeID === undefined) return;
    const target = e.target as HTMLElement;
    let selectItem: HTMLElement | null;
    if (selectItem = target.closest('.select-item')) {
      const option = selectItem.querySelector('p')?.textContent;
      if (!option) return;
      selectItem.classList.add('selected');
      const incorrect = lastIncorrect()
      const select = selectItem.dataset.id
      selectOption(option, Boolean(select && incorrect) && (select === incorrect), currentIFThemeID);
      return;
    } else if (target.closest('.select-back')) {
      getHistoryByID(currentIFThemeID).then((history) => {
        if (!history) return;
        if (history.id !== currentIFThemeID) return;
        const ifContent = contentArea.lastElementChild;
        if (!ifContent) return;
        ifContent.remove();
        history.messages.length = contentArea.children.length * 2 - 1;
        history.innerHTML = contentArea.innerHTML;
        delete history.he;
        updateHistory(history);
        selectHistory(history);
        return;
      })
    }

  };
  contentArea.onclick = async (e) => {
    if (currentIFThemeID === undefined) return;
    const history = await getHistoryByID(currentIFThemeID);
    if (!history) return;
    if (history.id !== currentIFThemeID) return;
    const ifStatus = getIFStatus(history.id);
    if (ifStatus.selectOption) return;
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.delete-this');
    if (!deleteBtn) return;
    const ifContent = deleteBtn.closest('.if-content');
    if (!ifContent) return;
    while (ifContent.nextElementSibling) {
      ifContent.nextElementSibling.remove();
    }
    ifContent.remove();
    history.messages.length = contentArea.children.length * 2 - 1;
    history.innerHTML = contentArea.innerHTML;
    updateHistory(history);
    console.log(history.messages);
    const options = lastOptions();
    if (options) renderOptions(options)
  };
  configBtn.onclick = () => configTemplate()
  about.onclick = () => aboutTemplate()
});