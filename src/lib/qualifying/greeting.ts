/**
 * Greeting-turn prompt addendum.
 *
 * Fired by the chat route when the widget POSTs `triggerGreeting: true`
 * \u2014 a hidden assistant turn the widget kicks off as soon as the
 * visitor finishes (or skips) the qualifying flow. Without it the
 * input sits silently after the last button-tap and the bot looks
 * broken (Cam, 5 Jun 2026 on AgPages).
 *
 * The addendum REPLACES the 3-part response-structure block on this
 * one turn so the model emits a single short acknowledgement instead
 * of a substantive answer to a nonexistent question.
 *
 * Brand voice (Convo): no exclamation marks, plainspoken,
 * outcomes-first.
 */

const GREETING_ADDENDUM_ANSWERED = `# Greeting Turn (HARD RULE)

The visitor has just finished the qualifying questions. Open with a
single short, warm sentence that lightly acknowledges what they told
you and invites them to ask their question. Do NOT follow the 3-part
response structure. Do NOT recap or list their answers back to them.
Do NOT use exclamation marks. One short sentence only.`;

const GREETING_ADDENDUM_SKIPPED = `# Greeting Turn (HARD RULE)

The visitor opted not to share details about themselves. Open with a
single short, warm sentence inviting them to ask their question. Do
NOT follow the 3-part response structure. Do NOT reference any
persona or qualifying details (you don't have any). Do NOT use
exclamation marks. One short sentence only.`;

export function buildGreetingAddendum(input: { skipped: boolean }): string {
  return input.skipped ? GREETING_ADDENDUM_SKIPPED : GREETING_ADDENDUM_ANSWERED;
}
