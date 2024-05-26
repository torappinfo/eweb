const { app, BrowserWindow, globalShortcut, Menu, shell, clipboard,session, protocol, net} = require('electron')
let win;

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
      url = args.slice(3).join(" ");
      win.webContents.executeJavaScript("handleQuery(`"+url+"`)",false);
      win.setTitle(url);
    }else
      createWindow();
  })
}
Menu.setApplicationMenu(null);

const fs = require('fs');
const path = require('path')
const process = require('process')
var gredirects = [];
var gredirect;
var redirects;
var bRedirect = true;
var bJS = true;
var proxies = {};
var proxy;
var useragents = {};
var defaultUA =
    "Mozilla/5.0 (X11; Linux x86_64; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" +
    process.versions.chrome +" Safari/537.36";
app.userAgentFallback = defaultUA;//no effect

fs.readFile(path.join(__dirname,'redirect.json'), 'utf8', (err, jsonString) => {
  if (err) return;
  try {
    redirects = JSON.parse(jsonString);
  } catch (e){}
});


function createWindow () {
  win = new BrowserWindow(
    {width: 800, height: 600,autoHideMenuBar: true,
     webPreferences: {
       webviewTag: true,
     }});

  win.on('closed', function () {
    win = null
  })

  win.loadFile('index.html');
  fs.readFile(path.join(__dirname,'search.json'), 'utf8', (err, jsonString) => {
    if (err) return;
    win.webContents.executeJavaScript("engines=JSON.parse(`"+jsonString+"`)",false);
  });

  fs.readFile(path.join(__dirname,'default.autoc'), 'utf8', (err, str) => {
    if(err) return;
    let js = "appendAutoc(`"+str+"`)";
    win.webContents.executeJavaScript(js,false);
  });

  fs.readFile(path.join(__dirname,'gredirect.json'), 'utf8', (err, jsonString) => {
    if (err) return;
    try {
      gredirects = JSON.parse(jsonString);
    } catch (e){}
  });

  fs.readFile(path.join(__dirname,'proxy.json'), 'utf8', (err, jsonString) => {
    if (err) return;
    try {
      let key1st;
      proxies = JSON.parse(jsonString,(key,value)=>{
        if(!key1st) key1st=key;
        return value;
      });
      proxy = proxies[key1st];
    } catch (e){}
  });

  fs.readFile(path.join(__dirname,'uas.json'), 'utf8', (err, jsonString) => {
    if (err) return;
    try {
      useragents = JSON.parse(jsonString);
    } catch (e){}
  });

  if(process.argv.length>2){
    let url=process.argv.slice(2).join(" ");
    win.webContents.executeJavaScript("handleQuery(`"+url+"`)",false);
    win.setTitle(url);
  }

  //app.commandLine.appendSwitch ('trace-warnings');

  win.webContents.on('page-title-updated',(event,cmd)=>{
    console.log(cmd);
    addrCommand(cmd);
  });

  globalShortcut.register("Ctrl+G", ()=>{
    let js="{let q=document.forms[0].q;q.focus();q.value=tabs.children[iTab].src}"
    win.webContents.executeJavaScript(js,false)
  });

  globalShortcut.register("Ctrl+L", ()=>{
    win.webContents.executeJavaScript("document.forms[0].q.select()",false);
  });

  globalShortcut.register("Ctrl+T", ()=>{
    win.webContents.executeJavaScript("newTab();switchTab(tabs.children.length-1)",false);
  });

  globalShortcut.register("Ctrl+R", ()=>{
    gredirect=null;
  });

  globalShortcut.register("Ctrl+Shift+R", ()=>{
    if(0==gredirects.length) return;
    gredirect=gredirects[0];
  });

  globalShortcut.register("Ctrl+W", ()=>{
    win.webContents.executeJavaScript("tabClose()",false).then((r)=>{
      if(""===r) win.close();
    });
  });

  globalShortcut.register("Ctrl+Tab", ()=>{
    let js="tabInc(1);{let tab=tabs.children[iTab];let t=tab.getTitle();if(t)t;else tab.getURL()}";
    win.webContents.executeJavaScript(js,false).then((r)=>{
      win.setTitle(r);
    });
  });

  globalShortcut.register("Ctrl+Shift+Tab", ()=>{
    let js="tabDec(-1);{let tab=tabs.children[iTab];let t=tab.getTitle();if(t)t;else tab.getURL()}";
    win.webContents.executeJavaScript(js,false).then((r)=>{
      win.setTitle(r);
    });
  });

  globalShortcut.register("Ctrl+Left", ()=>{
    let js="tabs.children[iTab].goBack()";
    win.webContents.executeJavaScript(js,false);
  });

  globalShortcut.register("Ctrl+Right", ()=>{
    let js="tabs.children[iTab].goForward()";
    win.webContents.executeJavaScript(js,false);
  });
  
  globalShortcut.register("Esc", ()=>{
    let js = "document.activeElement.blur();tabs.children[iTab].stopFindInPage('clearSelection')";
    win.webContents.executeJavaScript(js,false);
  });

  globalShortcut.register("F5", ()=>{
    win.webContents.executeJavaScript("tabs.children[iTab].reload()",false);
  });
  protocol.handle("https",cbScheme_https);
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

app.on ('web-contents-created', (event, contents) => {
  if (contents.getType () === 'webview') {
    contents.setWindowOpenHandler(cbWindowOpenHandler);
    contents.on('context-menu',onContextMenu);
    contents.on('page-title-updated',cbTitleUpdate);
    //contents.on('focus', ()=>{cbFocus(contents)});
    if(redirects)
      contents.session.webRequest.onBeforeRequest(interceptRequest);
    //contents.on('did-finish-load',)
  }
});

function addrCommand(cmd){
  if(cmd.length<3) return;
  let c0 = cmd.charCodeAt(0);
  switch(c0){
  case 58: //':'
    args = cmd.substring(1).split(/\s+/);
    switch(args[0]){
    case "anycert":
      if(args.length==1)
        session.defaultSession.setCertificateVerifyProc((request, callback) => {
          callback(0);
        });
      else
        session.defaultSession.setCertificateVerifyProc(null);
      return;
    case "clear":
      if(args.length==1){
        return;
      }
      switch(args[1]){
      case "cache":
        session.defaultSession.clearCache();
        return;
      case "dns":
        session.defaultSession.clearHostResolverCache();
        return;
      case "storage":
        session.defaultSession.clearStorageData();
        return;
      }
      return;
    case "ext":
      session.defaultSession.loadExtension(args[1]);
      return;
    case "nj":
      bJS = false; return;
    case "uj":
      bJS = true; return;
    case "np":
      session.defaultSession.setProxy ({mode:"direct"});
      return;
    case "up":
      if(args.length>1)
        proxy = proxies[args[1]]; //retrieve proxy
      if(proxy)
        session.defaultSession.setProxy(proxy);
      return;
    case "ua":
      if(args.length==2)
        session.defaultSession.setUserAgent(useragents[args[1]]);
      else
        session.defaultSession.setUserAgent(defaultUA);
      return;
    }
  }
}

function cbFocus(webContents){
  let js = "if(focusMesg){let m=focusMesg;focusMesg=null;m}";
  win.webContents.executeJavaScript(js,false).then((r)=>{
    //focusMesg as js code
    console.log(r);
    if(r) webContents.executeJavaScript(r,false);
  });
}

function cbScheme_https(req){
  if(!bJS && req.url.endsWith(".js"))
    return new Response('',{});
  if(!gredirect){
    return net.fetch(req,{bypassCustomProtocolHandlers: true });
  }
  let newurl = gredirect+req.url;
  const options = {
    body:       req.body,
    headers:    req.headers,
    method:     req.method,
    referer:    req.referer,
    duplex: "half",
    bypassCustomProtocolHandlers: true
  };
  
  return net.fetch(newurl, options);
}

function interceptRequest(details, callback){
  do {
    if(!bRedirect ||(details.resourceType !== 'mainFrame' &&
                     details.resourceType !== 'subFrame')) break;
    let oURL = new URL(details.url);
    let domain = oURL.hostname;
    let newUrl;
    try{
      let newDomain = redirects[domain];
      if(!newDomain) break;
      newUrl = "https://"+newDomain+oURL.pathname+oURL.search+oURL.hash;
    }catch(e){break;}
    callback({ cancel: false, redirectURL: newUrl });
    return;
  }while(false);
  callback({ cancel: false });
}

function cbWindowOpenHandler({url}){
  let js = "newTab();switchTab(tabs.children.length-1);tabs.children[iTab].src='"+
      url+"'";
  win.webContents.executeJavaScript(js,false);
  return { action: "deny" }; 
}
function cbTitleUpdate(event,title){
  win.setTitle(title);
}
function showContextMenu(linkUrl){
  const titleItem = {
    label: linkUrl,
    enabled: false // Disable clicking on the title
  };
  const menuTemplate = [titleItem,
    {
      label: 'Open Link',
      click: () => {
        shell.openExternal(linkUrl);
      }
    },
    {
      label: 'Copy Link',
      click: () => {
        clipboard.writeText(linkUrl);
      }
    },
    {
      label: 'Download',
      click: () => {
        win.contentView.children[i].webContents.downloadURL(linkUrl);
      }
    },
  ];

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  contextMenu.popup();
}

function onContextMenu(event, params){
  //console.log(params);
  if (params.linkURL) {
    showContextMenu(params.linkURL);
  }
}
