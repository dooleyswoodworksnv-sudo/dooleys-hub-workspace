import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export interface ScrapedAsset {
    id: string;
    title: string;
    type: 'model' | 'material';
    url: string;
    thumbnail: string;
    format: string;
    source: 'polyhaven' | '3dwarehouse' | 'poliigon' | 'unknown';
}

export class AssetScraper {
    
    async search(query: string): Promise<ScrapedAsset[]> {
        console.log(`Starting real search across 3D platforms for: ${query}`);
        
        const browserPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        const executablePath = browserPaths.find(p => fs.existsSync(p));

        const browser = await puppeteer.launch({ 
            headless: false,
            executablePath: executablePath || undefined,
            userDataDir: path.join(process.cwd(), 'puppeteer_session'), // Uses saved logins to bypass blocks
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        let results: ScrapedAsset[] = [];
        
        try {
            console.log("-> Launching Poly Haven, Poliigon, and 3D Warehouse concurrently...");
            
            // Run all 3 scrapers in parallel so one hanging doesn't block the others sequentially
            const promises = [
                this.searchPolyHaven(browser, query)
                    .then(res => { console.log(`✓ Poly Haven finished (${res.length} results)`); return res; })
                    .catch(e => { console.error("X Poly Haven failed:", e.message); return []; }),
                this.searchPoliigon(browser, query)
                    .then(res => { console.log(`✓ Poliigon finished (${res.length} results)`); return res; })
                    .catch(e => { console.error("X Poliigon failed:", e.message); return []; }),
                this.search3DWarehouse(browser, query)
                    .then(res => { console.log(`✓ 3D Warehouse finished (${res.length} results)`); return res; })
                    .catch(e => { console.error("X 3D Warehouse failed:", e.message); return []; })
            ];

            const settled = await Promise.allSettled(promises);
            for (const outcome of settled) {
                if (outcome.status === 'fulfilled') {
                    results = [...results, ...outcome.value];
                }
            }
        } catch (e: any) {
            console.error("Critical scraper orchestrator failure:", e);
        }

        console.log(`Closing browser. Total results: ${results.length}`);
        await browser.close();
        return results;
    }

    private async searchPolyHaven(browser: Browser, query: string): Promise<ScrapedAsset[]> {
        console.log(`[PolyHaven] Fetching API for '${query}'...`);
        try {
            const response = await fetch('https://api.polyhaven.com/assets?s=' + encodeURIComponent(query));
            if (!response.ok) {
                console.log(`[PolyHaven] API completely failed: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const keys = Object.keys(data).slice(0, 5);
            
            return keys.map(key => {
                const item = data[key];
                return {
                    id: `ph_${key}`,
                    title: item.name,
                    // Polyhaven type 2 is Model, type 1 is HDR, assume everything else is material for simplicity
                    type: item.type === 2 ? 'model' : 'material',
                    url: `https://polyhaven.com/a/${key}`,
                    thumbnail: item.thumbnail_url || 'https://via.placeholder.com/150',
                    format: 'zip',
                    source: 'polyhaven' as const
                };
            });
        } catch (e: any) {
            console.error(`[PolyHaven] Error fetching API:`, e.message);
            return [];
        }
    }

    private async searchPoliigon(browser: Browser, query: string): Promise<ScrapedAsset[]> {
        console.log(`[Poliigon] Opening page for '${query}'...`);
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
        
        console.log(`[Poliigon] Navigating...`);
        await page.goto('https://www.poliigon.com/search?query=' + encodeURIComponent(query), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log(`[Poliigon] Goto warning: ${e.message}`));
        
        console.log(`[Poliigon] Waiting for selectors...`);
        await page.waitForSelector('.asset-box', { timeout: 15000 }).catch(() => console.log(`[Poliigon] Selector timeout (could mean 0 results for this query)`));
        
        console.log(`[Poliigon] Extracting data...`);
        const assets = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.asset-box')).slice(0, 5);
            return items.map(item => {
                const link = item.querySelector('a.asset-box__item-link') as HTMLAnchorElement;
                const imgContainer = item.querySelector('.asset-box__image');
                let imgUrl = 'https://via.placeholder.com/150';
                
                if (imgContainer) {
                    const img = imgContainer.querySelector('img');
                    if (img) {
                        imgUrl = img.src;
                    } else {
                        // Sometimes Poliigon uses background-images
                        const style = window.getComputedStyle(imgContainer);
                        const bgImg = style.backgroundImage;
                        if (bgImg && bgImg !== 'none') {
                            imgUrl = bgImg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                        }
                    }
                }
                
                const titleEl = item.querySelector('.asset-box__title');
                const href = link ? link.href : 'https://www.poliigon.com';
                
                return {
                    id: `pg_${Math.random().toString(36).substr(2, 9)}`,
                    title: titleEl?.textContent?.trim() || 'Poliigon Asset',
                    type: ((href.includes('texture') || href.includes('material')) ? 'material' : 'model') as 'model' | 'material',
                    url: href,
                    thumbnail: imgUrl,
                    format: 'zip',
                    source: 'poliigon' as const
                };
            });
        });
        
