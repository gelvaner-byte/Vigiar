const ARC_RADII = [9, 14, 19]
const EYES = [
  { cx: 35, cy: 45, rotate: 190 },
  { cx: 65, cy: 45, rotate: 290 },
]

export default function Logo({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="white" stroke="#F97316" strokeWidth="6" />
      {EYES.map((eye) => (
        <g key={eye.cx}>
          <circle cx={eye.cx} cy={eye.cy} r="4.5" fill="#0f172a" />
          {ARC_RADII.map((r) => (
            <circle
              key={r}
              cx={eye.cx}
              cy={eye.cy}
              r={r}
              fill="none"
              stroke="#F97316"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="16.6 83.4"
              transform={`rotate(${eye.rotate} ${eye.cx} ${eye.cy})`}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}
