import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'stms-theme';

/** Signal-backed light/dark mode, toggled via a `.dark-theme` class on <html> and persisted. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(this.readInitial());

  constructor() {
    this.apply(this.isDark());
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  setDark(value: boolean): void {
    this.isDark.set(value);
    this.apply(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    } catch {
      // localStorage may be unavailable (private browsing, disabled storage) — theme just won't persist.
    }
  }

  private apply(isDark: boolean): void {
    document.documentElement.classList.toggle('dark-theme', isDark);
  }

  private readInitial(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark') {
        return true;
      }
      if (stored === 'light') {
        return false;
      }
    } catch {
      // Fall through to the system preference below.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
