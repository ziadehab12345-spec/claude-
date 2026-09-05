import type { ReactNode } from 'react';
import './globals.css';

/**
 * The locale layout owns <html> and <body>, because the lang and dir
 * attributes depend on the locale. This root layout exists only to satisfy
 * Next.js and to load the stylesheet.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
