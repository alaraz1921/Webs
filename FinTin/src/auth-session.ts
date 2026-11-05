export const authStorageKey = "fintin.auth.session";
export const authStartedKey = "fintin.auth.started-at";
export const sessionLifetimeMs = 12 * 60 * 60 * 1000;

const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function remove(key: string) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // El almacenamiento bloqueado solo permite la sesión en memoria.
  }
}

export function remainingSessionMs(now = Date.now()): number {
  const started = Number(read(authStartedKey));
  if (!Number.isSafeInteger(started) || started <= 0 || now < started) return 0;
  return Math.max(0, sessionLifetimeMs - (now - started));
}

export function clearFinTinSession() {
  remove(authStorageKey);
  remove(authStartedKey);
}

export function beginFinTinSignIn() {
  clearFinTinSession();
}

export function ensureSessionStart(now = Date.now()) {
  if (!read(authStartedKey)) write(authStartedKey, String(now));
}

export const authStorage = {
  getItem(key: string) {
    if (key === authStorageKey && remainingSessionMs() === 0) {
      clearFinTinSession();
      return null;
    }
    return read(key);
  },
  setItem(key: string, value: string) {
    if (key === authStorageKey) {
      const started = read(authStartedKey);
      if (started && remainingSessionMs() === 0) {
        clearFinTinSession();
        return;
      }
      ensureSessionStart();
    }
    write(key, value);
  },
  removeItem(key: string) {
    if (key === authStorageKey) clearFinTinSession();
    else remove(key);
  },
};
