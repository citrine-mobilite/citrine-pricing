import React from 'react';

interface HeroLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const HeroLogo: React.FC<HeroLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true
}) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-14'
  };

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg
        viewBox="0 0 280 120"
        className={`${sizeClasses[size]} w-auto`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Letter H */}
        <path
          d="M20 35 C15 35 12 37 10 40 L10 75 C10 82 14 85 22 85 C30 85 34 82 34 75 L34 62 L48 62 L48 75 C48 82 52 85 60 85 C68 85 72 82 72 75 L72 40 C70 37 67 35 60 35 C53 35 48 38 48 45 L48 53 L34 53 L34 45 C34 38 29 35 20 35 Z"
          fill="#2A7B76"
        />
        {/* Letter E */}
        <path
          d="M85 36 C77 36 73 40 73 48 L73 73 C73 81 77 85 86 85 C95 85 106 82 110 78 L108 70 C104 74 97 76 91 76 C86 76 84 73 84 66 L84 63 L104 63 L104 56 L84 56 L84 45 C84 40 87 38 92 38 C97 38 102 40 106 43 L109 36 C104 33 94 36 85 36 Z"
          fill="#2A7B76"
        />
        {/* Letter R */}
        <path
          d="M120 36 C114 36 110 39 110 46 L110 75 C110 82 114 85 122 85 C129 85 133 82 133 75 L133 63 L140 63 C145 63 148 66 150 71 L154 80 C157 85 162 86 168 85 L168 82 C163 80 160 76 157 70 L153 61 C158 59 164 54 164 47 C164 39 157 36 142 36 L120 36 Z M133 44 C133 41 136 40 141 40 C146 40 149 42 149 47 C149 52 145 55 140 55 L133 55 L133 44 Z"
          fill="#2A7B76"
        />
        {/* Letter O (Compass/Steering wheel) */}
        <g transform="translate(190, 60)">
          {/* Outer thick teal circle */}
          <circle cx="0" cy="0" r="28" stroke="#2A7B76" strokeWidth="4" fill="none" />
          {/* Inner thin teal circle */}
          <circle cx="0" cy="0" r="23" stroke="#2A7B76" strokeWidth="1.5" fill="none" />
          {/* Gold crosshairs */}
          <line x1="-23" y1="0" x2="23" y2="0" stroke="#D4A82F" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="-23" x2="0" y2="23" stroke="#D4A82F" strokeWidth="2" strokeLinecap="round" />
          {/* Center gold ring and dot */}
          <circle cx="0" cy="0" r="4.5" fill="#2A7B76" stroke="#D4A82F" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="2" fill="#D4A82F" />
        </g>
        {/* Subtitle Cab in gold italics */}
        {showSubtitle && (
          <text
            x="200"
            y="108"
            fontFamily="'Playfair Display', 'Georgia', serif"
            fontSize="22"
            fontStyle="italic"
            fontWeight="bold"
            fill="#D4A82F"
            letterSpacing="2"
          >
            Cab
          </text>
        )}
      </svg>
    </div>
  );
};
