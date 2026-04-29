// Shell — header, tab bar, bottom sheet, status badge

const ZERO_BG = '#07070a';
const SURFACE = '#0F0F14';
const SURFACE_2 = '#15151C';
const BORDER = 'rgba(255,255,255,0.06)';
const BORDER_STRONG = 'rgba(255,255,255,0.10)';
const MUTE = 'rgba(255,255,255,0.5)';
const MUTE_STRONG = 'rgba(255,255,255,0.72)';

// ───────────── Header ─────────────
function AppHeader({ profile, onProfileToggle, accent, lastUpdate, onRefresh, location, framed = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: framed ? '62px 18px 12px' : '14px 18px 12px',
      position: 'sticky', top: 0, zIndex: 5,
      background: `linear-gradient(180deg, ${ZERO_BG} 0%, ${ZERO_BG} 70%, rgba(7,7,10,0.0) 100%)`,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `linear-gradient(140deg, ${accent}, ${accent}cc 60%, ${accent}88)`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        boxShadow: `0 4px 16px ${accent}40`,
      }}>
        <Icon name="trophy" size={20} stroke="#0a0a0a" strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="head" style={{ fontSize: 16, lineHeight: 1, marginBottom: 3 }}>
          STRIKER'S HOUSE
        </div>
        <div style={{ fontSize: 11, color: MUTE, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{location}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <button onClick={onProfileToggle} style={{
            background: 'transparent', border: 'none', color: accent,
            padding: 0, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {profile} <Icon name="chevron-d" size={11} stroke={accent} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <button onClick={onRefresh} style={{
        width: 36, height: 36, borderRadius: 10,
        background: SURFACE_2, border: `1px solid ${BORDER}`,
        color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
      }} className="tap">
        <Icon name="refresh" size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

// ───────────── Live status pill ─────────────
function LiveStatus({ accent, time }) {
  return (
    <div style={{
      margin: '0 18px 10px', padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      borderRadius: 12, background: SURFACE,
      border: `1px solid ${BORDER}`,
    }}>
      <span style={{ position: 'relative', width: 8, height: 8 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: accent,
        }} className="pulse-dot" />
      </span>
      <span style={{ fontSize: 11, color: MUTE_STRONG, letterSpacing: 0.02 }}>LIVE</span>
      <span style={{ flex: 1, fontSize: 11, color: MUTE, textAlign: 'right' }} className="mono">
        última act. {time}
      </span>
    </div>
  );
}

// ───────────── Tab bar (bottom) ─────────────
function TabBar({ active, onChange, accent, layout }) {
  const tabs = [
    { id: 'home',   label: 'Início',      icon: 'home' },
    { id: 'funnel', label: 'Funil',       icon: 'funnel' },
    { id: 'subs',   label: 'Subs',        icon: 'users' },
    { id: 'leads',  label: 'Leads',       icon: 'flame' },
    { id: 'more',   label: 'Mais',        icon: 'grid' },
  ];
  if (layout === 'pill') {
    return (
      <div style={{
        position: 'absolute', bottom: 22, left: 12, right: 12, zIndex: 30,
        background: 'rgba(15,15,20,0.92)',
        border: `1px solid ${BORDER_STRONG}`,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 999, padding: 5,
        display: 'flex', gap: 2,
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      }}>
        {tabs.map(t => {
          const isActive = active === t.id;
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              flex: 1, height: 44, border: 'none', cursor: 'pointer',
              background: isActive ? accent : 'transparent',
              color: isActive ? '#0a0a0a' : MUTE_STRONG,
              borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, transition: 'all .2s',
            }} className="tap">
              <Icon name={t.icon} size={17} strokeWidth={isActive ? 2.4 : 1.8} />
              {isActive && <span style={{ letterSpacing: 0.03 }}>{t.label.toUpperCase()}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  // default: bar
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: 'rgba(7,7,10,0.95)',
      borderTop: `1px solid ${BORDER}`,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      padding: '8px 4px 26px',
      display: 'flex',
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: 'transparent', border: 'none',
            color: isActive ? accent : MUTE,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '6px 0', cursor: 'pointer',
            fontSize: 10, fontWeight: 600, letterSpacing: 0.02,
            position: 'relative',
          }} className="tap">
            {isActive && <div style={{
              position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 3, borderRadius: 2, background: accent,
            }} />}
            <Icon name={t.icon} size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────────── Bottom Sheet ─────────────
function Sheet({ open, onClose, children, height = 560 }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} className="fade-in" style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
      }} />
      <div className="sheet-anim" style={{
        position: 'relative', background: SURFACE,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTop: `1px solid ${BORDER_STRONG}`,
        maxHeight: height, height: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '8px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
          }} />
        </div>
        <div className="scrollbox" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ───────────── Section header ─────────────
function SectionHead({ title, count, action, onAction, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '18px 18px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: '#fff' }}>{title}</h3>
        {count != null && (
          <span style={{ fontSize: 13, color: MUTE, fontWeight: 600 }}>{count}</span>
        )}
      </div>
      {action && (
        <button onClick={onAction} style={{
          background: 'transparent', border: 'none', color: accent,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          padding: 0, fontFamily: 'inherit',
        }}>
          {action} <Icon name="chevron" size={12} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

Object.assign(window, {
  AppHeader, LiveStatus, TabBar, Sheet, SectionHead,
  ZERO_BG, SURFACE, SURFACE_2, BORDER, BORDER_STRONG, MUTE, MUTE_STRONG,
});
