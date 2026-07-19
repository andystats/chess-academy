import { useEffect, useRef } from 'react';

export default function CelebrationOverlay({ onNewGame, reason }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Resize canvas to match its container (which is the BoardPanel container)
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = [
      '#f59e0b', // Gold
      '#10b981', // Emerald
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#f43f5e', // Rose
      '#06b6d4', // Cyan
    ];

    const particles = [];
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * (canvas.width / window.devicePixelRatio),
        y: Math.random() * -100 - 10,
        size: Math.random() * 6 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: Math.random() * 4 - 2,
        speedY: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      let active = false;
      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y / 20) * 0.5;
        p.rotation += p.rotationSpeed;

        if (p.y > h) {
          // Reset particle to top
          p.y = -20;
          p.x = Math.random() * w;
          p.speedY = Math.random() * 3 + 2;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        active = true;
      }

      if (active) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 p-4 animate-fade-in backdrop-blur-[2px]">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />
      
      <div className="relative z-10 max-w-sm w-full border-3 border-foreground bg-white p-6 text-center shadow-hard-brand animate-scale-up">
        {/* Decorative Gold Trophy Icon */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-3 border-foreground bg-amber-100 text-amber-500 shadow-hard-sm">
          <svg className="h-8 w-8 animate-bounce text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </div>

        <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-brand-600 drop-shadow-sm">
          Victory!
        </h2>
        
        <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-gray-400">
          {reason ? `Won by ${reason}` : 'You won the game!'}
        </p>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          A magnificent performance! You successfully outmaneuvered the opponent and secured the win.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {onNewGame && (
            <button
              type="button"
              onClick={onNewGame}
              className="tao-btn-primary w-full py-2.5 text-sm"
            >
              Play again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}