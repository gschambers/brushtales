const app = document.querySelector('#app')
const tools = document.querySelector('#prototype-tools')
const reduceMotion = document.querySelector('#reduce-motion')
const showCamera = document.querySelector('#show-camera')
const envelope = [0.25, 0.42, 0.7, 0.38, 0.55, 0.3]
const params = new URLSearchParams(window.location.search)
const fastDemo = params.get('fast') === '1'
const zoneDurationMs = fastDemo ? 1_500 : 6_667
const profileStorageKey = 'brushtales.prototype.profileName'
const sessionStates = ['preflight', 'opening', 'running', 'paused', 'audioOnly', 'closing', 'choice']
const sessionTones = [
  { id: 'peach', paper: '#fff7f2', light: '#ffebe2', soft: '#fbd8ca', main: '#f4b5a3', accent: '#e99a8c', deep: '#8b5a58', ring: 'rgba(175,115,107,.62)', dash: 'rgba(233,154,140,.62)' },
  { id: 'mint', paper: '#f3faf7', light: '#e3f4ed', soft: '#cce9dc', main: '#add9c8', accent: '#87c8b1', deep: '#4a746c', ring: 'rgba(105,164,145,.62)', dash: 'rgba(135,200,177,.62)' },
  { id: 'sky', paper: '#f2f8fb', light: '#e4f1f6', soft: '#c9e7f2', main: '#a9d4e2', accent: '#80b9cd', deep: '#4d6f7c', ring: 'rgba(104,157,177,.62)', dash: 'rgba(128,185,205,.62)' },
  { id: 'lilac', paper: '#f7f4fc', light: '#eee8f8', soft: '#dcd0f0', main: '#c8b8e6', accent: '#a98bd4', deep: '#66527c', ring: 'rgba(137,112,176,.62)', dash: 'rgba(169,139,212,.62)' },
  { id: 'butter', paper: '#fffaf0', light: '#fff3cf', soft: '#f8e5a9', main: '#f4d985', accent: '#e4bf67', deep: '#80683a', ring: 'rgba(180,150,75,.62)', dash: 'rgba(228,191,103,.62)' },
]

function storedProfileName() {
  try {
    return window.localStorage.getItem(profileStorageKey) || ''
  } catch {
    return ''
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character])
}

let state = params.get('state') || 'welcome'
let zoneIndex = Number(params.get('zone') || 0) % 18
let profileName = params.get('profile')?.trim() || storedProfileName()
let phase = 0
let settingsHoldTimer = null
let settingsHoldTarget = null
const requestedToneId = params.get('tone')

function toneById(id) {
  return sessionTones.find((tone) => tone.id === id)
}

function chooseSessionTone() {
  return toneById(requestedToneId) || sessionTones[Math.floor(Math.random() * sessionTones.length)]
}

let sessionTone = sessionStates.includes(state) ? chooseSessionTone() : null

if (params.get('tools') === '1') tools.hidden = false

const stateLabels = {
  welcome: 'Welcome',
  profile: 'Create a profile',
  preflight: 'Opening audiobook',
  opening: 'Opening audiobook',
  running: 'Brushing chapter',
  paused: 'Chapter paused',
  audioOnly: 'Listening mode',
  closing: 'Closing audiobook',
  choice: 'Story choice',
  settings: 'Settings',
  complete: 'Chapter complete',
}

const zoneBands = [
  { id: 'upper-front', surface: 'front', arch: 'upper', label: 'Top teeth · front' },
  { id: 'upper-chewing', surface: 'chewing', arch: 'upper', label: 'Top teeth · chewing surfaces' },
  { id: 'upper-inside', surface: 'inside', arch: 'upper', label: 'Top teeth · inside' },
  { id: 'lower-front', surface: 'front', arch: 'lower', label: 'Bottom teeth · front' },
  { id: 'lower-chewing', surface: 'chewing', arch: 'lower', label: 'Bottom teeth · chewing surfaces' },
  { id: 'lower-inside', surface: 'inside', arch: 'lower', label: 'Bottom teeth · inside' },
]

const zones = zoneBands.flatMap((band) => ['left', 'center', 'right'].map((position, index) => ({
  ...band,
  position,
  positionLabel: position === 'center' ? 'center' : `${position} side`,
  positionIndex: index,
})))
const groupForPosition = (positionIndex) => positionIndex >= 7 ? 2 : positionIndex >= 3 && positionIndex < 7 ? 1 : 0

function button(label, action, className = '') {
  return `<button class="${className}" data-action="${action}">${label}</button>`
}

function toothbrush(activeZone, arch) {
  const brushPositionIndex = arch === 'lower' ? 2 - activeZone.positionIndex : activeZone.positionIndex
  const brushX = [16.7, 50, 83.3][brushPositionIndex]
  return `<span class="toothbrush" data-arch="${arch}" style="--brush-x:${brushX}%" aria-hidden="true"><img src="./assets/openmoji-toothbrush.svg" alt="" draggable="false" /></span>`
}

