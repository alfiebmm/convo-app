"use strict";(()=>{function m(){let i=document.currentScript??document.querySelector("script[data-tenant]"),e=(n,s)=>i?.getAttribute(`data-${n}`)??s,t="";if(i&&i.src)try{t=new URL(i.src).origin}catch{}return{tenantId:e("tenant",""),color:e("color","#3B82F6"),welcome:e("welcome","Hi there! How can I help you today?"),name:e("name","Convo"),position:e("position","right"),apiBase:t}}function b(){let i="convo_visitor_id",e=localStorage.getItem(i);return e||(e="v_"+crypto.randomUUID(),localStorage.setItem(i,e)),e}function x(i){let e=i.position==="left"?"left: 20px;":"right: 20px;",t=i.position==="left"?"left: 20px;":"right: 20px;";return`
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
      bottom: 20px;
      ${e}
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${i.color};
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
      width: 24px;
      height: 24px;
      transition: transform 0.3s ease;
    }
    .convo-bubble.open svg {
      transform: rotate(90deg);
    }

    /* Panel */
    .convo-panel {
      position: fixed;
      bottom: 88px;
      ${t}
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
      background: ${i.color};
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      position: relative;
    }
    .convo-close {
      position: absolute;
      top: 8px;
      right: 8px;
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
      background: ${i.color};
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
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s ease;
    }
    .convo-input-area input:focus {
      border-color: ${i.color};
    }
    .convo-input-area input::placeholder {
      color: #94a3b8;
    }
    .convo-input-area button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${i.color};
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
        width: calc(100vw - 24px);
        ${i.position==="left"?"left: 12px;":"right: 12px;"}
        bottom: 12px;
        top: auto;
        border-radius: 12px;
        /* Use JS-driven --convo-vh for keyboard-aware sizing on iOS */
        height: calc(var(--convo-vh, 100svh) - 24px);
        max-height: calc(var(--convo-vh, 100svh) - 24px);
      }
      
      /* Fallback for browsers without dvh/svh or visualViewport */
      @supports not (height: 100dvh) {
        .convo-panel {
          height: calc(var(--convo-vh, 100vh) - 24px);
          max-height: calc(var(--convo-vh, 100vh) - 24px);
        }
      }
      
      .convo-close {
        display: flex;
      }
      
      .convo-header {
        padding: 16px 56px 16px 20px;
      }
    }
  `}var h='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',w='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',y='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',T='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',p=class p{constructor(){this.conversationId=null;this.messages=[];this.isOpen=!1;this.isStreaming=!1;this.sessionTracked=!1;this.pipelineTriggered=!1;this.idleTimer=null;this.viewportRafId=null;this.config=m(),this.visitorId=b(),this.restoreSession(),this.init()}sessionStorageKey(){return`convo_session_${this.config.tenantId}_${this.visitorId}`}restoreSession(){try{let e=sessionStorage.getItem(this.sessionStorageKey());if(!e)return;let t=JSON.parse(e);t.conversationId&&(this.conversationId=t.conversationId),Array.isArray(t.messages)&&(this.messages=t.messages),t.sessionTracked&&(this.sessionTracked=!0)}catch{}}persistSession(){try{sessionStorage.setItem(this.sessionStorageKey(),JSON.stringify({conversationId:this.conversationId,messages:this.messages,sessionTracked:this.sessionTracked}))}catch{}}async init(){if(!this.config.tenantId){console.warn("[Convo] Missing data-tenant attribute on script tag.");return}await this.mergeRemoteConfig();let e=document.createElement("div");e.id="convo-widget",this.shadow=e.attachShadow({mode:"open"}),document.body.appendChild(e),this.render(),this.attachEvents(),this.setupViewportHandler(),this.trackSession()}async mergeRemoteConfig(){try{let e=await fetch(`${this.config.apiBase}/api/widget/config?tenant=${encodeURIComponent(this.config.tenantId)}`,{method:"GET",credentials:"omit"});if(!e.ok)return;let t=await e.json();typeof t.name=="string"&&t.name.trim()&&(this.config.name=t.name),typeof t.welcome=="string"&&t.welcome.trim()&&(this.config.welcome=t.welcome),typeof t.color=="string"&&t.color.trim()&&(this.config.color=t.color)}catch{}}render(){let e=document.createElement("style");if(e.textContent=x(this.config),this.bubble=document.createElement("button"),this.bubble.className="convo-bubble",this.bubble.setAttribute("aria-label","Open chat"),this.bubble.innerHTML=h,this.panel=document.createElement("div"),this.panel.className="convo-panel",this.panel.innerHTML=`
      <div class="convo-header">
        <div class="convo-header-dot"></div>
        <div class="convo-header-text">
          <h3>${this.escapeHtml(this.config.name)}</h3>
          <p>Usually replies instantly</p>
        </div>
        <button class="convo-close" aria-label="Close chat">${T}</button>
      </div>
      <div class="convo-messages"></div>
      <div class="convo-input-area">
        <input type="text" placeholder="Type a message..." aria-label="Type a message" />
        <button aria-label="Send message">${y}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `,this.messagesEl=this.panel.querySelector(".convo-messages"),this.inputEl=this.panel.querySelector("input"),this.sendBtn=this.panel.querySelector(".convo-input-area button"),this.closeBtn=this.panel.querySelector(".convo-close"),this.shadow.appendChild(e),this.shadow.appendChild(this.panel),this.shadow.appendChild(this.bubble),this.messages.length>0)for(let t of this.messages)this.addMessageToUI(t.role,t.content);else this.addMessageToUI("assistant",this.config.welcome)}attachEvents(){this.bubble.addEventListener("click",()=>this.toggle()),this.closeBtn.addEventListener("click",()=>this.close()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.send())}),this.inputEl.addEventListener("focus",()=>{setTimeout(()=>{this.inputEl.scrollIntoView({block:"end",behavior:"smooth"})},200)})}setupViewportHandler(){if(typeof window>"u"||!window.visualViewport||window.innerWidth>640)return;let e=()=>{this.viewportRafId===null&&(this.viewportRafId=requestAnimationFrame(()=>{this.viewportRafId=null,window.visualViewport&&document.documentElement.style.setProperty("--convo-vh",`${window.visualViewport.height}px`)}))};e(),window.visualViewport.addEventListener("resize",e),window.visualViewport.addEventListener("scroll",e),window.addEventListener("orientationchange",e)}toggle(){this.isOpen=!this.isOpen,this.panel.classList.toggle("visible",this.isOpen),this.bubble.classList.toggle("open",this.isOpen),this.bubble.innerHTML=this.isOpen?w:h,this.bubble.setAttribute("aria-label",this.isOpen?"Close chat":"Open chat"),this.isOpen?setTimeout(()=>this.inputEl.focus(),300):this.triggerPipeline()}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("visible"),this.bubble.classList.remove("open"),this.bubble.innerHTML=h,this.bubble.setAttribute("aria-label","Open chat"),this.triggerPipeline())}async send(){let e=this.inputEl.value.trim();if(!(!e||this.isStreaming)){this.inputEl.value="",this.addMessageToUI("user",e),this.messages.push({role:"user",content:e}),this.persistSession(),this.isStreaming=!0,this.sendBtn.disabled=!0,this.showTyping();try{let t=await fetch(`${this.config.apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,conversationId:this.conversationId,visitorId:this.visitorId,message:e,metadata:{pageUrl:window.location.href,referrer:document.referrer||null}})});if(!t.ok||!t.body)throw new Error(`HTTP ${t.status}`);this.hideTyping();let n=this.addMessageToUI("assistant",""),s="",o=t.body.getReader(),a=new TextDecoder,r="";for(;;){let{done:c,value:f}=await o.read();if(c)break;r+=a.decode(f,{stream:!0});let g=r.split(`
`);r=g.pop()||"";for(let v of g){if(!v.startsWith("data: "))continue;let u=v.slice(6).trim();if(u)try{let l=JSON.parse(u);l.type==="meta"&&l.conversationId?(this.conversationId=l.conversationId,this.trackEngagement()):l.type==="token"&&l.content?(s+=l.content,n.innerHTML=this.renderMarkdown(s),this.scrollToBottom()):l.type==="error"&&(n.textContent="Sorry, something went wrong. Please try again.")}catch{}}}this.messages.push({role:"assistant",content:s}),this.persistSession(),this.resetIdleTimer()}catch{this.hideTyping(),this.addMessageToUI("assistant","Sorry, I'm having trouble connecting. Please try again in a moment.")}finally{this.isStreaming=!1,this.sendBtn.disabled=!1}}}addMessageToUI(e,t){let n=document.createElement("div");return n.className=`convo-msg ${e}`,e==="assistant"?n.innerHTML=this.renderMarkdown(t):n.textContent=t,this.messagesEl.appendChild(n),this.scrollToBottom(),n}showTyping(){let e=document.createElement("div");e.className="convo-typing",e.id="convo-typing-indicator",e.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(e),this.scrollToBottom()}hideTyping(){let e=this.shadow.getElementById("convo-typing-indicator");e&&e.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}isInternalLink(e){if(!e)return!1;let t=e.trim();if(/^(mailto:|tel:|sms:|javascript:)/i.test(t))return!1;if(t.startsWith("/")||t.startsWith("#")||t.startsWith("?"))return!0;try{let n=new URL(t,window.location.href),s=r=>r.replace(/^www\./i,"").toLowerCase(),o=s(n.hostname),a=s(window.location.hostname);return!!(o===a||o.endsWith("."+a)||a.endsWith("."+o))}catch{return!0}}renderMarkdown(e){let t=this.escapeHtml(e);return t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,"<em>$1</em>"),t=t.replace(/`(.+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'),t=t.replace(/\[(.+?)\]\((.+?)\)/g,(n,s,o)=>{let a=this.isInternalLink(o),r=this.escapeHtml(s),c=this.escapeHtml(o);return a?`<a href="${c}" style="color:inherit;text-decoration:underline;">${r}</a>`:`<a href="${c}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${r}</a>`}),t=t.replace(/^- (.+)$/gm,"\u2022 $1"),t=t.replace(/\n/g,"<br>"),t}async trackSession(){if(!this.sessionTracked){this.sessionTracked=!0;try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,pageUrl:window.location.href})})}catch{}}}async trackEngagement(){try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,engaged:!0,conversationId:this.conversationId})})}catch{}}triggerPipeline(){this.pipelineTriggered||!this.conversationId||this.messages.length<2||(this.pipelineTriggered=!0,this.clearIdleTimer(),fetch(`${this.config.apiBase}/api/pipeline/trigger`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId})}).catch(()=>{}))}resetIdleTimer(){this.clearIdleTimer(),this.conversationId&&this.messages.length>=2&&!this.pipelineTriggered&&(this.idleTimer=setTimeout(()=>this.triggerPipeline(),p.IDLE_TIMEOUT_MS))}clearIdleTimer(){this.idleTimer&&(clearTimeout(this.idleTimer),this.idleTimer=null)}};p.IDLE_TIMEOUT_MS=12e4;var d=p;typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new d):new d);})();