        await page.close();
        return assets;
    }

    private async search3DWarehouse(browser: Browser, query: string): Promise<ScrapedAsset[]> {
        console.log(`[3DWarehouse] Opening page for '${query}'...`);
        const page = await browser.newPage();
        
        console.log(`[3DWarehouse] Navigating...`);
        await page.goto('https://3dwarehouse.sketchup.com/search/?q=' + encodeURIComponent(query), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log(`[3DWarehouse] Goto warning: ${e.message}`));
        
        console.log(`[3DWarehouse] Waiting for selectors...`);
        await page.waitForSelector('.a-card', { timeout: 15000 }).catch(() => console.log(`[3DWarehouse] Selector timeout (could mean 0 results for this query)`));
        
        console.log(`[3DWarehouse] Extracting data...`);
        const assets = await page.evaluate(() => {
            // Selecting typical class names for 3D warehouse result cards
            const items = Array.from(document.querySelectorAll('.a-card')).slice(0, 5);
            return items.map(item => {
                const imgContainer = item.querySelector('.a-card-preview-container');
                const img = imgContainer ? imgContainer.querySelector('img') : null;
                const link = item.querySelector('a.a-card-content__title-link') as HTMLAnchorElement;
                
                return {
                    id: `3dw_${Math.random().toString(36).substr(2, 9)}`,
                    title: link?.textContent?.trim() || '3D Warehouse Model',
                    type: 'model' as 'model' | 'material', // 3D warehouse is mostly models
                    url: link ? link.href : 'https://3dwarehouse.sketchup.com',
                    thumbnail: img && img.src ? img.src : 'https://via.placeholder.com/150',
                    format: 'skp',
                    source: '3dwarehouse' as const
                };
            });
        });
        
        await page.close();
        return assets;
    }

    async download(url: string, title: string): Promise<string> {
        console.log(`Preparing visual download for ${title} from ${url}`);
        
        const downloadsDir = path.join(process.cwd(), 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Take a snapshot of current files in the downloads directory
        const initialFiles = new Set(fs.readdirSync(downloadsDir));

        const browserPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        const executablePath = browserPaths.find(p => fs.existsSync(p));

        console.log("Launching visible browser for user download...");
        const browser = await puppeteer.launch({ 
            headless: false, // Visible
            executablePath: executablePath || undefined,
            defaultViewport: null,
            userDataDir: path.join(process.cwd(), 'puppeteer_session'), // Remember logins!
            args: ['--start-maximized'] 
        });

        const page = await browser.newPage();
        
        // Route downloads to our local folder
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadsDir,
        });

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Ask the user to click download via a visual floating modal
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.innerHTML = `
                <div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:999999;background:#4CAF50;color:white;padding:15px 30px;border-radius:8px;font-family:sans-serif;font-size:18px;box-shadow:0 4px 15px rgba(0,0,0,0.3);text-align:center;">
                    <strong>Asset Manager is Waiting!</strong><br/>
                    Please log in if necessary, and click Download on this asset.<br/>
                    <small>DO NOT close this window. It will close automatically when the download finishes.</small>
                </div>
            `;
            document.body.appendChild(div);
        });

        console.log("Waiting for user to trigger a download...");

        // Polling loop to wait for a new complete file
        const newFilePath = await new Promise<string>((resolve) => {
            const interval = setInterval(() => {
                const currentFiles = fs.readdirSync(downloadsDir);
                const newFiles = currentFiles.filter(f => !initialFiles.has(f));
                
                for (const file of newFiles) {
                    // Check if it's a finished download (not a .crdownload or .part temp file)
                    if (!file.endsWith('.crdownload') && !file.endsWith('.part')) {
                        clearInterval(interval);
                        resolve(path.join(downloadsDir, file));
                    }
                }
                
                // Also check if user closed browser manually
                if (!browser.isConnected()) {
                    clearInterval(interval);
                    resolve('');
                }
            }, 1000);
        });

        if (browser.isConnected()) {
            await browser.close();
        }

        if (!newFilePath) {
            throw new Error("Browser closed before download completed.");
        }

        // Rename it to the sanitized title so our categorizer can parse it easily
        const ext = path.extname(newFilePath);
        const finalPath = path.join(downloadsDir, `${sanitizedTitle}${ext}`);
        
        // In case the file with that name already exists, delete it first
        if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
        }
        
        fs.renameSync(newFilePath, finalPath);
        console.log(`Download finished and saved to ${finalPath}`);
        
        return finalPath;
    }
}
