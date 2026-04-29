// Theme tokens for Striker's House mobile dashboard

const PALETTES = {
  coral:    { primary: '#FF3D2E', primarySoft: 'rgba(255,61,46,0.14)', primaryGlow: 'rgba(255,61,46,0.45)', name: 'Coral' },
  electric: { primary: '#00E5A0', primarySoft: 'rgba(0,229,160,0.14)', primaryGlow: 'rgba(0,229,160,0.45)', name: 'Electric' },
  amber:    { primary: '#FFB627', primarySoft: 'rgba(255,182,39,0.14)', primaryGlow: 'rgba(255,182,39,0.45)', name: 'Amber' },
  cobalt:   { primary: '#3D7DFF', primarySoft: 'rgba(61,125,255,0.14)', primaryGlow: 'rgba(61,125,255,0.45)', name: 'Cobalt' },
  magenta:  { primary: '#FF2E88', primarySoft: 'rgba(255,46,136,0.14)', primaryGlow: 'rgba(255,46,136,0.45)', name: 'Magenta' },
};

const TONES = {
  coral:    '#FF3D2E',
  amber:    '#FFB627',
  lime:     '#A6E22E',
  electric: '#00E5A0',
  magenta:  '#FF2E88',
  blue:     '#3D7DFF',
  mint:     '#27D9A8',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #07070a; color: #fff;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased; }
  button { font-family: inherit; }

  .num   { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; letter-spacing: -0.01em; line-height: 0.9; }
  .head  { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  .mono  { font-family: 'JetBrains Mono', monospace; }

  .scrollbox { overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .scrollbox::-webkit-scrollbar { width: 0; height: 0; }

  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
    50%      { box-shadow: 0 0 0 6px rgba(0,0,0,0); opacity: 0.6; }
  }
  .pulse-dot { animation: pulseGlow 1.8s ease-in-out infinite; }

  @keyframes sheetIn {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  .sheet-anim { animation: sheetIn .28s cubic-bezier(.2,.9,.3,1.1); }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .fade-in { animation: fadeIn .2s ease-out; }

  @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .bar-grow { transform-origin: left; animation: barGrow .8s cubic-bezier(.2,.8,.3,1) both; }

  /* tap feedback */
  .tap { transition: transform .12s ease, background .15s ease; }
  .tap:active { transform: scale(0.98); }
`;

Object.assign(window, { PALETTES, TONES, GLOBAL_CSS });
