import React from 'react';
import { Languages, Loader2, CheckCircle2, MessageSquare, Search } from 'lucide-react';
import { useBlueprint } from '../context/BlueprintContext';
import { Button, Card, cn } from '@dooleys/ui';



interface BlueprintSidebarProps {
  handleTranslate: () => void;
  togglePageAdded: (page: number) => void;
  handlePageChange: (page: number) => void;
  handleExplainTerm: (term: string, context?: string) => void;
  toggleItemAdded: (id: string) => void;
}

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
    addedItems,
    searchQuery,
    selectedItemId,
    setSelectedItemId
  } = useBlueprint();

  return (
    <>
        {/* Blueprint Index */}
        {data && (
          <div className="bg-surface border border-ink/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-ink/5 p-4 flex flex-col gap-4 border-b border-ink/10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Blueprint Index</span>
                  
                  <div className="flex items-center gap-2 border-l border-ink/10 pl-4">
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
                </div>
                <div className="flex items-center gap-4">
                  {data?.items && data.items.some(item => item.page === currentPage || (!item.page && currentPage === 1)) && (
                    <Button
                      variant={data.items.filter(item => item.page === currentPage || (!item.page && currentPage === 1)).every(item => addedItems.includes(item.id)) ? "primary" : "secondary"}
                      onClick={() => togglePageAdded(currentPage)}
                      className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 h-auto min-h-0"
                      title="Toggle all items on this page as completed"
                    >
                      <CheckCircle2 size={12} />
                      {data.items.filter(item => item.page === currentPage || (!item.page && currentPage === 1)).every(item => addedItems.includes(item.id)) ? "Page Completed" : "Mark Page Complete"}
                    </Button>
                  )}
                  <span className="text-[10px] opacity-50 uppercase">{data.items.length} Total Items</span>
                </div>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
              {data?.items?.filter(item => 
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.type.toLowerCase().includes(searchQuery.toLowerCase())
              ).length > 0 ? data.items.filter(item => 
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.type.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((item, i) => (
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
                    "p-4 flex justify-between items-start hover:bg-white/5 transition-colors group cursor-pointer border-transparent hover:border-white/10",
                    selectedItemId === item.id ? "bg-emerald-500/10 border-emerald-500/30" : "bg-bg-secondary",
                    addedItems.includes(item.id) ? "opacity-50" : ""
                  )}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0",
                      selectedItemId === item.id ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/70"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "text-[14px] font-bold text-white",
                        addedItems.includes(item.id) && "line-through text-white/50"
                      )}>
                        {item.label}
                      </p>
                      {item.value && (
                        <p className="text-[13px] font-mono font-medium mt-1 text-ink/70">
                          {item.value}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-[12px] opacity-60 mt-1 leading-relaxed max-w-md">
                          {item.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExplainTerm(item.label, item.description);
                          }}
                          className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 h-auto min-h-0 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                          title="Get AI explanation for this term"
                        >
                          <MessageSquare size={12} /> Explain with AI
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(item.label + ' architectural term')}`, '_blank');
                          }}
                          className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 h-auto min-h-0 text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
                          title="Search Google for this term"
                        >
                          <Search size={12} /> Search Web
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {item.page && (
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider bg-ink text-paper">
                            Page {item.page}
                          </span>
                        )}
                        <span className={cn(
                          "text-[9px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider",
                          item.type === 'room' ? "bg-blue-100 text-blue-700" : 
                          item.type === 'dimension' ? "bg-amber-100 text-amber-700" :
                          item.type === 'general_note' ? "bg-purple-100 text-purple-700" :
                          "bg-ink/5 text-ink/70"
                        )}>
                          {item.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] opacity-40 uppercase leading-relaxed font-medium">
                          Conf: {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItemAdded(item.id);
                    }}
                    className={cn(
                      "p-2 rounded-full transition-colors shrink-0",
                      addedItems.includes(item.id) ? "text-emerald-500" : "text-ink/20 hover:text-ink"
                    )}
                    title={addedItems.includes(item.id) ? "Mark incomplete" : "Mark complete"}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                </Card>
              )) : (
                <div className="p-8 text-center text-sm opacity-50">No items found</div>
              )}
            </div>
          </div>
        )}

    </>
  );
}
