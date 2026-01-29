import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0.0 to 1.0 representing audio level
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;

    const draw = () => {
      if (!ctx || !canvas) return;

      // Clear with trail effect
      ctx.fillStyle = 'rgba(2, 6, 23, 0.2)'; // fade out
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base radius plus volume reaction
      // If inactive, pulse gently. If active, react to volume.
      const baseRadius = 60;
      const pulse = isActive ? (volume * 50) : (Math.sin(Date.now() / 500) * 5);
      const radius = baseRadius + pulse;

      // Draw Main Orb
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? '#22d3ee' : '#1e293b'; // Cyan if active, Slate if idle
      ctx.lineWidth = 2;
      ctx.shadowBlur = isActive ? 20 : 0;
      ctx.shadowColor = '#22d3ee';
      ctx.stroke();

      // Draw Inner Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? `rgba(34, 211, 238, ${0.1 + volume})` : 'rgba(30, 41, 59, 0.3)';
      ctx.fill();

      // Draw Rotating Rings (Sci-fi effect)
      if (isActive) {
        rotation += 0.02 + (volume * 0.1);
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        
        // Ring 1
        ctx.beginPath();
        ctx.arc(0, 0, radius + 20, 0, Math.PI * 1.5);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ring 2 (Opposite)
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 10, 0, Math.PI);
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, volume]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
        <canvas 
            ref={canvasRef} 
            width={400} 
            height={400}
            className="w-[300px] h-[300px] md:w-[400px] md:h-[400px]"
        />
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-cyan-400 font-mono text-xs tracking-[0.2em] transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
            AURA.SYS
        </div>
    </div>
  );
};

export default Visualizer;