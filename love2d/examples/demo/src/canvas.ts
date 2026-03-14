/**
 * Space scene canvas renderer.
 *
 * Draws a procedural starfield, station, shield bubble, scan sweep,
 * and tracked objects. Reads state directly from MockBridge properties
 * each frame for zero-copy rendering.
 */

import type { MockBridge } from './MockBridge';

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
  phase: number;
}

export function initCanvas(canvas: HTMLCanvasElement, bridge: MockBridge): void {
  const ctx = canvas.getContext('2d')!;

  // Generate starfield layers
  const stars: Star[] = [];
  for (let i = 0; i < 500; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: i < 30 ? 1.8 + Math.random() : i < 150 ? 1.0 + Math.random() * 0.4 : 0.5 + Math.random() * 0.3,
      brightness: 0.15 + Math.random() * 0.85,
      speed: 0.3 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Handle high-DPI and resize
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  let time = 0;

  function draw() {
    time += 0.016;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;

    // Background
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, w, h);

    // Subtle radial glow at center
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.45);
    grad.addColorStop(0, 'rgba(8, 20, 45, 0.4)');
    grad.addColorStop(1, 'rgba(6, 10, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // === Stars ===
    for (const star of stars) {
      const drift = time * star.speed * 0.0008 * (1 + bridge.speed);
      const sx = ((star.x + drift) % 1) * w;
      const sy = star.y * h;
      const twinkle = 0.4 + 0.6 * Math.sin(time * star.speed * 0.8 + star.phase);
      ctx.globalAlpha = star.brightness * twinkle;
      ctx.fillStyle = '#c8d8f0';
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // === Grid rings ===
    ctx.strokeStyle = 'rgba(0, 160, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let r = 60; r <= 280; r += 60) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshair
    ctx.strokeStyle = 'rgba(0, 160, 255, 0.03)';
    ctx.beginPath();
    ctx.moveTo(cx - 300, cy);
    ctx.lineTo(cx + 300, cy);
    ctx.moveTo(cx, cy - 300);
    ctx.lineTo(cx, cy + 300);
    ctx.stroke();

    // === Scan sweep ===
    const scanAngle = time * 0.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(scanAngle);

    // Sweep line
    const sweepGrad = ctx.createLinearGradient(0, 0, 220, 0);
    sweepGrad.addColorStop(0, 'rgba(0, 180, 255, 0.2)');
    sweepGrad.addColorStop(1, 'rgba(0, 180, 255, 0)');
    ctx.strokeStyle = sweepGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(220, 0);
    ctx.stroke();

    // Sweep trail
    ctx.fillStyle = 'rgba(0, 160, 255, 0.015)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 220, -0.4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // === Station octagon ===
    ctx.save();
    ctx.translate(cx, cy);
    const stationRot = time * 0.04;
    ctx.rotate(stationRot);

    ctx.strokeStyle = '#00aadd';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#0088bb';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * 24;
      const py = Math.sin(a) * 24;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner structure lines
    ctx.strokeStyle = 'rgba(0, 170, 221, 0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = '#00ccee';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // === Shield bubble ===
    if (bridge.shields > 0) {
      const shieldPct = bridge.shields / 100;
      const shieldAlpha = shieldPct * 0.35;
      const isWeak = bridge.shields < 25;
      const shieldColor = isWeak ? '255, 80, 40' : '0, 200, 255';

      ctx.save();
      ctx.translate(cx, cy);
      ctx.shadowBlur = 18;
      ctx.shadowColor = isWeak ? '#ff5028' : '#00ccff';

      const shieldR = 52 + Math.sin(time * 1.8) * 3;
      const segments = 8;
      ctx.strokeStyle = `rgba(${shieldColor}, ${shieldAlpha})`;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < segments; i++) {
        const gapFactor = 0.75 * shieldPct + 0.15;
        const start = (i / segments) * Math.PI * 2 + time * 0.25;
        const end = start + (Math.PI * 2 / segments) * gapFactor;
        ctx.beginPath();
        ctx.arc(0, 0, shieldR, start, end);
        ctx.stroke();
      }

      // Inner shield glow
      ctx.globalAlpha = shieldPct * 0.06;
      ctx.fillStyle = isWeak ? '#ff5028' : '#00ccff';
      ctx.beginPath();
      ctx.arc(0, 0, shieldR - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // === Space objects ===
    for (const obj of bridge.objects) {
      const ox = cx + Math.cos(obj.angle) * obj.distance;
      const oy = cy + Math.sin(obj.angle) * obj.distance;

      let color: string;
      let size: number;
      switch (obj.type) {
        case 'asteroid': color = obj.threat ? '#ff4444' : '#dd8833'; size = 3; break;
        case 'ship':     color = '#44ee88'; size = 3.5; break;
        case 'station':  color = '#4488ff'; size = 4; break;
        case 'debris':   color = '#667788'; size = 2; break;
        case 'signal':   color = '#eeee44'; size = 2.5; break;
        default:         color = '#ffffff'; size = 2;
      }

      if (obj.threat) {
        // Pulsing red glow for threats
        ctx.shadowBlur = 10 + 5 * Math.sin(time * 4);
        ctx.shadowColor = '#ff3333';
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(ox, oy, size, 0, Math.PI * 2);
      ctx.fill();

      // Label for larger objects
      if (obj.type === 'ship' || obj.type === 'station') {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.font = '7px monospace';
        ctx.fillText(obj.name, ox + size + 4, oy + 3);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // === Danger flash when hull critical ===
    if (bridge.hull < 25) {
      const flashAlpha = 0.03 + 0.02 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(255, 30, 30, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
