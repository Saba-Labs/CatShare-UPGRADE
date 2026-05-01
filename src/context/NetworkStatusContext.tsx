import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type NetworkStatusValue = { isOnline: boolean };

const NetworkStatusContext = createContext<NetworkStatusValue>({
  isOnline: true,
});

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ isOnline }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusValue {
  return useContext(NetworkStatusContext);
}
