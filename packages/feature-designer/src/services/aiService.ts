import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Initialize Gemini API lazily
let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. AI features will not work.");
    }
    ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key-to-prevent-crash" });
  }
  return ai;
}

export interface BlueprintAnalysis {
  shape: 'rectangle' | 'l-shape' | 'u-shape' | 'custom';
  widthFt: number;
  widthIn: number;
  lengthFt: number;
  lengthIn: number;
  // L-Shape specific
  lRightDepthFt?: number;
  lRightDepthIn?: number;
  lBackWidthFt?: number;
  lBackWidthIn?: number;
  // U-Shape specific (simplified to main wings)
  uLeftWingWidthFt?: number;
  uLeftWingWidthIn?: number;
  uRightWingWidthFt?: number;
  uRightWingWidthIn?: number;
  uLeftWingDepthFt?: number;
  uLeftWingDepthIn?: number;
  uRightWingDepthFt?: number;
  uRightWingDepthIn?: number;
  // General
  wallThicknessIn?: number;
  // Individual Elements
  exteriorWalls?: {
    id: number;
    orientation: 'horizontal' | 'vertical';
    xFt: number;
    xIn: number;
    yFt: number;
    yIn: number;
    lengthFt: number;
    lengthIn: number;
    thicknessIn: number;
    exteriorSide: 1 | -1;
  }[];
  interiorWalls?: {
    id: number;
    orientation: 'horizontal' | 'vertical';
    xFt: number;
    xIn: number;
    yFt: number;
    yIn: number;
    lengthFt: number;
    lengthIn: number;
    thicknessIn: number;
  }[];
  doors?: {
    id: string;
    wall: number;
    xFt: number;
    xIn: number;
    widthIn: number;
    heightIn: number;
  }[];
  windows?: {
    id: string;
    wall: number;
    xFt: number;
    xIn: number;
    widthIn: number;
    heightIn: number;
    sillHeightIn: number;
  }[];
}

// Helper to resize image
async function resizeImage(base64Str: string, maxDimension: number = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width <= maxDimension && height <= maxDimension) {
        // Even if dimensions are small, we might want to compress if it's PNG
        if (base64Str.startsWith('data:image/png') || base64Str.length > 1000000) {
           // Continue to resize/compress
        } else {
           resolve(base64Str);
           return;
        }
      }
      
      if (width > height) {
        if (width > maxDimension) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for better compression
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      console.warn("Failed to load image for resizing, using original");
      resolve(base64Str);
    };
  });
}

export async function analyzeBlueprint(
  imageBase64: string, 
  calibration?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realLengthIn: number }
): Promise<BlueprintAnalysis> {
  try {
    // Resize image to reduce payload size and latency
    const resizedImage = await resizeImage(imageBase64);

    // Extract mime type
    const mimeMatch = resizedImage.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    
    // Remove data URL prefix if present
    const base64Data = resizedImage.replace(/^data:image\/\w+;base64,/, "");
    
    let calibrationPrompt = "";
    if (calibration) {
      calibrationPrompt = `
        CALIBRATION DATA:
        - Point 1 (X, Y): (${calibration.p1.x}, ${calibration.p1.y})
        - Point 2 (X, Y): (${calibration.p2.x}, ${calibration.p2.y})
        - Real-world distance between these points: ${calibration.realLengthIn} inches.
        Use this to accurately scale all dimensions in the floor plan.
      `;
    }

    const prompt = `
      Analyze this architectural floor plan image.
      ${calibrationPrompt}
      1. Identify the overall shape of the house footprint. If it's a complex custom shape, use 'custom'.
      2. Extract the overall exterior dimensions (Width and Length/Depth).
      3. Identify and list ALL major exterior wall segments with their positions (X, Y) relative to the top-left corner (0,0), lengths, and orientations.
      4. Identify and list major interior wall segments.
      5. Identify doors and windows, noting which wall they belong to and their position along that wall.
      6. Estimate the exterior wall thickness (default to 6 inches).
      
      Return dimensions in Feet and Inches. 
      For wall positions, use a consistent coordinate system where the top-left of the house is roughly (0,0).
    `;

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out after 120 seconds")), 120000)
    );

    const apiCall = getAI().models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shape: { 
              type: Type.STRING, 
              enum: ["rectangle", "l-shape", "u-shape", "custom"],
              description: "The overall shape of the house footprint."
            },
            widthFt: { type: Type.NUMBER },
            widthIn: { type: Type.NUMBER },
            lengthFt: { type: Type.NUMBER },
            lengthIn: { type: Type.NUMBER },
            lRightDepthFt: { type: Type.NUMBER },
            lRightDepthIn: { type: Type.NUMBER },
            lBackWidthFt: { type: Type.NUMBER },
            lBackWidthIn: { type: Type.NUMBER },
            uLeftWingWidthFt: { type: Type.NUMBER },
            uLeftWingWidthIn: { type: Type.NUMBER },
            uRightWingWidthFt: { type: Type.NUMBER },
            uRightWingWidthIn: { type: Type.NUMBER },
            uLeftWingDepthFt: { type: Type.NUMBER },
            uLeftWingDepthIn: { type: Type.NUMBER },
            uRightWingDepthFt: { type: Type.NUMBER },
            uRightWingDepthIn: { type: Type.NUMBER },
            wallThicknessIn: { type: Type.NUMBER },
            exteriorWalls: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  orientation: { type: Type.STRING, enum: ["horizontal", "vertical"] },
                  xFt: { type: Type.NUMBER },
                  xIn: { type: Type.NUMBER },
                  yFt: { type: Type.NUMBER },
                  yIn: { type: Type.NUMBER },
                  lengthFt: { type: Type.NUMBER },
                  lengthIn: { type: Type.NUMBER },
                  thicknessIn: { type: Type.NUMBER },
                  exteriorSide: { type: Type.NUMBER, description: "Exterior side of the wall (1 or -1)" }
                }
              }
            },
            interiorWalls: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  orientation: { type: Type.STRING, enum: ["horizontal", "vertical"] },
                  xFt: { type: Type.NUMBER },
                  xIn: { type: Type.NUMBER },
                  yFt: { type: Type.NUMBER },
                  yIn: { type: Type.NUMBER },
                  lengthFt: { type: Type.NUMBER },
                  lengthIn: { type: Type.NUMBER },
                  thicknessIn: { type: Type.NUMBER }
                }
              }
            },
            doors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  wall: { type: Type.NUMBER },
                  xFt: { type: Type.NUMBER },
                  xIn: { type: Type.NUMBER },
                  widthIn: { type: Type.NUMBER },
                  heightIn: { type: Type.NUMBER }
                }
              }
            },
            windows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  wall: { type: Type.NUMBER },
                  xFt: { type: Type.NUMBER },
                  xIn: { type: Type.NUMBER },
                  widthIn: { type: Type.NUMBER },
                  heightIn: { type: Type.NUMBER },
                  sillHeightIn: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["shape", "widthFt", "lengthFt"]
        }
      }
    });

    const response = await Promise.race([apiCall, timeoutPromise]) as GenerateContentResponse;

    const text = response.text;
    
    if (!text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(text) as BlueprintAnalysis;
  } catch (error) {
    console.error("Error analyzing blueprint:", error);
    throw error;
  }
}
