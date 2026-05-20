const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');

const cameraStatus = document.getElementById('cameraStatus');
const pitchValue = document.getElementById('pitchValue');
const modSpeedValue = document.getElementById('modSpeedValue');
const modDepthValue = document.getElementById('modDepthValue');
const pitchBar = document.getElementById('pitchBar');
const modSpeedBar = document.getElementById('modSpeedBar');
const modDepthBar = document.getElementById('modDepthBar');
const soundType = document.getElementById('soundType');

const startCameraBtn = document.getElementById('startCamera');
const startSoundBtn = document.getElementById('startSound');
const stopSoundBtn = document.getElementById('stopSound');
const resetBtn = document.getElementById('reset');

let handLandmarker;
let stream;
let running = false;
let lastVideoTime = -1;
let lastLeftX = null;
let lastTime = null;

let audioCtx;
let carrier;
let lfo;
let lfoGain;
let masterGain;

const PITCH_MIN = 200;
const PITCH_MAX = 1000;
const MOD_SPEED_MAX = 12;
const MOD_DEPTH_MAX = 180;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    cameraStatus.textContent = '相機已啟動，請將雙手放在鏡頭前。';
    running = true;
    detectLoop();
  } catch (err) {
    cameraStatus.textContent = '無法開啟相機：請檢查權限或裝置。';
  }
}

function setupAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  carrier = audioCtx.createOscillator();
  lfo = audioCtx.createOscillator();
  lfoGain = audioCtx.createGain();
  masterGain = audioCtx.createGain();

  carrier.type = 'sine';
  carrier.frequency.value = 440;

  lfo.type = 'sine';
  lfo.frequency.value = 0;
  lfoGain.gain.value = 0;

  lfo.connect(lfoGain);
  lfoGain.connect(carrier.detune);
  carrier.connect(masterGain);
  masterGain.connect(audioCtx.destination);
  masterGain.gain.value = 0.12;

  carrier.start();
  lfo.start();
}

function applySoundType(type) {
  if (!carrier || !masterGain || !lfo) return;
  if (type === 'robot') {
    carrier.type = 'square';
    masterGain.gain.value = 0.1;
    lfo.type = 'square';
  } else if (type === 'space') {
    carrier.type = 'sawtooth';
    masterGain.gain.value = 0.08;
    lfo.type = 'triangle';
  } else {
    carrier.type = type;
    masterGain.gain.value = 0.12;
    lfo.type = 'sine';
  }
}

function updateAudio(pitchHz, modSpeed, modDepthCents) {
  if (!audioCtx || !carrier) return;
  const t = audioCtx.currentTime;
  carrier.frequency.setTargetAtTime(pitchHz, t, 0.03);
  lfo.frequency.setTargetAtTime(modSpeed, t, 0.05);
  lfoGain.gain.setTargetAtTime(modDepthCents, t, 0.06);
}

function detectLoop() {
  if (!running || !handLandmarker) return;
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    drawAndMap(result);
  }
  requestAnimationFrame(detectLoop);
}

function drawAndMap(result) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!result.landmarks || !result.landmarks.length) return;

  let rightY = null;
  let leftX = null;
  const now = performance.now();

  result.landmarks.forEach((landmarks, i) => {
    const handed = result.handednesses?.[i]?.[0]?.categoryName;
    const tip = landmarks[8];
    const x = tip.x * overlay.width;
    const y = tip.y * overlay.height;

    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = handed === 'Right' ? '#62e4b4' : '#ff8ab3';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(handed || 'Hand', x + 10, y - 10);

    if (handed === 'Right') rightY = tip.y;
    if (handed === 'Left') leftX = tip.x;
  });

  if (rightY !== null) {
    const norm = 1 - clamp(rightY, 0, 1);
    const pitch = PITCH_MIN + norm * (PITCH_MAX - PITCH_MIN);
    pitchValue.textContent = `${pitch.toFixed(1)} Hz`;
    pitchBar.value = norm * 100;

    let modSpeed = 0;
    let modDepth = 0;
    if (leftX !== null && lastLeftX !== null && lastTime !== null) {
      const dt = (now - lastTime) / 1000;
      if (dt > 0) {
        const speed = Math.abs(leftX - lastLeftX) / dt;
        modSpeed = clamp(speed * 3.2, 0, MOD_SPEED_MAX);
        modDepth = clamp(speed * 55, 0, MOD_DEPTH_MAX);
      }
    }
    if (leftX !== null) {
      lastLeftX = leftX;
      lastTime = now;
    }

    modSpeedValue.textContent = `${modSpeed.toFixed(1)} Hz`;
    modDepthValue.textContent = `${modDepth.toFixed(0)} cents`;
    modSpeedBar.value = (modSpeed / MOD_SPEED_MAX) * 100;
    modDepthBar.value = (modDepth / MOD_DEPTH_MAX) * 100;

    updateAudio(pitch, modSpeed, modDepth);
  }
}

startCameraBtn.addEventListener('click', async () => {
  if (!handLandmarker) await initLandmarker();
  await startCamera();
});

startSoundBtn.addEventListener('click', async () => {
  setupAudio();
  await audioCtx.resume();
  applySoundType(soundType.value);
});

stopSoundBtn.addEventListener('click', () => {
  if (!audioCtx || !masterGain) return;
  masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
});

resetBtn.addEventListener('click', () => {
  pitchValue.textContent = '440 Hz';
  modSpeedValue.textContent = '0.0 Hz';
  modDepthValue.textContent = '0 cents';
  pitchBar.value = 30; modSpeedBar.value = 0; modDepthBar.value = 0;
  lastLeftX = null; lastTime = null;
  if (audioCtx && carrier && lfo && lfoGain && masterGain) {
    carrier.frequency.setTargetAtTime(440, audioCtx.currentTime, 0.03);
    lfo.frequency.setTargetAtTime(0, audioCtx.currentTime, 0.03);
    lfoGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
    masterGain.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.03);
  }
});

soundType.addEventListener('change', () => applySoundType(soundType.value));
