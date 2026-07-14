export type CaptureFieldMeta = {
  label: string;
  inputType: string;
  autocomplete: string;
  placeholder: string;
};

/**
 * Canonical capture-field registry shared by the widget runtime and dashboard
 * starter-pill editor. Custom tenant field keys are still accepted by the
 * schema; these are the first-class keys we can label and suggest.
 */
export const FIELD_META: Record<string, CaptureFieldMeta> = {
  name: {
    label: "What's your name?",
    inputType: "text",
    autocomplete: "name",
    placeholder: "Your name",
  },
  email: {
    label: "What's the best email to reach you on?",
    inputType: "email",
    autocomplete: "email",
    placeholder: "you@example.com",
  },
  mobile: {
    label: "What's the best phone number to reach you on?",
    inputType: "tel",
    autocomplete: "tel",
    placeholder: "0400 000 000",
  },
  postcode: {
    label: "What's your postcode?",
    inputType: "text",
    autocomplete: "postal-code",
    placeholder: "2000",
  },
  free_text_note: {
    label: "Anything else our team should know?",
    inputType: "text",
    autocomplete: "off",
    placeholder: "Optional note",
  },
  suburb: {
    label: "What suburb are you in?",
    inputType: "text",
    autocomplete: "address-level2",
    placeholder: "Suburb",
  },
  state: {
    label: "Which state are you in?",
    inputType: "text",
    autocomplete: "address-level1",
    placeholder: "NSW",
  },
  company: {
    label: "What's your company name?",
    inputType: "text",
    autocomplete: "organization",
    placeholder: "Company",
  },
  preferred_contact_method: {
    label: "How would you prefer we contact you?",
    inputType: "text",
    autocomplete: "off",
    placeholder: "Email or phone",
  },
};
