// Single source for the client-side admin check.
//
// This only controls what the app shows. It is NOT a security boundary: the
// backend must enforce admin-only access on its own routes.

export const ADMIN_EMAIL = 'nayakmanav04@gmail.com';

// Exact, case-sensitive match - identical to the original check in
// ProfileScreen (`session?.user?.email === ADMIN_EMAIL`).
export function isAdminEmail(email?: string | null) {
  return email === ADMIN_EMAIL;
}
