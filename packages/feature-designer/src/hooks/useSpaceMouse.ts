/**
 * useSpaceMouse — WebHID hook for 3Dconnexion SpaceMouse
 * 
 * Reads 6DOF (translation X/Y/Z + rotation X/Y/Z) from the device
 * and exposes the values as a ref for use in the Three.js render loop.
 * 
 * Usage:
 *   const { connect, disconnect, isConnected, axes } = useSpaceMouse();
 *   // axes.current = { tx, ty, tz, rx, ry, rz } — updated every HID report
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// 3Dconnexion vendor IDs
const VENDOR_IDS = [
  { vendorId: 0x256f }, // 3Dconnexion (modern devices)
  { vendorId: 0x046d }, // Logitech (older SpaceMouse models)
];

// Dead zone to filter out noise (values below this are treated as 0)
const DEAD_ZONE = 3;

export interface SpaceMouseAxes {
  tx: number; // translate X (left/right)
  ty: number; // translate Y (up/down)
  tz: number; // translate Z (forward/back)
  rx: number; // rotate X (tilt forward/back)
  ry: number; // rotate Y (spin left/right)
  rz: number; // rotate Z (roll)
}

export function useSpaceMouse() {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const deviceRef = useRef<HIDDevice | null>(null);
  const axes = useRef<SpaceMouseAxes>({ tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 });

  const applyDeadZone = (value: number): number => {
    return Math.abs(value) < DEAD_ZONE ? 0 : value;
  };

  const handleInputReport = useCallback((event: HIDInputReportEvent) => {
    const { data, reportId } = event;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    if (reportId === 1 && data.byteLength >= 6) {
      // Translation: X, Y, Z (16-bit signed, little-endian)
      axes.current.tx = applyDeadZone(view.getInt16(0, true));
      axes.current.ty = applyDeadZone(view.getInt16(2, true));
      axes.current.tz = applyDeadZone(view.getInt16(4, true));
    } else if (reportId === 2 && data.byteLength >= 6) {
      // Rotation: Rx, Ry, Rz (16-bit signed, little-endian)
      axes.current.rx = applyDeadZone(view.getInt16(0, true));
      axes.current.ry = applyDeadZone(view.getInt16(2, true));
      axes.current.rz = applyDeadZone(view.getInt16(4, true));
    }
  }, []);

  const connect = useCallback(async () => {
    // Check WebHID support
    if (!('hid' in navigator)) {
      alert('WebHID is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      // Request device — must be triggered by user gesture
      const devices = await (navigator as any).hid.requestDevice({
        filters: VENDOR_IDS,
      });

      if (devices.length === 0) {
        console.log('[SpaceMouse] No device selected');
        return;
      }

      const device = devices[0] as HIDDevice;
      
      if (!device.opened) {
        await device.open();
      }

      device.addEventListener('inputreport', handleInputReport);
      deviceRef.current = device;
      setIsConnected(true);
      setDeviceName(device.productName || '3Dconnexion SpaceMouse');
      console.log(`[SpaceMouse] Connected: ${device.productName}`);
    } catch (err) {
      console.error('[SpaceMouse] Connection failed:', err);
    }
  }, [handleInputReport]);

  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      deviceRef.current.removeEventListener('inputreport', handleInputReport);
      try {
        await deviceRef.current.close();
      } catch (e) {
        // Device may already be closed
      }
      deviceRef.current = null;
      setIsConnected(false);
      setDeviceName(null);
      // Reset axes
      axes.current = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 };
      console.log('[SpaceMouse] Disconnected');
    }
  }, [handleInputReport]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.removeEventListener('inputreport', handleInputReport);
        deviceRef.current.close().catch(() => {});
      }
    };
  }, [handleInputReport]);

  // Auto-reconnect to previously paired devices
  useEffect(() => {
    if (!('hid' in navigator)) return;
    
    (navigator as any).hid.getDevices().then((devices: HIDDevice[]) => {
      const spaceMouse = devices.find(d => 
        d.vendorId === 0x256f || d.vendorId === 0x046d
      );
      if (spaceMouse) {
        spaceMouse.open().then(() => {
          spaceMouse.addEventListener('inputreport', handleInputReport);
          deviceRef.current = spaceMouse;
          setIsConnected(true);
          setDeviceName(spaceMouse.productName || '3Dconnexion SpaceMouse');
          console.log(`[SpaceMouse] Auto-reconnected: ${spaceMouse.productName}`);
        }).catch(() => {});
      }
    });
  }, [handleInputReport]);

  return { connect, disconnect, isConnected, deviceName, axes };
}
