import { AnimatePresence, motion } from "motion/react";

export default function PageTransition({ screenKey, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={screenKey} className="animated-page"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
