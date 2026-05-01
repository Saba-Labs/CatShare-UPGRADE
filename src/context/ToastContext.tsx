import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: ToastType, duration?: number) => string;
  updateToast: (id: string, message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const clearToastTimer = useCallback((id: string) => {
    const existing = toastTimersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      toastTimersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    clearToastTimer(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [clearToastTimer]);

  const scheduleRemoval = useCallback(
    (id: string, duration: number) => {
      clearToastTimer(id);
      if (duration > 0) {
        const timer = window.setTimeout(() => {
          removeToast(id);
        }, duration);
        toastTimersRef.current.set(id, timer);
      }
    },
    [clearToastTimer, removeToast]
  );

  const showToast = useCallback(
    (message: string, type: ToastType, duration = 4000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);
      scheduleRemoval(id, duration);
      return id;
    },
    [scheduleRemoval]
  );

  const updateToast = useCallback(
    (id: string, message: string, type: ToastType, duration?: number) => {
      setToasts((prev) => {
        let found = false;
        const next = prev.map((toast) => {
          if (toast.id !== id) return toast;
          found = true;
          return {
            ...toast,
            message,
            type,
            ...(duration !== undefined ? { duration } : {}),
          };
        });
        return found ? next : prev;
      });
      if (duration !== undefined) {
        scheduleRemoval(id, duration);
      }
    },
    [scheduleRemoval]
  );

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, updateToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
