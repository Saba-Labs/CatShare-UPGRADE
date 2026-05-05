import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import { useToast } from '../context/ToastContext';
import {
  cloudWriteBlockedMessage,
  cloudWriteWouldBeBlocked,
  OFFLINE_CLOUD_WRITE_TOAST,
} from '../utils/cloudWritePolicy';

/**
 * For logged-in cloud users: block mutations while offline (view-only).
 * Guests / anonymous local mode are unchanged.
 */
export function useCloudWriteGate() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { showToast } = useToast();

  const blocked = cloudWriteWouldBeBlocked(user, isOnline);

  const guardCloudWrite = (): boolean => {
    if (!blocked) return true;
    showToast(cloudWriteBlockedMessage(user, isOnline), 'error');
    return false;
  };

  /** Blocks when offline for anyone (e.g. place order, API calls). */
  const guardOnline = (): boolean => {
    if (isOnline) return true;
    showToast(OFFLINE_CLOUD_WRITE_TOAST, 'error');
    return false;
  };

  return { isOnline, blocked, guardCloudWrite, guardOnline };
}
