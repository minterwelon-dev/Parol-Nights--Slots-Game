export const STORAGE_KEYS = {
  rgs: 'parol-nights-rgs',
  progress: 'parol-nights-progress',
  muted: 'parol-nights-muted',
  /** reduced-motion choice: '1' reduced, '0' full, absent = follow the OS setting */
  motion: 'parol-nights-motion',
} as const;

export const LEGACY_STORAGE_KEYS = {
  rgs: 'ember-vault-rgs',
  progress: 'ember-vault-progress',
  muted: 'ember-vault-muted',
} as const;

type SavedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Copy raw values once, before any session or presentation state is read. */
export function migrateStorage(getStorage: () => SavedStorage = () => localStorage): void {
  for (const name of ['rgs', 'progress', 'muted'] as const) {
    try {
      const storage = getStorage();
      const oldKey = LEGACY_STORAGE_KEYS[name];
      const newKey = STORAGE_KEYS[name];
      if (storage.getItem(newKey) !== null) continue;
      const value = storage.getItem(oldKey);
      if (value === null) continue;
      storage.setItem(newKey, value);
      storage.removeItem(oldKey);
    } catch {
      // Blocked access or failed writes must not throw or delete the original value.
    }
  }
}
