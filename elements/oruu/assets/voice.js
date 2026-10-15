(() => {
  'use strict';
  const button = document.querySelector('#voice');
  const canvas = button.querySelector('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let target = 0, pose = 0, gazeX = 0, gazeY = 0, pointerX = 0, pointerY = 0;
  let time = 0, previous = 0, frames = 0, ready = false;
  const signalReady = () => {
    if (ready) return;
    ready = true;
    if (parent !== window) parent.postMessage({ type: 'weirdos:ready' }, '*');
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && parent !== window) parent.postMessage({ type: 'weirdos:close' }, '*');
  });
  if (!gl) {
    button.querySelector('.fallback').style.display = 'grid';
    button.disabled = true;
    requestAnimationFrame(signalReady);
    return;
  }
  const vertex = `attribute vec2 position; void main() { gl_Position = vec4(position, 0., 1.); }`;
  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time, pose;
    uniform vec2 gaze;
    float roundedBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
    }
    float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    float noise(float t) {
      float n = floor(t), f = fract(t);
      return mix(hash(n), hash(n + 1.), f * f * (3. - 2. * f));
    }
    vec3 ribbonColor(float n, float x) {
      vec3 c;
      if (n < .5) c = vec3(.02, 1., .56);
      else if (n < 1.5) c = vec3(.00, .78, 1.);
      else if (n < 2.5) c = vec3(.48, .06, 1.);
      else if (n < 3.5) c = vec3(1., .025, .39);
      else if (n < 4.5) c = vec3(1., .31, .025);
      else c = vec3(.82, .025, .98);
      // Each ribbon retains its own colour, with a soft neighbouring hue at its ends.
      return c + vec3(.12, .13, .16) * exp(-pow((x - .35 * sin(n)) / .27, 2.));
    }
    void main() {
      vec2 p = (gl_FragCoord.xy - .5 * resolution) / min(resolution.x / 1.42, resolution.y) * 3.9;
      float morph = pose * pose * (3. - 2. * pose);
      float phrase = smoothstep(.12, .60, noise(time * .64 + 5.));
      float syllable = pow(.5 + .5 * sin(time * 8.4 + 1.8 * sin(time * 1.3) + .7 * sin(time * 3.9)), 2.);
      float speech = (.18 + .82 * phrase) * (.30 + .70 * syllable);
      // Empty space between the sheets opens and separates into two eye apertures.
      // This is a change in the material domain, never an opacity fade of eye graphics.
      vec2 eyeSize = vec2(.18, .29) * morph;
      float eyeRadius = mix(.0, .115, morph);
      vec2 eyes = p - gaze * morph;
      float eyeSpacing = .235 * morph;
      float hole = min(roundedBox(eyes - vec2(-eyeSpacing, 0.), eyeSize, eyeRadius), roundedBox(eyes - vec2(eyeSpacing, 0.), eyeSize, eyeRadius));
      vec3 light = vec3(0.);
      // Six separate coloured sheets. Their individual curves flow into the face,
      // without rotating a palette or drawing a circular outline.
      for (int i = 0; i < 6; i++) {
        float n = float(i);
        float side = i < 3 ? 1. : -1.;
        float span = mix(1.20, .98 + .035 * sin(n * 2. + time * .65), morph);
        float x = p.x / span;
        float envelope = pow(max(0., 1. - x * x), mix(1.3, .55, morph));
        float phase = time * (1.45 + .19 * n) + n * 1.53;
        float travel = sin(x * 3.2 - phase);
        float level = mod(n, 3.);
        float waveHeight = side * (.13 + speech * (.25 + .06 * level))
          + .15 * travel + .08 * sin(x * 5.8 + phase * .72);
        float waveY = waveHeight * envelope;
        float faceHeight = side * (.63 - .25 * level);
        float faceY = (faceHeight + .065 * sin(x * 3. + phase * .50)
          + .055 * speech * sin(x * 5. + phase)) * envelope;
        // Asymmetric folds extend slightly outwards while the mascot speaks.
        faceY += .10 * sin(x * 3. + n * 1.8) * envelope;
        float center = mix(waveY, faceY, morph);
        float waveWidth = (.025 + .025 * (1. + sin(phase + x * 2.))) * envelope;
        float outerFold = (i == 2 || i == 5) ? 1. : 0.;
        float faceWidth = mix(.27, .21, outerFold) + .035 * sin(x * 3. + phase * .45);
        faceWidth *= .60 + .40 * envelope;
        float width = mix(waveWidth, faceWidth, morph);
        float distance = abs(p.y - center) - width;
        distance = max(distance, (abs(x) - 1.) * span);
        float foldRadius = .82 + .03 * sin(phase * .55 + p.y * 5.) + outerFold * .11 * smoothstep(.35, .85, abs(p.x));
        float roundLimit = length(p / vec2(1., .98)) - foldRadius;
        distance = max(distance, mix(-2., roundLimit, morph));
        // Subtract the apertures from every sheet BEFORE emitting any colour.
        float material = morph < .001 ? distance : max(distance, -hole);
        float core = 1. - smoothstep(-.025, .045, material);
        float softness = mix(.032, .035, morph);
        float halo = exp(-pow(max(distance, 0.) / softness, 2.)) * .18;
        halo *= morph < .001 ? 1. : smoothstep(-.015, .035, hole);
        float broadGlow = exp(-pow(max(distance, 0.) / .12, 2.)) * .065 * (morph < .001 ? 1. : smoothstep(-.02, .055, hole));
        float ridge = exp(-pow((p.y - center - side * width * .55) / max(.01, width * .40), 2.));
        float flow = .55 + .45 * sin(x * 3.3 + phase * .9);
        float softBand = exp(-pow((p.y - center) / max(.012, width * .85), 2.));
        float intensity = mix((.15 + .60 * softBand + .22 * ridge) * (.6 + .4 * flow), .14 + .38 * ridge + .14 * flow, morph);
        intensity *= pow(max(0., 1. - x * x), .16);
        light += ribbonColor(n, x) * (core * intensity + halo + broadGlow);
      }
      // Tone mapping preserves the individual ribbon colours where they overlap.
      gl_FragColor = vec4(1. - exp(-light * 1.15), 1.);
    }
  `;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution','time','pose','gaze'].map(name => [name, gl.getUniformLocation(program, name)]));
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  new ResizeObserver(resize).observe(button);
  resize();
  button.addEventListener('click', () => {
    target = 1 - target;
    button.setAttribute('aria-pressed', String(Boolean(target)));
    button.setAttribute('aria-label', target ? 'Return to the listening wave' : 'Show the speaking mascot');
  });
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .22))) * .26;
    pointerY = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - event.clientY) / (rect.height * .22))) * .19;
  });
  button.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  function draw(now) {
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now;
    if (!reduced.matches) time += dt;
    pose += (target - pose) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 3.8));
    if (Math.abs(target - pose) < .0005) pose = target;
    gazeX += (pointerX - gazeX) * (1 - Math.exp(-dt * 9));
    gazeY += (pointerY - gazeY) * (1 - Math.exp(-dt * 9));
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.pose, pose);
    gl.uniform2f(uniforms.gaze, gazeX, gazeY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    frames++;
    signalReady();
    requestAnimationFrame(draw);
  }
  // Useful read-only diagnostics for embed and standalone verification.
  window.voiceDemo = { get state() { return { target: target ? 'answering' : 'listening', pose, time, gaze: [gazeX, gazeY], frames, reducedMotion: reduced.matches, ready }; } };
  requestAnimationFrame(draw);
})();
