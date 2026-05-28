"use strict";(()=>{var m={sm:{bubble:48,icon:20,offset:16},md:{bubble:56,icon:24,offset:20},lg:{bubble:64,icon:28,offset:24}};function b(n){return n==="bottom-left"||n==="left"?"bottom-left":"bottom-right"}function x(n){return n==="sm"||n==="lg"?n:"md"}function w(){let n=document.currentScript??document.querySelector("script[data-tenant]"),e=(i,o)=>n?.getAttribute(`data-${i}`)??o,t="";if(n&&n.src)try{t=new URL(n.src).origin}catch{}return{tenantId:e("tenant",""),color:e("color","#FF6B2C"),welcome:e("welcome","Hi there! How can I help you today?"),name:e("name","Convo"),position:b(e("position","bottom-right")),size:x(e("size","md")),apiBase:t}}function y(){let n="convo_visitor_id",e=localStorage.getItem(n);return e||(e="v_"+crypto.randomUUID(),localStorage.setItem(n,e)),e}function T(n){let e=m[n.size],t=n.position==="bottom-left"?"left":"right",i=`${t}: ${e.offset}px;`,o=`${t}: 20px;`,s=e.bubble+e.offset+12;return`
    :host {
      --convo-color: ${n.color};
      --convo-bubble-size: ${e.bubble}px;
      --convo-bubble-icon: ${e.icon}px;
      --convo-bubble-offset: ${e.offset}px;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
    }

    /* Bubble */
    .convo-bubble {
      position: fixed;
      bottom: ${e.offset}px;
      ${i}
      width: ${e.bubble}px;
      height: ${e.bubble}px;
      border-radius: 50%;
      background: var(--convo-color);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      z-index: 2147483647;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .convo-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }
    .convo-bubble svg {
      width: ${e.icon}px;
      height: ${e.icon}px;
      transition: transform 0.3s ease;
    }
    .convo-bubble.open svg {
      transform: rotate(90deg);
    }

    /* Panel */
    .convo-panel {
      position: fixed;
      bottom: ${s}px;
      ${o}
      width: 380px;
      max-width: calc(100vw - 24px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .convo-panel.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .convo-header {
      padding: 16px 20px;
      background: var(--convo-color);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      position: relative;
    }
    .convo-close {
      width: 44px;
      height: 44px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
      padding: 0;
      flex-shrink: 0;
      margin-left: auto;
    }
    .convo-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .convo-close svg {
      width: 20px;
      height: 20px;
    }
    .convo-header-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4ade80;
      flex-shrink: 0;
    }
    .convo-header-text h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
    }
    .convo-header-text p {
      font-size: 12px;
      opacity: 0.85;
      margin: 0;
    }

    /* Messages area */
    .convo-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .convo-messages::-webkit-scrollbar {
      width: 4px;
    }
    .convo-messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 2px;
    }

    /* Message bubbles */
    .convo-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: convo-msg-in 0.25s ease;
    }
    .convo-msg.user {
      align-self: flex-end;
      background: var(--convo-color);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .convo-msg.assistant {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }

    @keyframes convo-msg-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Typing indicator */
    .convo-typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: #f1f5f9;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
    }
    .convo-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94a3b8;
      animation: convo-bounce 1.4s infinite;
    }
    .convo-typing span:nth-child(2) {
      animation-delay: 0.16s;
    }
    .convo-typing span:nth-child(3) {
      animation-delay: 0.32s;
    }
    @keyframes convo-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Input area */
    .convo-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
      background: #fff;
    }
    .convo-input-area input {
      flex: 1;
      min-width: 0;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s ease;
    }
    .convo-input-area input:focus {
      border-color: var(--convo-color);
    }
    .convo-input-area input::placeholder {
      color: #94a3b8;
    }
    .convo-input-area button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--convo-color);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s ease;
    }
    .convo-input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Powered by */
    .convo-powered {
      padding: 6px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      flex-shrink: 0;
    }
    .convo-powered a {
      color: #64748b;
      text-decoration: none;
    }

    /* Mobile */
    @media (max-width: 640px) {
      .convo-panel {
        position: fixed;
        border-radius: 12px;
        /* All four edges set by JS via setupViewportHandler() */
        /* Fallbacks if JS hasn't run yet or visualViewport unavailable */
        top: 12px;
        bottom: 12px;
        left: 12px;
        right: 12px;
        width: auto;
        height: auto;
      }
      
      /* Hide the floating bubble when the panel is open on mobile \u2014 the in-header close button takes over. */
      .convo-bubble.open {
        display: none;
      }
      
      .convo-close {
        display: flex;
        width: 28px;
        height: 28px;
      }
      
      .convo-close svg {
        width: 14px;
        height: 14px;
      }
      
      .convo-header {
        padding: 10px 12px;
        height: 44px;
        box-sizing: border-box;
      }
      
      .convo-header-text h3 {
        font-size: 14px;
      }
      
      .convo-header-text p {
        display: none;
      }
      
      .convo-msg {
        padding: 8px 12px;
      }
      
      .convo-input-area {
        padding: 8px 12px;
      }
      
      .convo-input-area input {
        padding: 8px 12px;
      }
      
      .convo-input-area button {
        width: 32px;
        height: 32px;
      }
      
      .convo-input-area button svg {
        width: 16px;
        height: 16px;
      }
      
      .convo-powered.keyboard-open {
        display: none;
      }
    }
  `}var g='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',I='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',k='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',E='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',h=class h{constructor(){this.conversationId=null;this.messages=[];this.isOpen=!1;this.isStreaming=!1;this.sessionTracked=!1;this.pipelineTriggered=!1;this.idleTimer=null;this.viewportRafId=null;this.config=w(),this.visitorId=y(),this.restoreSession(),this.init()}sessionStorageKey(){return`convo_session_${this.config.tenantId}_${this.visitorId}`}restoreSession(){try{let e=sessionStorage.getItem(this.sessionStorageKey());if(!e)return;let t=JSON.parse(e);t.conversationId&&(this.conversationId=t.conversationId),Array.isArray(t.messages)&&(this.messages=t.messages),t.sessionTracked&&(this.sessionTracked=!0)}catch{}}persistSession(){try{sessionStorage.setItem(this.sessionStorageKey(),JSON.stringify({conversationId:this.conversationId,messages:this.messages,sessionTracked:this.sessionTracked}))}catch{}}async init(){if(!this.config.tenantId){console.warn("[Convo] Missing data-tenant attribute on script tag.");return}await this.mergeRemoteConfig();let e=document.createElement("div");e.id="convo-widget",this.shadow=e.attachShadow({mode:"open"}),document.body.appendChild(e),this.render(),this.attachEvents(),this.setupViewportHandler(),this.trackSession()}async mergeRemoteConfig(){try{let e=await fetch(`${this.config.apiBase}/api/widget/config?tenant=${encodeURIComponent(this.config.tenantId)}`,{method:"GET",credentials:"omit"});if(!e.ok)return;let t=await e.json();typeof t.name=="string"&&t.name.trim()&&(this.config.name=t.name),typeof t.welcome=="string"&&t.welcome.trim()&&(this.config.welcome=t.welcome),typeof t.color=="string"&&t.color.trim()&&(this.config.color=t.color),(t.position==="bottom-left"||t.position==="bottom-right")&&(this.config.position=t.position),(t.size==="sm"||t.size==="md"||t.size==="lg")&&(this.config.size=t.size)}catch{}}render(){let e=document.createElement("style");if(e.textContent=T(this.config),this.bubble=document.createElement("button"),this.bubble.className="convo-bubble",this.bubble.setAttribute("aria-label","Open chat"),this.bubble.innerHTML=g,this.panel=document.createElement("div"),this.panel.className="convo-panel",this.panel.innerHTML=`
      <div class="convo-header">
        <div class="convo-header-dot"></div>
        <div class="convo-header-text">
          <h3>${this.escapeHtml(this.config.name)}</h3>
          <p>Usually replies instantly</p>
        </div>
        <button class="convo-close" aria-label="Close chat">${E}</button>
      </div>
      <div class="convo-messages"></div>
      <div class="convo-input-area">
        <input type="text" placeholder="Type a message..." aria-label="Type a message" />
        <button aria-label="Send message">${k}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `,this.messagesEl=this.panel.querySelector(".convo-messages"),this.inputEl=this.panel.querySelector("input"),this.sendBtn=this.panel.querySelector(".convo-input-area button"),this.closeBtn=this.panel.querySelector(".convo-close"),this.shadow.appendChild(e),this.shadow.appendChild(this.panel),this.shadow.appendChild(this.bubble),this.messages.length>0)for(let t of this.messages)this.addMessageToUI(t.role,t.content);else this.addMessageToUI("assistant",this.config.welcome)}attachEvents(){this.bubble.addEventListener("click",()=>this.toggle()),this.closeBtn.addEventListener("click",()=>this.close()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.send())}),this.inputEl.addEventListener("focus",()=>{setTimeout(()=>{this.inputEl.scrollIntoView({block:"end",behavior:"smooth"})},200)})}setupViewportHandler(){if(typeof window>"u"||!window.visualViewport)return;let e=12,t=()=>{this.viewportRafId===null&&(this.viewportRafId=requestAnimationFrame(()=>{if(this.viewportRafId=null,!window.visualViewport)return;if(window.innerWidth>640){this.panel.style.top="",this.panel.style.height="",this.panel.style.left="",this.panel.style.width="",this.panel.style.right="";return}let i=window.visualViewport,o=i.offsetTop+e,s=i.height-e*2,a=i.offsetLeft+e,r=i.width-e*2;this.panel.style.top=`${o}px`,this.panel.style.height=`${s}px`,this.panel.style.left=`${a}px`,this.panel.style.width=`${r}px`,this.panel.style.right="auto";let l=this.panel.querySelector(".convo-powered");if(l){let d=window.innerWidth<=640&&i.height<window.innerHeight*.75;l.classList.toggle("keyboard-open",d),d&&this.messagesEl&&(this.messagesEl.scrollTop=this.messagesEl.scrollHeight)}}))};t(),window.visualViewport.addEventListener("resize",t),window.visualViewport.addEventListener("scroll",t),window.addEventListener("orientationchange",t),window.addEventListener("resize",t)}toggle(){this.isOpen=!this.isOpen,this.panel.classList.toggle("visible",this.isOpen),this.bubble.classList.toggle("open",this.isOpen),this.bubble.innerHTML=this.isOpen?I:g,this.bubble.setAttribute("aria-label",this.isOpen?"Close chat":"Open chat"),this.isOpen?setTimeout(()=>this.inputEl.focus(),300):this.triggerPipeline()}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("visible"),this.bubble.classList.remove("open"),this.bubble.innerHTML=g,this.bubble.setAttribute("aria-label","Open chat"),this.triggerPipeline())}async send(){let e=this.inputEl.value.trim();if(!(!e||this.isStreaming)){this.inputEl.value="",this.addMessageToUI("user",e),this.messages.push({role:"user",content:e}),this.persistSession(),this.isStreaming=!0,this.sendBtn.disabled=!0,this.showTyping();try{let t=await fetch(`${this.config.apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,conversationId:this.conversationId,visitorId:this.visitorId,message:e,metadata:{pageUrl:window.location.href,referrer:document.referrer||null}})});if(!t.ok||!t.body)throw new Error(`HTTP ${t.status}`);this.hideTyping();let i=this.addMessageToUI("assistant",""),o="",s=t.body.getReader(),a=new TextDecoder,r="";for(;;){let{done:l,value:d}=await s.read();if(l)break;r+=a.decode(d,{stream:!0});let u=r.split(`
`);r=u.pop()||"";for(let f of u){if(!f.startsWith("data: "))continue;let v=f.slice(6).trim();if(v)try{let c=JSON.parse(v);c.type==="meta"&&c.conversationId?(this.conversationId=c.conversationId,this.trackEngagement()):c.type==="token"&&c.content?(o+=c.content,i.innerHTML=this.renderMarkdown(o),this.scrollToBottom()):c.type==="error"&&(i.textContent="Sorry, something went wrong. Please try again.")}catch{}}}this.messages.push({role:"assistant",content:o}),this.persistSession(),this.resetIdleTimer()}catch{this.hideTyping(),this.addMessageToUI("assistant","Sorry, I'm having trouble connecting. Please try again in a moment.")}finally{this.isStreaming=!1,this.sendBtn.disabled=!1}}}addMessageToUI(e,t){let i=document.createElement("div");return i.className=`convo-msg ${e}`,e==="assistant"?i.innerHTML=this.renderMarkdown(t):i.textContent=t,this.messagesEl.appendChild(i),this.scrollToBottom(),i}showTyping(){let e=document.createElement("div");e.className="convo-typing",e.id="convo-typing-indicator",e.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(e),this.scrollToBottom()}hideTyping(){let e=this.shadow.getElementById("convo-typing-indicator");e&&e.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}isInternalLink(e){if(!e)return!1;let t=e.trim();if(/^(mailto:|tel:|sms:|javascript:)/i.test(t))return!1;if(t.startsWith("/")||t.startsWith("#")||t.startsWith("?"))return!0;try{let i=new URL(t,window.location.href),o=r=>r.replace(/^www\./i,"").toLowerCase(),s=o(i.hostname),a=o(window.location.hostname);return!!(s===a||s.endsWith("."+a)||a.endsWith("."+s))}catch{return!0}}renderMarkdown(e){let t=this.escapeHtml(e);return t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,"<em>$1</em>"),t=t.replace(/`(.+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'),t=t.replace(/\[(.+?)\]\((.+?)\)/g,(i,o,s)=>{let a=this.isInternalLink(s),r=this.escapeHtml(o),l=this.escapeHtml(s);return a?`<a href="${l}" style="color:inherit;text-decoration:underline;">${r}</a>`:`<a href="${l}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${r}</a>`}),t=t.replace(/^- (.+)$/gm,"\u2022 $1"),t=t.replace(/\n/g,"<br>"),t}async trackSession(){if(!this.sessionTracked){this.sessionTracked=!0;try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,pageUrl:window.location.href})})}catch{}}}async trackEngagement(){try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,engaged:!0,conversationId:this.conversationId})})}catch{}}triggerPipeline(){this.pipelineTriggered||!this.conversationId||this.messages.length<2||(this.pipelineTriggered=!0,this.clearIdleTimer(),fetch(`${this.config.apiBase}/api/pipeline/trigger`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId})}).catch(()=>{}))}resetIdleTimer(){this.clearIdleTimer(),this.conversationId&&this.messages.length>=2&&!this.pipelineTriggered&&(this.idleTimer=setTimeout(()=>this.triggerPipeline(),h.IDLE_TIMEOUT_MS))}clearIdleTimer(){this.idleTimer&&(clearTimeout(this.idleTimer),this.idleTimer=null)}};h.IDLE_TIMEOUT_MS=12e4;var p=h;typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new p):new p);})();
