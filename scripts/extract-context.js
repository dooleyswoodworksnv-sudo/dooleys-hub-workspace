const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../packages/feature-blueprints/src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

const lines = content.split('\n');

const stateLines = [];
let vars = [];

let appStartIndex = lines.findIndex(l => l.includes('export default function App() {'));

let i = appStartIndex + 1;
while(i < lines.length) {
    let line = lines[i];
    if (line.includes('type HistoryState = {')) break;
    
    if (line.includes('useState') || line.includes('useRef')) {
        stateLines.push(line);
        let match = line.match(/const\s+\[(.*?)\]\s*=/);
        if (match) {
            let parts = match[1].split(',').map(s => s.trim());
            vars.push(...parts);
        } else {
            let matchRef = line.match(/const\s+(.*?)\s*=\s*useRef/);
            if (matchRef) {
                vars.push(matchRef[1].trim());
            }
        }
    } else if (line.trim() !== '') {
       // if there are some non-state empty lines, just ignore them
    }
    i++;
}

const contextContent = `import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
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
${stateLines.join('\n')}

  return {
    ${vars.join(',\n    ')}
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
`;

const contextPath = path.join(__dirname, '../packages/feature-blueprints/src/context/BlueprintContext.tsx');
fs.mkdirSync(path.dirname(contextPath), { recursive: true });
fs.writeFileSync(contextPath, contextContent);

lines.splice(appStartIndex + 1, i - appStartIndex - 1, `  const state = useBlueprint();\n  const { ${vars.join(', ')} } = state;`);

lines.unshift(`import { useBlueprint, BlueprintProvider } from './context/BlueprintContext';`);

let finalContent = lines.join('\n').replace('export default function App() {', 'function AppContent() {');

// remove default export of the function if present
finalContent += '\nexport default function App() {\n  return <BlueprintProvider><AppContent /></BlueprintProvider>;\n}\n';

fs.writeFileSync(appPath, finalContent);
console.log('Context extracted successfully!');
