console.log('tabhelper init at', new Date())

const pr = console.log;

const settings = {
  version: '0.1.0'  
}

class Component {
  constructor () {
    
  } 
  _render() {}
}

function formatDate(d) {
  if (typeof d === 'number') {
    d = new Date(d);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDay()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2)}:${d.getMinutes().toString().padStart(2)}:${d.getSeconds().toString().padStart(2)}`;
}

function deleteByKey(arr, key, val) {
  for (var i=0; i<arr.length; i++) {
    if (arr[i] && arr[i][key] === val) {
      arr.splice(i, 1);
      break;
    }
  }
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
    this.displayPopup = [];
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
  
  resync(doneCb) {
    this.synced = false;
    this.render();
    this.sync(() => {
      this.render();
    });
    doneCb && doneCb(this);
  };
  
  restore(doneCb) {
    restoreFromKey('tab-helper-data', (val, err) => {
      pr(val, err);
      if (!err) {
        val = val || {};
        Object.assign(this, val);
        this.synced = true;
      }
      doneCb && doneCb(err); 
    });
  };
  
  saveTabs(doneCb) {
    getTabs((newTabs => {
      Object.keys(newTabs).forEach(windowId => {
        const tabGroup = {
          id: (this.tabs[0] && this.tabs[0].id) ? this.tabs[0].id+1 : 0,
          windowId: windowId,
          date: Date.now(),
          tabs: newTabs[windowId]
        };
        this.tabs.push(tabGroup);
      });
      this.resync(doneCb);
    }));
  };
  
  removeTabGroupPopup(id, doneCb) {
    id = +id;
    this.displayPopup.push({
      header: `Delete tab group of <b class='red-t' style='padding: 0 5px;'>${this.tabs.find(g => g.id === id).tabs.length}</b> tabs?`,
      handler: action => {
        if (action === 'OK') {
          deleteByKey(this.tabs, 'id', id);
          pr(this.tabs);
          this.resync(doneCb);
        } else {
          doneCb && doneCb();
        }
      }
    });
    this.render();
  };
  
  restoreTabGroup(id, doneCb) {
    id = +id;
    const tg = this.tabs.find(g => g.id === id);
    chrome.windows.create({
      url: tg.tabs.map(t => t.url)
    }, doneCb);
  };
  
  exportTabGroupPopup(id, doneCb) {
    id = +id;
    const tg = this.tabs.find(g => g.id === id);
    this.displayPopup.push({
      header: 'Export',
      body: `<pre>${JSON.stringify(tg, null, 2)}</pre>`
    });
    this.render();
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
    tabListView += `
      <div class="tab-gr-c" data-id="${tabGroup.id}">
      <div class="tab-gr group">
        <div class="tab-gr-header">
          <div class="small-label">${formatDate(tabGroup.date)}</div>
          <div class="b-restore small-button" data-id="${tabGroup.id}">Restore</div>
          <div class="b-export small-button" data-id="${tabGroup.id}">Export</div>
          <div class="b-delete small-button" data-id="${tabGroup.id}">Delete</div>
        </div>
        <div class="tab-gr-list">`;
    
    tabGroup.tabs.forEach(tab => {
      tabListView += `<div class="tab-item">&#8226;&nbsp;<a class="tab-link" href="${tab.url}">${tab.title}</a></div>`;
    });
    
    tabListView += `</div></div></div>`;
  });

  let popup = '';
  
  if (this.displayPopup.length) {
    const p = this.displayPopup[0];
    const actions = p.actions || ['OK', 'Cancel']
    popup = `
      <div class='popup-c'>
        <div class='popup-fs'>
          <div class='popup-header'>${p.header || 'popup'}</div>
          ${p.body ? `<div class='popup-body'>${p.body}</div>` : ''}
          <div class='popup-actions'>
            ${actions.map((a,i) => `<div data-action="${a}" class="${'action action-'+i}">${a}</div>`).join(' ')}
          </div>
        </div>
      </div>
    `
  }
  
  mountNode.innerHTML = `
  ${popup}
  <div class='header'>
    <h3>Tab Helper</h3>
    <div class='button-c' style='flex: 1'>
      <div class='icon-c pointer'><img style='height: 34px; width: 34px;' src="search.svg" /></div>
      <input type='text' class='search field' style='flex: 1'></input>
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
    '#savetabs': () => {model.saveTabs();},
    '.b-delete': (ev) => {
      const id = ev.target.getAttribute('data-id');
      pr(id);
      model.removeTabGroupPopup(id);
     },
    '.b-restore': (ev) => {
      const id = ev.target.getAttribute('data-id');
      pr(id);
      model.restoreTabGroup(id);
    },
    '.b-export': (ev) => {
      const id = ev.target.getAttribute('data-id');
      pr(id);
      model.exportTabGroupPopup(id);
    }
  });
  
  if (model.displayPopup.length) {
    attachHandlers({
      '.popup-actions': (e) => {
        const action = e.target.getAttribute('data-action');
        pr('popup action', action);
        
        this.displayPopup[0].handler && this.displayPopup[0].handler(action);
        
        this.displayPopup.pop();
        this.render();
      }
    });
  }
}

function startApp() {
  
  const model = new App();
  window.model = model;
    
  model.connectRenderer(render, $('#root-node')[0]);
  
  model.render();
  
  model.restore((err) => {
    model.render();
  });
}

document.addEventListener('DOMContentLoaded', startApp);
