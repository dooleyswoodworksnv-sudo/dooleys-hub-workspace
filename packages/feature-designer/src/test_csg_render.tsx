import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';

const App = () => {
  return (
    <Canvas>
      <ambientLight />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </Canvas>
  );
};

createRoot(document.getElementById('root')).render(<App />);
