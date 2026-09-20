const app = document.querySelector('#app')
const tools = document.querySelector('#prototype-tools')
const reduceMotion = document.querySelector('#reduce-motion')
const showCamera = document.querySelector('#show-camera')
const envelope = [0.25, 0.42, 0.7, 0.38, 0.55, 0.3]
const params = new URLSearchParams(window.location.search)
let state = params.get('state') || 'welcome'
let zone = 'front'
let phase = 0

if (params.get('tools') === '1') tools.hidden = false

const stateLabels = {
  welcome: 'Welcome',
  profile: 'Create an explorer',
  preflight: 'Ready for a chapter',
  running: 'Brushing chapter',
  paused: 'Chapter paused',
  audioOnly: 'Listening mode',
  choice: 'Story choice',
  complete: 'Chapter complete',
}

function button(label, action, className = '') {
  return `<button class="${className}" data-action="${action}">${label}</button>`
}

function atlas() {
  return `<div class="zone-atlas" role="group" aria-label="Brushing guide">
    <button class="zone ${zone === 'front' ? 'active' : ''}" data-zone="front" aria-pressed="${zone === 'front'}" aria-label="Front view${zone === 'front' ? ', active' : ''}"><span class="teeth"></span><span class="zone-label">Front</span></button>
    <button class="zone ${zone === 'upper' ? 'active' : ''}" data-zone="upper" aria-pressed="${zone === 'upper'}" aria-label="Upper view${zone === 'upper' ? ', active' : ''}"><span class="teeth upper"></span><span class="zone-label">Upper</span></button>
    <button class="zone ${zone === 'lower' ? 'active' : ''}" data-zone="lower" aria-pressed="${zone === 'lower'}" aria-label="Lower view${zone === 'lower' ? ', active' : ''}"><span class="teeth lower"></span><span class="zone-label">Lower</span></button>
  </div>`
}

function topbar(eyebrow = stateLabels[state], timer = '') {
  return `<header class="topbar"><div><p class="eyebrow">${eyebrow}</p><div class="brand">BrushTales</div></div>${timer ? `<p class="timer">${timer}</p>` : ''}</header>`
}

function playback(mode) {
  const isPause = mode === 'pause'
  const label = mode === 'play' ? 'Start adventure' : isPause ? 'Pause adventure' : 'Resume adventure'
  const glyph = isPause ? '<span>Ⅱ</span>' : '<span>▶</span>'
  return `<div class="playback-wrap"><div class="ring ${isPause ? 'playing' : ''}" id="ring" aria-hidden="true"></div><button class="playback ${isPause ? 'pause' : ''}" data-action="${mode === 'play' ? 'running' : isPause ? 'paused' : 'running'}" aria-label="${label}">${glyph}</button>${showCamera?.checked && state === 'running' ? '<div class="camera-tile" role="img" aria-label="Camera helper on">Camera<br />helper</div>' : ''}</div>`
}

function render() {
  const controls = {
    welcome: `<section class="content hero"><p class="eyebrow">An audio adventure for brushing time</p><h1>Let’s find the light beyond the clouds.</h1><p class="lede">A gentle story that moves with you while you brush.</p><div class="stack">${button('Set up an explorer', 'profile', 'primary')}${button('I have a profile', 'preflight', 'secondary')}</div><p class="small-note">Profiles and progress stay on this device.</p></section>`,
    profile: `<section class="content form-card"><h2>Create an explorer</h2><p class="lede">A grown-up can choose a nickname, avatar, and age group. No account needed.</p><div class="avatar-grid"><button class="avatar" aria-pressed="true"><span class="avatar-glyph">★</span>Star</button><button class="avatar" aria-pressed="false"><span class="avatar-glyph">☾</span>Moon manta</button><button class="avatar" aria-pressed="false"><span class="avatar-glyph">☁</span>Cloud fox</button><button class="avatar" aria-pressed="false"><span class="avatar-glyph">✦</span>Reef whale</button></div><div class="row">${button('Continue', 'preflight', 'primary')}${button('Back', 'welcome', 'secondary')}</div></section>`,
    preflight: `<section class="content form-card"><h2>Ready for a chapter?</h2><p class="lede">Keep brushing gently while the Sky Reef crew gets ready.</p><div class="stack"><span class="status">Audio is ready</span><span class="status">Camera helper is optional</span><span class="status">The screen will stay awake when it can</span></div><div class="row">${button('Begin chapter', 'running', 'primary')}${button('Continue with audio only', 'audioOnly', 'secondary')}</div><p class="small-note">A caregiver remains responsible for supervision. This is a habit-support adventure, not dental care.</p></section>`,
    running: `<section class="content"><div class="stage">${playback('pause')}</div><div class="lower"><p class="prompt">Let’s visit this side next.</p>${atlas()}</div><div class="bottom-actions">${button('Show story choice', 'choice', 'secondary')}${button('Use audio only', 'audioOnly', 'secondary')}</div></section>`,
    paused: `<section class="content"><div class="stage">${playback('resume')}</div><div class="lower"><p class="prompt">The crew is waiting.</p>${atlas()}</div><div class="bottom-actions">${button('Keep exploring', 'running', 'primary')}</div></section>`,
    audioOnly: `<section class="content"><div class="stage">${playback('pause')}</div><div class="lower"><span class="status">Listening mode</span><p class="prompt">The story can continue with audio.</p>${atlas()}</div><div class="bottom-actions">${button('Keep listening', 'running', 'primary')}${button('Finish chapter', 'complete', 'secondary')}</div></section>`,
    choice: `<section class="content choice-sheet"><p class="eyebrow">The story is waiting</p><h2>Which path should guide the sky-reef voyage?</h2><p class="lede">Choose a sound to follow.</p><div class="choice-grid">${button('<strong>Follow the bubbles</strong><span>They shimmer below.</span>', 'running')}${button('<strong>Chase the silver clouds</strong><span>They glow above.</span>', 'running')}</div></section>`,
    complete: `<section class="content hero"><p class="eyebrow">The chapter is complete</p><h1>You kept exploring.</h1><p class="lede">The Sky Reef crew will remember the path you chose.</p><div class="stack">${button('Return to profiles', 'welcome', 'primary')}</div></section>`,
  }
  const timer = ['running', 'paused', 'audioOnly'].includes(state) ? '1:42 left' : ''
  const pageHeading = ['welcome', 'complete'].includes(state) ? '' : `<h1 class="sr-only">${stateLabels[state]}</h1>`
  app.innerHTML = `<div class="app">${topbar(stateLabels[state], timer)}${pageHeading}${controls[state]}</div>`
  if (state === 'running' || state === 'audioOnly') startEnvelope()
}

function startEnvelope() {
  const ring = document.querySelector('#ring')
  if (!ring || reduceMotion?.checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  window.clearInterval(startEnvelope.timer)
  startEnvelope.timer = window.setInterval(() => {
    phase = (phase + 1) % envelope.length
    ring.style.setProperty('--level', String(1 + envelope[phase] * 0.12))
  }, 280)
}

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-zone], .avatar')
  if (!target) return
  if (target.dataset.zone) {
    zone = target.dataset.zone
    render()
    return
  }
  if (target.classList.contains('avatar')) {
    document.querySelectorAll('.avatar').forEach((avatar) => avatar.setAttribute('aria-pressed', String(avatar === target)))
    return
  }
  state = target.dataset.action
  render()
})

reduceMotion?.addEventListener('change', render)
showCamera?.addEventListener('change', render)
render()
