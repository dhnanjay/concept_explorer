// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM references ---
  const header              = document.querySelector('header');
  const settingsToggle      = document.getElementById('settings-toggle');
  const settingsPanel       = document.getElementById('settings-panel');
  const heroRootInput       = document.getElementById('root_concept_hero');
  const heroStartButton     = document.getElementById('start-button-hero');
  const chartContainer      = document.getElementById('chart-container');
  const resultPanel         = document.getElementById('result-panel');
  const resultsContainer    = document.getElementById('results-container');
  const searchLoadingIndicator = document.getElementById('search-loading-indicator'); // Loading indicator
  const form                = document.getElementById('exploration-form');
  const depthSlider         = document.getElementById('depth-slider');
  const depthInput          = document.getElementById('depth');
  const depthValueDisplay   = document.getElementById('depth-value');
  const resizer             = document.getElementById('resizer');
  const clearCacheButton    = document.getElementById('clear-cache-button');
  const downloadJsonButton  = document.getElementById('download-json-button');
  const downloadPngButton   = document.getElementById('download-png-button');


  // --- State ---
  let explorationChart = null;
  let eventSource      = null;
  let currentTreeData  = null;
  let isExploring      = false;
  let searchCache      = {}; // Cache for search results { pathQuery: resultsHTML }

  // --- CSS Vars Helper ---
  const getCssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const themeColors = { primary: getCssVar('--primary-color') || '#4fd1c5', secondary: getCssVar('--secondary-color') || '#f6e05e', accent: getCssVar('--accent-color') || '#f687b3', text: getCssVar('--text-color') || '#e2e8f0', border: getCssVar('--border-color') || '#4a5568', inputBg: getCssVar('--input-bg') || '#2d3748', };
  const hexToRgb = hex => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? `${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)}` : '79, 209, 197'; };

  // --- Status Updater ---
  function updateStatus(msg, type='info') {
      // Log status updates to the console for debugging/info // to make it work uncomment the below line
      // console[type === 'error' ? 'error' : 'log'](`Status (${type}): ${msg}`);
      // In a production scenario, you might update a dedicated status bar element
      // For now, console logs provide the necessary feedback during development.
  }

  // --- Chart Base Options ---
  const chartBaseOptions = {
    tooltip: {
      trigger: 'item', triggerOn: 'mousemove', confine: true, backgroundColor: 'rgba(45,55,72,0.9)', borderColor: themeColors.border,
      textStyle: { color: themeColors.text, fontFamily: getCssVar('--font-mono'), fontSize: 11 },
      // Tooltip formatter using treeAncestors (Corrected based on console logs)
      formatter: params => {
        // console.log('Tooltip Params:', params); // Keep commented unless debugging tooltips
        if (!params || !params.data || !params.data.name) return '';
        const nodeName = params.data.name;
        let depth = 'N/A'; let path = nodeName;
        // Calculate depth and path using treeAncestors if available
        if (Array.isArray(params.treeAncestors) && params.treeAncestors.length > 0) {
            // Depth is the number of ancestors minus the invisible root (index 0)
            // and adjust for 0-based index. So length - 2.
            depth = Math.max(0, params.treeAncestors.length - 2);
            // Path is the names of ancestors, skipping the invisible root (index 0)
            const pathArr = params.treeAncestors.slice(1).map(ancestor => ancestor.name); // Start from index 1
            path = pathArr.join(' → ');
        }
        return `<div style="font-family: ${getCssVar('--font-mono')}; font-size: 11px; max-width: 300px; white-space: normal; word-wrap: break-word;"><strong>Concept:</strong> ${nodeName}<br/><strong>Depth:</strong> ${depth}<br/><strong>Path:</strong> ${path}</div>`;
      }
    },
    series: [{
      type: 'tree', data: [], top: '5%', left:'7%', bottom:'5%', right:'15%', symbolSize: 8, roam: true,
      label: { position:'left', verticalAlign:'middle', align:'right', fontSize:10, fontFamily: getCssVar('--font-mono'), color: themeColors.text, distance:5, formatter:'{b}' },
      leaves: { label:{ position:'right', verticalAlign:'middle', align:'left', color: themeColors.secondary } },
      initialTreeDepth: -1, expandAndCollapse: true, animationDuration:400, animationDurationUpdate:600, lineStyle:{ color:'#a0aec0', width:1, curveness:0.5 },
      emphasis:{ focus:'descendant', lineStyle:{ width:2, color:themeColors.primary }, label:{ color:themeColors.primary, fontWeight:'bold' }, itemStyle:{ borderColor:themeColors.secondary, borderWidth:2 } },
      // Update itemStyle color to use the reliable treeAncestors for depth calculation
      itemStyle:{
        color: params => {
            const depth = (Array.isArray(params.treeAncestors) && params.treeAncestors.length > 0) ? Math.max(0, params.treeAncestors.length - 2) : 0;
            const maxDepthFade = 6; const alpha = Math.max(0.1, 1 - depth / maxDepthFade);
            return `rgba(${hexToRgb(themeColors.primary)},${alpha})`;
          },
        borderColor: themeColors.primary, borderWidth:1
      }
    }]
  };

  // --- Initialize ECharts + load cache ---
  if (chartContainer) {
    try {
        explorationChart = echarts.init(chartContainer);
        const cached = localStorage.getItem('lastTreeData'); let initial = null;
        if (cached) { try { initial = JSON.parse(cached); currentTreeData = initial; if (clearCacheButton) clearCacheButton.style.display = 'inline-block'; updateStatus('Loaded cached exploration','success'); } catch(e){ console.error("Failed to parse cached data:", e); localStorage.removeItem('lastTreeData'); updateStatus('Cleared corrupt cache','error'); } }
        explorationChart.setOption({ ...chartBaseOptions, series:[{ ...chartBaseOptions.series[0], data: initial ? [initial] : [{ name:'Awaiting Exploration…', children:[] }] }] });

        // --- ECharts Click Handler (Checks Cache, Calls Tavily Search on LEAF nodes using FULL PATH) ---
        explorationChart.on('click', params => {
          if (!params.data || !params.data.name) return;
          const isLeaf = !params.data.children || (Array.isArray(params.data.children) && params.data.children.length === 0);
          if (!isLeaf) return; // Only search leaves

          const nodeName = params.data.name;
          let query = nodeName; // Default query is just the node name

          // *** Construct full path query using treeAncestors ***
          if (Array.isArray(params.treeAncestors) && params.treeAncestors.length > 0) {
              const pathArr = params.treeAncestors.slice(1).map(ancestor => ancestor.name); // Skip invisible root
              query = pathArr.join(' → '); // Use full path as the query
          }
          // *** Use the path query for cache key and API call ***

          // Update result panel title (still use just the node name for title)
          const titleEl = resultPanel?.querySelector('h2');
          if (titleEl) { titleEl.firstChild.textContent = `Search Results for: ${nodeName} `; }

          // Check cache using the full path query as the key
          if (searchCache[query]) {
            if (resultsContainer) { resultsContainer.innerHTML = searchCache[query]; }
            updateStatus(`Displaying cached results for path: ${query}`, 'info');
            searchLoadingIndicator?.classList.add('hidden');
          } else {
            // Fetch results using the full path query
            loadTavilyResults(query);
          }
        });

    } catch (err) { console.error("Failed to initialize ECharts:", err); if (chartContainer) chartContainer.innerHTML = "<p class='p-4 text-red-400'>Error initializing chart.</p>"; }
  } else { console.error("Chart container element not found!"); }

  // --- Settings toggle ---
  if (settingsToggle && settingsPanel && header) { settingsToggle.addEventListener('click', () => { settingsPanel.classList.toggle('settings-panel-visible'); settingsPanel.style.top = `${header.offsetHeight}px`; settingsToggle.textContent = settingsPanel.classList.contains('settings-panel-visible') ? '[ Hide Settings ]' : '[ Settings ]'; }); }

  // --- Depth slider sync ---
  if (depthSlider && depthInput && depthValueDisplay) { depthValueDisplay.textContent = depthInput.value; depthSlider.value = depthInput.value; depthSlider.addEventListener('input', () => { depthInput.value = depthSlider.value; depthValueDisplay.textContent = depthSlider.value; }); depthInput.addEventListener('input', () => { let v = parseInt(depthInput.value,10); const mn = parseInt(depthInput.min,10)||1, mx = parseInt(depthInput.max,10)||8; if (isNaN(v)||v<mn) v=mn; if (v>mx) v=mx; depthInput.value = v; depthSlider.value = v; depthValueDisplay.textContent = v; }); }

  // --- Draggable Resizer Logic ---
  if (resizer && chartContainer && resultPanel) {
      let isResizing = false; let startX = 0; let startChartFlexBasis = 0; let startResultFlexBasis = 0;
      resizer.addEventListener('mousedown', (e) => { isResizing = true; startX = e.clientX; startChartFlexBasis = chartContainer.offsetWidth; startResultFlexBasis = resultPanel.offsetWidth; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); });
      const handleMouseMove = (e) => { if (!isResizing) return; const dx = e.clientX - startX; const newChartWidth = startChartFlexBasis + dx; const newResultWidth = startResultFlexBasis - dx; const totalWidth = startChartFlexBasis + startResultFlexBasis; const minWidth = 150; if (newChartWidth >= minWidth && newResultWidth >= minWidth) { const newChartBasis = (newChartWidth / totalWidth) * 100; const newResultBasis = (newResultWidth / totalWidth) * 100; chartContainer.style.flexBasis = `${newChartBasis}%`; resultPanel.style.flexBasis = `${newResultBasis}%`; chartContainer.style.flexGrow = '0'; chartContainer.style.flexShrink = '0'; resultPanel.style.flexGrow = '0'; resultPanel.style.flexShrink = '0'; if (explorationChart) { clearTimeout(resizer._debounceTimeout); resizer._debounceTimeout = setTimeout(() => { try { explorationChart.resize(); } catch(resizeErr){ console.error("Error resizing chart during drag:", resizeErr); } }, 50); } } };
      const handleMouseUp = () => { if (isResizing) { isResizing = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); if (explorationChart) { clearTimeout(resizer._debounceTimeout); try { explorationChart.resize(); } catch(resizeErr){ console.error("Error resizing chart after drag:", resizeErr); } } } };
  } else { console.warn("Resizer elements not found."); }

  // --- Clear cache (Restored & Enhanced) ---
  if (clearCacheButton) {
    clearCacheButton.addEventListener('click', () => {
      localStorage.removeItem('lastTreeData'); currentTreeData = null; // Clear tree cache
      searchCache = {}; // Clear search result cache
      if (explorationChart) { explorationChart.setOption({ series:[{ data:[{ name:'Awaiting Exploration…', children:[] }] }] }, true); } // Reset chart
      updateStatus('Cache cleared','info'); clearCacheButton.style.display = 'none'; // Hide button
      if (resultsContainer) { resultsContainer.innerHTML = '<p class="placeholder">Click a node to see search results here…</p>'; } // Clear results panel
      if (resultPanel) { const titleEl = resultPanel.querySelector('h2'); if (titleEl) titleEl.firstChild.textContent = `Search Results `; } // Reset title
      searchLoadingIndicator?.classList.add('hidden'); // Ensure indicator hidden
    });
    if (localStorage.getItem('lastTreeData')) { clearCacheButton.style.display = 'inline-block'; }
  }

  // --- Downloads (Restored Logic) ---
  function triggerDownload(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); if (a.parentNode) { a.parentNode.removeChild(a); } }, 100); }
  if (downloadJsonButton) { downloadJsonButton.addEventListener('click', () => { if (!currentTreeData) return updateStatus('No data to download','error'); try { const jsonString = JSON.stringify(currentTreeData,null,2); const blob = new Blob([jsonString],{type:'application/json'}); const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/\W+/g,'_').toLowerCase()}.json`; triggerDownload(blob, filename); updateStatus('Downloading JSON...','info'); } catch(e) { console.error("Error creating JSON download:", e); updateStatus('Error preparing JSON download.','error'); } }); }
  if (downloadPngButton && explorationChart) { downloadPngButton.addEventListener('click', () => { if (!currentTreeData) return updateStatus('No chart to download','error'); try { const dataURL = explorationChart.getDataURL({ type:'png', backgroundColor: themeColors.inputBg, pixelRatio: 2 }); const a = document.createElement('a'); a.style.display = 'none'; a.href = dataURL; const filename = `concept_tree_${(currentTreeData.name || 'export').replace(/\W+/g,'_').toLowerCase()}.png`; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); updateStatus('Downloading PNG...','info'); } catch(e) { console.error("Error creating PNG download:", e); updateStatus('Error preparing PNG download.','error'); } }); }

  // --- Hero start & Enter ---
  if (heroStartButton && heroRootInput) { heroStartButton.addEventListener('click', () => { const root = heroRootInput.value.trim(); if (!root) return updateStatus('Enter a root concept','error'); if (resultsContainer) resultsContainer.innerHTML = '<p class="placeholder">Click a node to see search results here…</p>'; if (resultPanel) { const titleEl = resultPanel.querySelector('h2'); if (titleEl) titleEl.firstChild.textContent = `Search Results `; } searchLoadingIndicator?.classList.add('hidden'); startExploration(root); }); heroRootInput.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); heroStartButton.click(); } }); }

  // --- SSE & exploration logic ---
  function startExploration(root) {
    if (isExploring || !explorationChart || !form) return; if (eventSource) eventSource.close(); isExploring = true;
    if(heroStartButton) { heroStartButton.disabled = true; heroStartButton.textContent = 'Exploring…'; }
    updateStatus('Starting exploration','info'); settingsPanel && settingsPanel.classList.remove('settings-panel-visible'); settingsToggle && (settingsToggle.textContent='[ Settings ]');
    explorationChart.setOption({ series:[{ ...chartBaseOptions.series[0], data:[{ name:'Loading…', children:[] }] }] }, true); explorationChart.showLoading({ text:'Querying AI…', color: themeColors.primary, textColor: themeColors.text, maskColor:'rgba(26,32,44,0.7)' });
    const fd = new FormData(form); const qp = new URLSearchParams({ root_concept: root, provider: fd.get('provider') || 'gemini', depth: fd.get('depth') || '3', sleep_duration: fd.get('sleep_duration') || '0.2', diversity: fd.get('diversity') || '0.8' }); const modelVal = fd.get('model')?.trim(); const apiKeyVal = fd.get('api_key'); if (modelVal) qp.append('model', modelVal); if (apiKeyVal) qp.append('api_key', apiKeyVal);
    eventSource = new EventSource(`/stream_exploration?${qp}`); eventSource.onopen = ()=> updateStatus('Connection open','info');
    eventSource.onmessage = evt=>{ if (explorationChart) explorationChart.hideLoading(); let d; try { d = JSON.parse(evt.data); } catch(x) { console.error("Invalid SSE data:", evt.data); return updateStatus('Invalid SSE data received','error'); } if (d.type==='status') { updateStatus(d.message,'info'); if (d.graph) updateChart(d.graph); } else if (d.type==='graph_update') { if (d.graph) updateChart(d.graph); updateStatus('Graph updated','info'); } else if (d.type==='error') { updateStatus(`Error: ${d.message}`,'error'); cleanup(); } else if (d.type==='done') { if (d.graph) { updateChart(d.graph); localStorage.setItem('lastTreeData', JSON.stringify(d.graph)); if(clearCacheButton) clearCacheButton.style.display='inline-block'; } updateStatus('Exploration complete','success'); cleanup(); } };
    eventSource.onerror = e=>{ updateStatus('Connection error','error'); cleanup(); };
  }

  function cleanup() { isExploring = false; if (heroStartButton) { heroStartButton.disabled = false; heroStartButton.textContent = 'Explore'; } if (eventSource) { eventSource.close(); eventSource = null; } if (explorationChart) explorationChart.hideLoading(); }
  function updateChart(tree) { if (!explorationChart || !tree) return; currentTreeData = tree; explorationChart.hideLoading(); try { explorationChart.setOption({ tooltip: chartBaseOptions.tooltip, series:[{ ...chartBaseOptions.series[0], data:[tree] }] }, false); setTimeout(() => { try { explorationChart.resize(); } catch(e){ console.error("Resize after update failed:", e); } }, 50); } catch (e) { console.error("Error updating chart:", e); updateStatus("Error rendering chart update.", "error"); } }

  // --- Load Tavily Results (Handles loading indicator & caching) ---
  async function loadTavilyResults(query) { // Accepts the query (node name or full path)
    if (!resultsContainer) return;
    updateStatus(`Searching for: ${query}`, 'info'); // Log what's being searched
    resultsContainer.innerHTML = '<p class="placeholder">Loading search results…</p>'; // Clear previous results
    searchLoadingIndicator?.classList.remove('hidden'); // Show cursor

    try {
      const res = await fetch(`/search?q=${encodeURIComponent(query)}`); // Send the query
      if (!res.ok) { let errorDetail = `Search request failed: ${res.status} ${res.statusText}`; try { const errorBody = await res.json(); errorDetail = errorBody.detail || errorDetail; } catch (_) { /* Ignore */ } throw new Error(errorDetail); }
      const data = await res.json(); const results = data.results || [];
      let resultsHTML;
      if (!results.length) { resultsHTML = '<p class="placeholder">No results found.</p>'; }
      else { resultsHTML = results.map(r => ` <div class="result-item"> ${r.image_url ? `<img src="${r.image_url}" class="result-thumb" alt="Result thumbnail" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.result-thumb-placeholder').style.display='flex';" /> <div class="result-thumb result-thumb-placeholder" style="display: none;"></div>` : `<div class="result-thumb result-thumb-placeholder"></div>` } <div class="result-content"> <div class="result-title"> <a href="${r.url || '#'}" target="_blank" rel="noopener noreferrer" title="${r.title || ''}">${r.title || 'Untitled'}</a> </div> <div class="result-snippet">${r.content || 'No snippet available.'}</div> </div> </div> `).join(''); }
      // Render and Cache results using the original query as key
      resultsContainer.innerHTML = resultsHTML;
      searchCache[query] = resultsHTML; // Store HTML in cache using the query key

    } catch(err) {
      console.error('Tavily search error:', err);
      resultsContainer.innerHTML = `<p class="placeholder text-red-400">Error loading results: ${err.message}</p>`;
      // Don't cache errors
    } finally {
      // Hide loading indicator
      searchLoadingIndicator?.classList.add('hidden');
    }
  }

  // --- Global Resize Handler ---
   window.addEventListener('resize', () => { if (explorationChart) { clearTimeout(window._resizeDebounceTimeout); window._resizeDebounceTimeout = setTimeout(() => { try { explorationChart.resize(); } catch (e) { console.error("Error resizing chart on window resize:", e); } }, 150); } });

}); // End DOMContentLoaded
