import { motion } from 'framer-motion';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <motion.button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      <motion.div
        className="h-5 w-5 bg-white rounded-full shadow-md"
        animate={checked ? { x: 20 } : { x: 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      />
    </motion.button>
  );
}
