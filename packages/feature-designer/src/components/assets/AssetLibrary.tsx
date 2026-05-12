import React from 'react';
import { Sofa, Bed, Table, Utensils, Bath, Toilet } from 'lucide-react';
import { InteriorAsset } from '../../App';

export interface AssetDefinition {
  id: string;
  name: string;
  category: 'kitchen' | 'bathroom' | 'furniture';
  icon: React.ReactNode;
  placeholder: React.ReactNode;
}

const ASSET_LIBRARY: AssetDefinition[] = [
  { id: 'sink-farmhouse', name: 'Farmhouse Sink', category: 'kitchen', icon: <Utensils size={18} />, placeholder: <div className="w-8 h-8 bg-zinc-200 rounded" /> },
  { id: 'tub-freestanding', name: 'Freestanding Tub', category: 'bathroom', icon: <Bath size={18} />, placeholder: <div className="w-12 h-6 bg-zinc-200 rounded-full" /> },
  { id: 'sofa-3seater', name: '3-Seater Sofa', category: 'furniture', icon: <Sofa size={18} />, placeholder: <div className="w-12 h-8 bg-zinc-200 rounded" /> },
];

interface AssetLibraryProps {
  onAddAsset: (asset: Omit<InteriorAsset, 'id' | 'x' | 'y' | 'rotation' | 'scale' | 'floorIndex'>) => void;
}

export default function AssetLibrary({ onAddAsset }: AssetLibraryProps) {
  return (
    <div className="space-y-4">
      {['kitchen', 'bathroom', 'furniture'].map(category => (
        <div key={category} className="space-y-2">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{category}</h4>
          <div className="grid grid-cols-2 gap-2">
            {ASSET_LIBRARY.filter(a => a.category === category).map(asset => (
              <button
                key={asset.id}
                onClick={() => onAddAsset({ type: asset.id, category: asset.category, name: asset.name })}
                className="flex items-center gap-2 p-2 bg-white dark:bg-[#151a2e] border border-zinc-200 dark:border-[#243052] rounded-lg hover:border-indigo-500 transition-colors"
              >
                {asset.icon}
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
