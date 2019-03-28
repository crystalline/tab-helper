console.log('tabhelper init at', new Date())

const pr = console.log;

const settings = {
  version: '0.1.0'  
}

function formatDate(d) {
  if (typeof d === 'number') {
    d = new Date(d);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDay()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2)}:${d.getMinutes().toString().padStart(2)}:${d.getSeconds().toString().padStart(2)}`;
}

function pick(obj, keys) {
  var ret = {};
  for (var i=0; i<keys.length; i++) {
    ret[keys[i]] = obj[keys[i]];
  }
  return ret;
}

class App {
  constructor () {
    this.tabs = [];
    this.searchQuery = false;
    this.options = {};
    this.renderer = () => {};
    this.synced = false;
    this.displayPopup = false;
  }
  
  connectRenderer(renderer, mountNode) {
    this.renderer = renderer;
    this.mountNode = mountNode;
  };
  
  render() {
    this.renderer(this, this.mountNode);
  };
  
  // sync state to local storage, and to remote server, if enabled
  sync(doneCb) {
    persistToKey('tab-helper-data', pick(this, ['tabs', 'options']), (err) => {
      if (!err) {
        this.synced = true;
      }
      doneCb && doneCb(err);
    });
  }
  
  restore(doneCb) {
    restoreFromKey('tab-helper-data', (val, err) => {
      pr(val,err);
      if (!err) {
        Object.assign(this, val);
        this.synced = true;
      }
      doneCb && doneCb(err); 
    });
  };
  
  saveTabs(doneCb) {
    getTabs((newTabs => {
      Object.keys(newTabs).forEach(windowId => {
        const tabGroup = {windowId: windowId, date: Date.now(), tabs: newTabs[windowId]};
        this.tabs.push(tabGroup);
      });
      this.synced = false;
      this.render();
      this.sync(() => {
        this.render();
      });
      doneCb && doneCb(this);
    }));
  };
}

function persistToKey(key, val, doneCb) {
  chrome.storage.local.set({
    [key]: val
  }, (err) => {
    doneCb && doneCb(err);
  }); 
}

function restoreFromKey(key, doneCb) {
  chrome.storage.local.get([key], (val, err) => {
    doneCb && doneCb(val && val[key], err);
  }); 
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
  const queryInfo = {
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    const _windows = {};
    tabs.forEach(t => {
      const id = t.windowId;
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
    let popup = '';
    
    if (this.displayPopup) {
      const actions = this.displayPopup.actions || ['ok', 'cancel']
      popup = `
        <div class='popup-fs'>
          <div class='popup-header'></div>
          <div class='popup-text'></div>
          <div class='popup-actions'>
            ${actions.map(a => `<div data-action="${a}"class='action'>${a}</div>`).join(' ')}
          </div>
        </div>
      `
    }
    
    tabListView += `
      ${popup}
      <div class="tab-gr-c">
      <div class="tab-gr group">
        <div class="tab-gr-header">
          <div class="small-label">${formatDate(tabGroup.date)}</div>
          <div class="small-button">Restore</div>
          <div class="small-button">Export</div>
          <div class="small-button">Delete</div>
        </div>
        <div class="tab-gr-list">`;
    
    tabGroup.tabs.forEach(tab => {
      tabListView += `<div class="tab-item">&#8226;&nbsp;<a class="tab-link" href="${tab.url}">${tab.title}</a></div>`;
    });
    
    tabListView += `</div></div></div>`;
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
      "<div style='width: 90px; display: flex; justify-content: center;' class='label green'>Synced</div>" :
      "<div style='width: 90px; display: flex; justify-content: center;' class='label red'>Not synced</div>"
    }
  </div>
  <div class='tabs'>${tabListView}</div>
` ;

  attachHandlers({
    '#savetabs': () => {model.saveTabs();}
  });
}

function startApp() {
  model.tabs = [
  /*
    {
     date: Date.now(),
     tabs: [
      {url: 'https://example.com', title: 'example'},
      {url: 'https://wikipedia.com', title: 'wikipedia'},
     ]
    }
  */
  ];
  
  model.connectRenderer(render, $('#root-node')[0]);
  
  model.render();
  
  model.restore((err) => {
    model.render();
  });
}

document.addEventListener('DOMContentLoaded', startApp);
