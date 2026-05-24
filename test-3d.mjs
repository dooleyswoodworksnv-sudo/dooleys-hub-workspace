import puppeteer from 'puppeteer';
import path from 'path';

async function test3D() {
  console.log('Starting puppeteer test for 3D Preview...');
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const errors = [];
  const consoleLogs = [];
  
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.toString());
    errors.push({ type: 'pageerror', message: err.toString(), stack: err.stack });
  });
  
  page.on('console', msg => {
    const text = msg.text();
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, text);
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      errors.push({ type: 'console-error', message: text });
    }
  });

  try {
    console.log('Navigating to http://localhost:3050/designer ...');
    await page.goto('http://localhost:3050/designer', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Taking 2D screenshot...');
    await page.screenshot({ path: './test_designer_2d.png' });

    console.log('Finding and clicking "3D Preview" button...');
    const buttons = await page.$$('button');
    let clicked = false;
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('3D Preview')) {
        console.log('Found 3D Preview button, clicking it...');
        await button.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.log('3D Preview button not found via text content. Trying selector.');
      // Find buttons by text using xpath/evaluate
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('3D Preview'));
        if (btn) btn.click();
      });
    }

    console.log('Waiting 8 seconds for 3D view to load or fail...');
    await new Promise(r => setTimeout(r, 8000));

    console.log('Taking 3D screenshot...');
    await page.screenshot({ path: './test_designer_3d.png' });

  } catch (err) {
    console.error('Test script exception:', err);
  } finally {
    await browser.close();
    console.log('=== TEST RESULT SUMMARY ===');
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Total errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors detected:');
      console.log(JSON.stringify(errors, null, 2));
    } else {
      console.log('No page errors detected in puppeteer!');
    }
  }
}

test3D();
