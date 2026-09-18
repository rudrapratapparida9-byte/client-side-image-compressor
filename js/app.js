/**
 * Client-Side Image Compressor & Resizer
 * 100% In-Browser Canvas / Blob Processing
 */

(function () {
  'use strict';

  // State Management
  const state = {
    files: [],            // List of { id, file, originalUrl, compressedBlob, compressedUrl, origSize, compSize, origWidth, origHeight, compWidth, compHeight, name, type }
    activeIdx: 0,
    quality: 0.80,        // 0.05 to 1.00
    maxWidth: null,       // null = original
    maxHeight: null,
    lockAspect: true,
    format: 'image/webp', // 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif'
    rotation: 0,          // 0, 90, 180, 270
    flipH: false,
    grayscale: false,
    viewMode: 'split',    // 'split' | 'side' | 'result'
    zoom: 1,
    splitPercent: 50
  };

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const sampleBtn = document.getElementById('sampleBtn');
  const editorWorkspace = document.getElementById('editorWorkspace');
  
  // Controls
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityVal = document.getElementById('qualityVal');
  const presetBtns = document.querySelectorAll('.preset-btn');

  const resizeSlider = document.getElementById('resizeSlider');
  const resizeVal = document.getElementById('resizeVal');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const aspectLockBtn = document.getElementById('aspectLockBtn');
  const scaleBtns = document.querySelectorAll('.scale-btn');

  const formatSelect = document.getElementById('formatSelect');
  const rotateLeftBtn = document.getElementById('rotateLeftBtn');
  const rotateRightBtn = document.getElementById('rotateRightBtn');
  const flipHBtn = document.getElementById('flipHBtn');
  const grayscaleBtn = document.getElementById('grayscaleBtn');

  // Target Size
  const targetSizeToggleBtn = document.getElementById('targetSizeToggleBtn');
  const targetSizeBar = document.getElementById('targetSizeBar');
  const targetSizeInput = document.getElementById('targetSizeInput');
  const targetSizeUnit = document.getElementById('targetSizeUnit');
  const applyTargetSizeBtn = document.getElementById('applyTargetSizeBtn');
  const closeTargetSizeBtn = document.getElementById('closeTargetSizeBtn');

  // Metrics
  const origSizeDisplay = document.getElementById('origSizeDisplay');
  const compSizeDisplay = document.getElementById('compSizeDisplay');
  const savedPercentDisplay = document.getElementById('savedPercentDisplay');
  const dimDisplay = document.getElementById('dimDisplay');

  // Preview & Comparison
  const comparisonContainer = document.getElementById('comparisonContainer');
  const imgOriginal = document.getElementById('imgOriginal');
  const imgCompressed = document.getElementById('imgCompressed');
  const compressedWrapper = document.getElementById('compressedWrapper');
  const splitHandle = document.getElementById('splitHandle');
  const viewModeBtns = document.querySelectorAll('.view-mode-btn');

  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomLevelText = document.getElementById('zoomLevelText');

  // Actions
  const chooseAnotherBtn = document.getElementById('chooseAnotherBtn');
  const copyClipboardBtn = document.getElementById('copyClipboardBtn');
  const downloadSingleBtn = document.getElementById('downloadSingleBtn');
  const downloadBatchBtn = document.getElementById('downloadBatchBtn');

  // Batch
  const batchNav = document.getElementById('batchNav');
  const batchTabsList = document.getElementById('batchTabsList');
  const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
  const batchOverviewSection = document.getElementById('batchOverviewSection');
  const batchItemsGrid = document.getElementById('batchItemsGrid');
  const batchCountText = document.getElementById('batchCountText');
  const applySettingsToAllBtn = document.getElementById('applySettingsToAllBtn');

  // Theme & PWA
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  const toast = document.getElementById('toast');

  let deferredPrompt = null;
  let isDraggingSplit = false;

  // Initialize
  init();

  function init() {
    setupEventListeners();
    setupTheme();
    setupPWA();
    checkFormatSupport();
  }

  function setupEventListeners() {
    // File Selection & Drag Drop
    browseBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
      if (e.target !== sampleBtn && !sampleBtn.contains(e.target)) {
        fileInput.click();
      }
    });

    sampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleImage();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
      }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Paste support (Ctrl+V)
    window.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          handleFiles(imageFiles);
          showToast('Image pasted from clipboard!');
        }
      }
    });

    // Quality Slider & Presets
    qualitySlider.addEventListener('input', () => {
      state.quality = parseInt(qualitySlider.value, 10) / 100;
      qualityVal.textContent = `${qualitySlider.value}%`;
      updateActivePreset(qualitySlider.value);
      debounceProcess();
    });

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.quality, 10);
        qualitySlider.value = val;
        state.quality = val / 100;
        qualityVal.textContent = `${val}%`;
        updateActivePreset(val);
        processCurrent();
      });
    });

    // Resize Slider & Inputs
    resizeSlider.addEventListener('input', () => {
      const active = getActiveFile();
      if (!active) return;
      const targetW = parseInt(resizeSlider.value, 10);
      widthInput.value = targetW;
      if (state.lockAspect && active.origWidth) {
        const ratio = active.origHeight / active.origWidth;
        heightInput.value = Math.round(targetW * ratio);
      }
      state.maxWidth = targetW;
      resizeVal.textContent = `${targetW}px`;
      updateActiveScale(-1);
      debounceProcess();
    });

    widthInput.addEventListener('input', () => {
      const active = getActiveFile();
      if (!active) return;
      const w = parseInt(widthInput.value, 10) || active.origWidth;
      state.maxWidth = w;
      if (state.lockAspect && active.origWidth) {
        const ratio = active.origHeight / active.origWidth;
        heightInput.value = Math.round(w * ratio);
      }
      resizeSlider.value = Math.min(w, resizeSlider.max);
      resizeVal.textContent = `${w}px`;
      debounceProcess();
    });

    heightInput.addEventListener('input', () => {
      const active = getActiveFile();
      if (!active) return;
      const h = parseInt(heightInput.value, 10) || active.origHeight;
      if (state.lockAspect && active.origHeight) {
        const ratio = active.origWidth / active.origHeight;
        const w = Math.round(h * ratio);
        widthInput.value = w;
        state.maxWidth = w;
        resizeSlider.value = Math.min(w, resizeSlider.max);
        resizeVal.textContent = `${w}px`;
      }
      debounceProcess();
    });

    aspectLockBtn.addEventListener('click', () => {
      state.lockAspect = !state.lockAspect;
      aspectLockBtn.classList.toggle('active', state.lockAspect);
      showToast(state.lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked');
    });

    scaleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const scale = parseFloat(btn.dataset.scale);
        const active = getActiveFile();
        if (!active) return;
        const targetW = Math.round(active.origWidth * scale);
        const targetH = Math.round(active.origHeight * scale);
        widthInput.value = targetW;
        heightInput.value = targetH;
        state.maxWidth = targetW;
        resizeSlider.value = Math.min(targetW, resizeSlider.max);
        resizeVal.textContent = scale === 1 ? 'Original' : `${targetW}px`;
        updateActiveScale(scale);
        processCurrent();
      });
    });

    // Format Select
    formatSelect.addEventListener('change', () => {
      state.format = formatSelect.value;
      processCurrent();
    });

    // Quick Tools (Rotate, Flip, Grayscale)
    rotateLeftBtn.addEventListener('click', () => {
      state.rotation = (state.rotation - 90 + 360) % 360;
      processCurrent();
    });

    rotateRightBtn.addEventListener('click', () => {
      state.rotation = (state.rotation + 90) % 360;
      processCurrent();
    });

    flipHBtn.addEventListener('click', () => {
      state.flipH = !state.flipH;
      flipHBtn.classList.toggle('active', state.flipH);
      processCurrent();
    });

    grayscaleBtn.addEventListener('click', () => {
      state.grayscale = !state.grayscale;
      grayscaleBtn.classList.toggle('active', state.grayscale);
      processCurrent();
    });

    // Target Size Bar
    targetSizeToggleBtn.addEventListener('click', () => {
      const isVisible = targetSizeBar.style.display !== 'none';
      targetSizeBar.style.display = isVisible ? 'none' : 'block';
      targetSizeToggleBtn.classList.toggle('active', !isVisible);
    });

    closeTargetSizeBtn.addEventListener('click', () => {
      targetSizeBar.style.display = 'none';
      targetSizeToggleBtn.classList.remove('active');
    });

    applyTargetSizeBtn.addEventListener('click', () => {
      const targetVal = parseFloat(targetSizeInput.value);
      if (!targetVal || targetVal <= 0) {
        showToast('Please enter a valid target size');
        return;
      }
      const unit = targetSizeUnit.value;
      const targetBytes = unit === 'MB' ? targetVal * 1024 * 1024 : targetVal * 1024;
      optimizeForTargetSize(targetBytes);
    });

    // Split Slider Dragging
    splitHandle.addEventListener('mousedown', startSplitDrag);
    window.addEventListener('mousemove', onSplitDrag);
    window.addEventListener('mouseup', endSplitDrag);

    splitHandle.addEventListener('touchstart', startSplitDrag, { passive: true });
    window.addEventListener('touchmove', onSplitDrag, { passive: false });
    window.addEventListener('touchend', endSplitDrag);

    // View Modes
    viewModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.viewMode = btn.dataset.mode;
        comparisonContainer.className = `comparison-container mode-${state.viewMode}`;
      });
    });

    // Zoom Controls
    zoomInBtn.addEventListener('click', () => adjustZoom(0.25));
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.25));
    zoomResetBtn.addEventListener('click', () => setZoom(1));

    // Action Buttons
    chooseAnotherBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    copyClipboardBtn.addEventListener('click', copyCompressedToClipboard);
    downloadSingleBtn.addEventListener('click', downloadActiveImage);
    downloadBatchBtn.addEventListener('click', downloadAllAsZip);
    addMoreFilesBtn.addEventListener('click', () => fileInput.click());
    applySettingsToAllBtn.addEventListener('click', applyCurrentSettingsToAll);

    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // File Handling
  async function handleFiles(fileList) {
    const validImages = fileList.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      showToast('Please select valid image files (JPG, PNG, WebP, AVIF)');
      return;
    }

    showToast(`Loading ${validImages.length} image${validImages.length > 1 ? 's' : ''}...`);

    for (const file of validImages) {
      const id = 'img_' + Math.random().toString(36).substring(2, 9);
      const originalUrl = URL.createObjectURL(file);
      const dims = await getImageDimensions(originalUrl);

      state.files.push({
        id,
        file,
        name: file.name,
        type: file.type,
        origSize: file.size,
        origWidth: dims.width,
        origHeight: dims.height,
        originalUrl,
        compressedBlob: null,
        compressedUrl: null,
        compSize: 0,
        compWidth: dims.width,
        compHeight: dims.height
      });
    }

    state.activeIdx = state.files.length - validImages.length;
    showEditorUI();
    renderBatchTabs();
    processCurrent();
  }

  function showEditorUI() {
    dropZone.style.display = 'none';
    editorWorkspace.style.display = 'block';

    if (state.files.length > 1) {
      batchNav.style.display = 'flex';
      batchOverviewSection.style.display = 'block';
      downloadBatchBtn.style.display = 'inline-flex';
      batchCountText.textContent = state.files.length;
    } else {
      batchNav.style.display = 'none';
      batchOverviewSection.style.display = 'none';
      downloadBatchBtn.style.display = 'none';
    }
  }

  function renderBatchTabs() {
    batchTabsList.innerHTML = '';
    state.files.forEach((fileObj, idx) => {
      const tab = document.createElement('div');
      tab.className = `batch-tab ${idx === state.activeIdx ? 'active' : ''}`;
      tab.innerHTML = `
        <img src="${fileObj.originalUrl}" alt="Thumbnail">
        <span>${truncateName(fileObj.name, 14)}</span>
      `;
      tab.addEventListener('click', () => {
        state.activeIdx = idx;
        renderBatchTabs();
        loadActiveFileControls();
        processCurrent();
      });
      batchTabsList.appendChild(tab);
    });
  }

  function loadActiveFileControls() {
    const active = getActiveFile();
    if (!active) return;

    resizeSlider.max = Math.max(active.origWidth, 3840);
    resizeSlider.value = active.origWidth;
    widthInput.value = active.origWidth;
    heightInput.value = active.origHeight;
    state.maxWidth = active.origWidth;
    resizeVal.textContent = 'Original';

    imgOriginal.src = active.originalUrl;
  }

  function getActiveFile() {
    return state.files[state.activeIdx] || null;
  }

  // Core Compression & Resizing Engine
  let debounceTimer = null;
  function debounceProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processCurrent, 80);
  }

  async function processCurrent() {
    const active = getActiveFile();
    if (!active) return;

    imgOriginal.src = active.originalUrl;

    const result = await compressAndResize(active.originalUrl, {
      quality: state.quality,
      maxWidth: state.maxWidth || active.origWidth,
      maxHeight: state.maxHeight || active.origHeight,
      format: state.format,
      rotation: state.rotation,
      flipH: state.flipH,
      grayscale: state.grayscale
    });

    if (active.compressedUrl) {
      URL.revokeObjectURL(active.compressedUrl);
    }

    active.compressedBlob = result.blob;
    active.compressedUrl = URL.createObjectURL(result.blob);
    active.compSize = result.blob.size;
    active.compWidth = result.width;
    active.compHeight = result.height;

    imgCompressed.src = active.compressedUrl;
    updateMetrics(active);
    updateBatchGrid();
  }

  function compressAndResize(srcUrl, options) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Apply max dimension scaling
        if (options.maxWidth && width > options.maxWidth) {
          height = Math.round((height * options.maxWidth) / width);
          width = options.maxWidth;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });

        // Handle rotation dimensions
        if (options.rotation === 90 || options.rotation === 270) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        ctx.save();

        // Transforms: Rotation & Flip
        if (options.rotation === 90) {
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
        } else if (options.rotation === 180) {
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate(Math.PI);
        } else if (options.rotation === 270) {
          ctx.translate(0, canvas.height);
          ctx.rotate((3 * Math.PI) / 2);
        }

        if (options.flipH) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        if (options.rotation === 90 || options.rotation === 270) {
          ctx.drawImage(img, 0, 0, height, width);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Grayscale filter
        if (options.grayscale) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = avg;
            data[i + 1] = avg;
            data[i + 2] = avg;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        ctx.restore();

        // Convert to target Blob
        let mime = options.format;
        if (mime === 'image/avif' && !isAvifSupported()) {
          mime = 'image/webp'; // Fallback
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, width: canvas.width, height: canvas.height });
            } else {
              // Fallback to jpeg if format failed
              canvas.toBlob((b) => resolve({ blob: b, width: canvas.width, height: canvas.height }), 'image/jpeg', options.quality);
            }
          },
          mime,
          options.quality
        );
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  }

  // Target File Size Optimization
  async function optimizeForTargetSize(targetBytes) {
    const active = getActiveFile();
    if (!active) return;

    showToast('Calculating optimal compression for target size...');
    let lowQ = 0.05;
    let highQ = 0.98;
    let bestBlob = null;
    let bestQ = 0.8;

    for (let i = 0; i < 6; i++) {
      const midQ = (lowQ + highQ) / 2;
      const res = await compressAndResize(active.originalUrl, {
        quality: midQ,
        maxWidth: state.maxWidth || active.origWidth,
        maxHeight: state.maxHeight || active.origHeight,
        format: state.format,
        rotation: state.rotation,
        flipH: state.flipH,
        grayscale: state.grayscale
      });

      bestBlob = res.blob;
      bestQ = midQ;

      if (res.blob.size > targetBytes) {
        highQ = midQ;
      } else {
        lowQ = midQ;
      }
    }

    state.quality = bestQ;
    const qPercent = Math.round(bestQ * 100);
    qualitySlider.value = qPercent;
    qualityVal.textContent = `${qPercent}%`;
    updateActivePreset(qPercent);
    processCurrent();
    showToast(`Optimized! Achieved ${formatBytes(bestBlob.size)} at ${qPercent}% quality`);
  }

  // UI Metrics Update
  function updateMetrics(fileObj) {
    origSizeDisplay.textContent = formatBytes(fileObj.origSize);
    compSizeDisplay.textContent = formatBytes(fileObj.compSize);

    const savedBytes = fileObj.origSize - fileObj.compSize;
    const savedPercent = Math.round((savedBytes / fileObj.origSize) * 100);

    if (savedPercent >= 0) {
      savedPercentDisplay.textContent = `-${savedPercent}%`;
      savedPercentDisplay.style.color = 'var(--success)';
    } else {
      savedPercentDisplay.textContent = `+${Math.abs(savedPercent)}%`;
      savedPercentDisplay.style.color = 'var(--danger)';
    }

    dimDisplay.innerHTML = `<i class="fa-solid fa-expand"></i> ${fileObj.origWidth} &times; ${fileObj.origHeight} &rarr; ${fileObj.compWidth} &times; ${fileObj.compHeight}`;
  }

  // Batch Overview UI
  function updateBatchGrid() {
    if (state.files.length <= 1) return;

    batchItemsGrid.innerHTML = '';
    state.files.forEach((fileObj, idx) => {
      const card = document.createElement('div');
      card.className = 'batch-card';

      const saved = Math.round(((fileObj.origSize - (fileObj.compSize || fileObj.origSize)) / fileObj.origSize) * 100);

      card.innerHTML = `
        <img class="batch-card-thumb" src="${fileObj.originalUrl}" alt="${fileObj.name}">
        <div class="batch-card-info">
          <div class="batch-card-name" title="${fileObj.name}">${fileObj.name}</div>
          <div class="batch-card-stats">
            ${formatBytes(fileObj.origSize)} &rarr; <strong>${formatBytes(fileObj.compSize || 0)}</strong>
            <span class="batch-card-saved">(${saved >= 0 ? '-' + saved + '%' : '+' + Math.abs(saved) + '%'})</span>
          </div>
        </div>
        <div class="batch-card-action">
          <button class="btn-icon-sm" title="Download This Image" onclick="window.downloadSingleIdx(${idx})">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          state.activeIdx = idx;
          renderBatchTabs();
          loadActiveFileControls();
          processCurrent();
        }
      });

      batchItemsGrid.appendChild(card);
    });
  }

  // Global helper for card download
  window.downloadSingleIdx = (idx) => {
    const fileObj = state.files[idx];
    if (fileObj && fileObj.compressedBlob) {
      triggerDownload(fileObj.compressedBlob, getOutputFilename(fileObj.name, state.format));
    }
  };

  async function applyCurrentSettingsToAll() {
    if (state.files.length <= 1) return;
    showToast(`Applying settings to all ${state.files.length} images...`);

    for (let i = 0; i < state.files.length; i++) {
      const f = state.files[i];
      const res = await compressAndResize(f.originalUrl, {
        quality: state.quality,
        maxWidth: state.maxWidth || f.origWidth,
        maxHeight: state.maxHeight || f.origHeight,
        format: state.format,
        rotation: state.rotation,
        flipH: state.flipH,
        grayscale: state.grayscale
      });

      if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
      f.compressedBlob = res.blob;
      f.compressedUrl = URL.createObjectURL(res.blob);
      f.compSize = res.blob.size;
      f.compWidth = res.width;
      f.compHeight = res.height;
    }

    updateBatchGrid();
    showToast('All images processed successfully!');
  }

  // Download Handlers
  function downloadActiveImage() {
    const active = getActiveFile();
    if (!active || !active.compressedBlob) {
      showToast('No compressed image ready to download');
      return;
    }

    const filename = getOutputFilename(active.name, state.format);
    triggerDownload(active.compressedBlob, filename);
    showToast(`Downloaded: ${filename}`);
  }

  async function downloadAllAsZip() {
    if (typeof JSZip === 'undefined') {
      showToast('ZIP library is loading, please try again in a moment');
      return;
    }

    showToast('Packaging ZIP archive...');
    const zip = new JSZip();

    for (let i = 0; i < state.files.length; i++) {
      const f = state.files[i];
      if (!f.compressedBlob) {
        const res = await compressAndResize(f.originalUrl, {
          quality: state.quality,
          maxWidth: state.maxWidth || f.origWidth,
          maxHeight: state.maxHeight || f.origHeight,
          format: state.format,
          rotation: state.rotation,
          flipH: state.flipH,
          grayscale: state.grayscale
        });
        f.compressedBlob = res.blob;
      }
      const fname = getOutputFilename(f.name, state.format);
      zip.file(fname, f.compressedBlob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `compressed-images-${Date.now()}.zip`);
    showToast('ZIP archive downloaded successfully!');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyCompressedToClipboard() {
    const active = getActiveFile();
    if (!active || !active.compressedBlob) return;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        // PNG is standard for clipboard
        const res = await compressAndResize(active.originalUrl, {
          quality: state.quality,
          maxWidth: state.maxWidth || active.origWidth,
          maxHeight: state.maxHeight || active.origHeight,
          format: 'image/png',
          rotation: state.rotation,
          flipH: state.flipH,
          grayscale: state.grayscale
        });

        const item = new ClipboardItem({ 'image/png': res.blob });
        await navigator.clipboard.write([item]);
        showToast('Image copied to clipboard!');
      } else {
        showToast('Clipboard copy is not supported in this browser');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not copy image to clipboard');
    }
  }

  // Split Screen Comparison Logic
  function startSplitDrag(e) {
    isDraggingSplit = true;
    document.body.style.cursor = 'ew-resize';
  }

  function onSplitDrag(e) {
    if (!isDraggingSplit) return;
    const rect = comparisonContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    const percent = (x / rect.width) * 100;
    state.splitPercent = percent;

    splitHandle.style.left = `${percent}%`;
    compressedWrapper.style.clipPath = `inset(0 0 0 ${percent}%)`;
  }

  function endSplitDrag() {
    isDraggingSplit = false;
    document.body.style.cursor = 'default';
  }

  // Zoom Logic
  function adjustZoom(delta) {
    setZoom(Math.max(0.5, Math.min(3, state.zoom + delta)));
  }

  function setZoom(val) {
    state.zoom = val;
    zoomLevelText.textContent = `${Math.round(val * 100)}%`;
    imgOriginal.style.transform = `scale(${val})`;
    imgCompressed.style.transform = `scale(${val})`;
  }

  // Helper Functions
  function getOutputFilename(origName, mimeType) {
    const base = origName.substring(0, origName.lastIndexOf('.')) || origName;
    let ext = '.webp';
    if (mimeType === 'image/jpeg') ext = '.jpg';
    if (mimeType === 'image/png') ext = '.png';
    if (mimeType === 'image/avif') ext = '.avif';
    return `${base}-compressed${ext}`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    if (bytes < k) return `${bytes} B`;
    const kb = bytes / k;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  function truncateName(name, maxLen) {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 3) + '...';
  }

  function getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1920, height: 1080 });
      img.src = url;
    });
  }

  function updateActivePreset(val) {
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.quality, 10) === parseInt(val, 10));
    });
  }

  function updateActiveScale(scale) {
    scaleBtns.forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.scale) === scale);
    });
  }

  function checkFormatSupport() {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const isAvif = c.toDataURL('image/avif').startsWith('data:image/avif');
    if (!isAvif) {
      const avifOpt = formatSelect.querySelector('option[value="image/avif"]');
      if (avifOpt) avifOpt.textContent += ' (auto-fallback to WebP)';
    }
  }

  function isAvifSupported() {
    const c = document.createElement('canvas');
    return c.toDataURL('image/avif').startsWith('data:image/avif');
  }

  // Sample Photo Generator
  function loadSampleImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    // Draw rich scenic gradient backdrop
    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.4, '#4338ca');
    grad.addColorStop(0.7, '#6366f1');
    grad.addColorStop(1, '#a855f7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Glowing sun sphere
    const sunGrad = ctx.createRadialGradient(900, 220, 20, 900, 220, 180);
    sunGrad.addColorStop(0, '#fef08a');
    sunGrad.addColorStop(0.5, '#f59e0b');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(900, 220, 180, 0, Math.PI * 2);
    ctx.fill();

    // Mountain silhouettes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    ctx.lineTo(250, 420);
    ctx.lineTo(500, 580);
    ctx.lineTo(820, 360);
    ctx.lineTo(1100, 600);
    ctx.lineTo(1280, 480);
    ctx.lineTo(1280, 720);
    ctx.closePath();
    ctx.fill();

    // Geometric details & text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Client-Side Image Optimization', 80, 180);
    ctx.fillStyle = '#c7d2fe';
    ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('100% In-Browser Compression & Resizing Demo', 80, 230);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'demo-scenic-landscape.png', { type: 'image/png' });
      handleFiles([file]);
    }, 'image/png');
  }

  // Toast Notifications
  let toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${msg}</span>`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // Theme Management
  function setupTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  // PWA Support
  function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
    });

    if (pwaInstallBtn) {
      pwaInstallBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaInstallBtn.style.display = 'none';
        }
        deferredPrompt = null;
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration skipped:', err));
    }
  }

})();
