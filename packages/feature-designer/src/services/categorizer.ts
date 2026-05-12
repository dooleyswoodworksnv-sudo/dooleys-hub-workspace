import * as path from 'path';
import * as fs from 'fs';

export class AssetCategorizer {
    async categorizeAndMove(sourcePath: string, title: string, baseType: string): Promise<string> {
        // AI or heuristics to guess category.
        let categoryLine = 'uncategorized';
        
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('sofa') || lowerTitle.includes('chair') || lowerTitle.includes('table')) {
            categoryLine = 'furniture';
        } else if (lowerTitle.includes('wood') || lowerTitle.includes('metal')) {
            categoryLine = 'surface';
        }

        const assetsFolder = path.join(process.cwd(), 'assets', baseType, categoryLine);
        if (!fs.existsSync(assetsFolder)) {
            fs.mkdirSync(assetsFolder, { recursive: true });
        }

        const fileName = path.basename(sourcePath);
        const destinationPath = path.join(assetsFolder, fileName);
        
        // Move file
        fs.renameSync(sourcePath, destinationPath);

        return destinationPath;
    }
}
