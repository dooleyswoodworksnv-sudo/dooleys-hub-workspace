/**
 * Standalone Blueprint Reader
 * 
 * Thin shell wrapping the shared BlueprintModule from the monorepo.
 * ProjectProvider is mounted in main.tsx (same as the hub).
 * 
 * Run: npm run dev (starts on port 3020)
 */
import { BlueprintModule } from '@dooleys/feature-blueprints';

export default function App() {
  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      <BlueprintModule />
    </div>
  );
}
