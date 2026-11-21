/* How this actually works — diagrams that show the real path of a turn. */
(() => {
  const $ = (s) => document.querySelector(s);

  /* ---------- theme + progress ---------- */
  const saved = localStorage.getItem('hiw.theme');
  if (saved) document.documentElement.dataset.theme = saved;
  $('#theme').onclick = () => {
    const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    localStorage.setItem('hiw.theme', n);
  };
  const bar = $('#progress');
  addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = Math.min(100, (scrollY / Math.max(1, h)) * 100) + '%';
  }, { passive: true });

  /* ---------- 01 journey ---------- */
  const STATIONS = [
    { k: 'you', t: 'Your phone', s: 'Telegram app', c: 'var(--phone)', d: 'You type a message. That is the entire role of your device — it captures a keystroke and draws the reply later.' },
    { k: 'tg', t: 'Telegram servers', s: 'message relay', c: 'var(--phone)', d: 'Telegram receives the message and routes it to the bot token belonging to this agent. Telegram sees the message; it is not encrypted end-to-end for bots.' },
    { k: 'gw', t: 'Gateway', s: 'my container · port', c: 'var(--net)', d: 'A long-polling or webhook listener inside the container receives it, checks the sender is allowed, and hands it to Hermes with a fresh session context.' },
    { k: 'her', t: 'Hermes agent', s: 'orchestrator', c: 'var(--net)', d: 'Hermes assembles the prompt: system rules, memory file, skills index, conversation so far. It decides nothing about content — the model does.' },
    { k: 'api', t: 'DeepSeek API', s: 'their GPUs', c: 'var(--api)', d: 'The assembled prompt goes over HTTPS to DeepSeek. That is where the actual computation happens, on hardware you neither own nor pay for by the hour.' },
    { k: 'back', t: 'Tools run here', s: 'shell · files · browser', c: 'var(--disk)', d: 'If the answer needs a fact, Hermes executes a tool in the container and sends the result back to the model as another message. Loop until done.' },
    { k: 'ret', t: 'Reply home', s: 'same path backwards', c: 'var(--phone)', d: 'Final text goes back through the gateway to Telegram, down to your phone, which renders it. Your CPU never touched the reasoning.' },
  ];

  const J = $('#journey');
  J.innerHTML = `<svg viewBox="0 0 960 150" role="img" aria-label="A message travels from phone to Telegram to gateway to Hermes to DeepSeek and back">
    <line x1="40" y1="60" x2="920" y2="60" stroke="var(--line2)" stroke-width="1.5" stroke-dasharray="4 5"/>
    ${STATIONS.map((s, i) => {
      const x = 52 + i * 143;
      return `<g class="stn" data-i="${i}" tabindex="0" style="cursor:pointer">
        <circle cx="${x}" cy="60" r="15" fill="var(--panel)" stroke="${s.c}" stroke-width="2"/>
        <text x="${x}" y="65" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="${s.c}">${i + 1}</text>
        <text x="${x}" y="96" text-anchor="middle" font-family="var(--sans)" font-size="11.5" font-weight="600" fill="var(--ink)">${s.t}</text>
        <text x="${x}" y="112" text-anchor="middle" font-family="var(--mono)" font-size="8.6" fill="var(--muted)">${s.s}</text>
      </g>`;
    }).join('')}
    <circle id="pulse" cx="52" cy="60" r="5" fill="var(--net)" opacity="0"/>
  </svg>`;

  let pulseIdx = 0;
  const pulse = $('#pulse');
  setInterval(() => {
    const x = 52 + pulseIdx * 143;
    pulse.setAttribute('cx', x);
    pulse.setAttribute('opacity', '0.95');
    J.querySelectorAll('.stn').forEach((g, i) => g.style.opacity = i === pulseIdx ? '1' : '.55');
    pulseIdx = (pulseIdx + 1) % STATIONS.length;
    if (pulseIdx === 0) setTimeout(() => pulse.setAttribute('opacity', '0'), 200);
  }, 1100);

  J.querySelectorAll('.stn').forEach((g) => {
    const show = () => {
      const s = STATIONS[+g.dataset.i];
      $('#journeyNote').innerHTML = `<b style="color:${s.c}">${s.t}</b> — ${s.d}`;
    };
    g.addEventListener('click', show);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(); });
  });

  /* ---------- 02 filesystem ---------- */
  const FS = [
    ['/opt/data/config.yaml', 'the agent\'s settings: model, provider, toolsets, cron', 'var(--net)'],
    ['/opt/data/memories/', 'the two small files injected into every prompt — who you are, environment facts', 'var(--disk)'],
    ['/opt/data/sessions/', 'conversation transcripts, one per session', 'var(--disk)'],
    ['/opt/data/skills/', 'procedural memory: SKILL.md files loaded only when relevant', 'var(--disk)'],
    ['/opt/data/cron/', 'scheduled jobs and their state (your job digest lives here)', 'var(--api)'],
    ['/opt/data/work/', 'every POC I built — Portfolio, meeting-notes, all of it', 'var(--phone)'],
    ['/opt/data/scripts/', 'the scripts cron runs: balance report, internship scraper', 'var(--api)'],
  ];
  $('#fs').innerHTML = FS.map(([p, d, c]) => `
    <div class="fsrow">
      <span class="path mono" style="color:${c}">${p}</span>
      <span class="what">${d}</span>
    </div>`).join('');

  /* ---------- 03 payload growth ---------- */
  const PARTS = [
    { k: 'System prompt', kb: 6, c: 'var(--muted)', note: 'rules, tool definitions, formatting' },
    { k: 'Memory files', kb: 2, c: 'var(--disk)', note: 'facts injected every turn' },
    { k: 'Skills index', kb: 3, c: 'var(--net)', note: 'names + descriptions only' },
    { k: 'Conversation', kb: 0, c: 'var(--api)', note: 'grows with every exchange' },
    { k: 'Tool results', kb: 0, c: 'var(--phone)', note: 'file reads, command output' },
  ];
  $('#payload').innerHTML = `<div class="pl-bar" id="plBar"></div>
    <div class="pl-legend">${PARTS.map((p) => `<span><i style="background:${p.c}"></i>${p.k}</span>`).join('')}</div>`;
  $('#grow').innerHTML = `
    <label class="slider-row mono">turns into the conversation <b id="turnsVal">1</b>
      <input id="turns" type="range" min="1" max="60" value="1"></label>
    <div class="pl-bar big" id="plBar2"></div>
    <p class="hint" id="growNote"></p>`;

  function drawPayload() {
    const turns = +$('#turns').value;
    const conv = Math.round(turns * 3.2);          // KB per exchange, roughly
    const tools = Math.round(turns * 1.1);
    const total = 6 + 2 + 3 + conv + tools;
    const scale = Math.max(60, total);
    const segs = [
      ['System prompt', 6, 'var(--muted)'],
      ['Memory', 2, 'var(--disk)'],
      ['Skills index', 3, 'var(--net)'],
      ['Conversation', conv, 'var(--api)'],
      ['Tool results', tools, 'var(--phone)'],
    ];
    const html = segs.filter((s) => s[1] > 0)
      .map(([n, v, c]) => `<i style="width:${(v / scale * 100).toFixed(1)}%;background:${c}" title="${n}: ${v} KB"></i>`).join('');
    $('#plBar').innerHTML = html;
    $('#plBar2').innerHTML = html;
    $('#turnsVal').textContent = turns;
    $('#growNote').innerHTML = `About <b>${total} KB</b> sent on turn ${turns}. ` +
      (turns > 25
        ? 'Past this point the cost is mostly re-sending history — which is why compaction exists, and why a long session costs more per message than a short one.'
        : 'Early turns are cheap: most of the payload is constant overhead, not your conversation.');
  }
  $('#turns').addEventListener('input', drawPayload);
  drawPayload();

  /* ---------- 04 memory types ---------- */
  const MEM = [
    { t: 'Prompt memory', where: 'memories/*.md', life: 'forever, until edited', note: 'Small declarative facts injected into every single turn. Costs tokens on every message, which is why it is capped at ~2 KB.', c: 'var(--disk)' },
    { t: 'Conversation', where: 'sessions/*.json', life: 'one session', note: 'The transcript. Re-sent in full each turn, so its size is what drives cost. Compacted when it grows too large.', c: 'var(--api)' },
    { t: 'Skills', where: 'skills/**/SKILL.md', life: 'forever', note: 'Procedures loaded only when relevant — an index of names is always present, the body only when matched.', c: 'var(--net)' },
    { t: 'Model weights', where: 'DeepSeek servers', life: 'not mine', note: 'The model itself never learns from you between turns. There is no training on your conversations in this setup.', c: 'var(--gpu)' },
  ];
  $('#mem').innerHTML = MEM.map((m) => `
    <div class="memcard">
      <div class="memtop"><b style="color:${m.c}">${m.t}</b><span class="mono">${m.where}</span></div>
      <p>${m.note}</p>
      <div class="memfoot mono">lifetime: ${m.life}</div>
    </div>`).join('');

  /* ---------- 05 tool loop ---------- */
  const LOOP = [
    ['You', 'Build an NVR simulator', 'phone'],
    ['Model', 'wants to write_files', 'api'],
    ['Hermes', 'runs the tool in the container', 'net'],
    ['Files', '/opt/data/work/nvr-simulator', 'disk'],
    ['Model', 'sees the result, continues', 'api'],
    ['You', 'final answer arrives', 'phone'],
  ];
  $('#loop').innerHTML = LOOP.map(([who, what, c], i) => `
    <div class="loopstep" style="--c:var(--${c})">
      <span class="ln mono">${i + 1}</span>
      <div><b>${who}</b><p>${what}</p></div>
    </div>`).join('');

  /* ---------- 06 compare ---------- */
  $('#compare').innerHTML = `
    <div class="cmp do">
      <h3>Your Mac does</h3>
      <ul><li>draw the Telegram UI</li><li>send keystrokes</li><li>display the reply</li></ul>
    </div>
    <div class="cmp dont">
      <h3>Your Mac does not</h3>
      <ul><li>run the model</li><li>run the browser or shell</li><li>store the memory</li><li>matter for speed at all</li></ul>
    </div>`;

  /* ---------- 07 limits ---------- */
  const LIMITS = [
    ['The container is disposable', 'Memory, sessions and cron live on this disk. Destroy the container and they are gone — there is no backup I keep.'],
    ['No GPU here', '3.9 GB RAM. Anything needing a GPU, a local LLM, or a big model is off the table without external hardware.'],
    ['The model forgets everything', 'Between turns it has no state. Continuity is an illusion built by re-sending history — which costs money and eventually needs compaction.'],
    ['Telegram sees the text', 'Bot conversations are not end-to-end encrypted. Never paste passwords, OTPs or other people\'s personal data.'],
    ['Tools are real', 'Shell, files and browser can change things. Every destructive action is a decision, not a demonstration.'],
    ['Cost tracks length, not effort', 'A long session re-sends a long context every turn. That is why the burn rate rose during big builds.'],
  ];
  $('#limitsGrid').innerHTML = LIMITS.map(([t, d]) => `<div class="lim"><b>${t}</b><p>${d}</p></div>`).join('');

  document.documentElement.dataset.ready = '1';
})();
