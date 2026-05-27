import './styles/main.css';
import './styles/sidebar.css';
import './styles/modal.css';
import md5 from 'blueimp-md5';
import type { ExtendResp } from './core';
import { ifSTART, ifKEEP, ifBE, ifHE, generateColorsByStory } from './core';
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

// function createHistoryItem(history: IFHistory) {
//   const IFHistoryItem = document.createElement('div');
//   IFHistoryItem.className = 'history-item';
//   IFHistoryItem.id = history.id;
//   IFHistoryItem.textContent = history.title;
//   return IFHistoryItem;
// }
let generateColorsByStoryFlag = false;
function createHistoryItem(history: IFHistory) {
  const IFHistoryItem = document.createElement('div');
  IFHistoryItem.className = 'history-item';
  IFHistoryItem.id = history.id;
  const titleSpan = document.createElement('span');
  titleSpan.className = 'history-item-title';
  titleSpan.textContent = history.title;
  const moreBtn = document.createElement('button');
  moreBtn.className = 'sidebar-button'
  moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
  moreBtn.onclick = (e) => {
    e.stopPropagation();
    const { backdrop, modal } = creatModal();
    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `<strong>${history.title}</strong>`
    const endBtn = document.createElement('div');
    endBtn.className = 'option-card';
    if (history.he) {
      endBtn.innerHTML = `\
      <div class="card-content">
        <div class="card-title">离开终章</div>
        <div class="card-desc">故事还会继续...</div>
      </div>`;
    } else {
      endBtn.innerHTML = `\
      <div class="card-content">
        <div class="card-title">进入终章</div>
        <div class="card-desc">下一次选项会进入 Happy End</div>
      </div>`;
    }
    endBtn.onclick = () => {
      const newHistory = getHistoryByID(history.id) || history;
      if (newHistory.he) { delete newHistory.he; }
      else { newHistory.he = true; }
      saveHistory(newHistory);
      document.body.removeChild(backdrop);
    }
    const colorBtn = document.createElement('div');
    colorBtn.className = 'option-card';
    colorBtn.innerHTML = `\
    <div class="card-content">
      <div class="card-title">重新生成主题色</div>
      <div class="card-desc">根据最后一段故事重新生成配色</div>
    </div>`;
    colorBtn.onclick = () => {
      if (generateColorsByStoryFlag) return;
      generateColorsByStoryFlag = true;
      const newHistory = getHistoryByID(history.id) || history;
      const story = newHistory.messages.at(-1)
      if (!story) return;
      generateColorsByStory(story).then(colors => {
        if (colors.length != 5) return;
        const new2History = getHistoryByID(history.id) || newHistory;
        new2History.colors = colors;
        saveHistory(new2History);
        if (currentIFThemeID === new2History.id) {
          themeVars.forEach((varName, index) => {
            document.documentElement.style.setProperty(varName, colors[index]);
          });
        }
      }).finally(() => { generateColorsByStoryFlag = false });
      document.body.removeChild(backdrop);
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
      location.reload();
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
  function renderHistory() {
    historyContainer.innerHTML = '';
    const ifHistorys = getHistorys();
    if (ifHistorys) {
      for (const key in ifHistorys) {
        const history = ifHistorys[key];
        const IFHistoryItem = createHistoryItem(history);
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
  function lastCorrect(): string | void {
    return (contentArea.lastElementChild as HTMLElement)?.dataset?.correct;
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
    if (options) renderOptions(options);
    mainContainer.scrollTop = mainContainer.scrollHeight;
  }
  function renderOptions(options: string[]) {
    inputArea.classList.remove('hidden');
    messageInput.placeholder = "输入接下来的剧情走向...";
    selectArea.innerHTML = '';
    if (options.length > 0) {
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
    const [image, resp_data, markedContent] = resp;
    if (image) {
      mainContainer.style.setProperty('--bg-image', `url(${image})`);
      mainContainer.classList.add('has-image');
      const img = document.createElement('img');
      img.src = image;
      img.className = 'if-image';
      ifContent.appendChild(img);
      img.onload = () => { if (rendering) { mainContainer.scrollTop = mainContainer.scrollHeight; } };
    }
    ifContent.appendChild(createChapterTitle(resp_data.title));
    ifContent.innerHTML += markedContent;
    const options = resp_data.options;
    if (options.length > 0) {
      ifContent.dataset.options = JSON.stringify(options);
      const correct = resp_data.correct;
      if (correct > 0) { ifContent.dataset.correct = correct.toString(); }
      history.messages.push(resp_data.content);
    }
    history.innerHTML += ifContent.outerHTML;
    saveHistory(history);
    if (rendering) { selectHistory(history); }
  }
  let selectOptionFlag = false;
  function selectOption(option: string, keep: boolean) {
    if (selectOptionFlag) return;
    selectOptionFlag = true;
    const ifContent = document.createElement('div');
    ifContent.className = 'if-content';
    ifContent.innerHTML = `<div class="delete-this"><i class="fa-solid fa-trash" ></i></div>\n<p>${option}</p>`;
    const history = getHistoryByID(currentIFThemeID)
    if (!history) {
      alert("当前IF主题已丢失");
      selectOptionFlag = false;
      return;
    }
    history.messages.push(option);
    const func = keep ? (history.he ? ifHE : ifKEEP) : ifBE;
    const ifThemeID = currentIFThemeID;
    func(history.messages).then((resp) => {
      renderResponse(resp, ifContent, history, ifThemeID === currentIFThemeID);
    }).finally(() => { selectOptionFlag = false; });
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

  newFictionBtn.onclick = () => {
    if (selectOptionFlag) return;
    if (currentIFThemeID === '') return;
    newFiction();
  };

  messageInput.oninput = () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
  }
  sendBtn.onclick = () => {
    if (selectOptionFlag) return;
    const message = messageInput.value.trim();
    if (message.length < 1) return;
    if (currentIFThemeID) {
      messageInput.value = "";
      selectOption(message, true);
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
      ifSTART(message).then(([resp, colors]) => {
        messageInput.value = "";
        contentArea.innerHTML = ""
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
    if (selectOptionFlag) return;
    const target = e.target as HTMLElement;
    let selectItem: HTMLElement | null;
    if (selectItem = target.closest('.select-item')) {
      const option = selectItem.querySelector('p')?.textContent;
      if (!option) return;
      selectItem.classList.add('selected');
      const correct = lastCorrect()
      const select = selectItem.dataset.id
      selectOption(option, !(select && correct) || select === correct);
      return;
    } else if (target.closest('.select-back')) {
      const history = getHistoryByID(currentIFThemeID);
      if (!history) return;
      history.messages.pop();
      delete history.he;
      saveHistory(history);
      selectHistory(history);
      return;
    }

  };
  contentArea.onclick = (e) => {
    if (selectOptionFlag) return;
    const history = getHistoryByID(currentIFThemeID);
    if (!history) return;
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
    saveHistory(history);
    console.log(history.messages);
    const options = lastOptions();
    if (options) renderOptions(options)
  };
  configBtn.onclick = () => configTemplate()
  about.onclick = () => aboutTemplate()
});