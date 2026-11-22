/**
 * HalloweenDecor — fixed-position spooky props injected site-wide.
 * Client component so it can use browser APIs (window.innerWidth etc.)
 * and avoid SSR hydration mismatches on random positioning.
 */
"use client";

export default function HalloweenDecor() {
  return (
    <>
      {/* ── Full moon ──────────────────────────────────────────────────── */}
      <div className="moon" aria-hidden="true">🌕</div>

      {/* ── Corner spider webs (SVG) ───────────────────────────────────── */}
      {/* Top-left */}
      <svg
        className="spider-web-tl"
        width="180" height="180"
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Radial spokes from top-left corner */}
        {[0, 15, 30, 45, 60, 75, 90].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1="0" y1="0"
              x2={Math.cos(rad) * 175}
              y2={Math.sin(rad) * 175}
              stroke="white" strokeWidth="0.8" strokeOpacity="0.7"
            />
          );
        })}
        {/* Concentric arcs */}
        {[30, 60, 90, 120, 150].map((r) => (
          <path
            key={r}
            d={`M ${Math.cos(0) * r},${Math.sin(0) * r}
                ${[15,30,45,60,75,90].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return `L ${Math.cos(rad) * r},${Math.sin(rad) * r}`;
                }).join(' ')}`}
            stroke="white" strokeWidth="0.6" strokeOpacity="0.55" fill="none"
          />
        ))}
        {/* Spider body */}
        <ellipse cx="118" cy="118" rx="6" ry="4" fill="white" opacity="0.7" />
        <ellipse cx="118" cy="112" rx="4" ry="3" fill="white" opacity="0.7" />
        {/* Spider legs */}
        {[-30,-15,0,15].map((a, i) => {
          const rad1 = ((a - 90) * Math.PI) / 180;
          const rad2 = ((a + 180 - 90) * Math.PI) / 180;
          return (
            <g key={i}>
              <line x1="118" y1="118" x2={118 + Math.cos(rad1)*14} y2={118 + Math.sin(rad1)*14}
                stroke="white" strokeWidth="0.8" opacity="0.65" />
              <line x1="118" y1="118" x2={118 + Math.cos(rad2)*14} y2={118 + Math.sin(rad2)*14}
                stroke="white" strokeWidth="0.8" opacity="0.65" />
            </g>
          );
        })}
        {/* Silk thread from corner down to spider */}
        <line x1="0" y1="0" x2="118" y2="112" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"
          strokeDasharray="4 3" />
      </svg>

      {/* Top-right (mirrored via CSS scaleX(-1)) */}
      <svg
        className="spider-web-tr"
        width="180" height="180"
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {[0, 15, 30, 45, 60, 75, 90].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={deg} x1="0" y1="0"
              x2={Math.cos(rad) * 175} y2={Math.sin(rad) * 175}
              stroke="white" strokeWidth="0.8" strokeOpacity="0.7"
            />
          );
        })}
        {[30, 60, 90, 120, 150].map((r) => (
          <path key={r}
            d={`M ${Math.cos(0) * r},${Math.sin(0) * r} ${[15,30,45,60,75,90].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return `L ${Math.cos(rad) * r},${Math.sin(rad) * r}`;
            }).join(' ')}`}
            stroke="white" strokeWidth="0.6" strokeOpacity="0.55" fill="none"
          />
        ))}
        <ellipse cx="118" cy="118" rx="6" ry="4" fill="white" opacity="0.7" />
        <ellipse cx="118" cy="112" rx="4" ry="3" fill="white" opacity="0.7" />
        {[-30,-15,0,15].map((a, i) => {
          const rad1 = ((a - 90) * Math.PI) / 180;
          const rad2 = ((a + 180 - 90) * Math.PI) / 180;
          return (
            <g key={i}>
              <line x1="118" y1="118" x2={118 + Math.cos(rad1)*14} y2={118 + Math.sin(rad1)*14}
                stroke="white" strokeWidth="0.8" opacity="0.65" />
              <line x1="118" y1="118" x2={118 + Math.cos(rad2)*14} y2={118 + Math.sin(rad2)*14}
                stroke="white" strokeWidth="0.8" opacity="0.65" />
            </g>
          );
        })}
        <line x1="0" y1="0" x2="118" y2="112" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"
          strokeDasharray="4 3" />
      </svg>

      {/* ── Bats ──────────────────────────────────────────────────────── */}
      <div className="bat" aria-hidden="true">🦇</div>
      <div className="bat" aria-hidden="true">🦇</div>
      <div className="bat" aria-hidden="true">🦇</div>
      <div className="bat" aria-hidden="true">🦇</div>

      {/* ── Ghosts ────────────────────────────────────────────────────── */}
      <div className="ghost" aria-hidden="true">👻</div>
      <div className="ghost" aria-hidden="true">👻</div>

      {/* ── Pumpkins ──────────────────────────────────────────────────── */}
      <div className="pumpkin pumpkin-left"  aria-hidden="true">🎃</div>
      <div className="pumpkin pumpkin-right" aria-hidden="true">🎃</div>

      {/* ── Candles ───────────────────────────────────────────────────── */}
      <div className="candle candle-left"  aria-hidden="true">🕯️</div>
      <div className="candle candle-right" aria-hidden="true">🕯️</div>

      {/* ── Skulls rising from the ground ─────────────────────────────── */}
      <div className="skull-rise" aria-hidden="true">💀</div>
      <div className="skull-rise" aria-hidden="true">💀</div>
      <div className="skull-rise" aria-hidden="true">💀</div>
      <div className="skull-rise" aria-hidden="true">💀</div>
    </>
  );
}
