export type WordPressFormValues = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export function wordpressFormKey(values: WordPressFormValues): string {
  return JSON.stringify({
    siteUrl: values.siteUrl.trim(),
    username: values.username.trim(),
    applicationPassword: values.applicationPassword,
  });
}

export function wordpressFormValidationError(
  values: WordPressFormValues,
  maskedPassword: string | null,
): string | null {
  if (!values.siteUrl.trim()) return "Enter a WordPress site URL.";
  try {
    const parsed = new URL(values.siteUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "Enter a valid WordPress site URL.";
    }
  } catch {
    return "Enter a valid WordPress site URL.";
  }
  if (!values.username.trim()) return "Enter a WordPress username.";
  if (!values.applicationPassword) {
    return "Enter a WordPress application password.";
  }
  if (maskedPassword && values.applicationPassword === maskedPassword) {
    return "Enter the WordPress application password again before testing.";
  }
  return null;
}

export function canSaveWordPressForm(
  values: WordPressFormValues,
  successfulTestKey: string | null,
  maskedPassword: string | null,
): boolean {
  if (wordpressFormValidationError(values, maskedPassword)) return false;
  return successfulTestKey === wordpressFormKey(values);
}
