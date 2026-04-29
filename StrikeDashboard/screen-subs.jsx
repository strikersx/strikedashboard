// Subscribers screen + filters

function StatusPill({ status, days }) {
  const cfg = {
    active:  { bg: 'rgba(0,229,160,0.14)',  fg: '#00E5A0', label: `renova ${days >= 0 ? `em ${days}d` : ''}` },
    risk:    { bg: 'rgba(255,182,39,0.14)', fg: '#FFB627', label: `risco · ${days}d` },
    failed:  { bg: 'rgba(255,61,46,0.14)',  fg: '#FF6B5E', label: `falha · ${Math.abs(days)}d` },
    expired: { bg: 'rgba(255,61,46,0.18)',  fg: '#FF6B5E', label: `venceu há ${Math.abs(days)}d` },
  }[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', borderRadius: 6,
      background: cfg.bg, color: cfg.fg,
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.02,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.fg }} />
      {cfg.label}
    </span>
  );
}

function SubsScreen({ accent, onOpen }) {
  const [filter, setFilter] = React.useState('all');
  const filters = [
    { id: 'all',    label: 'Todos',    count: SUBSCRIBERS.length },
    { id: 'active', label: 'Activos',  count: SUBSCRIBERS.filter(s => s.status === 'active').length },
    { id: 'risk',   label: 'Risco',    count: SUBSCRIBERS.filter(s => s.status === 'risk').length },
    { id: 'failed', label: 'Falhas',   count: SUBSCRIBERS.filter(s => s.status === 'failed' || s.status === 'expired').length },
  ];
  const list = filter === 'all' ? SUBSCRIBERS
    : filter === 'failed' ? SUBSCRIBERS.filter(s => s.status === 'failed' || s.status === 'expired')
    : SUBSCRIBERS.filter(s => s.status === filter);

  const totalMrr = SUBSCRIBERS.filter(s => s.status === 'active' || s.status === 'risk').reduce((a, s) => a + s.mrr, 0);

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Summary */}
      <div style={{ padding: '4px 18px 14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: 14,
        }}>
          <div className="head" style={{ fontSize: 10, color: MUTE_STRONG, marginBottom: 6 }}>SUBSCRITORES</div>
          <div className="num" style={{ fontSize: 38, color: '#fff' }}>166</div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4 }}>activos · todos os planos</div>
        </div>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: 14,
        }}>
          <div className="head" style={{ fontSize: 10, color: MUTE_STRONG, marginBottom: 6 }}>MRR ESTIMADO</div>
          <div className="num" style={{ fontSize: 38, color: accent }}>€{(totalMrr / 100 * 100).toLocaleString('pt-PT')}</div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4 }}>por mês · receita activa</div>
        </div>
      </div>

      {/* Plans breakdown */}
      <SectionHead title="Por plano" accent={accent} />
      <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SUBS_BY_PLAN.map((p, i) => {
          const pct = (p.count / 73) * 100;
          return (
            <div key={p.name} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: MUTE }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{p.count}</span> · €{p.mrr * p.count}/mês
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div className="bar-grow" style={{
                  height: '100%', width: `${pct}%`, background: accent, borderRadius: 2,
                  animationDelay: `${i * 50}ms`,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter chips */}
      <div style={{
        padding: '14px 18px 10px', display: 'flex', gap: 6, overflowX: 'auto',
      }} className="scrollbox">
        {filters.map(f => {
          const isActive = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              flexShrink: 0, padding: '7px 12px', borderRadius: 999,
              background: isActive ? accent : SURFACE,
              color: isActive ? '#0a0a0a' : MUTE_STRONG,
              border: `1px solid ${isActive ? accent : BORDER}`,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.02,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }} className="tap">
              {f.label}
              <span style={{
                fontSize: 10, opacity: 0.7,
                color: isActive ? '#0a0a0a' : MUTE,
              }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((s, i) => <SubRow key={s.email} sub={s} onClick={() => onOpen(s)} />)}
      </div>
    </div>
  );
}

function SubRow({ sub, onClick }) {
  const initials = sub.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div onClick={onClick} style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '11px 12px',
      display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
    }} className="tap">
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(135deg, #1f1f28 0%, #15151c 100%)',
        border: `1px solid ${BORDER}`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.02,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{sub.name}</div>
        <div style={{ fontSize: 10.5, color: MUTE, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>{sub.plan}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{sub.days}</span>
        </div>
      </div>
      <StatusPill status={sub.status} days={sub.renewIn} />
    </div>
  );
}

window.SubsScreen = SubsScreen;
window.StatusPill = StatusPill;
window.SubRow = SubRow;
