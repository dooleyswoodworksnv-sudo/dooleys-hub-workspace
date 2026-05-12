import { useEffect, useRef, useCallback } from 'react';
import App from './App';
import { useProject } from '@dooleys/core';
import type { DesignConfig, MaterialLineItem } from '@dooleys/core';

/**
 * Bridge payload — the lightweight subset of Designer state
 * that gets pushed to the shared ProjectContext.
 */
export interface DesignerBridgePayload {
  widthFt: number;
  lengthFt: number;
  wallHeightFt: number;
  stories: number;
  roofType: string;
  roofPitch: number;
  materialEstimate: {
    totalCost: number;
    lineItems: {
      category: string;
      name: string;
      quantity: number;
      unit: string;
      unitCost: number;
      totalCost: number;
    }[];
  };
}

/**
 * DesignerModule — Entry point for the Building Solutions designer
 * within the Construction Hub monorepo.
 *
 * Wraps the full 2D/3D house shell builder and bridges its design
 * configuration + material estimates to the shared ProjectContext.
 */
export function DesignerModule() {
  const { setDesignConfig, currentProject, setCurrentProject, blueprintData } = useProject();
  const lastPayloadRef = useRef<string>('');

  const handleDesignChange = useCallback((payload: DesignerBridgePayload) => {
    // Avoid unnecessary bridge writes by comparing serialized payloads
    const serialized = JSON.stringify({
      w: payload.widthFt,
      l: payload.lengthFt,
      h: payload.wallHeightFt,
      s: payload.stories,
      rt: payload.roofType,
      rp: payload.roofPitch,
      tc: payload.materialEstimate.totalCost,
      ic: payload.materialEstimate.lineItems.length,
    });

    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;

    const config: DesignConfig = {
      walls: [], // Full wall config could be added later
      roofs: [{
        id: 'main-roof',
        style: (payload.roofType as DesignConfig['roofs'][0]['style']) || 'gable',
        pitch: payload.roofPitch,
        overhang: 0,
        fascia: 0,
      }],
      floorArea: payload.widthFt * payload.lengthFt,
      stories: payload.stories,
      materialEstimate: {
        totalCost: payload.materialEstimate.totalCost,
        lineItems: payload.materialEstimate.lineItems as MaterialLineItem[],
        lastUpdated: new Date().toISOString(),
      },
    };

    setDesignConfig(config);
  }, [setDesignConfig]);

  return (
    <App
      onDesignChange={handleDesignChange}
      currentProject={currentProject}
      setCurrentProject={setCurrentProject}
      blueprintImageUrls={blueprintData?.imageDataUrls ?? null}
    />
  );
}

export default DesignerModule;
