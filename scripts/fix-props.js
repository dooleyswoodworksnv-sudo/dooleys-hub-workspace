const fs = require('fs');

const badProps = [
  'handleGlobalMouseMove',
  'handleResize',
  'handleMove',
  'handleEnd',
  'handleMouseMove',
  'handleMouseUp',
  'handlePanMove',
  'handlePanEnd'
];

function filterLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const newLines = lines.filter(line => {
    return !badProps.some(prop => line.includes(prop));
  });
  fs.writeFileSync(filePath, newLines.join('\n'));
}

filterLines('packages/feature-blueprints/src/App.tsx');
filterLines('packages/feature-blueprints/src/components/BlueprintCanvas.tsx');
console.log('Fixed props!');
