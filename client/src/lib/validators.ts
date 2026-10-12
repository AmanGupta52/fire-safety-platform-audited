// The ONE place for form-validation patterns and messages (checkout, saved addresses, register, profile, ...).
// Keep these in step with the server's validators if those ever change.

/** Indian mobile number: 10 digits starting 6-9, optional +91 prefix (space or dash allowed after it). */
export const PHONE_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;
/** Indian PIN code: exactly 6 digits, first digit 1-9. */
export const PINCODE_REGEX = /^[1-9]\d{5}$/;
/** GSTIN, checked after upper-casing: 2 digits, 5 letters, 4 digits, letter, entity code, "Z", checksum char. */
export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const MAX_TEXT_LENGTH = 100;

export const MESSAGES = {
  phone: 'Enter a valid 10-digit mobile number',
  pincode: 'Enter a 6-digit pincode',
  gstin: 'Enter a valid 15-character GSTIN',
  required: 'Required',
  tooLong: `Keep this under ${MAX_TEXT_LENGTH} characters`
} as const;

export const isValidPhone = (value: string): boolean => PHONE_REGEX.test(value.trim());
export const isValidPincode = (value: string): boolean => PINCODE_REGEX.test(value.trim());

/** Trims and upper-cases a GSTIN as typed, ready to validate or send. */
export const normalizeGstin = (value: string): string => value.trim().toUpperCase();
/** Empty is fine (GSTIN is optional); anything typed must be a well-formed GSTIN. */
export const isValidGstin = (value: string): boolean => {
  const gstin = normalizeGstin(value);
  return gstin === '' || GSTIN_REGEX.test(gstin);
};

const trimValue = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

// ---- react-hook-form rule sets (spread into register('field', rule)) ----

/** Required text, trimmed, max 100 characters. */
export const requiredTextRules = {
  setValueAs: trimValue,
  validate: (value: string | undefined) => (value ?? '').trim().length > 0 || MESSAGES.required,
  maxLength: { value: MAX_TEXT_LENGTH, message: MESSAGES.tooLong }
};

/** Optional text, trimmed, max 100 characters. */
export const optionalTextRules = {
  setValueAs: trimValue,
  maxLength: { value: MAX_TEXT_LENGTH, message: MESSAGES.tooLong }
};

export const phoneRules = {
  setValueAs: trimValue,
  validate: (value: string | undefined) => {
    const v = (value ?? '').trim();
    if (!v) return MESSAGES.required;
    return isValidPhone(v) || MESSAGES.phone;
  }
};

/** For phone fields that may be left empty (profile, contact form). */
export const optionalPhoneRules = {
  setValueAs: trimValue,
  validate: (value: string | undefined) => {
    const v = (value ?? '').trim();
    return v === '' || isValidPhone(v) || MESSAGES.phone;
  }
};

export const pincodeRules = {
  setValueAs: trimValue,
  validate: (value: string | undefined) => {
    const v = (value ?? '').trim();
    if (!v) return MESSAGES.required;
    return isValidPincode(v) || MESSAGES.pincode;
  }
};

/** Optional GSTIN: upper-cased and trimmed as it is read, and must be well-formed when filled in. */
export const gstinRules = {
  setValueAs: (value: unknown) => (typeof value === 'string' ? normalizeGstin(value) : value),
  validate: (value: string | undefined) => isValidGstin(value ?? '') || MESSAGES.gstin
};
