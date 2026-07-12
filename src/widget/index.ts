/**
 * Convo — Embeddable Chat Widget
 *
 * Usage:
 *   <script
 *     src="https://your-domain.com/widget.js"
 *     data-tenant="tenant-uuid"
 *     data-color="#FF6B2C"
 *     data-welcome="Hi there, how can I help?"
 *     data-name="Convo"
 *     data-position="bottom-right"
 *     data-size="md"
 *   ></script>
 *
 * Appearance (colour, position, size) is also pulled live from
 * /api/widget/config so dashboard edits reflect without re-embedding.
 */

// ---------------------------------------------------------------------------
// Imports (bundled into the single-file widget via esbuild)
// ---------------------------------------------------------------------------
import {
  startCaptureFlow,
  shouldRunCaptureForAction,
  shouldRenderContactMethodForAction,
  resolveContactMethodHref,
  type CaptureCaseInfo,
  type CapturePolicySpec,
  type CaptureFlowOutcome,
} from "./capture";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WidgetPosition = "bottom-left" | "bottom-right";
type WidgetSize = "sm" | "md" | "lg";

interface StreamingConfig {
  /** Minimum time the thinking indicator stays on screen before the first
   *  token renders, in ms. CON-92 AC: "at least 1.5s". */
  thinkingMinMs: number;
  /** Target client-side render rate (tokens/second). CON-92 tech note:
   *  "throttle token delivery client-side to simulate natural reading
   *  pace even if inference is faster". 40-60 tps is the spec window;
   *  50 is the midpoint default. */
  tokensPerSecond: number;
}

interface ConvoConfig {
  tenantId: string;
  color: string;
  welcome: string;
  welcomeEnabled: boolean;
  name: string;
  position: WidgetPosition;
  size: WidgetSize;
  apiBase: string;
  streaming: StreamingConfig;
}

// Bubble dimensions per size. Panel width stays constant — we only resize
// the launcher bubble so a larger setting doesn't dominate the page.
const SIZE_DIMENSIONS: Record<
  WidgetSize,
  { bubble: number; icon: number; offset: number }
> = {
  sm: { bubble: 48, icon: 20, offset: 16 },
  md: { bubble: 56, icon: 24, offset: 20 },
  lg: { bubble: 64, icon: 28, offset: 24 },
};

function normalisePosition(v: string | null | undefined): WidgetPosition {
  // Backward-compat: legacy embeds may use "left" / "right".
  if (v === "bottom-left" || v === "left") return "bottom-left";
  return "bottom-right";
}

function normaliseSize(v: string | null | undefined): WidgetSize {
  return v === "sm" || v === "lg" ? v : "md";
}

