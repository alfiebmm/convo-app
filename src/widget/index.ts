/**
 * Convo — Embeddable Chat Widget
 *
 * Usage:
 *   <script
 *     src="https://your-domain.com/widget.js"
 *     data-tenant="tenant-uuid"
 *     data-color="#3B82F6"
 *     data-welcome="Hi there! How can I help?"
 *     data-name="Convo"
 *     data-position="right"
 *   ></script>
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ConvoConfig {
  tenantId: string;
  color: string;
  welcome: string;
  name: string;
  position: "left" | "right";
  apiBase: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Config from script tag
// ---------------------------------------------------------------------------
function getConfig(): ConvoConfig {
  const script =
    document.currentScript ??
    document.querySelector('script[data-tenant]');

  const get = (attr: string, fallback: string) =>
    script?.getAttribute(`data-${attr}`) ?? fallback;

  // Derive API base from script src (same origin as the widget host)
  let apiBase = "";
  if (script && (script as HTMLScriptElement).src) {
    try {
      const url = new URL((script as HTMLScriptElement).src);
      apiBase = url.origin;
    } catch {
      // relative path — same origin
    }
  }

  return {
    tenantId: get("tenant", ""),
    color: get("color", "#3B82F6"),
    welcome: get("welcome", "Hi there! How can I help you today?"),
    name: get("name", "Convo"),
    position: get("position", "right") as "left" | "right",
    apiBase,
  };
}

// ---------------------------------------------------------------------------
// Visitor ID (persisted in localStorage)
// ---------------------------------------------------------------------------
function getVisitorId(): string {
  const key = "convo_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "v_" + crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Styles (injected into Shadow DOM)
// ---------------------------------------------------------------------------
function getStyles(config: ConvoConfig): string {
  const pos = config.position === "left" ? "left: 20px;" : "right: 20px;";
  const panelPos = config.position === "left" ? "left: 20px;" : "right: 20px;";

  return `
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
      ${pos}
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${config.color};
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
      ${panelPos}
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
      background: ${config.color};
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
      background: ${config.color};
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
      border-color: ${config.color};
    }
    .convo-input-area input::placeholder {
      color: #94a3b8;
    }
    .convo-input-area button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${config.color};
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
        ${config.position === "left" ? "left: 8px;" : "right: 8px;"}
        height: calc(100vh - 100px);
        bottom: 80px;
        border-radius: 12px;
      }
    }
  `;
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------
const CHAT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SEND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

// ---------------------------------------------------------------------------
// Widget class
// ---------------------------------------------------------------------------
class ConvoWidget {
  private config: ConvoConfig;
  private visitorId: string;
  private conversationId: string | null = null;
  private messages: Message[] = [];
  private isOpen = false;
  private isStreaming = false;
  private sessionTracked = false;

  // DOM refs (inside Shadow DOM)
  private shadow!: ShadowRoot;
  private bubble!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  constructor() {
    this.config = getConfig();
    this.visitorId = getVisitorId();
    this.init();
  }

  private init() {
    if (!this.config.tenantId) {
      console.warn("[Convo] Missing data-tenant attribute on script tag.");
      return;
    }

    // Create host element with Shadow DOM
    const host = document.createElement("div");
    host.id = "convo-widget";
    this.shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    this.render();
    this.attachEvents();
    this.trackSession();
  }

  private render() {
    const style = document.createElement("style");
    style.textContent = getStyles(this.config);

    // Bubble
    this.bubble = document.createElement("button");
    this.bubble.className = "convo-bubble";
    this.bubble.setAttribute("aria-label", "Open chat");
    this.bubble.innerHTML = CHAT_ICON;

    // Panel
    this.panel = document.createElement("div");
    this.panel.className = "convo-panel";
    this.panel.innerHTML = `
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
        <button aria-label="Send message">${SEND_ICON}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convo.app" target="_blank" rel="noopener">Convo</a></div>
    `;

    this.messagesEl = this.panel.querySelector(".convo-messages")!;
    this.inputEl = this.panel.querySelector("input")!;
    this.sendBtn = this.panel.querySelector(".convo-input-area button")!;

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.panel);
    this.shadow.appendChild(this.bubble);

    // Show welcome message
    this.addMessageToUI("assistant", this.config.welcome);
  }

  private attachEvents() {
    this.bubble.addEventListener("click", () => this.toggle());

    this.sendBtn.addEventListener("click", () => this.send());

    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle("visible", this.isOpen);
    this.bubble.classList.toggle("open", this.isOpen);
    this.bubble.innerHTML = this.isOpen ? CLOSE_ICON : CHAT_ICON;
    this.bubble.setAttribute(
      "aria-label",
      this.isOpen ? "Close chat" : "Open chat"
    );

    if (this.isOpen) {
      setTimeout(() => this.inputEl.focus(), 300);
    }
  }

  private async send() {
    const text = this.inputEl.value.trim();
    if (!text || this.isStreaming) return;

    this.inputEl.value = "";
    this.addMessageToUI("user", text);
    this.messages.push({ role: "user", content: text });

    this.isStreaming = true;
    this.sendBtn.disabled = true;
    this.showTyping();

    try {
      const res = await fetch(`${this.config.apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: this.config.tenantId,
          conversationId: this.conversationId,
          visitorId: this.visitorId,
          message: text,
          metadata: {
            pageUrl: window.location.href,
            referrer: document.referrer || null,
          },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      this.hideTyping();
      const assistantEl = this.addMessageToUI("assistant", "");
      let fullContent = "";

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "meta" && event.conversationId) {
              this.conversationId = event.conversationId;
              // Track engagement
              this.trackEngagement();
            } else if (event.type === "token" && event.content) {
              fullContent += event.content;
              assistantEl.innerHTML = this.renderMarkdown(fullContent);
              this.scrollToBottom();
            } else if (event.type === "error") {
              assistantEl.textContent =
                "Sorry, something went wrong. Please try again.";
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      this.messages.push({ role: "assistant", content: fullContent });
    } catch {
      this.hideTyping();
      this.addMessageToUI(
        "assistant",
        "Sorry, I'm having trouble connecting. Please try again in a moment."
      );
    } finally {
      this.isStreaming = false;
      this.sendBtn.disabled = false;
    }
  }

  private addMessageToUI(role: "user" | "assistant", content: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `convo-msg ${role}`;
    if (role === "assistant") {
      el.innerHTML = this.renderMarkdown(content);
    } else {
      el.textContent = content;
    }
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private showTyping() {
    const el = document.createElement("div");
    el.className = "convo-typing";
    el.id = "convo-typing-indicator";
    el.innerHTML = "<span></span><span></span><span></span>";
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  }

  private hideTyping() {
    const el = this.shadow.getElementById("convo-typing-indicator");
    if (el) el.remove();
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Lightweight markdown → HTML for chat messages.
   * Supports: **bold**, *italic*, [links](url), `code`, and line breaks.
   * Escapes HTML first to prevent XSS.
   */
  private renderMarkdown(raw: string): string {
    let html = this.escapeHtml(raw);
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* (but not inside bold)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    // Inline code: `text`
    html = html.replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>');
    // Links: [text](url) — open in new tab
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">$1</a>');
    // Bullet lists: lines starting with "- "
    html = html.replace(/^- (.+)$/gm, "• $1");
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  private async trackSession() {
    if (this.sessionTracked) return;
    this.sessionTracked = true;

    try {
      await fetch(`${this.config.apiBase}/api/widget/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: this.config.tenantId,
          visitorId: this.visitorId,
          pageUrl: window.location.href,
        }),
      });
    } catch {
      // Non-critical — don't break widget
    }
  }

  private async trackEngagement() {
    try {
      await fetch(`${this.config.apiBase}/api/widget/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: this.config.tenantId,
          visitorId: this.visitorId,
          engaged: true,
          conversationId: this.conversationId,
        }),
      });
    } catch {
      // Non-critical
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-init
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => new ConvoWidget());
  } else {
    new ConvoWidget();
  }
}
