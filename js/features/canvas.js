/**
 * Interactive HTML5 Character Sketchpad Studio & Procedural Portrait Generator
 * 
 * Features:
 * 1. Full-screen section canvas with responsive container-filling aspect ratio.
 * 2. Touch and mouse pointer drawing support with smooth round brush strokes.
 * 3. 15-step undo history buffer via in-memory snapshots.
 * 4. Color palette selector and brush size adjustments.
 * 5. Compact 240x240 WebP/PNG avatar exporter for low-latency WebRTC transmission.
 * 6. Procedural fallback vector portrait generator for AI bots and AFK players.
 */

/** Drawing state singleton */
const drawState = {
  /** @type {HTMLCanvasElement|null} */
  canvas: null,
  /** @type {CanvasRenderingContext2D|null} */
  ctx: null,
  isDrawing: false,
  color: '#00e5ff',
  brushSize: 6,
  /** @type {Array<string>} History snapshots for undo */
  history: [],
  lastX: 0,
  lastY: 0,
  initialized: false
};

/**
 * Initializes the character sketchpad canvas element, event listeners, and color palette.
 */
function initDrawingCanvas() {
  const canvas = document.getElementById('char-canvas');
  if (!canvas) return;
  drawState.canvas = canvas;
  drawState.ctx = canvas.getContext('2d');

  // Build clickable color swatches from DRAW_COLORS palette
  const paletteEl = document.getElementById('draw-color-palette');
  if (paletteEl) {
    paletteEl.innerHTML = DRAW_COLORS.map(c => `
      <button type="button" class="color-swatch ${c === drawState.color ? 'active' : ''}"
        style="background:${c};" onclick="selectDrawColor('${c}')"></button>
    `).join('');
  }

  clearCharacterCanvas(false);

  /**
   * Translates pointer coordinates from viewport CSS pixels to internal canvas coordinate space.
   * @param {MouseEvent|TouchEvent} e
   * @returns {{x: number, y: number}}
   */
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  /** Handles stroke start for mouse and touch */
  const startDraw = (e) => {
    e.preventDefault();
    saveCanvasSnapshot();
    drawState.isDrawing = true;
    const pos = getPos(e);
    drawState.lastX = pos.x;
    drawState.lastY = pos.y;

    const ctx = drawState.ctx;
    ctx.fillStyle = drawState.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, drawState.brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  /** Handles stroke move for mouse and touch */
  const moveDraw = (e) => {
    if (!drawState.isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = drawState.ctx;
    ctx.strokeStyle = drawState.color;
    ctx.lineWidth = drawState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(drawState.lastX, drawState.lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    drawState.lastX = pos.x;
    drawState.lastY = pos.y;
  };

  /** Handles stroke end */
  const endDraw = () => {
    drawState.isDrawing = false;
  };

  // Mouse event listeners
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  // Touch event listeners (prevent default scrolling while drawing on mobile)
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  window.addEventListener('touchend', endDraw);

  // Dynamic resize handler
  window.addEventListener('resize', () => {
    syncCanvasToContainer();
  });

  drawState.initialized = true;
}

/**
 * Dynamically resizes the HTML5 canvas resolution to match its CSS display box
 * while copying existing artwork so drawings are preserved across rotations/resizes.
 */
function syncCanvasToContainer() {
  const canvas = drawState.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.round(rect.width);
  const targetH = Math.round(rect.height);
  if (targetW < 40 || targetH < 40) return;
  if (Math.abs(canvas.width - targetW) <= 2 && Math.abs(canvas.height - targetH) <= 2) return;

  // Snapshot current artwork to temporary off-screen canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  // Update canvas resolution to match new container dimensions
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = drawState.ctx;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  // Rescale and center old artwork into the new dimensions
  const scale = Math.min(targetW / tempCanvas.width, targetH / tempCanvas.height);
  const drawW = tempCanvas.width * scale;
  const drawH = tempCanvas.height * scale;
  const offsetX = (targetW - drawW) / 2;
  const offsetY = (targetH - drawH) / 2;
  ctx.drawImage(tempCanvas, offsetX, offsetY, drawW, drawH);
}

/**
 * Selects active drawing color from the palette.
 * @param {string} color - Hex color code
 */
function selectDrawColor(color) {
  drawState.color = color;
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(color));
  });
}

/**
 * Selects brush width in pixels.
 * @param {number} size - Stroke width (3, 6, 12, etc.)
 */
function selectBrushSize(size) {
  drawState.brushSize = size;
  document.querySelectorAll('.brush-size-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.size) === size);
  });
}

/**
 * Saves a snapshot of the current canvas to the undo history stack (max 15 steps).
 */
function saveCanvasSnapshot() {
  if (!drawState.canvas) return;
  if (drawState.history.length >= 15) drawState.history.shift();
  drawState.history.push(drawState.canvas.toDataURL());
}

