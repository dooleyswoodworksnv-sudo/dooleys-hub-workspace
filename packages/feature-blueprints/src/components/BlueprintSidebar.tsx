import React, { useState, useMemo, useEffect } from 'react';
import { Languages, Loader2, CheckCircle2, MessageSquare, Search, ChevronDown, ChevronRight, BookOpen, Hash, FileText, X } from 'lucide-react';
import { useBlueprint } from '../context/BlueprintContext';
import { Button, Card, cn } from '@dooleys/ui';



interface BlueprintSidebarProps {
  handleTranslate: () => void;
  togglePageAdded: (page: number) => void;
  handlePageChange: (page: number) => void;
  handleExplainTerm: (term: string, context?: string) => void;
  toggleItemAdded: (id: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Derive a human-readable title for a page from its first item */
function derivePageTitle(items: { label: string; type: string }[]): string {
  // Prefer the first "general_note" item, or the first item overall
  const titleItem = items.find(i => i.type === 'general_note') ?? items[0];
  if (!titleItem) return 'Untitled Page';
  // Clean up: truncate overly long labels
  const raw = titleItem.label;
  return raw.length > 60 ? raw.slice(0, 57) + '…' : raw;
}

/** Check if an item matches a search query */
function itemMatchesQuery(item: { label: string; description?: string; value?: string; type: string }, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    item.label.toLowerCase().includes(lower) ||
    (item.description?.toLowerCase().includes(lower) ?? false) ||
    (item.value?.toLowerCase().includes(lower) ?? false) ||
    item.type.toLowerCase().includes(lower)
  );
}

/** Highlight matching text within a string */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/40 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Component ───────────────────────────────────────────────────

export function BlueprintSidebar({
  handleTranslate,
  togglePageAdded,
  handlePageChange,
  handleExplainTerm,
  toggleItemAdded
}: BlueprintSidebarProps) {
  const {
    data,
    targetLanguage,
    setTargetLanguage,
    isTranslating,
    currentPage,
    numPages,
    addedItems,
    searchQuery,
    setSearchQuery,
    selectedItemId,
    setSelectedItemId
  } = useBlueprint();

  // ── Accordion state ──
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([1]));
  const [activeView, setActiveView] = useState<'chapters' | 'index'>('chapters');
  const [indexSearchQuery, setIndexSearchQuery] = useState('');

