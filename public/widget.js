"use strict";(()=>{var I={sm:{bubble:48,icon:20,offset:16},md:{bubble:56,icon:24,offset:20},lg:{bubble:64,icon:28,offset:24}};function S(n){return n==="bottom-left"||n==="left"?"bottom-left":"bottom-right"}function M(n){return n==="sm"||n==="lg"?n:"md"}var E={thinkingMinMs:1500,tokensPerSecond:50};function C(){let n=document.currentScript??document.querySelector("script[data-tenant]"),t=(i,s)=>n?.getAttribute(`data-${i}`)??s,e="";if(n&&n.src)try{e=new URL(n.src).origin}catch{}return{tenantId:t("tenant",""),color:t("color","#FF6B2C"),welcome:t("welcome","Hi there! How can I help you today?"),name:t("name","Convo"),position:S(t("position","bottom-right")),size:M(t("size","md")),apiBase:e,streaming:{...E}}}function L(){let n="convo_visitor_id",t=localStorage.getItem(n);return t||(t="v_"+crypto.randomUUID(),localStorage.setItem(n,t)),t}function $(n){let t=I[n.size],e=n.position==="bottom-left"?"left":"right",i=`${e}: ${t.offset}px;`,s=`${e}: 20px;`,o=t.bubble+t.offset+12;return`
    :host {
      --convo-color: ${n.color};
      --convo-bubble-size: ${t.bubble}px;
      --convo-bubble-icon: ${t.icon}px;
      --convo-bubble-offset: ${t.offset}px;
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
      bottom: ${t.offset}px;
      ${i}
      width: ${t.bubble}px;
      height: ${t.bubble}px;
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
      width: ${t.icon}px;
      height: ${t.icon}px;
      transition: transform 0.3s ease;
    }
    .convo-bubble.open svg {
      transform: rotate(90deg);
    }

    /* Panel */
    .convo-panel {
      position: fixed;
      bottom: ${o}px;
      ${s}
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
  `}var v='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',H='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',O='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',P='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',m=class m{constructor(){this.conversationId=null;this.messages=[];this.isOpen=!1;this.isStreaming=!1;this.sessionTracked=!1;this.pipelineTriggered=!1;this.idleTimer=null;this.viewportRafId=null;this.config=C(),this.visitorId=L(),this.restoreSession(),this.init()}sessionStorageKey(){return`convo_session_${this.config.tenantId}_${this.visitorId}`}restoreSession(){try{let t=sessionStorage.getItem(this.sessionStorageKey());if(!t)return;let e=JSON.parse(t);e.conversationId&&(this.conversationId=e.conversationId),Array.isArray(e.messages)&&(this.messages=e.messages),e.sessionTracked&&(this.sessionTracked=!0)}catch{}}persistSession(){try{sessionStorage.setItem(this.sessionStorageKey(),JSON.stringify({conversationId:this.conversationId,messages:this.messages,sessionTracked:this.sessionTracked}))}catch{}}async init(){if(!this.config.tenantId){console.warn("[Convo] Missing data-tenant attribute on script tag.");return}await this.mergeRemoteConfig();let t=document.createElement("div");t.id="convo-widget",this.shadow=t.attachShadow({mode:"open"}),document.body.appendChild(t),this.render(),this.attachEvents(),this.setupViewportHandler(),this.trackSession()}async mergeRemoteConfig(){try{let t=await fetch(`${this.config.apiBase}/api/widget/config?tenant=${encodeURIComponent(this.config.tenantId)}`,{method:"GET",credentials:"omit"});if(!t.ok)return;let e=await t.json();typeof e.name=="string"&&e.name.trim()&&(this.config.name=e.name),typeof e.welcome=="string"&&e.welcome.trim()&&(this.config.welcome=e.welcome),typeof e.color=="string"&&e.color.trim()&&(this.config.color=e.color),(e.position==="bottom-left"||e.position==="bottom-right")&&(this.config.position=e.position),(e.size==="sm"||e.size==="md"||e.size==="lg")&&(this.config.size=e.size),e.streaming&&(typeof e.streaming.thinkingMinMs=="number"&&isFinite(e.streaming.thinkingMinMs)&&(this.config.streaming.thinkingMinMs=Math.max(0,Math.min(6e3,e.streaming.thinkingMinMs))),typeof e.streaming.tokensPerSecond=="number"&&isFinite(e.streaming.tokensPerSecond)&&(this.config.streaming.tokensPerSecond=Math.max(10,Math.min(200,e.streaming.tokensPerSecond))))}catch{}}render(){let t=document.createElement("style");if(t.textContent=$(this.config),this.bubble=document.createElement("button"),this.bubble.className="convo-bubble",this.bubble.setAttribute("aria-label","Open chat"),this.bubble.innerHTML=v,this.panel=document.createElement("div"),this.panel.className="convo-panel",this.panel.innerHTML=`
      <div class="convo-header">
        <div class="convo-header-dot"></div>
        <div class="convo-header-text">
          <h3>${this.escapeHtml(this.config.name)}</h3>
          <p>Usually replies instantly</p>
        </div>
        <button class="convo-close" aria-label="Close chat">${P}</button>
      </div>
      <div class="convo-messages"></div>
      <div class="convo-input-area">
        <input type="text" placeholder="Type a message..." aria-label="Type a message" />
        <button aria-label="Send message">${O}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `,this.messagesEl=this.panel.querySelector(".convo-messages"),this.inputEl=this.panel.querySelector("input"),this.sendBtn=this.panel.querySelector(".convo-input-area button"),this.closeBtn=this.panel.querySelector(".convo-close"),this.shadow.appendChild(t),this.shadow.appendChild(this.panel),this.shadow.appendChild(this.bubble),this.messages.length>0)for(let e of this.messages)this.addMessageToUI(e.role,e.content);else this.addMessageToUI("assistant",this.config.welcome)}attachEvents(){this.bubble.addEventListener("click",()=>this.toggle()),this.closeBtn.addEventListener("click",()=>this.close()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",t=>{t.key==="Enter"&&!t.shiftKey&&(t.preventDefault(),this.send())}),this.inputEl.addEventListener("focus",()=>{setTimeout(()=>{this.inputEl.scrollIntoView({block:"end",behavior:"smooth"})},200)})}setupViewportHandler(){if(typeof window>"u"||!window.visualViewport)return;let t=12,e=()=>{this.viewportRafId===null&&(this.viewportRafId=requestAnimationFrame(()=>{if(this.viewportRafId=null,!window.visualViewport)return;if(window.innerWidth>640){this.panel.style.top="",this.panel.style.height="",this.panel.style.left="",this.panel.style.width="",this.panel.style.right="";return}let i=window.visualViewport,s=i.offsetTop+t,o=i.height-t*2,r=i.offsetLeft+t,a=i.width-t*2;this.panel.style.top=`${s}px`,this.panel.style.height=`${o}px`,this.panel.style.left=`${r}px`,this.panel.style.width=`${a}px`,this.panel.style.right="auto";let l=this.panel.querySelector(".convo-powered");if(l){let h=window.innerWidth<=640&&i.height<window.innerHeight*.75;l.classList.toggle("keyboard-open",h),h&&this.messagesEl&&(this.messagesEl.scrollTop=this.messagesEl.scrollHeight)}}))};e(),window.visualViewport.addEventListener("resize",e),window.visualViewport.addEventListener("scroll",e),window.addEventListener("orientationchange",e),window.addEventListener("resize",e)}toggle(){this.isOpen=!this.isOpen,this.panel.classList.toggle("visible",this.isOpen),this.bubble.classList.toggle("open",this.isOpen),this.bubble.innerHTML=this.isOpen?H:v,this.bubble.setAttribute("aria-label",this.isOpen?"Close chat":"Open chat"),this.isOpen?setTimeout(()=>this.inputEl.focus(),300):this.triggerPipeline()}close(){this.isOpen&&(this.isOpen=!1,this.panel.classList.remove("visible"),this.bubble.classList.remove("open"),this.bubble.innerHTML=v,this.bubble.setAttribute("aria-label","Open chat"),this.triggerPipeline())}async send(){let t=this.inputEl.value.trim();if(!t||this.isStreaming)return;this.inputEl.value="",this.addMessageToUI("user",t),this.messages.push({role:"user",content:t}),this.persistSession(),this.isStreaming=!0,this.sendBtn.disabled=!0,this.showTyping();let e=Date.now(),i=[],s=!1,o=!1,r=null,a="",l=!1,h=Math.max(1,Math.round(1e3/this.config.streaming.tokensPerSecond)),b=(async()=>{let p=Date.now()-e,u=this.config.streaming.thinkingMinMs-p;for(u>0&&await new Promise(c=>setTimeout(c,u));;){if(i.length>0){l||(this.hideTyping(),l=!0,r=this.addMessageToUI("assistant",""));let c=i.shift();a+=c,r&&(r.innerHTML=this.renderMarkdown(a),this.scrollToBottom()),await new Promise(g=>setTimeout(g,h));continue}if(s||o)break;await new Promise(c=>setTimeout(c,h))}})();try{let p=await fetch(`${this.config.apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,conversationId:this.conversationId,visitorId:this.visitorId,message:t,metadata:{pageUrl:window.location.href,referrer:document.referrer||null}})});if(!p.ok||!p.body)throw new Error(`HTTP ${p.status}`);let u=p.body.getReader(),c=new TextDecoder,g="";for(;;){let{done:k,value:T}=await u.read();if(k)break;g+=c.decode(T,{stream:!0});let w=g.split(`
`);g=w.pop()||"";for(let x of w){if(!x.startsWith("data: "))continue;let y=x.slice(6).trim();if(y)try{let d=JSON.parse(y);d.type==="meta"&&d.conversationId?(this.conversationId=d.conversationId,this.trackEngagement()):d.type==="token"&&d.content?i.push(d.content):d.type==="error"&&(o=!0)}catch{}}}s=!0,await b,o&&r&&(r.textContent="Sorry, something went wrong. Please try again."),this.messages.push({role:"assistant",content:a}),this.persistSession(),this.resetIdleTimer()}catch{o=!0,s=!0,await b,l||this.hideTyping(),this.addMessageToUI("assistant","Sorry, I'm having trouble connecting. Please try again in a moment.")}finally{this.isStreaming=!1,this.sendBtn.disabled=!1}}addMessageToUI(t,e){let i=document.createElement("div");return i.className=`convo-msg ${t}`,t==="assistant"?i.innerHTML=this.renderMarkdown(e):i.textContent=e,this.messagesEl.appendChild(i),this.scrollToBottom(),i}showTyping(){let t=document.createElement("div");t.className="convo-typing",t.id="convo-typing-indicator",t.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(t),this.scrollToBottom()}hideTyping(){let t=this.shadow.getElementById("convo-typing-indicator");t&&t.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}escapeHtml(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}isInternalLink(t){if(!t)return!1;let e=t.trim();if(/^(mailto:|tel:|sms:|javascript:)/i.test(e))return!1;if(e.startsWith("/")||e.startsWith("#")||e.startsWith("?"))return!0;try{let i=new URL(e,window.location.href),s=a=>a.replace(/^www\./i,"").toLowerCase(),o=s(i.hostname),r=s(window.location.hostname);return!!(o===r||o.endsWith("."+r)||r.endsWith("."+o))}catch{return!0}}renderMarkdown(t){let e=this.escapeHtml(t);return e=e.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,"<em>$1</em>"),e=e.replace(/`(.+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'),e=e.replace(/\[(.+?)\]\((.+?)\)/g,(i,s,o)=>{let r=this.isInternalLink(o),a=this.escapeHtml(s),l=this.escapeHtml(o);return r?`<a href="${l}" style="color:inherit;text-decoration:underline;">${a}</a>`:`<a href="${l}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${a}</a>`}),e=e.replace(/^- (.+)$/gm,"\u2022 $1"),e=e.replace(/\n/g,"<br>"),e}async trackSession(){if(!this.sessionTracked){this.sessionTracked=!0;try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,pageUrl:window.location.href})})}catch{}}}async trackEngagement(){try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,engaged:!0,conversationId:this.conversationId})})}catch{}}triggerPipeline(){this.pipelineTriggered||!this.conversationId||this.messages.length<2||(this.pipelineTriggered=!0,this.clearIdleTimer(),fetch(`${this.config.apiBase}/api/pipeline/trigger`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId})}).catch(()=>{}))}resetIdleTimer(){this.clearIdleTimer(),this.conversationId&&this.messages.length>=2&&!this.pipelineTriggered&&(this.idleTimer=setTimeout(()=>this.triggerPipeline(),m.IDLE_TIMEOUT_MS))}clearIdleTimer(){this.idleTimer&&(clearTimeout(this.idleTimer),this.idleTimer=null)}};m.IDLE_TIMEOUT_MS=12e4;var f=m;typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new f):new f);})();
