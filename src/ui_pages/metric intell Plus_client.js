

// Theme Management - Load theme immediately
(function() {
    var savedTheme = localStorage.getItem('metric2ai_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

// Metric Intelligence (ACC) Dashboard - THEME-AWARE VERSION WITH ALERTS
// With Chart Types, Card Resizing, Gradient Area Charts, Y-Axis Headroom, Proportional Scaling, Professional Themes
console.log('[DASHBOARD] Initializing Enhanced Dashboard with Alerts...');

var Dashboard = {
    data: {
        metrics: [],
        allMetrics: [],
        alerts: [],           // ⬅️ Store alerts from backend
        anomalies: [],        // ⬅️ Store anomalies from backend
        filters: { 
            timeRange: '24h', 
            columns: 4, 
            ciClass: 'All', 
            ciNames: [], 
            metricNames: [],
            searchQuery: '',
            ciSysIds: []
        },
        loading: false,
        openDropdown: null,
        autoRefresh: false,
        showAnomalies: true,   // ⬅️ enabled by default
        showAlerts: false,     // ⬅️ disabled by default (not shown on graph)
        isAlertsExpanded: false, // ⬅️ CHANGED - alerts section collapsed by default
        alertSort: {           // ⬅️ NEW - Alert sorting state
            column: 'sys_created_on',
            direction: 'desc'  // descending by default
        },
        alertFilters: {        // ⬅️ NEW - Alert column filters
            state: 'Open',     // ⬅️ DEFAULT - Filter to Open alerts by default
            severity: '',
            source: '',
            number: '',
            type: '',
            description: '',   // ⬅️ NEW - Description keyword filter
            group_source: '',  // ⬅️ FIXED - Use group_source (not group)
            parent: ''         // ⬅️ NEW - Parent filter
        },
        customOrder: [],
        customSizes: {},
        customChartTypes: {},
        zoom: {
            active: false,
            startTime: null,
            endTime: null,
            originalTimeRange: '24h'
        }
    },
    
    charts: {},
    
    dragState: {
        draggedIndex: null,
        dragOverIndex: null
    },
    
    selectionState: {
        active: false,
        metricIndex: null,
        startX: null,
        endX: null,
        startTime: null,
        endTime: null,
        overlay: null
    },
    
    intervals: {
        clock: null,
        data: null,
        searchTimeout: null
    },
    
    // THEME-AWARE COLOR PALETTES - High Contrast for Multi-Host Visibility
    colorPalettes: {
        // Default/Infinite Blue Theme - High Contrast Colors
        default: {
            cpu: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#A855F7'],
            memory: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#A855F7'],
            disk: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#A855F7'],
            network: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'],
            default: ['#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4', '#EC4899', '#F97316']
        },
        
        // Dark Theme - Bright High-Contrast Colors
        dark: {
            cpu: ['#00A1E0', '#3DD68C', '#FFB81C', '#8B7FFF', '#FF6BB5', '#00D4FF', '#FF8A65', '#C77DFF'],
            memory: ['#8B7FFF', '#00A1E0', '#3DD68C', '#FFB81C', '#FF6BB5', '#00D4FF', '#FF8A65', '#C77DFF'],
            disk: ['#3DD68C', '#00A1E0', '#FFB81C', '#8B7FFF', '#FF6BB5', '#00D4FF', '#FF8A65', '#C77DFF'],
            network: ['#FF6B57', '#FFB81C', '#3DD68C', '#00A1E0', '#8B7FFF', '#FF6BB5', '#00D4FF', '#C77DFF'],
            default: ['#00A1E0', '#3DD68C', '#8B7FFF', '#FF6B57', '#FFB81C', '#00D4FF', '#FF6BB5', '#C77DFF']
        },
        
        // Light Theme - Professional Vibrant High-Contrast Colors
        light: {
            cpu: ['#0969DA', '#1A7F37', '#D97706', '#8250DF', '#C2255C', '#0550AE', '#D83B01', '#6E40C9'],
            memory: ['#8250DF', '#0969DA', '#1A7F37', '#D97706', '#C2255C', '#0550AE', '#D83B01', '#6E40C9'],
            disk: ['#1A7F37', '#0969DA', '#D97706', '#8250DF', '#C2255C', '#0550AE', '#D83B01', '#6E40C9'],
            network: ['#CF222E', '#D97706', '#1A7F37', '#0969DA', '#8250DF', '#C2255C', '#0550AE', '#D83B01'],
            default: ['#0969DA', '#1A7F37', '#8250DF', '#CF222E', '#D97706', '#0550AE', '#C2255C', '#D83B01']
        }
    },
    
    colors: {
        warning: '#09a2bf',
        major: '#ff5730',
        critical: '#ec596b'
    },
    
    thresholds: {
        'cpu.user_percentage': { warning: 70, major: 85, critical: 95 },
        'cpu.system_percentage': { warning: 25, major: 35, critical: 50 },
        'memory_percent.usedWOBuffersCaches': { warning: 80, major: 90, critical: 95 },
        'ram.usage_percentage': { warning: 80, major: 90, critical: 95 }
    },
    
    tooltip: {
        visible: false,
        x: 0,
        y: 0,
        content: ''
    },
    
    parseURLParams: function() {
        var urlParams = new URLSearchParams(window.location.search);
        
        var timeRange = urlParams.get('sysparm_time_range');
        if (timeRange) {
            this.data.filters.timeRange = timeRange;
            console.log('[DASHBOARD] URL param: time_range =', timeRange);
        }
        
        var ciClass = urlParams.get('sysparm_ci_class');
        if (ciClass) {
            this.data.filters.ciClass = ciClass;
            console.log('[DASHBOARD] URL param: ci_class =', ciClass);
        }
        
        var ciSysIds = urlParams.get('sysparm_ci_sys_ids');
        if (ciSysIds) {
            this.data.filters.ciSysIds = ciSysIds.split(',').map(function(id) { 
                return id.trim(); 
            });
            console.log('[DASHBOARD] URL param: ci_sys_ids =', this.data.filters.ciSysIds);
        }
        
        var startTime = urlParams.get('sysparm_start_time');
        var endTime = urlParams.get('sysparm_end_time');
        if (startTime && endTime) {
            this.data.zoom.active = true;
            this.data.zoom.startTime = parseInt(startTime);
            this.data.zoom.endTime = parseInt(endTime);
            console.log('[DASHBOARD] URL param: custom time range');
        }
    },
    
    // THEME-AWARE: Get color palette based on current theme and metric category
    getColorPalette: function(metricName) {
        var currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
        var themePalettes = this.colorPalettes[currentTheme] || this.colorPalettes.default;
        
        if (!metricName) {
            return themePalettes.default;
        }
        
        var name = metricName.toLowerCase();
        
        if (name.indexOf('cpu') !== -1 || name.indexOf('load') !== -1) {
            return themePalettes.cpu;
        }
        
        if (name.indexOf('memory') !== -1 || name.indexOf('swap') !== -1 || name.indexOf('ram') !== -1) {
            return themePalettes.memory;
        }
        
        if (name.indexOf('disk') !== -1 || name.indexOf('storage') !== -1 || name.indexOf('filesystem') !== -1) {
            return themePalettes.disk;
        }
        
        if (name.indexOf('network') !== -1 || name.indexOf('ping') !== -1 || name.indexOf('packet') !== -1 || name.indexOf('bandwidth') !== -1) {
            return themePalettes.network;
        }
        
        return themePalettes.default;
    },
    
    formatYAxisValue: function(value, unit) {
        if (value === undefined || value === null || isNaN(value)) {
            return '0';
        }
        
        var lowerUnit = (unit || '').toLowerCase();
        
        if (lowerUnit === '%' || lowerUnit === 'percent' || lowerUnit === 'percentage') {
            return value.toFixed(2);
        }
        
        if (lowerUnit.indexOf('byte') !== -1) {
            if (value >= 1099511627776) return (value / 1099511627776).toFixed(1) + 'T';
            if (value >= 1073741824) return (value / 1073741824).toFixed(1) + 'G';
            if (value >= 1048576) return (value / 1048576).toFixed(1) + 'M';
            if (value >= 1024) return (value / 1024).toFixed(1) + 'K';
            return value.toFixed(0);
        }
        
        if (lowerUnit === 'count' || lowerUnit === 'packets') {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value.toFixed(0);
        }
        
        if (lowerUnit === 'ms' || lowerUnit === 'millisec' || lowerUnit === 'milliseconds') {
            if (value >= 1000) return (value / 1000).toFixed(1) + 's';
            return value.toFixed(0);
        }
        
        if (lowerUnit.indexOf('/sec') !== -1 || lowerUnit.indexOf('per sec') !== -1) {
            if (value >= 1073741824) return (value / 1073741824).toFixed(1) + 'G/s';
            if (value >= 1048576) return (value / 1048576).toFixed(1) + 'M/s';
            if (value >= 1024) return (value / 1024).toFixed(1) + 'K/s';
            return value.toFixed(0) + '/s';
        }
        
        return value.toFixed(0);
    },
    
    getCIClassDisplay: function(ciClass) {
        if (!ciClass) return { name: 'N/A', color: 'var(--bg-primary)', cssClass: '' };
        
        var clean = ciClass.replace('cmdb_ci_', '');
        
        if (clean === 'win_server') {
            return { 
                name: 'Windows', 
                color: 'rgba(82, 184, 255, 0.5)',
                cssClass: 'windows'
            };
        } else if (clean === 'linux_server') {
            return { 
                name: 'Linux', 
                color: '#7661FF',
                cssClass: 'linux'
            };
        } else {
            return { 
                name: clean, 
                color: 'var(--bg-primary)',
                cssClass: ''
            };
        }
    },
    
    calculateMetricStats: function(metric) {
        if (!metric.data || !Array.isArray(metric.data) || metric.data.length === 0) {
            return {
                currentValue: 0,
                trend: 0,
                trendDirection: 'stable',
                healthScore: 50
            };
        }
        
        var allValues = [];
        for (var h = 0; h < metric.data.length; h++) {
            if (metric.data[h].values && Array.isArray(metric.data[h].values)) {
                allValues = allValues.concat(metric.data[h].values);
            }
        }
        
        if (allValues.length === 0) {
            return {
                currentValue: 0,
                trend: 0,
                trendDirection: 'stable',
                healthScore: 50
            };
        }
        
        var currentValues = [];
        for (var h = 0; h < metric.data.length; h++) {
            if (metric.data[h].values && metric.data[h].values.length > 0) {
                currentValues.push(metric.data[h].values[metric.data[h].values.length - 1]);
            }
        }
        var currentValue = currentValues.length > 0 
            ? currentValues.reduce(function(a, b) { return a + b; }, 0) / currentValues.length 
            : 0;
        
        var segmentSize = Math.max(Math.floor(allValues.length * 0.1), 1);
        var recentValues = allValues.slice(-segmentSize);
        var previousValues = allValues.slice(-segmentSize * 2, -segmentSize);
        
        var recentAvg = recentValues.reduce(function(a, b) { return a + b; }, 0) / recentValues.length;
        var previousAvg = previousValues.length > 0 
            ? previousValues.reduce(function(a, b) { return a + b; }, 0) / previousValues.length 
            : recentAvg;
        
        var trend = previousAvg !== 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
        var trendDirection = Math.abs(trend) < 1 ? 'stable' : (trend > 0 ? 'up' : 'down');
        
        var threshold = this.thresholds[metric.name];
        var healthScore = 100;
        
        if (threshold) {
            if (currentValue >= threshold.critical) {
                healthScore = 20;
            } else if (currentValue >= threshold.major) {
                healthScore = 40;
            } else if (currentValue >= threshold.warning) {
                healthScore = 70;
            } else {
                healthScore = 95;
            }
        } else {
            var minVal = Math.min.apply(null, allValues);
            var maxVal = Math.max.apply(null, allValues);
            var range = maxVal - minVal;
            var avgVal = allValues.reduce(function(a, b) { return a + b; }, 0) / allValues.length;
            var variance = range / (avgVal || 1);
            
            if (variance > 0.5) healthScore = 60;
            else if (variance > 0.3) healthScore = 80;
            else healthScore = 95;
        }
        
        return {
            currentValue: currentValue,
            trend: trend,
            trendDirection: trendDirection,
            healthScore: Math.round(healthScore)
        };
    },
    
    matchesSearch: function(metric, query) {
        if (!query || query.trim() === '') return true;
        
        var q = query.toLowerCase().trim();
        var words = q.split(/\s+/);
        
        for (var w = 0; w < words.length; w++) {
            var word = words[w];
            if (word === '') continue;
            
            var foundInMetric = false;
            
            if (metric.name && metric.name.toLowerCase().indexOf(word) !== -1) {
                foundInMetric = true;
            }
            
            if (!foundInMetric && metric.hosts && Array.isArray(metric.hosts)) {
                for (var i = 0; i < metric.hosts.length; i++) {
                    if (metric.hosts[i].toLowerCase().indexOf(word) !== -1) {
                        foundInMetric = true;
                        break;
                    }
                }
            }
            
            if (!foundInMetric) {
                return false;
            }
        }
        
        return true;
    },
    
    clearSearch: function() {
        this.data.filters.searchQuery = '';
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        this.applyFilters();
        this.updateUI();
        document.getElementById('header-section').innerHTML = this.renderHeader();
        this.attachHeaderListeners();
        document.getElementById('legend-section').innerHTML = this.renderLegend();
        this.attachLegendListeners();
    },
    
    init: function() {
        console.log('[DASHBOARD] Init starting...');
        this.parseURLParams();
        this.loadCustomOrder();
        this.loadCustomSizes();
        this.loadCustomChartTypes();
        this.loadTheme();
        
        // ⬅️ Load toggle preferences
        var savedAnomalies = localStorage.getItem('metric2ai_show_anomalies');
        if (savedAnomalies !== null) {
            this.data.showAnomalies = (savedAnomalies === 'true');
        }
        var savedAlerts = localStorage.getItem('metric2ai_show_alerts');
        if (savedAlerts !== null) {
            this.data.showAlerts = (savedAlerts === 'true');
        }
        
        // ⬅️ Load alerts section expanded state
        var savedAlertsExpanded = localStorage.getItem('metric2ai_alerts_expanded');
        if (savedAlertsExpanded !== null) {
            this.data.isAlertsExpanded = (savedAlertsExpanded === 'true');
        }
        
        this.render();
        this.updateClock();
        this.intervals.clock = setInterval(function() { Dashboard.updateClock(); }, 1000);
        this.createTimeSelectionTooltip();
        this.loadData();
    },
    
    loadCustomOrder: function() {
        try {
            var saved = localStorage.getItem('metric2ai_dashboard_order');
            if (saved) {
                this.data.customOrder = JSON.parse(saved);
                console.log('[DASHBOARD] Loaded custom order:', this.data.customOrder.length, 'items');
            }
        } catch (e) {
            console.error('[DASHBOARD] Failed to load custom order:', e);
        }
    },
    
    saveCustomOrder: function() {
        try {
            localStorage.setItem('metric2ai_dashboard_order', JSON.stringify(this.data.customOrder));
            console.log('[DASHBOARD] Saved custom order');
        } catch (e) {
            console.error('[DASHBOARD] Failed to save custom order:', e);
        }
    },
    
    loadCustomSizes: function() {
        try {
            var saved = localStorage.getItem('metric2ai_dashboard_sizes');
            if (saved) {
                this.data.customSizes = JSON.parse(saved);
                console.log('[DASHBOARD] Loaded custom sizes:', Object.keys(this.data.customSizes).length, 'items');
            }
        } catch (e) {
            console.error('[DASHBOARD] Failed to load custom sizes:', e);
        }
    },
    
    saveCustomSizes: function() {
        try {
            localStorage.setItem('metric2ai_dashboard_sizes', JSON.stringify(this.data.customSizes));
            console.log('[DASHBOARD] Saved custom sizes');
        } catch (e) {
            console.error('[DASHBOARD] Failed to save custom sizes:', e);
        }
    },
    
    setCardSize: function(index, size) {
        var metric = this.data.metrics[index];
        var metricId = this.getMetricId(metric);
        this.data.customSizes[metricId] = size;
        this.saveCustomSizes();
        console.log('[DASHBOARD] Set card size:', metricId, '->', size);
        this.closeCardMenu();
        this.updateUI();
    },
    
    loadCustomChartTypes: function() {
        try {
            var saved = localStorage.getItem('metric2ai_dashboard_chart_types');
            if (saved) {
                this.data.customChartTypes = JSON.parse(saved);
                console.log('[DASHBOARD] Loaded custom chart types:', Object.keys(this.data.customChartTypes).length, 'items');
            }
        } catch (e) {
            console.error('[DASHBOARD] Failed to load custom chart types:', e);
        }
    },
    
    saveCustomChartTypes: function() {
        try {
            localStorage.setItem('metric2ai_dashboard_chart_types', JSON.stringify(this.data.customChartTypes));
            console.log('[DASHBOARD] Saved custom chart types');
        } catch (e) {
            console.error('[DASHBOARD] Failed to save custom chart types:', e);
        }
    },
    
    setChartType: function(index, chartType) {
        var metric = this.data.metrics[index];
        var metricId = this.getMetricId(metric);
        this.data.customChartTypes[metricId] = chartType;
        this.saveCustomChartTypes();
        console.log('[DASHBOARD] Set chart type:', metricId, '->', chartType);
        this.closeCardMenu();
        this.updateUI();
    },
    
    loadTheme: function() {
        var savedTheme = localStorage.getItem('metric2ai_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        console.log('[DASHBOARD] Loaded theme:', savedTheme);
    },
    
    setTheme: function(theme) {
        console.log('[DASHBOARD] Setting theme:', theme);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('metric2ai_theme', theme);
        
        setTimeout(function() {
            Dashboard.drawCharts();
        }, 100);
    },
    
    resetLayout: function() {
        this.data.customOrder = [];
        this.data.customSizes = {};
        this.data.customChartTypes = {};
        localStorage.removeItem('metric2ai_dashboard_order');
        localStorage.removeItem('metric2ai_dashboard_sizes');
        localStorage.removeItem('metric2ai_dashboard_chart_types');
        console.log('[DASHBOARD] Reset layout, sizes, and chart types to default');
        this.updateUI();
    },
    
    applyCustomOrder: function() {
        if (this.data.customOrder.length === 0) return;
        
        var ordered = [];
        var remaining = this.data.metrics.slice();
        
        for (var i = 0; i < this.data.customOrder.length; i++) {
            var metricId = this.data.customOrder[i];
            for (var j = 0; j < remaining.length; j++) {
                if (this.getMetricId(remaining[j]) === metricId) {
                    ordered.push(remaining[j]);
                    remaining.splice(j, 1);
                    break;
                }
            }
        }
        
        this.data.metrics = ordered.concat(remaining);
    },
    
    getMetricId: function(metric) {
        return metric.id || (metric.name + '_' + metric.ciClass);
    },
    
    createTooltip: function() {
        var tooltip = document.createElement('div');
        tooltip.id = 'chart-tooltip';
        tooltip.style.cssText = 'position:fixed;display:none;background:#203C4A;border:2px solid #63DF4E;color:#fff;padding:8px 12px;border-radius:6px;font-size:11px;pointer-events:none;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.5);max-width:250px;';
        document.body.appendChild(tooltip);
    },
    
    createTimeSelectionTooltip: function() {
        var tooltip = document.createElement('div');
        tooltip.id = 'time-selection-tooltip';
        tooltip.className = 'time-selection-tooltip';
        tooltip.innerHTML = '<div class="tooltip-time-row"><span class="tooltip-time-label">From:</span><span class="tooltip-time-value" id="sel-tooltip-start">--:--</span></div><div class="tooltip-time-row"><span class="tooltip-time-label">To:</span><span class="tooltip-time-value" id="sel-tooltip-end">--:--</span></div><div class="tooltip-duration-row" id="sel-tooltip-duration">Duration: --</div>';
        document.body.appendChild(tooltip);
    },
    
    showTooltip: function(x, y, content) {
        var tooltip = document.getElementById('chart-tooltip');
        if (tooltip) {
            tooltip.innerHTML = content;
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.style.display = 'block';
        }
    },
    
    hideTooltip: function() {
        var tooltip = document.getElementById('chart-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    },
    
    updateClock: function() {
        var clock = document.getElementById('live-clock');
        if (clock) {
            clock.textContent = new Date().toLocaleTimeString();
        }
    },
    
    toggleAutoRefresh: function() {
        this.data.autoRefresh = !this.data.autoRefresh;
        console.log('[DASHBOARD] Auto-refresh:', this.data.autoRefresh ? 'ENABLED' : 'DISABLED');
        
        if (this.data.autoRefresh) {
            this.intervals.data = setInterval(function() { 
                console.log('[DASHBOARD] Auto-refreshing data...');
                Dashboard.loadData(); 
            }, 30000);
            var toggle = document.getElementById('auto-refresh-toggle');
            if (toggle) toggle.checked = true;
        } else {
            if (this.intervals.data) {
                clearInterval(this.intervals.data);
                this.intervals.data = null;
            }
            var toggle = document.getElementById('auto-refresh-toggle');
            if (toggle) toggle.checked = false;
        }
    },
    
    // ⬅️ Toggle functions for anomalies and alerts
    toggleShowAnomalies: function() {
        this.data.showAnomalies = !this.data.showAnomalies;
        console.log('[DASHBOARD] Show Anomalies:', this.data.showAnomalies ? 'ENABLED' : 'DISABLED');
        localStorage.setItem('metric2ai_show_anomalies', this.data.showAnomalies);
        this.updateUI();
    },
    
    toggleShowAlerts: function() {
        this.data.showAlerts = !this.data.showAlerts;
        console.log('[DASHBOARD] Show Alerts:', this.data.showAlerts ? 'ENABLED' : 'DISABLED');
        localStorage.setItem('metric2ai_show_alerts', this.data.showAlerts);
        this.updateUI(); // ⬅️ This will re-render everything including the alerts section
    },
    
    // ⬅️ Toggle alerts section expand/collapse
    toggleAlertsSection: function() {
        this.data.isAlertsExpanded = !this.data.isAlertsExpanded;
        console.log('[DASHBOARD] Alerts section:', this.data.isAlertsExpanded ? 'EXPANDED' : 'COLLAPSED');
        localStorage.setItem('metric2ai_alerts_expanded', this.data.isAlertsExpanded);
        
        var content = document.getElementById('alerts-content');
        var chevron = document.getElementById('alerts-chevron');
        
        if (this.data.isAlertsExpanded) {
            content.classList.add('expanded');
            chevron.classList.add('expanded');
        } else {
            content.classList.remove('expanded');
            chevron.classList.remove('expanded');
        }
    },
    
    // ⬅️ NEW - Clear all alert filters back to defaults
    clearAllAlertFilters: function() {
        console.log('[DASHBOARD] Clearing all alert filters');
        
        // Reset all filters to defaults
        this.data.alertFilters = {
            state: 'Open',      // Default: Show only Open alerts
            severity: '',
            source: '',
            number: '',
            type: '',
            description: '',
            group_source: '',   // ⬅️ FIXED - Use group_source
            parent: ''
        };
        
        // Re-render the UI to show updated filters
        this.updateUI();
    },
    
    // ⬅️ Calls getMetricsWithAlerts to fetch alerts and anomalies
loadData: function() {
    console.log('[DASHBOARD] Loading data via GlideAjax...');
    this.data.loading = true;
    this.updateUI();
    
    var self = this;
    
    var ga = new GlideAjax('x_snc_metricintelp.MetricsAPIHandler');
    ga.addParam('sysparm_name', 'getMetricsWithAlerts');
    ga.addParam('sysparm_time_range', this.data.filters.timeRange);
    
    if (this.data.filters.ciClass && this.data.filters.ciClass !== 'All') {
        ga.addParam('sysparm_ci_class', this.data.filters.ciClass);
        console.log('[DASHBOARD] Filtering by CI class:', this.data.filters.ciClass);
    }
    
    if (this.data.filters.ciSysIds && this.data.filters.ciSysIds.length > 0) {
        ga.addParam('sysparm_ci_sys_ids', this.data.filters.ciSysIds.join(','));
        console.log('[DASHBOARD] Filtering by CI sys_ids:', this.data.filters.ciSysIds.length);
    }
    
    if (this.data.zoom.active) {
        console.log('[DASHBOARD] Loading zoomed data:', this.data.zoom.startTime, 'to', this.data.zoom.endTime);
        ga.addParam('sysparm_start_time', this.data.zoom.startTime.toString());
        ga.addParam('sysparm_end_time', this.data.zoom.endTime.toString());
    }
    
    console.log('[DASHBOARD] Calling GlideAjax with time range:', this.data.filters.timeRange);
    
    ga.getXMLAnswer(function(response) {
        console.log('[DASHBOARD] GlideAjax response received');
        console.log('[DASHBOARD] Response length:', response ? response.length : 0);
        
        try {
            var result = JSON.parse(response);
            
            // ⬅️ DIAGNOSTIC - Log the actual response structure
            console.log('[DASHBOARD] Response structure:', {
                success: result.success,
                hasMetrics: !!result.metrics,
                metricsType: typeof result.metrics,
                metricsIsArray: Array.isArray(result.metrics),
                metricsHasData: result.metrics ? !!result.metrics.data : false,
                metricsDataType: result.metrics ? typeof result.metrics.data : 'undefined',
                metricsCount: result.metrics ? (result.metrics.count || result.metrics.length) : 0
            });
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }
            
            // ⬅️ HANDLE BOTH RESPONSE FORMATS (old and new)
            var metricsArray = [];
            
            if (result.metrics) {
                if (Array.isArray(result.metrics)) {
                    // Old format: metrics is an array directly
                    metricsArray = result.metrics;
                    console.log('[DASHBOARD] Using old format (array) - loaded', metricsArray.length, 'metrics');
                } else if (result.metrics.data && Array.isArray(result.metrics.data)) {
                    // New format: metrics.data is the array
                    metricsArray = result.metrics.data;
                    console.log('[DASHBOARD] Using new format (object.data) - loaded', metricsArray.length, 'metrics');
                } else {
                    console.error('[DASHBOARD] Unexpected metrics format:', result.metrics);
                }
            }
            
            self.data.allMetrics = metricsArray;
            
            // ⬅️ HANDLE ALERTS - both formats
            var alertsArray = [];
            if (result.alerts) {
                if (Array.isArray(result.alerts)) {
                    alertsArray = result.alerts;
                } else if (result.alerts.data && Array.isArray(result.alerts.data)) {
                    alertsArray = result.alerts.data;
                }
            }
            self.data.alerts = alertsArray;
            
            // ⬅️ HANDLE ANOMALIES - both formats
            var anomaliesArray = [];
            if (result.anomalies) {
                if (Array.isArray(result.anomalies)) {
                    anomaliesArray = result.anomalies;
                } else if (result.anomalies.data && Array.isArray(result.anomalies.data)) {
                    anomaliesArray = result.anomalies.data;
                }
            }
            self.data.anomalies = anomaliesArray;
            
            console.log('[DASHBOARD] Final counts - Metrics:', metricsArray.length, 
                       'Alerts:', alertsArray.length, 'Anomalies:', anomaliesArray.length);
            
            self.applyFilters();
            self.data.loading = false;
            self.render();
            self.updateUI();
            
        } catch (error) {
            console.error('[DASHBOARD] Load error:', error);
            console.error('[DASHBOARD] Response preview:', response ? response.substring(0, 500) : 'null');
            alert('Error loading metrics: ' + error.message);
            self.data.loading = false;
            self.updateUI();
        }
    });
},

applyFilters: function() {
    var filtered = this.data.allMetrics || [];
    
    console.log('[DASHBOARD] applyFilters starting with', filtered.length, 'metrics');
    
    if (this.data.filters.ciClass !== 'All') {
        var before = filtered.length;
        filtered = filtered.filter(function(metric) {
            return metric.ciClass === Dashboard.data.filters.ciClass;
        });
        console.log('[DASHBOARD] CI class filter:', before, '→', filtered.length);
    }
    
    if (this.data.filters.ciNames.length > 0) {
        var before = filtered.length;
        filtered = filtered.filter(function(metric) {
            if (!metric.hosts || !Array.isArray(metric.hosts)) return false;
            for (var i = 0; i < metric.hosts.length; i++) {
                if (Dashboard.data.filters.ciNames.indexOf(metric.hosts[i]) !== -1) {
                    return true;
                }
            }
            return false;
        });
        console.log('[DASHBOARD] CI names filter:', before, '→', filtered.length);
    }
    
    if (this.data.filters.metricNames.length > 0) {
        var before = filtered.length;
        filtered = filtered.filter(function(metric) {
            return Dashboard.data.filters.metricNames.indexOf(metric.name) !== -1;
        });
        console.log('[DASHBOARD] Metric names filter:', before, '→', filtered.length);
    }
    
    if (this.data.filters.searchQuery && this.data.filters.searchQuery.trim() !== '') {
        var before = filtered.length;
        filtered = filtered.filter(function(metric) {
            return Dashboard.matchesSearch(metric, Dashboard.data.filters.searchQuery);
        });
        console.log('[DASHBOARD] Search filter:', before, '→', filtered.length);
    }
    
    var clonedMetrics = [];
    for (var i = 0; i < filtered.length; i++) {
        var original = filtered[i];
        var clone = {
            name: original.name,
            ciClass: original.ciClass,
            unit: original.unit,
            hosts: original.hosts ? original.hosts.slice() : [],
            data: original.data ? JSON.parse(JSON.stringify(original.data)) : [],
            location: original.location,
            supportGroup: original.supportGroup
        };
        clonedMetrics.push(clone);
    }
    
    this.data.metrics = clonedMetrics;
    console.log('[DASHBOARD] Filtered to', this.data.metrics.length, 'metrics');
    
    this.filterMetricHosts();
},
    
    filterMetricHosts: function() {
        for (var i = 0; i < this.data.metrics.length; i++) {
            var metric = this.data.metrics[i];
            
            if (!metric.hosts || !Array.isArray(metric.hosts)) continue;
            if (!metric.data || !Array.isArray(metric.data)) continue;
            
            var hostsToShow = [];
            var indicesToKeep = [];
            
            for (var h = 0; h < metric.hosts.length; h++) {
                var hostName = metric.hosts[h];
                var shouldShow = true;
                
                if (this.data.filters.ciNames.length > 0) {
                    if (this.data.filters.ciNames.indexOf(hostName) === -1) {
                        shouldShow = false;
                    }
                }
                
                if (shouldShow && this.data.filters.searchQuery && this.data.filters.searchQuery.trim() !== '') {
                    var query = this.data.filters.searchQuery.toLowerCase().trim();
                    var words = query.split(/\s+/);
                    
                    for (var w = 0; w < words.length; w++) {
                        var word = words[w];
                        if (word === '') continue;
                        
                        if (metric.name.toLowerCase().indexOf(word) !== -1) {
                            continue;
                        }
                        
                        if (hostName.toLowerCase().indexOf(word) === -1) {
                            shouldShow = false;
                            break;
                        }
                    }
                }
                
                if (shouldShow) {
                    hostsToShow.push(hostName);
                    indicesToKeep.push(h);
                }
            }
            
            if (hostsToShow.length < metric.hosts.length) {
                metric.hosts = hostsToShow;
                
                var filteredData = [];
                for (var k = 0; k < indicesToKeep.length; k++) {
                    var idx = indicesToKeep[k];
                    if (metric.data[idx]) {
                        filteredData.push(metric.data[idx]);
                    }
                }
                metric.data = filteredData;
            }
        }
    },
    
    getUniqueCIClasses: function() {
        var classes = [];
        for (var i = 0; i < this.data.allMetrics.length; i++) {
            var ciClass = this.data.allMetrics[i].ciClass;
            if (ciClass && classes.indexOf(ciClass) === -1) {
                classes.push(ciClass);
            }
        }
        return classes.sort();
    },
    
    getUniqueCINames: function(ciClassFilter) {
        var names = [];
        for (var i = 0; i < this.data.allMetrics.length; i++) {
            var metric = this.data.allMetrics[i];
            
            if (ciClassFilter && ciClassFilter !== 'All' && metric.ciClass !== ciClassFilter) {
                continue;
            }
            
            if (metric.hosts && Array.isArray(metric.hosts)) {
                for (var j = 0; j < metric.hosts.length; j++) {
                    if (names.indexOf(metric.hosts[j]) === -1) {
                        names.push(metric.hosts[j]);
                    }
                }
            }
        }
        return names.sort();
    },
    
    getUniqueMetricNames: function(ciClassFilter) {
        var names = [];
        for (var i = 0; i < this.data.allMetrics.length; i++) {
            var metric = this.data.allMetrics[i];
            
            if (ciClassFilter && ciClassFilter !== 'All' && metric.ciClass !== ciClassFilter) {
                continue;
            }
            
            if (metric.name && names.indexOf(metric.name) === -1) {
                names.push(metric.name);
            }
        }
        return names.sort();
    },
    
    getCIAttributes: function(ciName) {
        for (var i = 0; i < this.data.allMetrics.length; i++) {
            var metric = this.data.allMetrics[i];
            if (metric.hosts && metric.hosts.indexOf(ciName) !== -1) {
                return {
                    name: ciName,
                    ciClass: (metric.ciClass || '').replace('cmdb_ci_', ''),
                    location: metric.location || 'Not set',
                    supportGroup: metric.supportGroup || 'Not set'
                };
            }
        }
        return null;
    },
    
    formatTimestamp: function(timestamp) {
        if (!timestamp) return 'N/A';
        
        if (typeof timestamp === 'number') {
            var date = new Date(timestamp);
            var hours = date.getHours().toString().padStart(2, '0');
            var minutes = date.getMinutes().toString().padStart(2, '0');
            return hours + ':' + minutes;
        }
        
        if (typeof timestamp === 'string' && timestamp.indexOf(' ') > -1) {
            var timePart = timestamp.split(' ')[1];
            if (timePart) {
                return timePart.substring(0, 5);
            }
        }
        
        return 'N/A';
    },
    
    parseTimestampToMs: function(timestamp) {
        if (!timestamp) return null;
        
        if (typeof timestamp === 'number') {
            return timestamp;
        }
        
        if (typeof timestamp === 'string') {
            var date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.getTime();
            }
        }
        
        return null;
    },
    
    getAlertLevel: function(metric) {
        var threshold = this.thresholds[metric.name];
        if (!threshold || !metric.data || !Array.isArray(metric.data)) return null;
        
        var maxValue = 0;
        for (var i = 0; i < metric.data.length; i++) {
            var hostData = metric.data[i];
            if (hostData.values && Array.isArray(hostData.values)) {
                var latestValue = hostData.values[hostData.values.length - 1];
                if (latestValue > maxValue) maxValue = latestValue;
            }
        }
        
        if (maxValue >= threshold.critical) return 'critical';
        if (maxValue >= threshold.major) return 'major';
        if (maxValue >= threshold.warning) return 'warning';
        return null;
    },
    
    // ⬅️ Get anomaly icon with color and direction
    getAnomalyIcon: function(state, severity, description) {
        var severityColors = {
            '1': '#ec596b',   // Critical
            '2': '#ff5730',   // Major
            '3': '#fefa86',   // Minor
            '4': '#09a2bf',   // Warning
            '5': '#29a93e',   // OK
            '0': '#29a93e'    // Clear
        };
        
        var color = severityColors[String(severity)] || '#999999';
        var icon = '';
        var desc = description || '';
        
        var isClosed = (state === '4' || state === 'Closed');
        
        if (!isClosed) {
            if (desc.indexOf('above calculated boundary') > -1) {
                icon = '▲';
            } else if (desc.indexOf('below calculated boundary') > -1) {
                icon = '▼';
            } else {
                icon = '◆';
            }
        } else {
            if (desc.indexOf('above calculated boundary') > -1) {
                icon = '△';
            } else if (desc.indexOf('below calculated boundary') > -1) {
                icon = '▽';
            } else {
                icon = '◇';
            }
        }
        
        return {
            icon: icon,
            color: color,
            isAbove: desc.indexOf('above calculated boundary') > -1,
            isBelow: desc.indexOf('below calculated boundary') > -1
        };
    },
    
    // ⬅️ Parse additional_info JSON from anomaly
    parseAnomalyInfo: function(anomaly) {
        var info = {
            metric_value: anomaly.metric_value,
            metric_lower_bound: anomaly.metric_lower_bound,
            metric_upper_bound: anomaly.metric_upper_bound,
            source_metric_type: anomaly.source_metric_type,
            resource_id: anomaly.resource_id,
            anomaly_score: anomaly.anomaly_score,
            max_anomaly_score: anomaly.max_anomaly_score,
            model_type: anomaly.model_type,
			most_anomalous_metric_value: anomaly.most_anomalous_metric_value  // ⬅️ ADD THIS LINE
        };
        
        if (!info.metric_value && anomaly.additional_info_raw) {
            try {
                var parsed = JSON.parse(anomaly.additional_info_raw);
                info.metric_value = parseFloat(parsed.metric_value);
                info.metric_lower_bound = parseFloat(parsed.metric_lower_bound);
                info.metric_upper_bound = parseFloat(parsed.metric_upper_bound);
                info.source_metric_type = parsed.source_metric_type;
                info.resource_id = parsed.resource_id;
                info.anomaly_score = parseFloat(parsed.anomaly_score);
                info.max_anomaly_score = parseFloat(parsed.max_anomaly_score);
                info.model_type = parsed.model_type;
				info.most_anomalous_metric_value = parseFloat(parsed.most_anomalous_metric_value);  // ⬅️ ADD THIS LINE
            } catch (e) {
                console.error('[DASHBOARD] Failed to parse anomaly additional_info:', e);
            }
        }
        
        return info;
    },
    
    // ⬅️ Enhanced anomaly matching with CI and metric filtering
    getMetricAnomalies: function(metric) {
        var matched = [];
        
        if (!metric.hosts || !this.data.anomalies) return matched;
        
        for (var i = 0; i < this.data.anomalies.length; i++) {
            var anomaly = this.data.anomalies[i];
            
            if (metric.hosts.indexOf(anomaly.ci_name) !== -1 && 
                metric.name === anomaly.metric_name) {
                
                if (!anomaly.parsed_info) {
                    anomaly.parsed_info = this.parseAnomalyInfo(anomaly);
                }
                
                matched.push(anomaly);
            }
        }
        
        return matched;
    },
    
    // ⬅️ Find the closest data point timestamp for an anomaly
    findAnomalyDataPoint: function(metric, anomaly, hostIndex) {
        if (!metric.data || !metric.data[hostIndex]) return null;
        
        var hostData = metric.data[hostIndex];
        if (!hostData.timestamps || !hostData.values) return null;
        
        var anomalyTime = this.parseTimestampToMs(anomaly.initial_event_time || anomaly.sys_created_on);
        if (!anomalyTime) return null;
        
        var closestIndex = -1;
        var minDiff = Infinity;
        
        for (var i = 0; i < hostData.timestamps.length; i++) {
            var pointTime = this.parseTimestampToMs(hostData.timestamps[i]);
            if (!pointTime) continue;
            
            var diff = Math.abs(pointTime - anomalyTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        if (closestIndex >= 0 && minDiff < 600000) {
            return {
                index: closestIndex,
                timestamp: hostData.timestamps[closestIndex],
                value: hostData.values[closestIndex],
                hostIndex: hostIndex
            };
        }
        
        return null;
    },
    
    getMetricAlerts: function(metric) {
        var matched = [];
        
        if (!metric.hosts || !this.data.alerts) return matched;
        
        for (var i = 0; i < this.data.alerts.length; i++) {
            var alert = this.data.alerts[i];
            
            if (metric.hosts.indexOf(alert.ci_name) !== -1) {
                matched.push(alert);
            }
        }
        
        return matched;
    },
    
    getAlertEmoji: function(alert) {
        if (alert.state === 'Closed') {
            return '🟢';
        }
        
        switch(alert.severity) {
            case 1: return '🔴';
            case 2: return '🟠';
            case 3: return '🟡';
            case 4: return '🟡';
            default: return '🔵';
        }
    },

// 

// END OF PART 1
// Continue with Part 2 for rendering functions...
// 

// PART 2 of 3: Rendering Functions, UI Updates & Event Handlers
// 


    render: function() {
        document.getElementById('header-section').innerHTML = this.renderHeader();
        document.getElementById('filter-section').innerHTML = this.renderFilters();
        document.getElementById('legend-section').innerHTML = this.renderLegend();
        this.attachEventListeners();
        this.createTooltip();
    },

    renderHeader: function() {
        var alertCount = 0;
        var uniqueCIs = {};
        var totalDataPoints = 0;
        
        for (var i = 0; i < this.data.metrics.length; i++) {
            var metric = this.data.metrics[i];
            
            if (this.getAlertLevel(metric)) alertCount++;
            
            if (metric.hosts && Array.isArray(metric.hosts)) {
                for (var h = 0; h < metric.hosts.length; h++) {
                    uniqueCIs[metric.hosts[h]] = true;
                }
            }
            
            if (metric.data && Array.isArray(metric.data)) {
                for (var d = 0; d < metric.data.length; d++) {
                    if (metric.data[d].values && Array.isArray(metric.data[d].values)) {
                        totalDataPoints += metric.data[d].values.length;
                    }
                }
            }
        }
        
        var ciCount = Object.keys(uniqueCIs).length;
        
        var formattedCount = totalDataPoints > 1000 
            ? (totalDataPoints / 1000).toFixed(1) + 'k' 
            : totalDataPoints;
        
        var parts = [];
        parts.push('<div class="header">');
        parts.push('<div class="header-left">');
        parts.push('<div>');
        parts.push('<h1>Metric Intelligence</h1>');
        parts.push('<div class="metrics-count">');
        
        parts.push('<span style="color:#52B8FF;">');
        parts.push('<span id="metrics-count">' + this.data.metrics.length + ' metrics</span>');
        parts.push('<span style="color:#7D8791;"> | </span>');
        parts.push('<span id="ci-count">' + ciCount + ' CIs</span>');
        parts.push('<span style="color:#7D8791;"> | </span>');
        parts.push('<span id="data-points-count">' + formattedCount + ' data points</span>');
        
        if (alertCount > 0) {
            parts.push('<span style="color:#7D8791;"> | </span>');
            parts.push('<span style="color:#FF6B6B;">' + alertCount + ' alerts</span>');
        }
        
        parts.push('</span>');
        
        parts.push('<span class="reset-layout-btn" onclick="Dashboard.resetLayout()" title="Reset Layout">↩️</span>');
        
        parts.push('</div>');
        parts.push('</div>');
        parts.push('</div>');
        
        parts.push('<div class="header-right">');
        
        parts.push('<div class="theme-selector">');
        parts.push('<span class="theme-label">Theme:</span>');
        var currentTheme = localStorage.getItem('metric2ai_theme') || 'dark';
        parts.push('<select class="theme-select" id="theme-select">');
        parts.push('<option value="default"' + (currentTheme === 'default' ? ' selected' : '') + '>🌊 Infinite Blue</option>');
        parts.push('<option value="dark"' + (currentTheme === 'dark' ? ' selected' : '') + '>🌑 Dark Mode</option>');
        parts.push('<option value="light"' + (currentTheme === 'light' ? ' selected' : '') + '>☀️ Light Mode</option>');
        parts.push('</select>');
        parts.push('</div>');
        
        parts.push('<div class="auto-refresh-control">');
        parts.push('<span class="auto-refresh-label">Auto-refresh (30s)</span>');
        parts.push('<label class="toggle-switch">');
        var checked = this.data.autoRefresh ? ' checked' : '';
        parts.push('<input type="checkbox" id="auto-refresh-toggle"' + checked + '>');
        parts.push('<span class="toggle-slider"></span>');
        parts.push('</label>');
        parts.push('</div>');
        
        parts.push('<div class="col-selector">');
        parts.push('<span class="col-label">Cols:</span>');
        var cols = [2, 3, 4, 5, 6];
        for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            var active = (this.data.filters.columns === c) ? ' active' : '';
            parts.push('<button class="col-btn' + active + '" data-cols="' + c + '">' + c + '</button>');
        }
        parts.push('</div>');
        
        parts.push('<div class="live-clock">');
        parts.push('<div class="pulse-dot"></div>');
        parts.push('<span class="clock-time" id="live-clock">--:--:--</span>');
        parts.push('</div>');
        
        parts.push('</div>');
        parts.push('</div>');
        
        return parts.join('');
    },
    
    renderFilters: function() {
        var parts = [];
        parts.push('<div class="filter-bar">');
        
        parts.push('<div style="display:flex;gap:16px;align-items:center;">');
        
        parts.push('<div class="filter-group">');
        parts.push('<span class="filter-label">TIME:</span>');
        
        if (this.data.zoom.active) {
            var startMs = this.parseTimestampToMs(this.data.zoom.startTime);
            var endMs = this.parseTimestampToMs(this.data.zoom.endTime);
            var startDate = new Date(startMs);
            var endDate = new Date(endMs);
            var formatTime = function(d) {
                var h = d.getHours().toString().padStart(2, '0');
                var m = d.getMinutes().toString().padStart(2, '0');
                return h + ':' + m;
            };
            var zoomLabel = formatTime(startDate) + ' - ' + formatTime(endDate);
            
            parts.push('<button class="filter-select" onclick="Dashboard.resetTimeZoom()" ');
            parts.push('style="min-width:120px;font-size:11px;background:rgba(82,184,255,0.2);');
            parts.push('border-color:#52B8FF;color:#52B8FF;cursor:pointer;font-weight:500;">');
            parts.push('🔍 ' + zoomLabel + ' ↺</button>');
        } else {
            parts.push('<select class="filter-select" id="time-filter" style="min-width:80px;">');
            var times = ['1h', '2h', '6h', '12h', '24h', '2d'];
            for (var i = 0; i < times.length; i++) {
                var t = times[i];
                var selected = (this.data.filters.timeRange === t) ? ' selected' : '';
                parts.push('<option value="' + t + '"' + selected + '>' + t + '</option>');
            }
            parts.push('</select>');
        }
        parts.push('</div>');
        
        parts.push('<div class="filter-group" style="position:relative;">');
        parts.push('<span class="filter-label">SEARCH:</span>');
        parts.push('<input type="text" id="search-input" class="filter-select" ');
        parts.push('placeholder="metric or CI name..." ');
        parts.push('value="' + (this.data.filters.searchQuery || '') + '" ');
        parts.push('style="width:200px;font-size:11px;padding:6px 24px 6px 8px;">');
        if (this.data.filters.searchQuery) {
            parts.push('<button class="search-clear-btn" onclick="Dashboard.clearSearch()" ');
            parts.push('style="position:absolute;right:4px;top:50%;transform:translateY(-50%);');
            parts.push('background:transparent;border:none;color:var(--text-muted);cursor:pointer;');
            parts.push('font-size:14px;padding:2px 6px;" title="Clear search">✕</button>');
        }
        parts.push('</div>');
        
        parts.push('</div>');
        
        parts.push('<div style="display:flex;gap:12px;margin-left:auto;align-items:center;">');
        
        parts.push('<div class="filter-group">');
        parts.push('<span class="filter-label">CI CLASS:</span>');
        parts.push('<select class="filter-select" id="ciclass-filter">');
        parts.push('<option value="All">All ▼</option>');
        var ciClasses = this.getUniqueCIClasses();
        for (var c = 0; c < ciClasses.length; c++) {
            var selected = (this.data.filters.ciClass === ciClasses[c]) ? ' selected' : '';
            var displayName = ciClasses[c].replace('cmdb_ci_', '');
            parts.push('<option value="' + ciClasses[c] + '"' + selected + '>' + displayName + '</option>');
        }
        parts.push('</select>');
        parts.push('</div>');
        
        parts.push('<div class="filter-group" style="position:relative;">');
        parts.push('<span class="filter-label">CI NAME:</span>');
        var ciNameCount = this.data.filters.ciNames.length;
        var ciNameLabel = ciNameCount === 0 ? 'All' : ciNameCount + ' selected';
        parts.push('<button class="filter-select multi-select-btn" id="ciname-toggle" style="text-align:left;">');
        parts.push(ciNameLabel + ' ▼');
        parts.push('</button>');
        parts.push('<div class="multi-select-dropdown" id="ciname-dropdown" style="display:none;">');
        var ciNames = this.getUniqueCINames(this.data.filters.ciClass);
        for (var n = 0; n < ciNames.length; n++) {
            var checked = this.data.filters.ciNames.indexOf(ciNames[n]) !== -1 ? ' checked' : '';
            parts.push('<label class="multi-select-option">');
            parts.push('<input type="checkbox" value="' + ciNames[n] + '"' + checked + ' data-filter="ciname">');
            parts.push('<span>' + ciNames[n] + '</span>');
            parts.push('</label>');
        }
        parts.push('</div>');
        parts.push('</div>');
        
        parts.push('<div class="filter-group" style="position:relative;">');
        parts.push('<span class="filter-label">METRIC:</span>');
        var metricNameCount = this.data.filters.metricNames.length;
        var metricNameLabel = metricNameCount === 0 ? 'All' : metricNameCount + ' selected';
        parts.push('<button class="filter-select multi-select-btn" id="metric-toggle" style="text-align:left;min-width:150px;">');
        parts.push(metricNameLabel + ' ▼');
        parts.push('</button>');
        parts.push('<div class="multi-select-dropdown" id="metric-dropdown" style="display:none;">');
        var metricNames = this.getUniqueMetricNames(this.data.filters.ciClass);
        for (var m = 0; m < metricNames.length; m++) {
            var checked = this.data.filters.metricNames.indexOf(metricNames[m]) !== -1 ? ' checked' : '';
            var metricCiClass = '';
            for (var i = 0; i < this.data.allMetrics.length; i++) {
                if (this.data.allMetrics[i].name === metricNames[m]) {
                    metricCiClass = (this.data.allMetrics[i].ciClass || '').replace('cmdb_ci_', '');
                    break;
                }
            }
            var displayName = metricNames[m] + ' [' + metricCiClass + ']';
            parts.push('<label class="multi-select-option">');
            parts.push('<input type="checkbox" value="' + metricNames[m] + '"' + checked + ' data-filter="metric">');
            parts.push('<span>' + displayName + '</span>');
            parts.push('</label>');
        }
        parts.push('</div>');
        parts.push('</div>');
        
        parts.push('</div>');
        parts.push('</div>');
        
        return parts.join('');
    },
    
    renderLegend: function() {
        var parts = [];
        parts.push('<div class="legend-section">');
        
        parts.push('<div class="legend-toggle-control">');
        parts.push('<span class="legend-toggle-label">Show Anomalies</span>');
        parts.push('<label class="toggle-switch toggle-switch-small">');
        var anomaliesChecked = this.data.showAnomalies ? ' checked' : '';
        parts.push('<input type="checkbox" id="show-anomalies-toggle"' + anomaliesChecked + '>');
        parts.push('<span class="toggle-slider"></span>');
        parts.push('</label>');
        parts.push('</div>');
        
        parts.push('<div class="legend-toggle-control">');
        parts.push('<span class="legend-toggle-label">Show Alerts</span>');
        parts.push('<label class="toggle-switch toggle-switch-small">');
        var alertsChecked = this.data.showAlerts ? ' checked' : '';
        parts.push('<input type="checkbox" id="show-alerts-toggle"' + alertsChecked + '>');
        parts.push('<span class="toggle-slider"></span>');
        parts.push('</label>');
        parts.push('</div>');
        
        parts.push('<div class="legend-divider"></div>');
        
        var ciNames = this.getFilteredCINames().slice(0, 8);
        for (var i = 0; i < ciNames.length; i++) {
            var shortName = ciNames[i].length > 15 ? ciNames[i].substring(0, 12) + '...' : ciNames[i];
            var colorPalette = this.getColorPalette('');
            
            for (var m = 0; m < this.data.metrics.length; m++) {
                if (this.data.metrics[m].hosts && this.data.metrics[m].hosts.indexOf(ciNames[i]) !== -1) {
                    colorPalette = this.getColorPalette(this.data.metrics[m].name);
                    break;
                }
            }
            
            parts.push('<div class="legend-item legend-ci-item" data-ci-name="' + ciNames[i] + '" style="cursor:help;">');
            parts.push('<div class="legend-dot" style="background:' + colorPalette[i % colorPalette.length] + ';"></div>');
            parts.push('<span>' + shortName + '</span>');
            parts.push('</div>');
        }
        
        parts.push('</div>');
        return parts.join('');
    },
    
    getFilteredCINames: function() {
        var names = [];
        for (var i = 0; i < this.data.metrics.length; i++) {
            var metric = this.data.metrics[i];
            if (metric.hosts && Array.isArray(metric.hosts)) {
                for (var j = 0; j < metric.hosts.length; j++) {
                    if (names.indexOf(metric.hosts[j]) === -1) {
                        names.push(metric.hosts[j]);
                    }
                }
            }
        }
        return names.sort();
    },
    
    // ⬅️ UPDATED - Only render when showAlerts is true, with sortable/filterable columns
    renderAlertsSection: function() {
        // ⬅️ NEW - Only render if Show Alerts is enabled
        if (!this.data.showAlerts) {
            return ''; // Return empty string if alerts are disabled
        }
        
        var parts = [];
        
        // Apply current filters to alerts
        var filteredAlerts = this.getFilteredAlerts();
        
        // Calculate severity counts
        var severityCounts = {
            critical: 0,
            major: 0,
            minor: 0,
            warning: 0,
            info: 0
        };
        
        for (var i = 0; i < filteredAlerts.length; i++) {
            var alert = filteredAlerts[i];
            var sevLabel = alert.severity_label ? alert.severity_label.toLowerCase() : 'info';
            if (severityCounts[sevLabel] !== undefined) {
                severityCounts[sevLabel]++;
            }
        }
        
        parts.push('<div class="alerts-container">');
        
        // Header
        parts.push('<div class="alerts-header" onclick="Dashboard.toggleAlertsSection()">');
        parts.push('<div class="alerts-header-left">');
        parts.push('<h3>Alerts</h3>');
        
        // Simple text format instead of pills - matching metrics header style
        if (filteredAlerts.length > 0) {
            var alertText = filteredAlerts.length + ' Alerts';
            
            if (severityCounts.critical > 0) {
                alertText += ' | ' + severityCounts.critical + ' Critical';
            }
            if (severityCounts.major > 0) {
                alertText += ' | ' + severityCounts.major + ' Major';
            }
            if (severityCounts.minor > 0) {
                alertText += ' | ' + severityCounts.minor + ' Minor';
            }
            if (severityCounts.warning > 0) {
                alertText += ' | ' + severityCounts.warning + ' Warning';
            }
            
            parts.push('<div class="alerts-count-text">' + alertText);
            
            // Clear Filters button
            parts.push('<button class="clear-filters-btn" onclick="event.stopPropagation(); Dashboard.clearAllAlertFilters();" title="Clear Filters">↩️</button>');
            
            parts.push('</div>');
        } else {
            parts.push('<div class="alerts-count-text">0 Alerts');
            
            // Clear Filters button
            parts.push('<button class="clear-filters-btn" onclick="event.stopPropagation(); Dashboard.clearAllAlertFilters();" title="Clear Filters">↩️</button>');
            
            parts.push('</div>');
        }
        
        parts.push('</div>');
        
        // Chevron
        var chevronClass = this.data.isAlertsExpanded ? 'chevron expanded' : 'chevron';
        parts.push('<svg class="' + chevronClass + '" id="alerts-chevron" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">');
        parts.push('<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>');
        parts.push('</svg>');
        
        parts.push('</div>'); // end alerts-header
        
        // Content
        var contentClass = this.data.isAlertsExpanded ? 'alerts-content expanded' : 'alerts-content';
        parts.push('<div class="' + contentClass + '" id="alerts-content">');
        
        // Always show table with headers so filters can be cleared
        parts.push('<div class="alerts-table-container">');
        parts.push('<table class="alert-table">');
        
        // ⬅️ UPDATED - Table Header with sortable columns and filters
        parts.push('<thead>');
        parts.push('<tr>');
        parts.push('<th style="width:4px;"></th>');
            
            // Created column - sortable
            var createdSortClass = this.data.alertSort.column === 'sys_created_on' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + createdSortClass + '" data-column="sys_created_on">');
            parts.push('Created');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // Number column - sortable with filter
            var numberSortClass = this.data.alertSort.column === 'number' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + numberSortClass + '" data-column="number">');
            parts.push('Number');
            parts.push('<div class="column-filter">');
            parts.push('<input type="text" placeholder="Filter..." value="' + (this.data.alertFilters.number || '') + '" data-filter-column="number">');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // ⬅️ NEW ORDER - State column (moved here between Number and Severity)
            var stateSortClass = this.data.alertSort.column === 'state' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + stateSortClass + '" data-column="state">');
            parts.push('State');
            parts.push('<div class="column-filter">');
            parts.push('<select data-filter-column="state">');
            parts.push('<option value="">All</option>');
            parts.push('<option value="Open"' + (this.data.alertFilters.state === 'Open' ? ' selected' : '') + '>Open</option>');
            parts.push('<option value="Closed"' + (this.data.alertFilters.state === 'Closed' ? ' selected' : '') + '>Closed</option>');
            parts.push('<option value="Flapping"' + (this.data.alertFilters.state === 'Flapping' ? ' selected' : '') + '>Flapping</option>');
            parts.push('</select>');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // Severity column - sortable with filter
            var severitySortClass = this.data.alertSort.column === 'severity' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + severitySortClass + '" data-column="severity">');
            parts.push('Severity');
            parts.push('<div class="column-filter">');
            parts.push('<select data-filter-column="severity">');
            parts.push('<option value="">All</option>');
            parts.push('<option value="1"' + (this.data.alertFilters.severity === '1' ? ' selected' : '') + '>Critical</option>');
            parts.push('<option value="2"' + (this.data.alertFilters.severity === '2' ? ' selected' : '') + '>Major</option>');
            parts.push('<option value="3"' + (this.data.alertFilters.severity === '3' ? ' selected' : '') + '>Minor</option>');
            parts.push('<option value="4"' + (this.data.alertFilters.severity === '4' ? ' selected' : '') + '>Warning</option>');
            parts.push('</select>');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // Source column - sortable with filter
            var sourceSortClass = this.data.alertSort.column === 'source' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + sourceSortClass + '" data-column="source">');
            parts.push('Source');
            parts.push('<div class="column-filter">');
            parts.push('<select data-filter-column="source">');
            parts.push('<option value="">All</option>');
            var uniqueSources = this.getUniqueAlertSources(filteredAlerts);
            for (var s = 0; s < uniqueSources.length; s++) {
                var selected = this.data.alertFilters.source === uniqueSources[s] ? ' selected' : '';
                parts.push('<option value="' + uniqueSources[s] + '"' + selected + '>' + uniqueSources[s] + '</option>');
            }
            parts.push('</select>');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // CI Name column
            parts.push('<th class="resizable">Configuration Item<div class="column-resizer"></div></th>');
            
            // Description column - with keyword filter
            parts.push('<th class="resizable">Description');
            parts.push('<div class="column-filter">');
            parts.push('<input type="text" placeholder="Search..." value="' + (this.data.alertFilters.description || '') + '" data-filter-column="description">');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // ⬅️ Group column (uses group_source field, not group)
            var groupSortClass = this.data.alertSort.column === 'group_source' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + groupSortClass + '" data-column="group_source" style="width: 120px;">');
            parts.push('Group');
            parts.push('<div class="column-filter">');
            parts.push('<select data-filter-column="group_source">');
            parts.push('<option value="">All</option>');
            parts.push('<option value="1"' + (this.data.alertFilters.group_source === '1' ? ' selected' : '') + '>Automated</option>');
            parts.push('<option value="2"' + (this.data.alertFilters.group_source === '2' ? ' selected' : '') + '>Rules-based</option>');
            parts.push('<option value="3"' + (this.data.alertFilters.group_source === '3' ? ' selected' : '') + '>Manual</option>');
            parts.push('<option value="4"' + (this.data.alertFilters.group_source === '4' ? ' selected' : '') + '>CMDB</option>');
            parts.push('<option value="5"' + (this.data.alertFilters.group_source === '5' ? ' selected' : '') + '>Secondary</option>');
            parts.push('<option value="6"' + (this.data.alertFilters.group_source === '6' ? ' selected' : '') + '>None</option>');
            parts.push('<option value="8"' + (this.data.alertFilters.group_source === '8' ? ' selected' : '') + '>Text</option>');
            parts.push('<option value="9"' + (this.data.alertFilters.group_source === '9' ? ' selected' : '') + '>Log Analytics</option>');
            parts.push('<option value="10"' + (this.data.alertFilters.group_source === '10' ? ' selected' : '') + '>Component-based</option>');
            parts.push('<option value="11"' + (this.data.alertFilters.group_source === '11' ? ' selected' : '') + '>Tag Cluster</option>');
            parts.push('<option value="12"' + (this.data.alertFilters.group_source === '12' ? ' selected' : '') + '>Network Traffic</option>');
            parts.push('<option value="13"' + (this.data.alertFilters.group_source === '13' ? ' selected' : '') + '>Mixed</option>');
            parts.push('</select>');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // ⬅️ NEW - Parent column (formatted like Number, same width)
            var parentSortClass = this.data.alertSort.column === 'parent' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + parentSortClass + '" data-column="parent" style="width: 120px;">');
            parts.push('Parent');
            parts.push('<div class="column-filter">');
            parts.push('<input type="text" placeholder="Filter..." value="' + (this.data.alertFilters.parent || '') + '" data-filter-column="parent">');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // ⬅️ Type column (sortable with filter)
            var typeSortClass = this.data.alertSort.column === 'type' 
                ? (this.data.alertSort.direction === 'asc' ? ' sort-asc' : ' sort-desc') 
                : '';
            parts.push('<th class="sortable resizable' + typeSortClass + '" data-column="type">');
            parts.push('Type');
            parts.push('<div class="column-filter">');
            parts.push('<select data-filter-column="type">');
            parts.push('<option value="">All</option>');
            var uniqueTypes = this.getUniqueAlertTypes(filteredAlerts);
            for (var t = 0; t < uniqueTypes.length; t++) {
                var selected = this.data.alertFilters.type === uniqueTypes[t] ? ' selected' : '';
                parts.push('<option value="' + uniqueTypes[t] + '"' + selected + '>' + uniqueTypes[t] + '</option>');
            }
            parts.push('</select>');
            parts.push('</div>');
            parts.push('<div class="column-resizer"></div>');
            parts.push('</th>');
            
            // Metric Name column (after type, word-wrapped, smaller)
            parts.push('<th class="resizable">Metric Name<div class="column-resizer"></div></th>');
            
            // Event Count column
            parts.push('<th class="resizable">Event Count<div class="column-resizer"></div></th>');
            
            parts.push('</tr>');
            parts.push('</thead>');
            
            // Table Body
            parts.push('<tbody>');
            
            for (var i = 0; i < filteredAlerts.length; i++) {
                var alert = filteredAlerts[i];
                
                parts.push('<tr>');
                
                // Severity bar
                var barClass = 'alert-severity-bar ';
                if (alert.severity === 1) barClass += 'severity-critical';
                else if (alert.severity === 2) barClass += 'severity-major';
                else if (alert.severity === 3) barClass += 'severity-minor';
                else if (alert.severity === 4) barClass += 'severity-warning';
                else barClass += 'severity-info';
                
                parts.push('<td><div class="' + barClass + '" style="height:20px;"></div></td>');
                
                // Created timestamp
                var createdTime = this.formatAlertTimestamp(alert.sys_created_on);
                parts.push('<td class="alert-timestamp">' + createdTime + '</td>');
                
                // Alert number (clickable link) - Opens in new tab with SOW URL format
                var alertUrl = '/now/sow/record/em_alert/' + alert.sys_id + '/params/selected-tab-index/1/selected-tab/id%3Dcl1kajg2y015e3f71kyb7f5qr';
                parts.push('<td><a href="' + alertUrl + '" class="alert-number" target="_blank">' + alert.number + '</a></td>');
                
                // ⬅️ State - Plain text (no pill)
                var stateText = alert.state || 'Unknown';
                
                if (stateText === 'Closed' || alert.state_value === '4') {
                    stateText = 'Closed';
                } else if (stateText === 'Flapping') {
                    stateText = 'Flapping';
                } else {
                    if (stateText === 'Unknown') stateText = 'Open';
                }
                
                parts.push('<td class="alert-state-text">' + stateText + '</td>');
                
                // Severity badge
                var sevBadgeClass = 'severity-badge ';
                if (alert.severity === 1) sevBadgeClass += 'severity-critical';
                else if (alert.severity === 2) sevBadgeClass += 'severity-major';
                else if (alert.severity === 3) sevBadgeClass += 'severity-minor';
                else if (alert.severity === 4) sevBadgeClass += 'severity-warning';
                else sevBadgeClass += 'severity-info';
                
                parts.push('<td><span class="' + sevBadgeClass + '">' + (alert.severity_label || 'Info') + '</span></td>');
                
                // Source
                parts.push('<td class="alert-source">' + (alert.source || 'N/A') + '</td>');
                
                // CI Name - Hyperlink to CI record in SOW
                // Check for various possible field name combinations
                var ciSysId = alert.cmdb_ci_sys_id || alert.ci_sys_id || alert.cmdb_ci || '';
                var ciClass = alert.ci_class || alert.cmdb_ci_class || alert.sys_class_name || '';
                var ciName = alert.ci_name || 'N/A';
                
                if (ciSysId && ciClass) {
                    var ciUrl = '/now/sow/record/' + ciClass + '/' + ciSysId;
                    parts.push('<td><a href="' + ciUrl + '" class="alert-ci-link" target="_blank">' + ciName + '</a></td>');
                } else {
                    parts.push('<td class="alert-ci-name">' + ciName + '</td>');
                }
                
                // Description - word wrapped
                var description = alert.short_description || alert.description || 'N/A';
                parts.push('<td class="alert-description" title="' + (alert.short_description || '') + '">' + description + '</td>');
                
                // Group column (uses group_source field with display value)
                var groupSourceValue = alert.group_source || '';
                var groupSourceLabel = alert.group_source_label || 'N/A';
                
                // Fallback mapping if display value not provided
                if (!alert.group_source_label && groupSourceValue) {
                    var groupSourceMap = {
                        '1': 'Automated',
                        '2': 'Rules-based',
                        '3': 'Manual',
                        '4': 'CMDB',
                        '5': 'Secondary',
                        '6': 'None',
                        '8': 'Text',
                        '9': 'Log Analytics',
                        '10': 'Component-based',
                        '11': 'Tag Cluster',
                        '12': 'Network Traffic',
                        '13': 'Mixed'
                    };
                    if (groupSourceMap[groupSourceValue]) {
                        groupSourceLabel = groupSourceMap[groupSourceValue];
                    }
                }
                parts.push('<td class="alert-group">' + groupSourceLabel + '</td>');
                
                // ⬅️ NEW - Parent column (formatted like alert number with hyperlink)
                if (alert.parent && alert.parent_number) {
                    var parentUrl = '/now/sow/record/em_alert/' + alert.parent + '/params/selected-tab-index/1/selected-tab/id%3Dcl1kajg2y015e3f71kyb7f5qr';
                    parts.push('<td><a href="' + parentUrl + '" class="alert-parent" target="_blank">' + alert.parent_number + '</a></td>');
                } else {
                    parts.push('<td class="alert-parent">-</td>');
                }
                
                // Type column
                parts.push('<td class="alert-type">' + (alert.type || 'N/A') + '</td>');
                
                // Metric Name (after type, word-wrapped, smaller width)
                parts.push('<td class="alert-metric">' + (alert.metric_name || 'N/A') + '</td>');
                
                // Event Count
                parts.push('<td><span class="event-count-badge">' + (alert.event_count || 1) + '</span></td>');
                
                parts.push('</tr>');
            }
            
            parts.push('</tbody>');
            parts.push('</table>');
            
            // Show empty state message if no alerts
            if (filteredAlerts.length === 0) {
                parts.push('<div class="alerts-empty-state">');
                parts.push('<div style="color: var(--text-muted); font-size: 14px; padding: 20px; text-align: center;">No alerts found for current filters</div>');
                parts.push('</div>');
            }
            
            parts.push('</div>'); // end alerts-table-container
        
        parts.push('</div>'); // end alerts-content
        parts.push('</div>'); // end alerts-container
        
        return parts.join('');
    },
    
    // ⬅️ NEW - Get unique sources from alerts for filter dropdown
    getUniqueAlertSources: function(alerts) {
        var sources = [];
        for (var i = 0; i < alerts.length; i++) {
            var source = alerts[i].source || 'N/A';
            if (sources.indexOf(source) === -1) {
                sources.push(source);
            }
        }
        return sources.sort();
    },
    
    // ⬅️ NEW - Get unique types from alerts for filter dropdown
    getUniqueAlertTypes: function(alerts) {
        var types = [];
        for (var i = 0; i < alerts.length; i++) {
            var type = alerts[i].type || 'N/A';
            if (types.indexOf(type) === -1) {
                types.push(type);
            }
        }
        return types.sort();
    },
    
    // ⬅️ NEW - Filter and sort alerts based on current state
    getFilteredAlerts: function() {
        var filtered = this.data.alerts.slice();
        
        if (!filtered || filtered.length === 0) return [];
        
 // ⬅️ REMOVED - No longer filtering alerts by displayed metrics
// Now shows ALL alerts from backend (already filtered by CI sys_ids in URL)
// This allows alerts to appear even if CI has no metrics displayed

// Apply search filter if present
if (this.data.filters.searchQuery && this.data.filters.searchQuery.trim() !== '') {
    var query = this.data.filters.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(function(alert) {
        var searchText = [
            alert.ci_name,
            alert.metric_name,
            alert.description,
            alert.short_description,
            alert.number
        ].join(' ').toLowerCase();
        
        return searchText.indexOf(query) !== -1;
    });
}
        
        // ⬅️ NEW - Apply column filters
        if (this.data.alertFilters.number) {
            var numberFilter = this.data.alertFilters.number.toLowerCase();
            filtered = filtered.filter(function(alert) {
                return alert.number && alert.number.toLowerCase().indexOf(numberFilter) !== -1;
            });
        }
        
        if (this.data.alertFilters.severity) {
            var severityFilter = parseInt(this.data.alertFilters.severity);
            filtered = filtered.filter(function(alert) {
                return alert.severity === severityFilter;
            });
        }
        
        if (this.data.alertFilters.source) {
            filtered = filtered.filter(function(alert) {
                return alert.source === Dashboard.data.alertFilters.source;
            });
        }
        
        if (this.data.alertFilters.state) {
            filtered = filtered.filter(function(alert) {
                var alertState = alert.state || (alert.state_value === '4' ? 'Closed' : 'Open');
                return alertState === Dashboard.data.alertFilters.state;
            });
        }
        
        if (this.data.alertFilters.type) {
            filtered = filtered.filter(function(alert) {
                return alert.type === Dashboard.data.alertFilters.type;
            });
        }
        
        // ⬅️ NEW - Description keyword filter (contains search)
        if (this.data.alertFilters.description) {
            var descFilter = this.data.alertFilters.description.toLowerCase();
            filtered = filtered.filter(function(alert) {
                var description = (alert.short_description || alert.description || '').toLowerCase();
                return description.indexOf(descFilter) !== -1;
            });
        }
        
        // Group Source filter
        if (this.data.alertFilters.group_source) {
            filtered = filtered.filter(function(alert) {
                return alert.group_source === Dashboard.data.alertFilters.group_source;
            });
        }
        
        // ⬅️ NEW - Parent filter (contains search)
        if (this.data.alertFilters.parent) {
            var parentFilter = this.data.alertFilters.parent.toLowerCase();
            filtered = filtered.filter(function(alert) {
                return alert.parent_number && alert.parent_number.toLowerCase().indexOf(parentFilter) !== -1;
            });
        }
        
        // ⬅️ NEW - Sort alerts based on current sort state
        filtered.sort(function(a, b) {
            var column = Dashboard.data.alertSort.column;
            var direction = Dashboard.data.alertSort.direction;
            
            var aVal, bVal;
            
            if (column === 'sys_created_on') {
                aVal = new Date(a.sys_created_on).getTime();
                bVal = new Date(b.sys_created_on).getTime();
            } else if (column === 'number') {
                aVal = a.number || '';
                bVal = b.number || '';
            } else if (column === 'severity') {
                aVal = a.severity || 0;
                bVal = b.severity || 0;
            } else if (column === 'source') {
                aVal = (a.source || '').toLowerCase();
                bVal = (b.source || '').toLowerCase();
            } else if (column === 'state') {
                aVal = (a.state || '').toLowerCase();
                bVal = (b.state || '').toLowerCase();
            } else if (column === 'type') {
                aVal = (a.type || '').toLowerCase();
                bVal = (b.type || '').toLowerCase();
            } else if (column === 'group_source') {
                aVal = (a.group_source || '').toLowerCase();
                bVal = (b.group_source || '').toLowerCase();
            } else if (column === 'parent') {
                aVal = (a.parent_number || '').toLowerCase();
                bVal = (b.parent_number || '').toLowerCase();
            } else {
                return 0;
            }
            
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return filtered;
    },
    
    // ⬅️ NEW - Handle alert column sorting
    handleAlertSort: function(column) {
        if (this.data.alertSort.column === column) {
            // Toggle direction
            this.data.alertSort.direction = this.data.alertSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column
            this.data.alertSort.column = column;
            this.data.alertSort.direction = 'desc';
        }
        
        console.log('[DASHBOARD] Sorting alerts by', column, this.data.alertSort.direction);
        
        // Re-render alerts section only
        document.getElementById('alerts-section').innerHTML = this.renderAlertsSection();
        this.attachAlertListeners();
    },
    
    // ⬅️ NEW - Handle alert column filter change
    handleAlertFilterChange: function(column, value) {
        this.data.alertFilters[column] = value;
        console.log('[DASHBOARD] Filtering alerts', column, '=', value);
        
        // Re-render alerts section only
        document.getElementById('alerts-section').innerHTML = this.renderAlertsSection();
        this.attachAlertListeners();
    },
    
    // ⬅️ NEW - Attach event listeners to alert table
    attachAlertListeners: function() {
        // Sortable column headers
        var sortableHeaders = document.querySelectorAll('.alert-table th.sortable');
        for (var i = 0; i < sortableHeaders.length; i++) {
            sortableHeaders[i].addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                var column = this.getAttribute('data-column');
                if (column) {
                    Dashboard.handleAlertSort(column);
                }
            });
        }
        
        // Column filters
        var filterInputs = document.querySelectorAll('.alert-table .column-filter input');
        for (var j = 0; j < filterInputs.length; j++) {
            filterInputs[j].addEventListener('input', function(e) {
                e.stopPropagation();
                var column = this.getAttribute('data-filter-column');
                var value = this.value;
                Dashboard.handleAlertFilterChange(column, value);
            });
        }
        
        var filterSelects = document.querySelectorAll('.alert-table .column-filter select');
        for (var k = 0; k < filterSelects.length; k++) {
            filterSelects[k].addEventListener('change', function(e) {
                e.stopPropagation();
                var column = this.getAttribute('data-filter-column');
                var value = this.value;
                Dashboard.handleAlertFilterChange(column, value);
            });
        }
        
        // Column resizers (basic implementation)
        var resizers = document.querySelectorAll('.alert-table .column-resizer');
        for (var r = 0; r < resizers.length; r++) {
            resizers[r].addEventListener('mousedown', function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                var th = this.parentElement;
                var startX = e.pageX;
                var startWidth = th.offsetWidth;
                
                var onMouseMove = function(e) {
                    var width = startWidth + (e.pageX - startX);
                    th.style.width = width + 'px';
                    th.style.minWidth = width + 'px';
                };
                
                var onMouseUp = function() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
    },
    
    // ⬅️ NEW - Format alert timestamp
    formatAlertTimestamp: function(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            var date = new Date(timestamp);
            var month = (date.getMonth() + 1).toString().padStart(2, '0');
            var day = date.getDate().toString().padStart(2, '0');
            var hours = date.getHours().toString().padStart(2, '0');
            var minutes = date.getMinutes().toString().padStart(2, '0');
            
            return month + '/' + day + ' ' + hours + ':' + minutes;
        } catch (e) {
            return timestamp;
        }
    },
    
    attachEventListeners: function() {
        var self = this;
        
        var timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            timeFilter.addEventListener('change', function() {
                Dashboard.setTimeRange(this.value);
            });
        }
        
        var colBtns = document.querySelectorAll('.col-btn');
        for (var j = 0; j < colBtns.length; j++) {
            colBtns[j].addEventListener('click', function() {
                Dashboard.setColumns(parseInt(this.getAttribute('data-cols')));
            });
        }
        
        var ciClassFilter = document.getElementById('ciclass-filter');
        if (ciClassFilter) {
            ciClassFilter.addEventListener('change', function() {
                Dashboard.setCIClassFilter(this.value);
            });
        }
        
        var autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', function() {
                Dashboard.toggleAutoRefresh();
            });
        }
        
        var themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', function() {
                Dashboard.setTheme(this.value);
            });
        }
        
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var value = this.value;
                
                if (Dashboard.intervals.searchTimeout) {
                    clearTimeout(Dashboard.intervals.searchTimeout);
                }
                
                Dashboard.intervals.searchTimeout = setTimeout(function() {
                    Dashboard.data.filters.searchQuery = value;
                    Dashboard.applyFilters();
                    Dashboard.updateUI();
                    document.getElementById('header-section').innerHTML = Dashboard.renderHeader();
                    Dashboard.attachHeaderListeners();
                    document.getElementById('legend-section').innerHTML = Dashboard.renderLegend();
                    Dashboard.attachLegendListeners();
                }, 300);
            });
            
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    Dashboard.clearSearch();
                }
            });
        }
        
        var ciNameToggle = document.getElementById('ciname-toggle');
        if (ciNameToggle) {
            ciNameToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                Dashboard.toggleDropdown('ciname-dropdown');
            });
        }
        
        var metricToggle = document.getElementById('metric-toggle');
        if (metricToggle) {
            metricToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                Dashboard.toggleDropdown('metric-dropdown');
            });
        }
        
        this.attachLegendListeners();
        
        var checkboxes = document.querySelectorAll('.multi-select-dropdown input[type="checkbox"]');
        for (var k = 0; k < checkboxes.length; k++) {
            checkboxes[k].addEventListener('change', function(e) {
                e.stopPropagation();
                Dashboard.handleCheckboxChange(this);
            });
        }
        
        document.addEventListener('click', function() {
            Dashboard.closeAllDropdowns();
            Dashboard.closeCardMenu();
        });
    },
    
    attachLegendListeners: function() {
        var anomaliesToggle = document.getElementById('show-anomalies-toggle');
        if (anomaliesToggle) {
            anomaliesToggle.addEventListener('change', function() {
                Dashboard.toggleShowAnomalies();
            });
        }
        
        var alertsToggle = document.getElementById('show-alerts-toggle');
        if (alertsToggle) {
            alertsToggle.addEventListener('change', function() {
                Dashboard.toggleShowAlerts();
            });
        }
        
        var ciLegendItems = document.querySelectorAll('.legend-ci-item');
        for (var i = 0; i < ciLegendItems.length; i++) {
            ciLegendItems[i].addEventListener('mouseenter', function(e) {
                Dashboard.showCITooltip(e, this.getAttribute('data-ci-name'));
            });
            
            ciLegendItems[i].addEventListener('mouseleave', function() {
                Dashboard.hideTooltip();
            });
        }
    },
    
    attachHeaderListeners: function() {
        var colBtns = document.querySelectorAll('.col-btn');
        for (var j = 0; j < colBtns.length; j++) {
            colBtns[j].addEventListener('click', function() {
                Dashboard.setColumns(parseInt(this.getAttribute('data-cols')));
            });
        }
        
        var autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', function() {
                Dashboard.toggleAutoRefresh();
            });
        }
        
        var themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', function() {
                Dashboard.setTheme(this.value);
            });
        }
    },
    
    showCITooltip: function(event, ciName) {
        var attrs = this.getCIAttributes(ciName);
        if (!attrs) return;
        
        var content = '<div style="line-height:1.6;">';
        content += '<div style="font-weight:600;color:#63DF4E;margin-bottom:6px;">📍 CI Attributes</div>';
        content += '<div style="border-top:1px solid rgba(99,223,78,0.3);padding-top:6px;">';
        content += '<div><span style="color:#7D8791;">CI Name:</span> <span style="color:#fff;font-weight:500;">' + attrs.name + '</span></div>';
        content += '<div><span style="color:#7D8791;">CI Class:</span> <span style="color:#52B8FF;">' + attrs.ciClass + '</span></div>';
        content += '<div><span style="color:#7D8791;">Support Group:</span> <span style="color:#C2E6FF;">' + attrs.supportGroup + '</span></div>';
        content += '<div><span style="color:#7D8791;">Location:</span> <span style="color:#C2E6FF;">' + attrs.location + '</span></div>';
        content += '</div></div>';
        
        this.showTooltip(event.clientX, event.clientY, content);
    },
    
    toggleDropdown: function(dropdownId) {
        var dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        var wasVisible = dropdown.style.display === 'block';
        this.closeAllDropdowns();
        
        if (!wasVisible) {
            dropdown.style.display = 'block';
        }
    },
    
    closeAllDropdowns: function() {
        var dropdowns = document.querySelectorAll('.multi-select-dropdown');
        for (var i = 0; i < dropdowns.length; i++) {
            dropdowns[i].style.display = 'none';
        }
    },
    
    handleCheckboxChange: function(checkbox) {
        var filterType = checkbox.getAttribute('data-filter');
        var value = checkbox.value;
        var checked = checkbox.checked;
        
        if (filterType === 'ciname') {
            var index = this.data.filters.ciNames.indexOf(value);
            if (checked && index === -1) {
                this.data.filters.ciNames.push(value);
            } else if (!checked && index !== -1) {
                this.data.filters.ciNames.splice(index, 1);
            }
            var ciNameToggle = document.getElementById('ciname-toggle');
            if (ciNameToggle) {
                var count = this.data.filters.ciNames.length;
                ciNameToggle.innerHTML = (count === 0 ? 'All' : count + ' selected') + ' ▼';
            }
        } else if (filterType === 'metric') {
            var index = this.data.filters.metricNames.indexOf(value);
            if (checked && index === -1) {
                this.data.filters.metricNames.push(value);
            } else if (!checked && index !== -1) {
                this.data.filters.metricNames.splice(index, 1);
            }
            var metricToggle = document.getElementById('metric-toggle');
            if (metricToggle) {
                var count = this.data.filters.metricNames.length;
                metricToggle.innerHTML = (count === 0 ? 'All' : count + ' selected') + ' ▼';
            }
        }
        
        this.applyFilters();
        this.updateUI();
        
        document.getElementById('header-section').innerHTML = this.renderHeader();
        this.attachHeaderListeners();
        
        document.getElementById('legend-section').innerHTML = this.renderLegend();
        this.attachLegendListeners();
    },
    
    setTimeRange: function(range) {
        this.data.filters.timeRange = range;
        this.render();
        this.loadData();
    },
    
    setColumns: function(cols) {
        this.data.filters.columns = cols;
        this.render();
        setTimeout(function() { Dashboard.updateUI(); }, 50);
    },
    
    setCIClassFilter: function(ciClass) {
        this.data.filters.ciClass = ciClass;
        this.data.filters.ciNames = [];
        this.data.filters.metricNames = [];
        this.applyFilters();
        this.render();
        this.updateUI();
    },
    
    updateUI: function() {
        var grid = document.getElementById('metrics-grid');
        grid.className = 'metrics-grid cols-' + this.data.filters.columns;
        
        var count = document.getElementById('metrics-count');
        if (count) {
            count.textContent = this.data.metrics.length + ' metrics';
        }
        
        if (this.data.loading) {
            grid.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading metrics...</div></div>';
            return;
        }
        
        if (this.data.metrics.length === 0) {
            grid.innerHTML = '<div class="loading"><div style="font-size:48px;margin-bottom:16px;">🔍</div><div>No metrics found</div></div>';
        } else {
            this.applyCustomOrder();
            console.log('[DASHBOARD] Showing', this.data.metrics.length, 'metrics');
            
            var html = '';
            for (var i = 0; i < this.data.metrics.length; i++) {
                html += this.renderCard(this.data.metrics[i], i);
            }
            grid.innerHTML = html;
            
            this.attachDragListeners();
            
            setTimeout(function() { 
                console.log('[DASHBOARD] Drawing', Dashboard.data.metrics.length, 'charts');
                Dashboard.drawCharts(); 
            }, 100);
        }
        
        // ⬅️ UPDATED - Only render alerts section if showAlerts is true
        var alertsSection = document.getElementById('alerts-section');
        if (alertsSection) {
            alertsSection.innerHTML = this.renderAlertsSection();
            if (this.data.showAlerts) {
                this.attachAlertListeners();
            }
        }
    },
    
    showCardMenu: function(event, index) {
        event.stopPropagation();
        
        this.closeCardMenu();
        
        var metric = this.data.metrics[index];
        var metricId = this.getMetricId(metric);
        var currentSize = this.data.customSizes[metricId] || '1x1';
        var currentChartType = this.data.customChartTypes[metricId] || 'line';
        
        var menu = document.createElement('div');
        menu.className = 'card-menu-popup';
        menu.id = 'card-menu-popup';
        
        var html = '';
        
        html += '<div class="menu-section-title">Card Size</div>';
        
        var sizes = [
            { value: '1x1', label: 'Normal (1x1)', icon: '▢' },
            { value: '2x1', label: 'Wide (2x1)', icon: '▭' },
            { value: '1x2', label: 'Tall (1x2)', icon: '▯' },
            { value: '2x2', label: 'Large (2x2)', icon: '⬜' }
        ];
        
        for (var i = 0; i < sizes.length; i++) {
            var size = sizes[i];
            var activeClass = (size.value === currentSize) ? ' active' : '';
            html += '<div class="menu-item' + activeClass + '" onclick="Dashboard.setCardSize(' + index + ', \'' + size.value + '\')">';
            html += '<span class="size-icon">' + size.icon + '</span>';
            html += '<span>' + size.label + '</span>';
            html += '</div>';
        }
        
        html += '<hr>';
        
        html += '<div class="menu-section-title">Chart Type</div>';
        
        var chartTypes = [
            { value: 'line', label: 'Line Chart', icon: '📈' },
            { value: 'area', label: 'Area Chart', icon: '📊' },
            { value: 'step', label: 'Step Chart', icon: '📶' },
            { value: 'heatmap', label: 'Heatmap', icon: '🔥' }
        ];
        
        for (var j = 0; j < chartTypes.length; j++) {
            var chartType = chartTypes[j];
            var activeClass = (chartType.value === currentChartType) ? ' active' : '';
            html += '<div class="menu-item' + activeClass + '" onclick="Dashboard.setChartType(' + index + ', \'' + chartType.value + '\')">';
            html += '<span class="chart-type-icon">' + chartType.icon + '</span>';
            html += '<span>' + chartType.label + '</span>';
            html += '</div>';
        }
        
        html += '<hr>';
        
        html += '<div class="menu-item" onclick="Dashboard.exportMetricData(' + index + ')">📥 Export CSV</div>';
        html += '<div class="menu-item" onclick="Dashboard.copyMetricData(' + index + ')">📋 Copy Data</div>';
        
        menu.innerHTML = html;
        
        document.body.appendChild(menu);
        
        var buttonRect = event.target.getBoundingClientRect();
        var menuRect = menu.getBoundingClientRect();
        
        var left = buttonRect.left;
        var top = buttonRect.bottom + 5;
        
        if (left + menuRect.width > window.innerWidth) {
            left = window.innerWidth - menuRect.width - 10;
        }
        
        if (top + menuRect.height > window.innerHeight) {
            top = buttonRect.top - menuRect.height - 5;
        }
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    },
    
    closeCardMenu: function() {
        var menu = document.getElementById('card-menu-popup');
        if (menu) {
            menu.remove();
        }
    },

    renderCard: function(metric, index) {
        var parts = [];
        
        var alertLevel = this.getAlertLevel(metric);
        var alertClass = alertLevel ? ' alert-' + alertLevel : '';
        
        var metricId = this.getMetricId(metric);
        var size = this.data.customSizes[metricId] || '1x1';
        var sizeClass = ' size-' + size;
        
        var stats = this.calculateMetricStats(metric);
        
        var healthColorClass = 'excellent';
        if (stats.healthScore <= 15) {
            healthColorClass = 'critical';
        } else if (stats.healthScore <= 35) {
            healthColorClass = 'major';
        } else if (stats.healthScore <= 60) {
            healthColorClass = 'warning';
        } else if (stats.healthScore <= 85) {
            healthColorClass = 'good';
        }
        
        parts.push('<div class="metric-card' + alertClass + sizeClass + '" data-index="' + index + '">');
        
        parts.push('<div class="drag-handle">⋮⋮</div>');
        
        parts.push('<div class="metric-header" data-drag-handle="true">');
        
        parts.push('<div class="metric-title-section">');
        
        var longNameClass = metric.name.length > 40 ? ' long-name' : '';
        var displayName = metric.name;
        if (displayName.length > 50) {
            displayName = displayName.substring(0, 47) + '...';
        }
        parts.push('<div class="metric-title' + longNameClass + '" title="' + metric.name + '">' + displayName + '</div>');
        
        var trendClass = stats.trendDirection;
        var trendArrow = stats.trendDirection === 'up' ? '↗' : (stats.trendDirection === 'down' ? '↘' : '→');
        var trendSign = stats.trend >= 0 ? '+' : '';
        
        parts.push('<div class="trend-info">');
        parts.push('<span class="trend-label">vs 1h ago</span>');
        parts.push('<span class="trend-arrow ' + trendClass + '">' + trendArrow + '</span>');
        parts.push('<span class="trend-percent ' + trendClass + '">' + trendSign + stats.trend.toFixed(1) + '%</span>');
        parts.push('</div>');
        
        parts.push('</div>');
        
        parts.push('<div class="metric-actions">');
        
        var formattedValue = this.formatYAxisValue(stats.currentValue, metric.unit);
        if (metric.unit === 'percent' || metric.unit === 'percentage' || metric.unit === '%') {
            formattedValue += '%';
        }
        parts.push('<div class="current-value ' + healthColorClass + '">' + formattedValue + '</div>');
        
        if (metric.unit) {
            var unitDisplay = metric.unit;
            if (unitDisplay === 'bytes') unitDisplay = 'bytes';
            else if (unitDisplay === 'percent' || unitDisplay === 'percentage') unitDisplay = '%';
            parts.push('<div class="metric-unit">' + unitDisplay + '</div>');
        }
        
        parts.push('</div>');
        
        if (alertLevel) {
            var alertEmoji = alertLevel === 'critical' ? '🔴' : (alertLevel === 'major' ? '🟠' : '🟡');
            var alertText = alertLevel === 'critical' ? 'CRIT' : (alertLevel === 'major' ? 'MAJ' : 'WARN');
            parts.push('<div class="alert-badge ' + alertLevel + '">' + alertEmoji + ' ' + alertText + '</div>');
        }
        
        parts.push('</div>');
        
        parts.push('<div class="metric-chart" data-metric-index="' + index + '">');
        parts.push('<canvas id="chart-' + index + '"></canvas>');
        parts.push('</div>');
        
        parts.push('<div class="metric-footer">');
        parts.push('<div class="ci-info">');
        
        var ciDisplay = this.getCIClassDisplay(metric.ciClass);
        var ciClassCss = ciDisplay.cssClass ? ' ' + ciDisplay.cssClass : '';
        parts.push('<div class="ci-class' + ciClassCss + '">' + ciDisplay.name + '</div>');
        
        if (metric.hosts && metric.hosts.length > 0) {
            var colorPalette = this.getColorPalette(metric.name);
            
            if (metric.hosts.length <= 3) {
                parts.push('<div class="host-legend">');
                for (var h = 0; h < metric.hosts.length; h++) {
                    var hostColor = colorPalette[h % colorPalette.length];
                    
                    var hostValue = '';
                    if (metric.data && metric.data[h] && metric.data[h].values && metric.data[h].values.length > 0) {
                        var latestVal = metric.data[h].values[metric.data[h].values.length - 1];
                        hostValue = this.formatYAxisValue(latestVal, metric.unit);
                        if (metric.unit === '%' || metric.unit === 'percent') hostValue += '%';
                    }
                    
                    parts.push('<div class="host-item">');
                    parts.push('<div class="host-dot" style="background:' + hostColor + ';"></div>');
                    parts.push('<span>' + metric.hosts[h] + '</span>');
                    if (hostValue) {
                        parts.push('<span class="host-value">(' + hostValue + ')</span>');
                    }
                    parts.push('</div>');
                }
                parts.push('</div>');
            } else {
                parts.push('<div class="host-dots">');
                for (var h = 0; h < Math.min(metric.hosts.length, 8); h++) {
                    var hostColor = colorPalette[h % colorPalette.length];
                    parts.push('<div class="host-dot" style="background:' + hostColor + ';"></div>');
                }
                if (metric.hosts.length > 8) {
                    parts.push('<span class="host-count">+' + (metric.hosts.length - 8) + '</span>');
                }
                parts.push('</div>');
            }
        }
        
        parts.push('</div>');
        parts.push('</div>');
        
parts.push('<div class="anomalies-section">');
parts.push('<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">');

// ⬅️ ENHANCED - Get anomalies for this metric and display them with rich tooltips
parts.push('<div style="display: flex; align-items: center; gap: 8px; flex: 1;">');
parts.push('<div class="anomalies-label">Anomalies:</div>');

if (this.data.showAnomalies) {
    var metricAnomalies = this.getMetricAnomalies(metric);
    
    if (metricAnomalies.length > 0) {
        parts.push('<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">');
        
        for (var a = 0; a < metricAnomalies.length; a++) {
            var anomaly = metricAnomalies[a];
            
            // Parse anomaly info to get most_anomalous_metric_value
            if (!anomaly.parsed_info) {
                anomaly.parsed_info = this.parseAnomalyInfo(anomaly);
            }
            
            var iconData = this.getAnomalyIcon(anomaly.state_value, anomaly.severity, anomaly.description);
            var mostAnomalousValue = anomaly.parsed_info.most_anomalous_metric_value;
            
            // Format the value
            var formattedValue = 'N/A';
            if (mostAnomalousValue !== undefined && mostAnomalousValue !== null) {
                // Format number with commas and 2 decimal places
                var numValue = parseFloat(mostAnomalousValue).toFixed(2);
                var numParts = numValue.split('.');
                numParts[0] = numParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                formattedValue = numParts.join('.');
                
                // Append unit of measure
                var unit = metric.unit || '';
                if (unit) {
                    // Handle percentage units
                    if (unit === 'percent' || unit === 'percentage' || unit === '%') {
                        formattedValue += '%';
                    } else {
                        // Handle other units (bytes, ms, count, etc.)
                        formattedValue += ' ' + unit;
                    }
                }
            }
            
            // ⬅️ NEW - Build rich tooltip content
            var tooltipContent = this.buildAnomalyTooltip(anomaly, formattedValue, metric.unit);
            
            // ⬅️ NEW - Build anomaly URL
            var anomalyUrl = '/now/sow/record/em_alert_anomaly/' + anomaly.sys_id;
            
            // ⬅️ NEW - Add pulsing animation class for open anomalies
            var animationClass = (anomaly.state_value !== '4' && anomaly.state_value !== 'Closed') ? ' anomaly-pulse' : '';
            
            // Display: clickable icon (value) with rich tooltip
            parts.push('<a href="' + anomalyUrl + '" target="_blank" class="anomaly-item' + animationClass + '" ');
            parts.push('style="color:' + iconData.color + '; font-size: 12px; font-weight: 600; text-decoration: none; ');
            parts.push('cursor: pointer; display: inline-flex; align-items: center; gap: 2px; position: relative;" ');
            parts.push('onmouseenter="Dashboard.showAnomalyTooltip(event, \'' + anomaly.sys_id + '\', ' + index + ')" ');
            parts.push('onmouseleave="Dashboard.hideAnomalyTooltip()" ');
            parts.push('onclick="event.stopPropagation();">');
            parts.push(iconData.icon + ' (' + formattedValue + ')');
            parts.push('</a>');
            
            // Store tooltip data for this anomaly
            parts.push('<div id="anomaly-tooltip-data-' + anomaly.sys_id + '" style="display:none;">');
            parts.push(tooltipContent);
            parts.push('</div>');
        }
        
        parts.push('</div>');
    } else {
        parts.push('<span style="color: var(--text-muted); font-size: 11px;">None detected</span>');
    }
} else {
    parts.push('<span style="color: var(--text-muted); font-size: 11px;">Disabled</span>');
}

parts.push('</div>'); // closes the flex: 1 div

parts.push('<div class="footer-actions">');
parts.push('<div class="detail-icon" onclick="Dashboard.showDetail(' + index + ')">🎯</div>');
parts.push('<button class="menu-button" onclick="Dashboard.showCardMenu(event, ' + index + ')">⚙️</button>');
parts.push('</div>');

parts.push('</div>'); // closes justify-content: space-between div
parts.push('</div>'); // closes anomalies-section

parts.push('</div>'); // closes metric-footer
parts.push('</div>'); // closes metric-card
        
return parts.join('');
    },
    
    // 

    // ANOMALY TOOLTIP HELPER FUNCTIONS
    // 

    
    // Build compact anomaly tooltip HTML (matches metric tooltip style)
 buildAnomalyTooltip: function(anomaly, formattedValue, unit) {
    var info = anomaly.parsed_info;
    
    // Calculate age
    var age = this.getAnomalyAge(anomaly.sys_created_on);
    
    // ⬅️ IMPROVED - Format bounds with proper handling
    var lowerBound = 'N/A';
    var upperBound = 'N/A';
    
    if (info.metric_lower_bound !== undefined && info.metric_lower_bound !== null) {
        lowerBound = this.formatAnomalyValue(info.metric_lower_bound, unit);
    }
    
    if (info.metric_upper_bound !== undefined && info.metric_upper_bound !== null) {
        upperBound = this.formatAnomalyValue(info.metric_upper_bound, unit);
    }
    
    // ⬅️ IMPROVED - Get peak value with better formatting
    var peakValue = info.most_anomalous_metric_value || info.metric_value || 0;
    var formattedPeak = this.formatAnomalyValue(peakValue, unit);
    
    // ⬅️ IMPROVED - Determine direction (above/below baseline)
    var direction = '';
    var directionColor = '#FFB81C';
    
    if (anomaly.description) {
        if (anomaly.description.indexOf('above calculated boundary') > -1) {
            direction = '↑ Above Baseline';
            directionColor = '#FF6B57';
        } else if (anomaly.description.indexOf('below calculated boundary') > -1) {
            direction = '↓ Below Baseline';
            directionColor = '#3DD68C';
        }
    }
    
    var html = '<div style="line-height: 1.5; min-width: 220px;">';
    
    // Header with alert number and age
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.15);">';
    html += '<div style="font-weight: 700; color: #FFB81C; font-size: 13px;">' + anomaly.number + '</div>';
    html += '<div style="font-size: 10px; color: #B8BFC6;">' + age + '</div>';
    html += '</div>';
    
    // Node/CI name
    html += '<div style="margin-bottom: 8px;">';
    html += '<span style="color: #7D8791; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Node</span><br>';
    html += '<span style="color: #FFFFFF; font-weight: 600; font-size: 12px;">' + anomaly.ci_name + '</span>';
    html += '</div>';
    
    // ⬅️ IMPROVED - Show metric name for context
    html += '<div style="margin-bottom: 8px;">';
    html += '<span style="color: #7D8791; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Metric</span><br>';
    html += '<span style="color: #C2E6FF; font-size: 11px;">' + (info.source_metric_type || anomaly.metric_name) + '</span>';
    html += '</div>';
    
    // ⬅️ IMPROVED - Peak Value with direction indicator
    html += '<div style="margin: 12px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: baseline;">';
    html += '<span style="color: #FF6B57; font-weight: 700; font-size: 24px;">' + formattedPeak + '</span>';
    if (unit && unit !== '#') {
        html += '<span style="color: #7D8791; font-size: 11px;">' + unit + '</span>';
    }
    html += '</div>';
    
    // Direction indicator
    if (direction) {
        html += '<div style="margin-top: 6px; color: ' + directionColor + '; font-size: 11px; font-weight: 600;">' + direction + '</div>';
    }
    html += '</div>';
    
    // ⬅️ IMPROVED - Threshold Range with better formatting
    html += '<div style="margin-bottom: 8px;">';
    html += '<span style="color: #7D8791; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Normal Range</span><br>';
    html += '<span style="color: #3DD68C; font-size: 12px; font-weight: 500;">' + lowerBound + '</span>';
    html += '<span style="color: #7D8791; font-size: 12px;"> – </span>';
    html += '<span style="color: #3DD68C; font-size: 12px; font-weight: 500;">' + upperBound + '</span>';
    html += '</div>';
    
    // ⬅️ IMPROVED - Anomaly Score with visual bar
    if (info.max_anomaly_score !== undefined && info.max_anomaly_score > 0) {
        var scorePercent = Math.min((info.max_anomaly_score / 10) * 100, 100);
        html += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">';
        html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
        html += '<span style="color: #7D8791; font-size: 10px;">Anomaly Score</span>';
        html += '<span style="color: #FFB81C; font-size: 11px; font-weight: 600;">' + info.max_anomaly_score.toFixed(2) + '</span>';
        html += '</div>';
        
        // Score bar
        html += '<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">';
        html += '<div style="width: ' + scorePercent + '%; height: 100%; background: linear-gradient(90deg, #FFB81C 0%, #FF6B57 100%);"></div>';
        html += '</div>';
        html += '</div>';
    }
    
    // Footer with severity and model
    html += '<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">';
    html += '<div style="display: flex; justify-content: space-between; font-size: 9px; color: #7D8791;">';
    html += '<span>' + anomaly.severity_label + '</span>';
    if (info.model_type) {
        var modelShort = info.model_type.replace('_DETECTOR', '').replace(/_/g, ' ');
        html += '<span>' + modelShort + '</span>';
    }
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
},