/**
 * Reverts the canvas to the most recent snapshot in the undo history stack.
 */
function undoCanvasStroke() {
  if (!drawState.canvas || drawState.history.length === 0) return;
  const lastUrl = drawState.history.pop();
  const img = new Image();
  img.onload = () => {
    drawState.ctx.clearRect(0, 0, drawState.canvas.width, drawState.canvas.height);
    drawState.ctx.drawImage(img, 0, 0);
  };
  img.src = lastUrl;
}

/**
 * Clears the drawing canvas back to white paper.
 * @param {boolean} recordUndo - Whether to record snapshot before wiping
 */
function clearCharacterCanvas(recordUndo = true) {
  if (!drawState.canvas) return;
  if (recordUndo) saveCanvasSnapshot();
  const ctx = drawState.ctx;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
}

/**
 * Exports a square 240x240 compressed avatar from the canvas for efficient
 * peer-to-peer WebRTC network synchronization.
 * 
 * @param {HTMLCanvasElement} sourceCanvas - Source drawing canvas
 * @returns {string} Data URL (image/webp or image/png fallback)
 */
function exportCompactAvatar(sourceCanvas) {
  const out = document.createElement('canvas');
  out.width = 240;
  out.height = 240;
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, 240, 240);

  const scale = Math.min(240 / sourceCanvas.width, 240 / sourceCanvas.height);
  const drawW = sourceCanvas.width * scale;
  const drawH = sourceCanvas.height * scale;
  const offsetX = (240 - drawW) / 2;
  const offsetY = (240 - drawH) / 2;
  outCtx.drawImage(sourceCanvas, offsetX, offsetY, drawW, drawH);

  try {
    return out.toDataURL('image/webp', 0.75);
  } catch (e) {
    return out.toDataURL('image/png');
  }
}

/**
 * Generates an expressive cartoon vector avatar programmatically.
 * Used for AI Bot players and players who did not submit a drawing before time ran out.
 * 
 * @param {HTMLCanvasElement} [targetCanvas] - Optional canvas to paint directly onto
 * @returns {string} Compact image data URL
 */
function generateProceduralPortraitDataUrl(targetCanvas) {
  if (targetCanvas === drawState.canvas) {
    syncCanvasToContainer();
  }
  const c = targetCanvas || document.createElement('canvas');
  if (!targetCanvas) {
    c.width = 240;
    c.height = 240;
  }
  const ctx = c.getContext('2d');
  const bgColors = ['#1c2038', '#231b38', '#162936', '#2b1d28'];
  const headColors = ['#ffca28', '#00e5ff', '#ff7043', '#00e676', '#ab47bc', '#ec407a'];
  const headColor = headColors[Math.floor(Math.random() * headColors.length)];

  ctx.fillStyle = bgColors[Math.floor(Math.random() * bgColors.length)];
  ctx.fillRect(0, 0, c.width, c.height);

  const s = Math.min(c.width, c.height) / 240;
  const cx = c.width / 2;
  const cy = c.height / 2;

  ctx.save();
  ctx.translate(cx - 120 * s, cy - 120 * s);
  ctx.scale(s, s);

  // Shoulders & Body
  ctx.fillStyle = headColor;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(120, 235, 65, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(120, 115, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#111426';
  const eyeOffset = 18;
  ctx.beginPath();
  ctx.arc(120 - eyeOffset, 105, 7, 0, Math.PI * 2);
  ctx.arc(120 + eyeOffset, 105, 7, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(118 - eyeOffset, 103, 2.5, 0, Math.PI * 2);
  ctx.arc(118 + eyeOffset, 103, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Comedic mouth expressions (smile, smirk, or gasp)
  ctx.strokeStyle = '#111426';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const expr = Math.floor(Math.random() * 3);
  ctx.beginPath();
  if (expr === 0) {
    ctx.arc(120, 122, 20, 0.15 * Math.PI, 0.85 * Math.PI);
  } else if (expr === 1) {
    ctx.moveTo(102, 130);
    ctx.lineTo(138, 125);
  } else {
    ctx.arc(120, 132, 10, 0, Math.PI * 2);
  }
  ctx.stroke();

  // Random Cartoon Hat or Accessory (Top Hat, Crown, or Antenna)
  const hatType = Math.floor(Math.random() * 3);
  if (hatType === 0) {
    // Top Hat
    ctx.fillStyle = '#111426';
    ctx.fillRect(80, 56, 80, 10);
    ctx.fillRect(95, 22, 50, 36);
  } else if (hatType === 1) {
    // Party Crown
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.moveTo(85, 68);
    ctx.lineTo(95, 36);
    ctx.lineTo(120, 54);
    ctx.lineTo(145, 36);
    ctx.lineTo(155, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Alien Antenna
    ctx.strokeStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(120, 63);
    ctx.lineTo(120, 32);
    ctx.stroke();
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(120, 28, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return exportCompactAvatar(c);
}
