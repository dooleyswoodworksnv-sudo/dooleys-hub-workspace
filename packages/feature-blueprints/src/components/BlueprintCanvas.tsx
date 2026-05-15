import React from 'react';
import { Upload, FileText, Download, Play, CheckCircle2, AlertCircle, Loader2, Copy, FileCode, ChevronLeft, ChevronRight, RefreshCcw, Target, MessageSquare, X, Camera, Pencil, Trash2, ZoomIn, Maximize, Ruler, ChevronDown, Hand, Search, Volume2, VolumeX, Languages, Eye, EyeOff, Moon, Sun, Undo2, Redo2, Key, RotateCw } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import { useBlueprint } from '../context/BlueprintContext';
import { Button, cn } from '@dooleys/ui';
import {
  type BlueprintType,
  BLUEPRINT_TYPE_LABELS,
  BLUEPRINT_TYPE_DESCRIPTIONS,
  setSelectedBlueprintType,
} from '../services/prompts';



interface BlueprintCanvasProps {
  saveHistory: any;
  handleUndo: any;
  handleRedo: any;
  handleKeyDown: any;
  handleSaveProject: any;
  handleOpenProject: any;
  handleFileChange: any;
  handleRotateImage: any;
  handlePageChange: any;
  toggleItemAdded: any;
  togglePageAdded: any;
  handleExplainTerm: any;
  handleTranslate: any;
  handleAnalyze: any;
  handleCaptureFocus: any;
  handleNotationMouseDown: any;
  handleBlueprintClick: any;
  handleNotationDrag: any;
  updateNotationText: any;
  updateNotationDimensions: any;
  removeNotation: any;
  calculateRealDistance: any;
  calculateRealArea: any;
  calculateAngle: any;
  handleMeasurementMouseDown: any;
  handleSaveCalibration: any;
  handlePanStart: any;
  handleBlueprintMouseDown: any;
  handleManualZoomComplete: any;
  handleZoomChange: any;
  fileInputRef: any;
  imgRef: any;
}


