// PhishShield Simulator — core logic + optional AI generator (GPT‑5 nano via Cloudflare Worker)
(function(){
  // --- State
  const state = { round:0, total:0, score:0, mistakes:0, current:null, found:new Set(), scenarios:[], config:{ rounds:6, difficulty:'mix', useAI:false } };
  const LB_KEY = 'phishshield_lb_v1';

  // --- Elements
  const el = {
    start: qs('#btn-start'), how: qs('#btn-how'), tips: qs('#btn-tips'),
    lb: qs('#btn-leaderboard'), cert: qs('#btn-certificate'), contrast: qs('#btn-contrast'), dys: qs('#btn-dyslexia'),
    diff: qs('#difficulty'), rounds: qs('#rounds'), gen: qs('#btn-generate'), useAI: qs('#use-ai'),
    hudRound: qs('#hud-round'), hudTotal: qs('#hud-total'), hudScore: qs('#hud-score'), hudMistakes: qs('#hud-mistakes'),
    skip: qs('#btn-skip'), finish: qs('#btn-finish'), feedback: qs('#feedback'),
    from: qs('#field-from'), subject: qs('#field-subject'), body: qs('#email-body'), attach: qs('#attachments'),
    lbDlg: qs('#leaderboard-dialog'), lbList: qs('#leaderboard-list'), lbClose: qs('#btn-close-lb'), lbClear: qs('#btn-clear-lb'), lbSave: qs('#btn-save-score'), name: qs('#player-name'),
    howDlg: qs('#how-dialog'), howClose: qs('#btn-close-how'), tipsDlg: qs('#tips-dialog'), tipsClose: qs('#btn-close-tips'),
  };

  // --- Built-in sample scenarios (offline)
  const SCENARIOS = [
    { id:'obv-1', difficulty:1, from:'security@paypai.com', subject:'URGENT: Verify your account or it will be closed', html:`<p>Dear user,</p><p>Your account has been <strong>suspended</strong>. Please <a href="#" class="clickable phish" data-reason="Look‑alike domain & non‑HTTPS.">verify here</a> within 24 hours.</p><p>Regards,<br>PayPal Security</p>`, attachments:[], traps:[ {sel:'a.clickable.phish', reason:'Look‑alike domain and non‑HTTPS link'}, {sel:null, reason:'Sender domain mismatch: paypai.com ≠ paypal.com', virtual:'from'} ] },
    { id:'obv-2', difficulty:1, from:'it-support@example.com', subject:'Install required update', html:`<p>Hello,</p><p>An urgent update is required. Download and run this file: <button class="inline attachment phish" data-name="update.zip" data-reason="Unexpected compressed attachment.">update.zip</button></p><p>Thanks,<br>IT Support</p>`, attachments:[], traps:[ {sel:'.attachment.phish', reason:'Unexpected compressed attachment (.zip)'} ] },
    { id:'trk-1', difficulty:2, from:'Microsoft Account <no-reply@account.microsoft.com>', subject:'Unusual sign-in attempt', html:`<p>We detected a sign-in from <strong>New York, USA</strong>. If this was not you, <a href="#" class="clickable phish" data-reason="Phishy inline link; go to microsoft.com directly.">secure your account</a>.</p><p>Location: New York, USA<br>Device: Windows</p>`, attachments:[], traps:[ {sel:'a.clickable.phish', reason:'Inline link to unknown URL; open site directly'} ] },
    { id:'trk-2', difficulty:2, from:'Amazon <order-update@amazon.com>', subject:'Your package was returned — update address', html:`<p>Hi, package <strong>#114-223-884</strong> could not be delivered.</p><p>Update your address: <a href="#" class="clickable phish" data-reason="Link text looks legit but URL may be amaz0n.com.">Update address</a></p>`, attachments:[], traps:[ {sel:'a.clickable.phish', reason:'Possible look‑alike domain in hidden URL (amaz0n.com)'} ] },
    { id:'spr-1', difficulty:3, from:'Coach Rivera <coach.rivera@school-athletics.org>', subject:'Team roster doc — need your phone #', html:`<p>Hey Benjamin, great scrim today. Can you review the <a href="#" class="clickable phish" data-reason="Drive link requests phone # on fake form.">roster</a> and text me your number?</p>`, attachments:[], traps:[ {sel:'a.clickable.phish', reason:'Drive link asks for personal info (phone) on fake form'} ] },
  ];

  // --- Utilities
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function nameGen(){ const first=['Benjamin','Alex','Jordan','Taylor','Sam']; const last=['D','R','S','W','K']; return {first:rand(first), last:rand(last)}; }
  function toast(msg){ el.feedback.textContent = msg; el.feedback.className='feedback'; }

  // --- Leaderboard (local only for now)
  function lbLoad(){ try{ return JSON.parse(localStorage.getItem(LB_KEY))||[] }catch{return []} }
  function lbSave(list){ localStorage.setItem(LB_KEY, JSON.stringify(list)); }
  function lbAdd(name, score, rounds, mistakes){ const list=lbLoad(); list.push({name, score, rounds, mistakes, date:new Date().toISOString()}); list.sort((a,b)=> b.score-a.score || a.mistakes-b.mistakes); lbSave(list.slice(0,20)); }
  function lbRender(){ const list=lbLoad(); el.lbList.innerHTML=''; if(!list.length){ el.lbList.innerHTML='<li>No scores yet — be the first!</li>'; return; } list.forEach((e,i)=>{ const li=document.createElement('li'); li.textContent=`${i+1}. ${e.name} — ${e.score} pts / ${e.rounds} rounds (mistakes: ${e.mistakes})`; el.lbList.appendChild(li); }); }

  // --- Session control
  function start(){
    state.config.difficulty = el.diff.value;
    state.config.rounds = Math.max(3, Math.min(15, Number(el.rounds.value)||6));
    state.config.useAI = !!el.useAI?.checked;

    let pool = SCENARIOS.slice();
    if(state.config.difficulty!=='mix') pool = pool.filter(s=>String(s.difficulty)===String(state.config.difficulty));

    // Try to prefetch some AI scenarios (non-blocking)
    if (state.config.useAI && window.CONFIG?.ai?.endpoint) {
      Promise.all([genAIOnce(), genAIOnce()]).then(aiScenarios=>{
        aiScenarios.filter(Boolean).forEach(s=> pool.push(s));
      }).catch(()=>{});
    }

    state.scenarios = pool.sort(()=>Math.random()-0.5).slice(0, state.config.rounds);
    state.round=0; state.total=state.scenarios.length; state.score=0; state.mistakes=0; nextRound();
    el.cert.disabled = true;
  }

  function nextRound(){
    state.found.clear();
    if(state.round>=state.total){ endSession(); return; }
    state.current = state.scenarios[state.round];
    renderScenario(state.current); updateHud();
  }

  function renderScenario(s){
    el.from.textContent = s.from || 'unknown@mailer.example';
    el.subject.textContent = s.subject || 'Important notice';
    el.body.innerHTML = s.html || '<p>(empty message)</p>';
    el.attach.innerHTML = '';
    if(Array.isArray(s.attachments)) s.attachments.forEach(a=>{
      const chip = document.createElement('span'); chip.className='attachment clickable'; chip.textContent=a.name||a; chip.dataset.reason=a.reason||'Unexpected attachment'; chip.addEventListener('click', onTrapClick); el.attach.appendChild(chip);
    });
    (s.traps||[]).forEach((t,idx)=>{ if(t.sel){ qsa(t.sel, el.body).forEach(node=>{ node.dataset.trap = String(idx); node.addEventListener('click', onTrapClick); }); } });
    el.from.parentElement.classList.add('clickable-from');
    el.from.parentElement.addEventListener('click', onFromClick);
    el.feedback.textContent = 'Find all suspicious elements, then click Finish Round';
    el.feedback.className = 'feedback';
    el.finish.disabled = false;
  }

  function onTrapClick(e){
    const node = e.currentTarget; const reason = node.dataset.reason || trapReason(node.dataset.trap);
    const key = node.dataset.trap ? 'trap-'+node.dataset.trap : node.textContent;
    if(state.found.has(key)){ toast('Already marked.'); return; }
    state.found.add(key); node.classList.add('found');
    el.feedback.textContent = '✅ ' + reason; el.feedback.className = 'feedback ok';
    state.score += 10; updateHud();
  }
  function onFromClick(){
    const virtual = (state.current.traps||[]).find(t=>t.virtual==='from'); if(!virtual) return;
    const key='from'; if(state.found.has(key)){ toast('Already checked sender.'); return; }
    state.found.add(key); el.feedback.textContent = '✅ ' + virtual.reason; el.feedback.className = 'feedback ok';
    state.score += 10; updateHud();
  }
  function trapReason(idx){ const t=state.current.traps?.[Number(idx)]; return t? t.reason : 'Suspicious element'; }

  function finishRound(){
    const traps = state.current.traps||[]; let misses = 0;
    traps.forEach((t,i)=>{ const key = t.virtual==='from' ? 'from' : ('trap-'+i); if(!state.found.has(key)) misses++; });
    if(misses>0){ state.mistakes += misses; el.feedback.textContent = `You missed ${misses} item(s). Review the tells above.`; el.feedback.className = 'feedback warn'; }
    else { el.feedback.textContent = 'Great job — you found all tells!'; el.feedback.className = 'feedback ok'; state.score += 10; }
    state.round++; updateHud(); setTimeout(nextRound, 900);
  }

  function endSession(){
    el.feedback.textContent = `Session complete — score ${state.score} with ${state.mistakes} mistake(s). Save to leaderboard or download a certificate.`;
    el.feedback.className = 'feedback ok'; el.cert.disabled = false; setTimeout(()=>{ lbRender(); el.lbDlg.showModal(); }, 600);
  }

  function updateHud(){ el.hudRound.textContent = state.round+1>state.total? state.total: state.round+1; el.hudTotal.textContent = state.total; el.hudScore.textContent = state.score; el.hudMistakes.textContent = state.mistakes; }

  // --- AI generator via proxy (GPT‑5 nano)
  async function genAIOnce(){
    try{
      if(!window.CONFIG?.ai?.endpoint) return null;
      const theme = rand(['bank','delivery','school admin','password reset','software update']);
      const diff = state.config.difficulty==='mix' ? rand([1,2,3]) : Number(state.config.difficulty);
      const prompt = `Generate a short phishing email scenario as strict JSON with keys: from, subject, html, traps.
- html is email body HTML and must contain at least one clickable element (anchor <a> or button) that represents a phishing tell.
- traps is an array of objects; each has: sel (CSS selector within the html) or null, reason (string). Optionally set virtual:'from' for sender-domain issues.
- Difficulty: ${diff} (1 obvious, 2 tricky, 3 spear).
- Theme: ${theme}.
Return ONLY JSON.`;
      const res = await fetch(window.CONFIG.ai.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
      if(!res.ok){ return null; }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const json = tryParseJSON(content);
      if(!json) return null;
      return { id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, difficulty: diff, from: json.from||'no-reply@example.com', subject: json.subject||'Notice', html: json.html||'<p></p>', attachments:[], traps: Array.isArray(json.traps)? json.traps: [] };
    }catch(e){ console.warn('AI gen failed', e); return null; }
  }

  function tryParseJSON(text){
    try{ return JSON.parse(text); }catch{
      const m = text.match(/[\{\[].*[\}\]]/s); if(m) { try{ return JSON.parse(m[0]); }catch{} }
      return null;
    }
  }

  // --- Events
  el.start.addEventListener('click', start);
  el.skip.addEventListener('click', ()=>{ state.round++; nextRound(); });
  el.finish.addEventListener('click', finishRound);
  el.gen.addEventListener('click', async ()=>{
    state.config.useAI = !!el.useAI?.checked;
    if(state.config.useAI && window.CONFIG?.ai?.endpoint){
      toast('Generating with AI…'); const s = await genAIOnce(); if(s){ SCENARIOS.push(s); toast('Added 1 AI scenario. Start to include it.'); } else { toast('AI generation failed. Check your proxy endpoint.'); }
    } else {
      const base = rand(SCENARIOS); const copy = JSON.parse(JSON.stringify(base)); copy.id = `gen-${Date.now()}`; SCENARIOS.push(copy); toast('Added 1 offline scenario (template copy).');
    }
  });

  // Leaderboard
  el.lb.addEventListener('click', ()=>{ lbRender(); el.lbDlg.showModal(); });
  el.lbClose.addEventListener('click', ()=> el.lbDlg.close());
  el.lbClear.addEventListener('click', ()=>{ localStorage.removeItem(LB_KEY); lbRender(); });
  el.lbSave.addEventListener('click', ()=>{ const name = (el.name.value||'PLAYER').toUpperCase().slice(0,24); lbAdd(name, state.score, state.total, state.mistakes); lbRender(); el.name.value=''; });

  // Certificate
  el.cert.addEventListener('click', ()=>{ const url = new URL('./certificate.html', location.href); url.searchParams.set('name', (el.name?.value||'PLAYER').toUpperCase().slice(0,24)); url.searchParams.set('score', String(state.score)); url.searchParams.set('rounds', String(state.total)); url.searchParams.set('mistakes', String(state.mistakes)); window.open(url.toString(), '_blank'); });

  // Toggles & Modals
  el.contrast.addEventListener('click', ()=>{ const on = document.body.classList.toggle('contrast'); el.contrast.setAttribute('aria-pressed', on?'true':'false'); });
  el.dys.addEventListener('click', ()=>{ const on = document.body.classList.toggle('dyslexia'); el.dys.setAttribute('aria-pressed', on?'true':'false'); });
  el.how.addEventListener('click', ()=> el.howDlg.showModal()); el.howClose.addEventListener('click', ()=> el.howDlg.close());
  el.tips.addEventListener('click', ()=> el.tipsDlg.showModal()); el.tipsClose.addEventListener('click', ()=> el.tipsDlg.close());
})();
