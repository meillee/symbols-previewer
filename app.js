/**
 * Symbols Previewer
 * Preview how symbols fit inside a reelhouse frame
 */

// ===== State =====
const state = {
  reelhouseImage: null,
  symbolImages: [], // Array of { img: Image, size: number }
  gridSymbols: [], // Current randomized layout (references to symbolImages entries)
  rows: 4,
  cols: 5,
  hPadding: 0, // Horizontal border padding
  vPadding: 0, // Vertical border padding
  xOffset: 0, // Horizontal offset to shift grid
  yOffset: 0, // Vertical offset to shift grid
  hGap: 0,
  vGap: 0,
  symbolSize: 100, // Universal percentage of cell size
  showBounds: true, // Show cell boundary lines (on by default)
};

// ===== DOM Elements =====
const elements = {
  // Dropzones
  reelhouseDropzone: document.getElementById("reelhouse-dropzone"),
  symbolsDropzone: document.getElementById("symbols-dropzone"),
  reelhouseInput: document.getElementById("reelhouse-input"),
  symbolsInput: document.getElementById("symbols-input"),

  // Thumbnails
  reelhouseThumbnail: document.getElementById("reelhouse-thumbnail"),
  symbolsThumbnails: document.getElementById("symbols-thumbnails"),

  // Sliders (for padding, offset, gap, and size controls)
  hPaddingSlider: document.getElementById("h-padding-slider"),
  vPaddingSlider: document.getElementById("v-padding-slider"),
  xOffsetSlider: document.getElementById("x-offset-slider"),
  yOffsetSlider: document.getElementById("y-offset-slider"),
  hGapSlider: document.getElementById("h-gap-slider"),
  vGapSlider: document.getElementById("v-gap-slider"),
  symbolSizeSlider: document.getElementById("symbol-size-slider"),

  // Value inputs
  rowsValue: document.getElementById("rows-value"),
  colsValue: document.getElementById("cols-value"),
  hPaddingValue: document.getElementById("h-padding-value"),
  vPaddingValue: document.getElementById("v-padding-value"),
  xOffsetValue: document.getElementById("x-offset-value"),
  yOffsetValue: document.getElementById("y-offset-value"),
  hGapValue: document.getElementById("h-gap-value"),
  vGapValue: document.getElementById("v-gap-value"),
  symbolSizeValue: document.getElementById("symbol-size-value"),

  // Buttons
  shuffleBtn: document.getElementById("shuffle-btn"),
  resetBtn: document.getElementById("reset-btn"),

  // Checkboxes
  showBoundsCheckbox: document.getElementById("show-bounds"),

  // Info modal
  infoBtn: document.getElementById("info-btn"),
  infoModal: document.getElementById("info-modal"),
  modalClose: document.getElementById("modal-close"),

  // Export buttons
  exportSpritesBtn: document.getElementById("export-sprites-btn"),
  exportConfigBtn: document.getElementById("export-config-btn"),
  exportPreviewBtn: document.getElementById("export-preview-btn"),
  importConfigInput: document.getElementById("import-config-input"),

  // Mega symbols modal
  megaSymbolsBtn: document.getElementById("mega-symbols-btn"),
  megaModal: document.getElementById("mega-modal"),
  megaModalClose: document.getElementById("mega-modal-close"),
  megaModalApply: document.getElementById("mega-modal-apply"),
  megaSymbolsList: document.getElementById("mega-symbols-list"),

  // Canvas
  canvas: document.getElementById("preview-canvas"),
  placeholder: document.getElementById("canvas-placeholder"),
};

const ctx = elements.canvas.getContext("2d");

// ===== Utility Functions =====

/**
 * Load an image from a File object
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.error("Failed to load image:", file.name, err);
      reject(err);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate randomized grid of symbols with mega symbol support
 * Uses bin-packing algorithm for multi-cell symbols
 */
function generateRandomGrid() {
  const { rows, cols } = state;
  const symbols = state.symbolImages;

  if (symbols.length === 0) {
    state.gridSymbols = [];
    return;
  }

  // Create occupancy grid
  const occupied = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));

  // Placements: array of { symbol, anchorCol, anchorRow }
  const placements = [];

  // Sort symbols by shape size (larger first for better packing)
  // But first, ensure each symbol appears at least once
  const shuffledSymbols = shuffle([...symbols]);

  // Sort by shape size descending
  shuffledSymbols.sort((a, b) => b.shape.length - a.shape.length);

  // Place each symbol at least once
  for (const symbol of shuffledSymbols) {
    const position = findValidPosition(occupied, symbol.shape, rows, cols);
    if (position) {
      const [anchorCol, anchorRow] = position;
      placements.push({ symbol, anchorCol, anchorRow });
      markOccupied(occupied, symbol.shape, anchorCol, anchorRow);
    }
  }

  // Fill remaining space with random 1x1 symbols (those that fit)
  const oneByOneSymbols = symbols.filter((s) => s.shape.length === 1);
  if (oneByOneSymbols.length > 0) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!occupied[row][col]) {
          const randomSymbol =
            oneByOneSymbols[Math.floor(Math.random() * oneByOneSymbols.length)];
          placements.push({
            symbol: randomSymbol,
            anchorCol: col,
            anchorRow: row,
          });
          occupied[row][col] = true;
        }
      }
    }
  }

  state.gridSymbols = placements;
}

/**
 * Find a valid position for a shape on the grid
 */
function findValidPosition(occupied, shape, rows, cols) {
  // Try random positions first for variety
  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push([col, row]);
    }
  }
  const shuffledPositions = shuffle(positions);

  for (const [col, row] of shuffledPositions) {
    if (canPlaceShape(occupied, shape, col, row, rows, cols)) {
      return [col, row];
    }
  }
  return null;
}

/**
 * Check if a shape can be placed at a given anchor position
 */
function canPlaceShape(occupied, shape, anchorCol, anchorRow, rows, cols) {
  for (const [dc, dr] of shape) {
    const c = anchorCol + dc;
    const r = anchorRow + dr;
    if (r < 0 || r >= rows || c < 0 || c >= cols || occupied[r][c]) {
      return false;
    }
  }
  return true;
}

/**
 * Mark cells as occupied for a placed shape
 */
function markOccupied(occupied, shape, anchorCol, anchorRow) {
  for (const [dc, dr] of shape) {
    occupied[anchorRow + dr][anchorCol + dc] = true;
  }
}

/**
 * Create a thumbnail element for an image
 */
