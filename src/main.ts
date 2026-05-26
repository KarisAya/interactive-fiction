import './styles/sidebar.css';
import './styles/main.css';
import md5 from 'blueimp-md5';
import type { ExtendResp } from './core';
import { ifSTART, ifKEEP, ifBE } from './core';

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
function setCurrentHistory(history: IFHistory) {
  const rawData = localStorage.getItem('history');
  if (!rawData) {
    localStorage.setItem('history', JSON.stringify({ [currentIFThemeID]: history }));
    return;
  }
  try {
    const ifHistorys: IFHistorys = JSON.parse(rawData);
    ifHistorys[currentIFThemeID] = history;
    localStorage.setItem('history', JSON.stringify(ifHistorys));
    return
  } catch (e) {
    localStorage.setItem('history', JSON.stringify({ [currentIFThemeID]: history }));
    return
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

function createWelcomeScreen() {
  const welcomeScreen = document.createElement('div');
  welcomeScreen.className = 'welcome-screen';
  welcomeScreen.innerHTML = `<h1><i class="fa-solid fa-book" id="welcomeLogo"></i>创建一个互动小说主题</h1>`;
  return welcomeScreen;
}

function createHistoryItem(history: IFHistory) {
  const IFHistoryItem = document.createElement('div');
  IFHistoryItem.className = 'history-item';
  IFHistoryItem.id = history.id;
  IFHistoryItem.textContent = history.title;
  return IFHistoryItem;
}

function createEmptyHistory() {
  const emptyHistory = document.createElement('div');
  emptyHistory.className = 'empty-history';
  emptyHistory.innerHTML = '<i class="fa-solid fa-circle-notch"></i><p>暂无历史剧本</p>';
  return emptyHistory;
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
        IFHistoryItem.onclick = () => {
          const history = getHistoryByID(key);
          if (!history) return;
          selectHistory(history);
          mainContainer.scrollTop = mainContainer.scrollHeight;
        };
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
    if (options) renderOptions(options)
  }
  function renderOptions(options: string[]) {
    inputArea.classList.remove('hidden');
    messageInput.placeholder = "输入接下来的剧情走向...";
    selectArea.innerHTML = '';
    options.forEach((option, index) => {
      const optionItem = document.createElement('div');
      optionItem.className = 'select-item';
      optionItem.dataset.id = index.toString();
      const p = document.createElement('p');
      p.textContent = option;
      optionItem.appendChild(p);
      selectArea.appendChild(optionItem);
    });
  }
  function renderResponse(resp: ExtendResp, ifContent: HTMLDivElement, history: IFHistory) {
    const [image, resp_data, markedContent] = resp;
    if (image) {
      mainContainer.style.setProperty('--bg-image', `url(${image})`);
      mainContainer.classList.add('has-image');
      const img = document.createElement('img');
      img.src = image;
      img.className = 'if-image';
      ifContent.appendChild(img);
      img.onload = () => {
        mainContainer.scrollTop = mainContainer.scrollHeight;
      };
    }
    ifContent.innerHTML += markedContent;
    contentArea.appendChild(ifContent);
    const options = resp_data.options;
    if (options.length > 0) {
      ifContent.dataset.options = JSON.stringify(options);
      ifContent.dataset.correct = resp_data.correct.toString();
      history.innerHTML = contentArea.innerHTML;
      history.messages.push(resp_data.content);
      setCurrentHistory(history);
      renderOptions(options);
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
    mainContainer.scrollTop = mainContainer.scrollHeight;
  }
  let selectOptionFlag = false;
  function selectOption(option: string, keep: boolean) {
    if (selectOptionFlag) return;
    selectOptionFlag = true;
    const ifContent = document.createElement('div');
    ifContent.className = 'if-content';
    ifContent.innerHTML = `<div class="delete-this"><i class="fa-solid fa-trash"></i></div>\n<p>${option}</p>`;
    const history = getHistoryByID(currentIFThemeID)
    if (!history) {
      alert("当前IF主题已丢失");
      return;
    }
    history.messages.push(option);
    const func = keep ? ifKEEP : ifBE;
    func(history.messages).then((resp) => {
      renderResponse(resp, ifContent, history);
      selectOptionFlag = false;
    });
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
    if (currentIFThemeID === '') return;
    newFiction();
  };

  messageInput.oninput = () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
  }
  sendBtn.onclick = () => {
    const message = messageInput.value.trim();
    messageInput.value = "";
    if (message.length < 1) return;
    if (currentIFThemeID) {
      selectOption(message, true);
    } else {
      currentIFThemeID = `IF${Date.now()}${md5(message)} `;
      contentArea.innerHTML = ""
      const ifContent = document.createElement('div');
      ifContent.className = 'if-content';
      contentArea.appendChild(ifContent);
      ifSTART(message).then(([resp, colors]) => {
        const history: IFHistory = {
          id: currentIFThemeID,
          messages: [],
          image: resp[0],
          title: resp[1].title,
          colors: colors,
          innerHTML: ""
        };
        selectHistory(history);
        renderResponse(resp, ifContent, history);
        renderHistory();
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
      selectHistory(history);
      mainContainer.scrollTop = mainContainer.scrollHeight;
      return;
    }

  };
  contentArea.onclick = (e) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.delete-this');
    if (!deleteBtn) return;
    const ifContent = deleteBtn.closest('.if-content');
    if (!ifContent) return;
    while (ifContent.nextElementSibling) {
      ifContent.nextElementSibling.remove();
    }
    ifContent.remove();
    const options = lastOptions();
    if (options) renderOptions(options)
  };
});