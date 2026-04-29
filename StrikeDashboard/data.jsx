// Mock data — Striker's House dashboard

const KPIS = [
  { id: 'revenue', label: 'Receita YTD', value: '€4136', sub: 'Média €1034/mês', trend: '+12%', trendDir: 'up', accent: 'mint' },
  { id: 'subs', label: 'Subscrições activas', value: '73', sub: '63 grupo · 10 PT', trend: '+4', trendDir: 'up', accent: 'blue' },
  { id: 'churn', label: 'Churn (30d)', value: '8', sub: '11% — sem aulas em 30d', trend: '+2', trendDir: 'down', accent: 'amber' },
  { id: 'failed', label: 'Pagamentos falhados', value: '22', sub: 'Memberships ended', trend: '−3', trendDir: 'up', accent: 'coral' },
  { id: 'leads', label: 'Leads', value: '8', sub: '5 não accionáveis', trend: '+1', trendDir: 'up', accent: 'lime' },
  { id: 'trials', label: 'Trials s/ conv.', value: '46', sub: '11 foram · 35 faltaram', trend: '+5', trendDir: 'down', accent: 'magenta' },
  { id: 'newtrials', label: 'Novos trials', value: '0', sub: 'Semana 0 · Mês 0', trend: '0', trendDir: 'flat', accent: 'electric' },
  { id: 'visitors', label: 'Visitantes', value: '0', sub: 'Semana 0 · Mês 0', trend: '0', trendDir: 'flat', accent: 'blue' },
];

const ACTIONS = [
  { id: 'a1', count: 22, label: 'pagamentos falhados', cta: 'Contactar', tone: 'coral', urgency: 'alta', detail: 'Cartões expirados ou recusados — recuperar receita ou cancelar' },
  { id: 'a2', count: 8, label: 'membros em risco de churn', cta: 'Rever', tone: 'amber', urgency: 'alta', detail: '0 aulas nos últimos 30 dias — risco de cancelamento' },
  { id: 'a3', count: 11, label: 'trials que foram à aula', cta: 'Follow-up', tone: 'magenta', urgency: 'média', detail: 'Lead quente — fechar venda nas próximas 24-48h' },
  { id: 'a4', count: 35, label: 'trials que faltaram', cta: 'Reagendar', tone: 'electric', urgency: 'média', detail: 'Pode ser aula futura ou no-show — confirmar e reagendar' },
  { id: 'a5', count: 5, label: 'leads sem contacto há 7d', cta: 'Whatsapp', tone: 'lime', urgency: 'baixa', detail: 'Reactivar conversação antes que esfriem' },
];

const SUBSCRIBERS = [
  { name: 'João Pereira', plan: 'Grupo · ilimitado', email: 'joao.p@gmail.com', status: 'active', renewIn: 11, days: '6/12 aulas', mrr: 89, joined: '2024-08-12' },
  { name: 'Sofia Marques', plan: 'PT · 8x/mês', email: 'sofiam@hotmail.com', status: 'active', renewIn: 5, days: '5/8 aulas', mrr: 240, joined: '2025-01-04' },
  { name: 'Ricardo Sousa', plan: 'Grupo · 2x/sem', email: 'ricsousa@gmail.com', status: 'expired', renewIn: -28, days: '0/8 aulas', mrr: 65, joined: '2024-03-19' },
  { name: 'Inês Lopes', plan: 'Grupo · ilimitado', email: 'ines.l@gmail.com', status: 'active', renewIn: 3, days: '8/12 aulas', mrr: 89, joined: '2025-02-21' },
  { name: 'Tiago Almeida', plan: 'PT · 4x/mês', email: 'tiago.a@gmail.com', status: 'risk', renewIn: 9, days: '0/4 aulas', mrr: 140, joined: '2024-11-08' },
  { name: 'Beatriz Nunes', plan: 'Grupo · 2x/sem', email: 'bnunes@gmail.com', status: 'active', renewIn: 14, days: '4/8 aulas', mrr: 65, joined: '2025-03-02' },
  { name: 'Diogo Ferreira', plan: 'Grupo · ilimitado', email: 'diogo.f@gmail.com', status: 'failed', renewIn: -2, days: '7/12 aulas', mrr: 89, joined: '2024-09-15' },
  { name: 'Carolina Brito', plan: 'PT · 8x/mês', email: 'cbrito@gmail.com', status: 'active', renewIn: 18, days: '3/8 aulas', mrr: 240, joined: '2025-01-29' },
  { name: 'Rui Costa', plan: 'Grupo · 2x/sem', email: 'ruic@hotmail.com', status: 'risk', renewIn: 7, days: '1/8 aulas', mrr: 65, joined: '2024-12-11' },
];

const TRIALS = [
  { name: 'Eduardo Souza', email: 'dadinho21151@hotmail.com', phone: '933 891 582', regAt: '26 abr 2026 · 10:05', went: true },
  { name: 'Pedro Cabrita', email: 'cabrita.620@gmail.com', phone: '932 205 155', regAt: '22 abr 2026 · 15:56', went: true },
  { name: 'Bernardo Lima', email: 'bernardovieiralima@gmail.com', phone: '936 882 926', regAt: '22 abr 2026 · 15:52', went: true },
  { name: 'Maria Castro', email: 'mcmariadecastro@gmail.com', phone: '968 667 044', regAt: '21 abr 2026 · 22:47', went: true },
  { name: 'Amanda Carvalho', email: 'amanbit@hotmail.com', phone: '929 219 546', regAt: '16 abr 2026 · 11:04', went: true },
  { name: 'Gonçalo Amedane', email: '5778@cad.edu.pt', phone: '926 377 465', regAt: '15 abr 2026 · 14:13', went: false },
  { name: 'Helena Vaz', email: 'helenavaz@gmail.com', phone: '912 008 332', regAt: '14 abr 2026 · 19:30', went: false },
  { name: 'Marco Reis', email: 'marco.reis@gmail.com', phone: '961 442 718', regAt: '13 abr 2026 · 18:00', went: false },
];

const FUNNEL = [
  { id: 'visitors', label: 'Visitantes', value: 412, color: 'electric' },
  { id: 'leads', label: 'Leads', value: 88, color: 'lime' },
  { id: 'trials', label: 'Novos trials', value: 57, color: 'magenta' },
  { id: 'attended', label: 'Foram à aula', value: 22, color: 'amber' },
  { id: 'subs', label: 'Subscritores', value: 11, color: 'coral' },
];

const REVENUE_SPARK = [3200, 3380, 3510, 3460, 3680, 3820, 3940, 4010, 4080, 4136];
const SUBS_BY_PLAN = [
  { name: 'Grupo · ilimitado', count: 28, mrr: 89 },
  { name: 'Grupo · 2x/sem', count: 22, mrr: 65 },
  { name: 'Grupo · 1x/sem', count: 13, mrr: 45 },
  { name: 'PT · 8x/mês', count: 6, mrr: 240 },
  { name: 'PT · 4x/mês', count: 4, mrr: 140 },
];

Object.assign(window, { KPIS, ACTIONS, SUBSCRIBERS, TRIALS, FUNNEL, REVENUE_SPARK, SUBS_BY_PLAN });
