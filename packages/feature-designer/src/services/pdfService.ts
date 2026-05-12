import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PDFImage {
  url: string;
  width: number;
  height: number;
  pageNumber: number;
}

export async function convertPDFToImages(file: File): Promise<PDFImage[]> {
  console.log(`Starting PDF conversion for file: ${file.name}, size: ${file.size} bytes`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Load the document
    const loadingTask = pdfjs.getDocument({ 
      data: data,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    const images: PDFImage[] = [];

    // Limit to first 50 pages to avoid memory issues
    const pagesToProcess = Math.min(pdf.numPages, 50);
    if (pdf.numPages > 50) {
      console.warn(`PDF has ${pdf.numPages} pages. Limiting to first 50 pages to prevent memory issues.`);
    }

    for (let i = 1; i <= pagesToProcess; i++) {
      try {
        console.log(`Rendering page ${i}/${pagesToProcess}...`);
        const page = await pdf.getPage(i);
        
        // Use a reasonable scale. 1.5 is a good balance between quality and memory
        const viewport = page.getViewport({ scale: 1.5 }); 
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          console.error(`Could not get 2D context for page ${i}`);
          continue;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext as any).promise;

        images.push({
          url: canvas.toDataURL('image/png'),
          width: viewport.width,
          height: viewport.height,
          pageNumber: i,
        });
        
        // Clean up page object
        (page as any).cleanup();
        
        console.log(`Page ${i} rendered successfully.`);
      } catch (pageError) {
        console.error(`Error rendering page ${i}:`, pageError);
      }
    }

    console.log(`PDF conversion complete. Total images: ${images.length}`);
    return images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw error;
  }
}
