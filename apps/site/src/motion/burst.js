/* The crash: the raw crystal shatters into textured shards and dust that
   burst from its crown, drift away down and to the right, and fade.

   WebGL2 on a canvas the size of the stage, running requestAnimationFrame
   only while it plays. Every particle's motion is analytic in the vertex
   shader (p0 + v·t + ½g·t² + noise), so a frame costs the CPU one uniform.
   Loaded with import() only on tiers that get particles. */

import { generateParticles } from './particles.js'

const BURST_S = 1.4
const REVERSE_S = 0.9

const SHARD_VS = `#version 300 es
in vec2 a_pos; in vec2 a_center; in vec2 a_vel; in float a_spin; in float a_seed;
uniform float u_t; uniform vec4 u_box; uniform vec2 u_canvas;
out vec2 v_uv; out float v_fade; out float v_flash;
void main() {
  vec2 size = u_box.zw;
  vec2 c = a_center * size, p = a_pos * size - c;
  float a = a_spin * u_t; p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
  vec2 drift = vec2(sin(a_seed * 31.0 + u_t * 3.1), cos(a_seed * 17.0 + u_t * 2.3)) * 10.0 * u_t;
  p += c + a_vel * size.x * u_t + vec2(0.0, 420.0 * u_t * u_t) + drift;
  vec2 px = u_box.xy + p;
  gl_Position = vec4(px.x / u_canvas.x * 2.0 - 1.0, 1.0 - px.y / u_canvas.y * 2.0, 0.0, 1.0);
  v_uv = a_pos;
  v_fade = 1.0 - smoothstep(0.35 + a_seed * 0.4, 1.3, u_t);
  v_flash = 1.0 - smoothstep(0.0, 0.12, u_t);
}`
const SHARD_FS = `#version 300 es
precision mediump float;
in vec2 v_uv; in float v_fade; in float v_flash;
uniform sampler2D u_tex; out vec4 o;
void main() {
  vec4 c = texture(u_tex, v_uv);
  c.rgb = mix(c.rgb, vec3(1.0), v_flash * 0.55);
  o = vec4(c.rgb, c.a * v_fade);
}`
const DUST_VS = `#version 300 es
in vec2 a_pos; in vec2 a_vel; in float a_seed; in float a_size;
uniform float u_t; uniform vec4 u_box; uniform vec2 u_canvas; uniform float u_dpr;
uniform sampler2D u_tex;
out vec4 v_color;
void main() {
  vec2 size = u_box.zw;
  vec2 curl = vec2(sin(a_seed * 23.0 + u_t * 2.7 + a_pos.y * 9.0), cos(a_seed * 11.0 + u_t * 2.1 + a_pos.x * 7.0));
  vec2 p = a_pos * size + a_vel * size.x * u_t + curl * 24.0 * u_t + vec2(0.0, 60.0 * u_t * u_t);
  vec2 px = u_box.xy + p;
  gl_Position = vec4(px.x / u_canvas.x * 2.0 - 1.0, 1.0 - px.y / u_canvas.y * 2.0, 0.0, 1.0);
  gl_PointSize = a_size * u_dpr * (1.0 - 0.4 * u_t / 1.4);
  vec4 c = texture(u_tex, a_pos);
  v_color = vec4(c.rgb, c.a * (1.0 - smoothstep(0.2 + a_seed * 0.6, 1.4, u_t)));
}`
const DUST_FS = `#version 300 es
precision mediump float;
in vec4 v_color; out vec4 o;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  o = vec4(v_color.rgb, v_color.a * smoothstep(0.5, 0.2, length(d)));
}`

function program(gl, vs, fs) {
  const p = gl.createProgram()
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s)
  }
  gl.linkProgram(p)
  return p
}

