'use client';

interface Props {
  canvasMode: boolean;
}

export function ImagineBackground({ canvasMode }: Props) {
  return (
    <div className="absolute inset-0 z-0">
      {/* Sage/muted-green desktop background — matches Claude Imagine */}
      <div
        className="absolute inset-0 transition-opacity duration-400 ease-in-out"
        style={{
          backgroundColor: '#BDC6BB',
          opacity: canvasMode ? 1 : 0,
        }}
      />

      {/* Dark gradient for chat mode */}
      <div
        className="absolute inset-0 transition-opacity duration-400 ease-in-out"
        style={{
          background: 'linear-gradient(180deg, #0d0d1a 0%, #151525 40%, #1a1a2e 100%)',
          opacity: canvasMode ? 0 : 1,
        }}
      />

      {/* Contour / topographic curves */}
      <svg
        className="absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out pointer-events-none"
        style={{ opacity: canvasMode ? 1 : 0 }}
        preserveAspectRatio="none"
        viewBox="0 0 1280 800"
      >
        <path d="M-20,120 C384,40 896,360 1300,280" stroke="rgba(255,255,255,0.30)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,240 C384,440 896,120 1300,400" stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,440 C384,280 896,600 1300,480" stroke="rgba(255,255,255,0.30)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,560 C384,680 896,440 1300,640" stroke="rgba(255,255,255,0.22)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,40 C384,160 896,-40 1300,96" stroke="rgba(255,255,255,0.20)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,360 C384,520 896,240 1300,440" stroke="rgba(255,255,255,0.28)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,680 C384,560 896,760 1300,720" stroke="rgba(255,255,255,0.22)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-20,180 C500,280 780,80 1300,180" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M-20,520 C300,420 900,620 1300,540" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
