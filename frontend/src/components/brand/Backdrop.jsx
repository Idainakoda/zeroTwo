/**
 * "The gateway at night": a luminous arch over the horizon - the gateway every prompt passes
 * through - with a quiet lattice of network nodes reflected in the dark water below.
 * Pure SVG, so it is sharp at any size and needs no network at the venue.
 */
export default function Backdrop({ intensity = 1 }) {
  // Deterministic node positions (no randomness between renders)
  const nodes = [
    [120, 690], [260, 640], [410, 700], [560, 655], [700, 715], [860, 668], [1010, 705],
    [1160, 650], [1300, 700], [1450, 660], [190, 760], [480, 770], [790, 790], [1090, 770],
    [1380, 785], [330, 830], [640, 850], [960, 840], [1250, 850],
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [0, 10], [10, 11],
    [11, 12], [12, 13], [13, 14], [2, 11], [5, 12], [7, 13], [9, 14], [10, 15], [15, 16], [16, 17],
    [17, 18], [11, 16], [13, 17], [14, 18],
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night">
      <svg className="h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="zt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050817" />
            <stop offset="0.55" stopColor="#0b1336" />
            <stop offset="0.68" stopColor="#1a1f55" />
            <stop offset="0.7" stopColor="#0a0f2a" />
            <stop offset="1" stopColor="#04060f" />
          </linearGradient>
          <radialGradient id="zt-glow" cx="0.62" cy="0.66" r="0.55">
            <stop offset="0" stopColor="#5b6cff" stopOpacity={0.42 * intensity} />
            <stop offset="0.45" stopColor="#7c3aed" stopOpacity={0.14 * intensity} />
            <stop offset="1" stopColor="#05081a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="zt-arch" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="0.3" stopColor="#7dd3fc" stopOpacity="0.9" />
            <stop offset="0.62" stopColor="#a5b4fc" stopOpacity="1" />
            <stop offset="0.85" stopColor="#c084fc" stopOpacity="0.85" />
            <stop offset="1" stopColor="#c084fc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="zt-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6d7cff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#6d7cff" stopOpacity="0" />
          </linearGradient>
          <filter id="zt-blur-lg" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="zt-blur-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <rect width="1600" height="1000" fill="url(#zt-sky)" />
        <rect width="1600" height="1000" fill="url(#zt-glow)" />

        {/* Stars */}
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={i} cx={(i * 97) % 1600} cy={(i * 53) % 520} r={i % 7 === 0 ? 1.4 : 0.8}
                  fill="#c7d2fe" opacity={0.15 + ((i * 13) % 10) / 30} />
        ))}

        {/* The gateway: a luminous arch rising from the horizon */}
        <g opacity={0.95 * intensity}>
          <path d="M 560 690 A 470 470 0 0 1 1500 690" fill="none" stroke="url(#zt-arch)"
                strokeWidth="30" filter="url(#zt-blur-lg)" />
          <path d="M 560 690 A 470 470 0 0 1 1500 690" fill="none" stroke="url(#zt-arch)" strokeWidth="3" />
          <path d="M 640 690 A 390 390 0 0 1 1420 690" fill="none" stroke="#a5b4fc"
                strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 10" />
        </g>

        {/* Horizon line of light */}
        <rect x="0" y="688" width="1600" height="3" fill="#a5b4fc" opacity="0.35" filter="url(#zt-blur-sm)" />

        {/* Reflection of the arch on the water */}
        <ellipse cx="1030" cy="700" rx="420" ry="26" fill="url(#zt-water)" filter="url(#zt-blur-lg)" />

        {/* Network lattice below the horizon */}
        <g opacity={0.55 * intensity}>
          {links.map(([a, b], i) => (
            <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
                  stroke="#818cf8" strokeOpacity="0.22" strokeWidth="1" />
          ))}
          {nodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 2.6 : 1.8} fill="#a5b4fc"
                    opacity={i % 4 === 0 ? 0.9 : 0.55} />
          ))}
        </g>
      </svg>
      {/* Gentle vignette so text on the left stays readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,rgba(6,10,26,0.55),transparent_60%)]" />
    </div>
  );
}
