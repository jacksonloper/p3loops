# P3 Loops Path Editor

A React/Vite web application for creating and managing non-crossing paths on a 120/60/120/60 rhombus with edge identifications. View live at https://main--p3loops.netlify.app/

## Features

- **Rhombus Visualization**: An SVG-based 120°/60° rhombus with straight sides and curved edges rendered using a diffeomorphism. This mathematically guarantees that edges are non-intersecting by construction - straight chords in a disk are mapped to curved paths in the rhombus while preserving non-intersection.
- **Edge Identifications**: 
  - North ≡ East (a point at t% along North is the same as t% along East)
  - South ≡ West (a point at t% along South is the same as t% along West)
- **Combinatorial Path Creation**: 
  - Select segments to add edges by clicking on the rhombus or using radio buttons
  - All edges go from side to side (including same-side edges)
  - Points are ordered by integer positions, evenly distributed for visualization
- **Path Validation**: 
  - Edges must chain together (endpoint of one = startpoint of next)
  - Edges cannot cross each other
  - Real-time filtering of valid segments that won't cause crossings
- **Advanced Features**:
  - 3D Viewer: Render paths on puffed 3D triangles with animated bead
  - Wallpaper Viewer: View paths as P3 wallpaper patterns
  - Move Tree: Explore possible move sequences
  - Edge List: View combinatorial edge details
- **JSON Import/Export**: Import paths from JSON and copy current path as JSON

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

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Deployment

This project is configured for Netlify deployment. Simply connect your repository to Netlify and it will automatically build and deploy.
