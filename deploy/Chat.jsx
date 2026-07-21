import { useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const ContractPage = lazy(() => import('./Contract.jsx'));
const LogoPage     = lazy(() => import('./Logo.jsx'));

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'lg', label: 'LG' },
  { code: 'sw', label: 'SW' },
  { code: 'ac', label: 'AC' },
];

const LANG_PREFIX = {
  lg: 'Please respond in Luganda: ',
  sw: 'Please respond in Swahili: ',
  ac: 'Please respond in Acholi: ',
  en: '',
};

const THEMES = [
  { id: 'dark',  label: '◐ Dark' },
  { id: 'light', label: '○ Light' },
  { id: 'gold',  label: '✦ Gold' },
];


const DEEP_THINK_PACKS = [
  { idx: 0, label: 'Starter Pack',  credits: '500',   amount: '5,000',  popular: false },
  { idx: 1, label: 'Smart Pack',    credits: '1,500', amount: '10,000', popular: true  },
  { idx: 2, label: 'Research Pack', credits: '3,000', amount: '15,000', popular: false },
  { idx: 3, label: 'Pro Pack',      credits: '6,000', amount: '25,000', popular: false },
];

function isDocumentResponse(content) {
  if (!content || content.length < 600) return false;
  const headings = (content.match(/^#{1,3} /gm) || []).length;
  if (headings >= 3) return true;
  const signals = ['WHEREAS', 'HEREBY AGREE', 'IN WITNESS', 'EXECUTIVE SUMMARY',
    'SCOPE OF WORK', 'TERMS AND CONDITIONS', 'PROFESSIONAL EXPERIENCE',
    'WORK EXPERIENCE', 'PROFESSIONAL SUMMARY'];
  const upper = content.toUpperCase();
  return signals.filter(s => upper.includes(s)).length >= 2 && content.length > 400;
}

function getDocTitle(content) {
  const h1 = content.match(/^# (.+)$/m);
  if (h1) return h1[1].trim();
  const h2 = content.match(/^## (.+)$/m);
  if (h2) return h2[1].trim();
  return 'Document';
}

function inlineMd(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

function mdToHtml(content) {
  if (!content) return '';
  const lines = content.split('\n');
  const out = [];
  let inUl = false, inOl = false;
  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('### ')) { closeList(); out.push(`<h3>${inlineMd(t.slice(4))}</h3>`); }
    else if (t.startsWith('## ')) { closeList(); out.push(`<h2>${inlineMd(t.slice(3))}</h2>`); }
    else if (t.startsWith('# ')) { closeList(); out.push(`<h1>${inlineMd(t.slice(2))}</h1>`); }
    else if (/^[-*•] /.test(t)) {
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineMd(t.replace(/^[-*•] /, ''))}</li>`);
    } else if (/^\d+[.)]\s/.test(t)) {
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineMd(t.replace(/^\d+[.)]\s/, ''))}</li>`);
    } else if (!t) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inlineMd(t)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

function downloadAsWord(content, title) {
  const html = mdToHtml(content);
  const safe = title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'document';
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${safe}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;max-width:720px;margin:0 auto;}h1{font-size:18pt;margin-top:0;}h2{font-size:13pt;margin-top:18pt;border-bottom:1pt solid #ccc;padding-bottom:4pt;}h3{font-size:11pt;margin-top:12pt;}p{margin-bottom:9pt;}li{margin-bottom:3pt;}</style></head><body>${html}</body></html>`;
  const blob = new Blob(['﻿', doc], { type: 'application/msword' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${safe}.doc` });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 200);
}

function downloadAsPdf(content, title) {
  const html = mdToHtml(content);
  const safe = title.replace(/</g, '&lt;').replace(/>/g, '&gt;') || 'Document';
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow popups to download PDF.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safe}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Georgia,serif;font-size:11pt;line-height:1.8;max-width:750px;margin:0 auto;padding:52px 48px;color:#111;}h1{font-size:20pt;margin-bottom:6pt;}h2{font-size:13pt;margin:20pt 0 6pt;border-bottom:1pt solid #c8992a;padding-bottom:3pt;}h3{font-size:11pt;margin:13pt 0 3pt;font-weight:bold;}p{margin-bottom:10pt;}ul,ol{margin:4pt 0 12pt;padding-left:22pt;}li{margin-bottom:3pt;}strong{font-weight:bold;}em{font-style:italic;}code{font-family:monospace;background:#f4f4f4;padding:1px 4px;}@media print{body{padding:30px;}@page{margin:1.2cm;}}</style></head><body>${html}<script>setTimeout(()=>{window.print();},500)<\/script></body></html>`);
  w.document.close();
}

function getGroup(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This Week';
  return 'Older';
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    return u.toString().replace(/\?$/, '');
  } catch { return url; }
}

function renderInline(text) {
  if (!text) return null;
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)\]]+)/g;
  return text.split(pattern).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const mdLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (mdLink) {
      const href = cleanUrl(mdLink[2]);
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{mdLink[1]}</a>;
    }
    if (/^https?:\/\//.test(part)) {
      const href = cleanUrl(part);
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{href}</a>;
    }
    return part;
  });
}

const ScreenshotEmbed = memo(function ScreenshotEmbed({ url, hint }) {
  const [state, setState] = useState('idle');
  const [src, setSrc] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await fetch('/api/ai/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, hint }),
      });
      if (r.status === 404) { setState('not_found'); return; }
      if (!r.ok) throw new Error('failed');
      const blob = await r.blob();
      setSrc(URL.createObjectURL(blob));
      setState('done');
    } catch {
      setState('error');
    }
  }, [url, hint]);

  return (
    <div className="screenshot-embed">
      {state === 'idle' && (
        <button className="screenshot-load-btn" onClick={load}>
          <span className="screenshot-load-icon">📸</span>
          Show screenshot — <span className="screenshot-url">{url}</span>
        </button>
      )}
      {state === 'loading' && (
        <div className="screenshot-loading">
          <span className="searching-dot" /> Taking screenshot…
        </div>
      )}
      {state === 'done' && (
        <div className="screenshot-result">
          <div className="screenshot-label">
            <span className="screenshot-dot" />
            Live screenshot · <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          </div>
          <img src={src} alt={hint || 'Step screenshot'} className="screenshot-img" />
        </div>
      )}
      {state === 'not_found' && (
        <div className="screenshot-not-found">
          ⚠ This page could not be reached.
          <a href={url} target="_blank" rel="noopener noreferrer">Try opening it manually ↗</a>
        </div>
      )}
      {state === 'error' && (
        <div className="screenshot-error">
          Could not load screenshot for <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          <button className="screenshot-retry" onClick={load}>Retry</button>
        </div>
      )}
    </div>
  );
});

function renderResponse(content) {
  if (!content) return null;
  const screenshotPattern = /\[SCREENSHOT:\s*(https?:\/\/[^\]|]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/g;
  const parts = [];
  let last = 0, m;
  screenshotPattern.lastIndex = 0;
  while ((m = screenshotPattern.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: content.slice(last, m.index) });
    parts.push({ type: 'screenshot', url: m[1].trim(), hint: (m[2] || '').trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) });
  return parts.map((part, pi) => {
    if (part.type === 'screenshot') return <ScreenshotEmbed key={`ss-${pi}`} url={part.url} hint={part.hint} />;
    return renderTextContent(part.value, pi);
  });
}

function renderTextContent(content, keyPrefix = 0) {
  if (!content) return null;
  return content.split(/(```[\s\S]*?```)/g).map((seg, si) => {
    if (seg.startsWith('```')) {
      const lines = seg.split('\n');
      const lang = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');
      return (
        <div key={si} className="code-block">
          {lang && <div className="code-lang">{lang}</div>}
          <pre>{code}</pre>
        </div>
      );
    }
    return seg.split(/\n\n+/).map((block, bi) => {
      if (!block.trim()) return null;
      const lines = block.split('\n').filter(l => l.trim());
      if (!lines.length) return null;
      if (lines.length > 1 && lines.every(l => /^[-*•]\s/.test(l.trim()))) {
        return <ul key={`${si}-${bi}`}>{lines.map((l, li) => <li key={li}>{renderInline(l.replace(/^[-*•]\s/, ''))}</li>)}</ul>;
      }
      if (lines.length > 1 && lines.every(l => /^\d+[.)]\s/.test(l.trim()))) {
        return <ol key={`${si}-${bi}`}>{lines.map((l, li) => <li key={li}>{renderInline(l.replace(/^\d+[.)]\s/, ''))}</li>)}</ol>;
      }
      const first = lines[0];
      if (first.startsWith('### ')) return <h3 key={`${si}-${bi}`}>{renderInline(first.replace('### ', ''))}</h3>;
      if (first.startsWith('## ')) return <h2 key={`${si}-${bi}`}>{renderInline(first.replace('## ', ''))}</h2>;
      if (first.startsWith('# ')) return <h1 key={`${si}-${bi}`}>{renderInline(first.replace('# ', ''))}</h1>;
      return <p key={`${si}-${bi}`}>{renderInline(lines.join(' '))}</p>;
    });
  });
}