function buffer(gl, prog, data, layout) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  const stride = layout.reduce((s, [, n]) => s + n, 0) * 4
  let offset = 0
  for (const [name, n] of layout) {
    const loc = gl.getAttribLocation(prog, name)
    if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, offset) }
    offset += n * 4
  }
  gl.bindVertexArray(null)
  return { vao, count: data.length / (stride / 4) }
}

/**
 * Prepare a burst. Resolves to null when WebGL2 is unavailable; the caller
 * then runs the wipe alone.
 * @param {{ canvas: HTMLCanvasElement, image: string, particles: number, dpr: number }} o
 */
export async function createBurst({ canvas, image, particles, dpr }) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false })
  if (!gl) return null

  const img = new Image(); img.src = image; await img.decode()
  // Alpha at a small size for sampling particle positions.
  const sw = 160, sh = Math.max(1, Math.round(sw * img.naturalHeight / img.naturalWidth))
  const probe = new OffscreenCanvas(sw, sh).getContext('2d')
  probe.drawImage(img, 0, 0, sw, sh)
  const rgba = probe.getImageData(0, 0, sw, sh).data, alpha = new Uint8Array(sw * sh)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
  const shardCount = Math.round(particles * 0.075)
  const { shards, dust } = generateParticles({ alpha, w: sw, h: sh, shards: shardCount, dust: particles - shardCount, aspect: img.naturalWidth / img.naturalHeight })

  const shardProg = program(gl, SHARD_VS, SHARD_FS), dustProg = program(gl, DUST_VS, DUST_FS)
  const shardBuf = buffer(gl, shardProg, shards, [['a_pos', 2], ['a_center', 2], ['a_vel', 2], ['a_spin', 1], ['a_seed', 1]])
  const dustBuf = buffer(gl, dustProg, dust, [['a_pos', 2], ['a_vel', 2], ['a_seed', 1], ['a_size', 1]])
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  let lost = false
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; canvas.hidden = true })

  let box = { x: 0, y: 0, w: 1, h: 1 }, t = 0, raf = 0, ratio = 1
  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    const cw = canvas.width / ratio, ch = canvas.height / ratio
    for (const [prog, buf, mode] of [[shardProg, shardBuf, gl.TRIANGLES], [dustProg, dustBuf, gl.POINTS]]) {
      gl.useProgram(prog)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_t'), t)
      gl.uniform4f(gl.getUniformLocation(prog, 'u_box'), box.x, box.y, box.w, box.h)
      gl.uniform2f(gl.getUniformLocation(prog, 'u_canvas'), cw, ch)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_dpr'), ratio)
      gl.bindVertexArray(buf.vao); gl.drawArrays(mode, 0, buf.count)
    }
    gl.bindVertexArray(null)
  }

  // Warm the shaders up while idle with one invisible draw (t past the fade).
  t = BURST_S + 1; draw()

  function size(rect, crystal) {
    ratio = Math.min(window.devicePixelRatio || 1, dpr)
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio)
    box = crystal
  }

  /** Run from the current t towards `to` (BURST_S forward, 0 backward). */
  function run(to, onDone) {
    cancelAnimationFrame(raf)
    if (lost) { onDone(); return }
    canvas.hidden = false
    const forward = to > t, rate = forward ? 1 : BURST_S / REVERSE_S
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * rate; last = now
      t = forward ? Math.min(to, t + dt) : Math.max(to, t - dt)
      draw()
      if (t === to) { if (forward) { canvas.hidden = true } onDone(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  return {
    size,
    get lost() { return lost },
    /** Burst from rest (or from where a reversal left it). */
    play(onDone) { if (t >= BURST_S) t = 0; run(BURST_S, onDone) },
    /** Fly back together; ends showing the intact crystal for a frame. */
    reverse(onDone) { if (t >= BURST_S) t = BURST_S; run(0, () => { canvas.hidden = true; onDone() }) },
    stop() { cancelAnimationFrame(raf); canvas.hidden = true; t = BURST_S + 1 },
  }
}
