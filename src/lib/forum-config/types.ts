/**
 * Forum Config Types (K-01)
 * 
 * Re-exports the TypeScript types inferred from the Zod schema.
 * Import from this file when you need the type definitions across the app.
 * 
 * @example
 * ```typescript
 * import type { ForumConfig, CtaRule } from '@/lib/forum-config/types';
 * 
 * function applyConfig(config: ForumConfig) {
 *   // ...
 * }
 * ```
 */

export type {
  ForumConfig,
  AiPersona,
  CtaRule,
  QualifyingQuestion,
  SeoDefaults,
  Connectors,
  Limits,
  // Follow-up (CON-157)
  CaseType,
  Sensitivity,
  ActionMode,
  ContactMethodType,
  RulePriority,
  FollowUpConnector,
  FieldKey,
  ContactMethod,
  CapturePolicy,
  RuleCondition,
  FollowUpRule,
  Destination,
  FollowUp,
} from "./schema";
