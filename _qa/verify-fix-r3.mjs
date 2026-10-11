import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

// CLI-driven real input against the production bundle; no world mutations.
const code = `async page => {
  await page.setViewportSize({width:800,height:450});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const root = 'http://127.0.0.1:4196/';
  const out = 'output/playwright/';
  const phase = name => page.waitForFunction(n => document.body.dataset.phase === n, name, {timeout:30000});
  let lowFps = false;
  const fresh = async () => { await page.goto(root + '?fresh=1'+(lowFps?'&qa_lowfps=1':'')); await page.getByRole('button',{name:'Play',exact:true}).waitFor(); await page.getByRole('button',{name:'Play',exact:true}).click(); await phase('rescue'); };
  const next = async target => { await page.keyboard.press('e'); await phase(target); };
  await fresh();
  await next('assign');
  await next('repair');
  await page.getByRole('button',{name:/Repair south barricade/}).waitFor();
  await page.screenshot({path:out+'after-repair-800x450.png'});
  const target = await page.getByRole('button',{name:/Repair south barricade/}).boundingBox();
  if (target.width < 44 || target.height < 44) throw new Error('repair target too small');
  await page.getByRole('button',{name:/Repair south barricade/}).click();
  await phase('dusk');
  await page.screenshot({path:out+'after-dusk-800x450.png'});
  // Repeat the same third step via its visible E shortcut.
  await fresh(); await next('assign'); await next('repair'); await next('dusk');
  const skips = [];
  for (const targetPhase of ['rescue','assign','repair']) {
    await fresh();
    if (targetPhase !== 'rescue') await next('assign');
    if (targetPhase === 'repair') await next('repair');
    await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
    await phase('dusk'); skips.push(targetPhase);
  }
  // Skip remains clickable while the action animation is running.
  for (const targetPhase of ['rescuing','assigning','repairing']) {
    await fresh();
    if (targetPhase !== 'rescuing') await next('assign');
    if (targetPhase === 'repairing') await next('repair');
    await page.keyboard.press('e');
    await phase(targetPhase);
    await page.getByRole('button',{name:'Skip tutorial',exact:true}).click(); await phase('dusk'); skips.push(targetPhase+' click');
  }
  await fresh(); await next('assign'); await next('repair');
  await page.keyboard.press('Escape'); await phase('dusk'); skips.push('repair Escape');
  const timing = [];
  const cdp = await page.context().newCDPSession(page);
  await page.addInitScript(() => {
    if (!location.search.includes('qa_lowfps=1')) return;
    const native = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => native(() => setTimeout(() => callback(performance.now()),500));
  });
  for (const rate of [1,6,'2fps']) {
    lowFps = rate === '2fps';
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:typeof rate==='number'?rate:1});
    await fresh();
    await page.getByRole('button',{name:'Skip tutorial',exact:true}).click(); await phase('dusk');
    await page.getByRole('button',{name:'Stand watch',exact:true}).click(); await phase('night');
    const read = () => page.evaluate(() => ({time:performance.now(),remaining:Number(document.querySelector('.cg-phase b').textContent.replace('s','')),saved:JSON.parse(localStorage.getItem('cg_afterlight_guest_v1')||'{}').run?.nightTime}));
    const a = await read();
    await page.evaluate(() => { window.__qaFrames=0; window.__qaCount=true; const count=()=>{ if(window.__qaCount){window.__qaFrames++;requestAnimationFrame(count)} }; requestAnimationFrame(count); });
    const samples = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(); const samples = []; let previous = -1;
      const poll = setInterval(() => {
        const value = JSON.parse(localStorage.getItem('cg_afterlight_guest_v1')||'{}').run?.nightTime;
        if(typeof value==='number' && value!==previous) {samples.push({wall:performance.now(),sim:value});previous=value;}
        if(performance.now()-start>=10000) {clearInterval(poll);resolve(samples);}
      },20);
    }));
    const b = await read();
    const frames = await page.evaluate(() => {window.__qaCount=false;return window.__qaFrames});
    const seconds = (b.time-a.time)/1000;
    const elapsed = a.remaining-b.remaining;
    if (Math.abs(elapsed-seconds) > Math.max(1.05,seconds*.1)) throw new Error('HUD timer drift '+JSON.stringify({rate,seconds,elapsed}));
    const first = samples[1]; const last = samples[samples.length-1];
    if(!first || !last || last===first) throw new Error('missing clock samples');
    const wall = (last.wall-first.wall)/1000; const sim = last.sim-first.sim;
    const drift = Math.abs(sim-wall)/wall;
    if(drift>.1) throw new Error('simulation clock drift '+JSON.stringify({rate,wall,sim,drift}));
    timing.push({rate,seconds,elapsed,fps:frames/seconds,a,b,wall,sim,drift,samples});
    await page.screenshot({path:out+'after-night-cpu'+rate+'-800x450.png'});
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  lowFps=false;
  // Saved runs must remain frozen behind Continue, including after muting.
  await page.goto(root);
  await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
  const frozenA = await page.evaluate(() => JSON.parse(localStorage.getItem('cg_afterlight_guest_v1')).run);
  await page.getByRole('button',{name:'Mute',exact:true}).click();
  await page.waitForTimeout(1200);
  const frozenB = await page.evaluate(() => JSON.parse(localStorage.getItem('cg_afterlight_guest_v1')).run);
  if (JSON.stringify(frozenA)!==JSON.stringify(frozenB)) throw new Error('title changed saved run');
  await page.screenshot({path:out+'after-continue-800x450.png'});
  await page.getByRole('button',{name:'Continue',exact:true}).focus();
  await page.keyboard.press('Enter'); await phase('night');
  const checks = [];
  for (const [width,height] of [[800,450],[907,510],[1920,1080]]) {
    await page.setViewportSize({width,height}); await page.goto(root+'?fresh=1');
    await page.getByRole('button',{name:'Play',exact:true}).waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({path:out+'after-title-'+width+'x'+height+'.png'});
    checks.push(await page.evaluate(() => ({viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,label:b.getAttribute('aria-label'),inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,width:r.width,height:r.height}})})));
  }
  if(errors.length) throw new Error(JSON.stringify(errors));
  return {skips,target,timing,checks,errors,saveFrozen:true};
}`
const cli = '/Users/yin/.codex/skills/playwright/scripts/playwright_cli.sh'
const result = spawnSync(cli, [`-s=${process.env.AFTERLIGHT_QA_SESSION ?? 'afterlight-r3'}`, 'run-code', code], {
  encoding: 'utf8', env: { ...process.env, PATH: `/Users/yin/.nvm/versions/node/v22.22.2/bin:${process.env.PATH}` }, timeout: 240000,
})
fs.mkdirSync('output/playwright', { recursive: true })
fs.writeFileSync('output/playwright/r3-cli-results.txt', result.stdout + result.stderr)
const jsonLine = result.stdout.split('\n').find(line => line.startsWith('{"skips"'))
if (jsonLine) fs.writeFileSync('output/playwright/r3-results.json', JSON.stringify(JSON.parse(jsonLine), null, 2)+'\n')
process.stdout.write(result.stdout + result.stderr)
if (result.status !== 0) process.exitCode = 1
