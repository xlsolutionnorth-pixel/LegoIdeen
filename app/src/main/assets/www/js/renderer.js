/*
 * Kleiner WebGL-Renderer für Bausteinmodelle (ohne externe Bibliotheken,
 * damit die App komplett offline funktioniert).
 */
(function () {
  'use strict';

  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    uniform mat4 uVP;
    uniform vec3 uOff;
    varying vec3 vN;
    void main() {
      vN = aNor;
      gl_Position = uVP * vec4(aPos + uOff, 1.0);
    }`;
  const FS = `
    precision mediump float;
    uniform vec3 uColor;
    uniform float uLit;
    uniform float uGlow;
    uniform float uAlpha;
    varying vec3 vN;
    void main() {
      vec3 n = normalize(vN);
      float l = 0.42
        + 0.55 * max(dot(n, normalize(vec3(0.45, 0.85, 0.55))), 0.0)
        + 0.18 * max(dot(n, normalize(vec3(-0.7, 0.25, -0.3))), 0.0);
      vec3 c = mix(uColor, uColor * l, uLit);
      c = mix(c, vec3(1.0, 0.97, 0.55), uGlow);
      gl_FragColor = vec4(c, uAlpha);
    }`;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // --- Mini-Matrixmathe (Spaltenweise wie WebGL) ---
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookAt(eye, target, up) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1,
    ];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
    }
    return o;
  }

  class BrickView {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{interactive?: boolean, preserve?: boolean, background?: string|null}} opts
     */
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.opts = opts;
      const ctxOpts = { antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve, premultipliedAlpha: false };
      const gl = canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
      if (!gl) throw new Error('WebGL wird auf diesem Gerät nicht unterstützt');
      this.gl = gl;
      this.prog = this._program(VS, FS);
      this.loc = {
        aPos: gl.getAttribLocation(this.prog, 'aPos'),
        aNor: gl.getAttribLocation(this.prog, 'aNor'),
        uVP: gl.getUniformLocation(this.prog, 'uVP'),
        uOff: gl.getUniformLocation(this.prog, 'uOff'),
        uColor: gl.getUniformLocation(this.prog, 'uColor'),
        uLit: gl.getUniformLocation(this.prog, 'uLit'),
        uGlow: gl.getUniformLocation(this.prog, 'uGlow'),
        uAlpha: gl.getUniformLocation(this.prog, 'uAlpha'),
      };
      this.items = [];
      this.visible = 0;
      this.highlight = -1;
      this.highlightStart = 0;
      this.az = 0.65; this.el = 0.55; this.zoom = 1;
      this.target = [0, 0, 0]; this.radius = 5;
      this._raf = 0;
      if (opts.interactive) this._controls();
    }

    _program(vs, fs) {
      const gl = this.gl;
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }

    _buffer(data) {
      const gl = this.gl;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    }

    /** Modell setzen (Liste von Bausteinen). fitAll: Kamera auf ganzes Modell ausrichten */
    setModel(bricks, opts = {}) {
      const gl = this.gl;
      this.items.forEach((it) => { gl.deleteBuffer(it.tri); gl.deleteBuffer(it.lines); });
      this.items = bricks.map((e) => {
        const g = Bricks.placedGeometry(e);
        const hex = (Bricks.COLORS[g.b.c] || Bricks.COLORS.R).hex;
        return {
          tri: this._buffer(g.tri), triCount: g.tri.length / 6,
          lines: this._buffer(g.lines), lineCount: g.lines.length / 3,
          color: opts.color ? hexToRgb(opts.color) : hexToRgb(hex),
          edge: g.b.c === 'K' ? [0.55, 0.6, 0.65] : (g.b.c === 'D' || g.b.c === 'N' || g.b.c === 'B' || g.b.c === 'G' ? [0.08, 0.08, 0.1] : [0.18, 0.18, 0.22]),
        };
      });
      const bb = Bricks.bounds(bricks);
      this.target = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
      this.radius = Math.max(1.2, Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) / 2);
      this.visible = this.items.length;
      this.highlight = -1;
      if (!opts.keepCamera) { this.zoom = 1; this.az = opts.az != null ? opts.az : 0.65; this.el = opts.el != null ? opts.el : 0.55; }
    }

    /** Nur die ersten n Steine zeigen; der letzte blinkt und fällt an seinen Platz */
    setStep(n, animate = true) {
      this.visible = n;
      this.highlight = animate && n > 0 ? n - 1 : -1;
      this.highlightStart = performance.now();
      this.start();
    }

    resize() {
      const c = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
    }

    render(now = performance.now()) {
      const gl = this.gl, L = this.loc;
      const w = this.canvas.width, h = this.canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.prog);

      const aspect = w / Math.max(h, 1);
      const fov = 0.6;
      // Abstand so wählen, dass das ganze Modell hineinpasst
      const fit = this.radius / Math.sin(fov / 2) * (aspect < 1 ? 1 / aspect : 1);
      const dist = fit * 1.02 / this.zoom;
      const t = this.target;
      const eye = [
        t[0] + dist * Math.cos(this.el) * Math.sin(this.az),
        t[1] + dist * Math.sin(this.el),
        t[2] + dist * Math.cos(this.el) * Math.cos(this.az),
      ];
      const vp = mul(perspective(fov, aspect, dist / 50, dist * 4), lookAt(eye, t, [0, 1, 0]));
      gl.uniformMatrix4fv(L.uVP, false, new Float32Array(vp));

      let animating = false;
      for (let i = 0; i < this.visible && i < this.items.length; i++) {
        const it = this.items[i];
        let off = 0, glow = 0;
        if (i === this.highlight) {
          const dt = (now - this.highlightStart) / 1000;
          if (dt < 0.45) { const k = 1 - dt / 0.45; off = k * k * 2.5; animating = true; }
          glow = 0.35 * (0.5 + 0.5 * Math.sin(dt * 6.5)) * (dt < 6 ? 1 : 0);
          if (dt < 6) animating = true;
        }
        gl.uniform3f(L.uOff, 0, off, 0);

        // Flächen
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, it.tri);
        gl.enableVertexAttribArray(L.aPos);
        gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(L.aNor);
        gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 24, 12);
        gl.uniform3fv(L.uColor, it.color);
        gl.uniform1f(L.uLit, 1);
        gl.uniform1f(L.uGlow, glow);
        gl.uniform1f(L.uAlpha, 1);
        gl.drawArrays(gl.TRIANGLES, 0, it.triCount);
        gl.disable(gl.POLYGON_OFFSET_FILL);

        // Kanten
        gl.bindBuffer(gl.ARRAY_BUFFER, it.lines);
        gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 12, 0);
        gl.disableVertexAttribArray(L.aNor);
        gl.vertexAttrib3f(L.aNor, 0, 1, 0);
        gl.uniform3fv(L.uColor, i === this.highlight ? [0.95, 0.55, 0.0] : it.edge);
        gl.uniform1f(L.uLit, 0);
        gl.uniform1f(L.uGlow, 0);
        gl.uniform1f(L.uAlpha, 0.85);
        gl.drawArrays(gl.LINES, 0, it.lineCount);
      }
      return animating;
    }

    start() {
      if (this._raf) return;
      const loop = (now) => {
        this._raf = 0;
        this.resize();
        const again = this.render(now);
        if (again || this._dragging) this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; }

    /** Bild des aktuellen Modells (für Vorschaubilder) */
    snapshot() {
      this.render();
      return this.canvas.toDataURL('image/png');
    }

    _controls() {
      const c = this.canvas;
      const pts = new Map();
      let lastDist = 0;
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this._dragging = true;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
        this.start();
      });
      c.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        const p = pts.get(e.pointerId);
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 1) {
          this.az -= dx * 0.01;
          this.el = Math.max(-0.2, Math.min(1.45, this.el + dy * 0.01));
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (lastDist) this.zoom = Math.max(0.6, Math.min(3, this.zoom * d / lastDist));
          lastDist = d;
        }
        this.start();
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        lastDist = 0;
        if (!pts.size) this._dragging = false;
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom = Math.max(0.6, Math.min(3, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
        this.start();
      }, { passive: false });
    }
  }

  /** Erzeugt Vorschaubilder (PNG-Daten-URLs) mit einem einzigen versteckten Canvas */
  class Thumbnailer {
    constructor(w = 360, h = 280) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w; this.canvas.height = h;
      this.view = new BrickView(this.canvas, { preserve: true });
      this.cache = new Map();
    }
    model(key, bricks, opts) {
      if (this.cache.has(key)) return this.cache.get(key);
      this.view.setModel(bricks, opts);
      const url = this.view.snapshot();
      this.cache.set(key, url);
      return url;
    }
    part(partId, color = 'Y') {
      const c = this.canvas;
      const key = 'part:' + partId + ':' + color;
      if (this.cache.has(key)) return this.cache.get(key);
      const ow = c.width, oh = c.height;
      c.width = 160; c.height = 130;
      this.view.setModel([[partId, 0, 0, 0, color, 0]], { az: 0.55, el: 0.6 });
      this.view.zoom = 1.15;
      const url = this.view.snapshot();
      c.width = ow; c.height = oh;
      this.cache.set(key, url);
      return url;
    }
  }

  window.BrickView = BrickView;
  window.Thumbnailer = Thumbnailer;
})();
