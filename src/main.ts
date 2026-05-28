import './styles/main.css';
import './styles/sidebar.css';
import './styles/modal.css';
import md5 from 'blueimp-md5';
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

type IFHistory = {
  id: string,
  messages: string[],
  image: string | null,
  title: string,
  colors: string[],
  innerHTML: string,
  he?: true,
}
type IFHistorys = { [key: string]: IFHistory }

let currentIFThemeID: string = '';

function getHistoryByID(id: string) {
  const rawData = localStorage.getItem('history');
  if (!rawData) return undefined
  try {
    const ifHistorys: IFHistorys = JSON.parse(rawData);
    return ifHistorys[id];
  } catch (e) {
    localStorage.removeItem('history');
    return undefined
  }
}

function getHistorys(): IFHistorys | void {
  const rawData = localStorage.getItem('history');
  if (!rawData) return;
  try {
    return JSON.parse(rawData);
  } catch (e) {
    localStorage.removeItem('history');
    return
  }
}

function saveHistory(history: IFHistory) {
  let historys = getHistorys();
  if (historys) { historys[history.id] = history; }
  else { historys = { [history.id]: history }; }
  localStorage.setItem('history', JSON.stringify(historys));
}

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

let generateColorsFlag = false;
let generateImageFlag = false;

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
  <div class="card-desc">根据最后一段故事重新生成配色</div>
</div>`;

const colorCardB = `\
<div class="card-content active">
  <div class="card-title">重新生成主题色</div>
  <div class="card-desc">正在生成中...</div>
