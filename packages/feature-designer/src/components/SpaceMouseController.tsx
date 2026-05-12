/**
 * SpaceMouseController — R3F component that applies SpaceMouse 6DOF input to the camera
 * 
 * Must be placed inside a <Canvas> as a sibling to <OrbitControls>.
 * Reads from the axes ref provided by useSpaceMouse and moves the camera each frame.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { MutableRefObject, useRef } from 'react';
import * as THREE from 'three';
import type { SpaceMouseAxes } from '../hooks/useSpaceMouse';

interface SpaceMouseControllerProps {
  axes: MutableRefObject<SpaceMouseAxes>;
  enabled: boolean;
  sensitivity?: number;
}

const SpaceMouseController = ({ axes, enabled, sensitivity = 1.0 }: SpaceMouseControllerProps) => {
  const { camera, gl } = useThree();
  const targetRef = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame((state) => {
    if (!enabled) return;

    const a = axes.current;
    // Skip if no meaningful input
    if (a.tx === 0 && a.ty === 0 && a.tz === 0 && a.rx === 0 && a.ry === 0 && a.rz === 0) return;

    // Get the OrbitControls instance from the Three.js state
    const controls = state.controls as any;
    
    // Sync our target with OrbitControls target
    if (controls?.target) {
      targetRef.current.copy(controls.target);
    } else if (!initialized.current) {
      // Estimate the initial look target
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      targetRef.current.copy(camera.position).addScaledVector(dir, 10);
      initialized.current = true;
    }

    // Normalize the raw values (~350 max for most SpaceMouse models)
    const SCALE = 350;
    const tx = (a.tx / SCALE) * sensitivity;
    const ty = (a.ty / SCALE) * sensitivity;
    const tz = (a.tz / SCALE) * sensitivity;
    const rx = (a.rx / SCALE) * sensitivity;
    const ry = (a.ry / SCALE) * sensitivity;

    // Speeds (scaled to scene in inches-to-feet range)
    const moveSpeed = 0.2;
    const rotSpeed = 0.02;

    // Get camera's local axes for relative movement
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    
    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();
    const cameraUp = new THREE.Vector3();
    cameraUp.crossVectors(right, forward).normalize();

    // Apply translation — move both camera and target together (panning)
    const delta = new THREE.Vector3();
    delta.addScaledVector(right, tx * moveSpeed);     // Push right = pan right
    delta.addScaledVector(cameraUp, -ty * moveSpeed);  // Push up = pan up
    delta.addScaledVector(forward, -tz * moveSpeed);   // Push forward = dolly in

    camera.position.add(delta);
    targetRef.current.add(delta);

    // Apply orbital rotation around the target
    const offset = camera.position.clone().sub(targetRef.current);
    
    // Horizontal rotation (ry = twist the knob)
    const phi = -ry * rotSpeed;
    offset.applyAxisAngle(up, phi);
    
    // Vertical rotation (rx = tilt forward/back)
    const theta = rx * rotSpeed;
    const rightAxis = new THREE.Vector3().crossVectors(offset, up).normalize();
    if (rightAxis.length() > 0.001) {
      // Clamp to prevent flipping over the poles
      const currentAngle = offset.angleTo(up);
      const newAngle = currentAngle - theta;
      if (newAngle > 0.1 && newAngle < Math.PI - 0.1) {
        offset.applyAxisAngle(rightAxis, theta);
      }
    }

    camera.position.copy(targetRef.current).add(offset);
    camera.lookAt(targetRef.current);

    // Sync back to OrbitControls so it stays in sync
    if (controls?.target) {
      controls.target.copy(targetRef.current);
      controls.update();
    }
  });

  return null;
};

export default SpaceMouseController;
