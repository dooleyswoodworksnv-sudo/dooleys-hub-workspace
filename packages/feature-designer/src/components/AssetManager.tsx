import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FolderOpen, RefreshCw, Box, Layers, Image as ImageIcon, Camera, Folder, ChevronRight, ChevronDown, Check, X, Edit2, Trash2, EyeOff, FolderPlus } from 'lucide-react';

export function AssetManager() {
    const [localAssets, setLocalAssets] = useState<any[]>([]);
    const [serverOnline, setServerOnline] = useState<boolean | null>(null); // null = checking
    
    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadType, setUploadType] = useState('model');
    const [uploadFolder, setUploadFolder] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Accordion state
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // Folder Management State
    const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);
    const [isModelsExpanded, setIsModelsExpanded] = useState(false);
    const [creatingFolderIn, setCreatingFolderIn] = useState<'materials' | 'models' | null>(null);
    const [forceModelFolders, setForceModelFolders] = useState<string[]>([]);
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState<string>('');
    const [newFolderName, setNewFolderName] = useState('');
    const [draggedOverFolder, setDraggedOverFolder] = useState<string | null>(null);

    // ── Per-item hide system (localStorage-persisted) ──────────────────────
    const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('asset_lib_hidden');
            return new Set(saved ? JSON.parse(saved) : []);
        } catch { return new Set(); }
    });
    const [showHiddenInFolder, setShowHiddenInFolder] = useState<Set<string>>(new Set());

    const toggleItemHidden = (absolutePath: string) => {
        setHiddenItems(prev => {
            const next = new Set(prev);
            if (next.has(absolutePath)) next.delete(absolutePath); else next.add(absolutePath);
            localStorage.setItem('asset_lib_hidden', JSON.stringify([...next]));
            return next;
        });
    };

    const toggleShowHidden = (folderPath: string) => {
        setShowHiddenInFolder(prev => {
            const next = new Set(prev);
            if (next.has(folderPath)) next.delete(folderPath); else next.add(folderPath);
            return next;
        });
    };

    useEffect(() => {
        fetchLocalAssets();
    }, []);

    const fetchLocalAssets = async () => {
        try {
            // Bust cache just in case SketchUp's aggressive Chromium webview caches the GET request
            const res = await fetch(`/api/assets?t=${Date.now()}`);
            if (!res.ok) throw new Error("Network response was not ok");
            const data = await res.json();
            if (data.assets) {
                setLocalAssets(data.assets);
                setServerOnline(true);
            }
        } catch (e) {
            console.error('Failed to fetch local assets', e);
            setServerOnline(false);
        }
    };

    // Auto-retry every 5 seconds if the server is offline
    useEffect(() => {
        if (serverOnline === false) {
            const timer = setTimeout(() => fetchLocalAssets(), 5000);
            return () => clearTimeout(timer);
        }
    }, [serverOnline]);


    const handleUpload = async () => {
        if (!uploadFile) {
            alert('Please select a file to upload.');
            return;
        }
        
        const finalTitle = uploadTitle.trim() || uploadFile.name.split('.')[0];
        
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('title', finalTitle);
            formData.append('type', uploadType);
            if (uploadFolder) formData.append('targetFolder', uploadFolder);
            formData.append('assetFile', uploadFile);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                fetchLocalAssets();
                setUploadFile(null);
                setUploadTitle('');
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                alert(`Upload Error: ${data.error}`);
            }
        } catch (e) {
            console.error('Manual upload failed', e);
            alert(`Manual upload failed: ${e}`);
        }
        setUploading(false);
    };

    const handleGenerateEmblem = async (asset: any) => {
        try {
            const res = await fetch('/api/generate-emblem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetPath: asset.absolutePath, type: asset.absolutePath.includes('material') ? 'material' : 'model' })
            });
            const data = await res.json();
            if (data.success) {
                fetchLocalAssets();
            } else {
                alert(`Renderer Error: ${data.error}`);
            }
        } catch (e) {
            console.error('Emblem generation failed', e);
            alert(`Renderer crashed: ${e}`);
        }
    };

    // ----- FOLDER MANAGEMENT LOGIC -----

    const toggleFolder = (dir: string) => {
        if (editingFolder === dir) return;
        setExpandedFolders(prev => {
            const isClosing = prev[dir];
            const next: Record<string, boolean> = {};
            if (!isClosing) {
                Object.keys(prev).forEach(key => {
                    if (prev[key] && dir.startsWith(key + '/')) {
                        next[key] = true;
                    }
                });
                next[dir] = true;
            } else {
                Object.keys(prev).forEach(key => {
                    if (prev[key] && !key.startsWith(dir)) {
                        next[key] = true;
                    }
                });
            }
            return next;
        });
    };

    const handleCreateFolder = async (folderType: 'materials' | 'models') => {
        if (!newFolderName.trim()) return setCreatingFolderIn(null);
        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: newFolderName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                if (folderType === 'models') {
                    setForceModelFolders(prev => [...prev, newFolderName.trim()]);
                }
                setNewFolderName('');
                setCreatingFolderIn(null);
                fetchLocalAssets();
            } else {
                alert(data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create folder");
        }
    };

    const handleRenameFolder = async (oldName: string) => {
        if (!editFolderName.trim() || editFolderName === oldName) {
            setEditingFolder(null);
            return;
        }
        try {
            const res = await fetch('/api/folders/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldDirectoryName: oldName, newDirectoryName: editFolderName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                // Keep the newly renamed folder's open state consistent
                setExpandedFolders(prev => {
                    const next = { ...prev };
                    if (next[oldName]) {
                        next[editFolderName.trim()] = true;
                        delete next[oldName];
                    }
                    return next;
                });
                setEditingFolder(null);
                fetchLocalAssets();
            } else {
                alert(data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to rename folder");
        }
    };

    const handleDeleteFolder = async (dirName: string) => {
        if (!confirm(`Are you sure you want to hide "${dirName}" from your library? (The files will remain safe on your computer)`)) return;
        try {
            const res = await fetch('/api/folders', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directoryName: dirName })
            });
            const data = await res.json();
            if (data.success) {
                fetchLocalAssets();
            } else {
                alert(`Cannot Hide: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to hide folder");
        }
    };

    interface TreeNode {
        name: string;
        path: string;
        assets: any[];
        children: Record<string, TreeNode>;
    }

    const { materialsTree, modelsTree } = React.useMemo(() => {
        const root: TreeNode = { name: 'Root', path: '', assets: [], children: {} };
        const matRoot: TreeNode = { name: 'Root', path: '', assets: [], children: {} };
        const modRoot: TreeNode = { name: 'Root', path: '', assets: [], children: {} };

        localAssets.forEach(asset => {
            const dirPath = asset.directory || '';
            if (!dirPath) {
                if (!asset.isEmptyFolder) root.assets.push(asset);
                return;
            }

            const parts = dirPath.split('/').filter(Boolean);
            let currentStr = '';
            let currentObj = root;

            parts.forEach((part) => {
                currentStr = currentStr ? `${currentStr}/${part}` : part;
                if (!currentObj.children[part]) {
                    currentObj.children[part] = { name: part, path: currentStr, assets: [], children: {} };
                }
                currentObj = currentObj.children[part];
            });

            if (!asset.isEmptyFolder) {
                currentObj.assets.push(asset);
            }
        });

        const isModelFile = (name: string) => /\.(skp|obj|fbx|blend)$/i.test(name);
        const folderHasModels = (node: TreeNode): boolean => {
            if (node.assets.some(a => (isModelFile(a.name) || (a.name.toLowerCase().endsWith('.zip') && !node.path.toLowerCase().includes('material') && !node.path.toLowerCase().includes('texture'))) && !a.name.includes('_emblem.png'))) return true;
            return Object.values(node.children).some(folderHasModels);
        };

        Object.values(root.children).forEach(child => {
            const nameLower = child.name.toLowerCase();
            if (nameLower.includes('material') || nameLower.includes('texture') || nameLower.includes('color') || nameLower.includes('brick')) {
                matRoot.children[child.name] = child;
            } else if (folderHasModels(child) || nameLower.includes('model') || nameLower.includes('3d') || forceModelFolders.includes(child.name)) {
                modRoot.children[child.name] = child;
            } else {
                matRoot.children[child.name] = child;
            }
        });

        root.assets.forEach(asset => {
            const isZipModel = asset.name.toLowerCase().endsWith('.zip') && uploadType === 'model';
            if ((isModelFile(asset.name) || isZipModel) && !asset.name.includes('_emblem.png')) {
                modRoot.assets.push(asset);
            } else {
                matRoot.assets.push(asset);
            }
        });

        return { materialsTree: matRoot, modelsTree: modRoot };
    }, [localAssets, forceModelFolders]);

    const allPaths = React.useMemo(() => {
        const paths: string[] = [];
        const traverse = (node: TreeNode) => {
            if (node.path) paths.push(node.path);
            Object.values(node.children).forEach(traverse);
        };
        traverse(materialsTree);
        traverse(modelsTree);
        return paths;
    }, [materialsTree, modelsTree]);

    // Separate path lists for category-filtered upload target folder
    const materialPaths = React.useMemo(() => {
        const paths: string[] = [];
        const traverse = (node: TreeNode) => {
            if (node.path) paths.push(node.path);
            Object.values(node.children).forEach(traverse);
        };
        traverse(materialsTree);
        return paths;
    }, [materialsTree]);

    const modelPaths = React.useMemo(() => {
        const paths: string[] = [];
        const traverse = (node: TreeNode) => {
            if (node.path) paths.push(node.path);
            Object.values(node.children).forEach(traverse);
        };
        traverse(modelsTree);
        return paths;
    }, [modelsTree]);

    const handleDragStartFolder = (e: React.DragEvent, sourcePath: string) => {
        e.dataTransfer.setData('application/x-dooleys-folder', sourcePath);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetDir: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggedOverFolder(null);
        
        // 1. Check if moving a Folder
        const sourceFolder = e.dataTransfer.getData('application/x-dooleys-folder');
        if (sourceFolder) {
            // Prevent dragging into itself or its own children
            if (sourceFolder === targetDir || targetDir.startsWith(sourceFolder + '/')) {
                return;
            }
            try {
                const res = await fetch('/api/folders/move', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourceDirectoryRelative: sourceFolder, targetDirectoryRelative: targetDir })
                });
                const data = await res.json();
                if (data.success) {
                    setExpandedFolders(prev => ({ ...prev, [targetDir]: true }));
                    fetchLocalAssets();
                } else {
                    alert('Move Error: ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Folder move failed');
            }
            return;
        }

        // 2. Otherwise assume OS File Drop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const finalTitle = file.name.split('.')[0];
            
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append('title', finalTitle);
                formData.append('type', 'model'); 
                formData.append('targetFolder', targetDir);
                formData.append('assetFile', file);

                setExpandedFolders(prev => ({ ...prev, [targetDir]: true }));

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    fetchLocalAssets();
                } else {
                    alert(`Upload Error: ${data.error}`);
                }
            } catch (err) {
                console.error('Drag upload failed', err);
                alert('Drag upload failed');
            }
            setUploading(false);
        }
    };

    const FolderRow = ({ node }: { node: TreeNode }) => {
        const dir = node.path;
        const assets = node.assets;
        const isExpanded = expandedFolders[dir];
        const isEditing = editingFolder === dir;
        const childrenNodes = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
        const totalItems = assets.length + childrenNodes.length;
        const showHidden = showHiddenInFolder.has(dir);

        // Count hidden items in this folder
        const hiddenCount = assets.filter(a => hiddenItems.has(a.absolutePath)).length;
        
        return (
            <div 
                key={dir} 
                draggable={!isEditing}
                onDragStart={e => handleDragStartFolder(e, dir)}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggedOverFolder(dir); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDraggedOverFolder(null); }}
                onDrop={e => handleDrop(e, dir)}
                className={`bg-white dark:bg-[#0f1424] border-b last:border-b-0 ${draggedOverFolder === dir ? 'border-green-500 shadow-[inset_0_0_15px_rgba(34,197,94,0.3)] bg-green-50/10 z-10' : 'border-zinc-200 dark:border-[#1c2240]'} overflow-hidden transition-all duration-200 group/folder`}
            >
                <div 
                    onClick={() => !isEditing && toggleFolder(dir)}
                    className="w-full px-2 py-3 sm:px-3 sm:py-4 flex items-center justify-between bg-zinc-50 dark:bg-[#0a0e1a] hover:bg-zinc-100 dark:hover:bg-[#1c2240] transition-colors border-b border-transparent dark:border-transparent text-left focus:outline-none cursor-pointer group/folder"
                >
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 flex-shrink-0 fill-indigo-500/20" />
                        
                        {isEditing ? (
                            <div className="flex-1 min-w-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <input 
                                    autoFocus
                                    type="text"
                                    value={editFolderName}
                                    onChange={e => setEditFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRenameFolder(dir)}
                                    className="flex-1 min-w-0 bg-white dark:bg-[#0f1424] border border-indigo-500/50 rounded px-2 py-0.5 text-xs sm:text-sm font-bold dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button onClick={() => handleRenameFolder(dir)} className="p-1 flex-shrink-0 bg-green-500 text-white rounded shadow-sm hover:bg-green-600 transition-colors">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingFolder(null)} className="p-1 flex-shrink-0 bg-zinc-200 dark:bg-[#1c2240] text-zinc-600 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-[#2d3a5e] transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate pr-1" title={node.name}>{node.name}</span>
                        )}
                    </div>
                    
                    {!isEditing && (
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                            <div className="hidden group-hover/folder:flex items-center" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => { setEditFolderName(node.name); setEditingFolder(dir); }}
                                    className="p-1 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-[#1c2240] rounded transition-colors"
                                    title="Rename Folder"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteFolder(node.name)}
                                    className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#1c2240] rounded transition-colors"
                                    title="Hide Folder from Library"
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
                                </button>
                                {/* Show-hidden items toggle — only when folder has hidden items */}
                                {hiddenCount > 0 && (
                                    <button
                                        onClick={() => toggleShowHidden(dir)}
                                        className={`p-1 rounded transition-colors text-[9px] font-bold px-1.5 ${
                                            showHidden
                                                ? 'text-amber-400 bg-amber-500/10'
                                                : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'
                                        }`}
                                        title={showHidden ? 'Hide hidden items' : `Show ${hiddenCount} hidden item${hiddenCount > 1 ? 's' : ''}`}
                                    >
                                        {showHidden ? '👁' : `👁 ${hiddenCount}`}
                                    </button>
                                )}
                            </div>

                            <span className="text-[9px] sm:text-xs font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-200/40 dark:bg-[#151a2e]/80 px-1.5 py-0.5 rounded-sm whitespace-nowrap hidden group-hover/folder:inline sm:inline">{totalItems} items</span>
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                        </div>
                    )}
                </div>
                
                {(isExpanded && !isEditing) && (
                    <div className="p-2 sm:p-3 space-y-1 bg-zinc-50/50 dark:bg-[#0a0e1a]/50 pl-4 sm:pl-5 border-l-2 border-l-indigo-500/20 custom-scrollbar">
                        {childrenNodes.length > 0 && (
                            <div className="mb-2 border border-zinc-200 dark:border-[#1c2240] rounded-lg overflow-hidden shadow-sm">
                                {childrenNodes.map(child => <FolderRow key={child.path} node={child} />)}
                            </div>
                        )}
                        
                        {assets.map((asset, idx) => {
                            const isHidden = hiddenItems.has(asset.absolutePath);
                            // In normal mode: skip hidden items
                            if (isHidden && !showHidden) return null;

                            const isEmblem = asset.name.includes('_emblem.png');
                            const hasEmblem = assets.some(a => a.name === asset.name.replace(/\.[^/.]+$/, "") + '_emblem.png');
                            const isImage = !isEmblem && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(asset.name);
                            const isRenderable = !isEmblem && !hasEmblem && !isImage &&
                                                 (asset.name.endsWith('.skp') || 
                                                  asset.name.endsWith('.obj') || 
                                                  asset.name.endsWith('.fbx') || 
                                                  asset.name.endsWith('.zip') || 
                                                  asset.name.endsWith('.vrmat'));

                            const canPaint = (isImage || isEmblem) && !isHidden;

                            const handleDoubleClick = () => {
                                if (!canPaint) return;
                                window.dispatchEvent(new CustomEvent('dooley:paintTexture', {
                                    detail: { url: `/api/serve-file?path=${encodeURIComponent(asset.absolutePath)}` }
                                }));
                            };

                            return (
                                <div
                                    key={idx}
                                    onDoubleClick={handleDoubleClick}
                                    className={`flex items-center justify-between p-2 rounded-lg group transition-colors relative ${
                                        isHidden
                                            ? 'opacity-40 bg-zinc-100/50 dark:bg-[#151a2e]/30'
                                            : canPaint
                                            ? 'hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 cursor-pointer'
                                            : 'hover:bg-zinc-50 dark:hover:bg-[#1c2240]'
                                    }`}
                                    title={canPaint ? 'Double-click to select for painting' : ''}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-zinc-100 dark:bg-[#0a0e1a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-[#1c2240] shadow-sm relative">
                                            {(isEmblem || isImage) ? (
                                                <img 
                                                    src={`/api/serve-file?path=${encodeURIComponent(asset.absolutePath)}`} 
                                                    className="w-full h-full object-cover" 
                                                    alt={asset.name}
                                                />
                                            ) : (
                                                <ImageIcon className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400" />
                                            )}
                                            {/* Paint cursor indicator on hover */}
                                            {canPaint && (
                                                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/20 flex items-end justify-end p-0.5 transition-colors">
                                                    <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">🎨</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-[11px] sm:text-xs font-bold truncate text-zinc-800 dark:text-zinc-200" title={asset.name}>{asset.name}</span>
                                            {isHidden && <span className="text-[9px] text-amber-500 font-bold">HIDDEN</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {/* Hide / unhide button */}
                                        <button
                                            onClick={() => toggleItemHidden(asset.absolutePath)}
                                            title={isHidden ? 'Unhide this item' : 'Hide this item'}
                                            className={`p-1 rounded transition-all ${
                                                isHidden
                                                    ? 'text-amber-400 opacity-100 bg-amber-500/10'
                                                    : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#243052]'
                                            }`}
                                        >
                                            {isHidden
                                                ? <span className="text-[11px] font-bold">↩</span>
                                                : <EyeOff className="w-3.5 h-3.5" />
                                            }
                                        </button>

                                        {isRenderable && !isHidden && (
                                            <button 
                                                onClick={() => handleGenerateEmblem(asset)}
                                                className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded text-[10px] font-bold transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 active:scale-95"
                                                title="Generate 2D Symbol"
                                            >
                                                <span className="hidden sm:inline">2D Symbol</span>
                                                <Camera className="w-3 h-3 sm:hidden" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderAccordionSection = (
        title: string,
        icon: React.ReactNode,
        treeType: 'materials' | 'models',
        treeRoot: TreeNode,
        isExpanded: boolean,
        setIsExpanded: (val: boolean) => void
    ) => {
        const isCreating = creatingFolderIn === treeType;
        const totalItems = Object.keys(treeRoot.children).length + treeRoot.assets.length;

        return (
            <div className="w-full space-y-4">
                <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 bg-white dark:bg-[#0f1424] p-4 border border-zinc-200 dark:border-[#1c2240] rounded-2xl shadow-sm cursor-pointer hover:border-indigo-500/50 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <h3 className="text-lg lg:text-xl font-bold flex flex-wrap items-center gap-2 text-zinc-900 dark:text-white"
                         onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggedOverFolder('ROOT_UI'); }}
                         onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDraggedOverFolder(null); }}
                         onDrop={e => { e.preventDefault(); handleDrop(e, ''); }}
                    >
                        {icon}
                        <span className={draggedOverFolder === 'ROOT_UI' ? 'text-green-500' : ''}>{title}</span>
                        <span className="ml-2 px-2 py-0.5 bg-zinc-100 dark:bg-[#151a2e] text-zinc-500 dark:text-zinc-400 rounded-full text-[10px] sm:text-xs font-bold border border-zinc-200 dark:border-[#243052] whitespace-nowrap">
                            {totalItems} Total
                        </span>
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-400 ml-1" /> : <ChevronRight className="w-5 h-5 text-zinc-400 ml-1" />}
                    </h3>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => { setCreatingFolderIn(treeType); setIsExpanded(true); }} 
                            className="w-full sm:w-auto px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> New Folder
                        </button>
                        <button 
                            onClick={fetchLocalAssets} 
                            className="w-full sm:w-auto px-4 py-2 bg-zinc-50 dark:bg-[#0a0e1a] border border-zinc-200 dark:border-[#1c2240] rounded-lg hover:bg-zinc-100 dark:hover:bg-[#1c2240] transition-colors text-zinc-600 dark:text-zinc-300 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        {isCreating && (
                            <div className="flex items-center gap-2 p-3 bg-white dark:bg-[#0f1424] border border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-sm animate-in slide-in-from-top-2 fade-in">
                                <Folder className="w-4 h-4 text-indigo-500 flex-shrink-0 ml-1" />
                                <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Folder Name..."
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder(treeType)}
                                    className="flex-1 bg-transparent text-sm font-bold focus:outline-none dark:text-white"
                                />
                                <button onClick={() => handleCreateFolder(treeType)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setCreatingFolderIn(null)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <div className="max-h-[800px] overflow-y-auto custom-scrollbar pr-1">
                            {totalItems > 0 ? (
                                <div className="border border-zinc-200 dark:border-[#1c2240] rounded-xl overflow-hidden shadow-sm bg-white dark:bg-[#0f1424]">
                                    {Object.values(treeRoot.children).sort((a,b)=>a.name.localeCompare(b.name)).map(child => (
                                        <FolderRow key={child.path} node={child} />
                                    ))}
                                    
                                    {treeRoot.assets.length > 0 && treeRoot.assets.map((asset, idx) => {
                                        const isEmblem = asset.name.includes('_emblem.png');
                                        const hasEmblem = treeRoot.assets.some(a => a.name === asset.name.replace(/\.[^/.]+$/, "") + '_emblem.png');
                                        const isImage = !isEmblem && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(asset.name);
                                        const isRenderable = !isEmblem && !hasEmblem && !isImage &&
                                                             (asset.name.endsWith('.skp') || 
                                                              asset.name.endsWith('.obj') || 
                                                              asset.name.endsWith('.fbx') || 
                                                              asset.name.endsWith('.zip') || 
                                                              asset.name.endsWith('.vrmat'));

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-[#1c2240] group transition-colors border-b last:border-b-0 border-zinc-200 dark:border-[#1c2240]">
                                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-zinc-100 dark:bg-[#0a0e1a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-[#1c2240] shadow-sm relative">
                                                        {(isEmblem || isImage) ? (
                                                            <img 
                                                                src={`/api/serve-file?path=${encodeURIComponent(asset.absolutePath)}`} 
                                                                className="w-full h-full object-cover" 
                                                                alt={asset.name}
                                                            />
                                                        ) : (
                                                            <ImageIcon className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-[11px] sm:text-xs font-bold truncate text-zinc-800 dark:text-zinc-200" title={asset.name}>{asset.name}</span>
                                                        <span className="text-[9px] sm:text-[10px] text-zinc-400 truncate mt-0.5">Root Display</span>
                                                    </div>
                                                </div>

                                                {isRenderable && (
                                                    <button 
                                                        onClick={() => handleGenerateEmblem(asset)}
                                                        className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded text-[10px] font-bold transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 active:scale-95"
                                                        title="Generate 2D Symbol"
                                                    >
                                                        <span className="hidden sm:inline">2D Symbol</span>
                                                        <Camera className="w-3 h-3 sm:hidden" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : serverOnline === false ? (
                                <div className="w-full py-10 flex flex-col items-center justify-center bg-white dark:bg-[#0f1424] border border-red-500/30 rounded-xl shadow-sm gap-3">
                                    <div className="text-3xl">🔌</div>
                                    <p className="text-sm font-bold text-red-400">Server Offline</p>
                                    <p className="text-[11px] text-zinc-500 text-center max-w-[200px] leading-relaxed">
                                        The asset server isn't running.<br />
                                        <span className="text-zinc-400">Start it with your <span className="text-indigo-400 font-bold">Launch Dooleys Builder.bat</span> file.</span>
                                    </p>
                                    <p className="text-[10px] text-zinc-600 animate-pulse">Retrying automatically…</p>
                                    <button
                                        onClick={fetchLocalAssets}
                                        className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Retry Now
                                    </button>
                                </div>
                            ) : serverOnline === null ? (
                                <div className="w-full py-16 flex flex-col items-center justify-center text-zinc-500 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#1c2240] rounded-xl shadow-sm gap-3">
                                    <RefreshCw className="w-7 h-7 animate-spin opacity-50" />
                                    <p className="text-xs font-medium">Connecting to server…</p>
                                </div>
                            ) : (
                                <div className="w-full py-16 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#1c2240] rounded-xl shadow-sm">
                                    <Box className="w-10 h-10 mb-3" />
                                    <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Section is empty</p>
                                    <p className="text-[10px] sm:text-xs font-medium mt-1">Upload an asset or create a folder</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full h-full min-h-screen bg-zinc-50 dark:bg-[#0a0e1a] text-zinc-900 dark:text-zinc-100 p-4 lg:p-8 font-sans overflow-x-hidden">
            
            {/* Header */}
            <div className="mb-6 w-full max-w-6xl mx-auto flex flex-col gap-2">
                <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
                    <FolderOpen className="w-6 h-6 lg:w-8 lg:h-8 flex-shrink-0" />
                    <span>3D Asset Manager</span>
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs lg:text-sm leading-relaxed max-w-2xl">
                    Seamlessly upload and manage your local 3D models and materials directory for direct integration into your active canvas.
                </p>
            </div>

            <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 pb-20">
                
                {/* Upload Section */}
                <div className="w-full flex-shrink-0 space-y-6">
                    <div className="bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#1c2240] rounded-xl p-4 lg:p-5 shadow-sm">
                        
                        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2 mb-4 text-zinc-900 dark:text-white uppercase tracking-wider">
                            <UploadCloud className="w-4 h-4 text-indigo-500" />
                            Direct File Upload
                        </h3>
                        
                        <div className="space-y-4">
                            {/* Standard File Upload */}
                            <div>
                                <label className="block text-[10px] lg:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase tracking-wider">Choose File</label>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                    className="block w-full text-xs text-zinc-500 dark:text-zinc-400
                                      file:mr-2 file:py-1.5 file:px-3
                                      file:rounded-lg file:border-0
                                      file:text-xs file:font-bold
                                      file:bg-indigo-50 file:text-indigo-700
                                      dark:file:bg-indigo-500/10 dark:file:text-indigo-400
                                      hover:file:bg-indigo-100 dark:hover:file:bg-indigo-500/20
                                      cursor-pointer transition-all border border-zinc-200 dark:border-[#1c2240] rounded-lg bg-zinc-50 dark:bg-[#0a0e1a] p-1 flex-1 min-w-0"
                                />
                            </div>

                            {/* Options */}
                            <div className="space-y-3 flex-1 min-w-0">
                                <div>
                                    <label className="block text-[10px] lg:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase tracking-wider">Asset Title (Optional)</label>
                                    <input 
                                        type="text" 
                                        value={uploadTitle} 
                                        onChange={e => setUploadTitle(e.target.value)} 
                                        placeholder={uploadFile ? uploadFile.name.split('.')[0] : "e.g. ToiletModern"}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0a0e1a] border border-zinc-200 dark:border-[#1c2240] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] lg:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase tracking-wider">Asset Category</label>
                                    <select 
                                        value={uploadType} 
                                        onChange={e => { setUploadType(e.target.value); setUploadFolder(''); }}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0a0e1a] border border-zinc-200 dark:border-[#1c2240] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-no-repeat bg-[position:right_1rem_center]"
                                    >
                                        <option value="model">3D Model</option>
                                        <option value="material">Material / Texture Zip</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] lg:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase tracking-wider">Target Folder</label>
                                    <select 
                                        value={uploadFolder} 
                                        onChange={e => setUploadFolder(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0a0e1a] border border-zinc-200 dark:border-[#1c2240] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-no-repeat bg-[position:right_1rem_center]"
                                    >
                                        <option value="">Auto-categorize (Default)</option>
                                        {(uploadType === 'model' ? modelPaths : materialPaths).map(dir => (
                                            <option key={dir} value={dir}>{dir}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button 
                                onClick={handleUpload} 
                                disabled={uploading || !uploadFile} 
                                className={`w-full py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${uploadFile ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer' : 'bg-zinc-100 text-zinc-400 dark:bg-[#151a2e] dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-[#243052]'}`}
                            >
                                {uploading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="w-4 h-4" /> Upload To {uploadFolder ? uploadFolder : 'Library'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Accordion Sections */}
                <div className="w-full space-y-6">
                     {renderAccordionSection(
                         "Materials Library", 
                         <Layers className="w-5 h-5 text-indigo-500 flex-shrink-0" />, 
                         'materials',
                         materialsTree, 
                         isMaterialsExpanded, 
                         setIsMaterialsExpanded
                     )}
                     
                     {renderAccordionSection(
                         "3D Asset's", 
                         <Box className="w-5 h-5 text-orange-500 flex-shrink-0" />, 
                         'models',
                         modelsTree, 
                         isModelsExpanded, 
                         setIsModelsExpanded
                     )}
                </div>
            </div>
            
            {/* Custom Scrollbar CSS specifically for this thin mode */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
            `}} />
        </div>
    );
}
