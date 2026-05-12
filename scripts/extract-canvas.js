const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../packages/feature-blueprints/src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* Top: Upload Section */}'));
let endIndex = startIndex;
let sectionDepth = 0;

while (endIndex < lines.length) {
    if (lines[endIndex].includes('<section')) sectionDepth++;
    if (lines[endIndex].includes('</section>')) {
        sectionDepth--;
        if (sectionDepth === 0) {
            endIndex++;
            break;
        }
    }
    endIndex++;
}

const canvasLines = lines.slice(startIndex, endIndex);
const canvasContent = canvasLines.join('\n');

// Find all missing variables/functions that need to be passed as props
// We will simply pass the entire set of handlers we know exist in App.tsx
// To be safe, we'll extract the known handler names from App.tsx
const handlerRegex = /const (handle[a-zA-Z0-9_]+|toggle[a-zA-Z0-9_]+|remove[a-zA-Z0-9_]+|update[a-zA-Z0-9_]+|calculate[a-zA-Z0-9_]+|saveHistory) = /g;
let match;
const handlers = [];
while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[1]);
}

// We also need fileInputRef, imgRef, etc.
// Let's pass refs as well.
const refRegex = /const (.*?Ref) = useRef/g;
const refs = [];
while ((match = refRegex.exec(content)) !== null) {
    // Only pass refs not already in context
    if (!['isAnalyzingRef', 'isCancelledRef', 'stateRef'].includes(match[1])) {
       refs.push(match[1]);
    }
}

// Generate props interface
let propsInterface = 'interface BlueprintCanvasProps {\n';
const allProps = [...new Set([...handlers, ...refs])];
allProps.forEach(prop => {
    propsInterface += `  ${prop}: any;\n`;
});
propsInterface += '}\n';

const componentCode = `import React from 'react';
import { Upload, FileText, Download, Play, CheckCircle2, AlertCircle, Loader2, Copy, FileCode, ChevronLeft, ChevronRight, RefreshCcw, Target, MessageSquare, X, Camera, Pencil, Trash2, ZoomIn, Maximize, Ruler, ChevronDown, Hand, Search, Volume2, VolumeX, Languages, Eye, EyeOff, Moon, Sun, Undo2, Redo2, Key, RotateCw } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import { useBlueprint } from '../context/BlueprintContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

${propsInterface}

export function BlueprintCanvas(props: BlueprintCanvasProps) {
  const {
    uploadMode, setUploadMode, file, setFile, preview, setPreview, originalFileData, setOriginalFileData,
    isAnalyzing, setIsAnalyzing, isProcessingFile, setIsProcessingFile, analyzingProgress, setAnalyzingProgress,
    isAnalyzingRef, isCancelledRef, data, setData, addedItems, setAddedItems, error, setError, copied, setCopied,
    numPages, setNumPages, currentPage, setCurrentPage, analyzeStartPage, setAnalyzeStartPage, analyzeEndPage, setAnalyzeEndPage,
    pdfDoc, setPdfDoc, customPrompt, setCustomPrompt, searchQuery, setSearchQuery, showSearchResults, setShowSearchResults,
    selectedItemId, setSelectedItemId, isFocusMode, setIsFocusMode, isNotationMode, setIsNotationMode, notationStart, setNotationStart,
    notationEnd, setNotationEnd, isMeasurementMode, setIsMeasurementMode, measurementStart, setMeasurementStart, measurementEnd, setMeasurementEnd,
    measurementType, setMeasurementType, measurementPoints, setMeasurementPoints, showMeasurementPopup, setShowMeasurementPopup,
    measurementLength, setMeasurementLength, measurementInches, setMeasurementInches, calibrationUnit, setCalibrationUnit,
    calibrationScale, setCalibrationScale, currentMeasurement, setCurrentMeasurement, fileHandle, setFileHandle, lastSavedHash, setLastSavedHash,
    lastSavedTime, setLastSavedTime, isAutoSaving, setIsAutoSaving, windowSize, setWindowSize, soundEnabled, setSoundEnabled,
    calibrationPixelDist, setCalibrationPixelDist, guides, setGuides, mousePos, setMousePos, isManualZoomMode, setIsManualZoomMode,
    isPanMode, setIsPanMode, isFullscreen, setIsFullscreen, isOnlyHighlightedView, setIsOnlyHighlightedView, isDarkMode, setIsDarkMode,
    activeViewCrop, setActiveViewCrop, zoomLevel, setZoomLevel, isPanning, setIsPanning, panStart, setPanStart, notations, setNotations,
    crop, setCrop, focusImage, setFocusImage, isTranslating, setIsTranslating, targetLanguage, setTargetLanguage, explanationTerm, setExplanationTerm,
    explanationText, setExplanationText, isExplaining, setIsExplaining, showSettings, setShowSettings, apiKeyInput, setApiKeyInput
  } = useBlueprint();

  const {
    ${allProps.join(',\n    ')}
  } = props;

  return (
    <>
${canvasContent}
    </>
  );
}
`;

const canvasPath = path.join(__dirname, '../packages/feature-blueprints/src/components/BlueprintCanvas.tsx');
fs.mkdirSync(path.dirname(canvasPath), { recursive: true });
fs.writeFileSync(canvasPath, componentCode);

// Replace lines in App.tsx
const propsPassed = allProps.map(p => `          ${p}={${p}}`).join('\n');
const replacement = `        <BlueprintCanvas\n${propsPassed}\n        />`;

lines.splice(startIndex, endIndex - startIndex, replacement);

// Add import
lines.unshift(`import { BlueprintCanvas } from './components/BlueprintCanvas';`);

fs.writeFileSync(appPath, lines.join('\n'));
console.log('Canvas extracted successfully!');
