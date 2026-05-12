const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../packages/feature-blueprints/src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* Blueprint Index */}'));
let endIndex = startIndex;
// find the matching end brace / div
// we know it ends right before {/* Top: Upload Section */}
while (endIndex < lines.length) {
    if (lines[endIndex].includes('{/* Top: Upload Section */}')) {
        break;
    }
    endIndex++;
}

// Lines to extract: from startIndex to endIndex - 1
const sidebarLines = lines.slice(startIndex, endIndex);

const componentCode = `import React from 'react';
import { Languages, Loader2, CheckCircle2, MessageSquare, Search } from 'lucide-react';
import { useBlueprint } from '../context/BlueprintContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
${sidebarLines.join('\n')}
    </>
  );
}
`;

const sidebarPath = path.join(__dirname, '../packages/feature-blueprints/src/components/BlueprintSidebar.tsx');
fs.mkdirSync(path.dirname(sidebarPath), { recursive: true });
fs.writeFileSync(sidebarPath, componentCode);

// Replace lines in App.tsx
const replacement = `        <BlueprintSidebar
          handleTranslate={handleTranslate}
          togglePageAdded={togglePageAdded}
          handlePageChange={handlePageChange}
          handleExplainTerm={handleExplainTerm}
          toggleItemAdded={toggleItemAdded}
        />`;

lines.splice(startIndex, endIndex - startIndex, replacement);

// Add import
lines.unshift(`import { BlueprintSidebar } from './components/BlueprintSidebar';`);

fs.writeFileSync(appPath, lines.join('\n'));
console.log('Sidebar extracted successfully!');