function createThumbnail(img, onRemove) {
  const container = document.createElement("div");
  container.className = "thumbnail";

  const imgEl = document.createElement("img");
  imgEl.src = img.src;
  container.appendChild(imgEl);

  const removeBtn = document.createElement("button");
  removeBtn.className = "thumbnail-remove";
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`;
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  container.appendChild(removeBtn);

  return container;
}

// ===== Rendering =====

/**
 * Render the preview canvas
 */
function render() {
  const {
    reelhouseImage,
    gridSymbols,
    rows,
    cols,
    hPadding,
    vPadding,
    xOffset,
    yOffset,
    hGap,
    vGap,
    symbolSize,
    showBounds,
  } = state;

  // Always show canvas
  elements.canvas.classList.remove("hidden");
  elements.placeholder.classList.add("hidden");

  // Default canvas size or use reelhouse dimensions
  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  const width = reelhouseImage ? reelhouseImage.naturalWidth : DEFAULT_WIDTH;
  const height = reelhouseImage ? reelhouseImage.naturalHeight : DEFAULT_HEIGHT;
  elements.canvas.width = width;
  elements.canvas.height = height;

  // Draw reelhouse background or placeholder
  if (reelhouseImage) {
    ctx.drawImage(reelhouseImage, 0, 0, width, height);
  } else {
    // Draw placeholder rectangle for reelhouse
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#3a3a5e";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(4, 4, width - 8, height - 8);
    ctx.setLineDash([]);
  }

  // Calculate cell dimensions (accounting for padding)
  const availableWidth = width - hPadding * 2;
  const availableHeight = height - vPadding * 2;
  const totalHGap = (cols - 1) * hGap;
  const totalVGap = (rows - 1) * vGap;
  const cellWidth = (availableWidth - totalHGap) / cols;
  const cellHeight = (availableHeight - totalVGap) / rows;

  // Draw cell bounds if enabled
  if (showBounds) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = hPadding + xOffset + col * (cellWidth + hGap);
        const cellY = vPadding + yOffset + row * (cellHeight + vGap);
        ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellWidth - 1, cellHeight - 1);
      }
    }

    ctx.setLineDash([]); // Reset line dash
  }

  // Draw placeholder rectangles only if no reelhouse AND no symbols loaded
  if (gridSymbols.length === 0) {
    // Only show placeholders when there's no reelhouse (placeholder mode)
    if (!reelhouseImage) {
      ctx.fillStyle = "#2a2a4e";
      ctx.strokeStyle = "#4a4a7e";
      ctx.lineWidth = 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cellX = hPadding + xOffset + col * (cellWidth + hGap);
          const cellY = vPadding + yOffset + row * (cellHeight + vGap);
          const padding = 4;
          ctx.fillRect(
            cellX + padding,
            cellY + padding,
            cellWidth - padding * 2,
            cellHeight - padding * 2
          );
          ctx.strokeRect(
            cellX + padding,
            cellY + padding,
            cellWidth - padding * 2,
            cellHeight - padding * 2
          );
        }
      }
    }
    return;
  }

  // Draw each placed symbol
  for (const placement of gridSymbols) {
    const { symbol, anchorCol, anchorRow } = placement;
    const symbolImg = symbol.img;
    const individualSize = symbol.size;
    const shape = symbol.shape;

    // Calculate bounding box of the shape
    const colOffsets = shape.map(([c, r]) => c);
    const rowOffsets = shape.map(([c, r]) => r);
    const minCol = Math.min(...colOffsets);
    const maxCol = Math.max(...colOffsets);
    const minRow = Math.min(...rowOffsets);
    const maxRow = Math.max(...rowOffsets);
    const shapeWidth = maxCol - minCol + 1;
    const shapeHeight = maxRow - minRow + 1;

    // Calculate pixel bounds for the shape's bounding box
    const startCol = anchorCol + minCol;
    const startRow = anchorRow + minRow;
    const boxX = hPadding + xOffset + startCol * (cellWidth + hGap);
    const boxY = vPadding + yOffset + startRow * (cellHeight + vGap);
    const boxW = shapeWidth * cellWidth + (shapeWidth - 1) * hGap;
    const boxH = shapeHeight * cellHeight + (shapeHeight - 1) * vGap;

    // Calculate symbol size: universal size * individual size
    const symbolAspect = symbolImg.naturalWidth / symbolImg.naturalHeight;
    const boxAspect = boxW / boxH;
    const sizeFactor = (symbolSize / 100) * (individualSize / 100);

    let drawWidth, drawHeight;
    if (symbolAspect > boxAspect) {
      // Symbol is wider than box
      drawWidth = boxW * sizeFactor;
      drawHeight = (boxW / symbolAspect) * sizeFactor;
    } else {
      // Symbol is taller than box
      drawHeight = boxH * sizeFactor;
      drawWidth = boxH * symbolAspect * sizeFactor;
    }

    // Center symbol in bounding box, then apply individual offset
    const individualXOffset = symbol.xOffset || 0;
    const individualYOffset = symbol.yOffset || 0;
    const drawX = boxX + (boxW - drawWidth) / 2 + individualXOffset;
    const drawY = boxY + (boxH - drawHeight) / 2 + individualYOffset;

    ctx.drawImage(symbolImg, drawX, drawY, drawWidth, drawHeight);
  }
}

/**
 * Update thumbnails display for reelhouse
 */
function updateReelhouseThumbnail() {
  elements.reelhouseThumbnail.innerHTML = "";

  if (state.reelhouseImage) {
    const thumb = createThumbnail(state.reelhouseImage, () => {
      state.reelhouseImage = null;
      updateReelhouseThumbnail();
      elements.reelhouseDropzone.classList.remove("has-file");
      render();
    });
    elements.reelhouseThumbnail.appendChild(thumb);
  }
}

/**
 * Update thumbnails display for symbols
 */
function updateSymbolsThumbnails() {
  elements.symbolsThumbnails.innerHTML = "";

  state.symbolImages.forEach((symbolObj, index) => {
    const thumb = createSymbolThumbnail(symbolObj, index, () => {
      state.symbolImages.splice(index, 1);
      updateSymbolsThumbnails();
      if (state.symbolImages.length === 0) {
        elements.symbolsDropzone.classList.remove("has-file");
      }
      generateRandomGrid();
      render();
    });
    elements.symbolsThumbnails.appendChild(thumb);
  });
}

/**
 * Create a thumbnail element for a symbol with size and offset controls
 */
function createSymbolThumbnail(symbolObj, index, onRemove) {
  const container = document.createElement("div");
  container.className = "symbol-thumbnail";

  // Helper to check if symbol has custom settings
  const hasCustomSettings = () => {
    const s = state.symbolImages[index];
    return s.size !== 100 || s.xOffset !== 0 || s.yOffset !== 0;
  };

  // Add modified class if any setting differs from default
  if (hasCustomSettings()) {
    container.classList.add("modified");
  }

  const imgEl = document.createElement("img");
  imgEl.src = symbolObj.img.src;
  container.appendChild(imgEl);

  const removeBtn = document.createElement("button");
  removeBtn.className = "thumbnail-remove";
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12"/>
  </svg>`;
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  container.appendChild(removeBtn);

  // Controls container
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "symbol-controls";

  // Size input row
  const sizeRow = document.createElement("div");
  sizeRow.className = "symbol-control-row";

  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.className = "symbol-input";
  sizeInput.value = symbolObj.size;
  sizeInput.min = "0";
  sizeInput.title = "Scale %";

  // Setup size input with unified handler
  setupNumberInput(
    sizeInput,
    100, // default size
    (value) => {
      if (value === null) return; // Intermediate state, don't update

      if (value >= 0) {
        state.symbolImages[index].size = value;
        updateModifiedClass();
        render();
      }
    },
    { min: 0, allowNegative: false }
  );

  const sizeLabel = document.createElement("span");
  sizeLabel.className = "symbol-input-label";
  sizeLabel.textContent = "%";

  sizeRow.appendChild(sizeInput);
  sizeRow.appendChild(sizeLabel);

  // Offset inputs row
  const offsetRow = document.createElement("div");
  offsetRow.className = "symbol-control-row";

  const xOffsetInput = document.createElement("input");
  xOffsetInput.type = "number";
  xOffsetInput.className = "symbol-input symbol-input-offset";
  xOffsetInput.value = symbolObj.xOffset || 0;
  xOffsetInput.title = "X Offset";

  // Setup X offset input with unified handler
  setupNumberInput(
    xOffsetInput,
    0, // default X offset
    (value) => {
      if (value === null) return; // Intermediate state, don't update

      state.symbolImages[index].xOffset = value;
      updateModifiedClass();
      render();
    },
    { allowNegative: true }
  );

  const xLabel = document.createElement("span");
  xLabel.className = "symbol-input-label symbol-input-label-small";
  xLabel.textContent = "X";

  const yOffsetInput = document.createElement("input");
  yOffsetInput.type = "number";
  yOffsetInput.className = "symbol-input symbol-input-offset";
  yOffsetInput.value = symbolObj.yOffset || 0;
  yOffsetInput.title = "Y Offset";

  // Setup Y offset input with unified handler
  setupNumberInput(
    yOffsetInput,
    0, // default Y offset
    (value) => {
      if (value === null) return; // Intermediate state, don't update

      state.symbolImages[index].yOffset = value;
      updateModifiedClass();
      render();
    },
    { allowNegative: true }
  );

  const yLabel = document.createElement("span");
  yLabel.className = "symbol-input-label symbol-input-label-small";
  yLabel.textContent = "Y";

  offsetRow.appendChild(xLabel);
  offsetRow.appendChild(xOffsetInput);
  offsetRow.appendChild(yLabel);
  offsetRow.appendChild(yOffsetInput);

  controlsContainer.appendChild(sizeRow);
  controlsContainer.appendChild(offsetRow);
  container.appendChild(controlsContainer);

  // Helper to update modified class
  function updateModifiedClass() {
    if (hasCustomSettings()) {
      container.classList.add("modified");
    } else {
      container.classList.remove("modified");
    }
  }

  return container;
}