function teethRow(arch, activeZone) {
  const teeth = Array.from({ length: 10 }, (_, index) => {
    const positionIndex = arch === 'lower' ? 9 - index : index
    const active = activeZone.arch === arch && groupForPosition(positionIndex) === activeZone.positionIndex
    return `<span class="tooth ${active ? 'highlight' : ''}" aria-hidden="true"></span>`
  }).join('')
  const rowClass = arch === 'lower' ? 'lower-arch' : 'upper-arch'
  const brush = activeZone.arch === arch ? toothbrush(activeZone, arch) : ''
  return `<div class="teeth-row ${rowClass} ${activeZone.surface}" aria-hidden="true">${teeth}${brush}</div>`
}

function atlas() {
  const activeZone = zones[zoneIndex]
  return `<figure class="mouth-guide" role="img" aria-label="${activeZone.label}, ${activeZone.positionLabel} highlighted">
    <div class="mouth-map ${activeZone.surface}">
      ${teethRow('upper', activeZone)}
      ${teethRow('lower', activeZone)}
    </div>
  </figure>`
}

function topbar(eyebrow = stateLabels[state]) {
  const exit = sessionStates.includes(state) ? button('← Exit', 'welcome', 'exit-button') : ''
  return `<header class="topbar"><div><p class="eyebrow">${eyebrow}</p><div class="brand">BrushTales</div></div><div class="topbar-actions">${exit}</div></header>`
}

function sessionStyle(tone) {
  return `--session-paper:${tone.paper};--session-light:${tone.light};--session-soft:${tone.soft};--session-main:${tone.main};--session-accent:${tone.accent};--session-deep:${tone.deep};--session-ring:${tone.ring};--session-dash:${tone.dash}`
}

function countdown(remainingSeconds = 120) {
  return `<div class="countdown" role="status" aria-label="${remainingSeconds} seconds remaining"><span aria-hidden="true">${remainingSeconds}</span></div>`
}

function playback(mode) {
  const isPause = mode === 'pause'
  const label = mode === 'play' ? 'Begin story' : isPause ? 'Pause adventure' : 'Resume adventure'
  const glyph = isPause
    ? '<span class="pause-glyph" aria-hidden="true"><i></i><i></i></span>'
    : '<svg class="play-glyph" aria-hidden="true" viewBox="0 0 28 28"><path d="M8 5.5 20 14 8 22.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>'
  return `<div class="playback-wrap"><button class="playback ${isPause ? 'pause' : ''}" data-action="${mode === 'play' ? 'running' : isPause ? 'paused' : 'running'}" aria-label="${label}">${glyph}</button><div class="audio-visualizer ${isPause ? 'active' : 'paused'}" aria-hidden="true"><div class="ring ${isPause ? 'playing' : ''}" id="ring"></div></div></div>`
}

function cameraPreview() {
  const visible = showCamera?.checked && state === 'running'
  return `<div class="camera-preview ${visible ? '' : 'camera-preview-hidden'}" ${visible ? 'role="img" aria-label="Camera helper on"' : 'aria-hidden="true"'}></div>`
}

function settingsControl() {
  return '<button class="settings-hold" id="settings-hold" data-action="settingsHold" aria-label="Open settings by holding">⚙</button>'
}

