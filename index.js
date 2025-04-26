/**
 * SigmaSelectionTool - A reusable rectangular selection tool for Sigma.js
 * 
 * This module provides a selection mechanism for Sigma.js graphs that allows users to:
 * - Shift+drag to create a selection rectangle
 * - Select nodes that intersect with the selection rectangle
 * - Customize selection appearance and behavior
 * 
 * @version 1.0.0
 */

/**
 * Check collision between a circle and rectangle
 * @param {Object} circle - Circle with x, y, r properties
 * @param {Object} rect - Rectangle with x, y, w, h properties
 * @returns {boolean} - True if the circle and rectangle collide
 */
function checkCollision(circle, rect) {
  var distX = Math.abs(circle.x - rect.x - rect.w / 2);
  var distY = Math.abs(circle.y - rect.y - rect.h / 2);
  
  if (distX > rect.w / 2 + circle.r) return false;
  if (distY > rect.h / 2 + circle.r) return false;
  if (distX <= rect.w / 2) return true;
  if (distY <= rect.h / 2) return true;
  
  var dx = distX - rect.w / 2;
  var dy = distY - rect.h / 2;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * Default settings for the selection tool
 */
const DEFAULT_SETTINGS = {
  // General settings
  debug: false,                       // Enable debug mode with verbose logging
  modifierKey: 'shift',               // Modifier key to start selection: 'shift', 'ctrl', 'alt' or null for any click
  
  // Appearance settings
  zIndex: 1000,                       // z-index of the selection rectangle
  borderStyle: '1px dashed gray',     // CSS border style of the selection rectangle
  background: 'rgba(155, 155, 255, 0.1)', // CSS background of the selection rectangle
  
  // Selection behavior
  selectOnlyComplete: false,          // If true, only select nodes completely inside the selection
  nodeSizeMultiplier: 2,              // Multiply node size by this value for collision detection
  selectOnRelease: true,              // If true, only select nodes when the mouse is released
  
  // Performance settings
  performanceMode: true,              // Enable performance optimizations for large graphs
  throttleUpdates: 0,                 // Throttle selection updates in ms (0 to disable)
  
  // Callbacks
  onSelectionStart: null,             // Called when selection starts (data) => void
  onSelectionChange: null,            // Called during selection (data) => void
  onSelectionComplete: null,          // Called when selection completes (nodes) => void
};

/**
 * Add selection tool functionality to a Sigma.js renderer
 * 
 * @param {Object} renderer - Sigma.js renderer instance
 * @param {Object} [customSettings] - Custom settings to override defaults
 * @returns {Function} - A cleanup function to remove selection tool
 */
function SigmaSelectionTool(renderer, customSettings = {}) {
  // Merge default and custom settings
  const settings = { ...DEFAULT_SETTINGS, ...customSettings };
  
  // Get required references from renderer
  const camera = renderer.getCamera();
  const mouse = renderer.getMouseCaptor();
  const graph = renderer.getGraph();
  const container = renderer.getContainer();
  
  // Ensure container has relative positioning
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  
  // Create selection state
  const state = {
    isSelecting: false,
    viewportStart: { x: 0, y: 0 },
    viewportCurrent: { x: 0, y: 0 },
    graphStart: { x: 0, y: 0 },
    graphCurrent: { x: 0, y: 0 },
    lastUpdateTime: 0
  };

  // Create selection rectangle element
  const selectionDiv = document.createElement('div');
  selectionDiv.style.display = 'none';
  selectionDiv.style.position = 'absolute';
  selectionDiv.style.pointerEvents = 'none';
  selectionDiv.style.zIndex = settings.zIndex;
  selectionDiv.style.border = settings.borderStyle;
  selectionDiv.style.background = settings.background;
  selectionDiv.classList.add('sigma-selection-rectangle');
  container.appendChild(selectionDiv);

  /**
   * Get the selection rectangle in viewport (screen) coordinates
   */
  function getViewportRectangle() {
    const x1 = state.viewportStart.x;
    const y1 = state.viewportStart.y;
    const x2 = state.viewportCurrent.x;
    const y2 = state.viewportCurrent.y;
    
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  /**
   * Get the selection rectangle in graph coordinates
   */
  function getGraphRectangle() {
    const x1 = state.graphStart.x;
    const y1 = state.graphStart.y;
    const x2 = state.graphCurrent.x;
    const y2 = state.graphCurrent.y;
    
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  /**
   * Update the position and size of the selection rectangle
   */
  function updateSelectionDiv() {
    const rect = getViewportRectangle();
    
    // Ensure the rectangle has a minimum size
    const minSize = 2;
    if (rect.width < minSize) rect.width = minSize;
    if (rect.height < minSize) rect.height = minSize;
    
    // Update selection div position and size
    selectionDiv.style.left = rect.x + 'px';
    selectionDiv.style.top = rect.y + 'px';
    selectionDiv.style.width = rect.width + 'px';
    selectionDiv.style.height = rect.height + 'px';
    
    // Debug logging
    if (settings.debug) {
      console.log('Selection rectangle:', {
        viewport: rect,
        graph: getGraphRectangle()
      });
    }
    
    // Call onSelectionChange callback if provided
    if (typeof settings.onSelectionChange === 'function') {
      settings.onSelectionChange({
        viewport: rect,
        graph: getGraphRectangle(),
        state: { ...state }
      });
    }
  }

  /**
   * Check if the selection should start based on the modifier key setting
   */
  function shouldStartSelection(event) {
    if (!settings.modifierKey) return true;
    
    const original = event.original || event;
    
    switch (settings.modifierKey.toLowerCase()) {
      case 'shift': return original.shiftKey;
      case 'ctrl': return original.ctrlKey || original.metaKey;
      case 'alt': return original.altKey;
      default: return true;
    }
  }

  /**
   * Handle mouse down event to start selection
   */
  function handleMouseDown({ event }) {
    if (!shouldStartSelection(event)) return;
    
    // Disable camera panning during selection
    camera.disable();
    
    // Get viewport (screen) coordinates
    state.viewportStart = { x: event.x, y: event.y };
    state.viewportCurrent = { x: event.x, y: event.y };
    
    // Convert to graph coordinates
    state.graphStart = renderer.viewportToGraph(state.viewportStart);
    state.graphCurrent = renderer.viewportToGraph(state.viewportCurrent);
    
    // Start selection
    state.isSelecting = true;
    selectionDiv.style.display = 'block';
    updateSelectionDiv();
    
    // Call onSelectionStart callback if provided
    if (typeof settings.onSelectionStart === 'function') {
      settings.onSelectionStart({
        viewport: state.viewportStart,
        graph: state.graphStart
      });
    }
    
    if (settings.debug) {
      console.log('Selection started:', {
        viewport: state.viewportStart,
        graph: state.graphStart
      });
    }
  }

  /**
   * Handle mouse move event to update selection
   */
  function handleMouseMove(e) {
    if (!state.isSelecting) return;
    
    // Throttle updates if specified
    if (settings.throttleUpdates > 0) {
      const now = Date.now();
      if (now - state.lastUpdateTime < settings.throttleUpdates) {
        return;
      }
      state.lastUpdateTime = now;
    }
    
    // Extract coordinates from the event
    let x, y;
    
    if (e.x !== undefined && e.y !== undefined) {
      x = e.x;
      y = e.y;
    } else if (e.event && e.event.x !== undefined && e.event.y !== undefined) {
      x = e.event.x;
      y = e.event.y;
    } else if (e.original || (e.event && e.event.original)) {
      const original = e.original || (e.event && e.event.original);
      const containerRect = container.getBoundingClientRect();
      x = original.clientX - containerRect.left;
      y = original.clientY - containerRect.top;
    } else {
      return;
    }
    
    // Update viewport coordinates
    state.viewportCurrent = { x, y };
    
    // Update graph coordinates
    state.graphCurrent = renderer.viewportToGraph(state.viewportCurrent);
    
    // Update the selection rectangle
    updateSelectionDiv();
    
    // If selectOnRelease is false, select nodes during drag
    if (settings.selectOnRelease === false) {
      selectNodesInRectangle();
    }
  }

  /**
   * Handle mouse up event to finalize selection
   */
  function handleMouseUp() {
    if (!state.isSelecting) return;
    
    // Enable camera again
    camera.enable();
    
    // Hide selection rectangle
    state.isSelecting = false;
    selectionDiv.style.display = 'none';
    
    // Select nodes in the rectangle
    if (settings.selectOnRelease) {
      selectNodesInRectangle();
    }
  }
  
  /**
   * Select nodes within the current selection rectangle
   */
  function selectNodesInRectangle() {
    const graphRect = getGraphRectangle();
    const selectedNodes = [];
    
    // Skip if rectangle is too small
    if (graphRect.width < 0.0001 && graphRect.height < 0.0001) {
      return;
    }
    
    if (settings.debug) {
      console.log('Final selection rectangle:', {
        viewport: getViewportRectangle(),
        graph: graphRect
      });
    }
    
    // Prepare rectangle for collision detection
    const rect = {
      x: graphRect.x,
      y: graphRect.y,
      w: graphRect.width,
      h: graphRect.height
    };
    
    // Broad-phase filter function for performance
    const nodeInSelectionBounds = (nodeId, attributes) => {
      if (!attributes.x || !attributes.y || isNaN(attributes.x) || isNaN(attributes.y)) {
        return false;
      }
      
      const margin = (attributes.size || 5) * settings.nodeSizeMultiplier;
      
      // Quick boundary check
      if (attributes.x < graphRect.x - margin || 
          attributes.x > graphRect.x + graphRect.width + margin ||
          attributes.y < graphRect.y - margin || 
          attributes.y > graphRect.y + graphRect.height + margin) {
        return false;
      }
      
      return true;
    };
    
    // Process nodes
    graph.forEachNode((nodeId, attributes) => {
      try {
        // Skip nodes definitely outside selection (performance optimization)
        if (settings.performanceMode && !nodeInSelectionBounds(nodeId, attributes)) {
          return;
        }
        
        // Node position
        const nodePos = { x: attributes.x, y: attributes.y };
        
        // Get node size (possibly adjusted)
        const nodeSize = (attributes.size || 5) * settings.nodeSizeMultiplier;
        
        // Circle for collision detection
        const circle = { 
          x: nodePos.x, 
          y: nodePos.y, 
          r: nodeSize 
        };
        
        // Check if center is in rectangle (faster check)
        const centerInRect = 
          nodePos.x >= graphRect.x && 
          nodePos.x <= graphRect.x + graphRect.width &&
          nodePos.y >= graphRect.y && 
          nodePos.y <= graphRect.y + graphRect.height;
        
        // Determine if node is selected
        let nodeSelected;
        
        if (settings.selectOnlyComplete) {
          // Only select nodes completely inside the rectangle
          const nodeRadius = circle.r;
          nodeSelected = 
            nodePos.x - nodeRadius >= graphRect.x &&
            nodePos.x + nodeRadius <= graphRect.x + graphRect.width &&
            nodePos.y - nodeRadius >= graphRect.y &&
            nodePos.y + nodeRadius <= graphRect.y + graphRect.height;
        } else {
          // Select nodes that intersect with the rectangle
          nodeSelected = centerInRect || checkCollision(circle, rect);
        }
        
        if (nodeSelected) {
          selectedNodes.push(nodeId);
          
          if (settings.debug) {
            console.log(`Node ${nodeId} selected at (${nodePos.x.toFixed(2)}, ${nodePos.y.toFixed(2)})`);
          }
        }
      } catch (e) {
        console.error(`Error processing node ${nodeId}:`, e);
      }
    });
    
    if (settings.debug) {
      console.log(`Selected ${selectedNodes.length} nodes`);
    }
    
    // Call onSelectionComplete callback if provided
    if (typeof settings.onSelectionComplete === 'function') {
      settings.onSelectionComplete(selectedNodes);
    }
    
    // Emit selection event
    renderer.emit('selectNodes', { nodes: selectedNodes });
  }

  // Register event listeners
  renderer.on('downStage', handleMouseDown);
  renderer.on('downNode', handleMouseDown);
  mouse.on('mousemove', handleMouseMove);
  mouse.on('mouseup', handleMouseUp);

  // Create cleanup function
  function cleanup() {
    container.removeChild(selectionDiv);
    renderer.removeListener('downStage', handleMouseDown);
    renderer.removeListener('downNode', handleMouseDown);
    mouse.removeListener('mousemove', handleMouseMove);
    mouse.removeListener('mouseup', handleMouseUp);
    
    if (settings.debug) {
      console.log('SigmaSelectionTool: Cleanup complete');
    }
  }

  // Clean up when renderer is killed
  renderer.on('kill', cleanup);
  
  if (settings.debug) {
    console.log('SigmaSelectionTool: Initialized with settings', settings);
  }
  
  // Return the cleanup function
  return cleanup;
}

export default SigmaSelectionTool;