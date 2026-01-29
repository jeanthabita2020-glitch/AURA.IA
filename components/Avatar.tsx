import React, { useEffect, useState } from 'react';

interface AvatarProps {
  isActive: boolean;
  isSleeping: boolean;
  volume: number; // 0 to 1
  isSpeaking: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ isActive, isSleeping, volume, isSpeaking }) => {
  // Eye movement logic (random subtle movements to look alive)
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isSleeping) return;
    
    const interval = setInterval(() => {
      // Random position between -2 and 2
      const x = (Math.random() - 0.5) * 4;
      const y = (Math.random() - 0.5) * 2;
      setPupilPos({ x, y });
    }, 2000);

    return () => clearInterval(interval);
  }, [isSleeping]);

  // Color Palette
  const skinColor = isActive ? '#06b6d4' : '#334155'; // Cyan or Slate
  const eyeColor = isActive ? '#22d3ee' : '#64748b';
  const glowColor = isActive ? '#67e8f9' : 'transparent';

  // Dynamic Mouth Geometry
  // We use a Quadratic Bezier curve: M startX,startY Q controlX,controlY endX,endY
  // The controlY drops down based on volume to open the mouth
  const mouthWidth = 20;
  const mouthBaseY = 145;
  const mouthOpenAmount = isSpeaking ? Math.min(25, volume * 80) : 0; 
  
  // Create a smile curve when closed, or an open oval when speaking
  const mouthPath = isSpeaking 
    ? `M 90,${mouthBaseY} Q 100,${mouthBaseY + mouthOpenAmount} 110,${mouthBaseY} Q 100,${mouthBaseY - (mouthOpenAmount * 0.2)} 90,${mouthBaseY}` // Open mouth shape
    : `M 90,${mouthBaseY} Q 100,${mouthBaseY + 3} 110,${mouthBaseY}`; // Slight smile

  // Eyebrow offset (raise them when talking or active)
  const eyebrowY = isSpeaking ? -3 : 0;

  return (
    <div className={`relative w-48 h-48 md:w-64 md:h-64 transition-all duration-500 ${isSleeping ? 'opacity-50 grayscale blur-sm' : 'opacity-100'} animate-float`}>
      
      {/* Background Aura Glow */}
      <div 
        className="absolute inset-0 rounded-full blur-3xl transition-opacity duration-300"
        style={{ 
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, 
            opacity: isSpeaking ? 0.4 : 0.1 
        }}
      ></div>

      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
        
        {/* HAIR (Back) */}
        <defs>
            <linearGradient id="cyberGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#020617" />
            </linearGradient>
        </defs>
        <path d="M50,80 Q30,150 20,180 M150,80 Q170,150 180,180" stroke="#0e7490" strokeWidth="2" fill="none" opacity="0.6" />

        {/* HEADPHONES (Band) */}
        <path d="M35,100 C35,30 165,30 165,100" fill="none" stroke="#0f172a" strokeWidth="14" strokeLinecap="round" />
        <path d="M35,100 C35,30 165,30 165,100" fill="none" stroke={skinColor} strokeWidth="3" strokeLinecap="round" />

        {/* FACE OUTLINE (Cyber-Chin) */}
        <path d="M55,90 Q55,165 100,185 Q145,165 145,90 Q145,45 100,45 Q55,45 55,90" fill="#020617" stroke={skinColor} strokeWidth="1.5" opacity="0.95" />

        {/* EYES CONTAINER */}
        <g transform="translate(0, 10)">
            {isSleeping ? (
                // SLEEPING EYES (Closed Lines)
                <g stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" fill="none">
                    <path d="M70,105 Q80,110 90,105" />
                    <path d="M110,105 Q120,110 130,105" />
                </g>
            ) : (
                // ACTIVE EYES
                <g className="origin-center animate-blink">
                    {/* Eyebrows (Expressive) */}
                    <path d={`M68,${95 + eyebrowY} Q80,${92 + eyebrowY} 92,${95 + eyebrowY}`} fill="none" stroke={skinColor} strokeWidth="1.5" opacity="0.8" />
                    <path d={`M108,${95 + eyebrowY} Q120,${92 + eyebrowY} 132,${95 + eyebrowY}`} fill="none" stroke={skinColor} strokeWidth="1.5" opacity="0.8" />

                    {/* Sclera/Eye Shape */}
                    <path d="M70,105 Q80,95 90,105 Q80,115 70,105" fill="#0f172a" stroke={eyeColor} strokeWidth="1" />
                    <path d="M110,105 Q120,95 130,105 Q120,115 110,105" fill="#0f172a" stroke={eyeColor} strokeWidth="1" />

                    {/* Pupils (Moving) */}
                    <g style={{ transform: `translate(${pupilPos.x}px, ${pupilPos.y}px)`, transition: 'transform 0.5s ease-out' }}>
                        <circle cx="80" cy="105" r="3.5" fill={eyeColor} />
                        <circle cx="120" cy="105" r="3.5" fill={eyeColor} />
                        {/* Eye Highlights */}
                        <circle cx="81.5" cy="103.5" r="1.5" fill="white" opacity="0.9" />
                        <circle cx="121.5" cy="103.5" r="1.5" fill="white" opacity="0.9" />
                    </g>
                </g>
            )}
        </g>

        {/* MOUTH (Dynamic Lip Sync) */}
        <path 
            d={mouthPath} 
            fill={isSpeaking ? eyeColor : 'none'} 
            stroke={eyeColor} 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transition-all duration-75 ease-linear" // Fast transition for lip sync
        />

        {/* HEADPHONES (Cups) */}
        <rect x="25" y="85" width="20" height="45" rx="6" fill="#0f172a" stroke={skinColor} strokeWidth="1.5" />
        <rect x="155" y="85" width="20" height="45" rx="6" fill="#0f172a" stroke={skinColor} strokeWidth="1.5" />
        
        {/* Headphone Lights */}
        <circle cx="35" cy="108" r="4" fill={isActive ? eyeColor : '#334155'} className="animate-pulse" />
        <circle cx="165" cy="108" r="4" fill={isActive ? eyeColor : '#334155'} className="animate-pulse" />

        {/* Hologram Scanlines */}
        <path d="M0,0 L200,0" stroke="url(#cyberGradient)" strokeWidth="200" opacity="0.1" style={{ mixBlendMode: 'overlay' }} />

      </svg>
    </div>
  );
};

export default Avatar;