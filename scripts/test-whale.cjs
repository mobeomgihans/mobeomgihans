const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');

const WHALE = 'C:/Program Files/Naver/Naver Whale/Application/whale.exe';
const PORT = 9333;

(async () => {
  try {
    console.log('Starting whale with remote debugging...');
    const userDir = path.join(process.env.USERPROFILE, '.bj-debug-' + Date.now());

    const proc = spawn(WHALE, [
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + userDir,
      '--no-first-run',
      '--window-size=1200,800',
      'about:blank'
    ], { detached: true, stdio: 'ignore' });
    proc.unref();

    // Wait for startup
    await new Promise(r => setTimeout(r, 4000));

    console.log('Connecting via CDP...');
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:' + PORT,
      defaultViewport: null,
    });
    console.log('Connected!');

    const pages = await browser.pages();
    console.log('Pages:', pages.length);

    const page = pages[0] || await browser.newPage();
    await page.goto('https://others2.baljumoa.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('URL:', page.url());

    await browser.disconnect();
    process.kill(proc.pid);
    console.log('SUCCESS');
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
})();
