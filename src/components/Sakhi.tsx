/**
 * Sakhi Didi: an original illustrated guide in the khata's own colours.
 * She blinks, breathes, waves hello, and her mouth moves while she speaks.
 */
export function Sakhi({ talking, waving = false, size = 150 }: { talking: boolean; waving?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 160 200" width={size} height={size * 1.25} className="sakhi drop-shadow-[0_8px_12px_rgba(0,0,0,.35)]" aria-hidden>
      <g className="sakhi-body">
        {/* Saree: haldi body, bahi border, pallu over the left shoulder */}
        <path d="M30 200 C30 150 48 128 80 124 C112 128 130 150 130 200 Z" fill="#E0A100" />
        <path d="M30 200 C30 150 48 128 80 124 L92 126 C70 140 58 168 56 200 Z" fill="#9E1B1F" />
        <path d="M62 200 C64 172 74 146 92 128" stroke="#F5C84B" strokeWidth="4" fill="none" />
        <path d="M100 150 L104 200 M114 156 L116 200" stroke="#C98A00" strokeWidth="2" opacity=".6" />
        {/* Blouse at the neck */}
        <path d="M66 126 C72 134 88 134 94 126 L92 122 L68 122 Z" fill="#6E1013" />
        {/* Waving arm */}
        <g className={waving ? 'sakhi-wave' : ''} style={{ transformOrigin: '118px 140px' }}>
          <path d="M116 140 C132 128 140 112 142 96" stroke="#A86B3C" strokeWidth="11" strokeLinecap="round" fill="none" />
          <circle cx="142" cy="92" r="8" fill="#A86B3C" />
          <path d="M136 106 L148 104" stroke="#E0A100" strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* Neck */}
        <rect x="72" y="100" width="16" height="24" rx="6" fill="#96592E" />
        {/* Hair bun and hair */}
        <circle cx="112" cy="52" r="16" fill="#2B1B14" />
        <circle cx="112" cy="52" r="5" fill="#F5C84B" opacity=".9" />
        <ellipse cx="80" cy="62" rx="34" ry="38" fill="#2B1B14" />
        {/* Face */}
        <ellipse cx="80" cy="70" rx="28" ry="33" fill="#A86B3C" />
        <path d="M80 30 L80 45" stroke="#4A3326" strokeWidth="2" strokeLinecap="round" />
        <path d="M51 70 C46 38 114 38 109 70 C105 56 95 46 80 45 C65 46 55 56 51 70 Z" fill="#2B1B14" />
        {/* Bindi */}
        <circle cx="80" cy="56" r="3.2" fill="#C8102E" />
        {/* Eyebrows */}
        <path d="M62 62 Q68 58 74 61 M86 61 Q92 58 98 62" stroke="#2B1B14" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {/* Eyes */}
        <g className="sakhi-eyes">
          <ellipse cx="68" cy="70" rx="3.6" ry="4.4" fill="#1A120E" />
          <ellipse cx="92" cy="70" rx="3.6" ry="4.4" fill="#1A120E" />
          <circle cx="69.2" cy="68.6" r="1.1" fill="#fff" />
          <circle cx="93.2" cy="68.6" r="1.1" fill="#fff" />
        </g>
        {/* Nose and nose stud */}
        <path d="M80 72 Q78 80 81 84" stroke="#7A4524" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="84.5" cy="82" r="1.5" fill="#F5C84B" />
        {/* Cheeks */}
        <circle cx="62" cy="82" r="5" fill="#C9734A" opacity=".45" />
        <circle cx="98" cy="82" r="5" fill="#C9734A" opacity=".45" />
        {/* Mouth: a smile, or moving while she speaks */}
        {talking ? (
          <ellipse className="sakhi-mouth" cx="80" cy="91" rx="6.5" ry="4" fill="#5A1412" />
        ) : (
          <path d="M71 89 Q80 97 89 89" stroke="#5A1412" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
        {/* Earrings */}
        <circle cx="52" cy="80" r="3.2" fill="#F5C84B" />
        <circle cx="108" cy="80" r="3.2" fill="#F5C84B" />
      </g>
    </svg>
  );
}
