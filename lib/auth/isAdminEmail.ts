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
