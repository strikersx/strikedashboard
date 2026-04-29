// Leads / Trials screen + Detail sheet

function LeadsScreen({ accent, onOpen }) {
  const [tab, setTab] = React.useState('hot');
  const went = TRIALS.filter(t => t.went);
  const noshow = TRIALS.filter(t => !t.went);
  const list = tab === 'hot' ? went : noshow;

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Top split */}
      <div style={{ padding: '4px 18px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={() => setTab('hot')} style={{
          padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
          background: tab === 'hot' ? 'rgba(255,46,136,0.08)' : SURFACE,
          border: `1px solid ${tab === 'hot' ? '#FF2E88' : BORDER}`,
          color: '#fff', fontFamily: 'inherit',
        }} className="tap">
          <div className="head" style={{ fontSize: 10, color: '#FF2E88', marginBottom: 6 }}>FORAM À AULA</div>
          <div className="num" style={{ fontSize: 38, color: '#fff' }}>{went.length}</div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, lineHeight: 1.3 }}>
            Lead quente — fechar venda 24-48h
          </div>
        </button>
        <button onClick={() => setTab('cold')} style={{
          padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
          background: tab === 'cold' ? 'rgba(255,182,39,0.08)' : SURFACE,
          border: `1px solid ${tab === 'cold' ? '#FFB627' : BORDER}`,
          color: '#fff', fontFamily: 'inherit',
        }} className="tap">
          <div className="head" style={{ fontSize: 10, color: '#FFB627', marginBottom: 6 }}>FALTARAM</div>
          <div className="num" style={{ fontSize: 38, color: '#fff' }}>{noshow.length + 32}</div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, lineHeight: 1.3 }}>
            No-show — confirmar e reagendar
          </div>
        </button>
      </div>

      <SectionHead
        title={tab === 'hot' ? 'Foram à aula' : 'Faltaram ou agendado'}
        count={list.length}
        accent={accent}
      />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(t => (
          <TrialRow key={t.email} trial={t} onClick={() => onOpen({ ...t, _isTrial: true })} />
        ))}
      </div>
    </div>
  );
}

function TrialRow({ trial, onClick }) {
  const tone = trial.went ? '#FF2E88' : '#FFB627';
  const initials = trial.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div onClick={onClick} style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${tone}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
    }} className="tap">
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${tone}1a`, color: tone,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        fontSize: 12, fontWeight: 700,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{trial.name}</div>
        <div style={{ fontSize: 10.5, color: MUTE, lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {trial.phone} · cad. {trial.regAt.split(' · ')[0]}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: tone, textTransform: 'uppercase', letterSpacing: 0.04,
          padding: '3px 7px', borderRadius: 5, background: `${tone}1a`,
        }}>
          {trial.went ? '✓ FOI' : '× FALTOU'}
        </span>
      </div>
    </div>
  );
}

// ───────────── Detail sheet (subscriber or trial) ─────────────
function DetailSheet({ item, onClose, accent }) {
  if (!item) return null;
  const isTrial = item._isTrial;
  const tone = isTrial
    ? (item.went ? '#FF2E88' : '#FFB627')
    : (item.status === 'active' ? '#00E5A0' : item.status === 'risk' ? '#FFB627' : '#FF6B5E');
  const initials = item.name.split(' ').map(w => w[0]).slice(0, 2).join('');

  return (
    <Sheet open={true} onClose={onClose} height={620}>
      <div style={{ padding: '6px 20px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0 18px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${tone}33, ${tone}10)`,
            border: `1px solid ${tone}40`,
            display: 'grid', placeItems: 'center',
            fontSize: 20, fontWeight: 700, color: tone,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: MUTE, marginBottom: 6 }}>
              {isTrial ? `Trial · cad. ${item.regAt}` : item.plan}
            </div>
            {!isTrial && <StatusPill status={item.status} days={item.renewIn} />}
            {isTrial && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: tone, padding: '3px 7px',
                borderRadius: 5, background: `${tone}1a`,
              }}>
                {item.went ? 'FOI À AULA' : 'FALTOU'}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: SURFACE_2, border: `1px solid ${BORDER}`,
            color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
          }} className="tap">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Contact actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
          <ActionBtn icon="whatsapp" label="WhatsApp" tone="#25D366" />
          <ActionBtn icon="phone" label="Ligar" tone={accent} />
          <ActionBtn icon="mail" label="Email" tone="#3D7DFF" />
        </div>

        {/* Info rows */}
        <div style={{ background: SURFACE_2, borderRadius: 12, padding: '4px 14px', marginBottom: 14 }}>
          <InfoRow label="Email" value={item.email} />
          <InfoRow label="Telefone" value={item.phone || '—'} />
          {!isTrial && <InfoRow label="Aulas (mês)" value={item.days} />}
          {!isTrial && <InfoRow label="MRR" value={`€${item.mrr}/mês`} />}
          {!isTrial && <InfoRow label="Cliente desde" value={item.joined} last />}
          {isTrial && <InfoRow label="Cadastrado" value={item.regAt} last />}
        </div>

        {/* Suggested next step */}
        <div style={{
          background: `linear-gradient(135deg, ${tone}1a 0%, ${tone}05 100%)`,
          border: `1px solid ${tone}30`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div className="head" style={{ fontSize: 10, color: tone, marginBottom: 6 }}>PRÓXIMA ACÇÃO</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.35 }}>
            {isTrial && item.went && 'Enviar oferta de subscrição agora'}
            {isTrial && !item.went && 'SMS de confirmação + reagendar'}
            {!isTrial && item.status === 'risk' && 'Contactar — sem aulas em 30d'}
            {!isTrial && item.status === 'failed' && 'Cartão recusado — pedir actualização'}
            {!isTrial && item.status === 'expired' && 'Subscrição venceu — relembrar'}
            {!isTrial && item.status === 'active' && 'Tudo em ordem — manter a presença'}
          </div>
          <div style={{ fontSize: 11, color: MUTE_STRONG, lineHeight: 1.4 }}>
            Lead com este perfil converte tipicamente em 24-72h se o follow-up for personalizado.
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function ActionBtn({ icon, label, tone }) {
  return (
    <button style={{
      padding: '12px 8px', borderRadius: 12,
      background: `${tone}14`, border: `1px solid ${tone}30`,
      color: tone, fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      cursor: 'pointer',
    }} className="tap">
      <Icon name={icon} size={18} stroke={tone} strokeWidth={2} />
      <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${BORDER}`,
    }}>
      <span style={{ fontSize: 11, color: MUTE }}>{label}</span>
      <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, textAlign: 'right' }} className="mono">{value}</span>
    </div>
  );
}

window.LeadsScreen = LeadsScreen;
window.DetailSheet = DetailSheet;