  // ── Derived data ──
  const pageGroups = useMemo(() => {
    if (!data?.items) return [];
    const groups = new Map<number, typeof data.items>();
    data.items.forEach(item => {
      const page = item.page ?? 1;
      if (!groups.has(page)) groups.set(page, []);
      groups.get(page)!.push(item);
    });
    // Sort by page number
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, items]) => {
        const meta = data.pageMeta?.[page];
        // Use AI-extracted title block data if available, otherwise derive from first item
        const sheetTitle = meta?.sheetTitle || derivePageTitle(items);
        const sheetNumber = meta?.sheetNumber || '';
        return {
          page,
          title: sheetTitle,
          sheetNumber,
          items,
          totalItems: items.length,
          completedItems: items.filter(i => addedItems.includes(i.id)).length,
        };
      });
  }, [data?.items, data?.pageMeta, addedItems]);

  // ── Cross-reference index ──
  const crossRefIndex = useMemo(() => {
    if (!data?.items) return [];
    const termMap = new Map<string, Set<number>>();
    
    data.items.forEach(item => {
      const page = item.page ?? 1;
      // Extract meaningful terms from labels
      const words = item.label
        .replace(/[^a-zA-Z0-9\s\-\/]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      
      words.forEach(word => {
        if (!termMap.has(word)) termMap.set(word, new Set());
        termMap.get(word)!.add(page);
      });

      // Also index by type
      const typeLabel = item.type.replace('_', ' ');
      const typeTitleCase = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
      if (!termMap.has(typeTitleCase)) termMap.set(typeTitleCase, new Set());
      termMap.get(typeTitleCase)!.add(page);
    });

    return Array.from(termMap.entries())
      .map(([term, pages]) => ({ term, pages: Array.from(pages).sort((a, b) => a - b) }))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [data?.items]);

  // ── Filtered index for search ──
  const filteredIndex = useMemo(() => {
    if (!indexSearchQuery) return crossRefIndex;
    const q = indexSearchQuery.toLowerCase();
    return crossRefIndex.filter(entry => entry.term.toLowerCase().includes(q));
  }, [crossRefIndex, indexSearchQuery]);

  // ── Search: auto-expand pages with matches ──
  useEffect(() => {
    if (!searchQuery || !data?.items) return;
    const matchingPages = new Set<number>();
    data.items.forEach(item => {
      if (itemMatchesQuery(item, searchQuery)) {
        matchingPages.add(item.page ?? 1);
      }
    });
    if (matchingPages.size > 0) {
      setExpandedPages(matchingPages);
    }
  }, [searchQuery, data?.items]);

  const togglePage = (page: number) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  };

  // ── Count search matches per page ──
  const getPageMatchCount = (items: typeof data.items) => {
    if (!searchQuery) return 0;
    return items.filter(item => itemMatchesQuery(item, searchQuery)).length;
  };

  if (!data) return null;

  const totalItems = data.items.length;
  const totalCompleted = data.items.filter(i => addedItems.includes(i.id)).length;

  return (
    <div className="bg-surface border border-ink/10 rounded-2xl overflow-hidden shadow-sm">
      {/* ─── Header Bar ─── */}
      <div className="bg-ink/5 p-4 space-y-3 border-b border-ink/10">
        {/* Top row: Title + Stats */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-emerald-500" />
            <span className="text-[11px] uppercase font-bold tracking-widest opacity-70">Blueprint Index</span>
            <span className="text-[10px] font-mono opacity-40">
              {totalCompleted}/{totalItems}
            </span>
          </div>
          {/* View toggle */}
          <div className="flex bg-ink/5 p-0.5 rounded-lg border border-ink/10 gap-0.5">
            <button
              onClick={() => setActiveView('chapters')}
              className={cn(
                "px-3 py-1 text-[9px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-1.5",
                activeView === 'chapters' ? "bg-ink text-paper" : "opacity-40 hover:opacity-100"
              )}
            >
              <FileText size={10} /> Chapters
            </button>
            <button
              onClick={() => setActiveView('index')}
              className={cn(
                "px-3 py-1 text-[9px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-1.5",
                activeView === 'index' ? "bg-ink text-paper" : "opacity-40 hover:opacity-100"
              )}
            >
              <Hash size={10} /> Index
            </button>
          </div>
        </div>

        {/* Translation row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages size={14} className="opacity-50" />
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="text-xs bg-transparent border-none outline-none cursor-pointer font-medium"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
              <option value="Arabic">Arabic</option>
              <option value="Russian">Russian</option>
              <option value="Portuguese">Portuguese</option>
            </select>
            <Button
              variant="secondary"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 h-auto min-h-0 disabled:opacity-50"
              title="Translate extracted data"
            >
              {isTranslating ? <Loader2 size={12} className="animate-spin" /> : null}
              Translate
            </Button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-ink/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[9px] font-mono opacity-40">{totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      {/* ─── Chapter View ─── */}
      {activeView === 'chapters' && (
        <div className="max-h-[500px] overflow-y-auto">
          {pageGroups.map((group) => {
            const isExpanded = expandedPages.has(group.page);
            const matchCount = getPageMatchCount(group.items);
            const allCompleted = group.completedItems === group.totalItems;
            const isCurrentPage = currentPage === group.page;
            const filteredItems = searchQuery
              ? group.items.filter(item => itemMatchesQuery(item, searchQuery))
              : group.items;

            return (
              <div key={group.page} className={cn(
                "border-b border-ink/5 last:border-0",
                isCurrentPage && "bg-emerald-500/[0.03]"
              )}>
                {/* ── Chapter Header ── */}
                <button
                  onClick={() => {
                    togglePage(group.page);
                    handlePageChange(group.page);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors text-left group"
                  )}
                >
                  {/* Expand/collapse icon */}
                  <div className="shrink-0 text-ink/30 group-hover:text-ink/60 transition-colors">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  {/* Sheet number / Page number badge */}
                  <div className={cn(
                    "shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono transition-colors px-2 py-1.5 min-w-[2rem]",
                    isCurrentPage
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                      : allCompleted
                        ? "bg-emerald-500/10 text-emerald-500/60"
                        : "bg-ink/5 text-ink/50"
                  )}>
                    {group.sheetNumber || `P${group.page}`}
                  </div>
                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[13px] font-bold truncate",
                      allCompleted && "text-ink/40 line-through"
                    )}>
                      {group.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] opacity-40 font-mono">
                        {group.completedItems}/{group.totalItems} items
                      </span>
                      {matchCount > 0 && searchQuery && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                          {matchCount} match{matchCount !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Page complete toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePageAdded(group.page);
                    }}
                    className={cn(
                      "p-1.5 rounded-full transition-colors shrink-0",
                      allCompleted ? "text-emerald-500" : "text-ink/15 hover:text-ink/50"
                    )}
                    title={allCompleted ? "Page completed" : "Mark page complete"}
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </button>

                {/* ── Chapter Items (Accordion Body) ── */}
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1">
                    {filteredItems.length > 0 ? filteredItems.map((item, i) => (
                      <Card
                        key={item.id}
                        onClick={() => {
                          if (item.id === selectedItemId) {
                            setSelectedItemId(null);
                          } else {
                            setSelectedItemId(item.id);
                            if (item.page && item.page !== currentPage) {
                              handlePageChange(item.page);
                            }
                          }
                        }}
                        className={cn(
                          "p-3 flex justify-between items-start hover:bg-white/5 transition-colors group cursor-pointer border-transparent hover:border-white/10",
                          selectedItemId === item.id ? "bg-emerald-500/10 border-emerald-500/30" : "bg-bg-secondary",
                          addedItems.includes(item.id) ? "opacity-40" : ""
                        )}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "w-7 h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold shrink-0",
                            selectedItemId === item.id ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/50"
                          )}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[13px] font-bold",
                              addedItems.includes(item.id) && "line-through text-white/40"
                            )}>
                              <HighlightText text={item.label} query={searchQuery} />
                            </p>
                            {item.value && (
                              <p className="text-[12px] font-mono font-medium mt-0.5 text-ink/60 truncate">
                                <HighlightText text={item.value} query={searchQuery} />
                              </p>
                            )}
                            {item.description && (
                              <p className="text-[11px] opacity-50 mt-0.5 leading-relaxed line-clamp-2">
                                <HighlightText text={item.description} query={searchQuery} />
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <span className={cn(
                                "text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold tracking-wider",
                                item.type === 'room' ? "bg-blue-500/15 text-blue-400" :
                                item.type === 'dimension' ? "bg-amber-500/15 text-amber-400" :
                                item.type === 'general_note' ? "bg-purple-500/15 text-purple-400" :
                                item.type === 'door_schedule' ? "bg-orange-500/15 text-orange-400" :
                                item.type === 'window_schedule' ? "bg-cyan-500/15 text-cyan-400" :
                                "bg-ink/5 text-ink/50"
                              )}>
                                {item.type.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] opacity-30 font-mono">
                                {Math.round(item.confidence * 100)}%
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExplainTerm(item.label, item.description);
                                }}
                                className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                                title="Get AI explanation"
                              >
                                <MessageSquare size={8} /> Explain
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://www.google.com/search?q=${encodeURIComponent(item.label + ' architectural term')}`, '_blank');
                                }}
                                className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                                title="Search Google"
                              >
                                <Search size={8} /> Web
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemAdded(item.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-full transition-colors shrink-0",
                            addedItems.includes(item.id) ? "text-emerald-500" : "text-ink/15 hover:text-ink"
                          )}
                          title={addedItems.includes(item.id) ? "Mark incomplete" : "Mark complete"}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </Card>
                    )) : (
                      <div className="px-4 py-3 text-[11px] opacity-40 italic">
                        No items match your search on this page
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {pageGroups.length === 0 && (
            <div className="p-8 text-center text-sm opacity-50">No items found</div>
          )}
        </div>
      )}

      {/* ─── Index View (Cross-Reference) ─── */}
      {activeView === 'index' && (
        <div className="max-h-[500px] overflow-y-auto">
          {/* Index search */}
          <div className="sticky top-0 z-10 bg-surface p-2 border-b border-ink/5">
            <div className="relative">
              <input
                type="text"
                value={indexSearchQuery}
                onChange={(e) => setIndexSearchQuery(e.target.value)}
                placeholder="Search index terms…"
                className="w-full pl-8 pr-8 py-2 bg-ink/5 border border-ink/10 rounded-lg text-[12px] focus:outline-none focus:border-emerald-500/30 transition-colors"
              />
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-30" />
              {indexSearchQuery && (
                <button
                  onClick={() => setIndexSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          {/* Alphabetical index */}
          <div className="p-2">
            {(() => {
              // Group by first letter
              const letterGroups = new Map<string, typeof filteredIndex>();
              filteredIndex.forEach(entry => {
                const letter = entry.term.charAt(0).toUpperCase();
                if (!letterGroups.has(letter)) letterGroups.set(letter, []);
                letterGroups.get(letter)!.push(entry);
              });
              const sortedLetters = Array.from(letterGroups.keys()).sort();
              
              if (sortedLetters.length === 0) {
                return <div className="p-6 text-center text-[11px] opacity-40">No matching terms</div>;
              }

              return sortedLetters.map(letter => (
                <div key={letter} className="mb-3">
                  <div className="sticky top-12 z-[5] bg-surface px-2 py-1">
                    <span className="text-[14px] font-bold text-emerald-500/80 font-serif italic">{letter}</span>
                  </div>
                  <div className="space-y-0.5">
                    {letterGroups.get(letter)!.map(entry => (
                      <div
                        key={entry.term}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-ink/5 transition-colors group"
                      >
                        <span className="text-[12px] font-medium truncate flex-1">
                          <HighlightText text={entry.term} query={indexSearchQuery} />
                        </span>
                        <div className="flex gap-1 shrink-0 ml-2">
                          {entry.pages.map(p => (
                            <button
                              key={p}
                              onClick={() => {
                                handlePageChange(p);
                                setActiveView('chapters');
                                setExpandedPages(new Set([p]));
                              }}
                              className={cn(
                                "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors",
                                currentPage === p
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-ink/5 text-ink/50 hover:bg-ink/10 hover:text-ink"
                              )}
                              title={`Go to page ${p}`}
                            >
                              p.{p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