// ===== Event Handlers =====

/**
 * Handle reelhouse file(s)
 */
async function handleReelhouseFiles(files) {
  if (files.length === 0) return;

  try {
    state.reelhouseImage = await loadImage(files[0]);
    elements.reelhouseDropzone.classList.add("has-file");
    updateReelhouseThumbnail();
    render();
  } catch (err) {
    console.error("Failed to load reelhouse image:", err);
  }
}

/**
 * Handle symbol files
 */
async function handleSymbolFiles(files) {
  if (files.length === 0) return;

  try {
    const fileArray = Array.from(files);
    const newImages = await Promise.all(
      fileArray.map((file) => loadImage(file))
    );
    // Wrap each image in an object with individual size, offsets, filename, and default shape
    const symbolObjects = newImages.map((img, i) => {
      // Get filename without extension
      const fullName = fileArray[i].name;
      const name = fullName.replace(/\.[^/.]+$/, "");
      return { img, size: 100, xOffset: 0, yOffset: 0, name, shape: [[0, 0]] }; // Default 1x1 shape
    });
    state.symbolImages.push(...symbolObjects);
    elements.symbolsDropzone.classList.add("has-file");
    updateSymbolsThumbnails();
    generateRandomGrid();
    render();
  } catch (err) {
    console.error("Failed to load symbol images:", err);
  }
}

/**
 * Setup dropzone event handlers
 */
function setupDropzone(dropzone, input, handler) {
  // Click to browse
  dropzone.addEventListener("click", () => input.click());

  // File input change
  input.addEventListener("change", (e) => {
    handler(e.target.files);
    input.value = ""; // Reset for same file selection
  });

  // Drag and drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");

    // Accept PNG files by type or extension (some browsers report different MIME types)
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.type === "image/png" ||
        f.type.startsWith("image/") ||
        f.name.toLowerCase().endsWith(".png")
    );
    handler(files);
  });
}

/**
 * Setup number input with proper handling for negative numbers and empty values
 * @param {HTMLInputElement} input - The input element
 * @param {number} defaultValue - The default value to use when input is empty
 * @param {Function} onChange - Callback when value changes (receives the normalized value)
 * @param {Object} options - Optional configuration
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {boolean} options.allowNegative - Whether negative values are allowed (default: true)
 */
function setupNumberInput(input, defaultValue, onChange, options = {}) {
  const { min = null, max = null, allowNegative = true } = options;

  // Store the default value on the input element for blur handler
  input.dataset.defaultValue = defaultValue;

  // For inputs that allow negatives, change type to "text" with inputmode="numeric"
  // This gives us full control while still showing numeric keyboard on mobile
  if (allowNegative && input.type === "number") {
    input.type = "text";
    input.inputMode = "numeric";
    input.pattern = "-?[0-9]*"; // Allow optional minus sign and digits
  }

  // Track previous value for validation
  let previousValue = input.value;

  // When input is focused and has value "0", select it so user can easily replace with "-"
  if (allowNegative) {
    input.addEventListener("focus", () => {
      if (input.value === "0") {
        setTimeout(() => input.select(), 0);
      }
    });
  }

  // Handle input to normalize and validate value
  input.addEventListener("input", () => {
    let value = input.value;

    // Allow intermediate states like "-" or empty - don't process yet
    if (value === "" || value === "-") {
      previousValue = value;
      if (value === "") {
        onChange(null);
      }
      return;
    }

    // Filter invalid characters for text inputs (only digits and minus at start)
    if (input.type === "text") {
      const filtered = value.replace(/[^0-9-]/g, "");
      // Ensure minus sign only appears at the start
      if (filtered.includes("-")) {
        const minusIndex = filtered.indexOf("-");
        value = minusIndex === 0 ? filtered : filtered.replace(/-/g, "");
      } else {
        value = filtered;
      }

      if (value !== input.value) {
        input.value = value;
      }
    }

    // Remove leading zeros (except for "-0")
    if (value.length > 1 && value.startsWith("0") && value[1] !== ".") {
      value = value.replace(/^0+/, "");
      if (value === "" || value === "-") {
        input.value = value;
        previousValue = value;
        onChange(value === "-" ? 0 : null);
        return;
      }
    }
    if (value.length > 2 && value.startsWith("-0") && value[2] !== ".") {
      value = value.replace(/^-0+/, "-");
      if (value === "-") {
        input.value = value;
        previousValue = value;
        onChange(0);
        return;
      }
    }

    // Parse and validate number
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Apply min/max constraints
      let constrainedValue = numValue;
      if (min !== null && constrainedValue < min) {
        constrainedValue = min;
        input.value = constrainedValue;
      } else if (max !== null && constrainedValue > max) {
        constrainedValue = max;
        input.value = constrainedValue;
      } else if (input.type === "text") {
        // Keep user's input format for text inputs
        input.value = value;
      }
      previousValue = input.value;
      onChange(constrainedValue);
    } else if (value !== "" && value !== "-") {
      // Invalid input, revert to previous value
      input.value = previousValue;
    }
  });

  // Handle blur to reset empty values to default
  input.addEventListener("blur", () => {
    const value = input.value.trim();

    // If empty or just "-", reset to default
    if (value === "" || value === "-") {
      input.value = defaultValue;
      onChange(defaultValue);
      return;
    }

    // Normalize the value (remove leading zeros, ensure it's a valid number)
    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      input.value = defaultValue;
      onChange(defaultValue);
      return;
    }

    // Apply constraints
    if (min !== null && numValue < min) {
      numValue = min;
    } else if (max !== null && numValue > max) {
      numValue = max;
    }

    input.value = numValue;
    onChange(numValue);
  });
}

