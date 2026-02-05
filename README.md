# P3 Loops Path Editor

A React/Vite web application for creating and managing non-crossing paths on a bowed square with edge identifications.

## Features

- **Bowed Square Visualization**: An SVG-based square with slightly bowed out sides and 4 cusps
- **Edge Identifications**: 
  - North ≡ East (a point at t% along North is the same as t% along East)
  - South ≡ West (a point at t% along South is the same as t% along West)
- **Path Creation**: Click-to-add edges with visual feedback showing the two possible continuation points
- **Path Validation**: 
  - Edges must chain together (endpoint of one = startpoint of next)
  - Edges cannot cross each other
  - No loops allowed (cannot return to a point already in the path)
- **JSON Import/Export**: Import paths from JSON and copy current path as JSON
- **Controls**: Remove last edge, clear all, and toggle JSON panel

## Edge Directions

- **North**: West → East (left to right at top)
- **East**: South → North (bottom to top at right)  
- **South**: East → West (right to left at bottom)
- **West**: North → South (top to bottom at left)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

This project is configured for Netlify deployment. Simply connect your repository to Netlify and it will automatically build and deploy.
