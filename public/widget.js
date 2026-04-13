"use strict";(()=>{function v(){let n=document.currentScript??document.querySelector("script[data-tenant]"),e=(o,s)=>n?.getAttribute(`data-${o}`)??s,t="";if(n&&n.src)try{t=new URL(n.src).origin}catch{}return{tenantId:e("tenant",""),color:e("color","#3B82F6"),welcome:e("welcome","Hi there! How can I help you today?"),name:e("name","Convo"),position:e("position","right"),apiBase:t}}function b(){let n="convo_visitor_id",e=localStorage.getItem(n);return e||(e="v_"+crypto.randomUUID(),localStorage.setItem(n,e)),e}function m(n){let e=n.position==="left"?"left: 20px;":"right: 20px;",t=n.position==="left"?"left: 20px;":"right: 20px;";return`
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
      background: ${n.color};
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
      background: ${n.color};
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
      background: ${n.color};
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
      border-color: ${n.color};
    }
    .convo-input-area input::placeholder {
      color: #94a3b8;
    }
    .convo-input-area button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${n.color};
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
        ${n.position==="left"?"left: 8px;":"right: 8px;"}
        height: calc(100vh - 100px);
        bottom: 80px;
        border-radius: 12px;
      }
    }
  `}var p='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',x='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',y='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',a=class{constructor(){this.conversationId=null;this.messages=[];this.isOpen=!1;this.isStreaming=!1;this.sessionTracked=!1;this.config=v(),this.visitorId=b(),this.init()}init(){if(!this.config.tenantId){console.warn("[Convo] Missing data-tenant attribute on script tag.");return}let e=document.createElement("div");e.id="convo-widget",this.shadow=e.attachShadow({mode:"open"}),document.body.appendChild(e),this.render(),this.attachEvents(),this.trackSession()}render(){let e=document.createElement("style");e.textContent=m(this.config),this.bubble=document.createElement("button"),this.bubble.className="convo-bubble",this.bubble.setAttribute("aria-label","Open chat"),this.bubble.innerHTML=p,this.panel=document.createElement("div"),this.panel.className="convo-panel",this.panel.innerHTML=`
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
        <button aria-label="Send message">${y}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `,this.messagesEl=this.panel.querySelector(".convo-messages"),this.inputEl=this.panel.querySelector("input"),this.sendBtn=this.panel.querySelector(".convo-input-area button"),this.shadow.appendChild(e),this.shadow.appendChild(this.panel),this.shadow.appendChild(this.bubble),this.addMessageToUI("assistant",this.config.welcome)}attachEvents(){this.bubble.addEventListener("click",()=>this.toggle()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.send())})}toggle(){this.isOpen=!this.isOpen,this.panel.classList.toggle("visible",this.isOpen),this.bubble.classList.toggle("open",this.isOpen),this.bubble.innerHTML=this.isOpen?x:p,this.bubble.setAttribute("aria-label",this.isOpen?"Close chat":"Open chat"),this.isOpen&&setTimeout(()=>this.inputEl.focus(),300)}async send(){let e=this.inputEl.value.trim();if(!(!e||this.isStreaming)){this.inputEl.value="",this.addMessageToUI("user",e),this.messages.push({role:"user",content:e}),this.isStreaming=!0,this.sendBtn.disabled=!0,this.showTyping();try{let t=await fetch(`${this.config.apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,conversationId:this.conversationId,visitorId:this.visitorId,message:e,metadata:{pageUrl:window.location.href,referrer:document.referrer||null}})});if(!t.ok||!t.body)throw new Error(`HTTP ${t.status}`);this.hideTyping();let o=this.addMessageToUI("assistant",""),s="",h=t.body.getReader(),g=new TextDecoder,r="";for(;;){let{done:u,value:f}=await h.read();if(u)break;r+=g.decode(f,{stream:!0});let l=r.split(`
`);r=l.pop()||"";for(let d of l){if(!d.startsWith("data: "))continue;let c=d.slice(6).trim();if(c)try{let i=JSON.parse(c);i.type==="meta"&&i.conversationId?(this.conversationId=i.conversationId,this.trackEngagement()):i.type==="token"&&i.content?(s+=i.content,o.innerHTML=this.renderMarkdown(s),this.scrollToBottom()):i.type==="error"&&(o.textContent="Sorry, something went wrong. Please try again.")}catch{}}}this.messages.push({role:"assistant",content:s})}catch{this.hideTyping(),this.addMessageToUI("assistant","Sorry, I'm having trouble connecting. Please try again in a moment.")}finally{this.isStreaming=!1,this.sendBtn.disabled=!1}}}addMessageToUI(e,t){let o=document.createElement("div");return o.className=`convo-msg ${e}`,e==="assistant"?o.innerHTML=this.renderMarkdown(t):o.textContent=t,this.messagesEl.appendChild(o),this.scrollToBottom(),o}showTyping(){let e=document.createElement("div");e.className="convo-typing",e.id="convo-typing-indicator",e.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(e),this.scrollToBottom()}hideTyping(){let e=this.shadow.getElementById("convo-typing-indicator");e&&e.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}renderMarkdown(e){let t=this.escapeHtml(e);return t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,"<em>$1</em>"),t=t.replace(/`(.+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'),t=t.replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">$1</a>'),t=t.replace(/^- (.+)$/gm,"\u2022 $1"),t=t.replace(/\n/g,"<br>"),t}async trackSession(){if(!this.sessionTracked){this.sessionTracked=!0;try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,pageUrl:window.location.href})})}catch{}}}async trackEngagement(){try{await fetch(`${this.config.apiBase}/api/widget/track`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:this.config.tenantId,visitorId:this.visitorId,engaged:!0,conversationId:this.conversationId})})}catch{}}};typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>new a):new a);})();
