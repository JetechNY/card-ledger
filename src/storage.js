// Tiny async wrapper around localStorage. Keeps the same shape the app was
// written against (get -> { value } | null, set -> truthy on success), so the
// component code doesn't care where data lives. Everything stays in the
// visitor's own browser; nothing is sent anywhere.
export const storage = {
  async get(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? null : { key, value };
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch {
      return null;
    }
  },
};
