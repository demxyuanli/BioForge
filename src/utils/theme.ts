export type AppTheme = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'appTheme';
const FONT_FAMILY_KEY = 'appFontFamily';
const FONT_SCALE_KEY = 'appFontScale';

export function getStoredTheme(): AppTheme {
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function applyTheme(theme: AppTheme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

let themeListener: ((e: MediaQueryListEvent) => void) | null = null;

export function setupThemeListener(): void {
  if (themeListener) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.removeEventListener('change', themeListener);
    themeListener = null;
  }
  
  const theme = getStoredTheme();
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    themeListener = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (getStoredTheme() === 'system') {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', themeListener);
    applyTheme('system');
  }
}

export const FONT_FAMILY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'system-ui', labelKey: 'settings.general.fontSystem' },
  { value: 'Segoe UI, system-ui, sans-serif', labelKey: 'settings.general.fontSegoe' },
  { value: '"Microsoft YaHei", "PingFang SC", sans-serif', labelKey: 'settings.general.fontYaHei' },
  { value: 'Consolas, "Cascadia Code", monospace', labelKey: 'settings.general.fontConsolas' },
  { value: 'Georgia, serif', labelKey: 'settings.general.fontGeorgia' },
];

export const FONT_SCALE_OPTIONS = [80, 90, 100, 110, 120, 130];

export function getStoredFontFamily(): string {
  const v = localStorage.getItem(FONT_FAMILY_KEY);
  return v || 'system-ui';
}

export function getStoredFontScale(): number {
  const v = localStorage.getItem(FONT_SCALE_KEY);
  const n = parseInt(v || '100', 10);
  return FONT_SCALE_OPTIONS.includes(n) ? n : 100;
}

export function applyFontFamily(family: string): void {
  localStorage.setItem(FONT_FAMILY_KEY, family);
  document.documentElement.style.setProperty('--app-font-family', family);
}

export function applyFontScale(percent: number): void {
  localStorage.setItem(FONT_SCALE_KEY, String(percent));
  document.documentElement.style.setProperty('--app-font-scale', String(percent / 100));
}

export function applyFontSettings(): void {
  applyFontFamily(getStoredFontFamily());
  applyFontScale(getStoredFontScale());
}
