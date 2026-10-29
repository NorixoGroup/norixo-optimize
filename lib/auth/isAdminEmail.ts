export function getAdminPrivateEmails() {
  return ((process.env.ADMIN_EMAILS ?? "").trim() || (process.env.NORIXO_ADMIN_EMAILS ?? "").trim())
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminPrivateEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminPrivateEmails().includes(email.trim().toLowerCase());
}

type AdminUserLike = {
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

// Private admin access requires an allow-listed AND confirmed e-mail identity.
export function isAdminPrivateUser(user: AdminUserLike | null | undefined) {
  if (!user) return false;
  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at;
  return Boolean(confirmedAt) && isAdminPrivateEmail(user.email);
}
