// Main app — Striker's House mobile dashboard

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "coral",
  "navStyle": "pill",
  "density": "comfy",
  "profile": "Admin",
  "showFrame": true,
  "homeLayout": "hero"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = React.useState('home');
  const [detail, setDetail] = React.useState(null);
  const [actionToast, setActionToast] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [time, setTime] = React.useState('22:17:07');

  const palette = PALETTES[t.palette] || PALETTES.coral;
  const accent = palette.primary;

  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const onProfileToggle = () => {
    setTweak('profile', t.profile === 'Admin' ? 'PT João' : 'Admin');
  };

  const showActionToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2200);
  };

  const handleAction = (a) => {
    showActionToast(`${a.cta}: ${a.count} ${a.label}`);
  };

  const screen = (() => {
    switch (tab) {
      case 'home':   return <HomeScreen accent={accent} density={t.density} onKPIClick={() => {}} onActionClick={handleAction} />;
      case 'funnel': return <FunnelScreen accent={accent} />;
      case 'subs':   return <SubsScreen accent={accent} onOpen={setDetail} />;
      case 'leads':  return <LeadsScreen accent={accent} onOpen={setDetail} />;
      case 'more':   return <MoreScreen accent={accent} />;
      default: return null;
    }
  })();

  const titles = { home: 'Início', funnel: 'Funil', subs: 'Subscritores', leads: 'Leads & Trials', more: 'Mais' };

  const inner = (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: ZERO_BG, color: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      <AppHeader
        profile={t.profile}
        onProfileToggle={onProfileToggle}
        accent={accent}
        location="Carcavelos"
        onRefresh={onRefresh}
        framed={t.showFrame}
      />

      <LiveStatus accent={accent} time={refreshing ? 'a atualizar…' : time} />

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="scrollbox fade-in" key={tab} style={{
          position: 'absolute', inset: 0, overflowY: 'auto',
        }}>
          {/* Page title bar */}
          <div style={{ padding: '6px 18px 0' }}>
            <div className="head" style={{ fontSize: 26, color: '#fff', lineHeight: 1, marginBottom: 2 }}>
              {titles[tab]}
            </div>
          </div>
          {screen}
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} accent={accent} layout={t.navStyle} />

      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} accent={accent} />}

      {/* Action toast */}
      {actionToast && (
        <div className="fade-in" style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20,20,28,0.96)',
          border: `1px solid ${accent}40`,
          borderRadius: 12, padding: '10px 16px',
          fontSize: 12, fontWeight: 600, color: '#fff',
          boxShadow: `0 8px 24px ${accent}30`,
          zIndex: 50, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="check" size={14} stroke={accent} strokeWidth={2.5} />
          {actionToast}
        </div>
      )}
    </div>
  );

  // Background sparkle
  const bg = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: -1,
      background: `radial-gradient(circle at 20% 0%, ${palette.primaryGlow} 0%, transparent 40%),
                   radial-gradient(circle at 80% 100%, ${palette.primarySoft} 0%, transparent 40%),
                   #050507`,
    }} />
  );

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {bg}
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: t.showFrame ? '24px 16px' : 0,
      }}>
        {t.showFrame ? (
          <IOSDevice width={402} height={874} dark={true}>
            {inner}
          </IOSDevice>
        ) : (
          <div style={{
            width: '100%', maxWidth: 480, height: '100vh',
            background: ZERO_BG, position: 'relative', overflow: 'hidden',
            border: `1px solid ${BORDER}`,
          }}>
            {inner}
          </div>
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Aparência">
          <TweakRadio label="Cor accent" value={t.palette}
            options={[
              { value: 'coral',    label: 'Coral' },
              { value: 'electric', label: 'Elec' },
              { value: 'amber',    label: 'Amber' },
              { value: 'cobalt',   label: 'Cobalt' },
            ]}
            onChange={(v) => setTweak('palette', v)} />
          <TweakRadio label="Densidade" value={t.density}
            options={['compact', 'comfy']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Navegação">
          <TweakRadio label="Tab bar" value={t.navStyle}
            options={[{value:'pill',label:'Pill'},{value:'bar',label:'Barra'}]}
            onChange={(v) => setTweak('navStyle', v)} />
        </TweakSection>
        <TweakSection label="Perfil">
          <TweakRadio label="Vista" value={t.profile}
            options={['Admin', 'PT João']}
            onChange={(v) => setTweak('profile', v)} />
        </TweakSection>
        <TweakSection label="Frame">
          <TweakToggle label="Moldura iPhone" value={t.showFrame}
            onChange={(v) => setTweak('showFrame', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