</div>`;

const imageCardA = `\
<div class="card-content">
  <div class="card-title">生成图片</div>
  <div class="card-desc">根据最后几段故事生成图片</div>
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
    try {
      const { status, raw } = await viewImageById(prompt_id);
      if (status !== 'waiting') {
        if (raw) { callback(`data:image/*;base64,${raw}`); }
        return
      }
    } catch (error) {
      console.error('轮询图片时出错：', error);
    }
    await delay(5000);
  }
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
  function createHistoryItem(ifThemeID: string, title: string) {
    const IFHistoryItem = document.createElement('div');
    IFHistoryItem.className = 'history-item';
    IFHistoryItem.id = ifThemeID;
    const titleSpan = document.createElement('span');
    titleSpan.className = 'history-item-title';
    titleSpan.textContent = title;
    const moreBtn = document.createElement('button');
    moreBtn.className = 'sidebar-button'
    moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      const history = getHistoryByID(ifThemeID);
      if (!history) { alert("当前IF主题已丢失"); return; }
      const { backdrop, modal } = creatModal();
      const content = document.createElement("div");
      content.className = "modal-content";
      content.innerHTML = `<strong>${title}</strong>`
      const endBtn = document.createElement('div');
      let [endCard, nextEndCard, endCardClassName, nextEndCardClassName] = history.he ? [endCardB, endCardA, 'option-card active', 'option-card'] : [endCardA, endCardB, 'option-card', 'option-card active'];
      endBtn.className = endCardClassName;
      endBtn.innerHTML = endCard;
      endBtn.onclick = () => {
        endBtn.innerHTML = nextEndCard;
        endBtn.className = nextEndCardClassName;
        [endCard, nextEndCard] = [nextEndCard, endCard];
        [endCardClassName, nextEndCardClassName] = [nextEndCardClassName, endCardClassName];
        const newHistory = getHistoryByID(history.id) || history;
        if (newHistory.he) { delete newHistory.he; }
        else { newHistory.he = true; }
        saveHistory(newHistory);
      }
      const colorBtn = document.createElement('div');
      [colorBtn.innerHTML, colorBtn.className] = generateColorsFlag ? [colorCardB, 'option-card active'] : [colorCardA, 'option-card'];
      colorBtn.onclick = () => {
        if (generateColorsFlag) return;
        generateColorsFlag = true;
        colorBtn.innerHTML = colorCardB;
        colorBtn.classList.add('active');
        const newHistory = getHistoryByID(history.id) || history;
        const story = newHistory.messages.at(-1)
        if (!story) return;
        generateColorsByStory(story).then(colors => {
          colorBtn.innerHTML = colorCardA;
          colorBtn.classList.remove('active');
          if (colors.length != 5) return;
          const new2History = getHistoryByID(history.id) || newHistory;
          new2History.colors = colors;
          saveHistory(new2History);
          if (currentIFThemeID === new2History.id) {
            themeVars.forEach((varName, index) => {
              document.documentElement.style.setProperty(varName, colors[index]);
            });
          }
        }).finally(() => { generateColorsFlag = false });
      }
      const imageBtn = document.createElement('div');
      [imageBtn.innerHTML, imageBtn.className] = generateImageFlag ? [imageCardB, 'option-card active'] : [imageCardA, 'option-card'];
      imageBtn.onclick = () => {
        if (generateImageFlag) return;
        const content = history.messages.at(-1)
        if (!content) return;
        generateImageFlag = true;
        generateImageByContent(content).then(promptId => {
          viewImage(promptId, (image) => {
            const newHistory = getHistoryByID(history.id) || history;
            newHistory.image = image;
            saveHistory(newHistory);
            if (newHistory.id !== currentIFThemeID) { return; }
            mainContainer.style.setProperty('--bg-image', `url(${image})`);
            mainContainer.classList.add('has-image');
          })
        }).finally(() => { generateImageFlag = false });;
      }
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'option-card';
      deleteBtn.innerHTML = `\
    <div class="card-content">
      <div class="card-title">删除剧本</div>
      <div class="card-desc">此操作将永久删除该剧本</div>
    </div>`;
      deleteBtn.onclick = () => {
        const historys = getHistorys();
        if (historys) {
          delete historys![history.id];
          localStorage.setItem('history', JSON.stringify(historys));
        }
        IFHistoryItem.remove();
        backdrop.remove();
        newFiction()
      }
      content.appendChild(endBtn);
      content.appendChild(colorBtn);
      content.appendChild(deleteBtn);
      modal.appendChild(content);
    }
    IFHistoryItem.appendChild(titleSpan);
    IFHistoryItem.appendChild(moreBtn);
    return IFHistoryItem;
  }

  function renderHistory() {
    historyContainer.innerHTML = '';
    const ifHistorys = getHistorys();
    if (ifHistorys) {
      for (const key in ifHistorys) {
        const history = ifHistorys[key];
        const IFHistoryItem = createHistoryItem(key, history.title);
        IFHistoryItem.onclick = () => { selectHistory(getHistoryByID(key) || history); };
        historyContainer.appendChild(IFHistoryItem);
      }
    } else {
      historyContainer.appendChild(createEmptyHistory());
    }
  }
  function newFiction() {
    contentArea.innerHTML = "";
    selectArea.innerHTML = "";
    inputArea.classList.remove('hidden');
    contentArea.appendChild(createWelcomeScreen());
    messageInput.value = "";
    messageInput.placeholder = "请输入要创建的互动小说主题";
    currentIFThemeID = '';
    themeVars.forEach((varName) => {
      document.documentElement.style.removeProperty(varName);
    });
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
  function selectHistory(history: IFHistory) {
    themeVars.forEach((varName, index) => {
      document.documentElement.style.setProperty(varName, history.colors[index]);
    });
    if (history.image) {
      mainContainer.style.setProperty('--bg-image', `url(${history.image})`);
      mainContainer.classList.add('has-image');
    }
    contentArea.innerHTML = history.innerHTML;
    currentIFThemeID = history.id;
    const options = lastOptions();
    renderOptions(options);
    // mainContainer.scrollTop = mainContainer.scrollHeight;
  }
  function renderOptions(options: string[] | void) {
    inputArea.classList.remove('hidden');
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
  function renderResponse(resp: ExtendResp, ifContent: HTMLDivElement, history: IFHistory, rendering: boolean) {
    const [promptId, resp_data, markedContent] = resp;
    if (promptId) {
      viewImage(promptId, (image) => {
        const newHistory = getHistoryByID(history.id) || history;
        newHistory.image = image;
        saveHistory(newHistory);
        if (newHistory.id !== currentIFThemeID) { return; }
        mainContainer.style.setProperty('--bg-image', `url(${image})`);
        mainContainer.classList.add('has-image');
      }).finally(() => { generateImageFlag = false });
    } else { generateImageFlag = false; }
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
    saveHistory(history);
    if (rendering) { selectHistory(history); }
  }
  const selectOptionFlag = new Map<string, true>();
  function selectOption(option: string, be: boolean, ifThemeID: string) {
    if (selectOptionFlag.has(ifThemeID)) return;
    selectOptionFlag.set(ifThemeID, true);
    const ifContent = document.createElement('div');
    ifContent.className = 'if-content';
    ifContent.innerHTML = `\
    <button class="delete-this">
      <i class="fa-solid fa-trash" ></i>
    </button>
    <p>${option}</p>`;
    const history = getHistoryByID(ifThemeID)
    if (!history) {
      alert("当前IF主题已丢失");
      selectOptionFlag.delete(ifThemeID);
      return;
    }
    history.messages.push(option);
    const func = be ? ifBE : (history.he ? ifHE : ifKEEP);
    func(history.messages).then((resp) => {
      renderResponse(resp, ifContent, history, ifThemeID === currentIFThemeID);
    }).finally(() => { selectOptionFlag.delete(ifThemeID); });
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
    if (currentIFThemeID) {
      messageInput.value = "";
      selectOption(message, false, currentIFThemeID);
    } else {
      sendBtn.disabled = true;
      currentIFThemeID = `IF${Date.now()}${md5(message)} `;
      const iFThemeID = currentIFThemeID;
      const welcomeText = document.getElementById('welcomeText');
      if (welcomeText) {
        welcomeText.classList.add('loading');
        for (const child of welcomeText.children) {
          child.classList.add('loading');
        }
      }
      generateColorsFlag = true;
      generateImageFlag = true;
      ifSTART(message).then(([resp, colors]) => {
        generateColorsFlag = false;
        messageInput.value = "";
        const ifContent = document.createElement('div');
        ifContent.className = 'if-content';
        const history: IFHistory = {
          id: iFThemeID,
          messages: [],
          image: resp[0],
          title: resp[1].title,
          colors: colors,
          innerHTML: ""
        };
        const rendering = iFThemeID === currentIFThemeID
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
      const history = getHistoryByID(currentIFThemeID);
      if (!history) return;
      const ifContent = contentArea.lastElementChild;
      if (!ifContent) return;
      ifContent.remove();
      history.messages.length = contentArea.children.length * 2 - 1;
      history.innerHTML = contentArea.innerHTML;
      delete history.he;
      saveHistory(history);
      selectHistory(history);
      return;
    }

  };
  contentArea.onclick = (e) => {
    const history = getHistoryByID(currentIFThemeID);
    if (!history) return;
    if (selectOptionFlag.has(history.id)) return;
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
    saveHistory(history);
    console.log(history.messages);
    const options = lastOptions();
    if (options) renderOptions(options)
  };
  configBtn.onclick = () => configTemplate()
  about.onclick = () => aboutTemplate()
});