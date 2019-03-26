console.log('tabhelper init!')

const pr = console.log;

const settings = {
  version: '0.1.0'  
}

class App {
  constructor () {
    this.tabs = [];
    this.searchQuery = false;
    this.options = {};
    this.renderer = () => {};
  }
  
  connectRenderer(renderer, mountNode) {
    this.renderer = renderer;
    this.mountNode = mountNode;
  };
  
  render() {
    this.renderer(this, this.mountNode);
  };
  
  saveTabs(doneCb) {
    getTabs((newTabs => {
      Object.keys(newTabs).forEach(windowId => {
        const tabGroup = {windowId: windowId, date: Date.now(), tabs: newTabs[windowId]};
        this.tabs.push(tabGroup);
      });
      this.render();
      doneCb && doneCb(this);
    }));
  };
}

const model = new App();

function copyToClipboard(text) {
  const input = document.createElement('input');
  input.style.position = 'fixed';
  input.style.opacity = 0;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('Copy');
  document.body.removeChild(input);
};

function getTabs(callback) {
  var queryInfo = {
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var _windows = {};
    tabs.forEach(t => {
      var id = t.windowId;
      pr(id);
      if (!_windows[id]) _windows[id] = [];
      _windows[id].push({
        title: t.title,
        url: t.url
      });
    })
    callback(_windows);
  });
}

function $(sel) {
  return document.querySelectorAll(sel);
}

function getSavedSession(data) {
  return JSON.stringify({
    type: 'session',
    date: Date.now(),
    version: settings.version,
    data: data || window.tabData
  })
}

function attachHandlers(desc) {
  Object.keys(desc).forEach(sel => {
    Array.from($(sel)).forEach(node => {
      if (typeof desc[sel] === 'function') {
        node.addEventListener('click', desc[sel]);  
      }
    });
  });
}

function render(model, mountNode) {
  
  let tabListView = '';
  
  model.tabs.forEach(tabGroup => {
    tabListView += '<div class="tab-gr">';
    tabListView += '<div class="tab-gr-header"></div>';
    tabListView += '<div class="tab-gr-list">';
    tabGroup.tabs.forEach(tab => {
      tabListView += `<div class="tab-item" href="${tab.url}">${tab.title}</div>`;
    });
    tabListView += '</div></div>';
  });
  
  mountNode.innerHTML = `
  <div class='header'>
    <h3>Tab Helper</h3>
    <div class='button-c'>
      <div class='button' id='savetabs'>Save all tabs</div>
      <div class='button' id='savetabs-novel'>Save only new tabs</div>
      <div class='button' id='export'>Export</div>
      <div class='button' id='import'>Import</div>
      <div class='button' id='options'>Options</div>
    </div>
    ${model.synced ?
      "<div class='indicator ind-green'>Synced</div>" :
      "<div class='indicator ind-red'>Not synced</div>"
    }
  </div>
  <div class='tabs'>${tabListView}</div>
` ;

  attachHandlers({
    '#savetabs': () => {model.saveTabs();}
  });
}

function saveData(model, doneCb) {
  chrome.storage.local.set({
      tabs: model.tabs
  }, (err) => {
    doneCb && doneCb(err, model);
  });
}

function getData(model, doneCb) {
  chrome.storage.local.get('tabs', (tabs, err) => {
    if (!err) {
      model.tabs = tabs;  
    }
    doneCb && doneCb(err, model);
  });
}

function startApp() {
  model.tabs = [
    {
     date: Date.now(),
     tabs: [
      {url: 'https://example.com', title: 'example'},
      {url: 'https://wikipedia.com', title: 'wikipedia'},
     ]
    }
  ];
  
  model.connectRenderer(render, $('#root-node')[0]);
  
  model.render();
}

document.addEventListener('DOMContentLoaded', startApp);
