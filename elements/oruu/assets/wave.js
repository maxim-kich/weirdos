(() => {
  'use strict';
  const button = document.querySelector('#voice');
  const canvas = button.querySelector('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  const requestedTime = query.has('time') ? Number(query.get('time')) : NaN;
  const fixedTime = Number.isFinite(requestedTime) ? Math.max(0, requestedTime) % 4 : null;
  let ready = false, time = 0, frames = 0, start = null, previous = null;
  let target = 0, pose = 0, gazeX = 0, gazeY = 0, pointerX = 0, pointerY = 0;
  const requestedPose = query.has('morph') ? Number(query.get('morph')) : NaN;
  const fixedPose = Number.isFinite(requestedPose) ? Math.max(0, Math.min(1, requestedPose)) : null;
  function signalReady() {
    if (ready) return;
    ready = true;
    if (parent !== window) parent.postMessage({ type: 'weirdos:ready' }, '*');
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && parent !== window) parent.postMessage({ type: 'weirdos:close' }, '*');
  });
  if (!gl) {
    document.querySelector('.fallback').style.display = 'grid';
    button.disabled = true;
    requestAnimationFrame(signalReady);
    return;
  }
  const vertex = 'attribute vec2 position; void main() { gl_Position = vec4(position, 0., 1.); }';
  // Each coloured ribbon has smooth geometry and material profiles. The
  // coefficient texture stores numbers, never pixels from the reference video.
  const curves = window.WAVE_CURVES;
  if (!gl.getExtension('OES_texture_float') || !curves) {
    document.querySelector('.fallback').style.display = 'grid';
    button.disabled = true;
    requestAnimationFrame(signalReady);
    return;
  }
  const linearProfiles = !!gl.getExtension('OES_texture_float_linear');
  const samples = 1024, rows = 56;
  const profile = new Float32Array(samples * rows * 4);
  const knots = curves.knots;
  // Natural cubic spline: preserve continuous curvature along every strand.
  function spline(values) {
    const n = knots.length, lower = [], diagonal = [], upper = [], rhs = [];
    const second = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const left = knots[i] - knots[i - 1], right = knots[i + 1] - knots[i];
      lower[i] = left; diagonal[i] = 2 * (left + right); upper[i] = right;
      rhs[i] = 6 * ((values[i + 1] - values[i]) / right - (values[i] - values[i - 1]) / left);
      if (i > 1) {
        const factor = lower[i] / diagonal[i - 1];
        diagonal[i] -= factor * upper[i - 1]; rhs[i] -= factor * rhs[i - 1];
      }
    }
    for (let i = n - 2; i > 0; i--) second[i] = (rhs[i] - upper[i] * second[i + 1]) / diagonal[i];
    return x => {
      let i = 0;
      while (i < n - 2 && x > knots[i + 1]) i++;
      const h = knots[i + 1] - knots[i], a = (knots[i + 1] - x) / h, b = 1 - a;
      return a * values[i] + b * values[i + 1] + ((a * a * a - a) * second[i] + (b * b * b - b) * second[i + 1]) * h * h / 6;
    };
  }
  for (let ribbon = 0; ribbon < 8; ribbon++) {
    for (let property = 0; property < 27; property++) {
      const evaluate = spline(curves.coefficients.map(point => point[ribbon][property]));
      for (let x = 0; x < samples; x++) {
        let value = evaluate(2 * x / (samples - 1) - 1);
        if (property >= 4 && property <= 6) value = Math.max(.001, value);
        if (property === 7 || property === 9 || (property >= 14 && property <= 16)) value = Math.max(0, value);
        profile[((ribbon * 7 + Math.floor(property / 4)) * samples + x) * 4 + property % 4] = value;
      }
    }
  }
  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time, pose, elapsed, speech, waveSpeech;
    uniform vec2 gaze;
    uniform sampler2D profiles;
    vec4 coefficients(float x, float row) {
      float sampleX = clamp((x + 1.) * .5, 0., 1.) * 1023.;
      ${linearProfiles ? 'return texture2D(profiles, vec2((sampleX + .5) / 1024., (row + .5) / 56.));' : ''}
      float left = floor(sampleX);
      return mix(texture2D(profiles, vec2((left + .5) / 1024., (row + .5) / 56.)),
                 texture2D(profiles, vec2((min(left + 1., 1023.) + .5) / 1024., (row + .5) / 56.)), fract(sampleX));
    }

    float capsule(vec2 p, vec2 size, float radius) {
      vec2 q = abs(p) - size + radius;
      return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
    }
    void geometry(int i, out vec4 a, out vec4 b, out vec4 c, out vec4 d, out vec4 e) {
      if (i == 0) { a=vec4(0.01138946,0.12965301,0.06087277,-0.28768209); b=vec4(0.09405078,-0.09838244,-0.12000000,-0.12000000); c=vec4(0.77435547,-0.62943798,0.12419824,1.06280494); d=vec4(2.30258512,0.70012844,-0.97646862,0.84433943); e=vec4(-2.83011770,-12.00000000,2.22276211,0.00000000); }
      else if (i == 1) { a=vec4(0.00587432,-0.02796299,-0.03147119,0.23738271); b=vec4(0.12000000,-0.05816735,-0.05954386,-0.02150686); c=vec4(0.57299727,-0.93685889,0.28236708,1.55899596); d=vec4(1.89924181,0.02210273,-0.42818555,0.28631091); e=vec4(7.35934162,12.00000000,1.88273573,0.00000000); }
      else if (i == 2) { a=vec4(0.01320676,0.09749123,0.30967870,-0.15798981); b=vec4(0.00019003,-0.00891823,-0.03517273,-0.05921576); c=vec4(0.21025309,0.75200284,0.13970882,0.27220583); d=vec4(-0.13938762,-1.46762872,-0.52757299,0.15032497); e=vec4(-1.62061894,12.00000000,0.42462939,0.00000000); }
      else if (i == 3) { a=vec4(-0.17647941,0.12715001,0.12337762,-0.28768209); b=vec4(-0.05663976,-0.12000000,-0.00334490,0.10889868); c=vec4(1.01550877,0.05995414,0.35242182,0.75081372); d=vec4(0.12247568,1.45679080,0.61483443,1.10000002); e=vec4(3.28853989,-11.99234009,3.23395181,0.00000000); }
      else if (i == 4) { a=vec4(0.08897773,-0.10816986,0.30647266,-0.28768209); b=vec4(-0.12000000,0.02087112,0.07300996,0.02143987); c=vec4(0.91004044,-0.40179276,-0.78136295,2.25379705); d=vec4(1.92751265,-0.04454060,-1.71479845,0.67941016); e=vec4(2.63633180,-12.00000000,1.70456505,0.00000000); }
      else if (i == 5) { a=vec4(-0.01162366,-0.07590983,0.16915645,-0.28768209); b=vec4(-0.09570404,0.12000000,0.07942592,-0.05805924); c=vec4(1.67841280,0.85852265,-0.42736727,1.20824218); d=vec4(2.30258512,-1.23495853,-0.28105497,0.98022312); e=vec4(-0.21662812,12.00000000,1.03587937,0.00000000); }
      else if (i == 6) { a=vec4(-0.06211196,-0.01888624,0.10857598,-0.08242534); b=vec4(-0.10009155,-0.01704823,-0.02755715,0.00176783); c=vec4(0.21157368,0.01712989,-0.61163229,1.77174532); d=vec4(0.46911889,-1.35210359,-0.73076969,0.24853539); e=vec4(-11.20096111,4.57449579,1.86009395,0.00000000); }
      else if (i == 7) { a=vec4(0.20000000,-0.20000000,-0.10060685,-0.28768209); b=vec4(0.03570838,0.08299766,0.03098555,0.00243090); c=vec4(0.61727953,0.30420342,0.58199483,0.65532297); d=vec4(2.30258512,0.08854997,0.32248667,0.49250579); e=vec4(3.46866870,-12.00000000,-1.97434723,0.00000000); }
      else if (i == 8) { a=vec4(0.00697325,0.20000000,-0.28768209,-0.28768209); b=vec4(0.12000000,-0.02329921,-0.12000000,-0.09262350); c=vec4(2.00000000,-1.25525379,0.85214317,0.81257278); d=vec4(2.30258512,1.06227291,-1.71479845,0.73952961); e=vec4(-4.63705015,-12.00000000,-0.57606661,0.00000000); }
      else if (i == 9) { a=vec4(0.02759558,0.01942622,-0.28768209,0.17961544); b=vec4(0.12000000,0.12000000,0.07243283,-0.01861791); c=vec4(-0.08656005,-1.42478883,0.35995987,1.78846741); d=vec4(1.73881280,0.24569546,0.19162530,0.20503084); e=vec4(12.00000000,9.06690788,0.58072931,0.00000000); }
      else if (i == 10) { a=vec4(0.08003452,0.05797405,0.27478111,-0.28768209); b=vec4(0.01978135,0.03533294,-0.01959874,-0.10292637); c=vec4(0.22608042,-0.85627425,0.50235564,0.00000000); d=vec4(-0.60400701,-1.01855087,-0.37778771,0.15413098); e=vec4(-1.14822257,12.00000000,1.12326872,0.00000000); }
      else if (i == 11) { a=vec4(-0.16750300,0.05138706,-0.03324946,-0.28768209); b=vec4(0.12000000,-0.12000000,0.11754054,0.07177836); c=vec4(1.96266782,0.79356664,0.79350501,1.29120362); d=vec4(-0.05236562,1.45391011,-0.24528407,1.03730214); e=vec4(2.08911848,-12.00000000,1.15271413,0.00000000); }
      else if (i == 12) { a=vec4(0.11860562,-0.05535273,0.23717614,-0.28768209); b=vec4(0.01887242,-0.02316051,-0.03031895,0.05097815); c=vec4(2.00000000,-0.63251448,-1.93800378,2.40645337); d=vec4(0.03368595,-0.59936887,0.50154757,0.72522509); e=vec4(1.79535151,-12.00000000,0.16088225,0.00000000); }
      else if (i == 13) { a=vec4(-0.20000000,-0.02304283,0.33647224,-0.28768209); b=vec4(-0.07168520,0.03091777,0.12000000,0.12000000); c=vec4(1.75188768,0.85359871,-0.86827683,1.50706947); d=vec4(2.30258512,-1.71479845,0.90706694,0.84063417); e=vec4(-0.33203554,12.00000000,0.86355865,0.00000000); }
      else if (i == 14) { a=vec4(-0.13814510,-0.01048187,0.07693595,-0.06024871); b=vec4(-0.00104081,0.02391132,0.01089237,0.01494395); c=vec4(0.57540447,-0.35991630,-0.34639800,1.54534137); d=vec4(-0.00007818,-0.82108748,-1.43256629,0.24797162); e=vec4(-6.81415081,7.83353901,0.21299799,0.00000000); }
      else if (i == 15) { a=vec4(-0.02596796,-0.06178172,-0.25855088,-0.28768209); b=vec4(0.07186023,-0.01809121,0.06086465,0.01230516); c=vec4(1.10419655,0.16738069,0.43501458,1.03696275); d=vec4(0.24475992,0.75244683,-0.08429834,1.05428028); e=vec4(0.43787697,-12.00000000,-1.46626496,0.00000000); }
    }
    void main() {
      float scale = min(resolution.x / 1440., resolution.y / 1080.) * 353.;
      vec2 p = (gl_FragCoord.xy - resolution * .5) / scale;
      float morph = smoothstep(0.,1.,pose);
      bool face = morph > 0.;
      p /= mix(1.,.52,morph);
      if (!face && abs(p.x) >= 1.) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
      float phase = mix(time,1.12,morph) * 1.5707963267948966;
      vec4 motion = vec4(cos(phase), sin(phase), cos(phase * 3.), sin(phase * 3.));
      vec2 pulse = vec2(sin(phase * 2.), cos(phase * 2.));
      vec3 light = vec3(0.);
      for (int i = 0; i < 16; i++) {
        if (!face && i >= 8) break;
        
        float n = float(i);
        float row = mod(n,8.) * 7.;
        vec4 geometry0, geometry1, geometry2, geometry3, geometry4;
        geometry(i, geometry0, geometry1, geometry2, geometry3, geometry4);
        vec2 q=(p-geometry0.xy)/exp(geometry0.zw);
        float radius=length(q), angle=atan(q.y,q.x);
        float x=mix(p.x,clamp(dot(geometry2.xy,p)+geometry2.z,-.94,.94),morph);
        float phase=mix(time,geometry2.w,morph)*1.5707963267948966;
        vec2 pulse=vec2(sin(phase*2.),cos(phase*2.));
        vec4 a = coefficients(x, row);
        vec4 b = coefficients(x, row + 1.);
        vec4 c = coefficients(x, row + 2.);
        vec4 d = coefficients(x, row + 3.);
        vec4 e = coefficients(x, row + 4.);
        vec4 f = coefficients(x, row + 5.);
        vec4 g = coefficients(x, row + 6.);
        float center = dot(a, motion);
        // Speech lifts the existing ribbons, tapering to their stationary ends.
        float waveWeight=1.-morph;
        float envelope=pow(max(0.,1.-p.x*p.x),2.);
        center *= mix(1.,.72+.58*waveSpeech,waveWeight);
        center += waveWeight*envelope*waveSpeech*.055*sin(p.x*4.+elapsed*5.+n*.8);
        float delta = p.y - center;
        float taper = exp(dot(d.xy, pulse) + g.y * sin(phase * 4.) + g.z * cos(phase * 4.)), strength = exp(dot(c.zw, pulse) + f.w * sin(phase * 4.) + g.x * cos(phase * 4.));
        taper *= mix(1.,.88+.24*waveSpeech,waveWeight);
        strength *= mix(1.,.88+.28*waveSpeech,waveWeight);
        float trailDelta = p.y - center*c.x;
        float coreThickness=1., trailThickness=1., haloThickness=1., coverage=1.;
        if (face) {
          // Geometry and thickness only: colours, energy, core, trail, and
          // halo still come from the exact same measured wave profiles.
          angle=atan(q.y+2.*(1.-morph)/max(morph,.001),q.x);
          float orbit=.62 + geometry1.x*cos(angle*2.) + geometry1.y*sin(angle*2.)
                          + geometry1.z*cos(angle*3.) + geometry1.w*sin(angle*3.);
          // The same ribbon folds circulate continuously, swelling on speech beats.
          orbit += .022*sin(angle*3.+elapsed*2.4+n)
                 + .012*sin(angle*5.-elapsed*3.8+n);
          // Speech reaches only the outside folds; the filled body stays anchored.
          float outside = smoothstep(.48,.92,length(p));
          orbit += outside*speech*(.16+.07*sin(angle*3.-elapsed*4.+n*.7));
          haloThickness=mix(1.,1.7+outside*speech*1.3,morph);
          taper=mix(taper,clamp(taper,.01,30.),morph); strength=mix(strength,clamp(strength,.01,100.),morph);
          // Bend each strand into a loop as its remote centre travels inward.
          // The large-radius arc approaches the original horizontal wave at zero.
          float bend=max(morph,.001);
          float reach=2.*(1.-bend)/bend;
          float bentRadius=length(q+vec2(0.,reach))-reach;
          delta=mix(delta,bentRadius-orbit,morph);
          trailDelta=mix(trailDelta,bentRadius-orbit*geometry3.w,morph);
          coreThickness=exp(morph*(delta < 0. ? geometry3.x : geometry3.y));
          trailThickness=exp(morph*geometry3.z);
          coverage=mix(1.,1./(1.+exp(-dot(geometry4.xy,p)-geometry4.z)),morph);
        }
        float coreWidth=b.x*taper*coreThickness;
        if (face) coreWidth=sqrt(coreWidth*coreWidth+.0016*morph);
        float trailWidth=b.y*taper*trailThickness;
        if (face) trailWidth=sqrt(trailWidth*trailWidth+.0016*morph);
        float value = exp(-.5 * pow(delta / coreWidth, 2.));
        value += b.w * exp(-.5 * pow(trailDelta / trailWidth, 2.));
        value += c.y * exp(-.5 * pow(delta / ((b.z * taper + .01) * haloThickness), 2.));
        if (face) {
          // Diffuse light from each existing ribbon, with no separate body layer.
          float glowWidth=sqrt(coreWidth*coreWidth+.0225);
          value += morph*.16*smoothstep(.45,.85,length(p))*exp(-.5*pow(delta/glowWidth,2.));
        }
        // Both folds begin coincident with their source ribbon, sharing its energy.
        value *= coverage*(face ? mix(.5,1.,morph) : 1.);
        // Keep the remote return arc outside the visible strand while it curls in.
        float foldWindow=1.-smoothstep(1.,1.3,length(p/vec2(1.1,.9)));
        value *= mix(1.,foldWindow,smoothstep(0.,.12,morph)*(1.-smoothstep(.88,1.,morph)));
        value *= 1.-smoothstep(mix(1.,2.5,morph),mix(1.001,3.,morph),abs(p.x));
        light += value * strength * vec3(d.zw, e.x) * exp(e.yzw * pulse.x + f.xyz * pulse.y);
      }
      if (face) {
        vec2 eye=p-gaze;
        float opening=smoothstep(.35,1.,morph);
        float eyeHeight=max(.001,.27*opening);
        float eyeRadius=min(.168,eyeHeight);
        float hole=min(capsule(eye-vec2(-.205,.03),vec2(.168,eyeHeight),eyeRadius),
                       capsule(eye-vec2(.205,.03),vec2(.168,eyeHeight),eyeRadius));
        light *= mix(1.,smoothstep(-.035,.025,hole),smoothstep(0.,.12,opening));
      }
      gl_FragColor = vec4(1. - exp(-light), 1.);
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
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearProfiles ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linearProfiles ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, samples, rows, 0, gl.RGBA, gl.FLOAT, profile);
  gl.uniform1i(gl.getUniformLocation(program, 'profiles'), 0);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const clock = gl.getUniformLocation(program, 'time');
  const poseUniform = gl.getUniformLocation(program, 'pose');
  const gazeUniform = gl.getUniformLocation(program, 'gaze');
  const elapsedUniform = gl.getUniformLocation(program, 'elapsed');
  const speechUniform = gl.getUniformLocation(program, 'speech');
  const waveSpeechUniform = gl.getUniformLocation(program, 'waveSpeech');
  // Uneven syllable lengths and stress, grouped into phrases with breathing room.
  // Compute once per frame rather than repeating the envelope for every pixel.
  const syllables = [
    [.12,.18,.55],[.34,.23,.90],[.60,.14,.40],[.79,.28,1.],
    [1.13,.17,.52],[1.35,.30,.72],
    [2.08,.14,.38],[2.27,.22,.75],[2.54,.18,.48],[2.77,.33,1.],
    [3.16,.18,.56],[3.39,.26,.70],[3.72,.34,.45],
    [4.95,.24,.82],[5.24,.15,.43],[5.45,.29,1.],
    [5.82,.19,.60],[6.07,.31,.72],[6.46,.38,.38]
  ];
  let speechStart = 0;
  function speechAt(seconds) {
    const t = seconds % 8.2;
    let level = 0;
    for (const [onset, duration, stress] of syllables) {
      const phase = (t-onset)/duration;
      if (phase <= 0 || phase >= 1) continue;
      // Quick onset, sustained vowel, softer release.
      const attack = Math.min(1,phase/.18);
      const release = Math.min(1,(1-phase)/.65);
      const envelope = attack*attack*(3-2*attack)*release*release*(3-2*release);
      level += stress*envelope;
    }
    return Math.min(1,level);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    // Soft light needs no retina-sized offscreen buffer. Keep CSS geometry intact.
    const ratio = Math.min(devicePixelRatio || 1, 1, 960 / Math.max(rect.width, rect.height));
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const radius = Math.ceil(Math.min(canvas.width/1440,canvas.height/1080)*353*1.6);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.max(0,Math.floor(canvas.width/2-radius)),
      Math.max(0,Math.floor(canvas.height/2-radius)),
      Math.min(canvas.width,radius*2+2),Math.min(canvas.height,radius*2+2));
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  button.addEventListener('click', () => {
    target = 1 - target;
    // Allow a short listening beat after the 480 ms morph.
    if (target) speechStart = performance.now()+480+400;
    button.setAttribute('aria-pressed', String(Boolean(target)));
    button.setAttribute('aria-label', target ? 'Return to the listening wave' : 'Hear Oruu speak');
  });
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1440, rect.height / 1080) * 353;
    pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (scale * 1.1))) * .17;
    pointerY = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - event.clientY) / (scale * 1.1))) * .14;
  });
  button.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  function draw(now) {
    const dt = previous === null ? 0 : Math.max(0,(now - previous) / 1000);
    previous = now;
    if (fixedPose !== null) pose = fixedPose;
    else if (reduced.matches) pose = target;
    else pose += Math.sign(target-pose)*Math.min(Math.abs(target-pose),dt/.48);
    const follow = reduced.matches ? 1 : 1 - Math.exp(-dt * 10);
    gazeX += (pointerX - gazeX) * follow;
    gazeY += (pointerY - gazeY) * follow;
    if (start === null) start = now;
    time = fixedTime ?? (reduced.matches ? 1 : ((now - start) / 1000) % 4);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(clock, time);
    gl.uniform1f(poseUniform, pose);
    gl.uniform1f(waveSpeechUniform, speechAt(fixedTime ?? (reduced.matches ? 1 : (now-start)/1000*1.12)));
    gl.uniform1f(speechUniform, speechAt(fixedTime ?? (reduced.matches ? 1 : Math.max(0,(now-speechStart)/1000))));
    gl.uniform2f(gazeUniform, gazeX, gazeY);
    gl.uniform1f(elapsedUniform, fixedTime ?? (reduced.matches ? 1 : (now - start) / 1000));
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    frames++;
    signalReady();
    requestAnimationFrame(draw);
  }
  window.waveDemo = { get state() { return { time, frames, ready, period: 4, pose, target, gaze: [gazeX, gazeY], reducedMotion: reduced.matches }; } };
  requestAnimationFrame(draw);
})();
