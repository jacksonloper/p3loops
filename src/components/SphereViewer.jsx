import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { subdivideEdgeOnSphere, getEdgeMidpointAndDirection, unitSquareToLatLon } from '../utils/sphereGeometry.js';
import { getPointPaperCoordinates } from '../utils/geometry.js';
import './SphereViewer.css';

const SPHERE_RADIUS = 1;
const INNER_SPHERE_RADIUS = SPHERE_RADIUS / 2;
const SUBDIVISIONS = 10;

/**
 * SphereViewer component - renders the path on a 3D sphere using Three.js
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onClose - Callback when close button is clicked
 */
function SphereViewer({ edges, onClose }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationIdRef = useRef(null);
  const clickablePointsRef = useRef([]);
  const [selectedPoint, setSelectedPoint] = useState(null);

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
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(2.5, 1.5, 2.5);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Add a second directional light from the opposite side
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, -3, -5);
    scene.add(directionalLight2);

    // Create outer sphere (wireframe for reference)
    const outerSphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
    const outerSphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90d9,
      transparent: true,
      opacity: 0.15,
      wireframe: true
    });
    const outerSphere = new THREE.Mesh(outerSphereGeometry, outerSphereMaterial);
    scene.add(outerSphere);

    // Create inner black sphere (half radius, solid)
    const innerSphereGeometry = new THREE.SphereGeometry(INNER_SPHERE_RADIUS, 32, 32);
    const innerSphereMaterial = new THREE.MeshLambertMaterial({
      color: 0x000000
    });
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerSphereMaterial);
    scene.add(innerSphere);

    // Create path lines
    const pathGroup = new THREE.Group();
    scene.add(pathGroup);

    // Store clickable points for lat/lon lookup
    const clickablePoints = [];

    // Add edges as line segments
    edges.forEach((edge, edgeIndex) => {
      const fromPaper = getPointPaperCoordinates(edge.from);
      const toPaper = getPointPaperCoordinates(edge.to);
      const points = subdivideEdgeOnSphere(edge, SUBDIVISIONS, SPHERE_RADIUS);
      
      // Create line geometry from subdivided points
      const linePoints = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      
      // Create line material (red color like the 2D version)
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xe94560,
        linewidth: 2
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      pathGroup.add(line);

      // Add small clickable spheres at each subdivision point
      for (let i = 0; i <= SUBDIVISIONS; i++) {
        const t = i / SUBDIVISIONS;
        
        // Interpolate paper coordinates
        const southward = fromPaper.southward + t * (toPaper.southward - fromPaper.southward);
        const eastward = fromPaper.eastward + t * (toPaper.eastward - fromPaper.eastward);
        
        // Get lat/lon for this point
        const { latitude, longitude } = unitSquareToLatLon(southward, eastward);
        
        // Create small sphere marker (slightly larger for easier clicking)
        const markerGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffaa00,
          transparent: true,
          opacity: 0.7
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(points[i].x, points[i].y, points[i].z);
        
        // Store lat/lon data on the marker
        marker.userData = {
          edgeIndex,
          pointIndex: i,
          southward,
          eastward,
          latitude,
          longitude
        };
        
        pathGroup.add(marker);
        clickablePoints.push(marker);
      }

      // Add direction cone at midpoint of each edge
      const { position, direction } = getEdgeMidpointAndDirection(edge, SPHERE_RADIUS);
      
      // Create cone geometry (pointing in direction of flow)
      const coneRadius = 0.03;
      const coneHeight = 0.08;
      const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
      const coneMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      
      // Position the cone at the midpoint, slightly above the sphere surface
      const offset = 0.01; // Small offset to prevent z-fighting
      cone.position.set(
        position.x * (1 + offset),
        position.y * (1 + offset),
        position.z * (1 + offset)
      );
      
      // Orient the cone to point in the direction of travel
      // Default cone points up along +Y axis, we need to rotate it to point along direction
      const defaultUp = new THREE.Vector3(0, 1, 0);
      const targetDirection = new THREE.Vector3(direction.x, direction.y, direction.z);
      
      // Calculate the quaternion to rotate from default up to target direction
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(defaultUp, targetDirection.normalize());
      cone.setRotationFromQuaternion(quaternion);
      
      pathGroup.add(cone);
    });

    // Store clickable points ref for click handling
    clickablePointsRef.current = clickablePoints;

    // Add endpoint markers (spheres at start and end of path)
    if (edges.length > 0) {
      const startPoint = subdivideEdgeOnSphere(edges[0], 1, SPHERE_RADIUS)[0];
      const endPoint = subdivideEdgeOnSphere(edges[edges.length - 1], 1, SPHERE_RADIUS)[1];
      
      // Start point (green)
      const startMarkerGeometry = new THREE.SphereGeometry(0.04, 16, 16);
      const startMarkerMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
      const startMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
      startMarker.position.set(startPoint.x, startPoint.y, startPoint.z);
      pathGroup.add(startMarker);
      
      // End point (yellow)
      const endMarkerGeometry = new THREE.SphereGeometry(0.04, 16, 16);
      const endMarkerMaterial = new THREE.MeshLambertMaterial({ color: 0xffc107 });
      const endMarker = new THREE.Mesh(endMarkerGeometry, endMarkerMaterial);
      endMarker.position.set(endPoint.x, endPoint.y, endPoint.z);
      pathGroup.add(endMarker);
    }

    // Animation loop
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    function handleResize() {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    // Handle click for lat/lon lookup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    function handleClick(event) {
      if (!containerRef.current || !cameraRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, cameraRef.current);
      
      const intersects = raycaster.intersectObjects(clickablePointsRef.current);
      
      if (intersects.length > 0) {
        const clicked = intersects[0].object;
        if (clicked.userData && clicked.userData.latitude !== undefined) {
          setSelectedPoint(clicked.userData);
        }
      } else {
        setSelectedPoint(null);
      }
    }
    
    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      // Dispose geometries and materials
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [edges]);

  return (
    <div className="sphere-viewer-overlay">
      <div className="sphere-viewer-modal">
        <div className="sphere-viewer-header">
          <h2>3D Sphere View</h2>
          <button className="sphere-viewer-close" onClick={onClose}>×</button>
        </div>
        <div className="sphere-viewer-container" ref={containerRef} />
        <div className="sphere-viewer-info">
          <p>
            <span className="legend-item"><span className="legend-dot green" /> Start</span>
            <span className="legend-item"><span className="legend-dot yellow" /> End</span>
            <span className="legend-item"><span className="legend-cone" /> Flow direction</span>
            <span className="legend-item"><span className="legend-dot orange" /> Click for lat/lon</span>
          </p>
          {selectedPoint ? (
            <div className="latlon-info">
              <strong>Selected Point (Edge {selectedPoint.edgeIndex + 1}, Point {selectedPoint.pointIndex}):</strong>
              <br />
              Paper coords: southward={selectedPoint.southward.toFixed(3)}, eastward={selectedPoint.eastward.toFixed(3)}
              <br />
              <strong>Latitude: {selectedPoint.latitude.toFixed(2)}°</strong> | <strong>Longitude: {selectedPoint.longitude.toFixed(2)}°</strong>
            </div>
          ) : (
            <p className="hint">Click on orange markers along path to see lat/lon. Drag to rotate, scroll to zoom.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SphereViewer;
