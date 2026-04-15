import { useRef, useState, useEffect } from 'react';
import { CONFIG } from '../config/constants';

// Visual colors per segment (matches segment order in CONFIG.SPIN_SEGMENTS)
const SEGMENT_COLORS = [
  '#FB923C', // 25 coins  — orange
  '#FBBF24', // 50 coins  — yellow
  '#F97316', // 100 coins — deep orange
  '#F59E0B', // 250 coins — amber
  '#A855F7', // Ticket    — purple
  '#22C55E', // Common    — green
  '#3B82F6', // Rare      — blue
  '#EF4444', // Jackpot   — red
];

const SEGMENT_ICONS = ['🪙', '🪙', '🪙', '🪙', '🎫', '🟢', '💎', '🌟'];

const NUM_SEGMENTS = CONFIG.SPIN_SEGMENTS.length; // 8
const SEGMENT_DEG = 360 / NUM_SEGMENTS;           // 45°

interface Props {
  spinning: boolean;
  targetSegment: number | null;
  onSpinEnd: () => void;
  disabled?: boolean;
}

export default function SpinWheel({ spinning, targetSegment, onSpinEnd }: Props) {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevTargetRef = useRef<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spinning || targetSegment === null) return;
    if (targetSegment === prevTargetRef.current && isAnimating) return;
    prevTargetRef.current = targetSegment;

    setIsAnimating(true);

    // Formula: spin 5 full rotations + align target segment to top pointer
    // Segment i center is at i*45° clockwise from top initially.
    // After rotation R, segment i is at (i*45 + R) % 360.
    // We want that to equal 0 (top) → R = N*360 - i*45
    const base = 360 * 5;
    const align = (360 - targetSegment * SEGMENT_DEG) % 360;
    const targetRotation = rotation + base + align;

    setRotation(targetRotation);
  }, [spinning, targetSegment]);

  function handleTransitionEnd() {
    if (!isAnimating) return;
    setIsAnimating(false);

    // Show confetti for rare / jackpot wins
    const seg = CONFIG.SPIN_SEGMENTS[targetSegment ?? 0];
    if (seg?.type === 'jackpot' || (seg?.type === 'collectible' && seg?.value === 'rare')) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    onSpinEnd();
  }

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Confetti burst */}
      {showConfetti && <ConfettiBurst />}

      {/* Pointer (fixed at top) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '20px solid #1f2937',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
          }}
        />
      </div>

      {/* Wheel container */}
      <div className="relative w-72 h-72">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full bg-gray-800 shadow-2xl" style={{ padding: 4 }}>
          {/* Spinning wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isAnimating
                ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                : 'none',
              willChange: 'transform',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {/* SVG wheel */}
            <WheelSVG />
          </div>
        </div>

        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white shadow-lg border-4 border-gray-800 flex items-center justify-center">
            <span className="text-xl">🎰</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// SVG-based wheel drawing — crisp at any size
function WheelSVG() {
  const SIZE = 264; // matches w-72 = 288px minus 12px for padding × 2
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2;
  const innerR = 28; // hub radius

  const segments = CONFIG.SPIN_SEGMENTS.map((seg, i) => {
    const startAngle = i * SEGMENT_DEG - 90; // start from top (−90°)
    const endAngle = startAngle + SEGMENT_DEG;
    const { x: x1, y: y1 } = polar(cx, cy, r, startAngle);
    const { x: x2, y: y2 } = polar(cx, cy, r, endAngle);
    const { x: hx1, y: hy1 } = polar(cx, cy, innerR, startAngle);
    const { x: hx2, y: hy2 } = polar(cx, cy, innerR, endAngle);

    // Text position: mid-angle, 60% radius
    const midAngle = startAngle + SEGMENT_DEG / 2;
    const textR = r * 0.62;
    const { x: tx, y: ty } = polar(cx, cy, textR, midAngle);

    // Icon position: 78% radius
    const iconR = r * 0.82;
    const { x: ix, y: iy } = polar(cx, cy, iconR, midAngle);

    const pathD = [
      `M ${hx1} ${hy1}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 0 1 ${x2} ${y2}`,
      `L ${hx2} ${hy2}`,
      `A ${innerR} ${innerR} 0 0 0 ${hx1} ${hy1}`,
      'Z',
    ].join(' ');

    return { seg, i, pathD, tx, ty, ix, iy, midAngle, color: SEGMENT_COLORS[i], icon: SEGMENT_ICONS[i] };
  });

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {segments.map(({ seg, i, pathD, tx, ty, ix, iy, midAngle, color }) => (
        <g key={i}>
          <path d={pathD} fill={color} stroke="white" strokeWidth="1.5" />
          {/* Label text */}
          <text
            x={tx}
            y={ty}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="9"
            fontWeight="700"
            fontFamily="-apple-system, sans-serif"
            transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
          >
            {seg.label}
          </text>
          {/* Emoji icon */}
          <text
            x={ix}
            y={iy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            transform={`rotate(${midAngle + 90}, ${ix}, ${iy})`}
          >
            {SEGMENT_ICONS[i]}
          </text>
        </g>
      ))}

      {/* Divider lines */}
      {segments.map(({ i }) => {
        const angle = i * SEGMENT_DEG - 90;
        const { x: ox, y: oy } = polar(cx, cy, r, angle);
        const { x: hx, y: hy } = polar(cx, cy, innerR, angle);
        return <line key={`line-${i}`} x1={hx} y1={hy} x2={ox} y2={oy} stroke="white" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Simple CSS confetti burst using random positioned divs
function ConfettiBurst() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    color: ['#F97316', '#FBBF24', '#A855F7', '#3B82F6', '#22C55E', '#EF4444'][Math.floor(Math.random() * 6)],
    size: 6 + Math.random() * 8,
    duration: 1 + Math.random() * 2,
    delay: Math.random() * 0.5,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-full">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size / 2,
            background: p.color,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
