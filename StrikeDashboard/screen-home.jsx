// Home screen — KPI grid + actions list

function KPICard({ kpi, onClick, density }) {
  const tone = TONES[kpi.accent] || TONES.coral;
  const pad = density === 'compact' ? 12 : 14;
  const numSize = density === 'compact' ? 32 : 36;
  return (
    <button onClick={onClick} style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 16, padding: pad,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      gap: 10, cursor: 'pointer', textAlign: 'left',
      color: '#fff', fontFamily: 'inherit',
      position: 'relative', overflow: 'hidden',
      minHeight: density === 'compact' ? 116 : 130,
    }} className="tap">
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 80, height: 80,
        borderRadius: '50%', background: tone, opacity: 0.07, filter: 'blur(8px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${tone}22`, display: 'grid', placeItems: 'center',
        }}>
          <Icon name={kpiIcon(kpi.id)} size={14} stroke={tone} strokeWidth={2.2} />
        </div>
        <TrendChip dir={kpi.trendDir} value={kpi.trend} />
      </div>
      <div>
        <div className="num" style={{ fontSize: numSize, color: '#fff', marginBottom: 4 }}>
          {kpi.value}
        </div>
        <div style={{ fontSize: 10, color: MUTE_STRONG, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 2 }}>
          {kpi.label}
        </div>
        <div style={{ fontSize: 10, color: MUTE, lineHeight: 1.3 }}>{kpi.sub}</div>
      </div>
    </button>
  );
}

function kpiIcon(id) {
  return {
    revenue: 'lightning', subs: 'users', churn: 'trend-down', failed: 'card',
    leads: 'flame', trials: 'ticket', newtrials: 'plus', visitors: 'users',
  }[id] || 'dot';
}

function TrendChip({ dir, value }) {
  const colors = {
    up:   { bg: 'rgba(166,226,46,0.12)', fg: '#A6E22E', icon: 'arrow-up' },
    down: { bg: 'rgba(255,61,46,0.12)',  fg: '#FF6B5E', icon: 'arrow-down' },
    flat: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.4)', icon: 'dot' },
  }[dir] || { bg: 'transparent', fg: MUTE, icon: 'dot' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '2px 6px 2px 4px', borderRadius: 5,
      background: colors.bg, color: colors.fg,
      fontSize: 10, fontWeight: 700,
    }}>
      <Icon name={colors.icon} size={9} stroke={colors.fg} strokeWidth={2.6} />
      {value}
    </span>
  );
}

// ───────────── Actions list ─────────────
function ActionRow({ action, onAct, onOpen }) {
  const tone = TONES[action.tone];
  return (
    <div onClick={onOpen} style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }} className="tap">
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tone,
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${tone}1a`, color: tone,
        display: 'grid', placeItems: 'center',
      }}>
        <span className="num" style={{ fontSize: 18, color: tone }}>{action.count}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.25 }}>
          {action.label}
        </div>
        <div style={{ fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.3 }}>
          {action.detail}
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onAct(action); }} style={{
        flexShrink: 0, padding: '7px 10px', borderRadius: 8,
        background: tone, border: 'none',
        color: '#0a0a0a', fontSize: 10.5, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: 0.04,
        cursor: 'pointer', fontFamily: 'inherit',
      }} className="tap">
        {action.cta}
      </button>
    </div>
  );
}

// ───────────── Home ─────────────
function HomeScreen({ accent, density, onKPIClick, onActionClick }) {
  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Hero stat */}
      <div style={{ padding: '4px 18px 14px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${SURFACE} 0%, #12121A 100%)`,
          border: `1px solid ${BORDER}`,
          borderRadius: 18, padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -20, top: -20, width: 140, height: 140,
            background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`,
            borderRadius: '50%',
          }} />
          <div style={{ position: 'relative' }}>
            <div className="head" style={{ fontSize: 11, color: MUTE_STRONG, marginBottom: 8 }}>
              Receita YTD
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
              <div className="num" style={{ fontSize: 56, color: '#fff', lineHeight: 0.85 }}>€4136</div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#A6E22E',
                background: 'rgba(166,226,46,0.12)',
                padding: '4px 8px', borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                lineHeight: 1, height: 22,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#A6E22E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                +12%
              </span>
            </div>
            <Sparkline accent={accent} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: MUTE }}>Jan 26</span>
              <span style={{ fontSize: 10, color: MUTE }}>Média €1034/mês</span>
              <span style={{ fontSize: 10, color: MUTE }}>Hoje</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <SectionHead title="Indicadores" action="ver todos" onAction={() => {}} accent={accent} />
      <div style={{
        padding: '0 18px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
      }}>
        {KPIS.slice(1).map(kpi => (
          <KPICard key={kpi.id} kpi={kpi} density={density} onClick={() => onKPIClick(kpi)} />
        ))}
      </div>

      {/* Actions */}
      <SectionHead title="Acções recomendadas" count={ACTIONS.length} accent={accent} />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACTIONS.map(a => (
          <ActionRow key={a.id} action={a} onAct={onActionClick} onOpen={() => onActionClick(a)} />
        ))}
      </div>
    </div>
  );
}

function Sparkline({ accent }) {
  const w = 320, h = 56, n = REVENUE_SPARK.length;
  const min = Math.min(...REVENUE_SPARK), max = Math.max(...REVENUE_SPARK);
  const points = REVENUE_SPARK.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 56, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => i === points.length - 1 && (
        <circle key={i} cx={x} cy={y} r="3.5" fill={accent} stroke="#0F0F14" strokeWidth="2" />
      ))}
    </svg>
  );
}

Object.assign(window, { HomeScreen, KPICard, ActionRow, TrendChip, Sparkline });
