"use strict";(()=>{function v(){let i=document.currentScript??document.querySelector("script[data-tenant]"),t=(s,n)=>i?.getAttribute(`data-${s}`)??n,e="";if(i&&i.src)try{e=new URL(i.src).origin}catch{}return{tenantId:t("tenant",""),color:t("color","#3B82F6"),welcome:t("welcome","Hi there! How can I help you today?"),name:t("name","Convo"),position:t("position","right"),apiBase:e}}function b(){let i="convo_visitor_id",t=localStorage.getItem(i);return t||(t="v_"+crypto.randomUUID(),localStorage.setItem(i,t)),t}function x(i){let t=i.position==="left"?"left: 20px;":"right: 20px;",e=i.position==="left"?"left: 20px;":"right: 20px;";return`
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
      ${t}
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
      ${e}
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
    @media (max-width: 440px) {
      .convo-panel {
        width: calc(100vw - 16px);
        ${i.position==="left"?"left: 8px;":"right: 8px;"}
        height: calc(100vh - 100px);
        bottom: 80px;
        border-radius: 12px;
      }
    }
  `}var m='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',y='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',w='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',p=class p{constructor(){this.conversationId=null;this.messages=[];this.isOpen=!1;this.isStreaming=!1;this.sessionTracked=!1;this.pipelineTriggered=!1;this.idleTimer=null;this.config=v(),this.visitorId=b(),this.restoreSession(),this.init()}sessionStorageKey(){return`convo_session_${this.config.tenantId}_${this.visitorId}`}restoreSession(){try{let t=sessionStorage.getItem(this.sessionStorageKey());if(!t)return;let e=JSON.parse(t);e.conversationId&&(this.conversationId=e.conversationId),Array.isArray(e.messages)&&(this.messages=e.messages),e.sessionTracked&&(this.sessionTracked=!0)}catch{}}persistSession(){try{sessionStorage.setItem(this.sessionStorageKey(),JSON.stringify({conversationId:this.conversationId,messages:this.messages,sessionTracked:this.sessionTracked}))}catch{}}async init(){if(!this.config.tenantId){console.warn("[Convo] Missing data-tenant attribute on script tag.");return}await this.mergeRemoteConfig();let t=document.createElement("div");t.id="convo-widget",this.shadow=t.attachShadow({mode:"open"}),document.body.appendChild(t),this.render(),this.attachEvents(),this.trackSession()}async mergeRemoteConfig(){try{let t=await fetch(`${this.config.apiBase}/api/widget/config?tenant=${encodeURIComponent(this.config.tenantId)}`,{method:"GET",credentials:"omit"});if(!t.ok)return;let e=await t.json();typeof e.name=="string"&&e.name.trim()&&(this.config.name=e.name),typeof e.welcome=="string"&&e.welcome.trim()&&(this.config.welcome=e.welcome),typeof e.color=="string"&&e.color.trim()&&(this.config.color=e.color)}catch{}}render(){let t=document.createElement("style");if(t.textContent=x(this.config),this.bubble=document.createElement("button"),this.bubble.className="convo-bubble",this.bubble.setAttribute("aria-label","Open chat"),this.bubble.innerHTML=m,this.panel=document.createElement("div"),this.panel.className="convo-panel",this.panel.innerHTML=`
      <div class="convo-header">
        <div class="convo-header-dot"></div>
        <div class="convo-header-text">
          <h3>${this.escapeHtml(this.config.name)}</h3>
          <p>Usually replies instantly</p>
        </div>
      </div>
      <div class="convo-messages"></div>
      <div class="convo-input-area">
        <input type="text" placeholder="Type a message..." aria-label="Type a message" />
        <button aria-label="Send message">${w}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `,this.messagesEl=this.panel.querySelector(".convo-messages"),this.inputEl=this.panel.querySelector("input"),this.sendBtn=this.panel.querySelector(".convo-input-area button"),this.shadow.appendChild(t),this.shadow.appendChild(this.panel),this.shadow.appendChild(this.bubble),this.messages.length>0)for(let e of this.messages)this.addMessageToUI(e.role,e.content);else this.addMessageToUI("assistant",this.config.welcome)}attachEvents(){this.bubble.addEventListener("click",()=>this.toggle()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",t=>{t.key==="Enter"&&!t.shiftKey&&(t.preventDefault(),this.send())})}toggle(){this.isOpen=!this.isOpen,this.panel.classList.toggle("visible",this.isOpen),this.bubble.classList.toggle("open",this.isOpen),this.bubble.innerHTML=this.isOpen?y:m,this.bubble.setAttribute("aria-label",this.isOpen?"Close chat":"Open chat"),this.isOpen?setTimeout(()=>this.inputEl.focus(),300):this.triggerPipeline()}async send(){let t=this.inputEl.value.trim();if(!(!t||this.isStreaming)){this.inputEl.value="",this.addMessageToUI("user",t),this.messages.push({role:"user",content:t}),this.persistSession(),this.isStreaming=!0,this.sendBtn.disabled=!0,this.showTyping();try{let e=await fetch(`${this.config.apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,conversationId:this.conversationId,visitorId:this.visitorId,message:t,metadata:{pageUrl:window.location.href,referrer:document.referrer||null}})});if(!e.ok||!e.body)throw new Error(`HTTP ${e.status}`);this.hideTyping();let s=this.addMessageToUI("assistant",""),n="",o=e.body.getReader(),a=new TextDecoder,r="";for(;;){let{done:c,value:u}=await o.read();if(c)break;r+=a.decode(u,{stream:!0});let h=r.split(`
`);r=h.pop()||"";for(let g of h){if(!g.startsWith("data: "))continue;let f=g.slice(6).trim();if(f)try{let l=JSON.parse(f);l.type==="meta"&&l.conversationId?(this.conversationId=l.conversationId,this.trackEngagement()):l.type==="token"&&l.content?(n+=l.content,s.innerHTML=this.renderMarkdown(n),this.scrollToBottom()):l.type==="error"&&(s.textContent="Sorry, something went wrong. Please try again.")}catch{}}}this.messages.push({role:"assistant",content:n}),this.persistSession(),this.resetIdleTimer()}catch{this.hideTyping(),this.addMessageToUI("assistant","Sorry, I'm having trouble connecting. Please try again in a moment.")}finally{this.isStreaming=!1,this.sendBtn.disabled=!1}}}addMessageToUI(t,e){let s=document.createElement("div");return s.className=`convo-msg ${t}`,t==="assistant"?s.innerHTML=this.renderMarkdown(e):s.textContent=e,this.messagesEl.appendChild(s),this.scrollToBottom(),s}showTyping(){let t=document.createElement("div");t.className="convo-typing",t.id="convo-typing-indicator",t.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(t),this.scrollToBottom()}hideTyping(){let t=this.shadow.getElementById("convo-typing-indicator");t&&t.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}escapeHtml(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}isInternalLink(t){if(!t)return!1;let e=t.trim();if(/^(mailto:|tel:|sms:|javascript:)/i.test(e))return!1;if(e.startsWith("/")||e.startsWith("#")||e.startsWith("?"))return!0;try{let s=new URL(e,window.location.href),n=r=>r.replace(/^www\./i,"").toLowerCase(),o=n(s.hostname),a=n(window.location.hostname);return!!(o===a||o.endsWith("."+a)||a.endsWith("."+o))}catch{return!0}}renderMarkdown(t){let e=this.escapeHtml(t);return e=e.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,"<em>$1</em>"),e=e.replace(/`(.+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'),e=e.replace(/\[(.+?)\]\((.+?)\)/g,(s,n,o)=>{let a=this.isInternalLink(o),r=this.escapeHtml(n),c=this.escapeHtml(o);return a?`<a href="${c}" style="color:inherit;text-decoration:underline;">${r}</a>`:`<a href="${c}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${r}</a>`}),e=e.replace(/^- (.+)$/gm,"\u2022 $1"),e=e.replace(/\n/g,"<br>"),e}async trackSession(){if(!this.sessionTracked){this.sessionTracked=!0;try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,pageUrl:window.location.href})})}catch{}}}async trackEngagement(){try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,engaged:!0,conversationId:this.conversationId})})}catch{}}triggerPipeline(){this.pipelineTriggered||!this.conversationId||this.messages.length<2||(this.pipelineTriggered=!0,this.clearIdleTimer(),fetch(`${this.config.apiBase}/api/pipeline/trigger`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId})}).catch(()=>{}))}resetIdleTimer(){this.clearIdleTimer(),this.conversationId&&this.messages.length>=2&&!this.pipelineTriggered&&(this.idleTimer=setTimeout(()=>this.triggerPipeline(),p.IDLE_TIMEOUT_MS))}clearIdleTimer(){this.idleTimer&&(clearTimeout(this.idleTimer),this.idleTimer=null)}};p.IDLE_TIMEOUT_MS=12e4;var d=p;typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new d):new d);})();
