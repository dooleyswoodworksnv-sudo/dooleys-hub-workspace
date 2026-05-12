import { exec } from 'child_process';
import * as path from 'path';

export class BlenderService {
    // Windows caches Environment variables heavily until PC Reboots, 
    // so we'll bypass it entirely by pointing straight to your hard drive installation!
    private blenderPath = process.env.BLENDER_PATH || 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe';

    async generateModelEmblem(modelPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(process.cwd(), 'blender_scripts', 'render_model.py');
            const command = `"${this.blenderPath}" -b -P "${scriptPath}" -- "${modelPath}" "${outputPath}"`;
            
            console.log(`Executing: ${command}`);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error rendering model: ${error.message}`);
                    return reject(error);
                }
                resolve();
            });
        });
    }

    async generateMaterialEmblem(diffusePath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(process.cwd(), 'blender_scripts', 'render_material.py');
            const command = `"${this.blenderPath}" -b -P "${scriptPath}" -- "${diffusePath}" "${outputPath}"`;
            
            console.log(`Executing: ${command}`);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error rendering material: ${error.message}`);
                    return reject(error);
                }
                resolve();
            });
        });
    }
}