/**
 * Setup slider and number input event handlers (bidirectional sync)
 */
function setupSlider(slider, valueInput, stateKey) {
  // Determine default value based on stateKey
  const defaults = {
    rows: 4,
    cols: 5,
    hPadding: 0,
    vPadding: 0,
    xOffset: 0,
    yOffset: 0,
    hGap: 0,
    vGap: 0,
    symbolSize: 100,
  };
  const defaultValue = defaults[stateKey] ?? 0;

  // Determine if negative values are allowed
  const allowNegative = ["xOffset", "yOffset"].includes(stateKey);

  // Determine min/max constraints
  let min = null;
  let max = null;
  if (stateKey === "rows" || stateKey === "cols") {
    min = 1;
    max = 20;
  } else if (
    ["hPadding", "vPadding", "hGap", "vGap", "symbolSize"].includes(stateKey)
  ) {
    min = 0;
  }

  // Setup number input with unified handler
  setupNumberInput(
    valueInput,
    defaultValue,
    (value) => {
      if (value === null) return; // Intermediate state, don't update

      state[stateKey] = value;
      // Clamp slider to its min/max but allow input to go beyond
      const sliderMin = parseInt(slider.min, 10);
      const sliderMax = parseInt(slider.max, 10);
      slider.value = Math.max(sliderMin, Math.min(sliderMax, value));

      // Regenerate grid if rows/cols changed
      if (stateKey === "rows" || stateKey === "cols") {
        generateRandomGrid();
      }

      render();
    },
    { min, max, allowNegative }
  );

  // Slider changes -> update input and state
  slider.addEventListener("input", () => {
    const value = parseInt(slider.value, 10);
    state[stateKey] = value;
    valueInput.value = value;

    // Regenerate grid if rows/cols changed
    if (stateKey === "rows" || stateKey === "cols") {
      generateRandomGrid();
    }

    render();
  });
}

/**
 * Setup stepper controls (up/down buttons + manual input)
 */
function setupStepper(valueInput, stateKey, minValue = 1, maxValue = 20) {
  // Find the stepper buttons by data-target attribute
  const decrementBtn = document.querySelector(
    `.stepper-btn[data-action="decrement"][data-target="${stateKey}"]`
  );
  const incrementBtn = document.querySelector(
    `.stepper-btn[data-action="increment"][data-target="${stateKey}"]`
  );

  const defaults = {
    rows: 4,
    cols: 5,
  };
  const defaultValue = defaults[stateKey] ?? 3;

  // Setup number input with unified handler
  setupNumberInput(
    valueInput,
    defaultValue,
    (value) => {
      if (value === null) return; // Intermediate state, don't update

      value = Math.max(minValue, Math.min(maxValue, value));
      valueInput.value = value;
      state[stateKey] = value;
      generateRandomGrid();
      render();
    },
    { min: minValue, max: maxValue, allowNegative: false }
  );

  // Decrement button
  decrementBtn.addEventListener("click", () => {
    const newValue = Math.max(minValue, state[stateKey] - 1);
    state[stateKey] = newValue;
    valueInput.value = newValue;
    generateRandomGrid();
    render();
  });

  // Increment button
  incrementBtn.addEventListener("click", () => {
    const newValue = Math.min(maxValue, state[stateKey] + 1);
    state[stateKey] = newValue;
    valueInput.value = newValue;
    generateRandomGrid();
    render();
  });
}

/**
 * Convert an image to base64 data URL (WebP for smaller size)
 */
function imageToBase64(img, maxSize = null) {
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Downscale if maxSize specified and image is larger
  if (maxSize && (width > maxSize || height > maxSize)) {
    const scale = maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first (smaller), fall back to PNG
  const webp = canvas.toDataURL("image/webp", 0.9);
  if (webp.startsWith("data:image/webp")) {
    return webp;
  }
  return canvas.toDataURL("image/png");
}

/**
 * Load an image from a base64 data URL
 */
function loadImageFromBase64(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Load an image from a File object
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

const MAX_SYMBOL_DIMENSION = 500;

/**
 * Scale an image to fit within maxDimension while preserving aspect ratio
 * Returns a canvas with the scaled image
 */
function scaleImageToMax(img, maxDimension) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Calculate scale factor
  let scale = 1;
  if (w > maxDimension || h > maxDimension) {
    scale = Math.min(maxDimension / w, maxDimension / h);
  }

  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, newW, newH);

  return { canvas, width: newW, height: newH, scale };
}

/**
 * Create a spritesheet from symbol images only (not reelhouse)
 * Scales symbols to max 500x500 for efficiency
 */
const MAX_SPRITESHEET_DIMENSION = 2048;
const MAX_REELHOUSE_DIMENSION = 2000;

/**
 * Convert an image to a WebP blob, scaling to max dimension
 */
function imageToWebpBlob(img, maxDimension) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Calculate scale factor
  let scale = 1;
  if (w > maxDimension || h > maxDimension) {
    scale = Math.min(maxDimension / w, maxDimension / h);
  }

  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, newW, newH);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve({ blob, width: newW, height: newH, scale }),
      "image/webp",
      0.9
    );
  });
}

