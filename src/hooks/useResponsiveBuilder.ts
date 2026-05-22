import { useState, useEffect } from 'react';

interface ResponsiveBuilderState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  canEdit: boolean;
}

const MOBILE_BREAKPOINT = 768; // tablets and below
const TABLET_BREAKPOINT = 1024;

export function useResponsiveBuilder(): ResponsiveBuilderState {
  const [state, setState] = useState<ResponsiveBuilderState>({
    isMobile: typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= TABLET_BREAKPOINT : true,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    canEdit: typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT : true,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isMobile = width < MOBILE_BREAKPOINT;
      const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
      const isDesktop = width >= TABLET_BREAKPOINT;
      
      // Editing only allowed on desktop (1024px and above)
      const canEdit = isDesktop;

      setState({
        isMobile,
        isTablet,
        isDesktop,
        width,
        canEdit,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
