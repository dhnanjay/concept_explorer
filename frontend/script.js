// // frontend/script.js
// document.addEventListener('DOMContentLoaded', () => {
//     // --- DOM Elements ---
//     const form = document.getElementById('exploration-form');
//     const startButton = document.getElementById('start-button');
//     const statusArea = document.getElementById('status-area');
//     const chartContainer = document.getElementById('chart-container');
//     const providerSelect = document.getElementById('provider');
//     const modelInput = document.getElementById('model');
//     const settingsToggle = document.getElementById('settings-toggle');
//     const settingsPanel = document.getElementById('settings-panel');
//     const appHeader = document.getElementById('app-header');
//     const depthSlider = document.getElementById('depth-slider');
//     const depthValueDisplay = document.getElementById('depth-value');
//     const depthInput = document.getElementById('depth'); // The number input
//     const searchInput = document.getElementById('search-input');
//     const searchButton = document.getElementById('search-button');
//     const clearCacheButton = document.getElementById('clear-cache-button');
//     const downloadJsonButton = document.getElementById('download-json-button');
//     const downloadPngButton = document.getElementById('download-png-button');
//
//
//     // --- State ---
//     let eventSource = null;
//     let explorationChart = null;
//     let isExploring = false;
//     let currentTreeData = null;
//
//     // --- Theme Colors (from CSS variables) ---
//     const getCssVar = (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
//     const themeColors = { primary: getCssVar('--primary-color'), secondary: getCssVar('--secondary-color'), accent: getCssVar('--accent-color'), text: getCssVar('--text-color'), border: getCssVar('--border-color'), inputBg: getCssVar('--input-bg'), bg: getCssVar('--bg-color') };
//     function hexToRgb(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 209, 197'; }
//
//
//     // --- ECharts Base Configuration ---
//     const chartBaseOptions = {
//         tooltip: {
//             trigger: 'item', triggerOn: 'mousemove', confine: true,
//             backgroundColor: 'rgba(45, 55, 72, 0.9)', borderColor: themeColors.border,
//             textStyle: { color: themeColors.text, fontFamily: getCssVar('--font-mono'), fontSize: 11 },
//             // *** REFINED FORMATTER ***
//             formatter: (params) => {
//                 // Log the params object for debugging if needed
//                 // console.log('Tooltip Params:', params);
//
//                 // Basic check for valid data node
//                 if (!params || !params.data || !params.data.name) {
//                     return '';
//                 }
//
//                 // Extract data safely
//                 const nodeName = params.data.name;
//                 let depth = 'N/A'; // Default depth
//                 let path = nodeName; // Default path
//
//                 // Get depth (ECharts usually provides params.depth for tree charts)
//                 if (typeof params.depth === 'number') {
//                     depth = params.depth;
//                 } else if (typeof params.data.depth === 'number') { // Fallback to data if exists
//                      depth = params.data.depth;
//                 }
//
//                 // Get path from treePathInfo if it's a valid array
//                 if (Array.isArray(params.treePathInfo) && params.treePathInfo.length > 0) {
//                     path = params.treePathInfo.map(node => node.name).join(' → ');
//                 }
//                 // else path remains the nodeName (fallback)
//
//                 // Format the tooltip content
//                 return `
//                     <div style="font-family: ${getCssVar('--font-mono')}; font-size: 11px; max-width: 300px; white-space: normal; word-wrap: break-word;">
//                         <strong>Concept:</strong> ${nodeName}<br/>
//                         <strong>Depth:</strong> ${depth}<br/>
//                         <strong>Path:</strong> ${path}
//                     </div>
//                 `;
//             }
//         },
//         series: [{
//             type: 'tree', data: [], top: '5%', left: '7%', bottom: '5%', right: '15%', symbolSize: 8, roam: true,
//             label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 10, fontFamily: getCssVar('--font-mono'), color: themeColors.text, distance: 5, formatter: '{b}' },
//             leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left', color: themeColors.secondary } },
//             initialTreeDepth: -1, emphasis: { focus: 'descendant', lineStyle: { width: 2, color: themeColors.primary }, label: { color: themeColors.primary, fontWeight: 'bold' }, itemStyle: { borderColor: themeColors.secondary, borderWidth: 2 } }, expandAndCollapse: true, animationDuration: 400, animationDurationUpdate: 600, lineStyle: { color: '#a0aec0', width: 1, curveness: 0.5 },
//             itemStyle: { color: (params) => { const nodeDepth = params.data.depth === undefined ? params.depth : params.data.depth || 0; const maxDepthFade = 6; const alpha = Math.max(0.1, 1 - (nodeDepth / maxDepthFade)); return `rgba(${hexToRgb(themeColors.primary)}, ${alpha})`; }, borderColor: themeColors.primary, borderWidth: 1 }
//         }]
//     };
//
//
//     // --- Initialize ECharts (Deferred) ---
//     setTimeout(() => {
//         try {
//             if (!chartContainer) { console.error("Chart container element not found!"); return; }
//             if (chartContainer.offsetWidth === 0 || chartContainer.offsetHeight === 0) { console.warn("Chart container has zero dimensions on init."); }
//             explorationChart = echarts.init(chartContainer);
//
//             const cachedData = localStorage.getItem('lastTreeData'); let initialData = null; let statusMessage = "Configure settings or load cache."; let statusClass = 'status-info';
//             if (cachedData) {
//                 try { initialData = JSON.parse(cachedData); currentTreeData = initialData; console.log("Loaded tree data from localStorage."); statusMessage = "Loaded previous exploration from cache."; statusClass = 'status-success'; if(clearCacheButton) clearCacheButton.style.display = 'inline-block'; } catch (e) { console.error("Failed to parse cached data:", e); localStorage.removeItem('lastTreeData'); initialData = null; statusMessage = "Failed to load cached data."; statusClass = 'status-error'; }
//             }
//             explorationChart.setOption({ ...chartBaseOptions, series: [{ ...chartBaseOptions.series[0], data: initialData ? [initialData] : [{ name: 'Awaiting Exploration...', label: { color: themeColors.border }, children: [] }] }] });
//             if(statusArea) { statusArea.textContent = statusMessage; statusArea.className = statusClass; }
//             console.log("ECharts Initialized (deferred).");
//         } catch (error) { console.error("Failed to initialize ECharts:", error); if(statusArea) { statusArea.textContent = "Error initializing chart."; statusArea.className = 'status-error'; } }
//     }, 0);
//
//     // --- Settings Panel Toggle ---
//     settingsToggle?.addEventListener('click', () => { settingsPanel?.classList.toggle('settings-panel-visible'); const headerHeight = appHeader?.offsetHeight || 50; if(settingsPanel) settingsPanel.style.top = `${headerHeight}px`; if(settingsToggle) { settingsToggle.textContent = settingsPanel?.classList.contains('settings-panel-visible') ? '[ Hide Settings ]' : '[ Settings ]'; } });
//
//     // --- Depth Slider Sync ---
//     depthSlider?.addEventListener('input', () => { if (depthInput) depthInput.value = depthSlider.value; if (depthValueDisplay) depthValueDisplay.textContent = depthSlider.value; });
//     depthInput?.addEventListener('input', () => { let value = parseInt(depthInput.value, 10); const min = parseInt(depthInput.min, 10) || 1; const max = parseInt(depthInput.max, 10) || 8; if (isNaN(value) || value < min) value = min; if (value > max) value = max; depthInput.value = value; if (depthSlider) depthSlider.value = value; if (depthValueDisplay) depthValueDisplay.textContent = value; });
//     if (depthInput && depthValueDisplay) { depthValueDisplay.textContent = depthInput.value; } if (depthInput && depthSlider) { depthSlider.value = depthInput.value; }
//
//     // --- Update Model Placeholder ---
//     function updateModelPlaceholder() { if(!providerSelect || !modelInput) return; modelInput.placeholder = (providerSelect.value === 'gemini') ? "gemini-1.5-flash (default)" : "gpt-4o-mini (default)"; modelInput.value = ''; }
//     providerSelect?.addEventListener('change', updateModelPlaceholder); updateModelPlaceholder();
//
//     // --- Form Submission Handler ---
//     form?.addEventListener('submit', (event) => {
//         event.preventDefault(); if (isExploring || !explorationChart) { console.warn("Busy or chart not ready."); return; } if (eventSource) eventSource.close();
//         isExploring = true; if(startButton) { startButton.disabled = true; startButton.textContent = 'Exploring...'; } if(statusArea) { statusArea.textContent = 'Initiating exploration...'; statusArea.className = 'status-info'; } appHeader?.classList.add('header-shrunk'); settingsPanel?.classList.remove('settings-panel-visible'); if(settingsToggle) settingsToggle.textContent = '[ Settings ]'; setTimeout(() => { if(appHeader && settingsPanel) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } }, 50);
//         currentTreeData = null; explorationChart.setOption({ series: [{ ...chartBaseOptions.series[0], data: [{ name: 'Loading...', label: { color: themeColors.border }, children: [] }] }] }, true); explorationChart.showLoading({ text: 'Querying AI...', color: themeColors.primary, textColor: themeColors.text, maskColor: 'rgba(26, 32, 44, 0.7)', zlevel: 0 });
//         const formData = new FormData(form); const rootConcept = formData.get('root_concept'); const provider = formData.get('provider'); let model = formData.get('model').trim(); if (!model) { model = (provider === 'gemini') ? 'gemini-1.5-flash-latest' : 'gpt-4o-mini'; console.log(`Using default model: ${model}`); } const apiKey = formData.get('api_key'); const depth = formData.get('depth'); const sleepDuration = formData.get('sleep_duration'); const diversity = formData.get('diversity');
//         const queryParams = new URLSearchParams({ root_concept: rootConcept, provider: provider, model: model, depth: depth, sleep_duration: sleepDuration, diversity: diversity }); if (apiKey) queryParams.append('api_key', apiKey); const sseUrl = `/stream_exploration?${queryParams.toString()}`;
//         const logUrlParams = new URLSearchParams(queryParams); logUrlParams.delete('api_key'); console.log(`Connecting to SSE: /stream_exploration?${logUrlParams.toString()}`);
//         try {
//             eventSource = new EventSource(sseUrl);
//             eventSource.onopen = () => { console.log("SSE connection established."); if(statusArea) { statusArea.textContent = "Connection established. Exploring..."; statusArea.className = 'status-info'; } };
//             eventSource.onmessage = (event) => { /* console.log("SSE message received:", event.data); */ if (explorationChart) explorationChart.hideLoading(); try { const data = JSON.parse(event.data); if (data.type === 'status') { if(statusArea) { statusArea.textContent = `Status: ${data.message}`; statusArea.className = 'status-info'; } if (data.current_concept) console.log("Currently exploring:", data.current_concept); if (data.graph && data.graph.name !== "No Exploration Yet") updateChart(data.graph); } else if (data.type === 'graph_update') { if (data.graph && data.graph.name !== "No Exploration Yet") { updateChart(data.graph); if (statusArea && !statusArea.textContent.startsWith("Status: Exploration complete!")) { statusArea.textContent = `Status: Graph updated.`; statusArea.className = 'status-info'; } } else { console.warn("Received graph_update without valid graph data:", data); } } else if (data.type === 'error') { console.error("Backend Error:", data.message); if(statusArea) { statusArea.textContent = `Error: ${data.message}`; statusArea.className = 'status-error'; } if (explorationChart) explorationChart.hideLoading(); resetAppState(); if(eventSource) eventSource.close(); } else if (data.type === 'done') { console.log("Exploration marked as done by backend."); if(statusArea) { statusArea.textContent = "Exploration complete!"; statusArea.className = 'status-success'; } if (explorationChart) explorationChart.hideLoading(); if (data.graph && data.graph.name !== "No Exploration Yet") { updateChart(data.graph); try { currentTreeData = data.graph; localStorage.setItem('lastTreeData', JSON.stringify(currentTreeData)); console.log("Saved final tree data to localStorage."); if(clearCacheButton) clearCacheButton.style.display = 'inline-block'; } catch (e) { console.error("Failed to save to localStorage:", e); } } resetAppState(); appHeader?.classList.add('header-shrunk'); if(eventSource) eventSource.close(); } } catch (error) { console.error("Failed to parse SSE message or update UI:", error, "Data:", event.data); if (statusArea && !statusArea.textContent.startsWith("Error:")) { statusArea.textContent = "Received unparseable message."; statusArea.className = 'status-error'; } if (explorationChart) explorationChart.hideLoading(); resetAppState(); if(eventSource) eventSource.close(); } };
//             eventSource.onerror = (error) => { console.error("EventSource failed:", error); if(statusArea) { statusArea.textContent = "Connection error."; statusArea.className = 'status-error'; } if (explorationChart) explorationChart.hideLoading(); resetAppState(); if (eventSource) eventSource.close(); };
//         } catch (error) { console.error("Failed to create EventSource:", error); if(statusArea) { statusArea.textContent = "Failed to connect to backend."; statusArea.className = 'status-error'; } if (explorationChart) explorationChart.hideLoading(); resetAppState(); }
//     });
//
//     // --- Helper to Update ECharts ---
//     function updateChart(treeData) {
//         if (!explorationChart) { console.warn("Chart not initialized."); return; } if (!treeData) { console.warn("No tree data provided."); return; }
//         currentTreeData = treeData; // Store latest data
//         // console.log("Updating chart with data:", JSON.stringify(treeData, null, 2));
//         explorationChart.hideLoading();
//         try { explorationChart.setOption({ tooltip: chartBaseOptions.tooltip, series: [{ ...chartBaseOptions.series[0], data: [treeData] }] }, false); explorationChart.resize(); } catch (e) { console.error("Error during chart.setOption:", e); if(statusArea) { statusArea.textContent = `Error updating chart: ${e.message}`; statusArea.className = 'status-error'; } }
//     }
//
//     // --- Helper to Reset Button/State ---
//     function resetAppState() { isExploring = false; if (startButton) { startButton.disabled = false; startButton.textContent = 'Start Exploration'; } }
//
//     // --- Search Functionality ---
//     function findNodeByNameRecursive(node, targetNameLower) { if (!node) return null; if (node.name && node.name.toLowerCase() === targetNameLower) return node; if (node.children) { for (const child of node.children) { const found = findNodeByNameRecursive(child, targetNameLower); if (found) return found; } } return null; }
//     searchButton?.addEventListener('click', () => { const searchTerm = searchInput?.value.trim().toLowerCase(); if (!searchTerm || !explorationChart || !currentTreeData) { if(statusArea) { statusArea.textContent = "Enter search term or run exploration first."; statusArea.className = 'status-error'; } return; } const foundNode = findNodeByNameRecursive(currentTreeData, searchTerm); if (foundNode) { if(statusArea) { statusArea.textContent = `Highlighting node: ${foundNode.name}`; statusArea.className = 'status-info'; } console.log("Highlighting node:", foundNode.name); explorationChart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: foundNode.name }); explorationChart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: foundNode.name }); chartContainer?.focus(); } else { if(statusArea) { statusArea.textContent = `Node "${searchInput?.value.trim()}" not found.`; statusArea.className = 'status-error'; } explorationChart.dispatchAction({ type: 'downplay', seriesIndex: 0 }); } });
//     searchInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchButton?.click(); } });
//
//      // --- Download Functionality ---
//      function triggerDownload(blob, filename) { console.log(`Triggering download for: ${filename}`); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = filename; document.body.appendChild(a); console.log("Temporary link created:", a); a.click(); console.log("Link clicked."); setTimeout(() => { console.log("Revoking object URL and removing link."); URL.revokeObjectURL(url); if (a.parentNode) { a.parentNode.removeChild(a); } }, 100); }
//      downloadJsonButton?.addEventListener('click', () => { console.log("Download JSON button clicked."); if (!currentTreeData) { console.log("No currentTreeData for JSON download."); if(statusArea) { statusArea.textContent = "No tree data available to download."; statusArea.className = 'status-error'; } return; } console.log("Current tree data exists for JSON download:", currentTreeData); try { const jsonString = JSON.stringify(currentTreeData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`; triggerDownload(blob, filename); if(statusArea) { statusArea.textContent = "Downloading JSON..."; statusArea.className = 'status-info'; } } catch (e) { console.error("Error creating JSON for download:", e); if(statusArea) { statusArea.textContent = "Error preparing JSON download."; statusArea.className = 'status-error'; } } });
//      downloadPngButton?.addEventListener('click', () => { console.log("Download PNG button clicked."); if (!explorationChart) { console.log("ECharts instance not available for PNG download."); if(statusArea) { statusArea.textContent = "Chart not ready for download."; statusArea.className = 'status-error'; } return; } if (!currentTreeData) { console.log("No currentTreeData for PNG download."); if(statusArea) { statusArea.textContent = "No chart data available to download."; statusArea.className = 'status-error'; } return; } console.log("Chart instance and data exist for PNG download."); try { const dataUrl = explorationChart.getDataURL({ type: 'png', backgroundColor: getCssVar('--input-bg') || '#2d3748', pixelRatio: 2 }); console.log("Generated PNG Data URL (length):", dataUrl.length); const a = document.createElement('a'); a.style.display = 'none'; a.href = dataUrl; const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`; a.download = filename; document.body.appendChild(a); console.log("Temporary link created for PNG:", a); a.click(); console.log("PNG Link clicked."); document.body.removeChild(a); if(statusArea) { statusArea.textContent = "Downloading PNG..."; statusArea.className = 'status-info'; } } catch (e) { console.error("Error creating PNG for download:", e); if(statusArea) { statusArea.textContent = "Error preparing PNG download."; statusArea.className = 'status-error'; } } });
//
//      // --- Clear Cache ---
//      clearCacheButton?.addEventListener('click', () => { localStorage.removeItem('lastTreeData'); currentTreeData = null; explorationChart?.setOption({ series: [{ data: [{ name: 'Awaiting Exploration...', label: { color: themeColors.border }, children: [] }] }] }, true); if(statusArea) { statusArea.textContent = "Cache cleared."; statusArea.className = 'status-info'; } if(clearCacheButton) clearCacheButton.style.display = 'none'; console.log("Cleared localStorage and reset chart."); });
//
//      // --- Resize Chart on Window Resize ---
//      window.addEventListener('resize', () => { if (explorationChart) { setTimeout(() => { try { explorationChart.resize(); } catch (e) { console.error("Error resizing chart:", e); } }, 150); } if (appHeader && settingsPanel && (settingsPanel.classList.contains('settings-panel-visible') || isExploring)) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } });
//      // Initial adjustment for settings panel top & clear button visibility
//      if (appHeader && settingsPanel) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } if (localStorage.getItem('lastTreeData') && clearCacheButton) { clearCacheButton.style.display = 'inline-block'; }
//
// }); // End DOMContentLoaded
//
// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const form = document.getElementById('exploration-form'); // Still needed for settings
    const statusArea = document.getElementById('status-area');
    const chartContainer = document.getElementById('chart-container');
    const providerSelect = document.getElementById('provider');
    const modelInput = document.getElementById('model');
    const apiKeyInput = document.getElementById('api_key'); // Get reference to API key input
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const appHeader = document.getElementById('app-header');
    const depthSlider = document.getElementById('depth-slider');
    const depthValueDisplay = document.getElementById('depth-value');
    const depthInput = document.getElementById('depth');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearCacheButton = document.getElementById('clear-cache-button');
    const downloadJsonButton = document.getElementById('download-json-button');
    const downloadPngButton = document.getElementById('download-png-button');
    // *** NEW: Hero Elements ***
    const heroRootInput = document.getElementById('root_concept_hero');
    const heroStartButton = document.getElementById('start-button-hero');


    // --- State ---
    let eventSource = null;
    let explorationChart = null;
    let isExploring = false;
    let currentTreeData = null;

    // --- Theme Colors (from CSS variables) ---
    const getCssVar = (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    const themeColors = { primary: getCssVar('--primary-color'), secondary: getCssVar('--secondary-color'), accent: getCssVar('--accent-color'), text: getCssVar('--text-color'), border: getCssVar('--border-color'), inputBg: getCssVar('--input-bg'), bg: getCssVar('--bg-color') };
    function hexToRgb(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 209, 197'; }

    // --- Helper to update status area ---
    function updateStatus(message, type = 'info') {
        if (statusArea) {
            statusArea.textContent = message;
            // Simple mapping to class names
            const typeClassMap = {
                info: 'status-info',
                error: 'status-error',
                success: 'status-success'
            };
            statusArea.className = typeClassMap[type] || 'status-info';
        }
    }

    // --- ECharts Base Configuration ---
    const chartBaseOptions = {
        tooltip: {
            trigger: 'item', triggerOn: 'mousemove', confine: true,
            backgroundColor: 'rgba(45, 55, 72, 0.9)', borderColor: themeColors.border,
            textStyle: { color: themeColors.text, fontFamily: getCssVar('--font-mono'), fontSize: 11 },
            formatter: (params) => {
                // console.log('Tooltip Params:', params); // Keep commented unless debugging tooltips
                if (!params || !params.data || !params.data.name) return '';
                const nodeName = params.data.name;
                let depth = 'N/A'; let path = nodeName;
                if (typeof params.depth === 'number') { depth = params.depth; } else if (typeof params.data.depth === 'number') { depth = params.data.depth; }
                if (Array.isArray(params.treePathInfo) && params.treePathInfo.length > 0) { path = params.treePathInfo.map(node => node.name).join(' → '); }
                return `<div style="font-family: ${getCssVar('--font-mono')}; font-size: 11px; max-width: 300px; white-space: normal; word-wrap: break-word;"><strong>Concept:</strong> ${nodeName}<br/><strong>Depth:</strong> ${depth !== undefined ? depth : 'N/A'}<br/><strong>Path:</strong> ${path}</div>`;
            }
        },
        series: [{
            type: 'tree', data: [], top: '5%', left: '7%', bottom: '5%', right: '15%', symbolSize: 8, roam: true,
            label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 10, fontFamily: getCssVar('--font-mono'), color: themeColors.text, distance: 5, formatter: '{b}' },
            leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left', color: themeColors.secondary } },
            initialTreeDepth: -1, emphasis: { focus: 'descendant', lineStyle: { width: 2, color: themeColors.primary }, label: { color: themeColors.primary, fontWeight: 'bold' }, itemStyle: { borderColor: themeColors.secondary, borderWidth: 2 } }, expandAndCollapse: true, animationDuration: 400, animationDurationUpdate: 600, lineStyle: { color: '#a0aec0', width: 1, curveness: 0.5 },
            itemStyle: { color: (params) => { const nodeDepth = params.data.depth === undefined ? params.depth : params.data.depth || 0; const maxDepthFade = 6; const alpha = Math.max(0.1, 1 - (nodeDepth / maxDepthFade)); return `rgba(${hexToRgb(themeColors.primary)}, ${alpha})`; }, borderColor: themeColors.primary, borderWidth: 1 }
        }]
    };


    // --- Initialize ECharts (Deferred) ---
    setTimeout(() => {
        try {
            if (!chartContainer) { console.error("Chart container element not found!"); return; }
            explorationChart = echarts.init(chartContainer);
            const cachedData = localStorage.getItem('lastTreeData'); let initialData = null; let statusMessage = "Enter root concept to explore, or load cache."; let statusClass = 'status-info';
            if (cachedData) {
                try { initialData = JSON.parse(cachedData); currentTreeData = initialData; statusMessage = "Loaded previous exploration from cache."; statusClass = 'status-success'; if(clearCacheButton) clearCacheButton.style.display = 'inline-block'; } catch (e) { console.error("Failed to parse cached data:", e); localStorage.removeItem('lastTreeData'); initialData = null; statusMessage = "Failed to load cached data."; statusClass = 'status-error'; }
            }
            explorationChart.setOption({ ...chartBaseOptions, series: [{ ...chartBaseOptions.series[0], data: initialData ? [initialData] : [{ name: 'Awaiting Exploration...', label: { color: themeColors.border }, children: [] }] }] });
            updateStatus(statusMessage, statusClass);
            // ECharts Initialized log removed
        } catch (error) { console.error("Failed to initialize ECharts:", error); updateStatus("Error initializing chart.", "error"); }
    }, 0);

    // --- Settings Panel Toggle ---
    settingsToggle?.addEventListener('click', () => { settingsPanel?.classList.toggle('settings-panel-visible'); const headerHeight = appHeader?.offsetHeight || 50; if(settingsPanel) settingsPanel.style.top = `${headerHeight}px`; if(settingsToggle) { settingsToggle.textContent = settingsPanel?.classList.contains('settings-panel-visible') ? '[ Hide Settings ]' : '[ Settings ]'; } });

    // --- Depth Slider Sync ---
    depthSlider?.addEventListener('input', () => { if (depthInput) depthInput.value = depthSlider.value; if (depthValueDisplay) depthValueDisplay.textContent = depthSlider.value; });
    depthInput?.addEventListener('input', () => { let value = parseInt(depthInput.value, 10); const min = parseInt(depthInput.min, 10) || 1; const max = parseInt(depthInput.max, 10) || 8; if (isNaN(value) || value < min) value = min; if (value > max) value = max; depthInput.value = value; if (depthSlider) depthSlider.value = value; if (depthValueDisplay) depthValueDisplay.textContent = value; });
    if (depthInput && depthValueDisplay) { depthValueDisplay.textContent = depthInput.value; } if (depthInput && depthSlider) { depthSlider.value = depthInput.value; }

    // --- Update Model Placeholder ---
    function updateModelPlaceholder() { if(!providerSelect || !modelInput) return; modelInput.placeholder = "Backend Default"; apiKeyInput.placeholder = "Backend Default"; modelInput.value = ''; apiKeyInput.value = ''; } // Clear both on provider change
    providerSelect?.addEventListener('change', updateModelPlaceholder); updateModelPlaceholder();


    // --- Core Exploration Logic (Refactored Function) ---
    function startExploration(rootConceptValue) {
        if (isExploring || !explorationChart) { return; }
        if (eventSource) eventSource.close();

        isExploring = true;
        if(heroStartButton) { heroStartButton.disabled = true; heroStartButton.textContent = 'Exploring...'; }
        updateStatus('Initiating exploration...', 'info');
        appHeader?.classList.add('header-shrunk');
        settingsPanel?.classList.remove('settings-panel-visible');
        if(settingsToggle) settingsToggle.textContent = '[ Settings ]';
        setTimeout(() => { if(appHeader && settingsPanel) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } }, 50);

        currentTreeData = null;
        explorationChart.setOption({ series: [{ ...chartBaseOptions.series[0], data: [{ name: 'Loading...', label: { color: themeColors.border }, children: [] }] }] }, true);
        explorationChart.showLoading({ text: 'Querying AI...', color: themeColors.primary, textColor: themeColors.text, maskColor: 'rgba(26, 32, 44, 0.7)', zlevel: 0 });

        // --- Get Form Data (from settings panel form) ---
        const formData = new FormData(form);
        const provider = formData.get('provider');
        const modelValue = formData.get('model')?.trim();
        const apiKeyValue = formData.get('api_key'); // Don't trim API keys
        const depth = formData.get('depth');
        const sleepDuration = formData.get('sleep_duration');
        const diversity = formData.get('diversity');

        // --- Construct SSE URL ---
        const queryParams = new URLSearchParams({ root_concept: rootConceptValue, provider: provider, depth: depth, sleep_duration: sleepDuration, diversity: diversity });
        // Only add model and api_key if provided in the form
        if (modelValue) { queryParams.append('model', modelValue); }
        if (apiKeyValue) { queryParams.append('api_key', apiKeyValue); }

        const sseUrl = `/stream_exploration?${queryParams.toString()}`;
        // Connecting log removed

        // --- Establish SSE Connection ---
        try {
            eventSource = new EventSource(sseUrl);

            eventSource.onopen = () => { updateStatus("Connection established. Exploring...", "info"); };

            eventSource.onmessage = (event) => {
                if (explorationChart) explorationChart.hideLoading();
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'status') { updateStatus(`Status: ${data.message}`, 'info'); if (data.graph && data.graph.name !== "No Exploration Yet") updateChart(data.graph); }
                    else if (data.type === 'graph_update') { if (data.graph && data.graph.name !== "No Exploration Yet") { updateChart(data.graph); if (statusArea && !statusArea.textContent.startsWith("Status: Exploration complete!")) { updateStatus(`Status: Graph updated.`, 'info'); } } }
                    else if (data.type === 'error') { console.error("Backend Error:", data.message); updateStatus(`Error: ${data.message}`, 'error'); if (explorationChart) explorationChart.hideLoading(); resetAppState(); if(eventSource) eventSource.close(); }
                    else if (data.type === 'done') { updateStatus("Exploration complete!", 'success'); if (explorationChart) explorationChart.hideLoading(); if (data.graph && data.graph.name !== "No Exploration Yet") { updateChart(data.graph); try { currentTreeData = data.graph; localStorage.setItem('lastTreeData', JSON.stringify(currentTreeData)); if(clearCacheButton) clearCacheButton.style.display = 'inline-block'; } catch (e) { console.error("Failed to save to localStorage:", e); } } resetAppState(); appHeader?.classList.add('header-shrunk'); if(eventSource) eventSource.close(); }
                } catch (error) { console.error("Failed to parse SSE message or update UI:", error, "Data:", event.data); if (statusArea && !statusArea.textContent.startsWith("Error:")) { updateStatus("Received unparseable message.", "error"); } if (explorationChart) explorationChart.hideLoading(); resetAppState(); if(eventSource) eventSource.close(); }
            };

            eventSource.onerror = (error) => { console.error("EventSource failed:", error); updateStatus("Connection error.", "error"); if (explorationChart) explorationChart.hideLoading(); resetAppState(); if (eventSource) eventSource.close(); };
        } catch (error) { console.error("Failed to create EventSource:", error); updateStatus("Failed to connect to backend.", "error"); if (explorationChart) explorationChart.hideLoading(); resetAppState(); }
    }


    // --- Attach Listener to Hero Button ---
    heroStartButton?.addEventListener('click', () => {
        const root = heroRootInput?.value.trim();
        if (!root) { updateStatus("Please enter a root concept.", "error"); return; }
        startExploration(root);
    });
     heroRootInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); heroStartButton?.click(); } });


    // --- Helper to Update ECharts ---
    function updateChart(treeData) {
        if (!explorationChart) { return; } if (!treeData) { return; }
        currentTreeData = treeData; // Store latest data
        explorationChart.hideLoading();
        try { explorationChart.setOption({ tooltip: chartBaseOptions.tooltip, series: [{ ...chartBaseOptions.series[0], data: [treeData] }] }, false); explorationChart.resize(); } catch (e) { console.error("Error during chart.setOption:", e); updateStatus(`Error updating chart: ${e.message}`, 'error'); }
    }

    // --- Helper to Reset Button/State ---
    function resetAppState() { isExploring = false; if (heroStartButton) { heroStartButton.disabled = false; heroStartButton.textContent = 'Explore'; } }

    // --- Search Functionality ---
    function findNodeByNameRecursive(node, targetNameLower) { if (!node) return null; if (node.name && node.name.toLowerCase() === targetNameLower) return node; if (node.children) { for (const child of node.children) { const found = findNodeByNameRecursive(child, targetNameLower); if (found) return found; } } return null; }
    searchButton?.addEventListener('click', () => { const searchTerm = searchInput?.value.trim().toLowerCase(); if (!searchTerm || !explorationChart || !currentTreeData) { updateStatus("Enter search term or run exploration first.", "error"); return; } const foundNode = findNodeByNameRecursive(currentTreeData, searchTerm); if (foundNode) { updateStatus(`Highlighting node: ${foundNode.name}`, 'info'); explorationChart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: foundNode.name }); explorationChart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: foundNode.name }); chartContainer?.focus(); } else { updateStatus(`Node "${searchInput?.value.trim()}" not found.`, 'error'); explorationChart.dispatchAction({ type: 'downplay', seriesIndex: 0 }); } });
    searchInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchButton?.click(); } });

     // --- Download Functionality ---
     function triggerDownload(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); if (a.parentNode) { a.parentNode.removeChild(a); } }, 100); }
     downloadJsonButton?.addEventListener('click', () => { if (!currentTreeData) { updateStatus("No tree data available to download.", "error"); return; } try { const jsonString = JSON.stringify(currentTreeData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`; triggerDownload(blob, filename); updateStatus("Downloading JSON...", "info"); } catch (e) { console.error("Error creating JSON for download:", e); updateStatus("Error preparing JSON download.", "error"); } });
     downloadPngButton?.addEventListener('click', () => { if (!explorationChart || !currentTreeData) { updateStatus("No chart available to download.", "error"); return; } try { const dataUrl = explorationChart.getDataURL({ type: 'png', backgroundColor: getCssVar('--input-bg') || '#2d3748', pixelRatio: 2 }); const a = document.createElement('a'); a.style.display = 'none'; a.href = dataUrl; const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); updateStatus("Downloading PNG...", "info"); } catch (e) { console.error("Error creating PNG for download:", e); updateStatus("Error preparing PNG download.", "error"); } });

     // --- Clear Cache ---
     clearCacheButton?.addEventListener('click', () => { localStorage.removeItem('lastTreeData'); currentTreeData = null; explorationChart?.setOption({ series: [{ data: [{ name: 'Awaiting Exploration...', label: { color: themeColors.border }, children: [] }] }] }, true); updateStatus("Cache cleared.", "info"); if(clearCacheButton) clearCacheButton.style.display = 'none'; });

     // --- Resize Chart on Window Resize ---
     window.addEventListener('resize', () => { if (explorationChart) { setTimeout(() => { try { explorationChart.resize(); } catch (e) { console.error("Error resizing chart:", e); } }, 150); } if (appHeader && settingsPanel && (settingsPanel.classList.contains('settings-panel-visible') || isExploring)) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } });
     // Initial adjustment for settings panel top & clear button visibility
     if (appHeader && settingsPanel) { settingsPanel.style.top = `${appHeader.offsetHeight}px`; } if (localStorage.getItem('lastTreeData') && clearCacheButton) { clearCacheButton.style.display = 'inline-block'; }

}); // End DOMContentLoaded
