// Canonical "safe to return" User projection — shared by auth, user, and
// admin-user services so there is one place that decides which User fields
// are safe to expose (never `password` or `googleId`), instead of each
// service hand-writing its own subset of the same answer. Callers that
// previously selected a narrower subset now get these extra fields too —
// all of them are already flagged safe here, so that's harmless.
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isVerified: true,
  isActive: true,
  fraudStatus: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;
