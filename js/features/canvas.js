// Interactive HTML5 Character Drawing Studio & Procedural Portrait Generator

const drawState = {
  canvas: null,
  ctx: null,
  isDrawing: false,
  color: '#00e5ff',
  brushSize: 6,
  history: [],
  lastX: 0,
  lastY: 0,
  initialized: false
};

function initDrawingCanvas() {
  const canvas = document.getElementById('char-canvas');
  if (!canvas) return;
  drawState.canvas = canvas;
  drawState.ctx = canvas.getContext('2d');

  const paletteEl = document.getElementById('draw-color-palette');
  if (paletteEl) {
    paletteEl.innerHTML = DRAW_COLORS.map(c => `
      <button type="button" class="color-swatch ${c === drawState.color ? 'active' : ''}"
        style="background:${c};" onclick="selectDrawColor('${c}')"></button>
    `).join('');
  }

  clearCharacterCanvas(false);

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

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

  const endDraw = () => {
    drawState.isDrawing = false;
  };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  window.addEventListener('touchend', endDraw);

  drawState.initialized = true;
}

function selectDrawColor(color) {
  drawState.color = color;
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(color));
  });
}

function selectBrushSize(size) {
  drawState.brushSize = size;
  document.querySelectorAll('.brush-size-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.size) === size);
  });
}

function saveCanvasSnapshot() {
  if (!drawState.canvas) return;
  if (drawState.history.length >= 15) drawState.history.shift();
  drawState.history.push(drawState.canvas.toDataURL());
}

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

function clearCharacterCanvas(recordUndo = true) {
  if (!drawState.canvas) return;
  if (recordUndo) saveCanvasSnapshot();
  const ctx = drawState.ctx;
  ctx.fillStyle = '#181a2c';
  ctx.fillRect(0, 0, drawState.canvas.width, drawState.canvas.height);
}

function exportCompactAvatar(sourceCanvas) {
  try {
    return sourceCanvas.toDataURL('image/webp', 0.75);
  } catch (e) {
    return sourceCanvas.toDataURL('image/png');
  }
}

function generateProceduralPortraitDataUrl(targetCanvas) {
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

  // Shoulders/Body
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

  // Eye shine
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(118 - eyeOffset, 103, 2.5, 0, Math.PI * 2);
  ctx.arc(118 + eyeOffset, 103, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Expression
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

  // Random Hat / Accessory
  const hatType = Math.floor(Math.random() * 3);
  if (hatType === 0) {
    ctx.fillStyle = '#111426';
    ctx.fillRect(80, 56, 80, 10);
    ctx.fillRect(95, 22, 50, 36);
  } else if (hatType === 1) {
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

  return exportCompactAvatar(c);
}
