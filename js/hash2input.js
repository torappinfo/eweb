(async ()=>{let d=document;let t=d.location.hash.substring(1);if(!t)return;t=decodeURI(t);while(true){let ta=d.querySelector('input[type="text"]');if(ta){ta.value=t;ta.dispatchEvent(new InputEvent('input'));ta.focus();return;}await new Promise(resolve=>setTimeout(resolve,400));}})()
