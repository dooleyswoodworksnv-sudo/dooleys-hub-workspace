import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { type Crop } from 'react-image-crop';
import * as pdfjsLib from 'pdfjs-dist';
import { BlueprintData, Notation, CalibrationData, Guide, BlueprintItem } from '../services/gemini';

export type ProjectFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile?: () => Promise<File>;
};

export const useBlueprintState = () => {
  const [uploadMode, setUploadMode] = useState<'image' | 'pdf' | 'project'>('project');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalFileData, setOriginalFileData] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState<string | null>(null);
  const isAnalyzingRef = useRef(false);
  const isCancelledRef = useRef(false);
  const [data, setData] = useState<BlueprintData | null>(null);
  const [addedItems, setAddedItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [analyzeStartPage, setAnalyzeStartPage] = useState<number>(1);
  const [analyzeEndPage, setAnalyzeEndPage] = useState<number>(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isNotationMode, setIsNotationMode] = useState(false);
  const [notationStart, setNotationStart] = useState<{ x: number, y: number } | null>(null);
  const [notationEnd, setNotationEnd] = useState<{ x: number, y: number } | null>(null);
  const [isMeasurementMode, setIsMeasurementMode] = useState(false);
  const [measurementStart, setMeasurementStart] = useState<{ x: number, y: number } | null>(null);
  const [measurementEnd, setMeasurementEnd] = useState<{ x: number, y: number } | null>(null);
  const [measurementType, setMeasurementType] = useState<'length' | 'area' | 'angle'>('length');
  const [measurementPoints, setMeasurementPoints] = useState<{ x: number, y: number }[]>([]);
  const [showMeasurementPopup, setShowMeasurementPopup] = useState(false);
  const [measurementLength, setMeasurementLength] = useState('');
  const [measurementInches, setMeasurementInches] = useState('');
  const [calibrationUnit, setCalibrationUnit] = useState('feet');
  const [calibrationScale, setCalibrationScale] = useState<CalibrationData | null>(null);
  const [currentMeasurement, setCurrentMeasurement] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<ProjectFileHandle | null>(null);
  const [lastSavedHash, setLastSavedHash] = useState<string>('');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [calibrationPixelDist, setCalibrationPixelDist] = useState<number | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number, y: number, clientX: number, clientY: number } | null>(null);
  const [isManualZoomMode, setIsManualZoomMode] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnlyHighlightedView, setIsOnlyHighlightedView] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeViewCrop, setActiveViewCrop] = useState<Crop | null>(null);
  const [zoomLevel, setZoomLevel] = useState('Fit to Screen');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);
  const [notations, setNotations] = useState<Notation[]>([]);
  const [crop, setCrop] = useState<Crop>();
  const [focusImage, setFocusImage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('Spanish');
  const [explanationTerm, setExplanationTerm] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('gemini_api_key') || '');

  return {
    uploadMode,
    setUploadMode,
    file,
    setFile,
    preview,
    setPreview,
    originalFileData,
    setOriginalFileData,
    isAnalyzing,
    setIsAnalyzing,
    isProcessingFile,
    setIsProcessingFile,
    analyzingProgress,
    setAnalyzingProgress,
    isAnalyzingRef,
    isCancelledRef,
    data,
    setData,
    addedItems,
    setAddedItems,
    error,
    setError,
    copied,
    setCopied,
    numPages,
    setNumPages,
    currentPage,
    setCurrentPage,
    analyzeStartPage,
    setAnalyzeStartPage,
    analyzeEndPage,
    setAnalyzeEndPage,
    pdfDoc,
    setPdfDoc,
    customPrompt,
    setCustomPrompt,
    searchQuery,
    setSearchQuery,
    showSearchResults,
    setShowSearchResults,
    selectedItemId,
    setSelectedItemId,
    isFocusMode,
    setIsFocusMode,
    isNotationMode,
    setIsNotationMode,
    notationStart,
    setNotationStart,
    notationEnd,
    setNotationEnd,
    isMeasurementMode,
    setIsMeasurementMode,
    measurementStart,
    setMeasurementStart,
    measurementEnd,
    setMeasurementEnd,
    measurementType,
    setMeasurementType,
    measurementPoints,
    setMeasurementPoints,
    showMeasurementPopup,
    setShowMeasurementPopup,
    measurementLength,
    setMeasurementLength,
    measurementInches,
    setMeasurementInches,
    calibrationUnit,
    setCalibrationUnit,
    calibrationScale,
    setCalibrationScale,
    currentMeasurement,
    setCurrentMeasurement,
    fileHandle,
    setFileHandle,
    lastSavedHash,
    setLastSavedHash,
    lastSavedTime,
    setLastSavedTime,
    isAutoSaving,
    setIsAutoSaving,
    windowSize,
    setWindowSize,
    soundEnabled,
    setSoundEnabled,
    calibrationPixelDist,
    setCalibrationPixelDist,
    guides,
    setGuides,
    mousePos,
    setMousePos,
    isManualZoomMode,
    setIsManualZoomMode,
    isPanMode,
    setIsPanMode,
    isFullscreen,
    setIsFullscreen,
    isOnlyHighlightedView,
    setIsOnlyHighlightedView,
    isDarkMode,
    setIsDarkMode,
    activeViewCrop,
    setActiveViewCrop,
    zoomLevel,
    setZoomLevel,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    notations,
    setNotations,
    crop,
    setCrop,
    focusImage,
    setFocusImage,
    isTranslating,
    setIsTranslating,
    targetLanguage,
    setTargetLanguage,
    explanationTerm,
    setExplanationTerm,
    explanationText,
    setExplanationText,
    isExplaining,
    setIsExplaining,
    showSettings,
    setShowSettings,
    apiKeyInput,
    setApiKeyInput
  };
};

export type BlueprintContextType = ReturnType<typeof useBlueprintState>;

export const BlueprintContext = createContext<BlueprintContextType | null>(null);

export const BlueprintProvider = ({ children }: { children: React.ReactNode }) => {
  const state = useBlueprintState();
  return <BlueprintContext.Provider value={state}>{children}</BlueprintContext.Provider>;
};

export const useBlueprint = () => {
  const context = useContext(BlueprintContext);
  if (!context) throw new Error('useBlueprint must be used within BlueprintProvider');
  return context;
};
