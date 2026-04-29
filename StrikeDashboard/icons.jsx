// Icons — minimal stroke icon set

function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none', strokeWidth = 1.8 }) {
  const sw = strokeWidth;
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':       return <svg {...props}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></svg>;
    case 'funnel':     return <svg {...props}><path d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>;
    case 'users':      return <svg {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20a4 4 0 0 1 6.5-3" /></svg>;
    case 'spark':      return <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
    case 'trend-up':   return <svg {...props}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
    case 'trend-down': return <svg {...props}><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></svg>;
    case 'flame':      return <svg {...props}><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s-1 4 2 4 3-3 1-6 1-5 1-5z" /></svg>;
    case 'card':       return <svg {...props}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></svg>;
    case 'ticket':     return <svg {...props}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M9 6v12" strokeDasharray="2 2" /></svg>;
    case 'plus':       return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
    case 'check':      return <svg {...props}><path d="M4 12l5 5L20 6" /></svg>;
    case 'close':      return <svg {...props}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'chevron':    return <svg {...props}><path d="M9 6l6 6-6 6" /></svg>;
    case 'chevron-d':  return <svg {...props}><path d="M6 9l6 6 6-6" /></svg>;
    case 'arrow-up':   return <svg {...props}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
    case 'arrow-down': return <svg {...props}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>;
    case 'phone':      return <svg {...props}><path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
    case 'mail':       return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
    case 'whatsapp':   return <svg {...props}><path d="M3 21l1.5-5A8 8 0 1 1 8 19.5z" /><path d="M9 9c0 4 3 7 7 7l1-2-2.5-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1L11 8z" fill="currentColor" stroke="none" /></svg>;
    case 'calendar':   return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>;
    case 'clock':      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'bell':       return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3z" /><path d="M9 19a3 3 0 0 0 6 0" /></svg>;
    case 'search':     return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>;
    case 'filter':     return <svg {...props}><path d="M3 5h18l-7 9v5l-4 2v-7z" /></svg>;
    case 'menu':       return <svg {...props}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
    case 'grid':       return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case 'logout':     return <svg {...props}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case 'refresh':    return <svg {...props}><path d="M4 4v6h6M20 20v-6h-6" /><path d="M20 9a8 8 0 0 0-14-2L4 10M4 15a8 8 0 0 0 14 2l2-3" /></svg>;
    case 'dot':        return <svg {...props} fill={stroke} stroke="none"><circle cx="12" cy="12" r="4" /></svg>;
    case 'trophy':     return <svg {...props}><path d="M7 4h10v3a5 5 0 0 1-10 0z" /><path d="M5 4h2v3a3 3 0 0 1-3-3zM17 4h2a3 3 0 0 1-3 3V4z" /><path d="M9 13h6v3a3 3 0 0 1-6 0zM8 20h8" /></svg>;
    case 'lightning':  return <svg {...props} fill="currentColor" stroke="none"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
    case 'sliders':    return <svg {...props}><path d="M4 8h12M20 8h0M4 16h4M12 16h8" /><circle cx="18" cy="8" r="2" fill={stroke} stroke="none" /><circle cx="10" cy="16" r="2" fill={stroke} stroke="none" /></svg>;
    case 'more':       return <svg {...props}><circle cx="5" cy="12" r="1.5" fill={stroke} stroke="none" /><circle cx="12" cy="12" r="1.5" fill={stroke} stroke="none" /><circle cx="19" cy="12" r="1.5" fill={stroke} stroke="none" /></svg>;
    default: return null;
  }
}

window.Icon = Icon;
