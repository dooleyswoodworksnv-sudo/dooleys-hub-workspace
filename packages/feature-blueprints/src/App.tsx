import { BlueprintCanvas } from './components/BlueprintCanvas';
import { BlueprintSidebar } from './components/BlueprintSidebar';
import { useBlueprint, BlueprintProvider } from './context/BlueprintContext';
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Play, CheckCircle2, AlertCircle, Loader2, Copy, FileCode, ChevronLeft, ChevronRight, RefreshCcw, Target, MessageSquare, X, Camera, Pencil, Trash2, ZoomIn, Maximize, Ruler, ChevronDown, Hand, Search, Volume2, VolumeX, Languages, Eye, EyeOff, Moon, Sun, Undo2, Redo2, Key, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { analyzeBlueprint, translateBlueprintData, explainArchitecturalTerm, BlueprintData, Notation, CalibrationData, Guide, BlueprintItem } from './services/gemini';
import { Button, cn } from '@dooleys/ui';
import { useProject } from '@dooleys/core';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;



type ProjectFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile?: () => Promise<File>;
};

type ProjectFileData = {
  version: 1;
  uploadMode?: 'image' | 'pdf' | 'project';
  fileName: string;
  fileType: string;
  fileData: string;
  data?: BlueprintData | null;
  notations?: Notation[];
  calibrationScale?: CalibrationData | null;
  calibration?: CalibrationData | null;
  addedItems?: string[];
};

const MAX_PROJECT_FILE_DATA_LENGTH = 75 * 1024 * 1024;