export function BlueprintCanvas(props: BlueprintCanvasProps) {
  const {
    uploadMode, setUploadMode, file, setFile, preview, setPreview, originalFileData, setOriginalFileData,
    isAnalyzing, setIsAnalyzing, isProcessingFile, setIsProcessingFile, analyzingProgress, setAnalyzingProgress,
    isAnalyzingRef, isCancelledRef, data, setData, addedItems, setAddedItems, error, setError, copied, setCopied,
    numPages, setNumPages, currentPage, setCurrentPage, analyzeStartPage, setAnalyzeStartPage, analyzeEndPage, setAnalyzeEndPage,
    pdfDoc, setPdfDoc, customPrompt, setCustomPrompt, blueprintType, setBlueprintType, searchQuery, setSearchQuery, showSearchResults, setShowSearchResults,
    selectedItemId, setSelectedItemId, isFocusMode, setIsFocusMode, isNotationMode, setIsNotationMode, notationStart, setNotationStart,
    notationEnd, setNotationEnd, isMeasurementMode, setIsMeasurementMode, measurementStart, setMeasurementStart, measurementEnd, setMeasurementEnd,
    measurementType, setMeasurementType, measurementPoints, setMeasurementPoints, showMeasurementPopup, setShowMeasurementPopup,
    measurementLength, setMeasurementLength, measurementInches, setMeasurementInches, calibrationUnit, setCalibrationUnit,
    calibrationScale, setCalibrationScale, currentMeasurement, setCurrentMeasurement, fileHandle, setFileHandle, lastSavedHash, setLastSavedHash,
    lastSavedTime, setLastSavedTime, isAutoSaving, setIsAutoSaving, windowSize, setWindowSize, soundEnabled, setSoundEnabled,
    calibrationPixelDist, setCalibrationPixelDist, guides, setGuides, mousePos, setMousePos, isManualZoomMode, setIsManualZoomMode,
    isPanMode, setIsPanMode, isFullscreen, setIsFullscreen, isOnlyHighlightedView, setIsOnlyHighlightedView, showBoundingBoxes, setShowBoundingBoxes, isDarkMode, setIsDarkMode,
    activeViewCrop, setActiveViewCrop, zoomLevel, setZoomLevel, isPanning, setIsPanning, panStart, setPanStart, notations, setNotations,
    crop, setCrop, focusImage, setFocusImage, isTranslating, setIsTranslating, targetLanguage, setTargetLanguage, explanationTerm, setExplanationTerm,
    explanationText, setExplanationText, isExplaining, setIsExplaining, showSettings, setShowSettings, apiKeyInput, setApiKeyInput
  } = useBlueprint();

  const {
    saveHistory,
    handleUndo,
    handleRedo,
    handleKeyDown,
    handleSaveProject,
    handleOpenProject,
    handleFileChange,
    handleRotateImage,
    handlePageChange,
    toggleItemAdded,
    togglePageAdded,
    handleExplainTerm,
    handleTranslate,
    handleAnalyze,
    handleCaptureFocus,
    handleNotationMouseDown,
    handleBlueprintClick,
    handleNotationDrag,
    updateNotationText,
    updateNotationDimensions,
    removeNotation,
    calculateRealDistance,
    calculateRealArea,
    calculateAngle,
    handleMeasurementMouseDown,
    handleSaveCalibration,
    handlePanStart,
    handleBlueprintMouseDown,
    handleManualZoomComplete,
    handleZoomChange,
    fileInputRef,
    imgRef
  } = props;

  return (
    <>
        {/* Top: Upload Section */}
        <section className="bg-surface/50 border border-ink/10 rounded-3xl p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-serif italic text-4xl">1. Upload Blueprint</h2>
            <div className="flex bg-ink/5 p-1 rounded-lg border border-ink/10 gap-1">
              <button 
                onClick={() => {
                  setUploadMode('image');
                  setFile(null);
                  setPreview(null);
                  setData(null);
                  // Set accept directly on DOM before click to avoid setTimeout breaking user gesture
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
                className={cn(
                  "px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all",
                  uploadMode === 'image' ? "bg-ink text-paper" : "opacity-40 hover:opacity-100"
                )}
                title="Upload from image file"
              >
                Image
              </button>
              <button 
                onClick={() => {
                  setUploadMode('pdf');
                  setFile(null);
                  setPreview(null);
                  setData(null);
                  // Set accept directly on DOM before click to avoid setTimeout breaking user gesture
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf';
                    fileInputRef.current.click();
                  }
                }}
                className={cn(
                  "px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all",
                  uploadMode === 'pdf' ? "bg-ink text-paper" : "opacity-40 hover:opacity-100"
                )}
                title="Upload from PDF file"
              >
                PDF
              </button>
              <button 
                onClick={handleOpenProject}
                className={cn(
                  "px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all",
                  uploadMode === 'project' ? "bg-ink text-paper" : "opacity-40 hover:opacity-100"
                )}
                title="Open saved .json project"
              >
                Project
              </button>
              {data && (
                <>
                  <button 
                    onClick={() => handleSaveProject()}
                    className={cn(
                      "px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-2",
                      "opacity-40 hover:opacity-100"
                    )}
                    title="Save current project to device"
                  >
                    <Download size={12} />
                    Save to Device
                  </button>
                  {lastSavedTime && (
                    <div className="flex flex-col items-end px-2">
                      <span className="text-[8px] uppercase font-bold opacity-30 tracking-widest">Last Saved</span>
                      <span className="text-[10px] font-mono opacity-50">{lastSavedTime.toLocaleTimeString()}</span>
                    </div>
                  )}
                  {isAutoSaving && (
                    <div className="flex items-center gap-2 px-2 text-emerald-500">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="text-[8px] uppercase font-bold tracking-widest">Auto-saving</span>
                    </div>
                  )}
                  <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className={cn(
                      "px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-2",
                      "opacity-40 hover:opacity-100 disabled:opacity-20"
                    )}
                    title="Rerun AI analysis"
                  >
                    <RefreshCcw size={12} className={cn(isAnalyzing && "animate-spin")} />
                    Rerun
                  </button>
                </>
              )}
            </div>
          </div>

          {preview && (
            <div className={cn(
              "flex flex-wrap items-center justify-start gap-4 pt-4 border-t border-ink/10",
              isFullscreen && "fixed top-4 left-4 right-4 z-[110] border-none pt-0 pointer-events-none"
            )}>
              {/* Search Bar */}
              {data?.items ? (
                <div className="relative w-full max-w-xs z-50 pointer-events-auto">
                  <div className="relative bg-surface/90 backdrop-blur shadow-xl border border-ink/10 rounded-2xl overflow-hidden">
                    <input
                      type="text"
                      placeholder="Search blueprint items..."
                      value={searchQuery}
                      onFocus={() => setShowSearchResults(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchResults(true);
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-transparent text-sm focus:outline-none focus:bg-surface transition-colors"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
                    {searchQuery && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setShowSearchResults(false);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                        title="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {searchQuery && showSearchResults && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur shadow-xl border border-ink/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      {data.items.filter(item => 
                        item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.type.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setShowSearchResults(false);
                          }}
                          className={cn(
                            "px-4 py-3 hover:bg-ink/5 cursor-pointer border-b border-ink/5 last:border-0",
                            selectedItemId === item.id ? "bg-emerald-50" : "",
                            addedItems.includes(item.id) ? "opacity-50" : ""
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "font-bold text-sm flex items-center gap-2",
                              addedItems.includes(item.id) && "line-through"
                            )}>
                              {item.label}
                              {addedItems.includes(item.id) && <CheckCircle2 size={12} className="text-emerald-500" />}
                            </span>
                            <span className="text-[10px] uppercase opacity-50 font-mono">{item.type}</span>
                          </div>
                          {item.value && <div className="text-xs font-mono mt-1 opacity-70">{item.value}</div>}
                        </div>
                      ))}
                      {data.items.filter(item => 
                        item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.type.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-sm opacity-50">No items found</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full max-w-xs"></div>
              )}

              {/* Controls Overlay */}
              <div className="flex flex-wrap items-center gap-2 z-30 pointer-events-auto">
                {(isFocusMode || isManualZoomMode) ? (
                  <>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (isFocusMode) handleCaptureFocus();
                        else handleManualZoomComplete();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="bg-emerald-500 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} /> {isFocusMode ? 'Confirm Selection' : 'Apply Zoom'}
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setIsFocusMode(false); 
                        setIsManualZoomMode(false);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="bg-surface text-ink px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg hover:bg-ink/5 transition-colors flex items-center gap-2 border border-ink/10"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeViewCrop && (
                      <Button 
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setActiveViewCrop(null); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                        title="Reset View"
                      >
                        <Maximize size={14} /> Reset View
                      </Button>
                    )}
                    <Button 
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleRotateImage(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={isProcessingFile}
                      className="text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 h-auto py-2"
                      title="Rotate Image 90°"
                    >
                      <RotateCw size={14} className={isProcessingFile ? "animate-spin" : ""} /> Rotate
                    </Button>
                    <Button 
                      variant={isFullscreen ? "primary" : "secondary"}
                      onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                      title="Toggle Fullscreen (F)"
                    >
                      <Maximize size={14} /> {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </Button>

                    <Button 
                      variant={isPanMode ? "primary" : "secondary"}
                      onClick={(e) => { e.stopPropagation(); setIsPanMode(!isPanMode); setIsManualZoomMode(false); setIsNotationMode(false); setIsMeasurementMode(false); setIsFocusMode(false); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                      title="Pan Tool (H)"
                    >
                      <Hand size={14} /> Pan
                    </Button>

                    <Button 
                      variant={isManualZoomMode ? "primary" : "secondary"}
                      onClick={(e) => { e.stopPropagation(); setIsManualZoomMode(!isManualZoomMode); setIsPanMode(false); setIsNotationMode(false); setIsMeasurementMode(false); setIsFocusMode(false); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                      title="Manual Zoom Tool"
                    >
                      <ZoomIn size={14} /> Manual Zoom
                    </Button>

                    <Button 
                      variant={isNotationMode ? "primary" : "secondary"}
                      onClick={(e) => { e.stopPropagation(); setIsNotationMode(!isNotationMode); setIsMeasurementMode(false); setIsManualZoomMode(false); setIsPanMode(false); setIsFocusMode(false); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                      title="Add Notation Tool"
                    >
                      <Pencil size={14} /> {isNotationMode ? 'Exit Notation' : 'Add Notation'}
                    </Button>
                    <Button 
                      variant={isMeasurementMode ? "primary" : "secondary"}
                      onClick={(e) => { e.stopPropagation(); setIsMeasurementMode(!isMeasurementMode); setIsNotationMode(false); setIsManualZoomMode(false); setIsPanMode(false); setIsFocusMode(false); if (isMeasurementMode) { setMeasurementStart(null); setMeasurementEnd(null); setCurrentMeasurement(null); setMeasurementPoints([]); } }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                      title="Measurement Tool"
                    >
                      <Ruler size={14} /> {isMeasurementMode ? 'Exit Measurement' : 'Measurement'}
                    </Button>
                    {isMeasurementMode && (
                      <div className="flex bg-surface/80 backdrop-blur rounded-lg shadow-lg overflow-hidden border border-ink/10">
                        <Button
                          variant={measurementType === 'length' ? "primary" : "secondary"}
                          onClick={(e) => { e.stopPropagation(); setMeasurementType('length'); setMeasurementPoints([]); setMeasurementStart(null); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold uppercase tracking-wider rounded-none border-none h-auto py-2"
                          title="Length Measurement Tool"
                        >
                          Length
                        </Button>
                        <Button
                          variant={measurementType === 'area' ? "primary" : "secondary"}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!calibrationScale) {
                              alert('Please calibrate the blueprint using the Length tool first.');
                              return;
                            }
                            setMeasurementType('area'); 
                            setMeasurementPoints([]); 
                            setMeasurementStart(null); 
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider rounded-none border-none border-l border-ink/10 h-auto py-2",
                            !calibrationScale && "opacity-50 cursor-not-allowed"
                          )}
                          title={!calibrationScale ? "Calibrate using Length tool first" : "Area Measurement Tool"}
                        >
                          Area
                        </Button>
                        <Button
                          variant={measurementType === 'angle' ? "primary" : "secondary"}
                          onClick={(e) => { e.stopPropagation(); setMeasurementType('angle'); setMeasurementPoints([]); setMeasurementStart(null); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold uppercase tracking-wider rounded-none border-none border-l border-ink/10 h-auto py-2"
                          title="Angle Measurement Tool"
                        >
                          Angle
                        </Button>
                      </div>
                    )}
                    {guides.filter(g => g.page === currentPage || (!g.page && currentPage === 1)).length > 0 && (
                      <Button 
                        variant="danger"
                        onClick={(e) => { e.stopPropagation(); saveHistory(); setGuides(prev => prev.filter(g => g.page !== currentPage && !(!g.page && currentPage === 1))); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                        title="Clear all measurement guides on this page"
                      >
                        <Trash2 size={14} /> Clear Page Guides
                      </Button>
                    )}
                    {calibrationScale && (
                      <Button 
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setShowMeasurementPopup(true); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                        title="Recalibrate Scale"
                      >
                        <RefreshCcw size={14} /> Calibrate
                      </Button>
                    )}
                    {data && (
                      <Button 
                        variant={showBoundingBoxes ? "primary" : "secondary"}
                        onClick={(e) => { e.stopPropagation(); setShowBoundingBoxes(!showBoundingBoxes); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold uppercase tracking-wider h-auto py-2"
                        title={showBoundingBoxes ? "Hide Bounding Boxes" : "Show Bounding Boxes"}
                      >
                        {showBoundingBoxes ? <Eye size={14} /> : <EyeOff size={14} />} Boxes
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Top Pagination Controls */}
              {numPages > 1 && (
                <div className="flex items-center gap-4 p-2 bg-surface/50 border border-ink/10 rounded-xl pointer-events-auto z-30">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="opacity-50" />
                    <span className="text-[11px] uppercase font-bold tracking-wider opacity-70">
                      Page {currentPage} of {numPages}
                    </span>
                  </div>
                  {data?.items && data.items.some(item => item.page === currentPage || (!item.page && currentPage === 1)) && (
                    <label className="flex items-center gap-2 cursor-pointer group mr-2">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-ink/20 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        checked={data.items.filter(item => item.page === currentPage || (!item.page && currentPage === 1)).every(item => addedItems.includes(item.id))}
                        onChange={() => togglePageAdded(currentPage)}
                      />
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">
                        Mark Complete
                      </span>
                    </label>
                  )}
                  <div className="flex gap-1 border-l border-ink/10 pl-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePageChange(currentPage - 1); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg hover:bg-ink/5 disabled:opacity-30 transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePageChange(currentPage + 1); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      disabled={currentPage === numPages}
                      className="p-1.5 rounded-lg hover:bg-ink/5 disabled:opacity-30 transition-colors"
                      title="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          <div className="space-y-8">
            <div 
              className={cn(
                "w-full border-2 border-dashed border-ink/20 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-ink/50 transition-all bg-surface/30 relative",
                file ? "border-solid border-ink/10 p-2 min-h-[600px]" : "min-h-[850px]",
                isFullscreen && "fixed inset-0 z-[100] bg-paper p-4 rounded-none border-none"
              )}
              onClick={() => !preview && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept={uploadMode === 'image' ? "image/*" : uploadMode === 'pdf' ? "application/pdf" : "application/json,.json,image/*,application/pdf"}
              />
              {isProcessingFile ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 size={48} className="animate-spin text-emerald-500" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-50">Processing File...</p>
                </div>
              ) : preview ? (
                <div className="w-full space-y-4 h-full flex flex-col">
                    <div 
                      className={cn(
                        "relative flex-1 w-full rounded-lg overflow-hidden border border-ink/10 bg-surface shadow-inner flex items-center justify-center blueprint-viewer-container",
                        isPanMode ? (isPanning ? "cursor-grabbing" : "cursor-grab") :
                        (activeViewCrop && !isNotationMode && !isMeasurementMode && !isFocusMode && !isManualZoomMode) ? (isPanning ? "cursor-grabbing" : "cursor-grab") : 
                        "cursor-crosshair"
                      )}
                      onClick={handleBlueprintClick}
                      onMouseDown={handleBlueprintMouseDown}
                      onTouchStart={handleBlueprintMouseDown}
                    >
                      {/* Persistent Search Bar Overlay removed from here */}
                      

                      {(isFocusMode || isManualZoomMode) ? (
                        <ReactCrop 
                          crop={crop} 
                          onChange={c => setCrop(c)}
                          className="max-h-full"
                        >
                          <img 
                            ref={imgRef}
                            src={preview} 
                            alt="Preview" 
                            className={cn(
                              "object-contain",
                              isFullscreen ? "max-h-screen" : "max-h-none"
                            )} 
                          />
                        </ReactCrop>
                      ) : (
                        <div 
                          className={cn(
                            "relative w-full h-full flex items-center justify-center bg-surface/50",
                            activeViewCrop ? "overflow-hidden" : "overflow-auto"
                          )}
                        >
                          <div 
                            className={cn(
                              "relative flex items-center justify-center",
                              activeViewCrop && "max-w-full max-h-full",
                              !isPanning && "transition-all duration-500 ease-in-out"
                            )}
                            style={activeViewCrop ? {
                              transformOrigin: `${activeViewCrop.x + activeViewCrop.width / 2}% ${activeViewCrop.y + activeViewCrop.height / 2}%`,
                              transform: `translate(${50 - (activeViewCrop.x + activeViewCrop.width / 2)}%, ${50 - (activeViewCrop.y + activeViewCrop.height / 2)}%) scale(${Math.min(100 / Math.max(activeViewCrop.width, 1), 100 / Math.max(activeViewCrop.height, 1))})`,
                            } : {}}
                          >
                            <img 
                              ref={imgRef}
                              src={preview} 
                              alt="Preview" 
                              className={cn(
                                "object-contain transition-opacity duration-300",
                                activeViewCrop ? "max-w-full max-h-full" : "w-full h-full",
                                !activeViewCrop && (isFullscreen ? "max-h-screen" : "max-h-none"),
                                isOnlyHighlightedView ? "opacity-5" : "opacity-100"
                              )}
                            />

                            {/* Blueprint Items Overlay */}
                            {showBoundingBoxes && data?.items?.map((item) => {
                              if (item.page && item.page !== currentPage) return null;

                              const isSelected = selectedItemId === item.id;
                              const isMatched = searchQuery && (
                                item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.type.toLowerCase().includes(searchQuery.toLowerCase())
                              );
                              
                              if (!isSelected && !isMatched && searchQuery) return null;

                              const isAdded = addedItems.includes(item.id);

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "absolute border-2 cursor-pointer transition-all duration-200",
                                    isSelected ? "border-emerald-500 bg-emerald-500/20 z-30" : 
                                    isMatched ? "border-amber-500 bg-amber-500/20 z-20" : 
                                    isAdded ? "border-ink/30 bg-ink/10 z-10" :
                                    "border-transparent hover:border-blue-500 hover:bg-blue-500/10 z-10"
                                  )}
                                  style={{
                                    left: `${item.boundingBox.xMin}%`,
                                    top: `${item.boundingBox.yMin}%`,
                                    width: `${item.boundingBox.xMax - item.boundingBox.xMin}%`,
                                    height: `${item.boundingBox.yMax - item.boundingBox.yMin}%`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemId(isSelected ? null : item.id);
                                  }}
                                >
                                  {(isSelected || isMatched) && (
                                    <div className={cn(
                                      "absolute -top-6 left-0 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap font-mono shadow-lg flex items-center gap-1",
                                      isAdded ? "bg-ink/60" : "bg-ink"
                                    )}>
                                      {isAdded && <CheckCircle2 size={10} />}
                                      {item.label}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Notations Overlay */}
                            {notations.filter(n => n.page === currentPage || (!n.page && currentPage === 1)).map((notation, index) => (
                              <React.Fragment key={notation.id}>
                                {notation.width && notation.height && (
                                  <div
                                    className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none z-10"
                                    style={{
                                      left: `${notation.x}%`,
                                      top: `${notation.y}%`,
                                      width: `${notation.width}%`,
                                      height: `${notation.height}%`
                                    }}
                                  />
                                )}
                                <div
                                  style={{ left: `${notation.x}%`, top: `${notation.y}%` }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
                                  onMouseDown={(e) => handleNotationDrag(notation.id, e)}
                                  onTouchStart={(e) => handleNotationDrag(notation.id, e)}
                                >
                                  <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg cursor-move border-2 border-surface">
                                    {index + 1}
                                  </div>
                                  {notation.text && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface/90 backdrop-blur text-ink text-[10px] px-2 py-1 rounded shadow-sm border border-ink/10 whitespace-pre-wrap max-w-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                      {notation.text}
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeNotation(notation.id); }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                    title="Remove notation"
                                  >
                                    <X size={8} />
                                  </button>
                                </div>
                              </React.Fragment>
                            ))}

                            {/* Active Notation Drawing */}
                            {isNotationMode && notationStart && notationEnd && (
                              <div
                                className="absolute border-2 border-emerald-500 border-dashed bg-emerald-500/20 pointer-events-none z-20"
                                style={{
                                  left: `${Math.min(notationStart.x, notationEnd.x)}%`,
                                  top: `${Math.min(notationStart.y, notationEnd.y)}%`,
                                  width: `${Math.abs(notationEnd.x - notationStart.x)}%`,
                                  height: `${Math.abs(notationEnd.y - notationStart.y)}%`
                                }}
                              />
                            )}

                             {/* Measurement Line Overlay */}
                            {(measurementStart || measurementPoints.length > 0 || guides.length > 0) && (
                              <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                                {/* Persistent Guides */}
                                {guides.filter(g => g.page === currentPage || (!g.page && currentPage === 1)).map(guide => {
                                  if (guide.type === 'area' && guide.points) {
                                    const pointsStr = guide.points.map(p => `${(p.x / 100) * (imgRef.current?.width || 0)},${(p.y / 100) * (imgRef.current?.height || 0)}`).join(' ');
                                    const centerX = guide.points.reduce((sum, p) => sum + p.x, 0) / guide.points.length;
                                    const centerY = guide.points.reduce((sum, p) => sum + p.y, 0) / guide.points.length;
                                    return (
                                      <g key={guide.id}>
                                        <polygon points={pointsStr} fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
                                        <g transform={`translate(${(centerX / 100) * (imgRef.current?.width || 0)}, ${(centerY / 100) * (imgRef.current?.height || 0)})`}>
                                          <rect x="-35" y="-10" width="70" height="20" rx="10" fill="#10b981" opacity="0.8" />
                                          <text textAnchor="middle" dominantBaseline="middle" fill="white" className="text-[8px] font-bold font-mono">{guide.label}</text>
                                        </g>
                                      </g>
                                    );
                                  } else if (guide.type === 'angle' && guide.points) {
                                    const p1 = guide.points[0];
                                    const p2 = guide.points[1];
                                    const p3 = guide.points[2];
                                    const w = imgRef.current?.width || 0;
                                    const h = imgRef.current?.height || 0;
                                    return (
                                      <g key={guide.id}>
                                        <polyline points={`${(p1.x/100)*w},${(p1.y/100)*h} ${(p2.x/100)*w},${(p2.y/100)*h} ${(p3.x/100)*w},${(p3.y/100)*h}`} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
                                        <g transform={`translate(${(p2.x / 100) * w}, ${(p2.y / 100) * h})`}>
                                          <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#10b981" opacity="0.8" />
                                          <text textAnchor="middle" dominantBaseline="middle" fill="white" className="text-[8px] font-bold font-mono">{guide.label}</text>
                                        </g>
                                      </g>
                                    );
                                  } else if (guide.start && guide.end) {
                                    return (
                                      <g key={guide.id}>
                                        <line 
                                          x1={`${guide.start.x}%`} 
                                          y1={`${guide.start.y}%`} 
                                          x2={`${guide.end.x}%`} 
                                          y2={`${guide.end.y}%`} 
                                          stroke="#10b981" 
                                          strokeWidth="1.5"
                                          strokeDasharray="4 4"
                                          opacity="0.6"
                                        />
                                        <g transform={`translate(${((guide.start.x + guide.end.x) / 2 / 100) * (imgRef.current?.width || 0)}, ${((guide.start.y + guide.end.y) / 2 / 100) * (imgRef.current?.height || 0)})`}>
                                          <rect 
                                            x="-25" 
                                            y="-10" 
                                            width="50" 
                                            height="20" 
                                            rx="10" 
                                            fill="#10b981" 
                                            opacity="0.6"
                                          />
                                          <text 
                                            textAnchor="middle" 
                                            dominantBaseline="middle" 
                                            fill="white" 
                                            className="text-[8px] font-bold font-mono"
                                          >
                                            {guide.label}
                                          </text>
                                        </g>
                                      </g>
                                    );
                                  }
                                  return null;
                                })}

                                {/* Active Area/Angle Measurement */}
                                {measurementPoints.length > 0 && (
                                  <g>
                                    {measurementType === 'area' && (
                                      <polygon 
                                        points={`${measurementPoints.map(p => `${(p.x/100)*(imgRef.current?.width||0)},${(p.y/100)*(imgRef.current?.height||0)}`).join(' ')} ${mousePos ? `${(mousePos.x/100)*(imgRef.current?.width||0)},${(mousePos.y/100)*(imgRef.current?.height||0)}` : ''}`} 
                                        fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" 
                                      />
                                    )}
                                    {measurementType === 'angle' && (
                                      <polyline 
                                        points={`${measurementPoints.map(p => `${(p.x/100)*(imgRef.current?.width||0)},${(p.y/100)*(imgRef.current?.height||0)}`).join(' ')} ${mousePos ? `${(mousePos.x/100)*(imgRef.current?.width||0)},${(mousePos.y/100)*(imgRef.current?.height||0)}` : ''}`} 
                                        fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" 
                                      />
                                    )}
                                    {measurementPoints.map((p, i) => (
                                      <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="3" fill="#10b981" />
                                    ))}
                                  </g>
                                )}

                                {/* Active Measurement */}
                                {measurementStart && measurementEnd && (
                                  <>
                                    <line 
                                      x1={`${measurementStart.x}%`} 
                                      y1={`${measurementStart.y}%`} 
                                      x2={`${measurementEnd.x}%`} 
                                      y2={`${measurementEnd.y}%`} 
                                      stroke="#10b981" 
                                      strokeWidth="2"
                                      strokeDasharray="5 5"
                                    />
                                    {/* Ticks */}
                                    <g transform={`translate(${(measurementStart.x / 100) * (imgRef.current?.width || 0)}, ${(measurementStart.y / 100) * (imgRef.current?.height || 0)}) rotate(${Math.atan2(measurementEnd.y - measurementStart.y, measurementEnd.x - measurementStart.x) * 180 / Math.PI})`}>
                                      <line x1="0" y1="-10" x2="0" y2="10" stroke="#10b981" strokeWidth="2" />
                                    </g>
                                    <g transform={`translate(${(measurementEnd.x / 100) * (imgRef.current?.width || 0)}, ${(measurementEnd.y / 100) * (imgRef.current?.height || 0)}) rotate(${Math.atan2(measurementEnd.y - measurementStart.y, measurementEnd.x - measurementStart.x) * 180 / Math.PI})`}>
                                      <line x1="0" y1="-10" x2="0" y2="10" stroke="#10b981" strokeWidth="2" />
                                    </g>
                                    {/* Measurement Label */}
                                    {currentMeasurement && (
                                      <g transform={`translate(${((measurementStart.x + measurementEnd.x) / 2 / 100) * (imgRef.current?.width || 0)}, ${((measurementStart.y + measurementEnd.y) / 2 / 100) * (imgRef.current?.height || 0)})`}>
                                        <rect 
                                          x="-30" 
                                          y="-12" 
                                          width="60" 
                                          height="24" 
                                          rx="12" 
                                          fill="#10b981" 
                                          className="shadow-lg"
                                        />
                                        <text 
                                          textAnchor="middle" 
                                          dominantBaseline="middle" 
                                          fill="white" 
                                          className="text-[10px] font-bold font-mono"
                                        >
                                          {currentMeasurement}
                                        </text>
                                      </g>
                                    )}
                                  </>
                                )}
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Controls Overlay removed from here */}
                    </div>
                  
                  {numPages > 1 && (
                    <div className="flex items-center justify-between p-3 bg-surface/50 border border-ink/10 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="opacity-50" />
                          <span className="text-[11px] uppercase font-bold tracking-wider opacity-70">
                            Page {currentPage} of {numPages}
                          </span>
                        </div>
                        {data?.items && data.items.some(item => item.page === currentPage || (!item.page && currentPage === 1)) && (
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-ink/20 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              checked={data.items.filter(item => item.page === currentPage || (!item.page && currentPage === 1)).every(item => addedItems.includes(item.id))}
                              onChange={() => togglePageAdded(currentPage)}
                            />
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">
                              Mark Page Complete
                            </span>
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePageChange(currentPage - 1); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-ink/10 hover:bg-ink/5 disabled:opacity-30 transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePageChange(currentPage + 1); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          disabled={currentPage === numPages}
                          className="p-1.5 rounded-lg border border-ink/10 hover:bg-ink/5 disabled:opacity-30 transition-colors"
                          title="Next page"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center">
                    <Upload size={24} className="opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium italic font-serif text-lg">Drop your {uploadMode === 'image' ? 'blueprint image' : uploadMode === 'pdf' ? 'PDF document' : 'project file'} here</p>
                    <p className="text-[11px] opacity-50 uppercase mt-1 tracking-widest">
                      {uploadMode === 'image' ? 'PNG or JPG' : uploadMode === 'pdf' ? 'Multi-page PDF' : 'JSON Project File'} (Max 10MB)
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="w-full space-y-6">


              {/* Notation List */}
              {preview && notations.filter(n => n.page === currentPage || (!n.page && currentPage === 1)).length > 0 && (
                <div className="bg-surface border border-ink/10 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-ink/50">
                      <Pencil size={16} />
                      <span className="text-[10px] uppercase font-bold tracking-widest">Notation List</span>
                    </div>
                    <button 
                      onClick={() => { saveHistory(); setNotations(prev => prev.filter(n => n.page !== currentPage && !(!n.page && currentPage === 1))); }}
                      className="text-[9px] uppercase font-bold text-red-500 hover:text-red-600 transition-colors"
                      title="Clear all notations on this page"
                    >
                      Clear Page
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {notations.filter(n => n.page === currentPage || (!n.page && currentPage === 1)).map((notation, index) => (
                      <div key={notation.id} className="flex gap-4 items-start bg-ink/5 p-3 rounded-xl group">
                        <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <textarea 
                            value={notation.text}
                            onFocus={() => saveHistory()}
                            onChange={(e) => updateNotationText(notation.id, e.target.value)}
                            placeholder={`Description for marker #${index + 1}...`}
                            className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 font-medium placeholder:text-ink/30 resize-none min-h-[40px]"
                            rows={2}
                          />
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase font-bold opacity-30 block">Length</label>
                              <input 
                                type="text"
                                value={notation.manualDimensions?.length || ''}
                                onFocus={() => saveHistory()}
                                onChange={(e) => updateNotationDimensions(notation.id, 'length', e.target.value)}
                                placeholder="e.g. 12ft"
                                className="w-full bg-surface/50 border border-ink/10 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-ink/20"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase font-bold opacity-30 block">Width</label>
                              <input 
                                type="text"
                                value={notation.manualDimensions?.width || ''}
                                onFocus={() => saveHistory()}
                                onChange={(e) => updateNotationDimensions(notation.id, 'width', e.target.value)}
                                placeholder="e.g. 6in"
                                className="w-full bg-surface/50 border border-ink/10 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-ink/20"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase font-bold opacity-30 block">Height</label>
                              <input 
                                type="text"
                                value={notation.manualDimensions?.height || ''}
                                onFocus={() => saveHistory()}
                                onChange={(e) => updateNotationDimensions(notation.id, 'height', e.target.value)}
                                placeholder="e.g. 8ft"
                                className="w-full bg-surface/50 border border-ink/10 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-ink/20"
                              />
                            </div>
                          </div>

                          <p className="text-[9px] text-ink/40 uppercase font-mono">
                            Pos: {notation.x.toFixed(1)}%, {notation.y.toFixed(1)}%
                          </p>
                        </div>
                        <button 
                          onClick={() => removeNotation(notation.id)}
                          className="text-ink/20 hover:text-red-500 transition-colors p-1"
                          title="Remove notation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row items-stretch justify-end gap-6 p-8 bg-surface border border-ink/10 rounded-3xl shadow-sm">
                {file && (
                  <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                    {uploadMode === 'pdf' && pdfDoc && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3 text-sm font-bold bg-ink/5 px-4 py-3 rounded-xl border border-ink/10">
                          <span className="uppercase tracking-widest opacity-50 text-[10px]">Extract Pages:</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              min={1} 
                              max={pdfDoc.numPages} 
                              value={analyzeStartPage}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(pdfDoc.numPages, parseInt(e.target.value) || 1));
                                setAnalyzeStartPage(val);
                                if (analyzeEndPage < val) setAnalyzeEndPage(val);
                                if (analyzeEndPage > val + 4) setAnalyzeEndPage(Math.min(pdfDoc.numPages, val + 4));
                              }}
                              className="w-16 px-2 py-1 rounded-lg border border-ink/20 bg-surface text-center font-mono focus:border-emerald-500 outline-none transition-colors"
                            />
                            <span className="opacity-30">to</span>
                            <input 
                              type="number" 
                              min={analyzeStartPage} 
                              max={Math.min(pdfDoc.numPages, analyzeStartPage + 4)} 
                              value={analyzeEndPage}
                              onChange={(e) => setAnalyzeEndPage(Math.max(analyzeStartPage, Math.min(Math.min(pdfDoc.numPages, analyzeStartPage + 4), parseInt(e.target.value) || analyzeStartPage)))}
                              className="w-16 px-2 py-1 rounded-lg border border-ink/20 bg-surface text-center font-mono focus:border-emerald-500 outline-none transition-colors"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-tighter">Max 5</span>
                          {pdfDoc.numPages <= 5 && (
                            <button 
                              onClick={() => {
                                setAnalyzeStartPage(1);
                                setAnalyzeEndPage(pdfDoc.numPages);
                              }}
                              className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 hover:underline ml-2"
                              title="Select all pages for analysis"
                            >
                              Select All
                            </button>
                          )}
                        </div>
                        <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold">Total PDF Pages: {pdfDoc.numPages}</p>
                      </div>
                    )}
                    {/* Blueprint Type Selector */}
                    <div className="w-full">
                      <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Blueprint Type</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(BLUEPRINT_TYPE_LABELS) as BlueprintType[]).map(type => (
                          <button
                            key={type}
                            onClick={() => {
                              setBlueprintType(type);
                              setSelectedBlueprintType(type);
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[9px] uppercase font-bold tracking-wider border transition-all",
                              blueprintType === type 
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" 
                                : "border-ink/10 opacity-40 hover:opacity-100"
                            )}
                            title={BLUEPRINT_TYPE_DESCRIPTIONS[type]}
                          >
                            {BLUEPRINT_TYPE_LABELS[type]}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] opacity-30 mt-1 italic">{BLUEPRINT_TYPE_DESCRIPTIONS[blueprintType]}</p>
                    </div>

                    {/* Custom Prompt Input */}
                    <div className="w-full">
                      <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Additional Instructions (optional)</label>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., Focus on framing callouts only, or: Ignore the title block..."
                        className="w-full bg-ink/5 border border-ink/10 rounded-lg p-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-y placeholder:text-ink/20"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !preview}
                        className="px-8 py-4 bg-ink text-paper rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 shadow-xl shadow-black/10 min-w-[240px]"
                        title="Run extraction on selected pages"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            {analyzingProgress || 'Analyzing...'}
                          </>
                        ) : !preview ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            Loading Preview...
                          </>
                        ) : (
                          <>
                            <Play size={20} />
                            {data ? 'Extract More Data' : 'Extract Data'}
                          </>
                        )}
                      </button>
                      {isAnalyzing && (
                        <button
                          onClick={() => {
                            isCancelledRef.current = true;
                            setIsAnalyzing(false);
                            setAnalyzingProgress(null);
                            isAnalyzingRef.current = false;
                          }}
                          className="px-6 py-4 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-xl flex items-center justify-center gap-2 transition-all font-bold"
                          title="Cancel extraction process"
                        >
                          <X size={20} />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
