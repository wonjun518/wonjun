const ideas = [
  "인생네컷 찍기",
  "소품샵 구경하기",
  "공원 산책하기",
  "예쁜 카페 가기",
  "보드게임 하기",
  "코인 노래방 가기",
  "오락실 가기",
  "팝업스토어 가기",
  "독립서점 구경하기",
  "방탈출 카페 가기",
  "타로카드 보기",
  "길거리 간식 먹기",
  "볼링장 가기",
  "만화카페 가기",
  "달달한 디저트 먹기"
];

const visionImportUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";
const wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const handModelUrl = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const note = document.getElementById("note");
const randomBox = document.getElementById("randomBox");
const resultText = document.getElementById("resultText");
const resetButton = document.getElementById("resetButton");
const meterFill = document.getElementById("meterFill");
const visionButton = document.getElementById("visionButton");
const visionStatus = document.getElementById("visionStatus");
const scene = document.querySelector(".scene");
const ufoCore = document.querySelector(".ufo-core");
const video = document.getElementById("webcam");
const canvas = document.getElementById("handCanvas");
const handCursor = document.getElementById("handCursor");
const canvasContext = canvas.getContext("2d");

const targetFalloff = 280;
const pinchCloseRatio = 0.58;
const pinchOpenRatio = 0.76;
const handConnections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

let activePointerId = null;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let isRevealed = false;

let HandLandmarker;
let FilesetResolver;
let handLandmarker = null;
let cameraStream = null;
let lastVideoTime = -1;
let isHandHolding = false;
let wasPinching = false;
let handAnchorX = 0;
let handAnchorY = 0;
let noteAnchorX = 0;
let noteAnchorY = 0;
let smoothHandX = null;
let smoothHandY = null;

function setNotePosition(x, y) {
  const rotation = Math.max(-16, Math.min(16, x / 13));

  note.style.setProperty("--drag-x", `${x}px`);
  note.style.setProperty("--drag-y", `${y}px`);
  note.style.setProperty("--drag-rotate", `${rotation}deg`);
}

function resetNotePosition() {
  currentX = 0;
  currentY = 0;
  setNotePosition(0, 0);
  meterFill.style.width = "0%";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDraggedNoteCenter() {
  const rect = note.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function getUfoTarget() {
  const rect = ufoCore.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    radius: Math.max(58, rect.width * 0.38)
  };
}

function getTargetDistance() {
  const noteCenter = getDraggedNoteCenter();
  const target = getUfoTarget();

  return {
    distance: Math.hypot(noteCenter.x - target.x, noteCenter.y - target.y),
    radius: target.radius
  };
}

function updateProgress() {
  const { distance, radius } = getTargetDistance();
  const progress = clamp(1 - ((distance - radius) / targetFalloff), 0, 1);
  meterFill.style.width = `${progress * 100}%`;
  randomBox.classList.toggle("is-target", progress > 0.72 && !isRevealed);
}

function isNoteInsideUfo() {
  const { distance, radius } = getTargetDistance();
  return distance <= radius;
}

function pickIdea() {
  return ideas[Math.floor(Math.random() * ideas.length)];
}

function revealResult() {
  isRevealed = true;
  activePointerId = null;
  isHandHolding = false;

  resultText.textContent = pickIdea();
  note.classList.remove("is-dragging");
  note.classList.add("is-revealed");
  note.setAttribute("aria-label", "랜덤 결과가 열렸습니다");
  randomBox.classList.add("is-paused", "is-opened");
  randomBox.classList.remove("is-target");
  scene.classList.add("is-revealing");
  meterFill.style.width = "100%";
  resetButton.hidden = false;
  resetButton.classList.add("is-visible");
  visionStatus.textContent = cameraStream ? "DRAW LOCKED" : "RESULT OPEN";

  setNotePosition(0, 24);
}

function releasePull() {
  if (isRevealed) {
    return;
  }

  isHandHolding = false;
  note.classList.remove("is-dragging");
  randomBox.classList.remove("is-paused", "is-target");
  resetNotePosition();
}

function handlePointerDown(event) {
  if (isRevealed) {
    return;
  }

  activePointerId = event.pointerId;
  startX = event.clientX - currentX;
  startY = event.clientY - currentY;

  note.setPointerCapture(activePointerId);
  note.classList.add("is-dragging");
  randomBox.classList.add("is-paused");
}

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId || isRevealed) {
    return;
  }

  currentX = event.clientX - startX;
  currentY = event.clientY - startY;

  setNotePosition(currentX, currentY);
  updateProgress();

  if (isNoteInsideUfo()) {
    revealResult();
  }
}

function handlePointerUp(event) {
  if (event.pointerId !== activePointerId || isRevealed) {
    return;
  }

  note.releasePointerCapture(activePointerId);
  note.classList.remove("is-dragging");
  activePointerId = null;

  if (isNoteInsideUfo()) {
    revealResult();
    return;
  }

  randomBox.classList.remove("is-paused", "is-target");
  resetNotePosition();
}

function resetGame() {
  isRevealed = false;
  activePointerId = null;
  isHandHolding = false;
  wasPinching = false;

  resultText.textContent = "결과 준비 중";
  note.classList.remove("is-revealed", "is-dragging");
  note.setAttribute("aria-label", "쪽지를 끌어당겨 랜덤 결과 보기");
  randomBox.classList.remove("is-paused", "is-target", "is-opened");
  scene.classList.remove("is-revealing");
  resetButton.hidden = true;
  resetButton.classList.remove("is-visible");
  visionStatus.textContent = cameraStream ? "PINCH READY" : "CAMERA OFF";
  resetNotePosition();
}