function AppContent() {
  const state = useBlueprint();
  const { uploadMode, setUploadMode, file, setFile, preview, setPreview, originalFileData, setOriginalFileData, isAnalyzing, setIsAnalyzing, isProcessingFile, setIsProcessingFile, analyzingProgress, setAnalyzingProgress, isAnalyzingRef, isCancelledRef, data, setData, addedItems, setAddedItems, error, setError, copied, setCopied, numPages, setNumPages, currentPage, setCurrentPage, analyzeStartPage, setAnalyzeStartPage, analyzeEndPage, setAnalyzeEndPage, pdfDoc, setPdfDoc, customPrompt, setCustomPrompt, searchQuery, setSearchQuery, showSearchResults, setShowSearchResults, selectedItemId, setSelectedItemId, isFocusMode, setIsFocusMode, isNotationMode, setIsNotationMode, notationStart, setNotationStart, notationEnd, setNotationEnd, isMeasurementMode, setIsMeasurementMode, measurementStart, setMeasurementStart, measurementEnd, setMeasurementEnd, measurementType, setMeasurementType, measurementPoints, setMeasurementPoints, showMeasurementPopup, setShowMeasurementPopup, measurementLength, setMeasurementLength, measurementInches, setMeasurementInches, calibrationUnit, setCalibrationUnit, calibrationScale, setCalibrationScale, currentMeasurement, setCurrentMeasurement, fileHandle, setFileHandle, lastSavedHash, setLastSavedHash, lastSavedTime, setLastSavedTime, isAutoSaving, setIsAutoSaving, windowSize, setWindowSize, soundEnabled, setSoundEnabled, calibrationPixelDist, setCalibrationPixelDist, guides, setGuides, mousePos, setMousePos, isManualZoomMode, setIsManualZoomMode, isPanMode, setIsPanMode, isFullscreen, setIsFullscreen, isOnlyHighlightedView, setIsOnlyHighlightedView, isDarkMode, setIsDarkMode, activeViewCrop, setActiveViewCrop, zoomLevel, setZoomLevel, isPanning, setIsPanning, panStart, setPanStart, notations, setNotations, crop, setCrop, focusImage, setFocusImage, isTranslating, setIsTranslating, targetLanguage, setTargetLanguage, explanationTerm, setExplanationTerm, explanationText, setExplanationText, isExplaining, setIsExplaining, showSettings, setShowSettings, apiKeyInput, setApiKeyInput } = state;
  type HistoryState = {
    notations: Notation[];
    guides: Guide[];
    calibrationScale: CalibrationData | null;
    addedItems: string[];
  };
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const stateRef = useRef<HistoryState>({ notations: [], guides: [], calibrationScale: null, addedItems: [] });

  // ── Bridge: sync analysis data + images to shared ProjectContext ──
  const { setBlueprintData, blueprintData, currentProject, setCurrentProject } = useProject();
  useEffect(() => {
    if (data) {
      setBlueprintData({
        analysisSummary: data.analysisSummary,
        items: data.items.map(item => ({
          id: item.id,
          type: item.type,
          label: item.label,
          description: item.description,
          value: item.value,
          page: item.page,
          boundingBox: item.boundingBox,
          confidence: item.confidence,
        })),
        // Preserve existing images if already set
        imageDataUrls: blueprintData?.imageDataUrls,
      });
    } else if (!preview) {
      setBlueprintData(null);
    }
  }, [data, setBlueprintData]);

  // ── Bridge: push ALL blueprint pages to context ──
  const lastSyncedPdfRef = useRef<string | null>(null);
  useEffect(() => {
    // For PDFs: render all pages and push the full array
    if (pdfDoc && numPages > 0) {
      const pdfId = `${numPages}-${pdfDoc.fingerprints?.[0] ?? 'pdf'}`;
      if (pdfId === lastSyncedPdfRef.current) return;
      lastSyncedPdfRef.current = pdfId;

      (async () => {
        const allPageUrls: string[] = [];
        for (let i = 1; i <= numPages; i++) {
          const url = await getPdfPageDataUrl(pdfDoc, i);
          if (url) allPageUrls.push(url);
        }
        if (allPageUrls.length > 0) {
          setBlueprintData({
            analysisSummary: blueprintData?.analysisSummary ?? '',
            items: blueprintData?.items ?? [],
            imageDataUrls: allPageUrls,
          });
        }
      })();
    }
    // For single images (PNG/JPG): push as 1-element array
    else if (preview && !pdfDoc && uploadMode === 'image') {
      setBlueprintData({
        analysisSummary: blueprintData?.analysisSummary ?? '',
        items: blueprintData?.items ?? [],
        imageDataUrls: [preview],
      });
    }
  }, [pdfDoc, numPages, preview, uploadMode]);

  useEffect(() => {
    stateRef.current = { notations, guides, calibrationScale, addedItems };
  }, [notations, guides, calibrationScale, addedItems]);

  const saveHistory = () => {
    setPast(prev => [...prev, stateRef.current]);
    setFuture([]);
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture(prev => [stateRef.current, ...prev]);
    setPast(prev => prev.slice(0, prev.length - 1));
    
    setNotations(previous.notations);
    setGuides(previous.guides);
    setCalibrationScale(previous.calibrationScale);
    setAddedItems(previous.addedItems);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(prev => [...prev, stateRef.current]);
    setFuture(prev => prev.slice(1));
    
    setNotations(next.notations);
    setGuides(next.guides);
    setCalibrationScale(next.calibrationScale);
    setAddedItems(next.addedItems);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const playNotification = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  };

  const formatValue = (val: number) => {
    const unit = calibrationScale?.unit || 'feet';
    
    if (unit === 'inches') {
      const feet = Math.floor(val / 12);
      const inches = val % 12;
      const roundedInches = Math.round(inches * 10) / 10;
      
      if (feet === 0 && roundedInches === 0) return '0"';
      if (feet === 0) return `${roundedInches}"`;
      if (roundedInches === 0) return `${feet}'`;
      return `${feet}' ${roundedInches}"`;
    }
    
    if (unit === 'feet') {
      const feet = Math.floor(val);
      const inches = (val - feet) * 12;
      const roundedInches = Math.round(inches * 10) / 10;
      
      if (feet === 0 && roundedInches === 0) return '0"';
      if (feet === 0) return `${roundedInches}"`;
      if (roundedInches === 0) return `${feet}'`;
      return `${feet}' ${roundedInches}"`;
    }
    
    return `${val.toFixed(1)} ${unit}`;
  };

  const getPdfPageDataUrl = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<string | null> => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        // @ts-ignore - Some versions of pdfjs-dist require 'canvas' property
        canvas: canvas
      }).promise;

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      return null;
    }
  };

  const renderPdfPage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number) => {
    setIsProcessingFile(true);
    try {
      const dataUrl = await getPdfPageDataUrl(pdf, pageNumber);
      if (dataUrl) {
        setPreview(dataUrl);
      } else {
        setError('Failed to render PDF page.');
      }
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      setError('Failed to render PDF page.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const getProjectData = () => {
    if (!file || !originalFileData) return null;
    return {
      version: 1,
      uploadMode,
      fileName: file.name,
      fileType: file.type,
      fileData: originalFileData,
      data,
      notations,
      calibrationScale,
      addedItems
    };
  };

  const handleSaveProject = async (explicitHandle?: ProjectFileHandle) => {
    if (!file || !originalFileData) {
      console.error("Cannot save project: missing data", { file, originalFileData });
      return;
    }
    
    const projectData = getProjectData();
    if (!projectData) return;

    const projectJson = JSON.stringify(projectData);
    const blob = new Blob([projectJson], { type: 'application/json' });
    const defaultFileName = `${file.name.split('.')[0]}_project.json`;

    // If a handle is provided (auto-save), try to write directly
    const targetHandle = explicitHandle ?? fileHandle;
    if (targetHandle) {
      try {
        const writable = await targetHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setLastSavedHash(projectJson);
        setLastSavedTime(new Date());
        return;
      } catch (err) {
        console.warn("Direct write failed, falling back to picker", err);
        if (explicitHandle) return; // Don't show picker on auto-save if handle failed
      }
    }
    
    try {
      const fallbackDownload = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setLastSavedHash(projectJson);
        setLastSavedTime(new Date());
      };

      const isIframe = window.self !== window.top;

      if ('showSaveFilePicker' in window && !isIframe) {
        try {
          const handle = await (window as Window & typeof globalThis & {
            showSaveFilePicker: (options: unknown) => Promise<ProjectFileHandle>;
          }).showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [{
              description: 'JSON Project File',
              accept: { 'application/json': ['.json'] },
            }],
          });
          setFileHandle(handle);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setLastSavedHash(projectJson);
          setLastSavedTime(new Date());
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn("showSaveFilePicker failed, falling back to standard download", err);
            fallbackDownload();
          }
        }
      } else {
        fallbackDownload();
      }
    } catch (err: any) {
      console.error("Failed to save project:", err);
    }
  };

  // Auto-save effect
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentProjectData = getProjectData();
      if (!currentProjectData) return;

      const currentHash = JSON.stringify(currentProjectData);
      
      // Only save if there are changes and we've saved at least once (or have a handle)
      if (currentHash !== lastSavedHash && fileHandle) {
        console.log("Auto-saving project...");
        setIsAutoSaving(true);
        
        try {
          await handleSaveProject(fileHandle);
        } finally {
          setTimeout(() => setIsAutoSaving(false), 2000);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [file, data, notations, calibrationScale, addedItems, fileHandle, lastSavedHash]);

  const handleOpenProject = async () => {
    setUploadMode('project');
    const isIframe = window.self !== window.top;
    
    if ('showOpenFilePicker' in window && !isIframe) {
      try {
        const [handle] = await (window as Window & typeof globalThis & {
          showOpenFilePicker: (options: unknown) => Promise<ProjectFileHandle[]>;
        }).showOpenFilePicker({
          types: [{
            description: 'JSON Project File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        setFileHandle(handle);
        if (!handle.getFile) {
          console.error('File handle does not support getFile()');
          setError('Your browser does not support reading this file handle.');
          return;
        }
        const openedFile = await handle.getFile();
        const text = await openedFile.text();
        processProjectJson(text);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error picking file:", err);
          setTimeout(() => fileInputRef.current?.click(), 0);
        }
      }
    } else {
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : '';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error("Failed to convert data URL to Blob manually", e);
      throw e;
    }
  };

  const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  };

  const validateProjectData = (value: unknown): ProjectFileData => {
    if (!isRecord(value) || value.version !== 1) {
      throw new Error('Invalid project file version.');
    }

    if (typeof value.fileName !== 'string' || value.fileName.trim() === '') {
      throw new Error('Project file is missing a valid file name.');
    }

    if (typeof value.fileType !== 'string' || value.fileType.trim() === '') {
      throw new Error('Project file is missing a valid file type.');
    }

    if (typeof value.fileData !== 'string' || !value.fileData.startsWith('data:')) {
      throw new Error('Project file data must be an embedded data URL.');
    }

    if (value.fileData.length > MAX_PROJECT_FILE_DATA_LENGTH) {
      throw new Error('Project file data is too large to load safely.');
    }

    return {
      version: 1,
      uploadMode: value.uploadMode === 'image' || value.uploadMode === 'pdf' || value.uploadMode === 'project'
        ? value.uploadMode
        : undefined,
      fileName: value.fileName,
      fileType: value.fileType,
      fileData: value.fileData,
      data: isRecord(value.data) ? value.data as unknown as BlueprintData : null,
      notations: Array.isArray(value.notations) ? value.notations as Notation[] : [],
      calibrationScale: isRecord(value.calibrationScale) ? value.calibrationScale as unknown as CalibrationData : null,
      calibration: isRecord(value.calibration) ? value.calibration as unknown as CalibrationData : null,
      addedItems: Array.isArray(value.addedItems) ? value.addedItems.filter((item): item is string => typeof item === 'string') : [],
    };
  };

  const processProjectJson = async (jsonText: string) => {
    try {
      const projectData = validateProjectData(JSON.parse(jsonText));
        
        const isPdf = projectData.fileType === 'application/pdf' || projectData.fileName.toLowerCase().endsWith('.pdf');
        
        // Ensure uploadMode is set correctly based on the actual file type
        setUploadMode(isPdf ? 'pdf' : 'image');
        
        const blob = dataUrlToBlob(projectData.fileData);

        const newFile = new File([blob], projectData.fileName || 'project_file', { type: projectData.fileType });
        
        setFile(newFile);
        setData(projectData.data);
        setAddedItems(projectData.addedItems || []);
        setNotations(projectData.notations || []);
        setCalibrationScale(projectData.calibrationScale || projectData.calibration || null);
        setPast([]);
        setFuture([]);
        setError(null);
        
        setOriginalFileData(projectData.fileData);
        setLastSavedHash(jsonText);
        setLastSavedTime(new Date());
        
        if (isPdf) {
          const arrayBuffer = await blob.arrayBuffer();
          const typedArray = new Uint8Array(arrayBuffer);
          const loadingTask = pdfjsLib.getDocument({ data: typedArray });
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setAnalyzeStartPage(1);
          setAnalyzeEndPage(Math.min(pdf.numPages, 5));
          renderPdfPage(pdf, 1);
        } else {
          setPreview(projectData.fileData);
        }
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Failed to load project file.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isJson = selectedFile.name.endsWith('.json') || selectedFile.type === 'application/json';
      const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type === 'application/pdf';

      if (isJson) {
        setIsProcessingFile(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          await processProjectJson(event.target?.result as string);
          setIsProcessingFile(false);
        };
        reader.readAsText(selectedFile);
        e.target.value = '';
        return;
      }

      setFile(selectedFile);
      setPreview(null);
      setData(null);
      setAddedItems([]);
      setNotations([]);
      setGuides([]);
      setCalibrationScale(null);
      setPast([]);
      setFuture([]);
      setError(null);
      setOriginalFileData(null);
      setNumPages(0);
      setCurrentPage(1);
      setPdfDoc(null);

      if (isPdf) {
        setIsProcessingFile(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          const typedArray = new Uint8Array(event.target?.result as ArrayBuffer);
          try {
            const loadingTask = pdfjsLib.getDocument({ data: typedArray });
            const pdf = await loadingTask.promise;
            setPdfDoc(pdf);
            setNumPages(pdf.numPages);
            setAnalyzeStartPage(1);
            setAnalyzeEndPage(Math.min(pdf.numPages, 5));
            await renderPdfPage(pdf, 1);
          } catch (err) {
            console.error('Error loading PDF:', err);
            setError('Failed to load PDF file. Please ensure it is a valid PDF.');
          } finally {
            setIsProcessingFile(false);
          }
        };
        reader.readAsArrayBuffer(selectedFile);
        
        const dataUrlReader = new FileReader();
        dataUrlReader.onloadend = () => {
          setOriginalFileData(dataUrlReader.result as string);
        };
        dataUrlReader.readAsDataURL(selectedFile);
      } else {
        setIsProcessingFile(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
          setOriginalFileData(reader.result as string);
          setIsProcessingFile(false);
        };
        reader.readAsDataURL(selectedFile);
      }
      
      // Clear the input value so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleRotateImage = async () => {
    if (!preview) return;
    setIsProcessingFile(true);
    try {
      const img = new Image();
      img.src = preview;
      await new Promise((resolve) => (img.onload = resolve));
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = img.height;
      canvas.height = img.width;
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const rotatedUrl = canvas.toDataURL('image/png');
      setPreview(rotatedUrl);
      
      // Update original file data so saving project saves the rotated version
      if (uploadMode === 'image') {
         setOriginalFileData(rotatedUrl);
      }
    } catch (err) {
      console.error('Error rotating image:', err);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (pdfDoc && newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      setPreview(null);
      renderPdfPage(pdfDoc, newPage);
      setError(null);
    }
  };

  const toggleItemAdded = (id: string) => {
    saveHistory();
    setAddedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const togglePageAdded = (page: number) => {
    if (!data?.items) return;
    const itemsOnPage = data.items.filter(item => item.page === page || (!item.page && page === 1));
    const allAdded = itemsOnPage.every(item => addedItems.includes(item.id));
    
    saveHistory();
    setAddedItems(prev => {
      if (allAdded) {
        // Remove all items on this page
        const pageItemIds = new Set(itemsOnPage.map(item => item.id));
        return prev.filter(id => !pageItemIds.has(id));
      } else {
        // Add all items on this page
        const newItems = itemsOnPage.map(item => item.id).filter(id => !prev.includes(id));
        return [...prev, ...newItems];
      }
    });
  };

  const handleExplainTerm = async (term: string, context?: string) => {
    setExplanationTerm(term);
    setExplanationText(null);
    setIsExplaining(true);
    try {
      const explanation = await explainArchitecturalTerm(term, context);
      setExplanationText(explanation);
    } catch (err: any) {
      console.error("Explanation error:", err);
      if (err?.message?.includes("API Key not found")) {
        setExplanationText(err.message);
        setShowSettings(true);
      } else {
        setExplanationText("Failed to retrieve explanation. Please try again.");
      }
    } finally {
      setIsExplaining(false);
    }
  };

  const handleTranslate = async () => {
    if (!data) return;
    setIsTranslating(true);
    setError(null);
    try {
      const translatedData = await translateBlueprintData(data, targetLanguage);
      setData(translatedData);
    } catch (err: any) {
      console.error("Translation error:", err);
      if (err?.message?.includes("API Key not found")) {
        setError(err.message);
        setShowSettings(true);
      } else {
        setError("Failed to translate data.");
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !preview || isAnalyzingRef.current) return;

    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    isCancelledRef.current = false;
    setError(null);
    let hadError = false;
    try {
      if (pdfDoc) {
        const newItems: BlueprintItem[] = [];
        const newSummaries: string[] = [];
        
        const start = Math.max(1, analyzeStartPage);
        const end = Math.min(pdfDoc.numPages, analyzeEndPage);
        
        if (end - start + 1 > 5) {
          setError("You can only analyze up to 5 pages at a time.");
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
          return;
        }

        for (let i = start; i <= end; i++) {
          if (isCancelledRef.current) {
            newSummaries.push(`Analysis cancelled by user after page ${i - 1}.`);
            break;
          }
          
          // Construct prompt with notations for this specific page
          let finalPrompt = customPrompt;
          const pageNotations = notations.filter(n => n.page === i || (!n.page && i === 1));
          const notationContext = pageNotations.length > 0 
            ? `\n\nNOTATIONS ON BLUEPRINT:\n${pageNotations.map((n, idx) => `Marker #${idx+1} at coordinates (${n.x.toFixed(1)}%, ${n.y.toFixed(1)}%): ${n.text}`).join('\n')}`
            : '';

          if (focusImage && !customPrompt) {
            finalPrompt = `Focus specifically on the area shown in the attached focus crop.${notationContext}`;
          } else if (focusImage && customPrompt) {
            finalPrompt = `${customPrompt} (Note: Focus specifically on the area shown in the attached focus crop)${notationContext}`;
          } else if (notationContext) {
            finalPrompt = `${customPrompt}${notationContext}`;
          }

          setAnalyzingProgress(`Analyzing page ${i} of ${end}...`);
          const pageDataUrl = await getPdfPageDataUrl(pdfDoc, i);
          if (pageDataUrl) {
            const result = await analyzeBlueprint(pageDataUrl, 'image/png', finalPrompt);
            const itemsWithPage = result.items.map(item => ({ ...item, id: `${item.id}-page-${i}`, page: i }));
            newItems.push(...itemsWithPage);
            newSummaries.push(`Page ${i}: ${result.analysisSummary}`);
          }
        }
        
        if (newItems.length > 0 || !isCancelledRef.current) {
          setData(prevData => {
            const existingItems = prevData?.items.filter(item => item.page === undefined || item.page < start || item.page > end) || [];
            
            const combinedSummary = prevData 
              ? prevData.analysisSummary + `\n\n--- Analysis for Pages ${start}-${end} ---\n` + newSummaries.join('\n\n')
              : newSummaries.join('\n\n');

            return {
              analysisSummary: combinedSummary,
              items: [...existingItems, ...newItems]
            };
          });
        }
      } else {
        // Construct prompt with notations for single image
        let finalPrompt = customPrompt;
        const pageNotations = notations.filter(n => n.page === currentPage || (!n.page && currentPage === 1));
        const notationContext = pageNotations.length > 0 
          ? `\n\nNOTATIONS ON BLUEPRINT:\n${pageNotations.map((n, idx) => `Marker #${idx+1} at coordinates (${n.x.toFixed(1)}%, ${n.y.toFixed(1)}%): ${n.text}`).join('\n')}`
          : '';

        if (focusImage && !customPrompt) {
          finalPrompt = `Focus specifically on the area shown in the attached focus crop.${notationContext}`;
        } else if (focusImage && customPrompt) {
          finalPrompt = `${customPrompt} (Note: Focus specifically on the area shown in the attached focus crop)${notationContext}`;
        } else if (notationContext) {
          finalPrompt = `${customPrompt}${notationContext}`;
        }

        setAnalyzingProgress('Analyzing image...');
        const result = await analyzeBlueprint(preview, 'image/png', finalPrompt);
        if (!isCancelledRef.current) {
          setData({
            ...result,
            items: result.items.map(item => ({ ...item, page: currentPage }))
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      hadError = true;
      const isRateLimit = err?.message?.includes("429") || err?.status === 429 || err?.message?.includes("RESOURCE_EXHAUSTED");
      if (err?.message?.includes("API Key not found")) {
        setError(err.message);
        setShowSettings(true);
      } else if (isRateLimit) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        setError('Failed to analyze blueprint. Please try again with a clearer image or check your calibration.');
      }
    } finally {
      setIsAnalyzing(false);
      setAnalyzingProgress(null);
      isAnalyzingRef.current = false;
      if (!isCancelledRef.current && !hadError) {
        playNotification();
      }
    }
  };

  const handleCaptureFocus = () => {
    if (!imgRef.current || !crop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / 100;
    const scaleY = imgRef.current.naturalHeight / 100;
    
    // If crop is in pixels, convert to percent first (though we aim for percent)
    const percentCrop = crop.unit === 'px' 
      ? {
          x: (crop.x / imgRef.current.width) * 100,
          y: (crop.y / imgRef.current.height) * 100,
          width: (crop.width / imgRef.current.width) * 100,
          height: (crop.height / imgRef.current.height) * 100
        }
      : crop;

    canvas.width = percentCrop.width * scaleX;
    canvas.height = percentCrop.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        percentCrop.x * scaleX,
        percentCrop.y * scaleY,
        percentCrop.width * scaleX,
        percentCrop.height * scaleY,
        0,
        0,
        percentCrop.width * scaleX,
        percentCrop.height * scaleY
      );
      setFocusImage(canvas.toDataURL('image/png'));
      setIsFocusMode(false);
      setCrop(undefined);
    }
  };

  const handleNotationMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isNotationMode || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const startX = ((clientX - rect.left) / rect.width) * 100;
    const startY = ((clientY - rect.top) / rect.height) * 100;
    let currentEndX = startX;
    let currentEndY = startY;

    setNotationStart({ x: startX, y: startY });
    setNotationEnd({ x: currentEndX, y: currentEndY });

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!imgRef.current) return;
      const moveRect = imgRef.current.getBoundingClientRect();
      const moveClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveClientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      currentEndX = Math.max(0, Math.min(100, ((moveClientX - moveRect.left) / moveRect.width) * 100));
      currentEndY = Math.max(0, Math.min(100, ((moveClientY - moveRect.top) / moveRect.height) * 100));
      
      setNotationEnd({ x: currentEndX, y: currentEndY });
    };

    const handleMouseUp = () => {
      saveHistory();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      
      const minX = Math.min(startX, currentEndX);
      const minY = Math.min(startY, currentEndY);
      const width = Math.abs(currentEndX - startX);
      const height = Math.abs(currentEndY - startY);
      
      const newNotation: Notation = {
        id: Math.random().toString(36).substr(2, 9),
        x: minX,
        y: minY,
        width: width > 0.5 ? width : undefined,
        height: height > 0.5 ? height : undefined,
        text: '',
        page: currentPage
      };
      
      setNotations(prev => [...prev, newNotation]);
      setNotationStart(null);
      setNotationEnd(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
  };

  const handleBlueprintClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setShowSearchResults(false);
    if (isMeasurementMode || isNotationMode) return; // Handled by mouseDown/Up
  };

  const handleNotationDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    saveHistory();
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      setNotations(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  const updateNotationText = (id: string, text: string) => {
    setNotations(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const updateNotationDimensions = (id: string, field: 'length' | 'width' | 'height', value: string) => {
    setNotations(prev => prev.map(n => n.id === id ? { 
      ...n, 
      manualDimensions: { 
        ...(n.manualDimensions || {}), 
        [field]: value 
      } 
    } : n));
  };

  const removeNotation = (id: string) => {
    saveHistory();
    setNotations(prev => prev.filter(n => n.id !== id));
  };

  const calculateRealDistance = (start: { x: number, y: number }, end: { x: number, y: number }) => {
    if (!calibrationScale || !imgRef.current) return null;
    
    const width = imgRef.current.naturalWidth || imgRef.current.width || 1000;
    const height = imgRef.current.naturalHeight || imgRef.current.height || 1000;

    const dx = (end.x - start.x) * (width / 100);
    const dy = (end.y - start.y) * (height / 100);
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    
    const realDist = (pixelDist / calibrationScale.pixels) * calibrationScale.realWorld;
    return formatValue(realDist);
  };

  const calculateRealArea = (points: { x: number, y: number }[]) => {
    if (!calibrationScale || !imgRef.current || points.length < 3) return null;
    
    const width = imgRef.current.naturalWidth || imgRef.current.width || 1000;
    const height = imgRef.current.naturalHeight || imgRef.current.height || 1000;
    
    const pxPoints = points.map(p => ({
      x: p.x * (width / 100),
      y: p.y * (height / 100)
    }));
    
    let areaPx = 0;
    for (let i = 0; i < pxPoints.length; i++) {
      const j = (i + 1) % pxPoints.length;
      areaPx += pxPoints[i].x * pxPoints[j].y;
      areaPx -= pxPoints[j].x * pxPoints[i].y;
    }
    areaPx = Math.abs(areaPx) / 2;
    
    const scale = calibrationScale.pixels / calibrationScale.realWorld;
    const areaReal = areaPx / (scale * scale);
    
    if (calibrationScale.unit === 'feet' || calibrationScale.unit === 'ft') {
      return `${areaReal.toFixed(2)} sq ft`;
    } else if (calibrationScale.unit === 'm') {
      return `${areaReal.toFixed(2)} sq m`;
    } else if (calibrationScale.unit === 'inches' || calibrationScale.unit === 'in') {
      return `${areaReal.toFixed(2)} sq in`;
    } else if (calibrationScale.unit === 'cm') {
      return `${areaReal.toFixed(2)} sq cm`;
    }
    return `${areaReal.toFixed(2)} sq ${calibrationScale.unit}`;
  };

  const calculateAngle = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }) => {
    if (!imgRef.current) return null;
    
    const width = imgRef.current.naturalWidth || imgRef.current.width || 1000;
    const height = imgRef.current.naturalHeight || imgRef.current.height || 1000;
    
    const px1 = { x: p1.x * (width / 100), y: p1.y * (height / 100) };
    const px2 = { x: p2.x * (width / 100), y: p2.y * (height / 100) };
    const px3 = { x: p3.x * (width / 100), y: p3.y * (height / 100) };
    
    const a = Math.sqrt(Math.pow(px3.x - px2.x, 2) + Math.pow(px3.y - px2.y, 2));
    const b = Math.sqrt(Math.pow(px1.x - px2.x, 2) + Math.pow(px1.y - px2.y, 2));
    const c = Math.sqrt(Math.pow(px1.x - px3.x, 2) + Math.pow(px1.y - px3.y, 2));
    
    let angleRad = Math.acos((a * a + b * b - c * c) / (2 * a * b));
    if (isNaN(angleRad)) angleRad = 0;
    const angleDeg = angleRad * (180 / Math.PI);
    
    return `${angleDeg.toFixed(1)}°`;
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isMeasurementMode || !imgRef.current) {
        setMousePos(null);
        return;
      }
      
      const rect = imgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setMousePos({ 
        x, 
        y, 
        clientX: e.clientX, 
        clientY: e.clientY 
      });
    };

    if (isMeasurementMode) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isMeasurementMode]);

  useEffect(() => {
    if (selectedItemId && data?.items && imgRef.current) {
      const item = data.items.find(i => i.id === selectedItemId);
      if (item) {
        // Add some padding around the bounding box
        const padding = 5; // 5% padding
        
        const xMin = Math.max(0, item.boundingBox.xMin - padding);
        const yMin = Math.max(0, item.boundingBox.yMin - padding);
        const xMax = Math.min(100, item.boundingBox.xMax + padding);
        const yMax = Math.min(100, item.boundingBox.yMax + padding);
        
        const width = xMax - xMin;
        const height = yMax - yMin;
        
        setActiveViewCrop({
          unit: '%',
          x: xMin,
          y: yMin,
          width,
          height
        });
        setZoomLevel('Custom');
      }
    }
  }, [selectedItemId, data?.items]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'h':
          setIsPanMode(prev => !prev);
          setIsNotationMode(false);
          setIsMeasurementMode(false);
          setIsManualZoomMode(false);
          setIsFocusMode(false);
          break;
        case 'n':
          setIsNotationMode(prev => !prev);
          setIsPanMode(false);
          setIsMeasurementMode(false);
          setIsManualZoomMode(false);
          setIsFocusMode(false);
          break;
        case 'm':
          setIsMeasurementMode(prev => {
            if (prev) {
              setMeasurementStart(null);
              setMeasurementEnd(null);
              setCurrentMeasurement(null);
              setMeasurementPoints([]);
            }
            return !prev;
          });
          setIsPanMode(false);
          setIsNotationMode(false);
          setIsManualZoomMode(false);
          setIsFocusMode(false);
          break;
        case 'z':
          setIsManualZoomMode(prev => !prev);
          setIsPanMode(false);
          setIsNotationMode(false);
          setIsMeasurementMode(false);
          setIsFocusMode(false);
          break;
        case 'f':
          setIsFullscreen(prev => !prev);
          break;
        case 'escape':
          setIsPanMode(false);
          setIsNotationMode(false);
          setIsMeasurementMode(false);
          setIsManualZoomMode(false);
          setIsFocusMode(false);
          setIsFullscreen(false);
          setMeasurementStart(null);
          setMeasurementEnd(null);
          setCurrentMeasurement(null);
          setMeasurementPoints([]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMeasurementMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMeasurementMode || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (measurementType === 'length') {
      setMeasurementStart({ x, y });
      setMeasurementEnd({ x, y });
      setCurrentMeasurement(null);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!imgRef.current) return;
        const r = imgRef.current.getBoundingClientRect();
        const moveX = Math.max(0, Math.min(100, ((moveEvent.clientX - r.left) / r.width) * 100));
        const moveY = Math.max(0, Math.min(100, ((moveEvent.clientY - r.top) / r.height) * 100));
        setMeasurementEnd({ x: moveX, y: moveY });
        
        if (calibrationScale) {
          const dist = calculateRealDistance({ x, y }, { x: moveX, y: moveY });
          setCurrentMeasurement(dist);
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (imgRef.current) {
          const r = imgRef.current.getBoundingClientRect();
          const endX = Math.max(0, Math.min(100, ((upEvent.clientX - r.left) / r.width) * 100));
          const endY = Math.max(0, Math.min(100, ((upEvent.clientY - r.top) / r.height) * 100));
          
          const naturalWidth = imgRef.current.naturalWidth || imgRef.current.width || 1000;
          const naturalHeight = imgRef.current.naturalHeight || imgRef.current.height || 1000;

          const dx = (endX - x) * (naturalWidth / 100);
          const dy = (endY - y) * (naturalHeight / 100);
          const pixelDist = Math.sqrt(dx * dx + dy * dy);

          if (pixelDist > 10) {
            setMeasurementEnd({ x: endX, y: endY });
            setCalibrationPixelDist(pixelDist);
            if (calibrationScale) {
              const label = calculateRealDistance({ x, y }, { x: endX, y: endY });
              setCurrentMeasurement(label);
              
              const newGuide: Guide = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'length',
                start: { x, y },
                end: { x: endX, y: endY },
                label: label || '',
                page: currentPage
              };
              saveHistory();
              setGuides(prev => [...prev, newGuide]);
              
              setTimeout(() => {
                setMeasurementStart(null);
                setMeasurementEnd(null);
                setCurrentMeasurement(null);
              }, 100);
            } else {
              setShowMeasurementPopup(true);
            }
          } else {
            setMeasurementStart(null);
            setMeasurementEnd(null);
            setCurrentMeasurement(null);
          }
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else if (measurementType === 'angle') {
      const newPoints = [...measurementPoints, { x, y }];
      setMeasurementPoints(newPoints);
      
      if (newPoints.length === 3) {
        const label = calculateAngle(newPoints[0], newPoints[1], newPoints[2]);
        if (label) {
          const newGuide: Guide = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'angle',
            points: newPoints,
            label,
            page: currentPage
          };
          saveHistory();
          setGuides(prev => [...prev, newGuide]);
        }
        setMeasurementPoints([]);
      }
    } else if (measurementType === 'area') {
      if (measurementPoints.length > 2) {
        const firstPoint = measurementPoints[0];
        const dx = (x - firstPoint.x) * (rect.width / 100);
        const dy = (y - firstPoint.y) * (rect.height / 100);
        const distToFirst = Math.sqrt(dx * dx + dy * dy);
        
        // Increased click radius from 20 to 40 pixels to make it easier to close the polygon
        if (distToFirst < 40) {
          const label = calculateRealArea(measurementPoints);
          if (label) {
            const newGuide: Guide = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'area',
              points: measurementPoints,
              label,
              page: currentPage
            };
            saveHistory();
            setGuides(prev => [...prev, newGuide]);
          }
          setMeasurementPoints([]);
          return;
        }
      }
      setMeasurementPoints([...measurementPoints, { x, y }]);
    }
  };

  const handleSaveCalibration = () => {
    saveHistory();
    const mainValue = parseFloat(measurementLength) || 0;
    const secondaryValue = parseFloat(measurementInches) || 0;
    
    let totalRealWorld = 0;
    let label = '';
    
    if (calibrationUnit === 'feet') {
      totalRealWorld = mainValue + (secondaryValue / 12);
      label = `${mainValue}' ${secondaryValue}"`;
    } else {
      totalRealWorld = mainValue;
      label = `${mainValue} ${calibrationUnit}`;
    }
    
    console.log('--- SAVE CALIBRATION ---');
    console.log('Unit:', calibrationUnit);
    console.log('Main Value:', mainValue);
    console.log('Secondary Value:', secondaryValue);
    console.log('Total Real World:', totalRealWorld);
    console.log('Pixel Distance (State):', calibrationPixelDist);
    
    // Fallback calculation if state is somehow missing but we have points
    let finalPixelDist = calibrationPixelDist;
    if (!finalPixelDist && measurementStart && measurementEnd && imgRef.current) {
      const naturalWidth = imgRef.current.naturalWidth || imgRef.current.width || 1000;
      const naturalHeight = imgRef.current.naturalHeight || imgRef.current.height || 1000;
      const dx = (measurementEnd.x - measurementStart.x) * (naturalWidth / 100);
      const dy = (measurementEnd.y - measurementStart.y) * (naturalHeight / 100);
      finalPixelDist = Math.sqrt(dx * dx + dy * dy);
      console.log('Recalculated Pixel Distance:', finalPixelDist);
    }

    if (!finalPixelDist || finalPixelDist <= 0) {
      alert('Error: No measurement line detected. Please draw a line on the blueprint first.');
      return;
    }

    if (totalRealWorld <= 0) {
      alert(`Error: Please enter a valid real-world distance (${calibrationUnit}).`);
      return;
    }

    // Call setCalibrationScale BEFORE closing the popup
    const newScale = {
      pixels: finalPixelDist,
      realWorld: totalRealWorld,
      unit: calibrationUnit
    };
    setCalibrationScale(newScale);

    // Add the calibration line as the first guide
    if (measurementStart && measurementEnd) {
      const newGuide: Guide = {
        id: 'calibration-guide',
        start: { x: measurementStart.x, y: measurementStart.y },
        end: { x: measurementEnd.x, y: measurementEnd.y },
        label,
        page: currentPage
      };
      setGuides(prev => [...prev, newGuide]);
    }
    
    console.log('Calibration Scale Set Successfully');

    // Explicitly close modal and reset state
    setShowMeasurementPopup(false);
    setIsMeasurementMode(false);
    setMeasurementStart(null);
    setMeasurementEnd(null);
    setCurrentMeasurement(null);
    setCalibrationPixelDist(null);
    setMeasurementLength('');
    setMeasurementInches('');
  };

  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only pan if we are zoomed in or in Pan Mode
    const isMiddleClick = 'button' in e && e.button === 1;
    if (!activeViewCrop && !isPanMode && !isMiddleClick) return;
    
    // If in another interactive mode, don't pan unless it's a middle click
    if ((isNotationMode || isMeasurementMode || isFocusMode || isManualZoomMode) && !isMiddleClick) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsPanning(true);
    setPanStart({ x: clientX, y: clientY });

    const handlePanMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!imgRef.current) return;
      
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      setPanStart(prevStart => {
        if (!prevStart) return null;
        
        const dx = moveX - prevStart.x;
        const dy = moveY - prevStart.y;
        
        const rect = imgRef.current!.getBoundingClientRect();
        
        setActiveViewCrop(prevCrop => {
          const currentCrop = prevCrop || { x: 0, y: 0, width: 100, height: 100, unit: '%' };
          
          // Calculate movement in percentage relative to the image
          // rect.width/height already include the scale transform
          const xMovePercent = (dx / rect.width) * 100;
          const yMovePercent = (dy / rect.height) * 100;
          
          let newX = currentCrop.x - xMovePercent;
          let newY = currentCrop.y - yMovePercent;
          
          // Clamp to bounds (allow panning slightly beyond edges)
          newX = Math.max(-20, Math.min(120 - currentCrop.width, newX));
          newY = Math.max(-20, Math.min(120 - currentCrop.height, newY));
          
          return {
            ...currentCrop,
            x: newX,
            y: newY
          };
        });
        
        return { x: moveX, y: moveY };
      });
    };

    const handlePanEnd = () => {
      setIsPanning(false);
      setPanStart(null);
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('touchmove', handlePanMove);
      window.removeEventListener('touchend', handlePanEnd);
    };

    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('touchmove', handlePanMove);
    window.addEventListener('touchend', handlePanEnd);
  };

  const handleBlueprintMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setShowSearchResults(false);
    if ('touches' in e) {
       // For touch, we only handle panning if zoomed or in pan mode
       if ((activeViewCrop || isPanMode) && !isNotationMode && !isFocusMode && !isManualZoomMode && !isMeasurementMode) {
         handlePanStart(e);
       }
       return;
    }

    // Middle click always pans if zoomed or in pan mode
    if (e.button === 1 && (activeViewCrop || isPanMode)) {
      e.preventDefault();
      handlePanStart(e);
      return;
    }

    if (isMeasurementMode) {
      handleMeasurementMouseDown(e);
    } else if (isNotationMode) {
      handleNotationMouseDown(e);
    } else if (isPanMode || (activeViewCrop && !isNotationMode && !isFocusMode && !isManualZoomMode)) {
      handlePanStart(e);
    }
  };
  const handleManualZoomComplete = () => {
    if (crop && imgRef.current) {
      const percentCrop = crop.unit === 'px' 
        ? {
            x: (crop.x / imgRef.current.width) * 100,
            y: (crop.y / imgRef.current.height) * 100,
            width: (crop.width / imgRef.current.width) * 100,
            height: (crop.height / imgRef.current.height) * 100
          }
        : crop;

      if (percentCrop.width > 1 && percentCrop.height > 1) {
        setActiveViewCrop(percentCrop as Crop);
        setZoomLevel('Custom');
      }
    }
    setIsManualZoomMode(false);
    setCrop(undefined);
  };

  const handleZoomChange = (level: string) => {
    setZoomLevel(level);
    if (level === 'Fit to Screen') {
      setActiveViewCrop(null);
      return;
    }
    
    const scaleValue = parseInt(level);
    const scale = scaleValue / 100;
    const width = 100 / scale;
    const height = 100 / scale;
    const x = (100 - width) / 2;
    const y = (100 - height) / 2;
    
    setActiveViewCrop({
      unit: '%',
      x,
      y,
      width,
      height
    } as Crop);
  };

  return (
    <>
      <div className="min-h-screen bg-paper text-ink font-sans selection:bg-ink selection:text-paper">
        <header className="border-b border-ink p-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="font-serif italic text-2xl tracking-tight">Blueprint Indexer AI</h1>
              <p className="text-[11px] uppercase tracking-widest opacity-50 mt-1">Automated Architectural Extraction</p>
            </div>
            <div className="h-10 w-px bg-current opacity-10" />
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[9px] uppercase tracking-widest opacity-40 font-bold mb-0.5">Project</label>
                <input
                  type="text"
                  value={currentProject?.name ?? ''}
                  onChange={(e) => {
                    setCurrentProject({
                      ...(currentProject ?? { id: `prj-${Date.now()}`, projectNumber: '', createdAt: new Date().toISOString() }),
                      name: e.target.value,
                    });
                  }}
                  placeholder="Project name..."
                  className="bg-transparent border-b border-current/20 text-sm py-0.5 w-44 placeholder:opacity-30 focus:outline-none focus:border-current/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest opacity-40 font-bold mb-0.5">No.</label>
                <input
                  type="text"
                  value={currentProject?.projectNumber ?? ''}
                  onChange={(e) => {
                    setCurrentProject({
                      ...(currentProject ?? { id: `prj-${Date.now()}`, name: '', createdAt: new Date().toISOString() }),
                      projectNumber: e.target.value,
                    });
                  }}
                  placeholder="PRJ-001"
                  className="bg-transparent border-b border-current/20 text-sm py-0.5 w-24 placeholder:opacity-30 focus:outline-none focus:border-current/50 transition-colors font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
              <Button 
                variant="secondary"
                onClick={handleUndo}
                disabled={past.length === 0}
                className="w-10 h-10 p-0 flex items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={18} />
              </Button>
              <Button 
                variant="secondary"
                onClick={handleRedo}
                disabled={future.length === 0}
                className="w-10 h-10 p-0 flex items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={18} />
              </Button>
            </div>
            <Button 
              variant="secondary"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 p-0 flex items-center justify-center rounded-full"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-400" />}
            </Button>
            <Button 
              variant="secondary"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-10 h-10 p-0 flex items-center justify-center rounded-full"
              title={soundEnabled ? "Sound Enabled" : "Sound Disabled"}
            >
              {soundEnabled ? <Volume2 size={18} className="text-emerald-400" /> : <VolumeX size={18} className="text-red-400" />}
            </Button>
            <Button 
              variant="secondary"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 p-0 flex items-center justify-center rounded-full text-white/70 hover:text-white"
              title="API Key Settings"
            >
              <Key size={18} />
            </Button>
          </div>
        </header>

        {/* API Key Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-paper p-6 rounded-2xl shadow-xl max-w-md w-full border border-ink/10 relative"
              >
                <button 
                  onClick={() => setShowSettings(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-ink/5 transition-colors"
                >
                  <X size={20} />
                </button>
                <h2 className="font-serif italic text-2xl mb-2 flex items-center gap-2">
                  <Key size={24} className="opacity-50" />
                  API Settings
                </h2>
                <p className="text-sm opacity-70 mb-6">
                  To use the AI features (Analysis, Translation, Explanations), you need a Google Gemini API Key. This key is stored locally in your browser and is never sent to our servers.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Gemini API Key</label>
                    <input 
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-ink/5 border border-ink/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if (apiKeyInput.trim()) {
                          localStorage.setItem('gemini_api_key', apiKeyInput.trim());
                        } else {
                          localStorage.removeItem('gemini_api_key');
                        }
                        setShowSettings(false);
                      }}
                      className="px-4 py-2 bg-ink text-paper rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      <main className="max-w-[1800px] mx-auto p-6 space-y-8">
        <BlueprintSidebar
          handleTranslate={handleTranslate}
          togglePageAdded={togglePageAdded}
          handlePageChange={handlePageChange}
          handleExplainTerm={handleExplainTerm}
          toggleItemAdded={toggleItemAdded}
        />
        <BlueprintCanvas
          saveHistory={saveHistory}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          handleSaveProject={handleSaveProject}
          handleOpenProject={handleOpenProject}
          handleFileChange={handleFileChange}
          handleRotateImage={handleRotateImage}
          handlePageChange={handlePageChange}
          toggleItemAdded={toggleItemAdded}
          togglePageAdded={togglePageAdded}
          handleExplainTerm={handleExplainTerm}
          handleTranslate={handleTranslate}
          handleAnalyze={handleAnalyze}
          handleCaptureFocus={handleCaptureFocus}
          handleNotationMouseDown={handleNotationMouseDown}
          handleBlueprintClick={handleBlueprintClick}
          handleNotationDrag={handleNotationDrag}
          updateNotationText={updateNotationText}
          updateNotationDimensions={updateNotationDimensions}
          removeNotation={removeNotation}
          calculateRealDistance={calculateRealDistance}
          calculateRealArea={calculateRealArea}
          calculateAngle={calculateAngle}
          handleMeasurementMouseDown={handleMeasurementMouseDown}
          handleSaveCalibration={handleSaveCalibration}
          handlePanStart={handlePanStart}
          handleBlueprintMouseDown={handleBlueprintMouseDown}
          handleManualZoomComplete={handleManualZoomComplete}
          handleZoomChange={handleZoomChange}
          fileInputRef={fileInputRef}
          imgRef={imgRef}
        />

        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 text-red-700">
            <AlertCircle size={24} className="shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}


      </main>
      {/* Explanation Modal */}
      <AnimatePresence>
        {(explanationTerm || isExplaining) && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
            onClick={() => {
              setExplanationTerm(null);
              setExplanationText(null);
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-3xl p-8 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-ink/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6 shrink-0">
                <h3 className="text-xl font-bold text-ink">
                  {explanationTerm}
                </h3>
                <button 
                  onClick={() => {
                    setExplanationTerm(null);
                    setExplanationText(null);
                  }}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors shrink-0"
                  title="Close explanation"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="overflow-y-auto pr-2">
                {isExplaining ? (
                  <div className="flex flex-col items-center justify-center py-8 text-ink/60">
                    <Loader2 size={32} className="animate-spin mb-4 text-emerald-500" />
                    <p className="text-sm font-medium">Searching for explanation...</p>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-ink/80">
                    <p className="whitespace-pre-wrap">{explanationText}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Measurement Popup */}
      <AnimatePresence>
        {showMeasurementPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl p-8 shadow-2xl max-w-md w-full border border-ink/10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif italic text-2xl">{calibrationScale ? 'Re-calibrate Scale' : 'Calibrate Scale'}</h3>
                <button onClick={() => setShowMeasurementPopup(false)} className="p-2 hover:bg-ink/5 rounded-full transition-colors" title="Close measurement modal">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm opacity-60 mb-6">
                Enter the real-world length of the segment you just drew. This will calibrate the entire blueprint.
              </p>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveCalibration();
                }}
                className="space-y-4"
              >
                <div className="mb-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2 block">Unit</label>
                  <select
                    value={calibrationUnit}
                    onChange={(e) => {
                      setCalibrationUnit(e.target.value);
                      setMeasurementLength('');
                      setMeasurementInches('');
                    }}
                    className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors font-mono appearance-none"
                  >
                    <option value="feet">Feet & Inches</option>
                    <option value="m">Meters (m)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="mm">Millimeters (mm)</option>
                    <option value="inches">Inches (in)</option>
                  </select>
                </div>
                {calibrationUnit === 'feet' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2 block">Feet</label>
                      <input 
                        type="number"
                        value={measurementLength}
                        onChange={(e) => setMeasurementLength(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCalibration();
                          }
                        }}
                        placeholder="ft"
                        min="0"
                        className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2 block">Inches</label>
                      <input 
                        type="number"
                        value={measurementInches}
                        onChange={(e) => setMeasurementInches(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCalibration();
                          }
                        }}
                        placeholder="in"
                        min="0"
                        className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2 block">Distance</label>
                    <input 
                      type="number"
                      value={measurementLength}
                      onChange={(e) => setMeasurementLength(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCalibration();
                        }
                      }}
                      placeholder={calibrationUnit}
                      min="0"
                      step="any"
                      className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                      autoFocus
                    />
                  </div>
                )}
                <button 
                  type="submit"
                  disabled={(() => {
                    const f = parseFloat(measurementLength) || 0;
                    if (calibrationUnit === 'feet') {
                      const i = parseFloat(measurementInches) || 0;
                      return (f + i) <= 0;
                    }
                    return f <= 0;
                  })()}
                  className="w-full py-4 bg-ink text-paper rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  title="Set global scale based on measurement"
                >
                  Save Calibration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Measurement Tooltip */}
      {mousePos && isMeasurementMode && (
        <div 
          className="fixed pointer-events-none z-[200] bg-ink text-paper px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl border border-surface/10 flex items-center gap-2 whitespace-nowrap"
          style={{ 
            left: mousePos.clientX + 20, 
            top: mousePos.clientY + 20 
          }}
        >
          <Ruler size={12} className="text-emerald-400" />
          {measurementType === 'length' ? (
            measurementStart ? (
              calibrationScale ? calculateRealDistance(measurementStart, mousePos) : 'Calibrating...'
            ) : (
              'Click and drag to measure'
            )
          ) : measurementType === 'area' ? (
            measurementPoints.length > 2 ? (
              calibrationScale ? `${calculateRealArea([...measurementPoints, mousePos])} (Click near start point to finish)` : 'Calibrating...'
            ) : (
              'Click to add points to form a shape'
            )
          ) : measurementType === 'angle' ? (
            measurementPoints.length === 2 ? (
              calculateAngle(measurementPoints[0], measurementPoints[1], mousePos)
            ) : measurementPoints.length === 1 ? (
              'Click vertex'
            ) : (
              'Click first endpoint'
            )
          ) : null}
        </div>
      )}
    </div>
    </>
  );
}

export default function App() {
  return <BlueprintProvider><AppContent /></BlueprintProvider>;
}
