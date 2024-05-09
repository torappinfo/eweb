const { app, BrowserWindow, globalShortcut} = require('electron')
const path = require('path')
const process = require('process')
let win;
let view;
let url = process.argv[2];

function createWindow () {
  win = new BrowserWindow(
    {width: 800, height: 600,autoHideMenuBar: true,
     webPreferences: {
       webviewTag: true,
     }});

  win.on('closed', function () {
    win = null
  })

  let furl = `file://${path.join(__dirname, 'index.html')}#${url}`;
  win.loadURL(furl)

  globalShortcut.register("Ctrl+L", ()=>{
    win.webContents.executeJavaScript("document.forms[0].q.focus()",false);
  });

  globalShortcut.register("Esc", ()=>{
    win.webContents.executeJavaScript("document.activeElement.blur()",false);
  });
}

if(!app.requestSingleInstanceLock())
  app.quit()
else {
  app.on('ready', createWindow);
  app.on('second-instance', (event, args) => {
    // 当已经有运行的实例时，我们激活窗口而不是创建新的窗口
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.show()
      win.focus()
      url = args[3]
      let furl = `file://${path.join(__dirname, 'index.html')}#${url}`;
      win.loadURL(furl)
    }else
      createWindow();
  })
}

app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  if (win === null) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