function getNoteCenter() {
  const rect = note.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function toScreenPoint(landmark) {
  return {
    x: (1 - landmark.x) * window.innerWidth,
    y: landmark.y * window.innerHeight
  };
}

function getPinchData(landmarks) {
  const thumb = landmarks[4];
  const index = landmarks[8];
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const pinchDistance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const palmSize = Math.max(Math.hypot(wrist.x - middleBase.x, wrist.y - middleBase.y), 0.001);
  const midpoint = {
    x: (thumb.x + index.x) / 2,
    y: (thumb.y + index.y) / 2
  };

  return {
    point: toScreenPoint(midpoint),
    ratio: pinchDistance / palmSize
  };
}

function updateHandCursor(point, isPinching) {
  handCursor.classList.add("is-visible");
  handCursor.classList.toggle("is-pinching", isPinching);
  handCursor.style.transform = `translate3d(${point.x - 38}px, ${point.y - 76}px, 0) rotate(-18deg) scale(${isPinching ? 0.9 : 1})`;
}

function hideHandCursor() {
  handCursor.classList.remove("is-visible", "is-pinching");
}

function drawLandmarks(landmarks) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvasContext.clearRect(0, 0, width, height);

  if (!landmarks) {
    return;
  }

  canvasContext.save();
  canvasContext.lineWidth = 2 * scale;
  canvasContext.strokeStyle = "#c9ff00";
  canvasContext.fillStyle = "#f3f3ed";

  handConnections.forEach(([start, end]) => {
    const a = landmarks[start];
    const b = landmarks[end];
    canvasContext.beginPath();
    canvasContext.moveTo((1 - a.x) * width, a.y * height);
    canvasContext.lineTo((1 - b.x) * width, b.y * height);
    canvasContext.stroke();
  });

  landmarks.forEach((point) => {
    canvasContext.beginPath();
    canvasContext.arc((1 - point.x) * width, point.y * height, 2.8 * scale, 0, Math.PI * 2);
    canvasContext.fill();
  });

  canvasContext.restore();
}

function updateHandPull(point, pinchRatio) {
  const isPinching = pinchRatio < pinchCloseRatio || (wasPinching && pinchRatio < pinchOpenRatio);
  wasPinching = isPinching;

  if (!isPinching) {
    if (isHandHolding) {
      releasePull();
    }
    visionStatus.textContent = "PINCH READY";
    return;
  }

  if (!isHandHolding) {
    const noteCenter = getNoteCenter();
    const distanceFromNote = Math.hypot(point.x - noteCenter.x, point.y - noteCenter.y);

    if (distanceFromNote > 185) {
      visionStatus.textContent = "PINCH NOTE";
      return;
    }

    isHandHolding = true;
    handAnchorX = point.x;
    handAnchorY = point.y;
    noteAnchorX = currentX;
    noteAnchorY = currentY;
    note.classList.add("is-dragging");
    randomBox.classList.add("is-paused");
  }

  currentX = noteAnchorX + point.x - handAnchorX;
  currentY = noteAnchorY + point.y - handAnchorY;

  setNotePosition(currentX, currentY);
  updateProgress();
  visionStatus.textContent = "MOVE TO UFO";

  if (isNoteInsideUfo()) {
    revealResult();
  }
}

function processHandResults(results) {
  const landmarks = results.landmarks && results.landmarks[0];
  drawLandmarks(landmarks);

  if (!landmarks || isRevealed) {
    hideHandCursor();
    if (!landmarks && isHandHolding) {
      releasePull();
    }
    if (!landmarks && cameraStream && !isRevealed) {
      visionStatus.textContent = "SEARCHING";
    }
    return;
  }

  const pinch = getPinchData(landmarks);
  smoothHandX = smoothHandX === null ? pinch.point.x : smoothHandX * 0.72 + pinch.point.x * 0.28;
  smoothHandY = smoothHandY === null ? pinch.point.y : smoothHandY * 0.72 + pinch.point.y * 0.28;

  const point = {
    x: smoothHandX,
    y: smoothHandY
  };
  const isPinching = pinch.ratio < pinchCloseRatio || (wasPinching && pinch.ratio < pinchOpenRatio);

  updateHandCursor(point, isPinching);
  updateHandPull(point, pinch.ratio);
}

function detectHands() {
  if (!handLandmarker || video.readyState < 2) {
    requestAnimationFrame(detectHands);
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    const now = performance.now();
    const results = handLandmarker.detectForVideo(video, now);
    processHandResults(results);
    lastVideoTime = video.currentTime;
  }

  requestAnimationFrame(detectHands);
}

async function startVision() {
  if (handLandmarker || cameraStream) {
    return;
  }

  visionButton.disabled = true;
  visionStatus.textContent = "LOADING MODEL";

  try {
    const mediaPipe = await import(visionImportUrl);
    HandLandmarker = mediaPipe.HandLandmarker;
    FilesetResolver = mediaPipe.FilesetResolver;

    const vision = await FilesetResolver.forVisionTasks(wasmUrl);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handModelUrl,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    visionStatus.textContent = "REQUEST CAMERA";
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    video.srcObject = cameraStream;
    await video.play();

    visionButton.classList.add("is-active");
    visionButton.textContent = "VISION LIVE";
    visionStatus.textContent = "PINCH READY";
    detectHands();
  } catch (error) {
    console.error(error);
    visionButton.disabled = false;
    visionButton.textContent = "VISION RETRY";
    visionStatus.textContent = "DRAG FALLBACK";
  }
}

note.addEventListener("pointerdown", handlePointerDown);
note.addEventListener("pointermove", handlePointerMove);
note.addEventListener("pointerup", handlePointerUp);
note.addEventListener("pointercancel", handlePointerUp);

resetButton.addEventListener("click", resetGame);
visionButton.addEventListener("click", startVision);