// CON-92 — defaults. Overridable per-tenant via
// tenants.settings.streaming.{thinkingMinMs,tokensPerSecond} and surfaced
// through /api/widget/config.
const STREAMING_DEFAULTS: StreamingConfig = {
  thinkingMinMs: 1500,
  tokensPerSecond: 50,
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

// CON-94: qualifying questions surfaced from /api/widget/config.
// Tenant-configured, validated server-side on submit.
interface QualifyingOption {
  label: string;
  value: string;
}
interface QualifyingPrompt {
  field: string;
  question: string;
  options: QualifyingOption[];
}

// CON-251: starter-prompt pills surfaced from /api/widget/config.
// Rendered on the closed-bubble surface (desktop only). Tapping a pill
// opens the panel AND auto-sends the pill's `prompt` as if the visitor
// had typed it. No persona side-effects — pure conversation openers.
interface StarterPrompt {
  emoji: string;
  label: string;
  prompt: string;
  action?: StarterPillAction;
}

type StarterPillAction =
  | { type: "chat" }
  | {
      type: "lead_capture";
      capture_policy: CapturePolicySpec;
      field_label_overrides?: Record<string, string>;
    }
  | {
      type: "custom_embed";
      kind: "iframe";
      url: string;
      height?: number;
      allow?: string;
    }
  | { type: "booking_form" };

type PillLeadCaptureAction = Extract<
  StarterPillAction,
  { type: "lead_capture" }
>;

type PillAction =
  | { type: "chat"; prompt: string }
  | Extract<
      StarterPillAction,
      { type: "lead_capture" | "custom_embed" | "booking_form" }
    >;
type PillCustomEmbedAction = Extract<
  StarterPillAction,
  { type: "custom_embed" }
>;

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
    color: get("color", "#FF6B2C"),
    welcome: get("welcome", "Hi there, how can I help you today?"),
    welcomeEnabled: true,
    name: get("name", "Convo"),
    position: normalisePosition(get("position", "bottom-right")),
    size: normaliseSize(get("size", "md")),
    apiBase,
    streaming: { ...STREAMING_DEFAULTS },
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
  const dims = SIZE_DIMENSIONS[config.size];
  const side = config.position === "bottom-left" ? "left" : "right";
  const pos = `${side}: ${dims.offset}px;`;
  // Panel keeps a consistent inset regardless of bubble size for visual stability.
  const panelPos = `${side}: 20px;`;
  // Stack the panel above the bubble with a small gap.
  const panelBottom = dims.bubble + dims.offset + 12;

  return `
    :host {
      --convo-color: ${config.color};
      --convo-bubble-size: ${dims.bubble}px;
      --convo-bubble-icon: ${dims.icon}px;
      --convo-bubble-offset: ${dims.offset}px;
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
      bottom: ${dims.offset}px;
      ${pos}
      width: ${dims.bubble}px;
      height: ${dims.bubble}px;
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
      width: ${dims.icon}px;
      height: ${dims.icon}px;
      transition: transform 0.3s ease;
    }
    .convo-bubble.open svg {
      transform: rotate(90deg);
    }

    /* CON-251 — Closed-widget starter-prompt pills.
       Rendered as a vertical stack aligned to the same side as the bubble,
       floating just above the bubble. Hidden on mobile and while the chat
       panel is open. */
    .convo-starter-pills {
      position: fixed;
      /* Sit above the bubble with the same edge inset. */
      bottom: ${dims.offset + dims.bubble + 12}px;
      ${pos}
      display: flex;
      flex-direction: column;
      align-items: ${side === "left" ? "flex-start" : "flex-end"};
      gap: 8px;
      z-index: 2147483645;
      pointer-events: none;
    }
    .convo-starter-pills.hidden {
      display: none;
    }
    .convo-starter-pill {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: min(280px,calc(100vw - ${dims.offset * 2 + 8}px));
      padding: 8px 14px;
      font: 500 13px/1.3 inherit;
      color: #1e293b;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
      cursor: pointer;
      transition: all .15s ease;
    }
    .convo-starter-pill:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,.12);
      border-color: var(--convo-color);
    }
    .convo-starter-pill:focus-visible {
      outline: 2px solid var(--convo-color);
    }
    .convo-starter-pill-emoji {
      font-size: 16px;
    }
    .convo-starter-pill-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media(max-width:640px){.convo-starter-pills{display:none!important}}

    /* Panel */
    .convo-panel {
      position: fixed;
      bottom: ${panelBottom}px;
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

    /* Shared card surface (CON-169 offer + CON-170 capture).
       The convo-card class is the common bubble; per-feature modifiers
       (-offer, -cap) only set what differs. */
    .convo-card, .convo-offer-block, .convo-cap-block {
      align-self: stretch;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: convo-msg-in 0.25s ease;
    }
    .convo-offer-title, .convo-cap-label, .convo-cap-final {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
    }
    .convo-cap-final {
      font-size: 13px;
      padding-top: 6px;
      border-top: 1px solid #f1f5f9;
    }
    .convo-cap-label {
      font-size: 13px;
    }
    .convo-offer-buttons, .convo-cap-input-row {
      display: flex;
      gap: 8px;
    }
    .convo-cap-input-row { gap: 6px; }
    /* Shared pill button — offer Yes/No + capture Send. */
    .convo-offer-btn, .convo-cap-btn {
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s ease, background 0.15s ease;
    }
    .convo-offer-btn { flex: 1; }
    .convo-offer-btn:disabled, .convo-cap-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .convo-offer-btn.primary, .convo-cap-btn-primary {
      background: ${config.color};
      color: #fff;
      border: 1px solid ${config.color};
    }
    .convo-offer-btn.primary:hover:not(:disabled),
    .convo-cap-btn-primary:hover:not(:disabled) {
      opacity: 0.9;
    }
    .convo-offer-btn.secondary {
      background: #fff;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .convo-offer-btn.secondary:hover:not(:disabled) {
      background: #f8fafc;
    }

    /* Progressive contact capture (CON-170 / D2b) - only the
       feature-specific pieces; shared surface lives above. */
    .convo-cap-privacy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .convo-cap-privacy-text, .convo-cap-breadcrumb {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .convo-cap-privacy-link {
      font-size: 12px;
      color: ${config.color};
      text-decoration: underline;
      align-self: flex-start;
    }
    .convo-cap-step {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .convo-cap-step-done { opacity: 0.7; }
    .convo-cap-required {
      font-weight: 400;
      color: #94a3b8;
      font-size: 12px;
    }
    .convo-cap-input {
      flex: 1;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: 13px;
      font-family: inherit;
      color: #1e293b;
      outline: none;
      min-width: 0;
    }
    .convo-cap-input:focus {
      border-color: ${config.color};
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.04);
    }
    .convo-cap-input:disabled {
      background: #f8fafc;
      color: #94a3b8;
    }
    .convo-cap-error {
      font-size: 12px;
      color: #ef4444;
      line-height: 1.3;
    }
    .convo-cap-actions {
      display: flex;
      gap: 12px;
    }
    .convo-cap-btn-text {
      background: transparent;
      color: #64748b;
      border: none;
      padding: 4px 0;
      font-size: 12px;
      font-weight: 500;
      text-decoration: underline;
    }
    .convo-cap-btn-text:hover:not(:disabled) {
      color: #334155;
    }

    /* Qualifying-question quick-reply card (CON-94) */
    .convo-qualifying {
      align-self: stretch;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px;
      animation: convo-msg-in 0.25s ease;
    }
    .convo-qualifying-question {
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      font-weight: 500;
      margin: 0 0 4px 0;
    }
    .convo-qualifying-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .convo-qualifying-options button {
      flex: 0 1 auto;
      padding: 8px 14px;
      border: 1.5px solid ${config.color};
      border-radius: 999px;
      background: #fff;
      color: ${config.color};
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }
    .convo-qualifying-options button:hover {
      background: ${config.color};
      color: #fff;
    }
    .convo-qualifying-options button:active {
      transform: scale(0.97);
    }
    .convo-qualifying-options button:disabled {
      opacity: 0.5;
      cursor: wait;
    }
    .convo-qualifying-skip {
      align-self: flex-start;
      margin-top: 4px;
      background: none;
      border: none;
      color: #64748b;
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
      padding: 2px 0;
      font-family: inherit;
    }
    .convo-qualifying-skip:hover {
      color: #1e293b;
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
      
      /* Hide the floating bubble when the panel is open on mobile — the in-header close button takes over. */
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

    /* CON-93 — CTA block (button-style call-to-action below an assistant message). */
    .convo-cta-block {
      margin: 8px 0 4px 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      animation: convo-cta-fade-in 200ms ease-out;
    }

    .convo-cta-button {
      display: inline-block;
      padding: 10px 16px;
      background: ${config.color};
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      line-height: 1.2;
      cursor: pointer;
      transition: filter 120ms ease, transform 120ms ease;
      max-width: 100%;
      min-height: 36px;
      box-sizing: border-box;
    }

    .convo-cta-button:hover,
    .convo-cta-button:focus-visible {
      filter: brightness(0.95);
      transform: translateY(-1px);
      outline: none;
    }

    .convo-cta-button:active {
      filter: brightness(0.9);
      transform: translateY(0);
    }

    .convo-cta-followup {
      margin: 6px 0 2px 0;
      font-size: 13px;
      font-style: italic;
      color: #6b7280;
      line-height: 1.4;
    }

    @keyframes convo-cta-fade-in {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------
const icon = (body: string, width = "2") =>
  `<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=${width} stroke-linecap=round stroke-linejoin=round>${body}</svg>`;
const CLOSE_LINES = `<line x1=18 y1=6 x2=6 y2=18/><line x1=6 y1=6 x2=18 y2=18/>`;
const CHAT_ICON = icon(`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`);
const CLOSE_ICON = icon(CLOSE_LINES);
const SEND_ICON = icon(`<line x1=22 y1=2 x2=11 y2=13/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`);
const CLOSE_ICON_SM = icon(CLOSE_LINES, "2.5");

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
  private pipelineTriggered = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private viewportRafId: number | null = null;
  private static IDLE_TIMEOUT_MS = 120000; // 2 minutes

  // CON-94: qualifying-question state.
  // `qualifyingQuestions` is the FULL ordered list configured by the tenant.
  // `qualifyingAnsweredFields` is the set of fields already answered on this
  // conversation (post-rehydrate). `qualifyingComplete` short-circuits the
  // flow when the visitor has finished or skipped. `qualifyingPending`
  // prevents double-submits while a button click is in flight.
  private qualifyingQuestions: QualifyingPrompt[] = [];
  private qualifyingAnsweredFields = new Set<string>();
  private qualifyingComplete = false;
  private qualifyingPending = false;

  // CON-251: starter-prompt pills on the closed bubble surface.
  private starterPrompts: StarterPrompt[] = [];
  private pendingPillAction: PillAction | null = null;

  // DOM refs (inside Shadow DOM)
  private shadow!: ShadowRoot;
  private bubble!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  // CON-251: container for the closed-bubble starter-prompt pills. Present
  // in the shadow tree only when at least one pill is configured.
  private starterPillsEl: HTMLDivElement | null = null;

  constructor() {
    this.config = getConfig();
    this.visitorId = getVisitorId();
    // CON-40: rehydrate active session from sessionStorage so clicking
    // an internal link (which reloads the page) doesn't nuke the chat.
    // sessionStorage is scoped to the browser tab, so closing the tab or
    // navigating to a different site still ends the conversation cleanly.
    this.restoreSession();
    this.init();
  }

  private sessionStorageKey(): string {
    return `convo_session_${this.config.tenantId}_${this.visitorId}`;
  }

  private restoreSession(): void {
    try {
      const raw = sessionStorage.getItem(this.sessionStorageKey());
      if (!raw) return;
      const data = JSON.parse(raw) as {
        conversationId?: string | null;
        messages?: Message[];
        sessionTracked?: boolean;
      };
      if (data.conversationId) this.conversationId = data.conversationId;
      if (Array.isArray(data.messages)) this.messages = data.messages;
      if (data.sessionTracked) this.sessionTracked = true;
    } catch {
      // Corrupt sessionStorage — ignore, start fresh
    }
  }

  private persistSession(): void {
    try {
      sessionStorage.setItem(
        this.sessionStorageKey(),
        JSON.stringify({
          conversationId: this.conversationId,
          messages: this.messages,
          sessionTracked: this.sessionTracked,
        })
      );
    } catch {
      // Quota exceeded or storage disabled — no-op
    }
  }

  private async init() {
    if (!this.config.tenantId) {
      console.warn("[Convo] Missing data-tenant attribute on script tag.");
      return;
    }

    // Pull the latest widget config (name, welcome, colour) from the server
    // so dashboard edits reflect live without the site owner having to update
    // their embed snippet. Script-tag attributes act as fallbacks if the fetch
    // fails or the tenant hasn't saved settings yet.
    await this.mergeRemoteConfig();

    // Create host element with Shadow DOM
    const host = document.createElement("div");
    host.id = "convo-widget";
    this.shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    this.render();
    this.attachEvents();
    this.setupViewportHandler();
    this.trackSession();
  }

  /**
   * Fetch name/welcome/color from /api/widget/config and overlay onto
   * the script-tag config. Non-blocking failures — if the API is
   * unreachable we silently fall back to the embed-provided values.
   */
  private async mergeRemoteConfig(): Promise<void> {
    try {
      const res = await fetch(
        `${this.config.apiBase}/api/widget/config?tenant=${encodeURIComponent(this.config.tenantId)}`,
        { method: "GET", credentials: "omit" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        name?: string | null;
        welcome?: string | null;
        welcomeEnabled?: boolean | null;
        color?: string | null;
        position?: string | null;
        size?: string | null;
        streaming?: {
          thinkingMinMs?: number;
          tokensPerSecond?: number;
        } | null;
        qualifyingQuestions?: QualifyingPrompt[];
        starterPrompts?: StarterPrompt[];
      };
      if (typeof data.name === "string" && data.name.trim()) {
        this.config.name = data.name;
      }
      if (typeof data.welcome === "string" && data.welcome.trim()) {
        this.config.welcome = data.welcome;
      }
      if (typeof data.welcomeEnabled === "boolean") {
        this.config.welcomeEnabled = data.welcomeEnabled;
      }
      if (typeof data.color === "string" && data.color.trim()) {
        this.config.color = data.color;
      }
      if (data.position === "bottom-left" || data.position === "bottom-right") {
        this.config.position = data.position;
      }
      if (data.size === "sm" || data.size === "md" || data.size === "lg") {
        this.config.size = data.size;
      }
      // CON-92 — tenant streaming overrides. Clamp to safe ranges so a bad
      // dashboard value can't break the widget. thinkingMinMs: 0–6s,
      // tokensPerSecond: 10–200.
      if (data.streaming) {
        if (typeof data.streaming.thinkingMinMs === "number" &&
            isFinite(data.streaming.thinkingMinMs)) {
          this.config.streaming.thinkingMinMs = Math.max(
            0,
            Math.min(6000, data.streaming.thinkingMinMs)
          );
        }
        if (typeof data.streaming.tokensPerSecond === "number" &&
            isFinite(data.streaming.tokensPerSecond)) {
          this.config.streaming.tokensPerSecond = Math.max(
            10,
            Math.min(200, data.streaming.tokensPerSecond)
          );
        }
      }
      // CON-94: qualifying questions are config-driven. Server returns them
      // alongside the public widget config; we just render what we're told.
      if (Array.isArray(data.qualifyingQuestions)) {
        this.qualifyingQuestions = data.qualifyingQuestions.filter(
          (q): q is QualifyingPrompt =>
            !!q &&
            typeof q.field === "string" &&
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length > 0
        );
      }

      // CON-251: starter-prompt pills. Defensive filter for shape — the
      // server side is already Zod-validated, but the widget must survive
      // any bad row on tenants.settings.
      if (Array.isArray(data.starterPrompts)) {
        this.starterPrompts = data.starterPrompts.filter(
          (p): p is StarterPrompt =>
            !!p &&
            typeof p.emoji === "string" &&
            p.emoji.length > 0 &&
            typeof p.label === "string" &&
            p.label.length > 0 &&
            typeof p.prompt === "string" &&
            p.prompt.length > 0,
        );
      }
    } catch {
      // Offline, CORS, or API down — silently fall back to script-tag values
    }

    // CON-94: if we rehydrated a conversation, ask the server which
    // qualifying fields are already answered so we don't re-prompt.
    if (this.conversationId && this.qualifyingQuestions.length > 0) {
      try {
        const stateRes = await fetch(
          `${this.config.apiBase}/api/conversations/qualifying/state?conversation=${encodeURIComponent(this.conversationId)}&tenant=${encodeURIComponent(this.config.tenantId)}&visitor=${encodeURIComponent(this.visitorId)}`,
          { method: "GET", credentials: "omit" }
        );
        if (stateRes.ok) {
          const state = (await stateRes.json()) as {
            answeredFields?: string[];
            completedAt?: string | null;
            skipped?: boolean;
          };
          if (Array.isArray(state.answeredFields)) {
            this.qualifyingAnsweredFields = new Set(state.answeredFields);
          }
          if (state.completedAt || state.skipped) {
            this.qualifyingComplete = true;
          }
        }
      } catch {
        // Non-critical — worst case we render the first question again.
        // Server rejects duplicate answers via field/value validation.
      }
    }
  }

  /**
   * Decide the next unanswered question for this conversation.
   * Mirrors `getNextQuestion` on the server but operates on the cached
   * client-side state. Server is the trust boundary; this is purely UX.
   */
  private nextQualifyingPrompt(): QualifyingPrompt | null {
    if (this.qualifyingComplete) return null;
    if (this.qualifyingQuestions.length === 0) return null;
    for (const q of this.qualifyingQuestions) {
      if (!this.qualifyingAnsweredFields.has(q.field)) return q;
    }
    return null;
  }

  /**
   * Render a qualifying-question quick-reply card into the messages area.
   * Disables the free-text input until the visitor picks an option (or skips).
   */
  private renderQualifyingPrompt(prompt: QualifyingPrompt): void {
    // Lock the input while a qualifying card is open.
    this.setInputLocked(true);

    const card = document.createElement("div");
    card.className = "convo-qualifying";
    card.setAttribute("data-field", prompt.field);

    const questionEl = document.createElement("p");
    questionEl.className = "convo-qualifying-question";
    questionEl.textContent = prompt.question;
    card.appendChild(questionEl);

    const optionsEl = document.createElement("div");
    optionsEl.className = "convo-qualifying-options";
    for (const opt of prompt.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      btn.setAttribute("data-value", opt.value);
      btn.addEventListener("click", () => {
        void this.submitQualifyingAnswer(prompt, opt, card);
      });
      optionsEl.appendChild(btn);
    }
    card.appendChild(optionsEl);

    // "Skip" only appears on the FIRST unanswered question. After the visitor
    // has answered one, we honour that signal rather than letting them bail.
    if (this.qualifyingAnsweredFields.size === 0) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "convo-qualifying-skip";
      skipBtn.textContent = "Skip for now";
      skipBtn.addEventListener("click", () => {
        void this.skipQualifying(card);
      });
      card.appendChild(skipBtn);
    }

    this.messagesEl.appendChild(card);
    this.scrollToBottom();
  }

  private setInputLocked(locked: boolean): void {
    if (!this.inputEl || !this.sendBtn) return;
    this.inputEl.disabled = locked;
    this.sendBtn.disabled = locked;
    this.inputEl.placeholder = locked
      ? "Pick an option above to continue…"
      : "Type a message...";
  }

  /**
   * Submit a qualifying answer to the server and either render the next
   * question or unlock free-text chat.
   */
  private async submitQualifyingAnswer(
    prompt: QualifyingPrompt,
    option: QualifyingOption,
    cardEl: HTMLDivElement
  ): Promise<void> {
    if (this.qualifyingPending) return;
    this.qualifyingPending = true;

    // Disable all buttons inside the card while the request is in flight.
    const buttons = cardEl.querySelectorAll("button");
    buttons.forEach((b) => ((b as HTMLButtonElement).disabled = true));

    try {
      const res = await fetch(
        `${this.config.apiBase}/api/conversations/qualifying`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: this.config.tenantId,
            conversationId: this.conversationId,
            visitorId: this.visitorId,
            field: prompt.field,
            value: option.value,
            question: prompt.question,
            metadata: {
              pageUrl: window.location.href,
              referrer: document.referrer || null,
            },
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        conversationId: string;
        persona: Record<string, string>;
        next: QualifyingPrompt | null;
        completedAt: string | null;
      };

      // Lock in conversation ID (server creates lazily on first answer).
      if (data.conversationId) {
        this.conversationId = data.conversationId;
      }
      this.qualifyingAnsweredFields.add(prompt.field);

      // Remove the card and show the visitor's selection as a normal user
      // bubble so the transcript reads naturally.
      cardEl.remove();
      this.addMessageToUI("user", option.label);
      this.messages.push({ role: "user", content: option.label });
      this.persistSession();

      if (data.next) {
        this.renderQualifyingPrompt(data.next);
      } else {
        this.qualifyingComplete = true;
        this.setInputLocked(false);
        if (this.flushPendingPillAction()) {
          return;
        }
        // Hidden assistant turn so the bot acknowledges the visitor
        // instead of leaving them staring at a silent input.
        // Fire-and-forget: focus the input first, kick off the greeting
        // stream after. `triggerGreeting` is a no-op if `isStreaming`.
        setTimeout(() => this.inputEl.focus(), 100);
        void this.triggerGreeting({ skipped: false });
      }
    } catch (err) {
      console.warn("[Convo] Qualifying submit failed:", err);
      // Re-enable buttons so the visitor can retry.
      buttons.forEach((b) => ((b as HTMLButtonElement).disabled = false));
    } finally {
      this.qualifyingPending = false;
    }
  }

  /**
   * Visitor dismissed the qualifying flow. Persist the skip so it doesn't
   * resurface, and unlock free-text.
   */
  private async skipQualifying(cardEl: HTMLDivElement): Promise<void> {
    if (this.qualifyingPending) return;
    this.qualifyingPending = true;

    cardEl.querySelectorAll("button").forEach(
      (b) => ((b as HTMLButtonElement).disabled = true)
    );

    try {
      const res = await fetch(
        `${this.config.apiBase}/api/conversations/qualifying`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: this.config.tenantId,
            conversationId: this.conversationId,
            visitorId: this.visitorId,
            skip: true,
            metadata: {
              pageUrl: window.location.href,
              referrer: document.referrer || null,
            },
          }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          conversationId: string;
        };
        if (data.conversationId) this.conversationId = data.conversationId;
      }
    } catch {
      // Non-blocking — still close the flow client-side.
    } finally {
      this.qualifyingPending = false;
      this.qualifyingComplete = true;
      cardEl.remove();
      this.setInputLocked(false);
      if (this.flushPendingPillAction()) {
        return;
      }
      setTimeout(() => this.inputEl.focus(), 100);
      // Hidden assistant turn so the bot acknowledges the visitor.
      // The server uses `skipped: true` to soften the greeting
      // (no persona reference, since we don't have one).
      void this.triggerGreeting({ skipped: true });
    }
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
        <button class="convo-close" aria-label="Close chat">${CLOSE_ICON_SM}</button>
      </div>
      <div class="convo-messages"></div>
      <div class="convo-input-area">
        <input type="text" placeholder="Type a message..." aria-label="Type a message" />
        <button aria-label="Send message">${SEND_ICON}</button>
      </div>
      <div class="convo-powered">Powered by <a href="https://convoapp.com.au" target="_blank" rel="noopener">Convo</a></div>
    `;

    this.messagesEl = this.panel.querySelector(".convo-messages")!;
    this.inputEl = this.panel.querySelector("input")!;
    this.sendBtn = this.panel.querySelector(".convo-input-area button")!;
    this.closeBtn = this.panel.querySelector(".convo-close")!;

    this.shadow.appendChild(style);

    // CON-251: closed-bubble starter-prompt pills. Keep this as a sibling
    // before the panel in the shadow tree so it never paints over the open
    // chat surface while still floating above the closed launcher bubble.
    // Renders nothing when the tenant has zero pills configured — no
    // placeholder, no wrapper (per CON-251 §4 spec).
    this.renderStarterPills();

    this.shadow.appendChild(this.panel);
    this.shadow.appendChild(this.bubble);

    // CON-40: if we rehydrated a session, replay it. Otherwise show welcome.
    if (this.messages.length > 0) {
      for (const m of this.messages) {
        this.addMessageToUI(m.role, m.content);
      }
    } else if (this.config.welcomeEnabled && this.config.welcome.trim()) {
      this.addMessageToUI("assistant", this.config.welcome);
    }

    // CON-94: after the welcome (or replayed history), surface the next
    // unanswered qualifying question. If the flow is already complete or
    // no questions are configured, this is a no-op and free-text stays open.
    const nextPrompt = this.nextQualifyingPrompt();
    if (nextPrompt) {
      this.renderQualifyingPrompt(nextPrompt);
    }
  }

  private attachEvents() {
    this.bubble.addEventListener("click", () => this.toggle());
    this.closeBtn.addEventListener("click", () => this.close());

    this.sendBtn.addEventListener("click", () => this.send());

    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // iOS Safari: scroll input into view when keyboard appears
    this.inputEl.addEventListener("focus", () => {
      setTimeout(() => {
        this.inputEl.scrollIntoView({ block: "end", behavior: "smooth" });
      }, 200);
    });
  }

  /**
   * Handle iOS Safari keyboard via window.visualViewport API.
   * iOS Safari's position: fixed is measured relative to the layout viewport,
   * not the visual viewport. When the keyboard opens, the visual viewport
   * shrinks but the layout viewport does not, causing fixed-bottom elements
   * to be obscured by the keyboard. We position the panel directly via JS
   * using visualViewport.offsetTop and visualViewport.height.
   */
  private setupViewportHandler() {
    if (
      typeof window === "undefined" ||
      !window.visualViewport
    ) {
      return;
    }

    const MARGIN = 12;

    const updatePanelPosition = () => {
      if (this.viewportRafId !== null) return;
      this.viewportRafId = requestAnimationFrame(() => {
        this.viewportRafId = null;
        if (!window.visualViewport) return;
        
        // Only apply visual-viewport positioning on mobile
        if (window.innerWidth > 640) {
          // Desktop: clear any mobile overrides
          this.panel.style.top = "";
          this.panel.style.height = "";
          this.panel.style.left = "";
          this.panel.style.width = "";
          this.panel.style.right = "";
          return;
        }
        
        const vv = window.visualViewport;
        const top = vv.offsetTop + MARGIN;
        const height = vv.height - (MARGIN * 2);
        const left = vv.offsetLeft + MARGIN;
        const width = vv.width - (MARGIN * 2);
        
        this.panel.style.top = `${top}px`;
        this.panel.style.height = `${height}px`;
        this.panel.style.left = `${left}px`;
        this.panel.style.width = `${width}px`;
        this.panel.style.right = "auto";
        
        // Toggle keyboard-open class on powered-by footer
        const poweredEl = this.panel.querySelector('.convo-powered') as HTMLElement | null;
        if (poweredEl) {
          // Keyboard is "open" if visualViewport height is significantly less than window.innerHeight
          const keyboardOpen = window.innerWidth <= 640 && vv.height < window.innerHeight * 0.75;
          poweredEl.classList.toggle('keyboard-open', keyboardOpen);
          
          // Auto-scroll messages to bottom when keyboard opens
          if (keyboardOpen && this.messagesEl) {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
          }
        }
      });
    };

    updatePanelPosition();
    window.visualViewport.addEventListener("resize", updatePanelPosition);
    window.visualViewport.addEventListener("scroll", updatePanelPosition);
    window.addEventListener("orientationchange", updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition); // catch desktop ↔ mobile transitions
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
    // CON-251: hide pills while the panel is open, restore on close.
    this.updateStarterPillsVisibility();

    if (this.isOpen) {
      setTimeout(() => this.inputEl.focus(), 300);
    } else {
      // Widget closed — trigger pipeline if conversation happened
      this.triggerPipeline();
    }
  }

  private close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove("visible");
    this.bubble.classList.remove("open");
    this.bubble.innerHTML = CHAT_ICON;
    this.bubble.setAttribute("aria-label", "Open chat");
    // CON-251: restore pills after close.
    this.updateStarterPillsVisibility();
    // Widget closed — trigger pipeline if conversation happened
    this.triggerPipeline();
  }

  /**
   * CON-251: render the closed-bubble starter-prompt pills.
   *
   * A vertical stack floats above the launcher bubble on desktop. Clicking
   * a pill opens the panel and immediately sends the pill's `prompt` as
   * if the visitor had typed it — the assistant turn starts before the
   * open animation completes so the visitor sees typing indicators
   * immediately.
   *
   * Rendered only when at least one prompt is configured (no placeholder).
   * Hidden via CSS on mobile (< 640px). Hidden while the panel is open.
   */
  private renderStarterPills(): void {
    if (this.starterPrompts.length === 0) {
      // Nothing to render — do not create a wrapper element.
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "convo-starter-pills";

    for (const p of this.starterPrompts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "convo-starter-pill";
      btn.setAttribute("aria-label", p.label);
      btn.innerHTML = `
        <span class="convo-starter-pill-emoji" aria-hidden="true">${this.escapeHtml(p.emoji)}</span>
        <span class="convo-starter-pill-label">${this.escapeHtml(p.label)}</span>
      `;
      btn.addEventListener("click", () => this.handleStarterPillClick(p));
      wrapper.appendChild(btn);
    }

    this.starterPillsEl = wrapper;
    this.shadow.appendChild(wrapper);
    this.updateStarterPillsVisibility();
  }

  /**
   * CON-251: click handler. Opens the panel if closed and posts the pill's
   * prompt through the standard send pipeline so history, streaming,
   * persistence, and pipeline triggers all behave identically to a typed
   * message.
   */
  private handleStarterPillClick(pill: StarterPrompt): void {
    // Guard against double-tap while a stream is already in flight.
    if (this.isStreaming) return;
    // Open the panel; keeps a single code path with the bubble click so
    // mobile viewport, focus, and pipeline triggers stay consistent.
    if (!this.isOpen) this.toggle();

    const action = pill.action;
    if (!action || action.type === "chat") {
      // Buffer, then either flush now or defer until qualifying completes.
      this.pendingPillAction = { type: "chat", prompt: pill.prompt };
      if (!this.nextQualifyingPrompt()) this.flushPendingPillAction();
      return;
    }

    this.pendingPillAction = action;
    if (!this.nextQualifyingPrompt()) this.flushPendingPillAction();
  }

  // CON-254/259: dispatch starter-pill actions buffered during qualifying.
  private flushPendingPillAction(): boolean {
    const action = this.pendingPillAction;
    if (!action) return false;
    this.pendingPillAction = null;

    if (action.type === "chat") {
      this.inputEl.value = action.prompt;
      void this.send();
      return true;
    }

    if (action.type === "lead_capture") {
      void this.startPillLeadCapture(action);
      return true;
    }

    if (action.type === "custom_embed") {
      this.renderCustomEmbed(action);
      return true;
    }

    // Deprecated no-op placeholder. Configs still parse, but no UI/action runs.
    return true;
  }

  private renderCustomEmbed(action: PillCustomEmbedAction): void {
    const block = document.createElement("div");
    block.className = "convo-card";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "convo-cap-btn convo-cap-btn-text";
    close.setAttribute("aria-label", "Close embedded form");
    close.textContent = "Close";
    close.addEventListener("click", () => {
      block.remove();
      this.inputEl.focus();
    });

    const frame = document.createElement("iframe");
    frame.src = action.url;
    frame.height = String(action.height ?? 520);
    frame.style.cssText = "width:100%;border:0;border-radius:10px;background:#f8fafc";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups",
    );
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.loading = "lazy";
    if (action.allow) frame.allow = action.allow;

    block.appendChild(close);
    block.appendChild(frame);
    this.messagesEl.appendChild(block);
    this.scrollToBottom();
  }

  private async startPillLeadCapture(
    action: PillLeadCaptureAction,
  ): Promise<void> {
    if (!this.conversationId) {
      this.addAssistantTranscriptMessage(
        "Please send a quick message first so we can start your enquiry.",
      );
      return;
    }

    this.isStreaming = true;
    this.sendBtn.disabled = true;
    this.inputEl.disabled = true;
    try {
      const res = await fetch(`${this.config.apiBase}/api/cases/pill-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: this.config.tenantId,
          visitorId: this.visitorId,
          conversationId: this.conversationId,
          capture_policy_id: action.capture_policy.id,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { case_id?: string };
      if (!data.case_id) throw new Error("Missing case_id");

      this.addAssistantTranscriptMessage(
        "Great — please share a few details so we can follow up.",
      );
      this.mountCaptureFlow(
        {
          case_id: data.case_id,
          action: "capture_details_then_flag",
          capture_policy_id: action.capture_policy.id,
          capture_policy: action.capture_policy,
        },
        action.field_label_overrides,
      );
    } catch (err) {
      console.warn("[Convo] Starter-pill lead capture failed:", err);
      this.addAssistantTranscriptMessage(
        "We couldn't start that form just now. Please type your enquiry below.",
      );
    } finally {
      this.isStreaming = false;
      this.sendBtn.disabled = false;
      this.inputEl.disabled = false;
    }
  }

  private addAssistantTranscriptMessage(content: string): void {
    this.addMessageToUI("assistant", content);
    this.messages.push({ role: "assistant", content });
    this.persistSession();
  }

  /**
   * CON-251: hide the pill stack while the panel is open, restore when
   * it closes. Class toggle drives display:none (size-budget trim).
   */
  private updateStarterPillsVisibility(): void {
    if (!this.starterPillsEl) return;
    this.starterPillsEl.classList.toggle("hidden", this.isOpen);
  }

  private async send() {
    const text = this.inputEl.value.trim();
    if (!text || this.isStreaming) return;

    this.inputEl.value = "";
    this.addMessageToUI("user", text);
    this.messages.push({ role: "user", content: text });
    this.persistSession(); // CON-40: save user turn immediately

    await this.streamAssistantTurn({
      tenantId: this.config.tenantId,
      conversationId: this.conversationId,
      visitorId: this.visitorId,
      message: text,
      metadata: {
        pageUrl: window.location.href,
        referrer: document.referrer || null,
      },
    });
  }

  /**
   * CON-XXX (qualifying greeting trigger):
   * Kick off a hidden assistant turn with no visitor message — used
   * when the visitor has just completed (or skipped) the qualifying
   * flow so the bot acknowledges them instead of leaving the input
   * sitting silently. The server detects `triggerGreeting: true` and
   * runs a single-sentence greeting turn without the 3-part response
   * structure.
   */
  private async triggerGreeting(opts: { skipped: boolean }): Promise<void> {
    if (this.isStreaming) return;
    await this.streamAssistantTurn({
      tenantId: this.config.tenantId,
      conversationId: this.conversationId,
      visitorId: this.visitorId,
      triggerGreeting: true,
      skipped: opts.skipped,
      metadata: {
        pageUrl: window.location.href,
        referrer: document.referrer || null,
      },
    });
  }

  /**
   * Shared SSE-streaming pipeline for any assistant turn (visitor-sent
   * message OR a hidden trigger-greeting turn). Owns the streaming UI
   * state, paced rendering, CTA / follow-up case handling, and final
   * persistence. Callers are responsible for adding any visitor-side
   * UI (the user bubble for `send()`) before invoking.
   */
  private async streamAssistantTurn(
    requestBody: Record<string, unknown>
  ): Promise<void> {
    this.isStreaming = true;
    this.sendBtn.disabled = true;
    // CON-247: also disable the input element so an in-flight stream
    // can't be interleaved with keyboard-triggered send() calls that
    // sneak past the `isStreaming` guard when the button is stuck.
    this.inputEl.disabled = true;
    this.showTyping();

    // CON-247: hard network watchdog. If the response body stalls (no
    // new chunk for STREAM_STALL_MS OR the whole stream exceeds
    // STREAM_HARD_MS), abort the fetch so `finally` fires and we clear
    // the disabled state instead of leaving the visitor with a stuck
    // send button. Values are generous to avoid false aborts on slow
    // networks — this is a safety net, not a UX gate.
    const STREAM_STALL_MS = 60_000;
    const STREAM_HARD_MS = 180_000;
    const abortController = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => abortController.abort(), STREAM_STALL_MS);
    };
    const hardTimer = setTimeout(
      () => abortController.abort(),
      STREAM_HARD_MS,
    );
    resetStallTimer();

    // CON-92 — streaming UX state.
    //  • tokenQueue: tokens received from the server, awaiting paced render.
    //  • thinkingMinMs gate: the typing indicator stays for at least this
    //    long from send() entry before the first token is rendered.
    //  • tokensPerSecond throttle: tokens are flushed from the queue at a
    //    fixed cadence (one token per `1000/tps` ms), regardless of how
    //    fast the server pushes them, to simulate a natural reading pace.
    //    This continues after the network `done` event until the queue is
    //    drained, then the final state is persisted.
    const sendStart = Date.now();
    const tokenQueue: string[] = [];
    let serverDone = false;
    let streamErrored = false;
    // Typed loosely so TS doesn't narrow to `never` after the async drain
    // loop assigns it via closure (control-flow analysis can't see that).
    let assistantEl = null as HTMLDivElement | null;
    let renderedContent = "";
    let typingHidden = false;
    // CON-93 — CTA may arrive over SSE before paced rendering finishes.
    // Hold it here and render after the drain loop completes so the
    // assistant bubble is guaranteed to exist.
    type CtaPayload = { text?: string; url?: string; tag?: string } | null;
    let pendingCta: { cta: CtaPayload; followUp: string | null } | null = null;
    const tokenIntervalMs = Math.max(
      1,
      Math.round(1000 / this.config.streaming.tokensPerSecond)
    );

    // The drain loop owns the assistant bubble + typing indicator. It is
    // started once, before the first token is flushed, and resolves only
    // when the queue is empty AND the server has signalled `done` (or the
    // stream errored out at the network level).
    const drainLoop = (async () => {
      // Wait for the thinking-indicator minimum window.
      const elapsed = Date.now() - sendStart;
      const wait = this.config.streaming.thinkingMinMs - elapsed;
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }

      while (true) {
        if (tokenQueue.length > 0) {
          // First token — swap indicator for the assistant bubble now.
          if (!typingHidden) {
            this.hideTyping();
            typingHidden = true;
            assistantEl = this.addMessageToUI("assistant", "");
          }
          const next = tokenQueue.shift()!;
          renderedContent += next;
          if (assistantEl) {
            assistantEl.innerHTML = this.renderMarkdown(renderedContent);
            this.scrollToBottom();
          }
          await new Promise((r) => setTimeout(r, tokenIntervalMs));
          continue;
        }
        if (serverDone || streamErrored) break;
        // Queue empty, server still streaming — brief wait then re-check.
        await new Promise((r) => setTimeout(r, tokenIntervalMs));
      }
    })();

    try {
      const res = await fetch(`${this.config.apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // CON-247: fresh chunk arrived, reset the stall watchdog.
        resetStallTimer();

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
              tokenQueue.push(event.content);
            } else if (event.type === "cta") {
              // CON-93 — structured CTA emitted after the assistant turn.
              // Defer render until paced streaming has flushed so the
              // bubble exists (it's created on first token by drainLoop).
              pendingCta = {
                cta: (event.cta ?? null) as CtaPayload,
                followUp:
                  typeof event.followUp === "string" ? event.followUp : null,
              };
            } else if (event.type === "case" && event.case) {
              // CON-169 (Epic D1): server signalled a follow-up action.
              // Render visitor-facing UI for the variants we support.
              // CON-170 (Epic D2): `capture_details_then_flag` skips the
              // Yes/No offer card and goes straight into progressive
              // contact capture; `offer_follow_up` keeps the offer card
              // and chains capture on Yes; everything else is no-op.
              this.renderCaseEvent(event);
            } else if (event.type === "error") {
              streamErrored = true;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Signal the drain loop that no more tokens are coming.
      serverDone = true;
      await drainLoop;

      if (streamErrored && assistantEl) {
        assistantEl.textContent =
          "Sorry, something went wrong. Please try again.";
      }

      // CON-93 — render deferred CTA now that the assistant bubble is
      // populated. If no tokens streamed (assistantEl null), skip —
      // there's nothing to attach the CTA to.
      if (pendingCta && assistantEl) {
        this.renderCta(assistantEl, pendingCta.cta, pendingCta.followUp);
        this.scrollToBottom();
      }

      // Persist what the user actually saw (post-drain).
      this.messages.push({ role: "assistant", content: renderedContent });
      this.persistSession(); // CON-40
      this.resetIdleTimer();
    } catch {
      // Network-level failure. Unblock the drain loop then show the
      // generic connection error.
      streamErrored = true;
      serverDone = true;
      await drainLoop;
      if (!typingHidden) this.hideTyping();
      this.addMessageToUI(
        "assistant",
        "Sorry, I'm having trouble connecting. Please try again in a moment."
      );
    } finally {
      // CON-247: always tear down watchdogs so an abort doesn't fire
      // after a healthy completion and confuse the next turn.
      if (stallTimer) clearTimeout(stallTimer);
      clearTimeout(hardTimer);
      this.isStreaming = false;
      this.sendBtn.disabled = false;
      this.inputEl.disabled = false;
      // If typing indicator somehow survived the drain loop (e.g. abort
      // fired before the first token), hide it here so we don't leave
      // the visitor staring at three dots.
      this.hideTyping();
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

  /**
   * Render a CON-93 structured CTA below the just-completed assistant
   * message. Either a tappable button (when `cta` is provided) or a soft
   * italic follow-up prompt (when `cta` is null and `followUp` is set).
   *
   * URL safety: the URL is sourced from the server's validated `cta_rules`
   * config only — the model never produces it. We additionally require an
   * http/https scheme client-side as a defence in depth; anything else is
   * silently dropped.
   */
  private renderCta(
    assistantEl: HTMLDivElement,
    cta: { text?: string; url?: string; tag?: string } | null,
    followUp: string | null
  ): void {
    // Guard: don't double-render if a CTA block already exists for this message.
    if (assistantEl.nextElementSibling?.classList.contains("convo-cta-block")) {
      return;
    }

    if (cta && typeof cta.url === "string" && typeof cta.text === "string") {
      // Defence-in-depth URL scheme check.
      let safeUrl: string | null = null;
      try {
        const parsed = new URL(cta.url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          safeUrl = parsed.toString();
        }
      } catch {
        safeUrl = null;
      }
      if (!safeUrl) return;

      const block = document.createElement("div");
      block.className = "convo-cta-block";

      const link = document.createElement("a");
      link.className = "convo-cta-button";
      link.textContent = cta.text;
      link.href = safeUrl;
      // Internal vs external link handling mirrors renderMarkdown (CON-18).
      const isInternal = this.isInternalLink(safeUrl);
      if (isInternal) {
        link.setAttribute("rel", "noopener");
      } else {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
      block.appendChild(link);
      assistantEl.insertAdjacentElement("afterend", block);
      return;
    }

    if (typeof followUp === "string" && followUp.trim()) {
      const prompt = document.createElement("div");
      prompt.className = "convo-cta-followup";
      prompt.textContent = followUp;
      assistantEl.insertAdjacentElement("afterend", prompt);
    }
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

  /**
   * Dispatch the SSE `case` event to the right widget UI surface
   * (CON-169 + CON-170 — Epic D1 / D2).
   *
   *   - `offer_follow_up` → render Yes/No offer card. On Yes we chain
   *     into the progressive contact-capture flow against the same
   *     `case_id`. On No we ack and stop.
   *   - `capture_details_then_flag` → skip the offer card and go
   *     straight into capture (the rule has already decided we should
   *     ask for details; offering would be redundant).
   *   - `immediate_escalation` → if the case carries an inlined
   *     capture policy, run the same capture flow; otherwise no widget UI
   *     (handled by the assistant turn copy).
   *   - All other variants → no-op (`flag_for_staff_review_*` /
   *     `refer_to_approved_contact_method` either resolve silently or
   *     surface inside the assistant message itself).
   */
  private renderCaseEvent(event: {
    case?: {
      action?: string;
      case_id?: string;
      offer_title?: string;
      rule_id?: string;
      confidence?: number;
      capture_policy?: {
        id: string;
        case_type: "cx_support" | "lead";
        required_fields: string[];
        optional_fields: string[];
        privacy_notice: string;
        privacy_policy_url: string;
      };
      capture_policy_id?: string;
      contact_method_id?: string;
      contact_method?: {
        id: string;
        type: "email" | "phone" | "callback" | "url" | "form";
        label: string;
        value?: string;
        url?: string;
      };
    };
  }): void {
    const caseInfo = event.case;
    if (!caseInfo || typeof caseInfo.action !== "string") return;
    if (typeof caseInfo.case_id !== "string" || caseInfo.case_id.length === 0) {
      // D2a guarantees a `case_id` whenever a widget-bound action fires,
      // so absence here means we're talking to a stale server build.
      // Fall back to the legacy Yes/No card with no capture chain.
      if (caseInfo.action === "offer_follow_up") {
        this.renderOffer(caseInfo);
      }
      return;
    }

    if (caseInfo.action === "offer_follow_up") {
      this.renderOffer(caseInfo);
      return;
    }

    // CON-172 / D4 — refer the visitor to the tenant's approved
    // contact method. The server already persisted the case + audit
    // event; the widget renders an inline card with a `mailto:`,
    // `tel:`, or button-to-URL surface. No PII captured client-side.
    if (shouldRenderContactMethodForAction(caseInfo.action)) {
      this.renderContactMethod(caseInfo);
      return;
    }

    if (shouldRunCaptureForAction(caseInfo.action)) {
      this.mountCaptureFlow(caseInfo as CaptureCaseInfo);
    }
    // Any other action: no widget surface.
  }

  /**
   * Render the approved-contact-method card (CON-172 — Epic D4).
   *
   * Surfaces the tenant's pre-approved contact channel (email / phone /
   * URL / form / callback) as an inline action card. The model never
   * sees the contact address — same pattern as the CON-93 CTA. The
   * widget reads the resolved `contact_method` inlined on the SSE
   * `case` event by the chat route.
   *
   * No PII captured here. No round-trip on click — the audit event
   * (`case_resolved` with `channels_shown`) was already persisted
   * server-side when this SSE event fired.
   */
  private renderContactMethod(caseInfo: {
    offer_title?: string;
    contact_method?: {
      type: "email" | "phone" | "callback" | "url" | "form";
      label: string;
      value?: string;
      url?: string;
    };
  }): void {
    const cm = caseInfo.contact_method;
    if (!cm || typeof cm.type !== "string" || typeof cm.label !== "string") {
      // No resolvable method — stay silent. The assistant turn copy
      // stands on its own.
      return;
    }

    const block = document.createElement("div");
    block.className = "convo-offer-block";

    const titleEl = document.createElement("div");
    titleEl.className = "convo-offer-title";
    titleEl.textContent =
      typeof caseInfo.offer_title === "string" && caseInfo.offer_title.trim()
        ? caseInfo.offer_title
        : "For this kind of question, our team can help directly:";
    block.appendChild(titleEl);

    // Resolve href via the pure helper in `capture.ts` so the widget
    // surface stays in lockstep with what the unit tests exercise.
    const resolved = resolveContactMethodHref(cm);

    if (resolved) {
      const link = document.createElement("a");
      link.href = resolved.href;
      // Reuse the existing CTA-button class (CON-93) — brand-coloured,
      // pill-shaped, no new CSS needed for the D4 surface.
      link.className = "convo-cta-button";
      link.textContent = cm.label;
      // External URLs open in a new tab; mailto/tel let the OS handle.
      if (resolved.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      block.appendChild(link);
    } else {
      // No href resolvable (e.g. `callback` with no URL) — render the
      // label as plain text so the visitor still sees the channel name.
      const labelEl = document.createElement("div");
      labelEl.className = "convo-offer-title";
      labelEl.textContent = cm.label;
      block.appendChild(labelEl);
    }

    this.messagesEl.appendChild(block);
    this.scrollToBottom();
  }

  /**
   * Render the follow-up offer card (CON-169 — Epic D1).
   * Yes/No buttons post to `/api/conversations/case-events`. On Yes we
   * additionally start the progressive contact-capture flow (CON-170 /
   * D2b) against the same `case_id` the server already persisted.
   */
  private renderOffer(caseInfo: {
    action?: string;
    case_id?: string;
    offer_title?: string;
    rule_id?: string;
    confidence?: number;
    capture_policy?: {
      id: string;
      case_type: "cx_support" | "lead";
      required_fields: string[];
      optional_fields: string[];
      privacy_notice: string;
      privacy_policy_url: string;
    };
    capture_policy_id?: string;
  }): void {
    if (caseInfo.action !== "offer_follow_up") return;

    const title =
      typeof caseInfo.offer_title === "string" && caseInfo.offer_title.trim()
        ? caseInfo.offer_title
        : "Would you like our team to follow up?";

    const block = document.createElement("div");
    block.className = "convo-offer-block";

    const titleEl = document.createElement("div");
    titleEl.className = "convo-offer-title";
    titleEl.textContent = title;

    const buttonsEl = document.createElement("div");
    buttonsEl.className = "convo-offer-buttons";

    const yesBtn = document.createElement("button");
    yesBtn.type = "button";
    yesBtn.className = "convo-offer-btn primary";
    yesBtn.textContent = "Yes, please";

    const noBtn = document.createElement("button");
    noBtn.type = "button";
    noBtn.className = "convo-offer-btn secondary";
    noBtn.textContent = "No, thanks";

    buttonsEl.appendChild(yesBtn);
    buttonsEl.appendChild(noBtn);
    block.appendChild(titleEl);
    block.appendChild(buttonsEl);
    this.messagesEl.appendChild(block);
    this.scrollToBottom();

    const metadata: Record<string, unknown> = {};
    if (caseInfo.rule_id) metadata.rule_id = caseInfo.rule_id;
    if (typeof caseInfo.confidence === "number") {
      metadata.confidence = caseInfo.confidence;
    }

    const respond = async (
      eventType: "offer_accepted" | "offer_declined",
      ack: string,
    ): Promise<void> => {
      yesBtn.disabled = true;
      noBtn.disabled = true;
      try {
        await fetch(
          `${this.config.apiBase}/api/conversations/case-events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: this.config.tenantId,
              visitorId: this.visitorId,
              conversationId: this.conversationId,
              caseEventType: eventType,
              metadata,
            }),
          },
        );
      } catch {
        // Non-critical — visitor already saw the click.
      }
      block.replaceChildren();
      const ackEl = document.createElement("div");
      ackEl.className = "convo-offer-title";
      ackEl.textContent = ack;
      block.appendChild(ackEl);
      this.scrollToBottom();
    };

    yesBtn.addEventListener("click", () => {
      void (async () => {
        await respond(
          "offer_accepted",
          "Great \u2014 please share a few details so we can follow up.",
        );
        // CON-170 / D2b — chain into the progressive capture flow.
        // Requires both `case_id` (always present in D2a payloads) and
        // an inlined `capture_policy` (D2a inlines this for actions
        // that carry a capture_policy_id). If either is missing we
        // stop after the ack — the visitor can still reach the team
        // via the assistant's message.
        if (caseInfo.case_id && caseInfo.capture_policy) {
          this.mountCaptureFlow(caseInfo as CaptureCaseInfo);
        }
      })();
    });
    noBtn.addEventListener("click", () => {
      void respond(
        "offer_declined",
        "No worries, let me know if you change your mind.",
      );
    });
  }

  /**
   * Spawn the progressive contact-capture flow (CON-170 / D2b).
   * Idempotent: re-invocations are no-ops because each `case_id` should
   * only render one capture surface per session, and the server's
   * append-only audit will swallow duplicates if a visitor rapid-fires.
   */
  private mountCaptureFlow(
    caseInfo: CaptureCaseInfo,
    fieldLabelOverrides?: Record<string, string>,
  ): void {
    if (!this.conversationId) return; // shouldn't happen post-stream
    startCaptureFlow({
      mount: this.messagesEl,
      caseInfo,
      config: {
        apiBase: this.config.apiBase,
        tenantId: this.config.tenantId,
        visitorId: this.visitorId,
        conversationId: this.conversationId,
        primaryColor: this.config.color,
      },
      fieldLabelOverrides,
      onDone: (outcome: CaptureFlowOutcome) => {
        // The capture block stays in place as a transcript trail.
        // Future enhancement (CON-176 detail view) will surface the
        // outcome in the dashboard; client-side we just scroll the
        // panel so the final ack is visible.
        void outcome;
        this.scrollToBottom();
      },
    });
    this.scrollToBottom();
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
   * Is this link internal (same root domain as the host page)?
   * Relative URLs (starting with /, #, ?) are always internal.
   * Absolute URLs are internal if they share the registrable root domain
   * (e.g. doggo.com.au and www.doggo.com.au both count as internal).
   * Different protocol (http vs https) is NOT treated as external — browsers
   * upgrade these automatically and they're still the same site to the user.
   * (CON-18 — internal links should stay in-tab, external should open new tab.)
   */
  private isInternalLink(url: string): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    // Protocol-specific — always external behaviour
    if (/^(mailto:|tel:|sms:|javascript:)/i.test(trimmed)) return false;
    // Relative paths / hash / query → internal
    if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return true;
    // Absolute URL — compare registrable root domain
    try {
      const u = new URL(trimmed, window.location.href);
      const strip = (h: string) => h.replace(/^www\./i, "").toLowerCase();
      const linkHost = strip(u.hostname);
      const pageHost = strip(window.location.hostname);
      if (linkHost === pageHost) return true;
      // Subdomain match — treat app.foo.com as internal when page is foo.com
      if (linkHost.endsWith("." + pageHost) || pageHost.endsWith("." + linkHost)) return true;
      return false;
    } catch {
      // Malformed URL → treat as relative/internal
      return true;
    }
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
    // Links: [text](url) — internal links stay in-tab, external links open in new tab (CON-18)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_match, text, url) => {
      const isInternal = this.isInternalLink(url);
      const safeText = this.escapeHtml(text);
      const safeUrl = this.escapeHtml(url);
      if (isInternal) {
        return `<a href="${safeUrl}" style="color:inherit;text-decoration:underline;">${safeText}</a>`;
      }
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${safeText}</a>`;
    });
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

  /**
   * Trigger the content pipeline for the current conversation.
   * Called when: (1) widget is closed after messages, (2) idle timeout.
   * Fire-and-forget — never blocks the UI.
   */
  private triggerPipeline() {
    if (this.pipelineTriggered || !this.conversationId || this.messages.length < 2) return;
    this.pipelineTriggered = true;
    this.clearIdleTimer();

    fetch(`${this.config.apiBase}/api/pipeline/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: this.conversationId,
        tenantId: this.config.tenantId,
        visitorId: this.visitorId,
      }),
    }).catch(() => { /* non-critical */ });
  }

  private resetIdleTimer() {
    this.clearIdleTimer();
    if (this.conversationId && this.messages.length >= 2 && !this.pipelineTriggered) {
      this.idleTimer = setTimeout(() => this.triggerPipeline(), ConvoWidget.IDLE_TIMEOUT_MS);
    }
  }

  private clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
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
