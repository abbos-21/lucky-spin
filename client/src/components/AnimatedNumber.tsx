import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Duration in ms. Default 600. */
  duration?: number;
  /** Format function — defaults to toLocaleString */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Smoothly counts from the previous value to the new value.
 * Uses requestAnimationFrame with an ease-out curve.
 */
export default function AnimatedNumber({
  value,
  duration = 600,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: Props) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;

    if (from === to) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(to);
        prevRef.current = to;
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(displayed)}</span>;
}