function createSpritesheet(symbolImages) {
  const positions = [];
  const scaledImages = [];

  // Scale and prepare all symbols
  symbolImages.forEach((s, i) => {
    const scaled = scaleImageToMax(s.img, MAX_SYMBOL_DIMENSION);
    scaledImages.push({
      canvas: scaled.canvas,
      key: `symbol_${i}`,
      width: scaled.width,
      height: scaled.height,
      scale: scaled.scale,
    });
  });

  // Pack symbols into rows, wrapping when we exceed max width
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;
  let maxWidth = 0;

  for (let i = 0; i < scaledImages.length; i++) {
    const img = scaledImages[i];

    // Check if we need to wrap to next row
    if (currentX + img.width > MAX_SPRITESHEET_DIMENSION && currentX > 0) {
      currentX = 0;
      currentY += rowHeight;
      rowHeight = 0;
    }

    positions.push({
      key: img.key,
      x: currentX,
      y: currentY,
      width: img.width,
      height: img.height,
      scale: img.scale,
    });

    currentX += img.width;
    rowHeight = Math.max(rowHeight, img.height);
    maxWidth = Math.max(maxWidth, currentX);
  }

  // Final dimensions
  const totalHeight = currentY + rowHeight;

  // Create spritesheet canvas
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(maxWidth, MAX_SPRITESHEET_DIMENSION) || 1;
  canvas.height = Math.min(totalHeight, MAX_SPRITESHEET_DIMENSION) || 1;
  const ctx = canvas.getContext("2d");

  // Draw all scaled images
  for (let i = 0; i < scaledImages.length; i++) {
    ctx.drawImage(scaledImages[i].canvas, positions[i].x, positions[i].y);
  }

  // Convert to WebP (or PNG fallback)
  let imageData = canvas.toDataURL("image/webp", 0.9);
  if (!imageData.startsWith("data:image/webp")) {
    imageData = canvas.toDataURL("image/png");
  }

  return {
    imageData,
    width: canvas.width,
    height: canvas.height,
    positions,
  };
}

/**
 * Extract a region from a spritesheet image
 */
function extractFromSpritesheet(spritesheetImg, region) {
  const canvas = document.createElement("canvas");
  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    spritesheetImg,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height
  );

  // Return as a new Image
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL("image/png");
  });
}

// Store last used file handle for persistent folder selection
let lastFileHandle = null;

/**
 * Helper to save a blob with native file picker or fallback
 * Remembers the last used folder for subsequent saves
 */
async function saveBlob(blob, suggestedName, description, mimeType, extension) {
  try {
    if (window.showSaveFilePicker) {
      const options = {
        suggestedName,
        types: [{ description, accept: { [mimeType]: [extension] } }],
      };

      // Use last file handle as startIn - browser will open to same directory
      if (lastFileHandle) {
        options.startIn = lastFileHandle;
      } else {
        options.startIn = "downloads";
      }

      const handle = await window.showSaveFilePicker(options);

      // Store the file handle for next time (browser uses parent directory)
      lastFileHandle = handle;

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Failed to save:", err);
      alert("Failed to save: " + err.message);
    }
    return false;
  }
}

/**
 * Export Sprites: sprite_symbols.webp, sprite_symbols.json, sprite_reelhouse.webp
 */
async function exportSprites() {
  if (state.symbolImages.length === 0) {
    alert("No symbols to export. Please add some symbols first.");
    return;
  }

  // Create spritesheet
  const spritesheet = createSpritesheet(state.symbolImages);
  const spritesheetBlob = await fetch(spritesheet.imageData).then((r) =>
    r.blob()
  );

  // Create sprite data JSON (no Base64, just positions)
  const spriteData = {
    width: spritesheet.width,
    height: spritesheet.height,
    symbols: state.symbolImages.map((s, i) => {
      const pos = spritesheet.positions.find((p) => p.key === `symbol_${i}`);
      return {
        name: s.name,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        scale: pos.scale,
      };
    }),
  };
  const spriteDataBlob = new Blob([JSON.stringify(spriteData, null, 2)], {
    type: "application/json",
  });

  // Save sprite_symbols.webp (stop if user cancels)
  const saved1 = await saveBlob(
    spritesheetBlob,
    "sprite_symbols.webp",
    "Symbols Spritesheet",
    "image/webp",
    ".webp"
  );
  if (!saved1) return;

  // Save sprite_symbols.json
  const saved2 = await saveBlob(
    spriteDataBlob,
    "sprite_symbols.json",
    "Sprite Data",
    "application/json",
    ".json"
  );
  if (!saved2) return;

  // Save sprite_reelhouse.webp if exists
  if (state.reelhouseImage) {
    const reelhouseData = await imageToWebpBlob(
      state.reelhouseImage,
      MAX_REELHOUSE_DIMENSION
    );
    await saveBlob(
      reelhouseData.blob,
      "sprite_reelhouse.webp",
      "Reelhouse Sprite",
      "image/webp",
      ".webp"
    );
  }
}

/**
 * Export Config: config-symbols.json with Base64 embedded images (single file import/export)
 */
async function exportConfig() {
  if (state.symbolImages.length === 0) {
    alert("No symbols to export. Please add some symbols first.");
    return;
  }

  // Create spritesheet and convert to Base64
  const spritesheet = createSpritesheet(state.symbolImages);

  // Build config with embedded Base64 images
  const config = {
    version: 5, // Base64 embedded version
    settings: {
      rows: state.rows,
      cols: state.cols,
      hPadding: state.hPadding,
      vPadding: state.vPadding,
      xOffset: state.xOffset,
      yOffset: state.yOffset,
      hGap: state.hGap,
      vGap: state.vGap,
      symbolSize: state.symbolSize,
      showBounds: state.showBounds,
    },
    spritesheet: {
      imageData: spritesheet.imageData, // Base64 WebP
      width: spritesheet.width,
      height: spritesheet.height,
    },
    reelhouse: state.reelhouseImage
      ? imageToBase64(state.reelhouseImage, MAX_REELHOUSE_DIMENSION)
      : null,
    symbols: state.symbolImages.map((s, i) => {
      const pos = spritesheet.positions.find((p) => p.key === `symbol_${i}`);
      return {
        name: s.name,
        size: s.size,
        xOffset: s.xOffset || 0,
        yOffset: s.yOffset || 0,
        shape: s.shape,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        scale: pos.scale,
      };
    }),
  };

  const jsonBlob = new Blob([JSON.stringify(config)], {
    type: "application/json",
  });

  await saveBlob(
    jsonBlob,
    "config-symbols.json",
    "Symbols Config",
    "application/json",
    ".json"
  );
}

/**
 * Export Preview: preview.png (with settings bar)
 */
