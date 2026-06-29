"use client";

import { useEffect, useMemo, useState } from "react";
import {
  followUpSchema,
  forumConfigSchema,
  type FollowUp,
} from "@/lib/forum-config/schema";

import { FollowUpHeader } from "../follow-up/header";
import { ContactMethodsSection } from "../follow-up/contact-methods";
import { CapturePoliciesSection } from "../follow-up/capture-policies";
import { RulesSection } from "../follow-up/rules-table";
import { DestinationsSection } from "../follow-up/destinations";
import { HowToEditCallout } from "../follow-up/how-to-edit";
import { FollowUpEmptyState } from "../follow-up/empty-state";
import { ModeToggle } from "../follow-up/mode-toggle";
import { QuickSetupForm } from "../follow-up/quick-setup-form";
import {
  canSwitchToQuick,
  resolveRequestedMode,
  type FollowUpMode,
} from "../follow-up/mode-detection";
import { quickSetupInputFromForumConfig } from "../follow-up/quick-setup";
import type { ForumConfigRaw } from "../types";

/**
 * Follow-up tab inside Forum config (CON-238 relocation from Knowledge).
 *
 * Renders the full follow-up authoring surface that used to live at
 * `/dashboard/knowledge/follow-up`:
 *   - mode toggle (Quick vs Advanced)
 *   - Quick setup form (editable, posts via server action)
 *   - Advanced read-only view: header + contact methods + capture policies
 *     + rules + destinations + how-to callout
 *   - empty state when nothing is configured yet
 *
 * The previous URL-driven mode (`?mode=quick`) is honoured on first paint via
 * `initialMode`; after that the mode is local React state so toggling does
 * not force a full server round-trip.
 *
 * The `onSaved` / `onDirtyChange` props are kept for the editor's tab-dirty
 * bookkeeping. Quick save flows through a server action + revalidatePath, so
 * dirty state lives inside the Quick form; we keep the panel quiet on the
 * editor-level callbacks until in-place advanced editing lands.
 */
export function FollowUpPanel({
  initialValue,
  forumConfigRaw,
  initialMode,
  primaryColor,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  /**
   * Full forumConfig (already on the page server-side), used to seed Quick
   * setup defaults via `quickSetupInputFromForumConfig`.
   */
  forumConfigRaw: ForumConfigRaw;
  /** Optional starting mode (e.g. from `?mode=quick` deep-link). */
  initialMode?: FollowUpMode;
  /** Tenant widget primary colour, threaded through the read-only sections. */
  primaryColor: string;
  onSaved?: (value: FollowUp) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  // Schema-parse follow_up so defaults apply and malformed JSON cannot crash
  // the tab. If parse fails entirely, treat the block as absent.
  const followUp = useMemo<FollowUp | null>(() => {
    if (initialValue === undefined) return null;
    const parsed = followUpSchema.safeParse(initialValue);
    return parsed.success ? parsed.data : null;
  }, [initialValue]);

  const safeForumConfig = useMemo(() => {
    const parsed = forumConfigSchema.safeParse(forumConfigRaw);
    return parsed.success ? parsed.data : forumConfigSchema.parse({});
  }, [forumConfigRaw]);

  const quickCompatibility = useMemo(
    () => canSwitchToQuick(followUp ?? {}),
    [followUp],
  );
  const quickInitialValue = useMemo(
    () => quickSetupInputFromForumConfig(safeForumConfig),
    [safeForumConfig],
  );

  const [mode, setMode] = useState<FollowUpMode>(() =>
    resolveRequestedMode({ requestedMode: initialMode, followUp }),
  );

  // Keep the tab-level dirty signal quiet — Quick mode owns its own save
  // bar, Advanced is read-only. Signal "not dirty" once on mount so the
  // parent editor's tab dot is in sync.
  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // `onSaved` is currently not wired (Quick form uses a server action +
  // revalidatePath rather than calling back into the editor). Reference it
  // here to keep the prop forward-compatible without an unused-var lint.
  void onSaved;

  const hasContent =
    !!followUp &&
    (followUp.contact_methods.length > 0 ||
      followUp.capture_policies.length > 0 ||
      followUp.rules.length > 0 ||
      followUp.destinations.length > 0);

  if (mode === "quick") {
    return (
      <div className="space-y-6">
        <ModeToggle
          mode={mode}
          quickCompatibility={quickCompatibility}
          onChange={setMode}
        />
        <QuickSetupForm initialValue={quickInitialValue} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModeToggle
        mode={mode}
        quickCompatibility={quickCompatibility}
        onChange={setMode}
      />

      {(!followUp || !hasContent) && (
        <FollowUpEmptyState primaryColor={primaryColor} />
      )}

      {followUp && hasContent && (
        <>
          <FollowUpHeader config={followUp} primaryColor={primaryColor} />

          <ContactMethodsSection
            methods={followUp.contact_methods}
            primaryColor={primaryColor}
          />

          <CapturePoliciesSection
            policies={followUp.capture_policies}
            primaryColor={primaryColor}
          />

          <RulesSection
            rules={followUp.rules}
            contactMethods={followUp.contact_methods}
            capturePolicies={followUp.capture_policies}
            primaryColor={primaryColor}
          />

          <DestinationsSection
            destinations={followUp.destinations}
            primaryColor={primaryColor}
          />

          <HowToEditCallout primaryColor={primaryColor} />
        </>
      )}
    </div>
  );
}