function IbBtn({ onClick, title, className = '', children }) {
  return (
    <button className={`ib ${className}`} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

const IconSidebar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />
  </svg>
);
const IconPlus = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconCopy = ({ done }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {done ? <polyline points="20 6 9 17 4 12" /> : <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>}
  </svg>
);

// ── Deep Think buy modal ──────────────────────────────────────────
function DeepThinkBuyModal({ onClose, onSuccess, authFetch }) {
  const [selected, setSelected] = useState(0);
  const [phone, setPhone]       = useState('');
  const [stage, setStage]       = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [refId, setRefId]       = useState('');
  const pack = DEEP_THINK_PACKS[selected];

  const initiate = async () => {
    if (!phone.trim()) return;
    setStage('sending'); setErrorMsg('');
    try {
      const r = await authFetch('/api/payments/deepthink', {
        method: 'POST',
        body: JSON.stringify({ pack: selected, phone: phone.trim() }),
      });
      let d;
      try { d = await r.json(); } catch { d = { error: `Server error (${r.status})` }; }
      if (!r.ok) { setErrorMsg(d.error || 'Could not initiate payment'); setStage('idle'); return; }
      setRefId(d.referenceId);
      setStage('polling');
    } catch (e) { setErrorMsg(e.message || 'Network error.'); setStage('idle'); }
  };

  useEffect(() => {
    if (stage !== 'polling' || !refId) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const r = await authFetch(`/api/payments/deepthink/status/${refId}`);
        const d = await r.json();
        if (d.status === 'SUCCESSFUL') { clearInterval(timer); setStage('success'); onSuccess(d.credits); }
        if (d.status === 'FAILED')     { clearInterval(timer); setStage('failed'); }
      } catch {}
      if (tries >= 30) { clearInterval(timer); setStage('error'); setErrorMsg('Timed out.'); }
    }, 4000);
    return () => clearInterval(timer);
  }, [stage, refId, authFetch, onSuccess]);

  return (
    <div className="pay-modal-backdrop" onClick={onClose}>
      <div className="pay-modal dt-buy-modal" onClick={e => e.stopPropagation()}>
        <button className="pay-modal-close" onClick={onClose}>✕</button>
        <div className="dt-modal-header">
          <div className="dt-modal-icon">✦</div>
          <div className="dt-modal-title">Deep Think Credits</div>
          <p className="dt-modal-sub">Advanced reasoning for coding, legal analysis, research, and strategy.</p>
        </div>

        {stage === 'idle' && (
          <>
            <div className="dt-packs">
              {DEEP_THINK_PACKS.map(p => (
                <button
                  key={p.idx}
                  className={`dt-pack-btn${selected === p.idx ? ' selected' : ''}${p.popular ? ' dt-pack-popular' : ''}`}
                  onClick={() => setSelected(p.idx)}
                >
                  {p.popular && <span className="dt-pack-badge">Most Popular</span>}
                  <span className="dt-pack-name">{p.label}</span>
                  <span className="dt-pack-credits">{p.credits} credits</span>
                  <span className="dt-pack-price">UGX {p.amount}</span>
                </button>
              ))}
            </div>
            <input
              className="pay-modal-input"
              type="tel"
              placeholder="MTN MoMo number e.g. 0771234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && initiate()}
              autoFocus
            />
            {errorMsg && <div className="pay-modal-error">{errorMsg}</div>}
            <button
              className={`pay-modal-btn${phone.trim() ? ' active' : ''}`}
              disabled={!phone.trim()}
              onClick={initiate}
            >
              Pay UGX {pack.amount} · Get {pack.credits} Deep Think Credits
            </button>
          </>
        )}
        {stage === 'sending' && <div className="pay-modal-status"><div className="pay-spinner" />Sending request…</div>}
        {stage === 'polling' && (
          <div className="pay-modal-status">
            <div className="pay-spinner" />
            <strong>Check your phone</strong>
            <p>Approve the MTN MoMo prompt on <strong>{phone}</strong>.</p>
          </div>
        )}
        {stage === 'success' && (
          <div className="pay-modal-status success">
            <div className="pay-success-icon">✓</div>
            <strong>{pack.credits} Deep Think credits added!</strong>
            <button className="pay-modal-btn active" style={{ background: '#00dd55', borderColor: '#00dd55' }} onClick={onClose}>
              Start Deep Thinking
            </button>
          </div>
        )}
        {(stage === 'failed' || stage === 'error') && (
          <div className="pay-modal-status failed">
            <div className="pay-fail-icon">✕</div>
            <p>{errorMsg || 'Payment declined. Please try again.'}</p>
            <button className="pay-modal-btn active" onClick={() => { setStage('idle'); setErrorMsg(''); }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { user, authFetch, logout } = useAuth();
  const [theme, setTheme]         = useState(() => localStorage.getItem('ai256_theme') || 'dark');
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [convId, setConvId]       = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen]     = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [lang, setLang]           = useState('en');
  const [search, setSearch]       = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [mode, setMode]           = useState('smart'); // fast | smart | code | deep_think | image | video
  const [showLengthPicker, setShowLengthPicker] = useState(false);
  const [logoWizard, setLogoWizard]             = useState(null); // null | { prompt, color, type, style }
  const [refineModal, setRefineModal]           = useState(null); // null | { prompt }
  const [refineFeedback, setRefineFeedback]     = useState('');
  const pendingMsgRef    = useRef('');
  const lastImagePrompt  = useRef('');
  const videoPollerRef   = useRef({});
  const [usage, setUsage]         = useState(null);
  const [showDTBuy,    setShowDTBuy]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);
  const [histSearch,   setHistSearch]   = useState('');

  // ── Tool modals ──────────────────────────────────────────────────
  const [showImgModal,      setShowImgModal]      = useState(false);
  const [showVidModal,      setShowVidModal]       = useState(false);
  const [showContractModal, setShowContractModal]  = useState(false);
  const [showLogoModal,     setShowLogoModal]      = useState(false);

  // Image modal state
  const [imgPrompt,      setImgPrompt]      = useState('');
  const [imgQuality,     setImgQuality]     = useState('medium');
  const [imgSize,        setImgSize]        = useState('1024x1024');
  const [imgResult,      setImgResult]      = useState(null);
  const [imgLoading,     setImgLoading]     = useState(false);
  const [imgError,       setImgError]       = useState('');
  const [imgUploadFile,  setImgUploadFile]  = useState(null);   // File object
  const [imgUploadPreview, setImgUploadPreview] = useState(null); // object URL
  const imgLastPrompt  = useRef('');
  const imgFileInputRef = useRef(null);

  // Video modal state
  const [vidPrompt,        setVidPrompt]        = useState('');
  const [vidDuration,      setVidDuration]      = useState('5');
  const [vidSize,          setVidSize]          = useState('1280x720');
  const [vidResult,        setVidResult]        = useState(null);
  const [vidLoading,       setVidLoading]       = useState(false);
  const [vidError,         setVidError]         = useState('');
  const [vidProgress,      setVidProgress]      = useState(0);
  const [vidUploadFile,    setVidUploadFile]    = useState(null);
  const [vidUploadPreview, setVidUploadPreview] = useState(null);
  const modalVidPollRef = useRef(null);
  const vidFileInputRef = useRef(null);

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ai256_theme', theme);
  }, [theme]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const loadConversations = useCallback(async () => {
    try {
      const r = await authFetch('/api/ai/conversations');
      const data = await r.json();
      if (Array.isArray(data)) setConversations(data);
    } catch {}
  }, [authFetch]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load initial usage from /me
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const r = await authFetch('/api/ai/auth/me');
        if (r.ok) {
          const d = await r.json();
          if (d.usage && d.plan) {
            const remaining = Math.max(0, d.plan.monthly_limit - d.usage.monthly_used) + (d.usage.credits_balance || 0);
            setUsage({
              plan:                   d.plan.label,
              daily_used:             d.usage.daily_used,
              daily_limit:            d.plan.daily_limit,
              credits:                remaining,
              deep_think_credits:     d.usage.deep_think_credits || 0,
              deep_think_daily_used:  d.usage.deep_think_daily_used || 0,
              deep_think_daily_limit: d.plan.daily_deep_think || 0,
              deep_think_trial_used:  d.usage.deep_think_trial_used || false,
              web_searches_used:      d.usage.web_searches_used || 0,
              web_searches_limit:     d.plan.daily_web_searches || 0,
            });
          }
        }
      } catch {}
    })();
  }, [user, authFetch]);

  const isImageRequest = (msg) =>
    /\b(generate|create|make|design|draw|produce|build)\b[^.!?\n]{0,50}\b(logo|image|picture|photo|illustration|icon|banner|poster|artwork|graphic|visual)\b/i.test(msg)
    || /\b(logo|image|photo|picture|illustration|icon|banner|poster)\s+(for|of|about)\b/i.test(msg)
    || /\b(i|we|can you|please)\b[^.!?\n]{0,30}\b(need|want|require)\b[^.!?\n]{0,30}\b(logo|image|picture|banner|poster|icon|illustration)\b/i.test(msg);

  const isRegenRequest = (msg) =>
    /\b(regenerate|re-generate|remake|re-make|redo|re-do|retry|re-try|try again|another version|different version|make it better|improve it|improve the|not good|looks bad|try a different|refine|enhance it|redo the|do it again|generate again|one more time|again|another one|new version|better version|better quality|higher quality|upgrade|not happy|i don't like|change it|change the style)\b/i.test(msg);

  const isLogoRequest = (msg) =>
    /\b(logo|brand mark|emblem|wordmark|logotype|monogram|brand identity)\b/i.test(msg);

  const send = () => {
    const msg = input.trim();
    if (!msg || loading) return;

    if (mode === 'deep_think' && user && usage && usage.deep_think_credits === 0 && usage.deep_think_daily_used >= usage.deep_think_daily_limit) {
      setShowDTBuy(true);
      return;
    }

    // Regeneration request — reuse last prompt with regen flag
    if (isRegenRequest(msg) && lastImagePrompt.current) {
      dispatchImage(lastImagePrompt.current, true);
      return;
    }

    // Logo requests → show wizard first
    if (isImageRequest(msg) && isLogoRequest(msg)) {
      setInput('');
      setLogoWizard({ prompt: msg, color: '', type: '', style: '' });
      return;
    }
    // Other image requests → generate directly
    if (mode === 'image' || isImageRequest(msg)) { dispatchImage(msg); return; }
    if (mode === 'video') { dispatchVideo(msg); return; }

    // Only show length picker for questions/explanations — not for short commands or actions
    const isShortAction = msg.length < 60
      || /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it|great|nice|cool|perfect)\b/i.test(msg)
      || /\b(translate|convert|calculate|compute|fix|debug|correct|summarise|summarize|list|count|what is|who is|when is|where is|define|spell)\b/i.test(msg);

    if (isShortAction) {
      dispatchMsg(msg, 'auto');
      return;
    }

    pendingMsgRef.current = msg;
    setShowLengthPicker(true);
  };

  const pickLength = (len) => {
    const msg = pendingMsgRef.current;
    pendingMsgRef.current = '';
    setShowLengthPicker(false);
    dispatchMsg(msg, len);
  };

  const dispatchMsg = async (msg, length = 'auto') => {
    const finalMsg = LANG_PREFIX[lang] + msg;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsgId = Date.now();
    const aiMsgId   = userMsgId + 1;
    const sentMode  = mode;

    setMessages(prev => [...prev, { role: 'user', content: msg, time: new Date(), id: userMsgId }]);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', time: new Date(), id: aiMsgId, streaming: true, mode: sentMode }]);

    try {
      const r = await authFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: finalMsg, conversation_id: convId, mode: sentMode, length: length }),
      });

      if (!r.ok) {
        const data = await r.json();
        // Deep Think credit gate response from server
        if (r.status === 402 && data.limit_type === 'deep_think') {
          setMessages(prev => prev.filter(m => m.id !== aiMsgId));
          setLoading(false);
          setShowDTBuy(true);
          return;
        }
        throw new Error(data.error || 'Error');
      }

      const reader  = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.searching) {
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, searching: true } : m));
            }
            if (payload.chunk) {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: m.content + payload.chunk, searching: false } : m
              ));
            }
            if (payload.done) {
              setConvId(payload.conversation_id);
              loadConversations();
              if (payload.usage) {
                const u = payload.usage;
                const remaining = Math.max(0, u.monthly_limit - u.monthly_used);
                setUsage(prev => ({
                  plan:                   u.plan || prev?.plan,
                  daily_used:             u.daily_used,
                  daily_limit:            u.daily_limit,
                  credits:                remaining,
                  deep_think_credits:     u.deep_think_credits  ?? (prev?.deep_think_credits || 0),
                  deep_think_daily_used:  u.deep_think_daily_used  ?? (prev?.deep_think_daily_used || 0),
                  deep_think_daily_limit: u.deep_think_daily_limit ?? (prev?.deep_think_daily_limit || 0),
                  deep_think_trial_used:  u.deep_think_trial_used  ?? (prev?.deep_think_trial_used || false),
                  web_searches_used:      u.web_searches_used  ?? (prev?.web_searches_used || 0),
                  web_searches_limit:     u.web_searches_limit ?? (prev?.web_searches_limit || 0),
                }));
                if (u.daily_warning || u.monthly_warning) {
                  const warnMsg = u.daily_warning
                    ? `You've used ${u.daily_used} of ${u.daily_limit} prompts today.`
                    : `Credits running low — ${remaining.toLocaleString()} remaining this month.`;
                  setMessages(prev => [...prev, {
                    role: 'system', content: `⚠ ${warnMsg} [Manage plan →](/settings)`,
                    id: Date.now() + 99, time: new Date(),
                  }]);
                }
              }
            }
            if (payload.error) throw new Error(payload.error);
          } catch (parseErr) { /* skip malformed chunk */ }
        }
      }

      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m));

    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isError: true, streaming: false }
          : m
      ));
      loadConversations();
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const generateFromWizard = () => {
    const { prompt, color, type, style } = logoWizard;
    setLogoWizard(null);
    const colorNote  = color  && color  !== 'ai' ? `Colour palette: ${color}.` : '';
    const typeNote   = type   && type   !== 'ai' ? `Logo type: ${type}.`       : '';
    const styleNote  = style  && style  !== 'ai' ? `Style: ${style}.`          : '';
    const extras     = [colorNote, typeNote, styleNote].filter(Boolean).join(' ');
    const enriched   = extras ? `${prompt}. ${extras}` : prompt;
    dispatchImage(enriched);
  };

  const dispatchImage = async (prompt, regen = false) => {
    lastImagePrompt.current = prompt;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    const userMsgId = Date.now();
    const aiMsgId   = userMsgId + 1;
    const userLabel = regen ? `Regenerating: ${prompt}` : prompt;
    setMessages(prev => [...prev,
      { role: 'user',      content: userLabel, time: new Date(), id: userMsgId },
      { role: 'assistant', content: '',        time: new Date(), id: aiMsgId, streaming: true, type: 'image' },
    ]);
    setLoading(true);
    try {
      const r = await authFetch('/api/ai/image', { method: 'POST', body: JSON.stringify({ prompt, regen }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Image generation failed');
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, streaming: false, type: 'image', url: data.url, revised_prompt: data.revised_prompt } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, streaming: false, isError: true, content: err.message } : m
      ));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const dispatchVideo = async (prompt) => {
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    const userMsgId = Date.now();
    const aiMsgId   = userMsgId + 1;
    setMessages(prev => [...prev,
      { role: 'user',      content: prompt, time: new Date(), id: userMsgId },
      { role: 'assistant', content: '',     time: new Date(), id: aiMsgId, streaming: true, type: 'video', progress: 0 },
    ]);
    setLoading(true);
    try {
      const r = await authFetch('/api/ai/video', { method: 'POST', body: JSON.stringify({ prompt, seconds: 5 }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Video generation failed');
      const jobId = data.job_id;
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, jobId, progress: data.progress || 0 } : m
      ));
      setLoading(false);
      // Poll for status
      const poll = setInterval(async () => {
        try {
          const sr = await authFetch(`/api/ai/video/${jobId}/status`);
          const s  = await sr.json();
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, progress: s.progress, status: s.status } : m
          ));
          if (s.status === 'completed' || s.status === 'failed') {
            clearInterval(poll);
            delete videoPollerRef.current[aiMsgId];
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId
                ? { ...m, streaming: false, type: 'video',
                    videoSrc: s.status === 'completed' ? `/api/ai/video/${jobId}/content` : null,
                    isError: s.status === 'failed' }
                : m
            ));
          }
        } catch { clearInterval(poll); }
      }, 5000);
      videoPollerRef.current[aiMsgId] = poll;
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, streaming: false, isError: true, content: err.message } : m
      ));
      setLoading(false);
    }
  };

  // ── Modal image generation / editing ────────────────────────────
  const generateInModal = async (regen = false) => {
    const prompt = imgLastPrompt.current || imgPrompt;
    if (!prompt.trim() || imgLoading) return;
    imgLastPrompt.current = prompt;
    setImgLoading(true);
    setImgError('');
    try {
      let r, data;
      if (imgUploadFile) {
        // Edit mode — send as multipart/form-data
        const fd = new FormData();
        fd.append('image',   imgUploadFile);
        fd.append('prompt',  prompt);
        fd.append('quality', imgQuality);
        fd.append('size',    imgSize);
        r = await authFetch('/api/ai/image/edit', { method: 'POST', body: fd });
      } else {
        // Generate mode — JSON
        r = await authFetch('/api/ai/image', {
          method: 'POST',
          body: JSON.stringify({ prompt, quality: imgQuality, size: imgSize, regen }),
        });
      }
      data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Image generation failed');
      setImgResult(data.url);
    } catch (e) {
      setImgError(e.message || 'Failed. Please try again.');
    } finally {
      setImgLoading(false);
    }
  };

  const handleImgGenerate = () => {
    imgLastPrompt.current = imgPrompt;
    generateInModal(false);
  };

  const handleImgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imgUploadPreview) URL.revokeObjectURL(imgUploadPreview);
    setImgUploadFile(file);
    setImgUploadPreview(URL.createObjectURL(file));
    setImgResult(null);
    setImgError('');
  };

  const clearImgUpload = () => {
    if (imgUploadPreview) URL.revokeObjectURL(imgUploadPreview);
    setImgUploadFile(null);
    setImgUploadPreview(null);
    setImgResult(null);
    setImgError('');
    if (imgFileInputRef.current) imgFileInputRef.current.value = '';
  };

  // ── Modal video generation ───────────────────────────────────────
  const generateVideoInModal = async () => {
    if (!vidPrompt.trim() || vidLoading) return;
    if (modalVidPollRef.current) clearInterval(modalVidPollRef.current);
    setVidLoading(true);
    setVidError('');
    setVidProgress(0);
    setVidResult(null);
    try {
      let body;
      if (vidUploadFile) {
        const fd = new FormData();
        fd.append('image',   vidUploadFile);
        fd.append('prompt',  vidPrompt);
        fd.append('seconds', vidDuration);
        fd.append('size',    vidSize);
        body = fd;
      } else {
        body = JSON.stringify({ prompt: vidPrompt, seconds: parseInt(vidDuration), size: vidSize });
      }
      const r    = await authFetch('/api/ai/video', { method: 'POST', body });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Video generation failed');
      const jobId = data.job_id;
      setVidProgress(data.progress || 0);
      modalVidPollRef.current = setInterval(async () => {
        try {
          const sr = await authFetch(`/api/ai/video/${jobId}/status`);
          const s  = await sr.json();
          setVidProgress(s.progress || 0);
          if (s.status === 'completed' || s.status === 'failed') {
            clearInterval(modalVidPollRef.current);
            setVidLoading(false);
            if (s.status === 'completed') setVidResult(`/api/ai/video/${jobId}/content`);
            else setVidError('Video generation failed. Please try again.');
          }
        } catch { clearInterval(modalVidPollRef.current); setVidLoading(false); }
      }, 5000);
    } catch (e) {
      setVidError(e.message || 'Failed to generate video. Please try again.');
      setVidLoading(false);
    }
  };

  const handleVidUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (vidUploadPreview) URL.revokeObjectURL(vidUploadPreview);
    setVidUploadFile(file);
    setVidUploadPreview(URL.createObjectURL(file));
    setVidResult(null);
    setVidError('');
  };

  const clearVidUpload = () => {
    if (vidUploadPreview) URL.revokeObjectURL(vidUploadPreview);
    setVidUploadFile(null);
    setVidUploadPreview(null);
    setVidResult(null);
    setVidError('');
    if (vidFileInputRef.current) vidFileInputRef.current.value = '';
  };

  const newChat = () => { setMessages([]); setConvId(null); };

  const loadConv = async (id) => {
    try {
      const r = await authFetch(`/api/ai/conversations/${id}/messages`);
      const data = await r.json();
      setMessages(data.map(m => ({ ...m, time: new Date(m.created_at), id: Math.random() })));
      setConvId(id);
    } catch {}
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  const deleteConv = async (id, e) => {
    e.stopPropagation();
    try { await authFetch(`/api/ai/conversations/${id}`, { method: 'DELETE' }); } catch {}
    if (convId === id) newChat();
    loadConversations();
  };

  const copyMsg = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const filtered = conversations.filter(c => !search || c.title?.toLowerCase().includes(search.toLowerCase()));
  const grouped = {};
  filtered.forEach(c => {
    const g = getGroup(c.updated_at || c.created_at);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  });

  const userName    = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'You';
  const userInitial = (user?.name || user?.email || 'U')[0].toUpperCase();

  // Deep Think button state
  const dtTrialOk    = usage != null && !usage.deep_think_trial_used && usage.deep_think_daily_limit === 0;
  const dtDailyOk    = usage != null && usage.deep_think_daily_limit > 0 && usage.deep_think_daily_used < usage.deep_think_daily_limit;
  const dtCreditsOk  = usage != null && usage.deep_think_credits >= 50;
  const dtAvailable  = usage == null || dtTrialOk || dtDailyOk || dtCreditsOk;

  const planLabel = usage?.plan || (user ? 'Starter' : null);

  return (
    <div className="chat-root">
      {/* ── SIDEBAR BACKDROP (mobile) ── */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`chat-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <div className="sidebar-brand-logo">
                <div className="sidebar-brand-img-wrap">
                  <img src="/logo-ai.png" alt="256 AI" className="sidebar-brand-img" />
                </div>
              </div>
              <IbBtn onClick={() => setSidebarOpen(false)} title="Close sidebar"><IconSidebar /></IbBtn>
            </div>

            <button className="sidebar-new-chat" onClick={newChat}>
              <IconPlus />
              New Conversation
            </button>

            {/* History + Search — directly under New Conversation */}
            <div className="sidebar-history-bar">
              <button className="sidebar-history-btn" onClick={() => { setShowHistory(true); setHistSearch(''); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                History
              </button>
              <div className="sidebar-search-wrap">
                <svg className="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                />
              </div>
            </div>

            <div className="sidebar-tools">
              <div className="sidebar-tools-title">AI Tools</div>
              <Link to="/resume" className="sidebar-tool-link">
                <span>📋</span> Resume Builder
              </Link>
              <button className="sidebar-tool-link" onClick={() => setShowContractModal(true)}>
                <span>⚖️</span> Contract Builder
              </button>
              <button className="sidebar-tool-link" onClick={() => setShowLogoModal(true)}>
                <span>✦</span> Logo Generator
              </button>
              <Link to="/code" className="sidebar-tool-link">
                <span>⌘</span> 256 Code
              </Link>
              <Link to="/news" className="sidebar-tool-link">
                <span>📰</span> News
              </Link>
              <button className="sidebar-tool-link" onClick={() => { setShowImgModal(true); setImgResult(null); setImgError(''); setImgPrompt(''); }}>
                <span>🖼️</span> Image Generator
              </button>
              <button className="sidebar-tool-link" onClick={() => { setShowVidModal(true); setVidResult(null); setVidError(''); setVidPrompt(''); setVidProgress(0); setVidUploadFile(null); setVidUploadPreview(null); }}>
                <span>🎬</span> Video Generator
              </button>
            </div>
          </div>

          {/* Usage strip in sidebar */}
          {user && usage && (
            <div className="sidebar-usage">
              <div className="sidebar-usage-plan">{planLabel}</div>
              <div className="sidebar-usage-rows">
                <div className="sidebar-usage-row">
                  <span>Prompts Today</span>
                  <span>{usage.daily_used} / {usage.daily_limit >= 999999 ? '∞' : usage.daily_limit}</span>
                </div>
                <div className="sidebar-usage-row">
                  <span>Credits</span>
                  <span>{(usage.credits || 0).toLocaleString()}</span>
                </div>
                {(usage.web_searches_limit || 0) > 0 && (
                  <div className="sidebar-usage-row">
                    <span>Web Searches</span>
                    <span>{usage.web_searches_limit - (usage.web_searches_used || 0)} left</span>
                  </div>
                )}
                {(usage.deep_think_daily_limit > 0 || usage.deep_think_credits > 0) && (
                  <div className="sidebar-usage-row dt-row">
                    <span>✦ Deep Think</span>
                    <span>
                      {usage.deep_think_daily_limit > 0
                        ? `${usage.deep_think_daily_used}/${usage.deep_think_daily_limit} today`
                        : `${(usage.deep_think_credits || 0).toLocaleString()} credits`
                      }
                    </span>
                  </div>
                )}
                {!usage.deep_think_trial_used && (usage.plan === '256 Starter' || !usage.deep_think_daily_limit) && (
                  <div className="sidebar-usage-row dt-row">
                    <span>✦ Deep Think</span>
                    <span>1 free trial</span>
                  </div>
                )}
              </div>
              <Link to="/settings?returnTo=/chat" className="sidebar-usage-upgrade">
                Manage plan →
              </Link>
            </div>
          )}


          <div className="sidebar-convs">
            {conversations.length === 0 && (
              <div className="sidebar-convs-empty">
                <span>✦</span>
                <p>Your conversations<br />will appear here</p>
              </div>
            )}
            {['Today', 'Yesterday', 'This Week', 'Older'].filter(g => grouped[g]?.length).map(grp => (
              <div key={grp}>
                <div className="conv-group-label">{grp}</div>
                {grouped[grp].map(c => (
                  <div
                    key={c.id}
                    className={`conv-row${c.id === convId ? ' active' : ''}`}
                    onClick={() => loadConv(c.id)}
                  >
                    <span className="conv-row-icon">◈</span>
                    <span className="conv-row-title">{c.title || 'Conversation'}</span>
                    <div className="conv-row-acts">
                      <IbBtn className="danger" onClick={e => deleteConv(c.id, e)} title="Delete">✕</IbBtn>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <Link to="/settings" className="sidebar-user-card" title="Account & plan settings">
              <div className="sidebar-user-avatar">{userInitial}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name || user?.email?.split('@')[0]}</div>
                <div className="sidebar-user-plan">⚙ Settings · Plan</div>
              </div>
            </Link>
            <button className="sidebar-signout" onClick={logout}>
              Sign out
            </button>
          </div>
        </aside>

      {/* ── MAIN ── */}
      <div className="chat-main">
        <div className="chat-topbar">
          <div className="topbar-left">
            <IbBtn className="topbar-sidebar-toggle" onClick={() => setSidebarOpen(s => !s)} title="Toggle sidebar"><IconSidebar /></IbBtn>
            {!sidebarOpen && (
              <IbBtn onClick={newChat} title="New chat"><IconPlus /></IbBtn>
            )}
          </div>

          <div className="topbar-logo">
            <div className="topbar-logo-img-wrap">
              <img src="/logo-ai.png" alt="256 AI" className="topbar-logo-img" />
            </div>
          </div>

          <div className="topbar-right">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                className={`lang-pill${lang === l.code ? ' active' : ''}`}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}

            <div className="topbar-sep" />

            <div className="theme-toggle">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-btn${theme === t.id ? ' active' : ''}`}
                  onClick={() => setTheme(t.id)}
                  title={`${t.id.charAt(0).toUpperCase() + t.id.slice(1)} theme`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="topbar-sep" />
            <a href="https://256.co.ug" className="topbar-home">256.co.ug ↗</a>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-msgs">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="logo-badge">
                <div className="logo-badge-img-wrap">
                  <img src="/logo-ai.png" alt="256 AI" className="logo-badge-img" />
                </div>
              </div>
              <h1 className="chat-empty-h1">How can I help you today?</h1>
              <p className="chat-empty-sub">
                I am <span className="gold-text">256 AI</span> — world-class intelligence built in Uganda.<br />
                Ask me anything.
              </p>
            </div>
          ) : (
            <div className="msg-thread">
              {messages.map((m, i) => {
                if (m.role === 'system') {
                  return (
                    <div key={m.id || i} className="usage-warning-bar">
                      {renderInline(m.content)}
                    </div>
                  );
                }
                return (
                  <div key={m.id || i} className="msg-row">
                    <div className="msg-inner">
                      <div className="msg-header">
                        <div className={`msg-avatar ${m.role === 'user' ? 'user' : 'ai'}`}>
                          {m.role === 'user' ? userInitial : <img src="/logo-ai.png" alt="256 AI" className="msg-avatar-img" />}
                        </div>
                        <span className="msg-name">
                          {m.role === 'user' ? userName : '256 AI'}
                        </span>
                        {m.mode === 'deep_think' && m.role === 'assistant' && (
                          <span className="msg-dt-badge">✦ Deep Think</span>
                        )}
                        <span className="msg-time">
                          {m.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="msg-body">
                        {m.role === 'user' ? (
                          <div className="msg-user-wrap">
                            <div className="msg-user-bubble">
                              <p>{m.content}</p>
                            </div>
                            <div className="msg-actions">
                              <IbBtn
                                className={copiedIdx === i ? 'copied' : ''}
                                onClick={() => copyMsg(m.content, i)}
                                title="Copy message"
                              >
                                <IconCopy done={copiedIdx === i} />
                              </IbBtn>
                            </div>
                          </div>
                        ) : (
                          <div className={m.isError ? 'msg-error' : ''}>
                            {/* ── Image message ── */}
                            {m.type === 'image' && !m.isError ? (
                              m.streaming ? (
                                <div className="gen-status">
                                  <div className="gen-spinner" />
                                  Generating image — this takes 15–30 seconds…
                                </div>
                              ) : (
                                <div className="gen-image-wrap">
                                  <img src={m.url} alt="Generated image" className="gen-image" />
                                  <div className="gen-image-actions">
                                    <button
                                      className="doc-btn gold"
                                      onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = m.url;
                                        a.download = '256ai-image.png';
                                        a.click();
                                      }}
                                    >
                                      ⬇ Download PNG
                                    </button>
                                    <button
                                      className="doc-btn regen-btn"
                                      onClick={() => dispatchImage(lastImagePrompt.current, true)}
                                    >
                                      ↺ Regenerate
                                    </button>
                                    <button
                                      className="doc-btn refine-btn"
                                      onClick={() => { setRefineModal({ prompt: lastImagePrompt.current }); setRefineFeedback(''); }}
                                    >
                                      ✏ Refine
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : m.type === 'video' && !m.isError ? (
                              /* ── Video message ── */
                              m.videoSrc ? (
                                <div className="gen-video-wrap">
                                  <video src={m.videoSrc} controls className="gen-video" />
                                  <a href={m.videoSrc} download="256ai-video.mp4" className="doc-btn gold">
                                    ⬇ Download Video
                                  </a>
                                </div>
                              ) : (
                                <div className="gen-status">
                                  <div className="gen-spinner" />
                                  <span>
                                    Generating video with Sora{m.progress > 0 ? ` — ${m.progress}%` : '…'}
                                    <span className="gen-eta"> (3–5 min)</span>
                                  </span>
                                </div>
                              )
                            ) : m.streaming && !m.content ? (
                              m.searching ? (
                                <div className="searching-indicator">
                                  <span className="searching-dot" />
                                  Searching the web…
                                </div>
                              ) : (
                                <div className="typing-dots">
                                  {[0, 1, 2].map(i => (
                                    <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.22}s` }} />
                                  ))}
                                </div>
                              )
                            ) : (
                              <div className={m.streaming ? 'stream-cursor' : ''}>
                                {renderResponse(m.content)}
                              </div>
                            )}
                            {!m.isError && !m.streaming && m.type !== 'image' && m.type !== 'video' && (
                              <>
                                <div className="msg-actions">
                                  <IbBtn
                                    className={copiedIdx === i ? 'copied' : ''}
                                    onClick={() => copyMsg(m.content, i)}
                                    title="Copy response"
                                  >
                                    <IconCopy done={copiedIdx === i} />
                                  </IbBtn>
                                </div>
                                {isDocumentResponse(m.content) && (
                                  <div className="doc-toolbar">
                                    <span className="doc-toolbar-label">Document ready</span>
                                    <button className="doc-btn" onClick={() => copyMsg(m.content, i)}>
                                      {copiedIdx === i ? '✓ Copied' : '📋 Copy'}
                                    </button>
                                    <button className="doc-btn" onClick={() => downloadAsWord(m.content, getDocTitle(m.content))}>
                                      ⬇ Word
                                    </button>
                                    <button className="doc-btn gold" onClick={() => downloadAsPdf(m.content, getDocTitle(m.content))}>
                                      ⬇ PDF
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} style={{ height: 16 }} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <div className="chat-input-box">
              <textarea
                ref={inputRef}
                className="chat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask 256 AI anything…"
                rows={1}
              />
              <button
                className={`send-btn ${input.trim() && !loading ? 'active' : 'inactive'}`}
                onClick={send}
                disabled={!input.trim() || loading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={input.trim() && !loading ? '#000' : 'var(--send-off-icon)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>

            {/* Mode selector */}
            <div className="mode-selector">
              <button
                className={`mode-btn mode-btn-fast${mode === 'fast' ? ' active' : ''}`}
                onClick={() => setMode('fast')}
                title="Quick answers for everyday work."
              >
                <span className="mode-btn-icon">⚡</span>
                Fast
              </button>
              <button
                className={`mode-btn mode-btn-smart${mode === 'smart' ? ' active' : ''}`}
                onClick={() => setMode('smart')}
                title="Better reasoning for professional tasks."
              >
                <span className="mode-btn-icon">◈</span>
                Smart
              </button>
              <Link
                to="/code"
                className="mode-btn mode-btn-code"
                title="Open 256 Code for programming, debugging, websites, APIs, and technical implementation."
              >
                <span className="mode-btn-icon">⌘</span>
                Code
              </Link>
              <button
                className={`mode-btn mode-btn-dt${mode === 'deep_think' ? ' active' : ''}${!dtAvailable && user ? ' dt-locked' : ''}`}
                onClick={() => {
                  if (!dtAvailable && user) { setShowDTBuy(true); return; }
                  setMode('deep_think');
                }}
                title="Advanced reasoning for coding, legal analysis, research, and strategy. Consumes Deep Think credits."
              >
                <span className="mode-btn-icon">✦</span>
                Deep Think
                {user && usage && !dtAvailable && (
                  <span className="dt-buy-hint">Buy credits</span>
                )}
                {user && usage && dtTrialOk && mode !== 'deep_think' && (
                  <span className="dt-credits-hint">1 free</span>
                )}
                {user && usage && !dtTrialOk && dtCreditsOk && mode !== 'deep_think' && (
                  <span className="dt-credits-hint">{usage.deep_think_credits.toLocaleString()}</span>
                )}
              </button>
            </div>

            <div className="mode-descriptions">
              {mode === 'fast'       && <span>Quick answers for everyday work. Uses 1 credit per prompt.</span>}
              {mode === 'smart'      && <span>Better reasoning for professional tasks. Uses 5 credits per prompt.</span>}
              {mode === 'deep_think' && <span className="dt-desc-warn">✦ Advanced reasoning for coding, legal analysis, research, and strategy. Uses Deep Think credits.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE TOOLS SHEET ── */}
      {showToolsSheet && (
        <div className="tools-sheet-backdrop" onClick={() => setShowToolsSheet(false)}>
          <div className="tools-sheet" onClick={e => e.stopPropagation()}>
            <div className="tools-sheet-handle" />
            <div className="tools-sheet-title">AI Tools</div>
            <div className="tools-sheet-grid">
              <a href="/resume" className="tools-sheet-btn">
                <span className="tsb-icon">📋</span>
                <span className="tsb-label">Resume Builder</span>
              </a>
              <button className="tools-sheet-btn" onClick={() => { setShowToolsSheet(false); setShowContractModal(true); }}>
                <span className="tsb-icon">⚖️</span>
                <span className="tsb-label">Contract</span>
              </button>
              <a href="/logo" className="tools-sheet-btn">
                <span className="tsb-icon">✦</span>
                <span className="tsb-label">Logo Generator</span>
              </a>
              <a href="/code" className="tools-sheet-btn">
                <span className="tsb-icon">⌘</span>
                <span className="tsb-label">256 Code</span>
              </a>
              <button className="tools-sheet-btn" onClick={() => { setShowToolsSheet(false); setShowImgModal(true); setImgResult(null); setImgError(''); setImgPrompt(''); }}>
                <span className="tsb-icon">🖼️</span>
                <span className="tsb-label">Image Generator</span>
              </button>
              <button className="tools-sheet-btn" onClick={() => { setShowToolsSheet(false); setShowVidModal(true); setVidResult(null); setVidError(''); setVidPrompt(''); setVidProgress(0); setVidUploadFile(null); setVidUploadPreview(null); }}>
                <span className="tsb-icon">🎬</span>
                <span className="tsb-label">Video Generator</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav">
        <button className="mobile-nav-btn" onClick={() => setSidebarOpen(s => !s)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          Menu
        </button>
        <button className="mobile-nav-btn" onClick={newChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Chat
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowToolsSheet(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
            <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
          </svg>
          Tools
        </button>
        <button className="mobile-nav-btn" onClick={() => { setSidebarOpen(true); setTimeout(() => setShowHistory(true), 280); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          History
        </button>
        <a href="/settings" className="mobile-nav-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </a>
        <a href="/news" className="mobile-nav-btn">
          <span style={{ fontSize: 22, lineHeight: 1 }}>📰</span>
          News
        </a>
      </nav>

      {/* ── Refine Modal ──────────────────────────────────────────────── */}
      {refineModal && (
        <div className="lw-backdrop" onClick={() => setRefineModal(null)}>
          <div className="refine-modal" onClick={e => e.stopPropagation()}>
            <div className="refine-header">
              <div className="lw-title">What needs to change?</div>
              <div className="lw-sub">Describe exactly what you want fixed or improved</div>
            </div>
            <textarea
              className="refine-textarea"
              placeholder={`e.g. "Make the font bolder and the background darker"\n"Change the icon to a shield shape"\n"Use gold and black instead of blue"\n"Make it look more modern and minimal"`}
              value={refineFeedback}
              onChange={e => setRefineFeedback(e.target.value)}
              rows={5}
              autoFocus
            />
            <div className="refine-actions">
              <button className="refine-cancel" onClick={() => setRefineModal(null)}>Cancel</button>
              <button
                className={`lw-generate${refineFeedback.trim() ? ' ready' : ''}`}
                style={{ flex: 1, margin: 0 }}
                disabled={!refineFeedback.trim()}
                onClick={() => {
                  const enriched = `${refineModal.prompt}. User feedback on previous version: ${refineFeedback.trim()}. Apply these changes precisely.`;
                  setRefineModal(null);
                  setRefineFeedback('');
                  dispatchImage(enriched, true);
                }}
              >
                Apply & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logo Wizard ───────────────────────────────────────────────── */}
      {logoWizard && (
        <div className="lw-backdrop" onClick={() => setLogoWizard(null)}>
          <div className="lw-modal" onClick={e => e.stopPropagation()}>
            <div className="lw-header">
              <div className="lw-title">Customize your logo</div>
              <div className="lw-sub">Answer 3 quick questions — then we generate it</div>
            </div>

            <div className="lw-section">
              <div className="lw-q">Colour palette</div>
              <div className="lw-options">
                {[
                  { val: 'Dark and bold — black, deep navy, charcoal tones', label: 'Dark & Bold', swatch: '#1a1a2e' },
                  { val: 'Light and clean — white, cream, soft pastels',      label: 'Light & Clean', swatch: '#f5f5f0' },
                  { val: 'Gold and luxury — gold, black, champagne tones',    label: 'Gold & Luxury', swatch: '#c8992a' },
                  { val: 'Blue and tech — navy, electric blue, cyan',          label: 'Blue & Tech',   swatch: '#0077ff' },
                  { val: 'Vibrant and colorful — bold multi-color palette',   label: 'Vibrant',       swatch: 'linear-gradient(135deg,#ff4e50,#f9d423)' },
                  { val: 'ai', label: 'AI Chooses', swatch: '✨' },
                ].map(o => (
                  <button
                    key={o.val}
                    className={`lw-opt${logoWizard.color === o.val ? ' selected' : ''}`}
                    onClick={() => setLogoWizard(w => ({ ...w, color: o.val }))}
                  >
                    <span className="lw-swatch" style={
                      o.swatch.startsWith('#') ? { background: o.swatch } :
                      o.swatch.startsWith('linear') ? { background: o.swatch } :
                      { fontSize: 14 }
                    }>{o.swatch.startsWith('#') || o.swatch.startsWith('linear') ? '' : o.swatch}</span>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lw-section">
              <div className="lw-q">Logo type</div>
              <div className="lw-options">
                {[
                  { val: 'wordmark — text only, no icon, just the brand name in stylised typography', label: 'Text Only', icon: 'Aa' },
                  { val: 'lettermark — initials or monogram, no full wordmark',                      label: 'Monogram', icon: 'AB' },
                  { val: 'icon only — symbol or mark, no text',                                       label: 'Icon Only', icon: '◆' },
                  { val: 'combination mark — icon symbol plus wordmark text together',                 label: 'Icon + Text', icon: '◆ Aa' },
                ].map(o => (
                  <button
                    key={o.val}
                    className={`lw-opt${logoWizard.type === o.val ? ' selected' : ''}`}
                    onClick={() => setLogoWizard(w => ({ ...w, type: o.val }))}
                  >
                    <span className="lw-icon-preview">{o.icon}</span>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lw-section">
              <div className="lw-q">Style direction</div>
              <div className="lw-options">
                {[
                  { val: 'modern and minimal — clean lines, lots of whitespace, simple shapes',        label: 'Modern & Minimal' },
                  { val: 'contemporary and bold — strong shapes, heavy typography, high contrast',      label: 'Contemporary & Bold' },
                  { val: 'classic and elegant — timeless, refined, sophisticated, premium feel',        label: 'Classic & Elegant' },
                  { val: 'futuristic and tech — geometric, glowing accents, sci-fi inspired',           label: 'Futuristic & Tech' },
                  { val: 'natural and organic — earthy tones, flowing shapes, warm and human',          label: 'Natural & Organic' },
                  { val: 'ai', label: 'AI Chooses' },
                ].map(o => (
                  <button
                    key={o.val}
                    className={`lw-opt${logoWizard.style === o.val ? ' selected' : ''}`}
                    onClick={() => setLogoWizard(w => ({ ...w, style: o.val }))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={`lw-generate${logoWizard.color && logoWizard.type && logoWizard.style ? ' ready' : ''}`}
              disabled={!logoWizard.color || !logoWizard.type || !logoWizard.style}
              onClick={generateFromWizard}
            >
              {logoWizard.color && logoWizard.type && logoWizard.style
                ? 'Generate Logo'
                : 'Select all options above to continue'}
            </button>
          </div>
        </div>
      )}

      {/* ── History Panel ───────────────────────────────────────────── */}
      {showHistory && (
        <div className="history-backdrop" onClick={() => setShowHistory(false)}>
          <div className="history-panel" onClick={e => e.stopPropagation()}>
            <div className="history-header">
              <div className="history-title-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <h2>Chat History</h2>
              </div>
              <button className="history-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="history-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="history-search"
                placeholder="Search conversations…"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                autoFocus
              />
              {histSearch && <button className="history-search-clear" onClick={() => setHistSearch('')}>✕</button>}
            </div>
            <div className="history-list">
              {(() => {
                const filtered = conversations.filter(c =>
                  !histSearch || c.title?.toLowerCase().includes(histSearch.toLowerCase())
                );
                const groups = {};
                filtered.forEach(c => {
                  const g = getGroup(c.updated_at || c.created_at);
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(c);
                });
                if (!filtered.length) return (
                  <div className="history-empty">
                    <span>◈</span>
                    <p>{histSearch ? 'No conversations match your search.' : 'No conversations yet.'}</p>
                  </div>
                );
                return ['Today', 'Yesterday', 'This Week', 'Older'].filter(g => groups[g]?.length).map(grp => (
                  <div key={grp} className="history-group">
                    <div className="history-group-label">{grp}</div>
                    {groups[grp].map(c => (
                      <div key={c.id}
                        className={`history-item${c.id === convId ? ' active' : ''}`}
                        onClick={() => { loadConv(c.id); setShowHistory(false); }}>
                        <div className="history-item-icon">◈</div>
                        <div className="history-item-body">
                          <div className="history-item-title">{c.title || 'Conversation'}</div>
                          <div className="history-item-date">
                            {new Date(c.updated_at || c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <button className="history-item-del"
                          onClick={e => { deleteConv(c.id, e); }}
                          title="Delete">✕</button>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Image Generator Modal ───────────────────────────────────── */}
      {showImgModal && (
        <div className="tool-overlay-backdrop" onClick={() => setShowImgModal(false)}>
          <div className="img-vid-modal" onClick={e => e.stopPropagation()}>
            <div className="tool-modal-header">
              <div className="tool-modal-title-row">
                <span className="tool-modal-icon">🖼️</span>
                <h2>{imgUploadFile ? 'AI Image Editor' : 'Image Generator'}</h2>
                {imgUploadFile && <span className="img-mode-badge">Edit Mode</span>}
              </div>
              <button className="tool-modal-close" onClick={() => setShowImgModal(false)}>✕</button>
            </div>
            <div className="tool-modal-body">

              {/* Upload zone */}
              <input
                ref={imgFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleImgUpload}
              />
              {!imgUploadFile ? (
                <button className="img-upload-zone" onClick={() => imgFileInputRef.current?.click()}>
                  <span className="img-upload-zone-icon">📎</span>
                  <span className="img-upload-zone-label">Upload an image to edit</span>
                  <span className="img-upload-zone-sub">PNG, JPG, WEBP · Max 20MB · Optional</span>
                </button>
              ) : (
                <div className="img-upload-preview-wrap">
                  <img src={imgUploadPreview} alt="Upload preview" className="img-upload-preview" />
                  <div className="img-upload-preview-overlay">
                    <span className="img-upload-preview-name">{imgUploadFile.name}</span>
                    <button className="img-upload-clear" onClick={clearImgUpload}>✕ Remove</button>
                  </div>
                </div>
              )}

              {/* Quick edit suggestions when in edit mode */}
              {imgUploadFile && (
                <div className="img-edit-suggestions">
                  <span className="img-edit-suggestions-label">Quick edits:</span>
                  <div className="img-edit-pills">
                    {[
                      'Polish and enhance quality',
                      'Change the clothing style',
                      'Change background to studio white',
                      'Make it look cinematic',
                      'Change to night scene',
                      'Add professional lighting',
                      'Make it look like a painting',
                      'Remove background',
                      'Change outfit to suit and tie',
                      'Make it look vintage',
                    ].map(s => (
                      <button key={s} className="img-edit-pill"
                        onClick={() => setImgPrompt(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                className="tool-modal-textarea"
                placeholder={imgUploadFile
                  ? 'Describe what to do with this image — e.g. "Change the background to a beach sunset", "Give the person a suit", "Make it look like a professional portrait"…'
                  : 'Describe the image you want to generate…'}
                value={imgPrompt}
                onChange={e => setImgPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleImgGenerate(); } }}
                rows={3}
              />

              <div className="tool-modal-options">
                <div className="tool-modal-opt-group">
                  <span className="tool-modal-opt-label">Quality</span>
                  <div className="tool-modal-pills">
                    {['low', 'medium', 'high'].map(q => (
                      <button key={q} className={`tool-modal-pill${imgQuality === q ? ' active' : ''}`}
                        onClick={() => setImgQuality(q)}>
                        {q.charAt(0).toUpperCase() + q.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {!imgUploadFile && (
                  <div className="tool-modal-opt-group">
                    <span className="tool-modal-opt-label">Size</span>
                    <div className="tool-modal-pills">
                      {[{ val: '1024x1024', label: 'Square' }, { val: '1536x1024', label: 'Wide' }, { val: '1024x1536', label: 'Tall' }].map(s => (
                        <button key={s.val} className={`tool-modal-pill${imgSize === s.val ? ' active' : ''}`}
                          onClick={() => setImgSize(s.val)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {imgError && <p className="tool-modal-error">{imgError}</p>}

              <button className="tool-modal-gen-btn" onClick={handleImgGenerate}
                disabled={!imgPrompt.trim() || imgLoading}>
                {imgLoading
                  ? (imgUploadFile ? '✦ Editing image…' : '✦ Generating…')
                  : (imgUploadFile ? '✦ Apply AI Edit' : '✦ Generate Image')}
              </button>

              {imgLoading && !imgResult && (
                <div className="tool-modal-status">
                  <div className="gen-spinner" />
                  <span>{imgUploadFile ? 'Editing your image…' : 'Generating — '} this takes 15–30 seconds…</span>
                </div>
              )}
              {imgLoading && imgResult && (
                <div className="tool-modal-regen-overlay">
                  <img src={imgResult} alt="Generated" className="tool-modal-image tool-modal-image-faded" />
                  <div className="tool-modal-regen-label"><div className="gen-spinner gen-spinner-sm" /> {imgUploadFile ? 'Re-editing…' : 'Regenerating…'}</div>
                </div>
              )}
              {!imgLoading && imgResult && (
                <div className="tool-modal-result">
                  <img src={imgResult} alt="Generated" className="tool-modal-image" />
                  <div className="tool-modal-actions">
                    <button className="doc-btn gold" onClick={() => {
                      const a = document.createElement('a');
                      a.href = imgResult;
                      a.download = '256ai-image.png';
                      a.click();
                    }}>⬇ Download PNG</button>
                    {!imgUploadFile && (
                      <button className="doc-btn regen-btn" onClick={() => generateInModal(true)}>↺ Regenerate</button>
                    )}
                    {imgUploadFile && (
                      <button className="doc-btn regen-btn" onClick={handleImgGenerate}>↺ Try Again</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Video Generator Modal ───────────────────────────────────── */}
      {showVidModal && (
        <div className="tool-overlay-backdrop" onClick={() => setShowVidModal(false)}>
          <div className="img-vid-modal" onClick={e => e.stopPropagation()}>
            <div className="tool-modal-header">
              <div className="tool-modal-title-row">
                <span className="tool-modal-icon">🎬</span>
                <h2>{vidUploadFile ? 'Image-to-Video' : 'Video Generator'}</h2>
                {vidUploadFile && <span className="img-mode-badge">Animate Mode</span>}
              </div>
              <button className="tool-modal-close" onClick={() => setShowVidModal(false)}>✕</button>
            </div>
            <div className="tool-modal-body">

              {/* Upload zone */}
              <input
                ref={vidFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleVidUpload}
              />
              {!vidUploadFile ? (
                <button className="img-upload-zone" onClick={() => vidFileInputRef.current?.click()}>
                  <span className="img-upload-zone-icon">📎</span>
                  <span className="img-upload-zone-label">Upload an image to animate</span>
                  <span className="img-upload-zone-sub">Sora will bring your image to life · Optional</span>
                </button>
              ) : (
                <div className="img-upload-preview-wrap">
                  <img src={vidUploadPreview} alt="Reference frame" className="img-upload-preview" />
                  <div className="img-upload-preview-overlay">
                    <span className="img-upload-preview-name">{vidUploadFile.name}</span>
                    <button className="img-upload-clear" onClick={clearVidUpload}>✕ Remove</button>
                  </div>
                </div>
              )}

              {/* Quick suggestions */}
              <div className="img-edit-suggestions">
                <span className="img-edit-suggestions-label">
                  {vidUploadFile ? 'Animate with:' : 'Quick ideas:'}
                </span>
                <div className="img-edit-pills">
                  {(vidUploadFile ? [
                    'Animate with cinematic camera pan',
                    'Add dramatic wind and movement',
                    'Bring to life with slow motion',
                    'Add golden hour lighting',
                    'Make it rain in this scene',
                    'Add flowing water effects',
                    'Create a zoom-out reveal',
                    'Add sunrise time-lapse effect',
                  ] : [
                    'Cinematic African savanna at sunset',
                    'City skyline timelapse night to day',
                    'Product showcase on rotating pedestal',
                    'Abstract flowing gold particles',
                    'Aerial drone view of mountains',
                    'Tropical beach waves slow motion',
                    'Modern office space walkthrough',
                    'Animated logo reveal with light rays',
                    'Forest with rays of sunlight',
                    'Futuristic city with flying cars',
                  ]).map(s => (
                    <button key={s} className="img-edit-pill"
                      onClick={() => setVidPrompt(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="tool-modal-textarea"
                placeholder={vidUploadFile
                  ? 'Describe how to animate this image — e.g. "Add cinematic camera pan from left to right with golden hour lighting"…'
                  : 'Describe the video scene — e.g. "A lion walking through golden savanna at sunset, cinematic slow motion, 4K quality"…'}
                value={vidPrompt}
                onChange={e => setVidPrompt(e.target.value)}
                rows={3}
                autoFocus={!vidUploadFile}
              />

              <div className="tool-modal-options">
                <div className="tool-modal-opt-group">
                  <span className="tool-modal-opt-label">Duration</span>
                  <div className="tool-modal-pills">
                    {[{ val: '4', label: '4 sec' }, { val: '8', label: '8 sec' }, { val: '12', label: '12 sec' }].map(d => (
                      <button key={d.val} className={`tool-modal-pill${vidDuration === d.val ? ' active' : ''}`}
                        onClick={() => setVidDuration(d.val)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tool-modal-opt-group">
                  <span className="tool-modal-opt-label">Format</span>
                  <div className="tool-modal-pills">
                    {[
                      { val: '1280x720',  label: 'Landscape' },
                      { val: '720x1280',  label: 'Portrait' },
                    ].map(s => (
                      <button key={s.val} className={`tool-modal-pill${vidSize === s.val ? ' active' : ''}`}
                        onClick={() => setVidSize(s.val)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="tool-modal-note">Powered by Sora · Takes 3–5 minutes · Uses 100 credits</p>
              {vidError && <p className="tool-modal-error">{vidError}</p>}

              <button className="tool-modal-gen-btn vid" onClick={generateVideoInModal}
                disabled={!vidPrompt.trim() || vidLoading}>
                {vidLoading
                  ? `🎬 Generating${vidProgress > 0 ? ` — ${vidProgress}%` : '…'}`
                  : (vidUploadFile ? '🎬 Animate Image' : '🎬 Generate Video')}
              </button>

              {vidLoading && (
                <div className="tool-modal-status">
                  <div className="gen-spinner" />
                  <span>
                    {vidUploadFile ? 'Animating with Sora' : 'Generating with Sora'}
                    {vidProgress > 0 ? ` — ${vidProgress}%` : '…'}
                    <span className="gen-eta"> (3–5 min)</span>
                  </span>
                </div>
              )}

              {vidResult && (
                <div className="tool-modal-result">
                  <video src={vidResult} controls className="tool-modal-video" />
                  <div className="tool-modal-actions">
                    <a href={vidResult} download="256ai-video.mp4" className="doc-btn gold">
                      ⬇ Download MP4
                    </a>
                    <button className="doc-btn regen-btn" onClick={generateVideoInModal}
                      disabled={vidLoading}>
                      ↺ Generate Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Contract Builder Modal ──────────────────────────────────── */}
      {showContractModal && (
        <div className="tool-overlay-backdrop" onClick={() => setShowContractModal(false)}>
          <div className="tool-overlay-modal" onClick={e => e.stopPropagation()}>
            <button className="tool-overlay-close" onClick={() => setShowContractModal(false)}>✕ Close</button>
            <Suspense fallback={<div className="tool-overlay-loading"><div className="gen-spinner" /><span>Loading…</span></div>}>
              <ContractPage />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Logo Generator Modal ────────────────────────────────────── */}
      {showLogoModal && (
        <div className="tool-overlay-backdrop" onClick={() => setShowLogoModal(false)}>
          <div className="tool-overlay-modal" onClick={e => e.stopPropagation()}>
            <button className="tool-overlay-close" onClick={() => setShowLogoModal(false)}>✕ Close</button>
            <Suspense fallback={<div className="tool-overlay-loading"><div className="gen-spinner" /><span>Loading…</span></div>}>
              <LogoPage />
            </Suspense>
          </div>
        </div>
      )}

      {showDTBuy && (
        <DeepThinkBuyModal
          onClose={() => setShowDTBuy(false)}
          onSuccess={(credits) => {
            setShowDTBuy(false);
            setUsage(prev => prev ? { ...prev, deep_think_credits: (prev.deep_think_credits || 0) + credits } : prev);
            setMode('deep_think');
          }}
          authFetch={authFetch}
        />
      )}

      {showLengthPicker && (
        <div className="length-picker-backdrop" onClick={() => { pendingMsgRef.current = ''; setShowLengthPicker(false); }}>
          <div className="length-picker" onClick={e => e.stopPropagation()}>
            <div className="length-picker-title">How long should the response be?</div>
            <div className="length-picker-subtitle">Choose one to continue</div>
            <button className="length-picker-opt" onClick={() => pickLength('auto')}>
              <span className="lp-label">Auto</span>
              <span className="lp-desc">AI decides the best length</span>
            </button>
            <button className="length-picker-opt" onClick={() => pickLength('brief')}>
              <span className="lp-label">Brief</span>
              <span className="lp-desc">Under 300 words</span>
            </button>
            <button className="length-picker-opt" onClick={() => pickLength('medium')}>
              <span className="lp-label">Medium</span>
              <span className="lp-desc">Under 500 words</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
