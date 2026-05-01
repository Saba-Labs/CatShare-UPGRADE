import React from "react";
import { useToast } from "../context/ToastContext";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <FiCheckCircle className="w-2.5 h-2.5 text-green-500" />;
      case "error":
        return <FiAlertCircle className="w-2.5 h-2.5 text-red-500" />;
      case "warning":
        return <FiAlertCircle className="w-2.5 h-2.5 text-yellow-500" />;
      case "info":
      default:
        return <FiInfo className="w-2.5 h-2.5 text-blue-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-800";
      case "error":
        return "text-red-800";
      case "warning":
        return "text-yellow-800";
      case "info":
      default:
        return "text-blue-800";
    }
  };

  return (
    <div className="fixed bottom-2 right-2 z-[200] space-y-1 max-w-[12rem]">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 36 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border ${getBgColor(
              toast.type
            )} shadow-lg`}
          >
            <div>{getIcon(toast.type)}</div>
            <div className={`flex-1 ${getTextColor(toast.type)} text-[10px] leading-tight`}>
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className={`p-0.5 hover:bg-black/10 rounded transition ${getTextColor(
                toast.type
              )}`}
            >
              <FiX className="w-2 h-2" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
