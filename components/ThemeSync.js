'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setFavicon } from '@/lib/theme';

export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setFavicon(theme);
  }, [pathname]);

  return null;
}
