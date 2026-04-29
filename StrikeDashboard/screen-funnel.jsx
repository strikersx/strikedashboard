// Funnel screen — visual conversion funnel

function FunnelScreen({ accent }) {
  const max = FUNNEL[0].value;
  const stages = FUNNEL.map((s, i) => {
    const next = FUNNEL[i + 1];
    const conv = next ? ((next.value / s.value) * 100).toFixed(0) : null;
    return { ...s, conv };
  });
  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Top stat */}
      <div style={{ padding: '4px 18px 14px' }}>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 16, padding: 18,
        }}>
          <div className="head" style={{ fontSize: 11, color: MUTE_STRONG, marginBottom: 8 }}>
            Conversão Visitante → Subscritor
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div className="num" style={{ fontSize: 56, color: '#fff' }}>2.7%</div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#A6E22E',
              background: 'rgba(166,226,46,0.12)',
              padding: '3px 7px', borderRadius: 6, marginBottom: 6,
            }}>+0.4pp</span>
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>
            últimos 30 dias · 11 de 412 visitantes
          </div>
        </div>
      </div>

      {/* Funnel viz */}
      <SectionHead title="Funil" accent={accent} />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((s, i) => {
          const tone = TONES[s.color];
          const pct = (s.value / max) * 100;
          return (
            <React.Fragment key={s.id}>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 14, padding: '12px 14px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div className="bar-grow" style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`, background: `linear-gradient(90deg, ${tone}26 0%, ${tone}08 100%)`,
                  borderRight: `2px solid ${tone}`,
                  animationDelay: `${i * 80}ms`,
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tone, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                      {s.label}
                    </div>
                    <div className="num" style={{ fontSize: 32, color: '#fff', marginTop: 4 }}>{s.value}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: MUTE }}>de {max}</div>
                    <div className="num" style={{ fontSize: 18, color: tone, marginTop: 2 }}>
                      {((s.value / max) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
              {s.conv != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, color: MUTE }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M3 9l4 4 4-4" stroke={MUTE} strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 10.5 }}>
                    <span className="mono" style={{ color: '#fff', fontWeight: 600 }}>{s.conv}%</span> conversão
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Drop-off insights */}
      <SectionHead title="Onde estás a perder gente" accent={accent} />
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InsightCard tone="amber" title="324 visitantes não viraram lead" body="79% de drop-off na primeira etapa. Pode ser tempo de revisitar a CTA do site." />
        <InsightCard tone="magenta" title="35 trials faltaram à aula" body="61% no-show — confirmar por SMS 24h antes pode subir 15-20pp." />
        <InsightCard tone="electric" title="11 foram à aula sem converter" body="Lead super quente. Follow up nas próximas 24-48h fecha 30-50%." />
      </div>
    </div>
  );
}

function InsightCard({ tone, title, body }) {
  const c = TONES[tone];
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '12px 14px',
      borderLeft: `3px solid ${c}`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTE_STRONG, lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}

window.FunnelScreen = FunnelScreen;
