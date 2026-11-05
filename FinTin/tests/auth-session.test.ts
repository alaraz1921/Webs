// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  authStartedKey,
  authStorage,
  authStorageKey,
  beginFinTinSignIn,
  remainingSessionMs,
  sessionLifetimeMs,
} from "../src/auth-session";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("conserva la sesión durante 12 horas sin ampliar el plazo al renovar el token", () => {
  const start = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockReturnValue(start);
  authStorage.setItem(authStorageKey, "sesión-sintética");
  expect(authStorage.getItem(authStorageKey)).toBe("sesión-sintética");
  expect(localStorage.getItem(authStartedKey)).toBe(String(start));
  vi.spyOn(Date, "now").mockReturnValue(start + 11 * 60 * 60 * 1000);
  authStorage.setItem(authStorageKey, "token-renovado-sintético");
  expect(localStorage.getItem(authStartedKey)).toBe(String(start));
  expect(remainingSessionMs()).toBe(60 * 60 * 1000);
  vi.spyOn(Date, "now").mockReturnValue(start + sessionLifetimeMs);
  expect(authStorage.getItem(authStorageKey)).toBeNull();
  expect(localStorage.getItem(authStartedKey)).toBeNull();
});

it("inicia un nuevo plazo al entrar de nuevo y no toca la sesión de TrackTin", () => {
  const otherKey = "sb-proyecto-compartido-auth-token";
  localStorage.setItem(otherKey, "otra-sesión-sintética");
  const start = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockReturnValue(start);
  authStorage.setItem(authStorageKey, "sesión-sintética");
  vi.spyOn(Date, "now").mockReturnValue(start + sessionLifetimeMs);
  beginFinTinSignIn();
  authStorage.setItem(authStorageKey, "nueva-sesión-sintética");
  expect(authStorage.getItem(authStorageKey)).toBe("nueva-sesión-sintética");
  expect(localStorage.getItem(authStartedKey)).toBe(
    String(start + sessionLifetimeMs),
  );
  authStorage.removeItem(authStorageKey);
  expect(localStorage.getItem(otherKey)).toBe("otra-sesión-sintética");
});
