import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getPointPaperCoordinates } from '../utils/geometry.js';
import { interpolateEdge3D, getFlatTriangleVertices, getDirectionAtPoint } from '../utils/geometry3d.js';
import './ThreeDViewer.css';

// Scale factor for the black triangle (80% of original size)
const TRIANGLE_SCALE = 0.8;

/**
 * ThreeDViewer component - renders the path on puffed 3D triangles.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onClose - Callback to close the 3D viewer
 */
function ThreeDViewer({ edges, onClose }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const beadRef = useRef(null);
  const pathPointsRef = useRef([]);
  const beadProgressRef = useRef(0);
  const speedRef = useRef(0.5);
  const [speed, setSpeed] = useState(0.5);
  
  // Update speed ref when state changes
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);
    
    // Create flat black triangle base (scaled to 80% of original size)
    const triangleVertices = getFlatTriangleVertices();
    const triangleGeometry = new THREE.BufferGeometry();
    const trianglePositions = new Float32Array([
      triangleVertices[0].x * TRIANGLE_SCALE, triangleVertices[0].y * TRIANGLE_SCALE, triangleVertices[0].z,
      triangleVertices[1].x * TRIANGLE_SCALE, triangleVertices[1].y * TRIANGLE_SCALE, triangleVertices[1].z,
      triangleVertices[2].x * TRIANGLE_SCALE, triangleVertices[2].y * TRIANGLE_SCALE, triangleVertices[2].z
    ]);
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(trianglePositions, 3));
    triangleGeometry.computeVertexNormals();
    
    const triangleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x222222,
      side: THREE.DoubleSide
    });
    const triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    scene.add(triangleMesh);
    
    // Add wireframe edges to the triangle
    const edgesGeometry = new THREE.EdgesGeometry(triangleGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4a90d9 });
    const wireframe = new THREE.LineSegments(edgesGeometry, lineMaterial);
    scene.add(wireframe);
    
    // Create the path
    if (edges && edges.length > 0) {
      const pathPoints = [];
      const conePositions = [];
      
      for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
        const edge = edges[edgeIndex];
        const from = getPointPaperCoordinates(edge.from);
        const to = getPointPaperCoordinates(edge.to);
        
        // Interpolate edge into 10 points
        const interpolatedPoints = interpolateEdge3D(from, to, 10);
        
        // Add points (avoiding duplicates at edge junctions)
        const startIdx = (edgeIndex === 0) ? 0 : 1;
        for (let i = startIdx; i < interpolatedPoints.length; i++) {
          pathPoints.push(interpolatedPoints[i]);
        }
        
        // Add cone position at midpoint of each original edge
        const midIndex = Math.floor(interpolatedPoints.length / 2);
        const midPoint = interpolatedPoints[midIndex];
        const direction = getDirectionAtPoint(interpolatedPoints, midIndex);
        conePositions.push({ position: midPoint, direction });
      }
      
      // Create path line
      if (pathPoints.length > 1) {
        const pathGeometry = new THREE.BufferGeometry();
        const pathPositions = new Float32Array(pathPoints.length * 3);
        
        for (let i = 0; i < pathPoints.length; i++) {
          pathPositions[i * 3] = pathPoints[i].x;
          pathPositions[i * 3 + 1] = pathPoints[i].y;
          pathPositions[i * 3 + 2] = pathPoints[i].z;
        }
        
        pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
        
        const pathMaterial = new THREE.LineBasicMaterial({ 
          color: 0xe94560,
          linewidth: 2
        });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        scene.add(pathLine);
        
        // Add spheres at path vertices
        const sphereGeometry = new THREE.SphereGeometry(0.015, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xe94560 });
        
        // Add sphere at start and end of path
        const startSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        startSphere.position.set(pathPoints[0].x, pathPoints[0].y, pathPoints[0].z);
        scene.add(startSphere);
        
        const endSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        endSphere.position.set(
          pathPoints[pathPoints.length - 1].x,
          pathPoints[pathPoints.length - 1].y,
          pathPoints[pathPoints.length - 1].z
        );
        scene.add(endSphere);
        
        // Store path points for bead animation
        pathPointsRef.current = pathPoints;
        
        // Create the animated bead
        const beadGeometry = new THREE.SphereGeometry(0.04, 24, 24);
        const beadMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x00ffff,
          emissive: 0x005555,
          shininess: 100
        });
        const bead = new THREE.Mesh(beadGeometry, beadMaterial);
        bead.position.set(pathPoints[0].x, pathPoints[0].y, pathPoints[0].z);
        scene.add(bead);
        beadRef.current = bead;
        beadProgressRef.current = 0;
      }
      
      // Create direction cones
      const coneGeometry = new THREE.ConeGeometry(0.03, 0.08, 8);
      const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      
      for (const { position, direction } of conePositions) {
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(position.x, position.y, position.z);
        
        // Orient cone to point in the direction of travel
        // Default cone points in +Y direction
        const up = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
        
        // Create quaternion to rotate from up to direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, dir);
        cone.setRotationFromQuaternion(quaternion);
        
        scene.add(cone);
      }
    }
    
    // Animation loop
    let lastTime = performance.now();
    
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      // Animate the bead along the path
      const pathPoints = pathPointsRef.current;
      if (beadRef.current && pathPoints.length > 1) {
        // Speed is in "path lengths per second" (0.05 = 20 seconds for full path, 2 = 0.5 seconds)
        const progress = beadProgressRef.current + deltaTime * speedRef.current;
        
        // Loop back to beginning when reaching end
        beadProgressRef.current = progress % 1;
        
        // Calculate position along path
        const totalSegments = pathPoints.length - 1;
        const exactIndex = beadProgressRef.current * totalSegments;
        const index = Math.floor(exactIndex);
        const t = exactIndex - index;
        
        // Clamp to valid range
        const i = Math.min(index, totalSegments - 1);
        const p1 = pathPoints[i];
        const p2 = pathPoints[i + 1];
        
        // Interpolate between points
        const x = p1.x + t * (p2.x - p1.x);
        const y = p1.y + t * (p2.y - p1.y);
        const z = p1.z + t * (p2.z - p1.z);
        
        beadRef.current.position.set(x, y, z);
      }
      
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    
    // Handle window resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, [edges]);
  
  return (
    <div className="three-d-viewer-overlay">
      <div className="three-d-viewer-container">
        <div className="three-d-viewer-header">
          <h2>3D Path View</h2>
          <button onClick={onClose} className="three-d-close-btn">×</button>
        </div>
        <div className="three-d-canvas-container" ref={containerRef}></div>
        <div className="three-d-controls">
          <label className="speed-control">
            <span>Bead Speed:</span>
            <input 
              type="range" 
              min="0.05" 
              max="2" 
              step="0.05" 
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            />
            <span className="speed-value">{speed.toFixed(2)}x</span>
          </label>
        </div>
        <div className="three-d-instructions">
          <p>Drag to rotate • Scroll to zoom • Bead travels along path</p>
        </div>
      </div>
    </div>
  );
}

export default ThreeDViewer;