async function exportPreview() {
  if (!state.reelhouseImage && state.symbolImages.length === 0) {
    alert("Nothing to preview. Please add reelhouse or symbols first.");
    return;
  }

  // Default values
  const defaults = {
    rows: 4,
    cols: 5,
    hPadding: 0,
    vPadding: 0,
    xOffset: 0,
    yOffset: 0,
    hGap: 0,
    vGap: 0,
    symbolSize: 100,
    individualSize: 100,
  };

  const {
    rows,
    cols,
    hPadding,
    vPadding,
    xOffset,
    yOffset,
    hGap,
    vGap,
    symbolSize,
    symbolImages,
  } = state;

  const sourceCanvas = elements.canvas;
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  // Build settings array - rows and cols always included, others only if changed
  const changedSettings = [];

  // Always include rows and columns
  changedSettings.push(`Rows: ${rows}`);
  changedSettings.push(`Cols: ${cols}`);
  if (hPadding !== defaults.hPadding)
    changedSettings.push(`H-Pad: ${hPadding}px`);
  if (vPadding !== defaults.vPadding)
    changedSettings.push(`V-Pad: ${vPadding}px`);
  if (xOffset !== defaults.xOffset) changedSettings.push(`X-Off: ${xOffset}px`);
  if (yOffset !== defaults.yOffset) changedSettings.push(`Y-Off: ${yOffset}px`);
  if (hGap !== defaults.hGap) changedSettings.push(`H-Gap: ${hGap}px`);
  if (vGap !== defaults.vGap) changedSettings.push(`V-Gap: ${vGap}px`);
  if (symbolSize !== defaults.symbolSize)
    changedSettings.push(`Scale: ${symbolSize}%`);

  // Add individual symbol settings that differ from default
  symbolImages.forEach((s) => {
    const name = s.name.replace(/\.[^/.]+$/, "");
    const hasCustomSize = s.size !== defaults.individualSize;
    const hasCustomXOffset = (s.xOffset || 0) !== 0;
    const hasCustomYOffset = (s.yOffset || 0) !== 0;

    if (hasCustomSize || hasCustomXOffset || hasCustomYOffset) {
      let symbolSettings = `${name}:`;
      const parts = [];
      if (hasCustomSize) parts.push(`${s.size}%`);
      if (hasCustomXOffset)
        parts.push(`X${s.xOffset > 0 ? "+" : ""}${s.xOffset}`);
      if (hasCustomYOffset)
        parts.push(`Y${s.yOffset > 0 ? "+" : ""}${s.yOffset}`);
      symbolSettings += parts.join(",");
      changedSettings.push(symbolSettings);
    }
  });

  // Create canvas with settings bar
  const settingsText = changedSettings.join("  |  ");

  // Calculate text dimensions and wrapping
  const fontSize = Math.max(10, Math.floor(sourceCanvas.width / 80));
  const padding = 8;
  const lineHeight = fontSize + 4;
  const maxWidth = sourceCanvas.width - padding * 2;

  // Set font for measuring
  tempCtx.font = `${fontSize}px monospace`;

  // Wrap text into lines
  const words = settingsText.split("  ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + "  " + word : word;
    const testWidth = tempCtx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  // Calculate total bar height
  const barHeight = lines.length * lineHeight + padding * 2;

  // Set canvas size (original + text bar)
  tempCanvas.width = sourceCanvas.width;
  tempCanvas.height = sourceCanvas.height + barHeight;

  // Draw original canvas
  tempCtx.drawImage(sourceCanvas, 0, 0);

  // Draw settings bar (more opaque)
  tempCtx.fillStyle = "rgba(0, 0, 0, 0.95)";
  tempCtx.fillRect(0, sourceCanvas.height, tempCanvas.width, barHeight);

  // Draw settings text (each line)
  tempCtx.font = `${fontSize}px monospace`;
  tempCtx.fillStyle = "#aaa";
  tempCtx.textAlign = "center";
  tempCtx.textBaseline = "top";

  lines.forEach((line, i) => {
    const y = sourceCanvas.height + padding + i * lineHeight;
    tempCtx.fillText(line, tempCanvas.width / 2, y);
  });

  // Export as PNG
  const previewBlob = await new Promise((resolve) =>
    tempCanvas.toBlob(resolve, "image/png")
  );

  await saveBlob(
    previewBlob,
    "preview.png",
    "Preview Image",
    "image/png",
    ".png"
  );
}

/**
 * Import configuration and images from JSON
 */
async function importConfig(files) {
  try {
    // Find JSON and WebP files from the selection
    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    const webpFiles = files.filter((f) => f.name.endsWith(".webp"));

    if (!jsonFile) {
      throw new Error("Please select a JSON config file");
    }

    const text = await jsonFile.text();
    const config = JSON.parse(text);

    // Validate version
    if (!config.version || !config.settings) {
      throw new Error("Invalid config file format");
    }

    // Restore settings
    const s = config.settings;
    state.rows = s.rows ?? 4;
    state.cols = s.cols ?? 5;
    state.hPadding = s.hPadding ?? 0;
    state.vPadding = s.vPadding ?? 0;
    state.xOffset = s.xOffset ?? 0;
    state.yOffset = s.yOffset ?? 0;
    state.hGap = s.hGap ?? 0;
    state.vGap = s.vGap ?? 0;
    state.symbolSize = s.symbolSize ?? 100;
    state.showBounds = s.showBounds ?? true;

    // Update UI controls
    elements.rowsValue.value = state.rows;
    elements.colsValue.value = state.cols;
    elements.hPaddingValue.value = state.hPadding;
    elements.hPaddingSlider.value = Math.max(0, Math.min(200, state.hPadding));
    elements.vPaddingValue.value = state.vPadding;
    elements.vPaddingSlider.value = Math.max(0, Math.min(200, state.vPadding));
    elements.xOffsetValue.value = state.xOffset;
    elements.xOffsetSlider.value = Math.max(-200, Math.min(200, state.xOffset));
    elements.yOffsetValue.value = state.yOffset;
    elements.yOffsetSlider.value = Math.max(-200, Math.min(200, state.yOffset));
    elements.hGapValue.value = state.hGap;
    elements.hGapSlider.value = Math.max(0, Math.min(200, state.hGap));
    elements.vGapValue.value = state.vGap;
    elements.vGapSlider.value = Math.max(0, Math.min(200, state.vGap));
    elements.symbolSizeValue.value = state.symbolSize;
    elements.symbolSizeSlider.value = Math.max(
      0,
      Math.min(200, state.symbolSize)
    );
    elements.showBoundsCheckbox.checked = state.showBounds;

    // Handle version 5 (Base64 embedded images - single file)
    if (config.version === 5) {
      // Load spritesheet from Base64
      const spritesheetImg = await loadImageFromBase64(
        config.spritesheet.imageData
      );

      // Extract symbols from spritesheet
      if (config.symbols && config.symbols.length > 0) {
        const symbolObjects = await Promise.all(
          config.symbols.map(async (s) => ({
            img: await extractFromSpritesheet(spritesheetImg, s),
            name: s.name,
            size: s.size,
            xOffset: s.xOffset || 0,
            yOffset: s.yOffset || 0,
            shape: s.shape || [[0, 0]],
          }))
        );
        state.symbolImages = symbolObjects;
        elements.symbolsDropzone.classList.add("has-file");
        updateSymbolsThumbnails();
      }

      // Load reelhouse from Base64
      if (config.reelhouse) {
        state.reelhouseImage = await loadImageFromBase64(config.reelhouse);
        elements.reelhouseDropzone.classList.add("has-file");
        updateReelhouseThumbnail();
      } else {
        state.reelhouseImage = null;
        elements.reelhouseDropzone.classList.remove("has-file");
        elements.reelhouseThumbnail.innerHTML = "";
      }
    }
    // Handle version 4 (separate spritesheet + reelhouse files)
    else if (config.version === 4 || config.version === 3) {
      // Find spritesheet file
      const spritesheetFile = webpFiles.find(
        (f) =>
          f.name === config.spritesheetFile ||
          f.name.includes("config-symbols") ||
          f.name.includes("spritesheet") ||
          f.name.includes("symbols_preview") ||
          (webpFiles.length === 1 && !config.reelhouseFile)
      );

      if (!spritesheetFile) {
        throw new Error(
          `Please select all required files together.\n\nExpected: ${config.spritesheetFile}`
        );
      }

      // Load spritesheet
      const spritesheetImg = await loadImageFromFile(spritesheetFile);

      // Extract symbols from spritesheet
      if (config.symbols && config.symbols.length > 0) {
        const symbolObjects = await Promise.all(
          config.symbols.map(async (s) => ({
            img: await extractFromSpritesheet(spritesheetImg, s),
            name: s.name,
            size: s.size,
            xOffset: s.xOffset || 0,
            yOffset: s.yOffset || 0,
            shape: s.shape || [[0, 0]],
          }))
        );
        state.symbolImages = symbolObjects;
        elements.symbolsDropzone.classList.add("has-file");
        updateSymbolsThumbnails();
      } else {
        state.symbolImages = [];
        elements.symbolsDropzone.classList.remove("has-file");
        elements.symbolsThumbnails.innerHTML = "";
      }

      // Handle reelhouse (version 4 only)
      if (config.version === 4 && config.reelhouseFile) {
        const reelhouseFile = webpFiles.find(
          (f) => f.name === config.reelhouseFile || f.name.includes("reelhouse")
        );

        if (reelhouseFile) {
          state.reelhouseImage = await loadImageFromFile(reelhouseFile);
          elements.reelhouseDropzone.classList.add("has-file");
          updateReelhouseThumbnail();
        } else {
          state.reelhouseImage = null;
          elements.reelhouseDropzone.classList.remove("has-file");
          elements.reelhouseThumbnail.innerHTML = "";
        }
      } else {
        // Version 3 or no reelhouse file
        state.reelhouseImage = null;
        elements.reelhouseDropzone.classList.remove("has-file");
        elements.reelhouseThumbnail.innerHTML = "";
      }
    } else if (config.version === 2 && config.spritesheet) {
      // Version 2: embedded Base64 spritesheet (backwards compatibility)
      const spritesheetImg = await loadImageFromBase64(
        config.spritesheet.imageData
      );

      // Extract reelhouse from spritesheet
      if (config.reelhouse) {
        state.reelhouseImage = await extractFromSpritesheet(
          spritesheetImg,
          config.reelhouse
        );
        elements.reelhouseDropzone.classList.add("has-file");
        updateReelhouseThumbnail();
      } else {
        state.reelhouseImage = null;
        elements.reelhouseDropzone.classList.remove("has-file");
        elements.reelhouseThumbnail.innerHTML = "";
      }

      // Extract symbols from spritesheet
      if (config.symbols && config.symbols.length > 0) {
        const symbolObjects = await Promise.all(
          config.symbols.map(async (s) => ({
            img: await extractFromSpritesheet(spritesheetImg, s),
            name: s.name,
            size: s.size,
            xOffset: s.xOffset || 0,
            yOffset: s.yOffset || 0,
            shape: s.shape || [[0, 0]],
          }))
        );
        state.symbolImages = symbolObjects;
        elements.symbolsDropzone.classList.add("has-file");
        updateSymbolsThumbnails();
      } else {
        state.symbolImages = [];
        elements.symbolsDropzone.classList.remove("has-file");
        elements.symbolsThumbnails.innerHTML = "";
      }
    } else {
      // Version 1: Load individual images (backwards compatibility)
      if (config.reelhouse) {
        state.reelhouseImage = await loadImageFromBase64(config.reelhouse);
        elements.reelhouseDropzone.classList.add("has-file");
        updateReelhouseThumbnail();
      } else {
        state.reelhouseImage = null;
        elements.reelhouseDropzone.classList.remove("has-file");
        elements.reelhouseThumbnail.innerHTML = "";
      }

      if (config.symbols && config.symbols.length > 0) {
        const symbolObjects = await Promise.all(
          config.symbols.map(async (s) => ({
            img: await loadImageFromBase64(s.imageData),
            name: s.name,
            size: s.size,
            xOffset: s.xOffset || 0,
            yOffset: s.yOffset || 0,
            shape: s.shape || [[0, 0]],
          }))
        );
        state.symbolImages = symbolObjects;
        elements.symbolsDropzone.classList.add("has-file");
        updateSymbolsThumbnails();
      } else {
        state.symbolImages = [];
        elements.symbolsDropzone.classList.remove("has-file");
        elements.symbolsThumbnails.innerHTML = "";
      }
    }

    generateRandomGrid();
    render();
  } catch (err) {
    console.error("Failed to import config:", err);
    alert("Failed to import config: " + err.message);
  }
}

// ===== Mega Symbols Modal =====

/**
 * Open the mega symbols modal and render the grid editors
 */
function openMegaModal() {
  renderMegaSymbolsList();
  elements.megaModal.classList.remove("hidden");
}

/**
 * Close the mega symbols modal
 */
function closeMegaModal() {
  elements.megaModal.classList.add("hidden");
}

/**
 * Render the list of symbols with their mini grid editors
 */
function renderMegaSymbolsList() {
  const container = elements.megaSymbolsList;

  if (state.symbolImages.length === 0) {
    container.innerHTML =
      '<p class="mega-empty">Upload symbols first to configure mega symbols.</p>';
    return;
  }

  container.innerHTML = "";

  state.symbolImages.forEach((symbolObj, index) => {
    const item = document.createElement("div");
    item.className = "mega-symbol-item";

    // Thumbnail
    const thumbDiv = document.createElement("div");
    thumbDiv.className = "mega-symbol-thumb";
    const thumbImg = document.createElement("img");
    thumbImg.src = symbolObj.img.src;
    thumbDiv.appendChild(thumbImg);

    // Info section
    const infoDiv = document.createElement("div");
    infoDiv.className = "mega-symbol-info";

    const nameEl = document.createElement("div");
    nameEl.className = "mega-symbol-name";
    nameEl.textContent = symbolObj.name;

    const shapeLabel = document.createElement("div");
    shapeLabel.className = "mega-symbol-shape-label";
    shapeLabel.innerHTML = `Shape: <span id="shape-label-${index}">${getShapeDescription(
      symbolObj.shape
    )}</span>`;

    // Mini grid
    const gridEl = createMiniGrid(index, symbolObj.shape);

    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(shapeLabel);
    infoDiv.appendChild(gridEl);

    item.appendChild(thumbDiv);
    item.appendChild(infoDiv);
    container.appendChild(item);
  });
}

/**
 * Get a human-readable description of a shape
 */
function getShapeDescription(shape) {
  if (shape.length === 1) return "1×1";

  const cols = shape.map(([c, r]) => c);
  const rows = shape.map(([c, r]) => r);
  const width = Math.max(...cols) - Math.min(...cols) + 1;
  const height = Math.max(...rows) - Math.min(...rows) + 1;

  // Check if it's a perfect rectangle
  if (shape.length === width * height) {
    return `${width}×${height}`;
  }

  return `Custom (${shape.length} cells)`;
}

/**
 * Create a mini grid editor for a symbol
 */
function createMiniGrid(symbolIndex, currentShape) {
  const { rows, cols } = state;

  // Calculate cell size to fit within available space (max ~120px total width)
  const maxGridWidth = 120;
  const cellSize = Math.max(8, Math.min(16, Math.floor(maxGridWidth / cols)));

  const grid = document.createElement("div");
  grid.className = "mini-grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  grid.style.setProperty("--grid-cols", cols);
  grid.style.setProperty("--grid-rows", rows);

  // Create a Set for quick lookup of selected cells
  const selectedCells = new Set(currentShape.map(([c, r]) => `${c},${r}`));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "mini-grid-cell";
      cell.dataset.col = col;
      cell.dataset.row = row;
      cell.dataset.symbolIndex = symbolIndex;

      if (selectedCells.has(`${col},${row}`)) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", handleMiniGridCellClick);
      grid.appendChild(cell);
    }
  }

  return grid;
}

