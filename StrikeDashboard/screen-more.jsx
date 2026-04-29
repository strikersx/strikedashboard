// "Mais" screen — secondary tabs

function MoreScreen({ accent, onPick }) {
  const items = [
    { id: 'faturacao', label: 'Faturação', icon: 'lightning', sub: '€4.136 YTD' },
    { id: 'pts',       label: 'PTs',       icon: 'users',     sub: '10 sessões/sem' },
    { id: 'experimentais', label: 'Experimentais', icon: 'ticket', sub: '46 sem conv.' },
    { id: 'churn',     label: 'Churn',     icon: 'trend-down', sub: '8 em risco · 11%' },
    { id: 'falhas',    label: 'Pagamentos falhados', icon: 'card', sub: '22 cartões' },
    { id: 'visitantes', label: 'Visitantes', icon: 'spark',    sub: '0 esta semana' },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <SectionHead title="Outras secções" accent={accent} />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(i => (
          <div key={i.id} onClick={() => onPick && onPick(i.id)} style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }} className="tap">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              display: 'grid', placeItems: 'center', color: accent,
            }}>
              <Icon name={i.icon} size={18} stroke={accent} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{i.label}</div>
              <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{i.sub}</div>
            </div>
            <Icon name="chevron" size={16} stroke={MUTE} />
          </div>
        ))}
      </div>

      <SectionHead title="Conta" accent={accent} />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
            display: 'grid', placeItems: 'center',
            fontSize: 14, fontWeight: 800, color: '#0a0a0a',
          }}>SH</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Striker's House · Carcavelos</div>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>Admin · sessão expira 23:00</div>
          </div>
          <button style={{
            background: 'transparent', border: `1px solid ${BORDER}`,
            color: MUTE_STRONG, padding: '8px 10px', borderRadius: 8,
            cursor: 'pointer', display: 'grid', placeItems: 'center',
          }} className="tap">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

window.MoreScreen = MoreScreen;