formatAnomalyValue: function(value, unit) {
    if (value === undefined || value === null || isNaN(value)) {
        return 'N/A';
    }
    
    var lowerUnit = (unit || '').toLowerCase();
    
    // For percentages, show 2 decimals
    if (lowerUnit === '%' || lowerUnit === 'percent' || lowerUnit === 'percentage') {
        return value.toFixed(2) + '%';
    }
    
    // For bytes, use appropriate units
    if (lowerUnit.indexOf('byte') > -1) {
        if (value >= 1099511627776) return (value / 1099511627776).toFixed(2) + ' TB';
        if (value >= 1073741824) return (value / 1073741824).toFixed(2) + ' GB';
        if (value >= 1048576) return (value / 1048576).toFixed(2) + ' MB';
        if (value >= 1024) return (value / 1024).toFixed(2) + ' KB';
        return value.toFixed(0) + ' B';
    }
    
    // For large numbers, add commas
    if (value >= 1000) {
        return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    // For small numbers, show 2-3 decimals
    if (value < 10) {
        return value.toFixed(3);
    }
    
    return value.toFixed(2);
},

// Calculate anomaly age
    getAnomalyAge: function(timestamp) {
        if (!timestamp) return '';
        
        var created = new Date(timestamp);
        var now = new Date();
        var diffMs = now - created;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);
        
        if (diffDays > 0) return diffDays + 'd ago';
        if (diffHours > 0) return diffHours + 'h ago';
        if (diffMins > 0) return diffMins + 'm ago';
        return 'Just now';
    },

    // Show anomaly tooltip
    showAnomalyTooltip: function(event, anomalyId, metricIndex) {
        var tooltipData = document.getElementById('anomaly-tooltip-data-' + anomalyId);
        if (!tooltipData) return;
        
        var existingTooltip = document.getElementById('anomaly-rich-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        var tooltip = document.createElement('div');
        tooltip.id = 'anomaly-rich-tooltip';
        tooltip.className = 'anomaly-rich-tooltip visible';
        tooltip.innerHTML = tooltipData.innerHTML;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        var rect = event.target.getBoundingClientRect();
        var tooltipRect = tooltip.getBoundingClientRect();
        
        var left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        var top = rect.top - tooltipRect.height - 10;
        
        // Adjust if tooltip goes off screen
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            top = rect.bottom + 10; // Show below if no room above
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    },

    // Hide anomaly tooltip
    hideAnomalyTooltip: function() {
        var tooltip = document.getElementById('anomaly-rich-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
            setTimeout(function() {
                if (tooltip && tooltip.parentNode) {
                    tooltip.remove();
                }
            }, 200);
        }
    },
    
    resetTimeZoom: function() {
        console.log('[DASHBOARD] Resetting time zoom');
        this.data.zoom.active = false;
        this.data.zoom.startTime = null;
        this.data.zoom.endTime = null;
        this.data.filters.timeRange = this.data.zoom.originalTimeRange || '24h';
        this.loadData();
    },
    
    exportMetricData: function(index) {
        var metric = this.data.metrics[index];
        console.log('[DASHBOARD] Exporting metric:', metric.name);
        
        var csv = 'Timestamp,' + metric.hosts.join(',') + '\n';
        
        if (!metric.data || !Array.isArray(metric.data) || metric.data.length === 0) {
            alert('No data to export');
            return;
        }
        
        var maxLength = 0;
        for (var h = 0; h < metric.data.length; h++) {
            if (metric.data[h].values && metric.data[h].values.length > maxLength) {
                maxLength = metric.data[h].values.length;
            }
        }
        
        for (var i = 0; i < maxLength; i++) {
            var row = [];
            
            var timestamp = '';
            for (var h = 0; h < metric.data.length; h++) {
                if (metric.data[h].timestamps && metric.data[h].timestamps[i]) {
                    timestamp = metric.data[h].timestamps[i];
                    break;
                }
            }
            row.push(timestamp);
            
            for (var h = 0; h < metric.data.length; h++) {
                var value = '';
                if (metric.data[h].values && metric.data[h].values[i] !== undefined) {
                    value = metric.data[h].values[i];
                }
                row.push(value);
            }
            
            csv += row.join(',') + '\n';
        }
        
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = metric.name + '_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('[DASHBOARD] Export complete');
    },
    
    copyMetricData: function(index) {
        var metric = this.data.metrics[index];
        console.log('[DASHBOARD] Copying metric data:', metric.name);
        
        var text = 'Metric: ' + metric.name + '\n';
        text += 'CI Class: ' + metric.ciClass + '\n';
        text += 'Unit: ' + (metric.unit || 'N/A') + '\n';
        text += 'Hosts: ' + (metric.hosts ? metric.hosts.join(', ') : 'None') + '\n\n';
        
        if (metric.data && Array.isArray(metric.data)) {
            for (var h = 0; h < metric.data.length; h++) {
                var hostData = metric.data[h];
                text += 'Host: ' + metric.hosts[h] + '\n';
                
                if (hostData.values && Array.isArray(hostData.values)) {
                    var values = hostData.values.slice(-10);
                    text += 'Latest values: ' + values.join(', ') + '\n';
                }
                
                text += '\n';
            }
        }
        
        navigator.clipboard.writeText(text).then(function() {
            alert('Metric data copied to clipboard!');
        }).catch(function(err) {
            console.error('[DASHBOARD] Copy failed:', err);
            alert('Failed to copy to clipboard');
        });
    },

// 

// END OF PART 2
// Continue with Part 3 for chart drawing, interactions, and modals...
// 

// 

// PART 3 of 3: Chart Drawing, Interactions, Modals & Initialization
// 


    drawCharts: function() {
        for (var i = 0; i < this.data.metrics.length; i++) {
            this.drawChart(this.data.metrics[i], i);
        }
        console.log('[DASHBOARD] Charts drawn');
    },
    
    drawChart: function(metric, index) {
        var canvas = document.getElementById('chart-' + index);
        if (!canvas) {
            console.warn('[DASHBOARD] Canvas not found for index:', index);
            return;
        }
        
        var metricId = this.getMetricId(metric);
        var chartType = this.data.customChartTypes[metricId] || 'line';
        
        if (chartType === 'heatmap') {
            this.drawHeatmapChart(metric, index, canvas);
        } else {
            this.drawTimeSeriesChart(metric, index, canvas, chartType);
        }
    },
    
    // ⬅️ ENHANCED - Renders anomaly triangles directly on canvas
    drawTimeSeriesChart: function(metric, index, canvas, chartType) {
        var ctx = canvas.getContext('2d');
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        var width = canvas.width;
        var height = canvas.height;
        
        var metricId = this.getMetricId(metric);
        var size = this.data.customSizes[metricId] || '1x1';
        
        var padding, verticalLines, horizontalLines, yAxisLabels, xAxisLabels, fontSize;
        
        if (size === '2x2') {
            padding = { top: 20, right: 30, bottom: 30, left: 70 };
            verticalLines = 10;
            horizontalLines = 8;
            yAxisLabels = 8;
            xAxisLabels = 8;
            fontSize = '11px';
        } else if (size === '2x1') {
            padding = { top: 15, right: 25, bottom: 25, left: 65 };
            verticalLines = 10;
            horizontalLines = 5;
            yAxisLabels = 5;
            xAxisLabels = 8;
            fontSize = '10px';
        } else if (size === '1x2') {
            padding = { top: 20, right: 15, bottom: 30, left: 55 };
            verticalLines = 6;
            horizontalLines = 8;
            yAxisLabels = 8;
            xAxisLabels = 5;
            fontSize = '10px';
        } else {
            padding = { top: 15, right: 15, bottom: 25, left: 55 };
            verticalLines = 6;
            horizontalLines = 5;
            yAxisLabels = 4;
            xAxisLabels = 5;
            fontSize = '10px';
        }
        
        var chartWidth = width - padding.left - padding.right;
        var chartHeight = height - padding.top - padding.bottom;

        var currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
        var baseLineWeight;
        
        if (currentTheme === 'light') {
            baseLineWeight = 2.0;
        } else if (currentTheme === 'dark') {
            baseLineWeight = 1.5;
        } else {
            baseLineWeight = 1.5;
        }
        
        if (!metric.data || !Array.isArray(metric.data) || metric.data.length === 0) {
            ctx.fillStyle = '#7D8791';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', width / 2, height / 2);
            return;
        }
        
        var allTimestamps = [];
        var allValues = [];
        
        for (var h = 0; h < metric.data.length; h++) {
            var hostData = metric.data[h];
            if (!hostData.values || !Array.isArray(hostData.values)) continue;
            if (!hostData.timestamps || !Array.isArray(hostData.timestamps)) continue;
            
            for (var v = 0; v < hostData.values.length; v++) {
                allValues.push(hostData.values[v]);
                var tsMs = this.parseTimestampToMs(hostData.timestamps[v]);
                if (tsMs !== null) {
                    allTimestamps.push(tsMs);
                }
            }
        }
        
        if (allValues.length === 0) {
            ctx.fillStyle = '#7D8791';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data points', width / 2, height / 2);
            return;
        }
        
        var minValue = Math.min.apply(null, allValues);
        var maxValue = Math.max.apply(null, allValues);
        
        var isPercentage = metric.unit === 'percent' || metric.unit === 'percentage' || metric.unit === '%';
        if (isPercentage) {
            maxValue = Math.min(maxValue * 1.2, 100);
        } else {
            maxValue = maxValue * 1.2;
        }
        
        var valueRange = maxValue - minValue;
        
        if (valueRange === 0) {
            minValue = minValue - 1;
            maxValue = maxValue + 1;
            valueRange = 2;
        }
        
        var minTime = Math.min.apply(null, allTimestamps);
        var maxTime = Math.max.apply(null, allTimestamps);
        var timeRange = maxTime - minTime;
        
        if (timeRange === 0) {
            minTime = minTime - 3600000;
            maxTime = maxTime + 3600000;
            timeRange = 7200000;
        }
        
        var getY = function(value) {
            return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
        };
        
        var getX = function(timestamp) {
            var tsMs = Dashboard.parseTimestampToMs(timestamp);
            if (tsMs === null) return padding.left;
            return padding.left + ((tsMs - minTime) / timeRange) * chartWidth;
        };
        
        var computedStyle = getComputedStyle(document.documentElement);
        var gridColor = computedStyle.getPropertyValue('--chart-grid-color').trim();
        var gridHeavy = computedStyle.getPropertyValue('--chart-grid-heavy').trim();
        var borderColor = computedStyle.getPropertyValue('--chart-border-color').trim();
        var textColor = computedStyle.getPropertyValue('--chart-text-color').trim();
        
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (var v = 0; v <= verticalLines; v++) {
            var x = padding.left + (chartWidth / verticalLines) * v;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
        
        ctx.strokeStyle = gridHeavy;
        for (var g = 0; g < horizontalLines; g++) {
            var y = padding.top + (chartHeight / horizontalLines) * g;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
        
        ctx.strokeStyle = borderColor;
        ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);
        
        ctx.fillStyle = textColor;
        ctx.font = fontSize + ' sans-serif';
        ctx.textAlign = 'right';
        for (var g = 0; g <= yAxisLabels; g++) {
            var value = maxValue - (valueRange / yAxisLabels) * g;
            var y = padding.top + (chartHeight / yAxisLabels) * g;
            var label = this.formatYAxisValue(value, metric.unit);
            ctx.fillText(label, padding.left - 8, y + 4);
        }
        
        ctx.textAlign = 'center';
        for (var l = 0; l <= xAxisLabels; l++) {
            var timeMs = minTime + (timeRange / xAxisLabels) * l;
            var x = padding.left + (chartWidth / xAxisLabels) * l;
            var label = this.formatTimestamp(timeMs);
            ctx.fillText(label, x, height - 10);
        }
        
        var threshold = this.thresholds[metric.name];
        if (threshold) {
            var warningColor = computedStyle.getPropertyValue('--chart-threshold-warning').trim();
            var criticalColor = computedStyle.getPropertyValue('--chart-threshold-critical').trim();
            
            if (threshold.warning) {
                ctx.strokeStyle = warningColor;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                var y = getY(threshold.warning);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            if (threshold.critical) {
                ctx.strokeStyle = criticalColor;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                var y = getY(threshold.critical);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        var colorPalette = this.getColorPalette(metric.name);
        
        for (var h = 0; h < metric.data.length; h++) {
            var hostData = metric.data[h];
            if (!hostData.values || !Array.isArray(hostData.values)) continue;
            if (!hostData.timestamps || !Array.isArray(hostData.timestamps)) continue;
            
            var color = colorPalette[h % colorPalette.length];
            var colorWithOpacity = color;
            if (color.startsWith('#')) {
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);
                colorWithOpacity = 'rgba(' + r + ',' + g + ',' + b + ',0.85)';
            }
            
            if (chartType === 'area') {
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);
                
                var minY = padding.top + chartHeight;
                var maxY = padding.top + chartHeight;
                for (var p = 0; p < hostData.values.length; p++) {
                    var y = getY(hostData.values[p]);
                    if (y < maxY) maxY = y;
                }
                
                var currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
                var topOpacity, midOpacity, bottomOpacity;
                
                if (currentTheme === 'light') {
                    topOpacity = 0.35;
                    midOpacity = 0.15;
                    bottomOpacity = 0.0;
                } else if (currentTheme === 'dark') {
                    topOpacity = 0.55;
                    midOpacity = 0.25;
                    bottomOpacity = 0.05;
                } else {
                    topOpacity = 0.45;
                    midOpacity = 0.20;
                    bottomOpacity = 0.05;
                }
                
                var gradient = ctx.createLinearGradient(0, maxY, 0, minY);
                gradient.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + topOpacity + ')');
                gradient.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + midOpacity + ')');
                gradient.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',' + bottomOpacity + ')');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(getX(hostData.timestamps[0]), padding.top + chartHeight);
                for (var p = 0; p < hostData.values.length; p++) {
                    ctx.lineTo(getX(hostData.timestamps[p]), getY(hostData.values[p]));
                }
                ctx.lineTo(getX(hostData.timestamps[hostData.values.length - 1]), padding.top + chartHeight);
                ctx.closePath();
                ctx.fill();
                
                ctx.strokeStyle = colorWithOpacity;
                ctx.lineWidth = baseLineWeight;
                ctx.shadowColor = colorWithOpacity;
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
                ctx.beginPath();
                for (var p = 0; p < hostData.values.length; p++) {
                    if (p === 0) {
                        ctx.moveTo(getX(hostData.timestamps[p]), getY(hostData.values[p]));
                    } else {
                        ctx.lineTo(getX(hostData.timestamps[p]), getY(hostData.values[p]));
                    }
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                
            } else if (chartType === 'step') {
                ctx.strokeStyle = colorWithOpacity;
                ctx.lineWidth = baseLineWeight;
                ctx.beginPath();
                ctx.moveTo(getX(hostData.timestamps[0]), getY(hostData.values[0]));
                for (var p = 1; p < hostData.values.length; p++) {
                    var x1 = getX(hostData.timestamps[p - 1]);
                    var x2 = getX(hostData.timestamps[p]);
                    var y1 = getY(hostData.values[p - 1]);
                    var y2 = getY(hostData.values[p]);
                    
                    ctx.lineTo(x2, y1);
                    ctx.lineTo(x2, y2);
                }
                ctx.stroke();
                
                ctx.shadowColor = colorWithOpacity;
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                
            } else {
                ctx.strokeStyle = colorWithOpacity;
                ctx.lineWidth = baseLineWeight;
                ctx.beginPath();
                for (var p = 0; p < hostData.values.length; p++) {
                    var x = getX(hostData.timestamps[p]);
                    var y = getY(hostData.values[p]);
                    if (p === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                ctx.shadowColor = colorWithOpacity;
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
            }
        }
        
        
        var chartContainer = canvas.parentElement;
        
        chartContainer.addEventListener('mouseenter', function() {
            Dashboard.createTimeSelectionOverlay(canvas, index);
        });
        
        chartContainer.addEventListener('mousemove', function(e) {
            Dashboard.handleChartHover(e, canvas, metric, padding, minValue, maxValue, minTime, maxTime);
        });
        
        chartContainer.addEventListener('mouseleave', function() {
            Dashboard.hideTooltip();
            if (!Dashboard.selectionState.active) {
                Dashboard.removeTimeSelectionOverlay();
            }
        });
        
        chartContainer.addEventListener('mousedown', function(e) {
            Dashboard.startTimeSelection(e, canvas, metric, index, padding, minTime, maxTime);
        });
    },
    
    drawHeatmapChart: function(metric, index, canvas) {
        var ctx = canvas.getContext('2d');
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        var width = canvas.width;
        var height = canvas.height;
        
        ctx.fillStyle = '#7D8791';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Heatmap view coming soon...', width / 2, height / 2);
    },
    
    createTimeSelectionOverlay: function(canvas, metricIndex) {
        var existing = canvas.parentElement.querySelector('.time-selection-overlay');
        if (existing) return;
        
        var overlay = document.createElement('div');
        overlay.className = 'time-selection-overlay';
        overlay.id = 'time-overlay-' + metricIndex;
        canvas.parentElement.appendChild(overlay);
    },
    
    removeTimeSelectionOverlay: function() {
        var overlays = document.querySelectorAll('.time-selection-overlay');
        for (var i = 0; i < overlays.length; i++) {
            overlays[i].remove();
        }
    },
    
    // ⬅️ ENHANCED - Check anomaly markers first, then data points
    handleChartHover: function(e, canvas, metric, padding, minValue, maxValue, minTime, maxTime) {
        if (this.selectionState.active) {
            this.hideTooltip();
            return;
        }
        
        var rect = canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        
        var chartWidth = canvas.width - padding.left - padding.right;
        var chartHeight = canvas.height - padding.top - padding.bottom;
        
        if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
            mouseY < padding.top || mouseY > padding.top + chartHeight) {
            this.hideTooltip();
            return;
        }
        
        // ⬅️ NEW - Check anomaly markers FIRST (higher priority than data points)
        if (canvas.anomalyMarkers && this.data.showAnomalies) {
            for (var i = 0; i < canvas.anomalyMarkers.length; i++) {
                var marker = canvas.anomalyMarkers[i];
                var dx = mouseX - marker.x;
                var dy = mouseY - marker.y;
                var distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < marker.radius) {
                    var anomaly = marker.anomaly;
                    
                    var info = anomaly.parsed_info || this.parseAnomalyInfo(anomaly);
                    
                    var isPercent = (info.source_metric_type || '').toLowerCase().indexOf('percent') > -1 || 
                                    metric.unit === 'percent' || metric.unit === 'percentage' || metric.unit === '%';
                    
                    var formattedValue = isPercent 
                        ? parseFloat(info.metric_value || 0).toFixed(2)
                        : Math.round(parseFloat(info.metric_value || 0));
                    
                    var content = '<div style="line-height:1.6;">';
                    content += '<div style="color:' + marker.iconData.color + ';font-weight:700;margin-bottom:6px;">';
                    content += marker.iconData.icon + ' Anomaly Detected</div>';
                    content += '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:6px;">';
                    content += '<div><span style="color:#7D8791;">CI:</span> <span style="color:#fff;font-weight:500;">' + anomaly.ci_name + '</span></div>';
                    content += '<div><span style="color:#7D8791;">Metric:</span> <span style="color:#C2E6FF;">' + (info.source_metric_type || anomaly.metric_name) + '</span></div>';
                    content += '<div><span style="color:#7D8791;">Severity:</span> <span style="color:' + marker.iconData.color + ';">' + anomaly.severity_label + '</span></div>';
                    content += '<div style="margin-top:4px;"><span style="color:#7D8791;">Value:</span> <span style="color:#FFB81C;font-size:14px;font-weight:700;">' + formattedValue + '</span></div>';
                    content += '</div></div>';
                    
                    this.showTooltip(e.clientX, e.clientY, content);
                    return;
                }
            }
        }
        
        // Fall back to regular data point hover
        var timeRange = maxTime - minTime;
        var hoveredTime = minTime + ((mouseX - padding.left) / chartWidth) * timeRange;
        
        var closestPoint = null;
        var minDistance = Infinity;
        
        if (!metric.data || !Array.isArray(metric.data)) {
            this.hideTooltip();
            return;
        }
        
        for (var h = 0; h < metric.data.length; h++) {
            var hostData = metric.data[h];
            if (!hostData.values || !Array.isArray(hostData.values)) continue;
            if (!hostData.timestamps || !Array.isArray(hostData.timestamps)) continue;
            
            for (var p = 0; p < hostData.values.length; p++) {
                var pointTime = this.parseTimestampToMs(hostData.timestamps[p]);
                if (pointTime === null) continue;
                
                var distance = Math.abs(pointTime - hoveredTime);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = {
                        host: metric.hosts[h],
                        timestamp: pointTime,
                        value: hostData.values[p]
                    };
                }
            }
        }
        
        if (closestPoint && minDistance < (timeRange * 0.02)) {
            var formattedValue = this.formatYAxisValue(closestPoint.value, metric.unit);
            if (metric.unit === 'percent' || metric.unit === 'percentage' || metric.unit === '%') {
                formattedValue += '%';
            }
            
            var content = '<div style="line-height:1.6;">';
            content += '<div style="font-weight:600;color:#63DF4E;margin-bottom:4px;">' + closestPoint.host + '</div>';
            content += '<div style="border-top:1px solid rgba(99,223,78,0.3);padding-top:4px;">';
            content += '<div style="color:#52B8FF;font-size:14px;font-weight:600;">' + formattedValue + '</div>';
            content += '<div style="color:#7D8791;font-size:10px;margin-top:2px;">' + this.formatTimestamp(closestPoint.timestamp) + '</div>';
            content += '</div></div>';
            
            this.showTooltip(e.clientX, e.clientY, content);
        } else {
            this.hideTooltip();
        }
    },
    
    startTimeSelection: function(e, canvas, metric, metricIndex, padding, minTime, maxTime) {
        var rect = canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        
        var chartWidth = canvas.width - padding.left - padding.right;
        
        if (mouseX < padding.left || mouseX > padding.left + chartWidth) {
            return;
        }
        
        this.selectionState.active = true;
        this.selectionState.metricIndex = metricIndex;
        this.selectionState.startX = mouseX;
        this.selectionState.endX = mouseX;
        
        var timeRange = maxTime - minTime;
        this.selectionState.startTime = minTime + ((mouseX - padding.left) / chartWidth) * timeRange;
        this.selectionState.endTime = this.selectionState.startTime;
        
        var overlay = document.getElementById('time-overlay-' + metricIndex);
        if (overlay) {
            overlay.classList.add('active');
            this.selectionState.overlay = overlay;
        }
        
        var self = this;
        
        var onMouseMove = function(e) {
            self.updateTimeSelection(e, canvas, padding, minTime, maxTime, chartWidth);
        };
        
        var onMouseUp = function(e) {
            self.endTimeSelection(e, canvas, padding, minTime, maxTime, chartWidth);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault();
    },
    
    updateTimeSelection: function(e, canvas, padding, minTime, maxTime, chartWidth) {
        if (!this.selectionState.active) return;
        
        var rect = canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        
        mouseX = Math.max(padding.left, Math.min(mouseX, padding.left + chartWidth));
        
        this.selectionState.endX = mouseX;
        
        var timeRange = maxTime - minTime;
        this.selectionState.endTime = minTime + ((mouseX - padding.left) / chartWidth) * timeRange;
        
        var left = Math.min(this.selectionState.startX, this.selectionState.endX);
        var width = Math.abs(this.selectionState.endX - this.selectionState.startX);
        
        if (this.selectionState.overlay) {
            this.selectionState.overlay.style.left = left + 'px';
            this.selectionState.overlay.style.width = width + 'px';
        }
        
        var startTime = Math.min(this.selectionState.startTime, this.selectionState.endTime);
        var endTime = Math.max(this.selectionState.startTime, this.selectionState.endTime);
        
        var tooltip = document.getElementById('time-selection-tooltip');
        if (tooltip) {
            tooltip.classList.add('active');
            
            var startDate = new Date(startTime);
            var endDate = new Date(endTime);
            
            var formatTime = function(d) {
                var h = d.getHours().toString().padStart(2, '0');
                var m = d.getMinutes().toString().padStart(2, '0');
                return h + ':' + m;
            };
            
            document.getElementById('sel-tooltip-start').textContent = formatTime(startDate);
            document.getElementById('sel-tooltip-end').textContent = formatTime(endDate);
            
            var duration = endTime - startTime;
            var durationText = '';
            if (duration < 60000) {
                durationText = Math.round(duration / 1000) + 's';
            } else if (duration < 3600000) {
                durationText = Math.round(duration / 60000) + 'm';
            } else {
                durationText = (duration / 3600000).toFixed(1) + 'h';
            }
            document.getElementById('sel-tooltip-duration').textContent = 'Duration: ' + durationText;
            
            var centerX = left + width / 2;
            tooltip.style.left = (rect.left + centerX) + 'px';
            tooltip.style.top = (rect.top - 80) + 'px';
        }
    },
    
    endTimeSelection: function(e, canvas, padding, minTime, maxTime, chartWidth) {
        if (!this.selectionState.active) return;
        
        var startTime = Math.min(this.selectionState.startTime, this.selectionState.endTime);
        var endTime = Math.max(this.selectionState.startTime, this.selectionState.endTime);
        
        var minSelectionTime = 60000;
        
        if ((endTime - startTime) < minSelectionTime) {
            console.log('[DASHBOARD] Selection too small, ignoring');
            this.resetSelectionState();
            return;
        }
        
        console.log('[DASHBOARD] Time selection:', new Date(startTime), 'to', new Date(endTime));
        
        this.data.zoom.active = true;
        this.data.zoom.startTime = startTime;
        this.data.zoom.endTime = endTime;
        this.data.zoom.originalTimeRange = this.data.filters.timeRange;
        
        this.resetSelectionState();
        this.loadData();
    },
    
    resetSelectionState: function() {
        this.selectionState.active = false;
        this.selectionState.metricIndex = null;
        this.selectionState.startX = null;
        this.selectionState.endX = null;
        this.selectionState.startTime = null;
        this.selectionState.endTime = null;
        
        if (this.selectionState.overlay) {
            this.selectionState.overlay.classList.remove('active');
            this.selectionState.overlay = null;
        }
        
        var tooltip = document.getElementById('time-selection-tooltip');
        if (tooltip) {
            tooltip.classList.remove('active');
        }
    },
    
    attachDragListeners: function() {
        var cards = document.querySelectorAll('.metric-card');
        
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            
            card.setAttribute('draggable', 'false');
            
            var header = card.querySelector('.metric-header[data-drag-handle="true"]');
            if (header) {
                header.setAttribute('draggable', 'true');
                
                header.addEventListener('dragstart', function(e) {
                    var card = this.closest('.metric-card');
                    var index = parseInt(card.getAttribute('data-index'));
                    Dashboard.onDragStart(e, index);
                    card.classList.add('dragging');
                });
                
                header.addEventListener('dragend', function(e) {
                    var card = this.closest('.metric-card');
                    Dashboard.onDragEnd(e);
                    card.classList.remove('dragging');
                });
            }
            
            var handle = card.querySelector('.drag-handle');
            if (handle) {
                handle.setAttribute('draggable', 'true');
                
                handle.addEventListener('dragstart', function(e) {
                    var card = this.closest('.metric-card');
                    var index = parseInt(card.getAttribute('data-index'));
                    Dashboard.onDragStart(e, index);
                    card.classList.add('dragging');
                });
                
                handle.addEventListener('dragend', function(e) {
                    var card = this.closest('.metric-card');
                    Dashboard.onDragEnd(e);
                    card.classList.remove('dragging');
                });
            }
            
            card.addEventListener('dragover', function(e) {
                Dashboard.onDragOver(e, parseInt(this.getAttribute('data-index')));
            });
            
            card.addEventListener('dragleave', function(e) {
                Dashboard.onDragLeave(e);
            });
            
            card.addEventListener('drop', function(e) {
                Dashboard.onDrop(e, parseInt(this.getAttribute('data-index')));
            });
        }
    },
    
    onDragStart: function(e, index) {
        this.dragState.draggedIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', 'dragging');
        console.log('[DASHBOARD] Drag started:', index);
    },
    
    onDragEnd: function(e) {
        var cards = document.querySelectorAll('.metric-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.remove('drag-over');
            cards[i].classList.remove('dragging');
        }
        this.dragState.draggedIndex = null;
        this.dragState.dragOverIndex = null;
        console.log('[DASHBOARD] Drag ended');
    },
    
    onDragOver: function(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (this.dragState.draggedIndex !== null && this.dragState.draggedIndex !== index) {
            this.dragState.dragOverIndex = index;
            e.currentTarget.classList.add('drag-over');
        }
        
        return false;
    },
    
    onDragLeave: function(e) {
        e.currentTarget.classList.remove('drag-over');
    },
    
    onDrop: function(e, index) {
        e.preventDefault();
        e.stopPropagation();
        
        var draggedIndex = this.dragState.draggedIndex;
        
        if (draggedIndex !== null && draggedIndex !== index) {
            console.log('[DASHBOARD] Dropping', draggedIndex, 'onto', index);
            
            var draggedMetric = this.data.metrics[draggedIndex];
            this.data.metrics.splice(draggedIndex, 1);
            
            if (draggedIndex < index) {
                this.data.metrics.splice(index - 1, 0, draggedMetric);
            } else {
                this.data.metrics.splice(index, 0, draggedMetric);
            }
            
            this.data.customOrder = [];
            for (var i = 0; i < this.data.metrics.length; i++) {
                this.data.customOrder.push(this.getMetricId(this.data.metrics[i]));
            }
            this.saveCustomOrder();
            
            this.updateUI();
            
            document.getElementById('header-section').innerHTML = this.renderHeader();
            this.attachHeaderListeners();
        }
        
        e.currentTarget.classList.remove('drag-over');
        return false;
    },
    
    showDetail: function(index) {
        var metric = this.data.metrics[index];
        console.log('[DASHBOARD] Showing detail for:', metric.name);
        
        var modal = this.renderDetailModal(metric);
        document.body.insertAdjacentHTML('beforeend', modal);
        
        setTimeout(function() {
            Dashboard.drawDetailChart(metric);
        }, 100);
    },
    
    renderDetailModal: function(metric) {
        var alertLevel = this.getAlertLevel(metric);
        var alertClass = alertLevel ? ' alert-' + alertLevel : '';
        
        var stats = this.calculateMetricStats(metric);
        
        var parts = [];
        parts.push('<div class="detail-modal-overlay" onclick="Dashboard.closeDetail(event)">');
        parts.push('<div class="detail-modal-content' + alertClass + '" onclick="event.stopPropagation()">');
        
        parts.push('<div class="detail-modal-header">');
        parts.push('<div>');
        parts.push('<div class="detail-modal-title">' + metric.name + '</div>');
        
        var ciDisplay = this.getCIClassDisplay(metric.ciClass);
        var timeLabel = this.data.zoom.active ? 'Custom Range' : 'Last ' + this.data.filters.timeRange;
        parts.push('<div class="detail-modal-subtitle">' + ciDisplay.name + ' • ' + timeLabel + '</div>');
        parts.push('</div>');
        parts.push('<button class="detail-modal-close" onclick="Dashboard.closeDetail()">✕ Close</button>');
        parts.push('</div>');
        
        parts.push('<div class="detail-modal-body">');
        
        parts.push('<div class="detail-chart-container">');
        parts.push('<canvas id="detail-chart" class="detail-chart-canvas"></canvas>');
        parts.push('</div>');
        
        parts.push('<div class="detail-sidebar">');
        
        parts.push('<div class="detail-section">');
        parts.push('<div class="detail-section-title">Current Value</div>');
        var formattedValue = this.formatYAxisValue(stats.currentValue, metric.unit);
        if (metric.unit === '%' || metric.unit === 'percent') formattedValue += '%';
        parts.push('<div style="font-size:32px;font-weight:600;color:#FFFFFF;margin:8px 0;">' + formattedValue + '</div>');
        
        var trendClass = stats.trendDirection;
        var trendArrow = stats.trendDirection === 'up' ? '↗' : (stats.trendDirection === 'down' ? '↘' : '→');
        var trendSign = stats.trend >= 0 ? '+' : '';
        var trendColor = trendClass === 'up' ? '#ec596b' : (trendClass === 'down' ? '#63DF4E' : '#7D8791');
        parts.push('<div style="color:' + trendColor + ';font-size:14px;font-weight:600;">' + trendArrow + ' ' + trendSign + stats.trend.toFixed(1) + '% vs 1h ago</div>');
        parts.push('</div>');
        
        parts.push('<div class="detail-section">');
        parts.push('<div class="detail-section-title">Statistics</div>');
        
        if (metric.data && Array.isArray(metric.data)) {
            var allValues = [];
            for (var h = 0; h < metric.data.length; h++) {
                if (metric.data[h].values && Array.isArray(metric.data[h].values)) {
                    allValues = allValues.concat(metric.data[h].values);
                }
            }
            
            if (allValues.length > 0) {
                var min = Math.min.apply(null, allValues);
                var max = Math.max.apply(null, allValues);
                var avg = allValues.reduce(function(a, b) { return a + b; }, 0) / allValues.length;
                
                parts.push('<div class="stat-item">');
                parts.push('<span class="stat-label">Min</span>');
                parts.push('<span class="stat-value min">' + this.formatYAxisValue(min, metric.unit) + '</span>');
                parts.push('</div>');
                
                parts.push('<div class="stat-item">');
                parts.push('<span class="stat-label">Max</span>');
                parts.push('<span class="stat-value max">' + this.formatYAxisValue(max, metric.unit) + '</span>');
                parts.push('</div>');
                
                parts.push('<div class="stat-item">');
                parts.push('<span class="stat-label">Avg</span>');
                parts.push('<span class="stat-value avg">' + this.formatYAxisValue(avg, metric.unit) + '</span>');
                parts.push('</div>');
            }
        }
        parts.push('</div>');
        
        if (metric.hosts && metric.hosts.length > 0) {
            parts.push('<div class="detail-section">');
            
            var colorPalette = this.getColorPalette(metric.name);
            var hostCount = metric.hosts.length;
            var useCompactMode = hostCount > 4;
            
            var ciDisplay = this.getCIClassDisplay(metric.ciClass);
            parts.push('<div style="display: inline-flex; align-items: center; padding: 4px 12px; background: var(--accent-indigo); border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 8px;">');
            parts.push(ciDisplay.name);
            parts.push('</div>');
            
            if (useCompactMode) {
                parts.push('<div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0;">');
                
                for (var h = 0; h < metric.hosts.length; h++) {
                    var hostColor = colorPalette[h % colorPalette.length];
                    var value = 'N/A';
                    
                    if (metric.data && metric.data[h] && metric.data[h].values && metric.data[h].values.length > 0) {
                        var latestValue = metric.data[h].values[metric.data[h].values.length - 1];
                        value = this.formatYAxisValue(latestValue, metric.unit);
                        if (metric.unit === '%' || metric.unit === 'percent') value += '%';
                    }
                    
                    parts.push('<div style="display: flex; align-items: center; gap: 4px;" title="' + metric.hosts[h] + '">');
                    parts.push('<div style="width: 10px; height: 10px; border-radius: 50%; background: ' + hostColor + '; flex-shrink: 0;"></div>');
                    parts.push('<span style="font-size: 12px; color: var(--text-secondary);">' + value + '</span>');
                    parts.push('</div>');
                }
                
                parts.push('</div>');
                
            } else {
                parts.push('<div class="detail-section-title">Current Values by Host</div>');
                
                for (var h = 0; h < metric.hosts.length; h++) {
                    var hostColor = colorPalette[h % colorPalette.length];
                    
                    parts.push('<div class="host-value-item">');
                    parts.push('<div class="host-value-name">');
                    parts.push('<div class="host-dot" style="background:' + hostColor + ';"></div>');
                    parts.push('<span>' + metric.hosts[h] + '</span>');
                    parts.push('</div>');
                    
                    if (metric.data && metric.data[h] && metric.data[h].values && metric.data[h].values.length > 0) {
                        var latestValue = metric.data[h].values[metric.data[h].values.length - 1];
                        var formatted = this.formatYAxisValue(latestValue, metric.unit);
                        if (metric.unit === '%' || metric.unit === 'percent') formatted += '%';
                        parts.push('<div class="host-value-number">' + formatted + '</div>');
                    } else {
                        parts.push('<div class="host-value-number">N/A</div>');
                    }
                    
                    parts.push('</div>');
                }
            }
            
            parts.push('<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-color);">');
            parts.push('<span style="color: var(--text-muted); font-size: 12px;">Anomalies:</span>');
            
            parts.push('<div style="display: flex; gap: 8px;">');
            parts.push('<button style="background: none; border: none; cursor: pointer; padding: 4px; opacity: 0.7; font-size: 16px; transition: opacity 0.2s;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'" title="Set Thresholds">🎯</button>');
            parts.push('<button style="background: none; border: none; cursor: pointer; padding: 4px; opacity: 0.7; font-size: 16px; transition: opacity 0.2s;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'" title="Metric Settings">⚙️</button>');
            parts.push('</div>');
            
            parts.push('</div>');
            
            parts.push('</div>');
        }
        
        parts.push('<div class="detail-section">');
        parts.push('<div class="detail-section-title">Actions</div>');
        parts.push('<button class="detail-action-btn primary" onclick="Dashboard.exportMetricData(' + this.data.metrics.indexOf(metric) + ')">📥 Export CSV</button>');
        parts.push('<button class="detail-action-btn secondary" onclick="Dashboard.copyMetricData(' + this.data.metrics.indexOf(metric) + ')">📋 Copy Data</button>');
        parts.push('</div>');
        
        parts.push('</div>');
        
        parts.push('</div>');
        parts.push('</div></div>');
        
        return parts.join('');
    },
    
    drawDetailChart: function(metric) {
        var canvas = document.getElementById('detail-chart');
        if (!canvas) return;
        
        var ctx = canvas.getContext('2d');
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        var width = canvas.width;
        var height = canvas.height;
        var padding = { top: 30, right: 30, bottom: 50, left: 70 };
        var chartWidth = width - padding.left - padding.right;
        var chartHeight = height - padding.top - padding.bottom;

        var currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
        var baseLineWeight;
        
        if (currentTheme === 'light') {
            baseLineWeight = 2.0;
        } else if (currentTheme === 'dark') {
            baseLineWeight = 1.5;
        } else {
            baseLineWeight = 1.5;
        }
        
        if (!metric.data || !Array.isArray(metric.data) || metric.data.length === 0) {
            ctx.fillStyle = '#7D8791';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', width / 2, height / 2);
            return;
        }
        
        var allTimestamps = [];
        var allValues = [];
        
        for (var h = 0; h < metric.data.length; h++) {
            var hostData = metric.data[h];
            if (!hostData.values || !Array.isArray(hostData.values)) continue;
            if (!hostData.timestamps || !Array.isArray(hostData.timestamps)) continue;
            
            for (var v = 0; v < hostData.values.length; v++) {
                allValues.push(hostData.values[v]);
                var tsMs = this.parseTimestampToMs(hostData.timestamps[v]);
                if (tsMs !== null) {
                    allTimestamps.push(tsMs);
                }
            }
        }
        
        if (allValues.length === 0) {
            ctx.fillStyle = '#7D8791';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data points', width / 2, height / 2);
            return;
        }
        
        var minValue = Math.min.apply(null, allValues);
        var maxValue = Math.max.apply(null, allValues);
        
        var isPercentage = metric.unit === 'percent' || metric.unit === 'percentage' || metric.unit === '%';
        if (isPercentage) {
            maxValue = Math.min(maxValue * 1.2, 100);
        } else {
            maxValue = maxValue * 1.2;
        }
        
        var valueRange = maxValue - minValue;
        
        if (valueRange === 0) {
            minValue = minValue - 1;
            maxValue = maxValue + 1;
            valueRange = 2;
        }
        
        var minTime = Math.min.apply(null, allTimestamps);
        var maxTime = Math.max.apply(null, allTimestamps);
        var timeRange = maxTime - minTime;
        
        if (timeRange === 0) {
            minTime = minTime - 3600000;
            maxTime = maxTime + 3600000;
            timeRange = 7200000;
        }
        
        var getY = function(value) {
            return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
        };
        
        var getX = function(timestamp) {
            var tsMs = Dashboard.parseTimestampToMs(timestamp);
            if (tsMs === null) return padding.left;
            return padding.left + ((tsMs - minTime) / timeRange) * chartWidth;
        };
        
        var computedStyle = getComputedStyle(document.documentElement);
        var gridColor = computedStyle.getPropertyValue('--chart-grid-color').trim();
        var gridHeavy = computedStyle.getPropertyValue('--chart-grid-heavy').trim();
        var borderColor = computedStyle.getPropertyValue('--chart-border-color').trim();
        var textColor = computedStyle.getPropertyValue('--chart-text-color').trim();
        
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        var verticalLines = 10;
        for (var v = 0; v <= verticalLines; v++) {
            var x = padding.left + (chartWidth / verticalLines) * v;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
        
        ctx.strokeStyle = gridHeavy;
        for (var g = 0; g < 8; g++) {
            var y = padding.top + (chartHeight / 7) * g;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
        
        ctx.strokeStyle = borderColor;
        ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);
        
        ctx.fillStyle = textColor;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        for (var g = 0; g <= 7; g++) {
            var value = maxValue - (valueRange / 7) * g;
            var y = padding.top + (chartHeight / 7) * g;
            var label = this.formatYAxisValue(value, metric.unit);
            ctx.fillText(label, padding.left - 12, y + 4);
        }
        
        ctx.textAlign = 'center';
        var labelCount = 10;
        for (var l = 0; l <= labelCount; l++) {
            var timeMs = minTime + (timeRange / labelCount) * l;
            var x = padding.left + (chartWidth / labelCount) * l;
            var label = this.formatTimestamp(timeMs);
            ctx.fillText(label, x, height - 25);
        }
        
        var threshold = this.thresholds[metric.name];
        if (threshold) {
            var warningColor = computedStyle.getPropertyValue('--chart-threshold-warning').trim();
            var criticalColor = computedStyle.getPropertyValue('--chart-threshold-critical').trim();
            
            if (threshold.warning) {
                ctx.strokeStyle = warningColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                var y = getY(threshold.warning);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            if (threshold.critical) {
                ctx.strokeStyle = criticalColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                var y = getY(threshold.critical);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        var colorPalette = this.getColorPalette(metric.name);
        
        for (var h = 0; h < metric.data.length; h++) {
            var hostData = metric.data[h];
            if (!hostData.values || !Array.isArray(hostData.values)) continue;
            if (!hostData.timestamps || !Array.isArray(hostData.timestamps)) continue;
            
            var color = colorPalette[h % colorPalette.length];
            
            var colorWithOpacity = color;
            if (color.startsWith('#')) {
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);
                colorWithOpacity = 'rgba(' + r + ',' + g + ',' + b + ',0.85)';
            }
            
            ctx.strokeStyle = colorWithOpacity;
            ctx.lineWidth = baseLineWeight;
            ctx.beginPath();
            
            var firstPoint = true;
            for (var p = 0; p < hostData.values.length; p++) {
                var x = getX(hostData.timestamps[p]);
                var y = getY(hostData.values[p]);
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            ctx.shadowColor = colorWithOpacity;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    },
    
    closeDetail: function(event) {
        if (event && event.target.className !== 'detail-modal-overlay') return;
        
        var modal = document.querySelector('.detail-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
};

// 

// INITIALIZATION
// 


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        Dashboard.init();
    });
} else {
    Dashboard.init();
}

// 

// END OF PART 3 - COMPLETE CLIENT SCRIPT
// 
