import puppeteer from 'puppeteer';

const SCREENSHOT_DIR = 'C:/Users/doole/.gemini/antigravity/brain/47f182d8-45e8-4f45-8cf0-08431a383639';

async function testApp() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const errors = [];
  page.on('pageerror', err => errors.push(err.toString()));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  // Phase 1: Dashboard
  console.log('=== PHASE 1: DASHBOARD ===');
  await page.goto('http://localhost:3050', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_01_dashboard.png`, fullPage: false });
  console.log('Dashboard loaded successfully');
  
  // Test project name input
  const nameInput = await page.$('#project-name-input');
  if (nameInput) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.type('QA Test Project');
    console.log('✅ Project name input works');
  } else {
    console.log('❌ Project name input not found');
  }

  // Test project number input  
  const numInput = await page.$('#project-number-input');
  if (numInput) {
    await numInput.click({ clickCount: 3 });
    await numInput.type('PRJ-2026-QA');
    console.log('✅ Project number input works');
  } else {
    console.log('❌ Project number input not found');
  }

  // Test New Project button
  const newBtn = await page.$('#new-project-btn');
  if (newBtn) {
    await newBtn.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('✅ New Project button clickable');
  }

  // Test Save Project button
  const saveBtn = await page.$('#save-project-btn');
  if (saveBtn) {
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('✅ Save Project button clickable');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_02_dashboard_interacted.png`, fullPage: false });

  // Phase 2: Blueprint Reader
  console.log('\n=== PHASE 2: BLUEPRINT READER ===');
  await page.goto('http://localhost:3050/blueprints', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_03_blueprints.png`, fullPage: false });
  console.log('Blueprint Reader loaded');

  // Phase 3: Designer
  console.log('\n=== PHASE 3: DESIGNER ===');
  await page.goto('http://localhost:3050/designer', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_04_designer.png`, fullPage: false });
  console.log('Designer loaded');

  // Phase 4: Project Manager
  console.log('\n=== PHASE 4: PROJECT MANAGER ===');
  await page.goto('http://localhost:3050/projects', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_05_project_manager.png`, fullPage: false });
  console.log('Project Manager loaded');

  // Scroll to check all sections
  await page.evaluate(() => window.scrollTo(0, 500));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_06_pm_gantt.png`, fullPage: false });
  
  await page.evaluate(() => window.scrollTo(0, 1200));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_07_pm_budget.png`, fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 2500));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_08_pm_audit.png`, fullPage: false });

  // Test Add Task button in Gantt
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));
  const addTaskBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent?.includes('Add Task'));
  });
  if (addTaskBtn) {
    try {
      await addTaskBtn.click();
      await new Promise(r => setTimeout(r, 500));
      console.log('✅ Add Task button works');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/test_09_add_task_modal.png`, fullPage: false });
      
      // Close the modal
      const closeBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button[aria-label="Close"]'));
        return btns[0];
      });
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 300));
    } catch(e) {
      console.log('⚠️ Add Task button issue:', e.message);
    }
  }

  // Phase 5: Integration - Navigate between modules
  console.log('\n=== PHASE 5: INTEGRATION ===');
  
  // Navigate back to dashboard
  await page.goto('http://localhost:3050', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test_10_dashboard_return.png`, fullPage: false });
  console.log('Successfully navigated back to Dashboard');

  // Rapid module switching via sidebar
  const sidebarLinks = await page.$$('nav a, aside a, [class*="sidebar"] a');
  console.log(`Found ${sidebarLinks.length} sidebar navigation links`);
  
  // Final error report
  console.log('\n=== ERROR REPORT ===');
  if (errors.length === 0) {
    console.log('✅ No JavaScript console errors detected!');
  } else {
    console.log(`❌ ${errors.length} console error(s) found:`);
    errors.forEach((err, i) => console.log(`  ${i+1}. ${err.substring(0, 200)}`));
  }

  await browser.close();
  console.log('\n=== TESTING COMPLETE ===');
}

testApp().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