function render({ restartTimers = true } = {}) {
  const safeProfileName = escapeHtml(profileName)
  const welcome = profileName
    ? `<p class="eyebrow">Welcome back</p><h1>BrushTales</h1><p class="welcome-name">Ready for another adventure, ${safeProfileName}?</p>${button('Start an adventure', 'opening', 'primary')}`
    : `<h1>BrushTales</h1>${button('Create a profile', 'profile', 'primary')}`
  const welcomeScreen = `<section class="content hero welcome-screen ${profileName ? 'warm-welcome' : ''}">${welcome}${profileName ? settingsControl() : ''}</section>`
  const openingScreen = `<section class="content form-card act-screen"><p class="eyebrow">Act 1 · Opening audiobook</p><h2>The Sky Reef is waking.</h2><p class="lede">The opening story leads us toward a bright path through the clouds. When you’re ready, begin the story and we’ll brush together.</p><div class="stack">${button('Begin story', 'running', 'primary')}</div></section>`
  const closingScreen = `<section class="content form-card act-screen"><p class="eyebrow">Act 3 · Closing audiobook</p><h2>The crew found the way home.</h2><p class="lede">Listen to the chapter’s gentle ending, then choose what the Sky Reef crew explores next.</p>${button('Continue to story choice', 'choice', 'primary')}</section>`
  const controls = {
    welcome: welcomeScreen,
    profile: `<section class="content form-card profile-form"><h2>Create a profile</h2><label class="sr-only" for="profile-name">Child's name</label><input class="profile-name-input" id="profile-name" type="text" maxlength="40" autocomplete="off" placeholder="Child's name" /><div class="row">${button('Continue', 'saveProfile', 'primary')}${button('Back', 'welcome', 'secondary')}</div></section>`,
    preflight: openingScreen,
    opening: openingScreen,
    running: `<section class="content session-content">${cameraPreview()}${countdown()}<div class="session-visual">${playback('pause')}<div class="lower">${atlas()}</div></div></section>`,
    paused: `<section class="content session-content">${cameraPreview()}${countdown()}<div class="session-visual">${playback('resume')}<div class="lower">${atlas()}</div></div></section>`,
    audioOnly: `<section class="content session-content">${cameraPreview()}${countdown()}<div class="session-visual">${playback('pause')}<div class="lower">${atlas()}</div></div></section>`,
    closing: closingScreen,
    choice: `<section class="content choice-sheet"><p class="eyebrow">The story is waiting</p><h2>Which path should guide the sky-reef voyage?</h2><p class="lede">Choose a sound to follow.</p><div class="choice-grid">${button('<strong>Follow the bubbles</strong><span>They shimmer below.</span>', 'running')}${button('<strong>Chase the silver clouds</strong><span>They glow above.</span>', 'running')}</div></section>`,
    settings: `<section class="content settings-screen"><h2>Settings</h2><p class="lede">A grown-up can adjust the adventure here.</p>${button('Back to stories', 'welcome', 'secondary')}</section>`,
    complete: `<section class="content hero"><p class="eyebrow">The chapter is complete</p><h1>You kept exploring.</h1><p class="lede">The Sky Reef crew will remember the path you chose.</p><div class="stack">${button('Return to profiles', 'welcome', 'primary')}</div></section>`,
  }
  const pageHeading = ['welcome', 'complete'].includes(state) ? '' : `<h1 class="sr-only">${stateLabels[state]}</h1>`
  const chrome = ['welcome', 'profile', 'preflight', 'opening', 'settings'].includes(state) ? '' : topbar(stateLabels[state])
  const sessionView = sessionStates.includes(state) || state === 'preflight'
  const appClass = sessionView ? 'app session-app' : 'app'
  const toneAttributes = sessionView && sessionTone ? `data-tone="${sessionTone.id}" style="${sessionStyle(sessionTone)}"` : ''
  app.innerHTML = `<div class="${appClass}" ${toneAttributes}>${chrome}${pageHeading}${controls[state]}</div>`
  if (restartTimers) {
    syncZoneTimer()
    startEnvelope()
  }
}

function startEnvelope() {
  window.clearInterval(startEnvelope.timer)
  const ring = document.querySelector('#ring')
  if (state !== 'running' || !ring || reduceMotion?.checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  startEnvelope.timer = window.setInterval(() => {
    phase = (phase + 1) % envelope.length
    ring.style.setProperty('--level', String(1 + envelope[phase] * 0.12))
  }, 280)
}

function syncZoneTimer() {
  window.clearInterval(syncZoneTimer.timer)
  if (!['running', 'audioOnly'].includes(state)) return
  syncZoneTimer.timer = window.setInterval(() => {
    if (zoneIndex === zones.length - 1) {
      state = 'closing'
      render()
      return
    }
    zoneIndex = (zoneIndex + 1) % zones.length
    render({ restartTimers: false })
  }, zoneDurationMs)
}

function stopSettingsHold() {
  window.clearInterval(settingsHoldTimer)
  settingsHoldTimer = null
  settingsHoldTarget?.style.setProperty('--hold-progress', '0%')
  settingsHoldTarget = null
}

function startSettingsHold(target) {
  stopSettingsHold()
  settingsHoldTarget = target
  const startedAt = performance.now()
  settingsHoldTimer = window.setInterval(() => {
    const progress = Math.min((performance.now() - startedAt) / 1_200, 1)
    target.style.setProperty('--hold-progress', `${progress * 100}%`)
    if (progress >= 1) {
      stopSettingsHold()
      state = 'settings'
      render()
    }
  }, 30)
}

app.addEventListener('pointerdown', (event) => {
  const target = event.target.closest('#settings-hold')
  if (!target) return
  event.preventDefault()
  startSettingsHold(target)
})

window.addEventListener('pointerup', stopSettingsHold)
window.addEventListener('pointercancel', stopSettingsHold)

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  if (target.dataset.action === 'settingsHold') return
  if (target.dataset.action === 'saveProfile') {
    const input = document.querySelector('#profile-name')
    const name = input?.value.trim() || ''
    if (!name) {
      input?.focus()
      return
    }
    profileName = name
    try {
      window.localStorage.setItem(profileStorageKey, profileName)
    } catch {
      // The prototype still works for this session when storage is unavailable.
    }
    state = 'welcome'
    render()
    return
  }
  const nextState = target.dataset.action
  if (nextState === 'opening' && !sessionStates.includes(state)) sessionTone = chooseSessionTone()
  state = nextState
  render()
})

reduceMotion?.addEventListener('change', () => render())
showCamera?.addEventListener('change', () => render())
render()