/**
 * Handle click on a mini grid cell to toggle selection
 */
function handleMiniGridCellClick(e) {
  const cell = e.target;
  const col = parseInt(cell.dataset.col, 10);
  const row = parseInt(cell.dataset.row, 10);
  const symbolIndex = parseInt(cell.dataset.symbolIndex, 10);
  const symbolObj = state.symbolImages[symbolIndex];

  // Find if this cell is already in the shape
  const existingIndex = symbolObj.shape.findIndex(
    ([c, r]) => c === col && r === row
  );

  if (existingIndex >= 0) {
    // Don't allow removing the last cell
    if (symbolObj.shape.length > 1) {
      symbolObj.shape.splice(existingIndex, 1);
      cell.classList.remove("selected");
    }
  } else {
    // Add the cell to the shape
    symbolObj.shape.push([col, row]);
    cell.classList.add("selected");
  }

  // Update the shape label
  const label = document.getElementById(`shape-label-${symbolIndex}`);
  if (label) {
    label.textContent = getShapeDescription(symbolObj.shape);
  }

  // Re-render preview
  generateRandomGrid();
  render();
}

// ===== Initialization =====

function init() {
  // Setup dropzones
  setupDropzone(
    elements.reelhouseDropzone,
    elements.reelhouseInput,
    handleReelhouseFiles
  );
  setupDropzone(
    elements.symbolsDropzone,
    elements.symbolsInput,
    handleSymbolFiles
  );

  // Setup steppers for rows/cols
  setupStepper(elements.rowsValue, "rows", 1);
  setupStepper(elements.colsValue, "cols", 1);

  // Setup sliders for padding, offset, gaps, and size
  setupSlider(elements.hPaddingSlider, elements.hPaddingValue, "hPadding");
  setupSlider(elements.vPaddingSlider, elements.vPaddingValue, "vPadding");
  setupSlider(elements.xOffsetSlider, elements.xOffsetValue, "xOffset");
  setupSlider(elements.yOffsetSlider, elements.yOffsetValue, "yOffset");
  setupSlider(elements.hGapSlider, elements.hGapValue, "hGap");
  setupSlider(elements.vGapSlider, elements.vGapValue, "vGap");
  setupSlider(
    elements.symbolSizeSlider,
    elements.symbolSizeValue,
    "symbolSize"
  );

  // Show bounds checkbox
  elements.showBoundsCheckbox.addEventListener("change", () => {
    state.showBounds = elements.showBoundsCheckbox.checked;
    render();
  });

  // Shuffle button
  elements.shuffleBtn.addEventListener("click", () => {
    generateRandomGrid();
    render();
  });

  // Reset all settings
  elements.resetBtn.addEventListener("click", () => {
    // Reset grid settings
    state.rows = 4;
    state.cols = 5;
    state.hPadding = 0;
    state.vPadding = 0;
    state.xOffset = 0;
    state.yOffset = 0;
    state.hGap = 0;
    state.vGap = 0;
    state.symbolSize = 100;
    state.showBounds = true;

    // Reset individual symbol settings
    state.symbolImages.forEach((s) => {
      s.size = 100;
      s.xOffset = 0;
      s.yOffset = 0;
      s.shape = [[0, 0]];
    });

    // Update all UI elements
    elements.rowsValue.value = state.rows;
    elements.colsValue.value = state.cols;
    elements.hPaddingSlider.value = state.hPadding;
    elements.hPaddingValue.value = state.hPadding;
    elements.vPaddingSlider.value = state.vPadding;
    elements.vPaddingValue.value = state.vPadding;
    elements.xOffsetSlider.value = state.xOffset;
    elements.xOffsetValue.value = state.xOffset;
    elements.yOffsetSlider.value = state.yOffset;
    elements.yOffsetValue.value = state.yOffset;
    elements.hGapSlider.value = state.hGap;
    elements.hGapValue.value = state.hGap;
    elements.vGapSlider.value = state.vGap;
    elements.vGapValue.value = state.vGap;
    elements.symbolSizeSlider.value = state.symbolSize;
    elements.symbolSizeValue.value = state.symbolSize;
    elements.showBoundsCheckbox.checked = state.showBounds;

    // Refresh thumbnails to show reset individual settings
    updateSymbolsThumbnails();
    generateRandomGrid();
    render();
  });

  // Export buttons
  elements.exportSpritesBtn.addEventListener("click", exportSprites);
  elements.exportConfigBtn.addEventListener("click", exportConfig);
  elements.exportPreviewBtn.addEventListener("click", exportPreview);

  // Import config
  elements.importConfigInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      importConfig(Array.from(e.target.files));
      e.target.value = ""; // Reset for same file selection
    }
  });

  // Mega symbols modal
  elements.megaSymbolsBtn.addEventListener("click", openMegaModal);
  elements.megaModalClose.addEventListener("click", closeMegaModal);
  elements.megaModalApply.addEventListener("click", closeMegaModal);
  elements.megaModal.addEventListener("click", (e) => {
    if (e.target === elements.megaModal) {
      closeMegaModal();
    }
  });

  // Info modal
  elements.infoBtn.addEventListener("click", () => {
    elements.infoModal.classList.remove("hidden");
  });

  elements.modalClose.addEventListener("click", () => {
    elements.infoModal.classList.add("hidden");
  });

  elements.infoModal.addEventListener("click", (e) => {
    // Close when clicking overlay background
    if (e.target === elements.infoModal) {
      elements.infoModal.classList.add("hidden");
    }
  });

  // Initial render
  render();
}

// Start the app
init();
