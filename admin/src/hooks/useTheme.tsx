import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('admin-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Track whether the user has manually toggled (vs OS default)
  const [userSet, setUserSet] = useState(() => localStorage.getItem('admin-theme') !== null);

  // Listen for OS theme changes — only sync when user hasn't manually toggled
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!userSet) {
        setDark(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [userSet]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('admin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  function toggle() {
    setUserSet(true);
    setDark((prev) => !prev);
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
