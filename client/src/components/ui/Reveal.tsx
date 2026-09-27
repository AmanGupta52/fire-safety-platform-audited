import { motion } from 'framer-motion';

/**
 * Fades and slides a section up into place the first time it scrolls into view. Used to give
 * the homepage (and any other page) a sense of motion without anything ever re-animating on
 * every scroll pass — `viewport={{ once: true }}` plays it exactly once per page visit.
 *
 * `delay` is how individual items in a list (category circles, product cards) are staggered
 * relative to each other — pass `index * 0.05` or similar at the call site.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
