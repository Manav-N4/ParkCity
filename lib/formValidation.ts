// Shared input rules for the Claim Spot and Report Issue forms.
//
// Sanitisers run on every keystroke and paste. They remove characters that can
// never be valid, but they never shorten or reinterpret a value: anything out of
// range stays visible and is rejected by the matching validator instead.

// Unicode-aware: letters (\p{L}) include accented and Indic letters, and
// combining marks (\p{M}) keep Devanagari vowel signs attached.
const BUSINESS_NAME_DISALLOWED = /[^\p{L}\p{M}\p{N} &.,'’()-]/gu;
const OWNER_NAME_DISALLOWED = /[^\p{L}\p{M} .'’-]/gu;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const HAS_LETTER = /\p{L}/u;

export const NAME_LIMITS = {
  business: { min: 2, max: 80 },
  owner: { min: 2, max: 60 },
} as const;

export const PRICE_MAX = 9999;
export const CAPACITY_MAX = 9999;

// ---------- Names ----------

export function sanitizeBusinessName(value: string) {
  return value.replace(BUSINESS_NAME_DISALLOWED, '').replace(/ {2,}/g, ' ');
}

export function sanitizeOwnerName(value: string) {
  return value.replace(OWNER_NAME_DISALLOWED, '').replace(/ {2,}/g, ' ');
}

export function isValidBusinessName(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length >= NAME_LIMITS.business.min &&
    trimmed.length <= NAME_LIMITS.business.max &&
    HAS_LETTER_OR_DIGIT.test(trimmed)
  );
}

export function isValidOwnerName(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length >= NAME_LIMITS.owner.min &&
    trimmed.length <= NAME_LIMITS.owner.max &&
    HAS_LETTER.test(trimmed)
  );
}

// ---------- Indian mobile number ----------

// Digits only. A full country code ("+91 98765 43210" / "919876543210",
// i.e. exactly 12 digits starting 91) is removed. A leading 0 is NOT removed:
// "0" + STD code is how landlines are written, so it must not be turned into
// something that looks like a mobile number.
export function sanitizePhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  return digits;
}

// Exactly 10 digits, starting 6–9 (Indian mobile numbering).
export function isValidPhone(value: string) {
  return /^[6-9]\d{9}$/.test(value);
}

// ---------- Price (₹ per hour) ----------

// Keeps digits and decimal points. A final comma followed by 0–2 digits (and
// no ".") is a decimal comma, so typing "12,5" on a comma-decimal keyboard
// gives "12.5" rather than "125". Any other comma is a thousands separator
// ("1,200" pasted -> "1200"). Leading zeros are removed. Extra dots are kept so
// the value fails validation instead of being silently merged.
export function sanitizePrice(value: string) {
  let text = value.replace(/[^0-9.,]/g, '');

  if (!text.includes('.') && /,\d{0,2}$/.test(text)) {
    const decimalComma = text.lastIndexOf(',');
    text = `${text.slice(0, decimalComma).replace(/,/g, '')}.${text.slice(decimalComma + 1)}`;
  } else {
    text = text.replace(/,/g, '');
  }

  const firstDot = text.indexOf('.');
  const whole = firstDot === -1 ? text : text.slice(0, firstDot);
  const fraction = firstDot === -1 ? null : text.slice(firstDot);
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');

  if (fraction === null) {
    return normalizedWhole;
  }

  return `${normalizedWhole || '0'}${fraction}`;
}

// 0–9999 with at most 2 decimals. Rejects "12." and "1.2.3".
export function isValidPrice(value: string) {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) return false;

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= PRICE_MAX;
}

// Canonical text form for a valid price: "12.50" -> "12.5", "0.00" -> "0".
export function normalizePrice(value: string) {
  return String(Number(value));
}

// ---------- Capacity ----------

// Whole numbers only; leading zeros removed; never truncated.
export function sanitizeCapacity(value: string) {
  return value.replace(/\D/g, '').replace(/^0+/, '');
}

export function isValidCapacity(value: string) {
  return /^[1-9]\d{0,3}$/.test(value);
}
