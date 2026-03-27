import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';

/**
 * Free tier: Glass theme is Pro-only. If entitlement is not Pro, force Classic.
 */
export default function GlassThemeProGate() {
  const { selectedThemeId, setTheme } = useTheme();
  const { isPro, loading } = useSubscription();

  useEffect(() => {
    if (loading) return;
    if (isPro) return;
    if (selectedThemeId !== 'glass') return;
    setTheme('classic');
  }, [loading, isPro, selectedThemeId, setTheme]);

  return null;
}
