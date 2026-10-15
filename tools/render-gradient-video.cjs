// Offline frame capture based on the html-renderer skill's Playwright/ffmpeg workflow.
// The live element remains unchanged. Only the capture copy gets a particle return path.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const deps = process.env.HTML_RENDERER_DEPS_DIR || path.join(os.tmpdir(), 'html-renderer-deps');
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const ffmpeg = require(path.join(deps, 'node_modules/ffmpeg-static'));
const root = path.resolve(__dirname, '..');
const scene = Number(process.argv[2] || 0);
if (!Number.isInteger(scene) || scene < 0 || scene > 3) throw Error('Scene must be 0–3');
const ref = process.env.GRADIENT_SOURCE_REF || 't3code/weirdos-gradient-shading-integration';
const sourceFile = 'elements/gradient-animalcula-interstellaria/index.html';
const source = cp.execFileSync('git', ['show', `${ref}:${sourceFile}`], { cwd: root, encoding: 'utf8' });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'weirdos-gradient-render-'));
const out = path.join(root, 'export', `gradient-${scene + 1}${process.argv.includes('--sample') ? '-sample-12s' : ''}.mp4`);
const capture = `
let captureStart, captureFree;
window.captureInit = index => {
  sceneIndex = index;
  restart();
  cancelAnimationFrame(raf); raf = 0; render = () => {};
  captureStart = objects.slice(); captureFree = objects.slice();
  draw(); gl.finish();
  return {scene: sceneIndex, floatStorage, particles: OBJECT_COUNT, renderer: gl.getParameter(gl.RENDERER)};
};
window.captureFrame = n => {
  const dt = 1/30;
  objects.set(captureFree);
  if (n === 150) {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, button:0, pointerType:'mouse', clientX:innerWidth/2, clientY:innerHeight/2}));
    stopPointer();
  }
  if (n > 0) {
    elapsed = n * dt;
    ripples.forEach(r => r.age += dt);
    stepObjects(dt);
    captureFree.set(objects);
  }
  // Return actual particle coordinates and kernel widths, without an image crossfade.
  // The initial outward click impulse remains visible before the smooth contraction.
  const progress = Math.max(0, Math.min(1, (n - 300) / (359 - 300)));
  const blend = progress * progress * (3 - 2 * progress);
  if (blend) for(let i = 0; i < objects.length; i += 9) {
    for(const k of [0,1,2,8]) objects[i+k] = captureFree[i+k] * (1-blend) + captureStart[i+k] * blend;
  }
  draw(); gl.finish();
  return {frame:n, returnProgress:blend};
};
`;
const html = source.replace('</script>\n</body>', `${capture}</script>\n</body>`)
  .replace('</head>', '<style>#carousel,#restart,#fallback{display:none!important}*{cursor:none!important}</style></head>');
if (!html.includes('window.captureInit')) throw Error('Capture injection failed');
fs.writeFileSync(path.join(temp, 'scene.html'), html);
fs.mkdirSync(path.dirname(out), { recursive:true });
(async () => {
  let browser;
  try {
    browser = await chromium.launch({headless:true, args:['--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport:{width:1920,height:1080}, deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(temp, 'scene.html'));
    console.log(JSON.stringify(await page.evaluate(index => window.captureInit(index), scene)));
    for(let n=0;n<360;n++) {
      await page.evaluate(n => window.captureFrame(n), n);
      await page.screenshot({path:path.join(temp, `${String(n).padStart(4,'0')}.png`)});
      if(n%30===0) console.log(`Captured ${n}/360`);
    }
    if(errors.length) throw Error(errors.join('\n'));
    await browser.close(); browser=null;
    const identical = fs.readFileSync(path.join(temp,'0000.png')).equals(fs.readFileSync(path.join(temp,'0359.png')));
    if(!identical) throw Error('First and last frame differ');
    console.log('Loop verified: identical first and last rendered frames');
    cp.execFileSync(ffmpeg, ['-y','-framerate','30','-i',path.join(temp,'%04d.png'),'-frames:v','360','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart','-an',out], {stdio:['ignore','ignore','pipe']});
    const metadata=cp.spawnSync(ffmpeg,['-hide_banner','-i',out],{encoding:'utf8'}).stderr;
    console.log(metadata);
    console.log(out);
  } finally {
    if(browser) await browser.close();
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
