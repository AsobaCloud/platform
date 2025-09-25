        // Authentication check
        function checkAuth() {
            const isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
            if (!isAuthenticated) {
                window.location.href = 'index.html';
                return false;
            }
            return true;
        }

        // Check authentication on page load
        if (!checkAuth()) {
            // Redirect will happen in checkAuth function
        }

        // Global functions
        function logout() {
            sessionStorage.removeItem('authenticated');
            window.location.href = 'index.html';
        }
        
        function closeJobModal() {
            document.getElementById('jobModal').style.display = 'none';
            document.getElementById('jobForm').reset();
        }
        
        function loadInventoryCards() {
            // This function would refresh the inventory display
            // For now, it's a placeholder since we're using static HTML
            console.log('Inventory cards refreshed');
        }
        
        // Site inventory management functions
        function viewSiteInventoryDetails(siteId) {
            const site = siteAssets.find(s => s.id === siteId);
            if (!site) return;
            
            // Get current performance data
            const cachedData = getCachedSiteData(siteId);
            
            // Populate the modal with site data
            document.getElementById('detailSiteName').textContent = site.name;
            document.getElementById('detailSiteType').textContent = site.type;
            document.getElementById('detailLocation').textContent = site.location;
            document.getElementById('detailCapacity').textContent = site.capacity + ' kW';
            document.getElementById('detailInverterCount').textContent = site.inverterCount;
            document.getElementById('detailPanelCount').textContent = site.panelCount.toLocaleString();
            document.getElementById('detailPanelWattage').textContent = site.panelWattage + 'W';
            document.getElementById('detailInverterBrand').textContent = site.inverterBrand;
            document.getElementById('detailStatus').textContent = site.status.charAt(0).toUpperCase() + site.status.slice(1);
            document.getElementById('detailCommissionDate').textContent = new Date(site.commissionDate).toLocaleDateString();
            document.getElementById('detailNextMaintenance').textContent = 'Dec 15, 2024'; // Static for now
            document.getElementById('detailGridConnection').textContent = site.gridConnection;
            document.getElementById('detailNotes').textContent = site.notes || 'No additional notes';
            
            // Add current performance metrics
            if (cachedData) {
                document.getElementById('detailUtilization').textContent = cachedData.utilization + '%';
                document.getElementById('detailTemperature').textContent = cachedData.temperature + '°C';
                document.getElementById('detailPower').textContent = cachedData.power + ' kW';
                document.getElementById('detailEfficiency').textContent = cachedData.efficiency + '%';
            } else {
                document.getElementById('detailUtilization').textContent = '0%';
                document.getElementById('detailTemperature').textContent = '25°C';
                document.getElementById('detailPower').textContent = '0 kW';
                document.getElementById('detailEfficiency').textContent = '0%';
            }
            
            // Show the modal
            document.getElementById('siteDetailsModal').style.display = 'flex';
        }
        
        function scheduleSiteMaintenance(siteId) {
            const site = siteAssets.find(s => s.id === siteId);
            if (!site) return;
            
            // Set the site name in the form
            document.getElementById('maintenanceSiteName').value = site.name;
            
            // Set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('siteMaintenanceDate').value = tomorrow.toISOString().split('T')[0];
            
            // Reset form
            document.getElementById('siteMaintenanceType').value = '';
            document.getElementById('siteMaintenancePriority').value = '';
            document.getElementById('siteMaintenanceDuration').value = '';
            document.getElementById('siteMaintenanceTechnician').value = '';
            document.getElementById('siteMaintenanceDescription').value = '';
            
            // Show the modal
            document.getElementById('siteMaintenanceModal').style.display = 'flex';
        }
        
        function viewSiteComponents(siteId) {
            const site = siteAssets.find(s => s.id === siteId);
            if (!site) return;
            
            // Set the site name in the modal
            document.getElementById('componentsSiteName').textContent = site.name;
            
            // Populate component data
            populateSiteComponents(siteId);
            
            // Show the modal
            document.getElementById('siteComponentsModal').style.display = 'flex';
        }
        
        function populateSiteComponents(siteId) {
            // Sample component data for each site
            const componentData = {
                'cummins-midrand': {
                    inverters: [
                        { sku: 'SMA-SUNNY-BOY-5.0', model: 'SMA Sunny Boy 5.0', qty: 9, installDate: '2023-01-15', warranty: '2028-01-15', documents: ['Installation Manual', 'Warranty Certificate'] },
                        { sku: 'SMA-OPTIMIZER-700', model: 'SMA Power Optimizer', qty: 18, installDate: '2023-01-15', warranty: '2028-01-15', documents: ['Technical Specs'] }
                    ],
                    meters: [
                        { sku: 'SCHNEIDER-PM8000', model: 'Schneider PM8000 Power Meter', qty: 2, installDate: '2023-01-15', warranty: '2026-01-15', documents: ['Calibration Certificate', 'Installation Guide'] }
                    ],
                    monitoring: [
                        { sku: 'SOLAREDGE-MONITOR', model: 'SolarEdge Monitoring Gateway', qty: 1, installDate: '2023-01-15', warranty: '2025-01-15', documents: ['Network Configuration', 'User Manual'] }
                    ],
                    safety: [
                        { sku: 'ABB-RCCB-40A', model: 'ABB Residual Current Circuit Breaker', qty: 3, installDate: '2023-01-15', warranty: '2026-01-15', documents: ['Safety Certificate'] }
                    ]
                },
                'fnb-willowbridge': {
                    inverters: [
                        { sku: 'FRONIUS-PRIMO-5.0', model: 'Fronius Primo 5.0', qty: 2, installDate: '2023-03-20', warranty: '2028-03-20', documents: ['Installation Manual', 'Warranty Certificate'] }
                    ],
                    meters: [
                        { sku: 'SCHNEIDER-PM8000', model: 'Schneider PM8000 Power Meter', qty: 1, installDate: '2023-03-20', warranty: '2026-03-20', documents: ['Calibration Certificate'] }
                    ],
                    monitoring: [
                        { sku: 'FRONIUS-DATAMANAGER', model: 'Fronius Data Manager', qty: 1, installDate: '2023-03-20', warranty: '2025-03-20', documents: ['Configuration Guide'] }
                    ],
                    safety: [
                        { sku: 'ABB-RCCB-40A', model: 'ABB Residual Current Circuit Breaker', qty: 1, installDate: '2023-03-20', warranty: '2026-03-20', documents: ['Safety Certificate'] }
                    ]
                }
            };
            
            const components = componentData[siteId] || {};
            
            // Populate each component section
            populateComponentSection('inverters', components.inverters || []);
            populateComponentSection('meters', components.meters || []);
            populateComponentSection('monitoring', components.monitoring || []);
            populateComponentSection('safety', components.safety || []);
        }
        
        function populateComponentSection(sectionType, components) {
            const container = document.getElementById(`components-${sectionType}`);
            if (!container) return;
            
            // Clear existing content
            container.innerHTML = '';
            
            if (components.length === 0) {
                container.innerHTML = `<p class="no-components">No components found. <button class="add-component-btn" onclick="showAddComponentForm('${sectionType}')">Add Component</button></p>`;
                return;
            }
            
            components.forEach((component, index) => {
                const componentDiv = document.createElement('div');
                componentDiv.className = 'component-item';
                componentDiv.innerHTML = `
                    <div class="component-header">
                        <div class="component-info">
                            <h5>${component.model}</h5>
                            <span class="component-sku">SKU: ${component.sku}</span>
                        </div>
                        <div class="component-actions">
                            <button class="component-action-btn" onclick="editComponent('${sectionType}', ' + index + ')">Edit</button>
                            <button class="component-action-btn delete" onclick="deleteComponent('${sectionType}', ' + index + ')">Delete</button>
                        </div>
                    </div>
                    <div class="component-details">
                        <div class="component-detail">
                            <span class="detail-label">Quantity:</span>
                            <span class="detail-value">${component.qty}</span>
                        </div>
                        <div class="component-detail">
                            <span class="detail-label">Install Date:</span>
                            <span class="detail-value">${component.installDate}</span>
                        </div>
                        <div class="component-detail">
                            <span class="detail-label">Warranty Until:</span>
                            <span class="detail-value">${component.warranty}</span>
                        </div>
                        <div class="component-detail">
                            <span class="detail-label">Documents:</span>
                            <span class="detail-value">${component.documents.join(', ')}</span>
                        </div>
                    </div>
                `;
                container.appendChild(componentDiv);
            });
            
            // Add "Add Component" button
            const addButton = document.createElement('div');
            addButton.className = 'add-component-section';
            addButton.innerHTML = `<button class="add-component-btn" onclick="showAddComponentForm('${sectionType}')">+ Add ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} Component</button>`;
            container.appendChild(addButton);
        }
        
        // Site modal functions (consolidated - see Add GPU modal functions section for enhanced openAddSiteModal)
        function closeSiteDetailsModal() {
            document.getElementById('siteDetailsModal').style.display = 'none';
        }
        
        function closeSiteMaintenanceModal() {
            document.getElementById('siteMaintenanceModal').style.display = 'none';
            document.getElementById('siteMaintenanceForm').reset();
        }
        
        function editSiteDetails() {
            alert('Edit functionality coming soon! This will allow you to modify site details.');
        }
        
        // Dashboard modal functions
        function closeDashboardSiteDetailsModal() {
            document.getElementById('dashboardSiteDetailsModal').style.display = 'none';
        }
        
        function closeDashboardSiteManagementModal() {
            document.getElementById('dashboardSiteManagementModal').style.display = 'none';
            document.getElementById('dashboardManagementForm').reset();
        }
        
        function closeSiteComponentsModal() {
            document.getElementById('siteComponentsModal').style.display = 'none';
        }
        
        function showAddComponentForm(sectionType) {
            // Hide all other forms first
            document.querySelectorAll('.add-component-form').forEach(form => {
                form.style.display = 'none';
            });
            
            // Show the specific form
            const targetForm = document.getElementById(`add-${sectionType}-form`);
            if (targetForm) {
                targetForm.style.display = 'block';
            } else {
                console.error('Form not found for section:', sectionType);
                alert('Form not found. Please refresh the page.');
            }
        }
        
        function cancelAddComponent(sectionType) {
            // Hide the form
            const formElement = document.getElementById(`add-${sectionType}-form`);
            if (formElement) {
                formElement.style.display = 'none';
            }
            
            // Clear form fields with null checks
            const skuElement = document.getElementById(`${sectionType}-sku`);
            const modelElement = document.getElementById(`${sectionType}-model`);
            const qtyElement = document.getElementById(`${sectionType}-qty`);
            const installDateElement = document.getElementById(`${sectionType}-install-date`);
            const warrantyDateElement = document.getElementById(`${sectionType}-warranty-date`);
            const documentsElement = document.getElementById(`${sectionType}-documents`);
            
            if (skuElement) skuElement.value = '';
            if (modelElement) modelElement.value = '';
            if (qtyElement) qtyElement.value = '1';
            if (installDateElement) installDateElement.value = '';
            if (warrantyDateElement) warrantyDateElement.value = '';
            if (documentsElement) documentsElement.value = '';
        }
        
        function saveComponent(sectionType) {
            const skuElement = document.getElementById(`${sectionType}-sku`);
            const modelElement = document.getElementById(`${sectionType}-model`);
            const qtyElement = document.getElementById(`${sectionType}-qty`);
            const installDateElement = document.getElementById(`${sectionType}-install-date`);
            const warrantyDateElement = document.getElementById(`${sectionType}-warranty-date`);
            const fileInput = document.getElementById(`${sectionType}-documents`);
            
            // Check if elements exist
            if (!skuElement || !modelElement || !qtyElement || !installDateElement || !warrantyDateElement || !fileInput) {
                console.error('Required form elements not found for section:', sectionType);
                alert('Form elements not found. Please refresh the page.');
                return;
            }
            
            const sku = skuElement.value.trim();
            const model = modelElement.value.trim();
            const qty = parseInt(qtyElement.value) || 1;
            const installDate = installDateElement.value;
            const warrantyDate = warrantyDateElement.value;
            
            // Validate required fields
            if (!sku || !model) {
                alert('Please fill in SKU and Model fields.');
                return;
            }
            
            // Handle file uploads
            let documents = [];
            if (fileInput.files.length > 0) {
                documents = Array.from(fileInput.files).map(file => file.name);
            }
            
            const newComponent = {
                model: model,
                sku: sku,
                qty: qty,
                installDate: installDate || new Date().toISOString().split('T')[0],
                warranty: warrantyDate || new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 years from now
                documents: documents
            };
            
            // Add to component data (in real app, this would save to database)
            console.log(`Added new ${sectionType} component:`, newComponent);
            
            // Refresh the component section
            const currentSiteId = document.getElementById('componentsSiteName').textContent.toLowerCase().replace(' ', '-');
            populateSiteComponents(currentSiteId);
            
            // Hide form and show buttons
            cancelAddComponent(sectionType);
            
            alert(`Component added successfully!\n\nModel: ${newComponent.model}\nSKU: ${newComponent.sku}\nQuantity: ${newComponent.qty}\nDocuments: ${documents.length} file(s) uploaded`);
        }
        
        function editComponent(sectionType, index) {
            alert(`Edit component functionality coming soon!\n\nSection: ${sectionType}\nIndex: ${index}\n\nThis will allow you to modify component details, upload documents, and update specifications.`);
        }
        
        function deleteComponent(sectionType, index) {
            if (confirm(`Are you sure you want to delete this ${sectionType} component?`)) {
                // In real app, this would remove from database
                console.log(`Deleted ${sectionType} component at index ${index}`);
                
                // Refresh the component section
                const currentSiteId = document.getElementById('componentsSiteName').textContent.toLowerCase().replace(' ', '-');
                populateSiteComponents(currentSiteId);
                
                alert('Component deleted successfully!');
            }
        }
        
        function exportComponentsList() {
            const siteName = document.getElementById('componentsSiteName').textContent;
            const componentsData = {
                site: siteName,
                exportDate: new Date().toISOString(),
                components: {
                    inverters: document.getElementById('components-inverters').innerHTML,
                    meters: document.getElementById('components-meters').innerHTML,
                    monitoring: document.getElementById('components-monitoring').innerHTML,
                    safety: document.getElementById('components-safety').innerHTML
                }
            };
            
            // In real app, this would generate a proper export file
            console.log('Components export data:', componentsData);
            
            alert(`Components list exported successfully!\n\nSite: ${siteName}\nExport Date: ${new Date().toLocaleDateString()}\n\nIn a real application, this would generate a CSV or PDF file with all component details and documents.`);
        }
        
        function testSiteConnection() {
            const siteName = document.getElementById('siteName').value;
            const siteLocation = document.getElementById('siteLocation').value;
            const gridConnection = document.getElementById('gridConnection').value;
            
            if (!siteName || !siteLocation || !gridConnection) {
                alert('Please fill in Site Name, Address, and Grid Connection before testing.');
                return;
            }
            
            // Simulate connection test
            const testBtn = document.getElementById('testSiteConnectionBtn');
            const originalText = testBtn.textContent;
            testBtn.textContent = '⏳ Testing...';
            testBtn.disabled = true;
            
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
                
                if (Math.random() > 0.2) { // 80% success rate
                    alert(`Connection test successful!\n\nSite: ${siteName}\nLocation: ${siteLocation}\nGrid Connection: ${gridConnection}\n\nYou can now add this site to inventory.`);
                } else {
                    alert(`Connection test failed!\n\nPlease check:\n- Site details are correct\n- Network connectivity\n- Grid connection status\n\nTry again after fixing the connection issues.`);
                }
            }, 2000);
        }
        
        // Site data management functions
        function getSiteData(siteId) {
            const sites = {
                'cummins-midrand': {
                    name: 'Cummins Midrand',
                    utilization: 0,      // 0% (no sun currently)
                    temperature: 25,     // 25°C ambient
                    power: 0,           // 0 kW (no production)
                    efficiency: 0,      // 0% efficiency (nighttime)
                    capacity: 821.88    // Total capacity in kW
                },
                'fnb-willowbridge': {
                    name: 'FNB Willowbridge',
                    utilization: 0,      // 0% (no sun currently)
                    temperature: 24,     // 24°C ambient
                    power: 0,           // 0 kW (no production)
                    efficiency: 0,      // 0% efficiency (nighttime)
                    capacity: 51.98     // Total capacity in kW
                }
            };
            return sites[siteId];
        }
        
        // Simulate dynamic site data (optional - adds realistic variation)
        function getRealtimeSiteData(siteId) {
            const baseData = getSiteData(siteId);
            const currentHour = new Date().getHours();
            
            // Calculate solar factor based on time of day
            let solarFactor = 0;
            if (currentHour >= 6 && currentHour <= 18) {
                if (currentHour >= 11 && currentHour <= 15) {
                    solarFactor = 0.8 + (Math.random() * 0.2); // 80-100%
                } else if (currentHour >= 8 && currentHour <= 17) {
                    solarFactor = 0.4 + (Math.random() * 0.4); // 40-80%
                } else {
                    solarFactor = 0.1 + (Math.random() * 0.3); // 10-40%
                }
            }
            
            return {
                utilization: Math.round(solarFactor * 100),
                power: Math.round(baseData.capacity * solarFactor * 100) / 100,
                efficiency: Math.round(solarFactor * 100),
                temperature: baseData.temperature + Math.round(solarFactor * 15) // Panels heat up in sun
            };
        }
        
        // PERSISTENT CACHE - Generate once, never regenerate
        let cachedSiteData = null;
        
        function getCachedSiteData(siteId) {
            // Generate data ONLY if cache is completely empty
            if (!cachedSiteData) {
                generateAndCacheSiteData();
            }
            
            // Always return cached data - NEVER regenerate
            return cachedSiteData[siteId];
        }
        
        function generateAndCacheSiteData() {
            // Use realistic, fixed data for solar sites
            cachedSiteData = {
                'cummins-midrand': {
                    name: 'Cummins Midrand',
                    utilization: 78,        // 78% utilization
                    power: 641.1,          // 641.1 kWh power production (78% of 821.88 kW)
                    consumption: 192.3,   // 192.3 kWh power consumption (30% of production)
                    efficiency: 82,        // 82% efficiency
                    temperature: 52,       // 52°C inverter temperature (higher due to larger system)
                    capacity: 821.88       // 821.88 kW capacity
                },
                'fnb-willowbridge': {
                    name: 'FNB Willowbridge',
                    utilization: 65,        // 65% utilization
                    power: 33.8,           // 33.8 kWh power production (65% of 51.98 kW)
                    consumption: 13.5,     // 13.5 kWh power consumption (40% of production)
                    efficiency: 68,        // 68% efficiency
                    temperature: 48,       // 48°C inverter temperature (smaller system)
                    capacity: 51.98        // 51.98 kW capacity
                },
                lastUpdate: Date.now()
            };
            
            cachedSiteData.lastUpdate = Date.now();
        }
        
        // Note: Solar factor functions removed - using fixed realistic data instead

        // Sample site data for solar sites
        const siteAssets = [
            {
                id: 'cummins-midrand',
                name: 'Cummins Midrand',
                type: 'Commercial Solar',
                location: 'Corners Bridal Veil Road',
                capacity: 821.88,
                inverterCount: 9,
                commissionDate: '2023-01-15',
                panelCount: 2054,
                panelWattage: 400,
                inverterBrand: 'SMA',
                gridConnection: 'Grid-tied',
                notes: 'Main commercial installation',
                status: 'active',
                utilization: 0,
                temperature: 25,
                power: 0,
                efficiency: 0
            },
            {
                id: 'fnb-willowbridge',
                name: 'FNB Willowbridge',
                type: 'Commercial Solar',
                location: '61 Carl Cronje Drive',
                capacity: 51.98,
                inverterCount: 2,
                commissionDate: '2023-03-20',
                panelCount: 130,
                panelWattage: 400,
                inverterBrand: 'Fronius',
                gridConnection: 'Grid-tied',
                notes: 'Small commercial installation',
                status: 'active',
                utilization: 0,
                temperature: 24,
                power: 0,
                efficiency: 0
            }
        ];

        // Sample GPU data with enhanced inventory information (legacy)
        const gpuAssets = [
            {
                id: 'gpu-001',
                name: 'Tesla V100-01',
                model: 'NVIDIA Tesla V100',
                location: 'Site A - Conyers, GA',
                status: 'active',
                utilization: 85,
                temperature: 72,
                memory: { used: 14.2, total: 16 },
                power: 250,
                jobs: ['ml-training-001', 'inference-batch-003'],
                lastMaintenance: '2024-01-15',
                nextMaintenance: '2024-04-15',
                warranty: { expires: '2025-06-15', status: 'active' },
                purchaseDate: '2023-06-15',
                serialNumber: 'TV100-001-2023',
                firmwareVersion: '1.2.3',
                driverVersion: '535.86.10'
            },
            {
                id: 'gpu-002',
                name: 'Tesla V100-02',
                model: 'NVIDIA Tesla V100',
                location: 'Site B - Macon, GA',
                status: 'active',
                utilization: 92,
                temperature: 78,
                memory: { used: 15.8, total: 16 },
                power: 280,
                jobs: ['deep-learning-002'],
                lastMaintenance: '2024-01-15',
                nextMaintenance: '2024-03-20', // Due soon
                warranty: { expires: '2025-06-15', status: 'active' },
                purchaseDate: '2023-06-15',
                serialNumber: 'TV100-002-2023',
                firmwareVersion: '1.2.3',
                driverVersion: '535.86.10'
            },
            {
                id: 'gpu-003',
                name: 'A100-01',
                model: 'NVIDIA A100',
                location: 'Site C - Augusta, GA',
                status: 'idle',
                utilization: 0,
                temperature: 45,
                memory: { used: 0, total: 40 },
                power: 50,
                jobs: [],
                lastMaintenance: '2024-02-01',
                nextMaintenance: '2024-05-01',
                warranty: { expires: '2026-03-10', status: 'active' },
                purchaseDate: '2024-03-10',
                serialNumber: 'A100-001-2024',
                firmwareVersion: '2.1.0',
                driverVersion: '535.86.10'
            },
            {
                id: 'gpu-004',
                name: 'A100-02',
                model: 'NVIDIA A100',
                location: 'Site D - Savannah, GA',
                status: 'maintenance',
                utilization: 0,
                temperature: 35,
                memory: { used: 0, total: 40 },
                power: 20,
                jobs: [],
                lastMaintenance: '2024-03-01',
                nextMaintenance: '2024-06-01',
                warranty: { expires: '2026-03-10', status: 'active' },
                purchaseDate: '2024-03-10',
                serialNumber: 'A100-002-2024',
                firmwareVersion: '2.1.0',
                driverVersion: '535.86.10'
            }
        ];

        // Navigation functionality
        function switchSection(sectionId) {
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Remove active class from all nav buttons
            document.querySelectorAll('.nav-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // Show selected section
            document.getElementById(sectionId).classList.add('active');
            
            // Add active class to corresponding nav button
            document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
            
            // Load section-specific content
            loadSectionContent(sectionId);
        }

        // Load section-specific content
        function loadSectionContent(sectionId) {
            switch(sectionId) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'inventory':
                    loadInventory();
                    break;
                case 'allocation':
                    loadAllocation();
                    break;
                case 'performance':
                    loadPerformance();
                    break;
                case 'maintenance':
                    loadMaintenance();
                    break;
                case 'analytics':
                    loadAnalytics();
                    break;
            }
        }

        // Create GPU card element
        function createGpuCard(gpu) {
            const card = document.createElement('div');
            card.className = 'gpu-card';
            
            const statusClass = `status-${gpu.status}`;
            const statusText = gpu.status.charAt(0).toUpperCase() + gpu.status.slice(1);
            
            card.innerHTML = `
                <div class="gpu-header">
                    <div class="gpu-name">${gpu.name}</div>
                    <div class="gpu-status ${statusClass}">${statusText}</div>
                </div>
                <div class="gpu-metrics">
                    <div class="metric-row">
                        <span class="metric-label">Model:</span>
                        <span class="metric-value">${gpu.model}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Location:</span>
                        <span class="metric-value">${gpu.location}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Utilization:</span>
                        <span class="metric-value">${gpu.utilization}%</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Inverter Temperature:</span>
                        <span class="metric-value">${gpu.temperature}°C</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Memory:</span>
                        <span class="metric-value">${gpu.memory.used}GB / ${gpu.memory.total}GB</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Power:</span>
                        <span class="metric-value">${gpu.power}W</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Active Jobs:</span>
                        <span class="metric-value">${gpu.jobs.length}</span>
                    </div>
                </div>
                <div class="gpu-actions">
                    <button class="action-btn primary" onclick="viewGpuDetails('${gpu.id}')">Details</button>
                    <button class="action-btn secondary" onclick="manageGpu('${gpu.id}')">Manage</button>
                    ${gpu.status === 'active' ? 
                        `<button class="action-btn danger" onclick="stopGpu('${gpu.id}')">Stop</button>` : 
                        `<button class="action-btn primary" onclick="startGpu('${gpu.id}')">Start</button>`
                    }
                </div>
            `;
            
            return card;
        }

        // Load dashboard content
        function loadDashboard() {
            const solarSitesGrid = document.getElementById('solarSitesGrid');
            if (solarSitesGrid) {
                // Solar sites are now static HTML, no need to populate dynamically
                console.log('Dashboard loaded with solar sites');
            }
        }

        // Load other sections (placeholder implementations)
        function loadInventory() {
            // Solar site inventory is now static HTML - no dynamic loading needed
            console.log('Inventory loaded with solar sites');
        }

        // Create enhanced inventory card
        function createInventoryCard(gpu) {
            const card = document.createElement('div');
            card.className = 'inventory-card';
            
            const statusClass = `status-${gpu.status}`;
            const statusText = gpu.status.charAt(0).toUpperCase() + gpu.status.slice(1);
            
            // Calculate maintenance status
            const today = new Date();
            const nextMaintenance = new Date(gpu.nextMaintenance);
            const daysUntilMaintenance = Math.ceil((nextMaintenance - today) / (1000 * 60 * 60 * 24));
            
            let maintenanceStatus = 'maintenance-value';
            let maintenanceText = `${daysUntilMaintenance} days`;
            
            if (daysUntilMaintenance < 0) {
                maintenanceStatus = 'maintenance-overdue';
                maintenanceText = 'OVERDUE';
            } else if (daysUntilMaintenance <= 7) {
                maintenanceStatus = 'maintenance-due-soon';
                maintenanceText = `${daysUntilMaintenance} days (Due Soon)`;
            }
            
            card.innerHTML = `
                <div class="inventory-header">
                    <div class="inventory-name">${gpu.name}</div>
                    <div class="inventory-status ${statusClass}">${statusText}</div>
                </div>
                
                <div class="inventory-specs">
                    <div class="spec-row">
                        <span class="spec-label">Model:</span>
                        <span class="spec-value">${gpu.model}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Location:</span>
                        <span class="spec-value">${gpu.location}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Serial Number:</span>
                        <span class="spec-value">${gpu.serialNumber}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Purchase Date:</span>
                        <span class="spec-value">${gpu.purchaseDate}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Warranty:</span>
                        <span class="spec-value">${gpu.warranty.status} until ${gpu.warranty.expires}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Firmware:</span>
                        <span class="spec-value">v${gpu.firmwareVersion}</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-label">Driver:</span>
                        <span class="spec-value">v${gpu.driverVersion}</span>
                    </div>
                </div>
                
                <div class="inventory-maintenance">
                    <div class="maintenance-info">
                        <span class="maintenance-label">Last Maintenance:</span>
                        <span class="maintenance-value">${gpu.lastMaintenance}</span>
                    </div>
                    <div class="maintenance-info">
                        <span class="maintenance-label">Next Maintenance:</span>
                        <span class="${maintenanceStatus}">${maintenanceText}</span>
                    </div>
                </div>
                
                <div class="maintenance-actions">
                    <button class="maintenance-action-btn driver" onclick="createMaintenanceTask('${gpu.id}', 'driver')">
                        🔧 Driver Update
                    </button>
                    <button class="maintenance-action-btn firmware" onclick="createMaintenanceTask('${gpu.id}', 'firmware')">
                        ⚡ Firmware Update
                    </button>
                    <button class="maintenance-action-btn inspection" onclick="createMaintenanceTask('${gpu.id}', 'inspection')">
                        🔍 Inspection
                    </button>
                    <button class="maintenance-action-btn repair" onclick="createMaintenanceTask('${gpu.id}', 'repair')">
                        🛠️ Repair
                    </button>
                    <button class="maintenance-action-btn replace" onclick="createMaintenanceTask('${gpu.id}', 'replace')">
                        🔄 Replace
                    </button>
                </div>
            `;
            
            return card;
        }


        // Create maintenance task from inventory
        function createMaintenanceTask(gpuId, taskType) {
            const gpu = gpuAssets.find(g => g.id === gpuId);
            if (!gpu) return;
            
            // Set default values based on task type
            const taskDefaults = {
                driver: {
                    type: 'driver',
                    description: `Update NVIDIA drivers for ${gpu.name} to latest version`,
                    duration: '30 minutes',
                    priority: 'medium'
                },
                firmware: {
                    type: 'firmware',
                    description: `Update GPU firmware for ${gpu.name} to latest version`,
                    duration: '45 minutes',
                    priority: 'high'
                },
                inspection: {
                    type: 'inspection',
                    description: `Hardware inspection and cleaning for ${gpu.name}`,
                    duration: '2 hours',
                    priority: 'medium'
                },
                repair: {
                    type: 'repair',
                    description: `Repair hardware issues for ${gpu.name}`,
                    duration: '4 hours',
                    priority: 'high'
                },
                replace: {
                    type: 'replace',
                    description: `Replace ${gpu.name} with new unit`,
                    duration: '8 hours',
                    priority: 'critical'
                }
            };
            
            const defaults = taskDefaults[taskType];
            
            // Set form values
            document.getElementById('maintenanceType').value = defaults.type;
            document.getElementById('maintenancePriority').value = defaults.priority;
            document.getElementById('maintenanceDuration').value = defaults.duration;
            document.getElementById('maintenanceDescription').value = defaults.description;
            
            // Set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('maintenanceDate').value = tomorrow.toISOString().split('T')[0];
            
            // Store GPU ID for form submission
            document.getElementById('maintenanceForm').setAttribute('data-gpu-id', gpuId);
            
            // Update modal title
            document.getElementById('maintenanceModalTitle').textContent = `Create ${defaults.type.charAt(0).toUpperCase() + defaults.type.slice(1)} Task - ${gpu.name}`;
            
            // Show modal
            document.getElementById('maintenanceModal').style.display = 'flex';
        }

        // Close maintenance modal
        function closeMaintenanceModal() {
            document.getElementById('maintenanceModal').style.display = 'none';
            document.getElementById('maintenanceForm').reset();
        }

        // Maintenance form submission moved to DOMContentLoaded

        // Add GPU modal functions
        function openAddSiteModal() {
            // Set default values
            const today = new Date();
            document.getElementById('commissionDate').value = today.toISOString().split('T')[0];
            
            // Reset button states
            document.getElementById('testSiteConnectionBtn').disabled = false;
            document.getElementById('testSiteConnectionBtn').textContent = '🔍 Test Connection';
            document.getElementById('addSiteBtn').disabled = true;
            document.getElementById('addSiteBtn').textContent = 'Add Site to Inventory';
            
            // Show modal
            document.getElementById('addSiteModal').style.display = 'flex';
        }

        function closeAddSiteModal() {
            document.getElementById('addSiteModal').style.display = 'none';
            document.getElementById('addSiteForm').reset();
        }

        // Test connection function
        function testSiteConnection() {
            const testBtn = document.getElementById('testSiteConnectionBtn');
            const addBtn = document.getElementById('addSiteBtn');
            
            // Validate required fields first
            const requiredFields = ['siteName', 'siteType', 'siteLocation', 'siteCapacity'];
            for (const fieldId of requiredFields) {
                const field = document.getElementById(fieldId);
                if (!field.value.trim()) {
                    alert(`Please fill in the ${fieldId.replace('site', '').replace(/([A-Z])/g, ' $1').toLowerCase()} field before testing connection.`);
                    return;
                }
            }
            
            // Start connection test
            testBtn.disabled = true;
            testBtn.textContent = '🔄 Testing Connection...';
            
            // Simulate 5-second connection test
            setTimeout(() => {
                // Simulate connection success/failure (90% success rate)
                const connectionSuccess = Math.random() > 0.1;
                
                if (connectionSuccess) {
                    testBtn.textContent = '✅ Connection Successful';
                    testBtn.style.backgroundColor = 'var(--status-green)';
                    addBtn.disabled = false;
                    addBtn.style.backgroundColor = 'var(--primary-blue)';
                    
                    // Show success message
                    alert(`Connection test successful!\n\nSite: ${document.getElementById('siteName').value}\nLocation: ${document.getElementById('siteLocation').value}\nGrid Connection: ${document.getElementById('gridConnection').value}\n\nYou can now add this site to inventory.`);
                } else {
                    testBtn.textContent = '❌ Connection Failed';
                    testBtn.style.backgroundColor = 'var(--status-red)';
                    addBtn.disabled = true;
                    
                    // Show failure message
                    alert(`Connection test failed!\n\nPlease check:\n- Connection details are correct\n- GPU is powered on\n- Network connectivity\n- Authentication credentials\n\nTry again after fixing the connection issues.`);
                }
                
                // Re-enable test button after 3 seconds
                setTimeout(() => {
                    testBtn.disabled = false;
                    testBtn.textContent = '🔍 Test Connection';
                    testBtn.style.backgroundColor = '';
                }, 3000);
                
            }, 5000); // 5-second connection test
        }

        // All form submissions and modal event listeners moved to DOMContentLoaded

        // Capacity management data
        const capacityData = {
            sites: [
                {
                    name: 'Site A - Conyers, GA',
                    totalGpus: 6,
                    ondemandGpus: 4,
                    spotGpus: 2,
                    idleGpus: 1,
                    maintenanceGpus: 0
                },
                {
                    name: 'Site B - Macon, GA',
                    totalGpus: 6,
                    ondemandGpus: 5,
                    spotGpus: 1,
                    idleGpus: 0,
                    maintenanceGpus: 0
                },
                {
                    name: 'Site C - Augusta, GA',
                    totalGpus: 6,
                    ondemandGpus: 3,
                    spotGpus: 2,
                    idleGpus: 1,
                    maintenanceGpus: 0
                },
                {
                    name: 'Site D - Savannah, GA',
                    totalGpus: 6,
                    ondemandGpus: 6,
                    spotGpus: 0,
                    idleGpus: 0,
                    maintenanceGpus: 0
                }
            ],
            preemptionEvents: [
                {
                    id: 'preempt-001',
                    type: 'warning',
                    title: 'On-Demand Customer Requesting Capacity',
                    description: 'Customer Alpha needs 2 Tesla V100s at Site A. 1 spot instance will be preempted.',
                    site: 'Site A - Conyers, GA',
                    affectedInstances: 1,
                    timestamp: '2024-03-15 14:30:00'
                },
                {
                    id: 'preempt-002',
                    type: 'critical',
                    title: 'High Priority On-Demand Deployment',
                    description: 'Customer Beta requesting 4 A100s at Site C. All spot instances will be preempted.',
                    site: 'Site C - Augusta, GA',
                    affectedInstances: 2,
                    timestamp: '2024-03-15 15:45:00'
                }
            ],
            scalingAlerts: [
                {
                    id: 'alert-001',
                    type: 'expand',
                    title: 'Site A Capacity Utilization High',
                    description: 'Site A running at 95% capacity. Consider expanding GPU capacity.',
                    priority: 'medium',
                    site: 'Site A - Conyers, GA',
                    utilization: 95
                },
                {
                    id: 'alert-002',
                    type: 'maintain',
                    title: 'Site D Fully Reserved',
                    description: 'Site D has no spot capacity available. Monitor for expansion opportunities.',
                    priority: 'low',
                    site: 'Site D - Savannah, GA',
                    utilization: 100
                },
                {
                    id: 'alert-003',
                    type: 'critical',
                    title: 'Critical Capacity Shortage',
                    description: 'System-wide capacity at 92%. Immediate expansion needed.',
                    priority: 'high',
                    site: 'All Sites',
                    utilization: 92
                }
            ]
        };

        function loadAllocation() {
            loadCapacityAllocation();
            loadPreemptionStatus();
            loadScalingAlerts();
            updateCapacityMetrics();
            initializeCapacityFilters();
        }

        // Load capacity allocation by site
        function loadCapacityAllocation() {
            const capacityContainer = document.getElementById('capacityAllocation');
            capacityContainer.innerHTML = '';

            capacityData.sites.forEach(site => {
                const capacitySite = document.createElement('div');
                capacitySite.className = 'capacity-site';
                
                const ondemandPercent = (site.ondemandGpus / site.totalGpus) * 100;
                const spotPercent = (site.spotGpus / site.totalGpus) * 100;
                const idlePercent = (site.idleGpus / site.totalGpus) * 100;
                const maintenancePercent = (site.maintenanceGpus / site.totalGpus) * 100;
                
                capacitySite.innerHTML = `
                    <div class="site-capacity-info">
                        <div class="site-capacity-name">${site.name}</div>
                        <div class="site-capacity-details">
                            <span>Total: ${site.totalGpus} GPUs</span>
                            <span>On-Demand: ${site.ondemandGpus}</span>
                            <span>Spot Available: ${site.spotGpus}</span>
                            <span>Idle: ${site.idleGpus}</span>
                            <span>Maintenance: ${site.maintenanceGpus}</span>
                        </div>
                    </div>
                    <div class="capacity-bar-container">
                        <div class="capacity-bar">
                            <div class="capacity-segment capacity-ondemand" style="width: ${ondemandPercent}%"></div>
                            <div class="capacity-segment capacity-spot" style="width: ${spotPercent}%"></div>
                            <div class="capacity-segment capacity-idle" style="width: ${idlePercent}%"></div>
                            <div class="capacity-segment capacity-maintenance" style="width: ${maintenancePercent}%"></div>
                        </div>
                        <div class="capacity-labels">
                            <span>On-Demand</span>
                            <span>Spot</span>
                            <span>Idle</span>
                            <span>Maintenance</span>
                        </div>
                    </div>
                `;
                
                capacityContainer.appendChild(capacitySite);
            });
        }

        // Load preemption status
        function loadPreemptionStatus() {
            const preemptionContainer = document.getElementById('preemptionStatus');
            preemptionContainer.innerHTML = '';

            capacityData.preemptionEvents.forEach(event => {
                const preemptionItem = document.createElement('div');
                preemptionItem.className = 'preemption-item';
                
                const iconClass = `preemption-${event.type}`;
                const iconText = event.type === 'critical' ? '!' : event.type === 'warning' ? '⚠' : 'ℹ';
                
                preemptionItem.innerHTML = `
                    <div class="preemption-icon ${iconClass}">${iconText}</div>
                    <div class="preemption-details">
                        <div class="preemption-title">${event.title}</div>
                        <div class="preemption-description">${event.description}</div>
                    </div>
                    <div class="preemption-actions">
                        <button class="preemption-btn acknowledge" onclick="acknowledgePreemption('${event.id}')">Acknowledge</button>
                        <button class="preemption-btn execute" onclick="executePreemption('${event.id}')">Execute</button>
                    </div>
                `;
                
                preemptionContainer.appendChild(preemptionItem);
            });
        }

        // Load scaling alerts
        function loadScalingAlerts() {
            const alertsContainer = document.getElementById('scalingAlerts');
            alertsContainer.innerHTML = '';

            capacityData.scalingAlerts.forEach(alert => {
                const scalingAlert = document.createElement('div');
                scalingAlert.className = 'scaling-alert';
                
                const iconClass = `alert-${alert.type}`;
                const iconText = alert.type === 'critical' ? '!' : alert.type === 'expand' ? '📈' : '⚠';
                
                scalingAlert.innerHTML = `
                    <div class="alert-icon ${iconClass}">${iconText}</div>
                    <div class="alert-details">
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-description">${alert.description}</div>
                    </div>
                    <div class="alert-priority priority-${alert.priority}">${alert.priority}</div>
                `;
                
                alertsContainer.appendChild(scalingAlert);
            });
        }

        // Update capacity metrics
        function updateCapacityMetrics() {
            const totalCapacity = capacityData.sites.reduce((sum, site) => sum + site.totalGpus, 0);
            const ondemandCapacity = capacityData.sites.reduce((sum, site) => sum + site.ondemandGpus, 0);
            const spotCapacity = capacityData.sites.reduce((sum, site) => sum + site.spotGpus, 0);
            const capacityHealth = Math.round((ondemandCapacity / totalCapacity) * 100);
            
            document.getElementById('totalCapacity').textContent = totalCapacity;
            document.getElementById('ondemandCapacity').textContent = ondemandCapacity;
            document.getElementById('spotCapacity').textContent = spotCapacity;
            document.getElementById('capacityHealth').textContent = capacityHealth + '%';
        }

        // Initialize capacity filters
        function initializeCapacityFilters() {
            document.querySelectorAll('[data-view]').forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons
                    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    this.classList.add('active');
                    
                    // Filter capacity view
                    const view = this.getAttribute('data-view');
                    filterCapacityView(view);
                });
            });
        }

        // Filter capacity view
        function filterCapacityView(view) {
            // This would filter the capacity display based on the selected view
            // For now, just reload the full view
            loadCapacityAllocation();
        }

        // Preemption management functions
        function acknowledgePreemption(eventId) {
            const event = capacityData.preemptionEvents.find(e => e.id === eventId);
            if (event) {
                alert(`Preemption event "${event.title}" acknowledged`);
                // In a real system, this would update the event status
            }
        }

        function executePreemption(eventId) {
            const event = capacityData.preemptionEvents.find(e => e.id === eventId);
            if (event && confirm(`Execute preemption for "${event.title}"?`)) {
                alert(`Preemption executed: ${event.affectedInstances} spot instances will be terminated`);
                // In a real system, this would trigger the preemption process
                loadCapacityAllocation();
                updateCapacityMetrics();
            }
        }

        function loadPerformance() {
            // Generate initial cached data
            generateAndCacheSiteData();
            
            // Initialize Site selector
            initializeSiteSelector();
            
            // Initialize charts after ensuring DOM is ready
            setTimeout(() => {
                try {
                    if (typeof Chart !== 'undefined') {
                        initializeCharts();
                        setupChartTimeControls();
                        // Load charts with initial data
                        updatePerformanceCharts('all');
                    } else {
                        console.log('Chart.js not available, skipping chart initialization');
                    }
                } catch (error) {
                    console.error('Error during chart setup:', error);
                }
            }, 1000);
            
            // Simulate real-time data updates
            startPerformanceUpdates();
            
            // Initialize alert system
            initializeAlerts();
        }

        // Initialize Site selector dropdown
        function initializeSiteSelector() {
            const siteSelector = document.getElementById('siteSelector');
            
            // Add change event listener
            siteSelector.addEventListener('change', function() {
                updatePerformanceDisplay(this.value);
                updatePerformanceCharts(this.value);
            });
            
            // Initialize with "All Sites" view
            updatePerformanceDisplay('all');
            updatePerformanceCharts('all');
        }

        // Update performance display based on selected Site
        function updatePerformanceDisplay(selectedSiteId) {
            if (selectedSiteId === 'all') {
                // Show average metrics from both sites
                updateAverageMetrics();
                updateChartTitles('All Sites (Average)');
            } else {
                // Show individual Site metrics using cached data
                const selectedSite = getCachedSiteData(selectedSiteId);
                if (selectedSite) {
                    updateIndividualSiteMetrics(selectedSite);
                    updateChartTitles(selectedSite.name);
                }
            }
        }

        // Update average metrics display with proper weighted averaging
        function updateAverageMetrics() {
            // Get cached data for both solar sites
            const cummins = getCachedSiteData('cummins-midrand');
            const fnb = getCachedSiteData('fnb-willowbridge');
            
            if (cummins && fnb) {
                // Calculate weighted averages based on site capacity
                const totalCapacity = cummins.capacity + fnb.capacity;
                const cumminsWeight = cummins.capacity / totalCapacity;
                const fnbWeight = fnb.capacity / totalCapacity;
                
                // Total power production (sum, not average) - convert to kWh
                const totalPowerProduction = Math.round((cummins.power + fnb.power) * 100) / 100;
                const avgEfficiency = Math.round((cummins.efficiency * cumminsWeight) + (fnb.efficiency * fnbWeight));
                
                // Weighted average temperature
                const avgTemp = Math.round((cummins.temperature * cumminsWeight) + (fnb.temperature * fnbWeight));
                
                // Total power consumption (sum, not average) - convert to kWh
                const totalPowerConsumption = Math.round((cummins.consumption + fnb.consumption) * 100) / 100;
                
                // Update DOM elements with calculated averages
                const utilizationElement = document.getElementById('gpuUtilization');
                const temperatureElement = document.getElementById('gpuTemperature');
                const powerElement = document.getElementById('gpuPower');
                const memoryElement = document.getElementById('gpuMemory');
                
                if (utilizationElement) utilizationElement.textContent = totalPowerProduction + ' kWh';
                if (temperatureElement) temperatureElement.textContent = avgTemp + '°C';
                if (powerElement) powerElement.textContent = totalPowerConsumption + ' kWh';
                if (memoryElement) memoryElement.textContent = avgEfficiency + '%';
                
                // Update labels to reflect averages
                const utilizationLabel = document.getElementById('utilizationLabel');
                const temperatureLabel = document.getElementById('temperatureLabel');
                const powerLabel = document.getElementById('powerLabel');
                const memoryLabel = document.getElementById('memoryLabel');
                
                if (utilizationLabel) utilizationLabel.textContent = 'Total Power Production';
                if (temperatureLabel) temperatureLabel.textContent = 'Weighted Average Inverter Temperature';
                if (powerLabel) powerLabel.textContent = 'Total Power Consumption';
                if (memoryLabel) memoryLabel.textContent = 'Weighted Average Efficiency';
                
                // Update trend indicators for averages
                updateAverageTrendIndicators(totalPowerProduction, avgTemp, totalPowerConsumption, avgEfficiency);
                
                // Return the calculated averages for chart use
                return { totalPowerProduction, avgTemp, totalPowerConsumption, avgEfficiency };
            }
        }


        // Update chart titles
        function updateChartTitles(siteName) {
            // Chart titles are now handled by the chart instances themselves
            console.log('Chart titles updated for:', siteName);
        }

        // Update individual site metrics display
        function updateIndividualSiteMetrics(site) {
            console.log('Individual site metrics updated for:', site.name);
            
            // Update DOM elements with individual site data
            const utilizationElement = document.getElementById('gpuUtilization');
            const temperatureElement = document.getElementById('gpuTemperature');
            const powerElement = document.getElementById('gpuPower');
            const memoryElement = document.getElementById('gpuMemory');
            
            if (utilizationElement) utilizationElement.textContent = site.power + ' kWh';
            if (temperatureElement) temperatureElement.textContent = site.temperature + '°C';
            if (powerElement) powerElement.textContent = site.consumption + ' kWh';
            if (memoryElement) memoryElement.textContent = site.efficiency + '%';
            
            // Update labels to reflect individual site
            const utilizationLabel = document.getElementById('utilizationLabel');
            const temperatureLabel = document.getElementById('temperatureLabel');
            const powerLabel = document.getElementById('powerLabel');
            const memoryLabel = document.getElementById('memoryLabel');
            
            if (utilizationLabel) utilizationLabel.textContent = site.name + ' Power Production';
            if (temperatureLabel) temperatureLabel.textContent = site.name + ' Inverter Temperature';
            if (powerLabel) powerLabel.textContent = site.name + ' Power Consumption';
            if (memoryLabel) memoryLabel.textContent = site.name + ' Efficiency';
            
            // Update trend indicators based on individual site status
            updateIndividualTrendIndicators(site);
        }

        // Update trend indicators for individual site
        function updateIndividualTrendIndicators(site) {
            const utilizationTrend = document.getElementById('utilizationTrend');
            const temperatureTrend = document.getElementById('temperatureTrend');
            const powerTrend = document.getElementById('powerTrend');
            const memoryTrend = document.getElementById('memoryTrend');
            
            // Utilization trend
            if (site.utilization > 80) {
                utilizationTrend.textContent = '↗ High utilization';
                utilizationTrend.className = 'performance-trend trend-up';
            } else if (site.utilization < 20) {
                utilizationTrend.textContent = '↘ Low utilization';
                utilizationTrend.className = 'performance-trend trend-down';
            } else {
                utilizationTrend.textContent = '→ Normal utilization';
                utilizationTrend.className = 'performance-trend trend-stable';
            }
            
            // Temperature trend
            if (site.temperature > 50) {
                temperatureTrend.textContent = '↗ High temperature';
                temperatureTrend.className = 'performance-trend trend-up';
            } else if (site.temperature < 20) {
                temperatureTrend.textContent = '↘ Low temperature';
                temperatureTrend.className = 'performance-trend trend-down';
            } else {
                temperatureTrend.textContent = '→ Normal temperature';
                temperatureTrend.className = 'performance-trend trend-stable';
            }
            
            // Power trend
            if (site.power > 500) {
                powerTrend.textContent = '↗ High power output';
                powerTrend.className = 'performance-trend trend-up';
            } else if (site.power < 50) {
                powerTrend.textContent = '↘ Low power output';
                powerTrend.className = 'performance-trend trend-down';
            } else {
                powerTrend.textContent = '→ Normal power output';
                powerTrend.className = 'performance-trend trend-stable';
            }
            
            // Efficiency trend
            if (site.efficiency > 90) {
                memoryTrend.textContent = '↗ High efficiency';
                memoryTrend.className = 'performance-trend trend-up';
            } else if (site.efficiency < 50) {
                memoryTrend.textContent = '↘ Low efficiency';
                memoryTrend.className = 'performance-trend trend-down';
            } else {
                memoryTrend.textContent = '→ Normal efficiency';
                memoryTrend.className = 'performance-trend trend-stable';
            }
        }

        // Update trend indicators for average metrics
        function updateAverageTrendIndicators(avgUtil, avgTemp, avgPower, avgEfficiency) {
            const utilizationTrend = document.getElementById('utilizationTrend');
            const temperatureTrend = document.getElementById('temperatureTrend');
            const powerTrend = document.getElementById('powerTrend');
            const memoryTrend = document.getElementById('memoryTrend');
            
            // Average utilization trend
            if (avgUtil > 80) {
                utilizationTrend.textContent = '↗ High average utilization';
                utilizationTrend.className = 'performance-trend trend-up';
            } else if (avgUtil < 20) {
                utilizationTrend.textContent = '↘ Low average utilization';
                utilizationTrend.className = 'performance-trend trend-down';
            } else {
                utilizationTrend.textContent = '→ Normal average utilization';
                utilizationTrend.className = 'performance-trend trend-stable';
            }
            
            // Average temperature trend
            if (avgTemp > 50) {
                temperatureTrend.textContent = '↗ High average temperature';
                temperatureTrend.className = 'performance-trend trend-up';
            } else if (avgTemp < 20) {
                temperatureTrend.textContent = '↘ Low average temperature';
                temperatureTrend.className = 'performance-trend trend-down';
            } else {
                temperatureTrend.textContent = '→ Normal average temperature';
                temperatureTrend.className = 'performance-trend trend-stable';
            }
            
            // Average power trend
            if (avgPower > 400) {
                powerTrend.textContent = '↗ High average power output';
                powerTrend.className = 'performance-trend trend-up';
            } else if (avgPower < 25) {
                powerTrend.textContent = '↘ Low average power output';
                powerTrend.className = 'performance-trend trend-down';
            } else {
                powerTrend.textContent = '→ Normal average power output';
                powerTrend.className = 'performance-trend trend-stable';
            }
            
            // Average efficiency trend
            if (avgEfficiency > 90) {
                memoryTrend.textContent = '↗ High average efficiency';
                memoryTrend.className = 'performance-trend trend-up';
            } else if (avgEfficiency < 50) {
                memoryTrend.textContent = '↘ Low average efficiency';
                memoryTrend.className = 'performance-trend trend-down';
            } else {
                memoryTrend.textContent = '→ Normal average efficiency';
                memoryTrend.className = 'performance-trend trend-stable';
            }
        }

        // Update performance charts based on selected site
        function updatePerformanceCharts(selectedSiteId) {
            try {
                console.log('Updating charts for:', selectedSiteId);
                
                // Skip if charts aren't initialized yet
                if (!efficiencyChartInstance && !temperatureChartInstance && !powerProductionChartInstance && !powerConsumptionChartInstance) {
                    console.log('Charts not initialized yet, skipping update');
                    return;
                }
                
                // Get current time periods for each chart
                const efficiencyPeriod = document.querySelector('#efficiencyChart')?.closest('.chart-container')?.querySelector('.chart-btn.active')?.getAttribute('data-period') || '24h';
                const temperaturePeriod = document.querySelector('#temperatureChart')?.closest('.chart-container')?.querySelector('.chart-btn.active')?.getAttribute('data-period') || '1h';
                const powerProductionPeriod = document.querySelector('#powerProductionChart')?.closest('.chart-container')?.querySelector('.chart-btn.active')?.getAttribute('data-period') || '24h';
                const powerConsumptionPeriod = document.querySelector('#powerConsumptionChart')?.closest('.chart-container')?.querySelector('.chart-btn.active')?.getAttribute('data-period') || '1h';
                
                // Update each chart with new site data
                if (efficiencyChartInstance) {
                    const efficiencyData = generateChartData(selectedSiteId, efficiencyPeriod, 'efficiency');
                    updateChart(efficiencyChartInstance, efficiencyData.labels, efficiencyData.data, selectedSiteId, efficiencyPeriod, 'efficiency');
                }
                
                if (temperatureChartInstance) {
                    const temperatureData = generateChartData(selectedSiteId, temperaturePeriod, 'temperature');
                    updateChart(temperatureChartInstance, temperatureData.labels, temperatureData.data, selectedSiteId, temperaturePeriod, 'temperature');
                }
                
                if (powerProductionChartInstance) {
                    const powerProductionData = generateChartData(selectedSiteId, powerProductionPeriod, 'powerProduction');
                    updateChart(powerProductionChartInstance, powerProductionData.labels, powerProductionData.data, selectedSiteId, powerProductionPeriod, 'powerProduction');
                }
                
                if (powerConsumptionChartInstance) {
                    const powerConsumptionData = generateChartData(selectedSiteId, powerConsumptionPeriod, 'powerConsumption');
                    updateChart(powerConsumptionChartInstance, powerConsumptionData.labels, powerConsumptionData.data, selectedSiteId, powerConsumptionPeriod, 'powerConsumption');
                }
            } catch (error) {
                console.error('Error updating charts:', error);
            }
        }

        // Generate chart data for average of all sites
        function generateAverageChartData() {
            const cumminsData = generateSiteChartData('cummins-midrand');
            const fnbData = generateSiteChartData('fnb-willowbridge');
            
            // Calculate averages for each time point
            const averageData = cumminsData.map((cumminsVal, index) => {
                return Math.round((cumminsVal + fnbData[index]) / 2);
            });
            
            return averageData;
        }

        // Generate realistic chart data for a specific site
        function generateSiteChartData(siteId) {
            const currentHour = new Date().getHours();
            const site = getSiteData(siteId);
            
            // Generate 24 hours of data (hourly intervals)
            const hourlyData = [];
            for (let hour = 0; hour < 24; hour++) {
                let utilization = 0;
                
                // Solar production curve (6 AM to 6 PM)
                if (hour >= 6 && hour <= 18) {
                    // Peak solar hours: 11 AM - 3 PM
                    if (hour >= 11 && hour <= 15) {
                        utilization = 80 + Math.random() * 20; // 80-100%
                    } else if (hour >= 8 && hour <= 17) {
                        utilization = 40 + Math.random() * 40; // 40-80%
                    } else {
                        utilization = 10 + Math.random() * 30; // 10-40%
                    }
                }
                
                // Adjust based on site capacity (Cummins is larger, more stable)
                if (siteId === 'cummins-midrand') {
                    utilization *= 1.1; // Slightly higher efficiency
                } else {
                    utilization *= 0.95; // Slightly lower for smaller site
                }
                
                hourlyData.push(Math.min(100, Math.max(0, Math.round(utilization))));
            }
            
            return hourlyData;
        }

        // Chart instances
        let efficiencyChartInstance = null;
        let temperatureChartInstance = null;
        let powerProductionChartInstance = null;
        let powerConsumptionChartInstance = null;


        // Initialize all charts
        function initializeCharts() {
            try {
                initializeEfficiencyChart();
                initializeTemperatureChart();
                initializePowerProductionChart();
                initializePowerConsumptionChart();
                console.log('Charts initialized successfully');
            } catch (error) {
                console.error('Error initializing charts:', error);
            }
        }

        // Initialize efficiency chart
        function initializeEfficiencyChart() {
            const ctx = document.getElementById('efficiencyChartCanvas');
            if (!ctx) {
                console.log('Efficiency chart canvas not found');
                return;
            }

            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                return;
            }

            if (efficiencyChartInstance) {
                efficiencyChartInstance.destroy();
            }

            try {
                // Get initial data for the chart
            const initialData = generateChartData('all', '24h', 'efficiency');
            
            efficiencyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: initialData.labels,
                    datasets: [{
                        label: 'Efficiency %',
                        data: initialData.data,
                        borderColor: '#455BF1',
                        backgroundColor: 'rgba(69, 91, 241, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#455BF1',
                        pointBorderColor: '#455BF1',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: true,
                                color: '#e0e0e0'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            } catch (error) {
                console.error('Error creating utilization chart:', error);
            }
        }

        // Initialize temperature chart
        function initializeTemperatureChart() {
            const ctx = document.getElementById('temperatureChartCanvas');
            if (!ctx) return;

            if (temperatureChartInstance) {
                temperatureChartInstance.destroy();
            }

            // Get initial data for the chart
            const initialTempData = generateChartData('all', '1h', 'temperature');
            
            temperatureChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: initialTempData.labels,
                    datasets: [{
                        label: 'Inverter Temperature °C',
                        data: initialTempData.data,
                        borderColor: '#22C55E',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#22C55E',
                        pointBorderColor: '#22C55E',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 20,
                            max: 70,
                            ticks: {
                                callback: function(value) {
                                    return value + '°C';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: true,
                                color: '#e0e0e0'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }

        // Initialize power chart
        function initializePowerProductionChart() {
            const ctx = document.getElementById('powerProductionChartCanvas');
            if (!ctx) return;

            if (powerProductionChartInstance) {
                powerProductionChartInstance.destroy();
            }

            // Get initial data for the chart
            const initialPowerData = generateChartData('all', '24h', 'powerProduction');
            
            powerProductionChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: initialPowerData.labels,
                    datasets: [{
                        label: 'Power Production (kWh)',
                        data: initialPowerData.data,
                        borderColor: '#4ECDC4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#4ECDC4',
                        pointBorderColor: '#4ECDC4',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value + ' kW';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: true,
                                color: '#e0e0e0'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }

        // Initialize power consumption chart
        function initializePowerConsumptionChart() {
            const ctx = document.getElementById('powerConsumptionChartCanvas');
            if (!ctx) return;

            if (powerConsumptionChartInstance) {
                powerConsumptionChartInstance.destroy();
            }

            // Get initial data for the chart
            const initialPowerData = generateChartData('all', '1h', 'powerConsumption');
            
            powerConsumptionChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: initialPowerData.labels,
                    datasets: [{
                        label: 'Power Consumption (kWh)',
                        data: initialPowerData.data,
                        borderColor: '#FF6B6B',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#FF6B6B',
                        pointBorderColor: '#FF6B6B',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                display: true,
                                color: '#e0e0e0'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + ' kWh';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: true,
                                color: '#e0e0e0'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }

        // Generate chart data based on time period and site using cached values
        function generateChartData(siteId, period, type) {
            let labels, dataPoints;
            
            // Generate realistic labels based on period
            const now = new Date();
            switch (period) {
                case '1h':
                    // 5-minute intervals over 1 hour
                    labels = [];
                    for (let i = 5; i >= 0; i--) {
                        const time = new Date(now.getTime() - i * 5 * 60000);
                        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                    }
                    dataPoints = 6;
                    break;
                case '6h':
                    // 1-hour intervals over 6 hours
                    labels = [];
                    for (let i = 5; i >= 0; i--) {
                        const time = new Date(now.getTime() - i * 60 * 60000);
                        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                    }
                    dataPoints = 6;
                    break;
                case '24h':
                    // 4-hour intervals over 24 hours
                    labels = [];
                    for (let i = 5; i >= 0; i--) {
                        const time = new Date(now.getTime() - i * 4 * 60 * 60000);
                        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                    }
                    dataPoints = 6;
                    break;
                case '7d':
                    // Daily averages over 7 days
                    labels = [];
                    for (let i = 5; i >= 0; i--) {
                        const time = new Date(now.getTime() - i * 24 * 60 * 60000);
                        labels.push(time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                    }
                    dataPoints = 6;
                    break;
                default:
                    labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
                    dataPoints = 6;
            }

            // Get current cached values for the site(s)
            let currentValue = 0;
            if (siteId === 'all') {
                // For averages, use weighted averages based on capacity
                const cummins = getCachedSiteData('cummins-midrand');
                const fnb = getCachedSiteData('fnb-willowbridge');
                if (cummins && fnb) {
                    const totalCapacity = cummins.capacity + fnb.capacity;
                    const cumminsWeight = cummins.capacity / totalCapacity;
                    const fnbWeight = fnb.capacity / totalCapacity;
                    
                    if (type === 'efficiency') {
                        currentValue = Math.round((cummins.efficiency * cumminsWeight) + (fnb.efficiency * fnbWeight));
                    } else if (type === 'temperature') {
                        currentValue = Math.round((cummins.temperature * cumminsWeight) + (fnb.temperature * fnbWeight));
                    } else if (type === 'powerProduction') {
                        currentValue = Math.round((cummins.power + fnb.power) * 100) / 100; // Sum for power production
                    } else if (type === 'powerConsumption') {
                        // Use cached consumption data
                        currentValue = Math.round((cummins.consumption + fnb.consumption) * 100) / 100;
                    }
                }
            } else {
                // For individual sites, use exact cached values
                const siteData = getCachedSiteData(siteId);
                if (siteData) {
                    if (type === 'efficiency') {
                        currentValue = siteData.efficiency;
                    } else if (type === 'temperature') {
                        currentValue = siteData.temperature;
                    } else if (type === 'powerProduction') {
                        currentValue = siteData.power;
                    } else if (type === 'powerConsumption') {
                        currentValue = siteData.consumption; // Use cached consumption data
                    }
                }
            }

            // Generate realistic solar time series data
            const data = [];
            
            for (let i = 0; i < dataPoints; i++) {
                let value = currentValue;
                
                // Calculate solar factor based on time of day for realistic patterns
                let solarFactor = 1.0;
                const timeIndex = i / (dataPoints - 1); // 0 to 1
                
                if (type === 'powerProduction' || type === 'powerConsumption') {
                    // Solar production follows realistic daily curve with night = zero
                    if (period === '1h') {
                        // Hourly: assume midday peak (solarFactor = 1.0)
                        solarFactor = 0.95 + Math.random() * 0.1; // 95-105% variation
                    } else if (period === '6h') {
                        // 6-hour: morning to afternoon curve (daylight hours)
                        solarFactor = Math.sin(timeIndex * Math.PI) * 0.3 + 0.7; // 70-100% curve
                    } else if (period === '24h') {
                        // 24-hour: full daily solar curve with night = zero
                        const hourOfDay = timeIndex * 24; // 0-24 hours
                        if (hourOfDay < 6 || hourOfDay > 18) {
                            solarFactor = 0; // Night time = zero production
                        } else {
                            // Day time: bell curve centered at noon (12:00)
                            const dayProgress = (hourOfDay - 6) / 12; // 0-1 from 6am to 6pm
                            solarFactor = Math.sin(dayProgress * Math.PI); // Peak at noon
                        }
                    } else if (period === '7d') {
                        // 7-day: daily averages with weather variation (assume daytime average)
                        solarFactor = 0.6 + Math.random() * 0.4; // 60-100% variation
                    }
                    
                    value = currentValue * solarFactor;
                } else if (type === 'efficiency') {
                    // Efficiency varies less and stays high during good conditions
                    if (period === '1h') {
                        solarFactor = 0.98 + Math.random() * 0.04; // 98-102% (very stable)
                    } else if (period === '6h') {
                        solarFactor = 0.95 + Math.random() * 0.1; // 95-105%
                    } else if (period === '24h') {
                        solarFactor = 0.9 + Math.random() * 0.2; // 90-110%
                    } else if (period === '7d') {
                        solarFactor = 0.85 + Math.random() * 0.3; // 85-115%
                    }
                    
                    value = currentValue * solarFactor;
                } else if (type === 'temperature') {
                    // Inverter temperature follows load and ambient conditions
                    if (period === '1h') {
                        solarFactor = 0.95 + Math.random() * 0.1; // Small variation
                    } else if (period === '6h') {
                        solarFactor = Math.sin(timeIndex * Math.PI) * 0.15 + 0.85; // Daily temp curve (less variation)
                    } else if (period === '24h') {
                        // 24-hour: inverter temperature follows load and ambient
                        const hourOfDay = timeIndex * 24; // 0-24 hours
                        if (hourOfDay < 6 || hourOfDay > 18) {
                            solarFactor = 0.8; // Night time = cooler but not ambient (inverters still warm)
                        } else {
                            // Day time: temperature rises with load and ambient
                            const dayProgress = (hourOfDay - 6) / 12; // 0-1 from 6am to 6pm
                            solarFactor = 0.8 + 0.2 * Math.sin(dayProgress * Math.PI); // 80-100% temp curve
                        }
                    } else if (period === '7d') {
                        solarFactor = 0.85 + Math.random() * 0.3; // Weather variation
                    }
                    
                    value = currentValue * solarFactor;
                }
                
                // Ensure values are realistic for solar systems
                if (type === 'efficiency') {
                    value = Math.max(60, Math.min(95, value)); // Solar efficiency: 60-95%
                } else if (type === 'temperature') {
                    value = Math.max(35, Math.min(65, value)); // Inverter temp: 35-65°C
                } else if (type === 'powerProduction') {
                    value = Math.max(0, value); // Power: 0+ kWh
                } else if (type === 'powerConsumption') {
                    value = Math.max(0, value); // Consumption: 0+ kWh
                }
                
                data.push(Math.round(value * 100) / 100);
            }
            
            return { labels, data };
        }

        // Update chart with new data
        function updateChart(chartInstance, labels, data, siteId, period, type) {
            if (!chartInstance) return;
            
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            
            // Update dataset label based on site
            if (siteId === 'all') {
                if (type === 'power') {
                    chartInstance.data.datasets[0].label = `Total Power Output (kW)`;
                } else {
                    chartInstance.data.datasets[0].label = `Weighted Average ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                }
            } else {
                const siteName = siteId === 'cummins-midrand' ? 'Cummins Midrand' : 'FNB Willowbridge';
                chartInstance.data.datasets[0].label = `${siteName} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            }
            
            // Update chart title based on site and period
            if (siteId === 'all') {
                if (type === 'power') {
                    chartInstance.options.plugins.title.text = `Total Power Output - ${period.toUpperCase()}`;
                } else {
                    chartInstance.options.plugins.title.text = `Weighted Average ${type.charAt(0).toUpperCase() + type.slice(1)} - ${period.toUpperCase()}`;
                }
            } else {
                const siteName = siteId === 'cummins-midrand' ? 'Cummins Midrand' : 'FNB Willowbridge';
                chartInstance.options.plugins.title.text = `${siteName} ${type.charAt(0).toUpperCase() + type.slice(1)} - ${period.toUpperCase()}`;
            }
            
            chartInstance.update('active');
        }

        // Handle time period button clicks
        function setupChartTimeControls() {
            console.log('Setting up chart time controls...');
            const chartButtons = document.querySelectorAll('.chart-btn[data-period]');
            console.log('Found chart buttons:', chartButtons.length);
            
            chartButtons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('Chart button clicked:', this.getAttribute('data-period'));
                    
                    const period = this.getAttribute('data-period');
                    const chartContainer = this.closest('.chart-container');
                    
                    // Update active button
                    chartContainer.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Get current selected site
                    const selectedSiteId = document.getElementById('siteSelector').value;
                    
                    // Update the specific chart
                    updateChartsForPeriod(chartContainer, period, selectedSiteId);
                });
            });
        }

        // Update charts for specific period
        function updateChartsForPeriod(chartContainer, period, siteId) {
            const chartCanvas = chartContainer.querySelector('canvas');
            const chartId = chartCanvas.id;
            
            let chartType, chartInstance;
            if (chartId === 'efficiencyChartCanvas') {
                chartType = 'efficiency';
                chartInstance = efficiencyChartInstance;
            } else if (chartId === 'temperatureChartCanvas') {
                chartType = 'temperature';
                chartInstance = temperatureChartInstance;
            } else if (chartId === 'powerProductionChartCanvas') {
                chartType = 'powerProduction';
                chartInstance = powerProductionChartInstance;
            } else if (chartId === 'powerConsumptionChartCanvas') {
                chartType = 'powerConsumption';
                chartInstance = powerConsumptionChartInstance;
            }
            
            if (chartInstance && chartType) {
                const chartData = generateChartData(siteId, period, chartType);
                updateChart(chartInstance, chartData.labels, chartData.data, siteId, period, chartType);
            }
        }

        // Refresh Site data
        function refreshSiteData() {
            // Clear cache and regenerate (only when user explicitly refreshes)
            cachedSiteData = null;
            generateAndCacheSiteData();
            
            const selectedSiteId = document.getElementById('siteSelector').value;
            updatePerformanceDisplay(selectedSiteId);
            updatePerformanceCharts(selectedSiteId);
            
            // Simulate data refresh
            const refreshBtn = document.querySelector('[onclick="refreshSiteData()"]');
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '🔄 Refreshing...';
            refreshBtn.disabled = true;
            
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.disabled = false;
                alert('GPU data refreshed successfully!');
            }, 1500);
        }

        // Initialize chart controls
        function initializeChartControls() {
            document.querySelectorAll('.chart-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons in the same chart
                    const chartContainer = this.closest('.chart-container');
                    chartContainer.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                    
                    // Add active class to clicked button
                    this.classList.add('active');
                    
                    // Update chart data based on selected period
                    const period = this.getAttribute('data-period');
                    updateChartData(this.closest('.chart-container').querySelector('.chart-canvas'), period);
                });
            });
        }

        // Update chart data (simulated)
        function updateChartData(chartCanvas, period) {
            const placeholder = chartCanvas.querySelector('.chart-placeholder');
            if (placeholder) {
                placeholder.textContent = `📊 Loading ${period} data...`;
                
                // Simulate data loading
                setTimeout(() => {
                    placeholder.textContent = `📊 ${period} Chart Data Loaded`;
                }, 1000);
            }
        }

        // Start performance updates simulation
        function startPerformanceUpdates() {
            setInterval(() => {
                updatePerformanceMetrics();
            }, 5000); // Update every 5 seconds
        }

        // Update performance metrics (now handles both individual and average views)
        function updatePerformanceMetrics() {
            const selectedSiteId = document.getElementById('siteSelector').value;
            
            if (selectedSiteId === 'all') {
                // Update average metrics
                updateAverageMetrics();
            } else {
                // Update individual site metrics using cached data
                const selectedSite = getCachedSiteData(selectedSiteId);
                if (selectedSite) {
                    updateIndividualSiteMetrics(selectedSite);
                }
            }
        }
        
        
        
        
        // Note: Solar factor calculation removed - using fixed realistic data instead
        
        

        // Initialize alerts system
        function initializeAlerts() {
            // Check for new alerts periodically
            setInterval(() => {
                checkForNewAlerts();
            }, 10000); // Check every 10 seconds
        }

        // Check for new alerts (simulated)
        function checkForNewAlerts() {
            // Simulate random alerts
            if (Math.random() < 0.1) { // 10% chance of new alert
                const alertTypes = [
                    { type: 'warning', message: 'Low Solar Irradiance', icon: '⚠' },
                    { type: 'info', message: 'Inverter Efficiency Drop', icon: 'ℹ' },
                    { type: 'critical', message: 'Grid Connection Issue', icon: '!' },
                    { type: 'warning', message: 'Panel Cleaning Required', icon: '⚠' },
                    { type: 'info', message: 'Performance Report Available', icon: 'ℹ' }
                ];
                
                const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
                addNewAlert(randomAlert.type, randomAlert.message, randomAlert.icon);
            }
        }

        // Add new alert to the alerts section
        function addNewAlert(type, message, icon) {
            const alertsSection = document.querySelector('.alerts-section');
            if (!alertsSection) return;
            
            const alertList = alertsSection.querySelector('.alert-item').parentNode;
            const newAlert = document.createElement('div');
            newAlert.className = 'alert-item';
            newAlert.innerHTML = `
                <div class="alert-icon ${type}">${icon}</div>
                <div class="alert-content">
                    <div class="alert-title">${message} - ${Math.random() < 0.5 ? 'Cummins Midrand' : 'FNB Willowbridge'}</div>
                    <div class="alert-time">Just now</div>
                </div>
                <div class="alert-actions">
                    <button class="alert-btn acknowledge" onclick="acknowledgeAlert('${Date.now()}')">Acknowledge</button>
                    <button class="alert-btn resolve" onclick="resolveAlert('${Date.now()}')">Resolve</button>
                </div>
            `;
            
            // Insert at the top
            alertList.insertBefore(newAlert, alertList.firstChild);
            
            // Remove after 30 seconds if not acknowledged
            setTimeout(() => {
                if (newAlert.parentNode) {
                    newAlert.remove();
                }
            }, 30000);
        }

        // Alert management functions
        function acknowledgeAlert(alertId) {
            alert(`Alert ${alertId} acknowledged`);
            // In a real implementation, this would update the alert status in the backend
        }

        function resolveAlert(alertId) {
            alert(`Alert ${alertId} resolved`);
            // In a real implementation, this would mark the alert as resolved
        }

        // Sample maintenance data
        const maintenanceTasks = [
            {
                id: 'maint-001',
                title: 'Cummins Midrand - Panel Cleaning',
                site: 'Cummins Midrand',
                type: 'Panel Cleaning',
                status: 'scheduled',
                scheduledDate: '2024-12-15',
                estimatedDuration: '4 hours',
                priority: 'Medium',
                description: 'Routine panel cleaning and inspection for optimal performance'
            },
            {
                id: 'maint-002',
                title: 'FNB Willowbridge - Inverter Inspection',
                site: 'FNB Willowbridge',
                type: 'Inverter Inspection',
                status: 'completed',
                scheduledDate: '2024-12-10',
                estimatedDuration: '2 hours',
                priority: 'High',
                description: 'Quarterly inverter inspection and performance check'
            },
            {
                id: 'maint-003',
                title: 'Cummins Midrand - Preventive Maintenance',
                site: 'Cummins Midrand',
                type: 'Preventive Maintenance',
                status: 'in-progress',
                scheduledDate: '2024-12-12',
                estimatedDuration: '6 hours',
                priority: 'Low',
                description: 'Comprehensive preventive maintenance including all components'
            }
        ];

        // Sample driver data
        const driverInfo = [
            {
                name: 'NVIDIA Tesla V100 Driver',
                currentVersion: '535.86.10',
                latestVersion: '535.86.10',
                status: 'up-to-date',
                gpus: ['Tesla V100-01', 'Tesla V100-02']
            },
            {
                name: 'NVIDIA A100 Driver',
                currentVersion: '535.86.10',
                latestVersion: '535.86.10',
                status: 'up-to-date',
                gpus: ['A100-01', 'A100-02']
            }
        ];

        // Sample maintenance history
        const maintenanceHistory = [
            {
                date: '2024-12-10',
                site: 'FNB Willowbridge',
                action: 'Inverter Inspection',
                status: 'Completed',
                duration: '2h 15m',
                technician: 'John Smith'
            },
            {
                date: '2024-12-08',
                site: 'Cummins Midrand',
                action: 'Panel Cleaning',
                status: 'Completed',
                duration: '4h 30m',
                technician: 'Sarah Johnson'
            },
            {
                date: '2024-12-05',
                site: 'Cummins Midrand',
                action: 'Preventive Maintenance',
                status: 'Completed',
                duration: '6h 15m',
                technician: 'Mike Davis'
            },
            {
                date: '2024-11-28',
                site: 'FNB Willowbridge',
                action: 'System Inspection',
                status: 'Completed',
                duration: '3h 45m',
                technician: 'John Smith'
            }
        ];

        function loadMaintenance() {
            loadMaintenanceTasks();
            loadDriverManagement();
            loadMaintenanceHistory();
        }

        // Load maintenance tasks
        function loadMaintenanceTasks() {
            const maintenanceGrid = document.getElementById('maintenanceGrid');
            maintenanceGrid.innerHTML = '';

            maintenanceTasks.forEach(task => {
                const taskCard = createMaintenanceCard(task);
                maintenanceGrid.appendChild(taskCard);
            });
        }

        // Create maintenance card
        function createMaintenanceCard(task) {
            const card = document.createElement('div');
            card.className = 'maintenance-card';
            
            const statusClass = `status-${task.status}`;
            const statusText = task.status.charAt(0).toUpperCase() + task.status.slice(1);
            
            card.innerHTML = `
                <div class="maintenance-header">
                    <div class="maintenance-title">${task.title}</div>
                    <div class="maintenance-status ${statusClass}">${statusText}</div>
                </div>
                <div class="maintenance-details">
                    <div class="detail-row">
                        <span class="detail-label">Site:</span>
                        <span class="detail-value">${task.site}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${task.type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Scheduled:</span>
                        <span class="detail-value">${task.scheduledDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration:</span>
                        <span class="detail-value">${task.estimatedDuration}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Priority:</span>
                        <span class="detail-value">${task.priority}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">${task.description}</span>
                    </div>
                </div>
                <div class="maintenance-actions">
                    ${task.status === 'scheduled' ? 
                        `<button class="maintenance-btn primary" onclick="startMaintenance('${task.id}')">Start</button>
                         <button class="maintenance-btn secondary" onclick="rescheduleMaintenance('${task.id}')">Reschedule</button>` :
                        task.status === 'completed' ?
                        `<button class="maintenance-btn secondary" onclick="viewMaintenanceDetails('${task.id}')">View Details</button>` :
                        `<button class="maintenance-btn primary" onclick="retryMaintenance('${task.id}')">Retry</button>
                         <button class="maintenance-btn danger" onclick="cancelMaintenance('${task.id}')">Cancel</button>`
                    }
                </div>
            `;
            
            return card;
        }

        // Load driver management
        function loadDriverManagement() {
            const driverGrid = document.getElementById('driverGrid');
            driverGrid.innerHTML = '';

            driverInfo.forEach(driver => {
                const driverCard = createDriverCard(driver);
                driverGrid.appendChild(driverCard);
            });
        }

        // Create driver card
        function createDriverCard(driver) {
            const card = document.createElement('div');
            card.className = 'driver-card';
            
            card.innerHTML = `
                <div class="driver-name">${driver.name}</div>
                <div class="driver-version">Current: ${driver.currentVersion} | Latest: ${driver.latestVersion}</div>
                <div class="driver-status">
                    <span>Status: <strong>${driver.status}</strong></span>
                    <span>GPUs: ${driver.gpus.length}</span>
                </div>
                <div class="driver-actions">
                    <button class="driver-btn update" onclick="updateDriver('${driver.name}')">Update</button>
                    <button class="driver-btn rollback" onclick="rollbackDriver('${driver.name}')">Rollback</button>
                </div>
            `;
            
            return card;
        }

        // Load maintenance history
        function loadMaintenanceHistory() {
            const historyContainer = document.getElementById('maintenanceHistory');
            historyContainer.innerHTML = '';

            const historyTable = document.createElement('table');
            historyTable.style.width = '100%';
            historyTable.style.borderCollapse = 'collapse';
            historyTable.innerHTML = `
                <thead>
                    <tr style="background-color: var(--neutral-light);">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Date</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Site</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Action</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Status</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Duration</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-grey);">Technician</th>
                    </tr>
                </thead>
                <tbody>
                    ${maintenanceHistory.map(entry => `
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">${entry.date}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">${entry.site}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">${entry.action}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">
                                <span style="color: ${entry.status === 'Completed' ? 'var(--status-green)' : 'var(--status-red)'};">
                                    ${entry.status}
                                </span>
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">${entry.duration}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border-grey);">${entry.technician}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            
            historyContainer.appendChild(historyTable);
        }

        // Maintenance management functions
        function startMaintenance(taskId) {
            const task = maintenanceTasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'in-progress';
                loadMaintenanceTasks();
                alert(`Starting maintenance: ${task.title}`);
            }
        }

        function rescheduleMaintenance(taskId) {
            const task = maintenanceTasks.find(t => t.id === taskId);
            if (task) {
                const newDate = prompt('Enter new date (YYYY-MM-DD):', task.scheduledDate);
                if (newDate) {
                    task.scheduledDate = newDate;
                    loadMaintenanceTasks();
                    alert(`Maintenance rescheduled to: ${newDate}`);
                }
            }
        }

        function viewMaintenanceDetails(taskId) {
            const task = maintenanceTasks.find(t => t.id === taskId);
            if (task) {
                alert(`Maintenance Details:\n\nTask: ${task.title}\nSite: ${task.site}\nType: ${task.type}\nStatus: ${task.status}\nScheduled: ${task.scheduledDate}\nDuration: ${task.estimatedDuration}\nPriority: ${task.priority}\nDescription: ${task.description}`);
            }
        }

        function retryMaintenance(taskId) {
            const task = maintenanceTasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'scheduled';
                loadMaintenanceTasks();
                alert(`Maintenance retry scheduled: ${task.title}`);
            }
        }

        function cancelMaintenance(taskId) {
            const task = maintenanceTasks.find(t => t.id === taskId);
            if (task && confirm(`Cancel maintenance: ${task.title}?`)) {
                const index = maintenanceTasks.findIndex(t => t.id === taskId);
                maintenanceTasks.splice(index, 1);
                loadMaintenanceTasks();
                alert(`Maintenance cancelled: ${task.title}`);
            }
        }

        // Driver management functions
        function updateDriver(driverName) {
            alert(`Updating ${driverName}...\n\nThis will:\n- Download latest driver\n- Stop GPU services\n- Install new driver\n- Restart GPU services\n\nEstimated time: 10-15 minutes`);
        }

        function rollbackDriver(driverName) {
            if (confirm(`Rollback ${driverName} to previous version?`)) {
                alert(`Rolling back ${driverName}...\n\nThis will restore the previous driver version.`);
            }
        }

        function checkDriverUpdates() {
            alert('Checking for driver updates...\n\nAll drivers are up to date!');
        }

        // Configuration functions
        function saveConfiguration() {
            const config = {
                powerLimit: document.getElementById('powerLimit').value,
                tempThreshold: document.getElementById('tempThreshold').value,
                autoMaintenance: document.getElementById('autoMaintenance').value,
                maintenanceWindow: document.getElementById('maintenanceWindow').value,
                alertEmail: document.getElementById('alertEmail').value,
                backupRetention: document.getElementById('backupRetention').value
            };
            
            alert(`Configuration saved!\n\nPower Limit: ${config.powerLimit}%\nTemperature Threshold: ${config.tempThreshold}°C\nAuto Maintenance: ${config.autoMaintenance}\nMaintenance Window: ${config.maintenanceWindow}\nAlert Email: ${config.alertEmail}\nBackup Retention: ${config.backupRetention} days`);
        }

        function resetConfiguration() {
            if (confirm('Reset all configuration to defaults?')) {
                document.getElementById('powerLimit').value = 100;
                document.getElementById('tempThreshold').value = 85;
                document.getElementById('autoMaintenance').value = 'enabled';
                document.getElementById('maintenanceWindow').value = 'manual';
                document.getElementById('alertEmail').value = 'admin@asoba.co';
                document.getElementById('backupRetention').value = 30;
                alert('Configuration reset to defaults!');
            }
        }

        function loadAnalytics() {
            // Sample analytics data
            const analyticsData = [
                // Cummins Midrand inverters
                { serial: 'SMA-SB-001', type: 'String Inverter', oem: 'SMA', capacityFactor: '22%', costHour: '$0.15', revenueHour: '$2.85', energyAtRisk: 'Low', roi: '8.2%', uptime: '94.2%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-002', type: 'String Inverter', oem: 'SMA', capacityFactor: '18%', costHour: '$0.15', revenueHour: '$2.61', energyAtRisk: 'Low', roi: '7.8%', uptime: '91.5%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-003', type: 'String Inverter', oem: 'SMA', capacityFactor: '25%', costHour: '$0.15', revenueHour: '$2.67', energyAtRisk: 'Low', roi: '8.5%', uptime: '96.8%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-004', type: 'String Inverter', oem: 'SMA', capacityFactor: '28%', costHour: '$0.15', revenueHour: '$2.82', energyAtRisk: 'Low', roi: '9.1%', uptime: '97.3%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-005', type: 'String Inverter', oem: 'SMA', capacityFactor: '21%', costHour: '$0.15', revenueHour: '$2.73', energyAtRisk: 'Low', roi: '8.0%', uptime: '93.7%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-006', type: 'String Inverter', oem: 'SMA', capacityFactor: '19%', costHour: '$0.15', revenueHour: '$2.64', energyAtRisk: 'Low', roi: '7.6%', uptime: '89.4%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-007', type: 'String Inverter', oem: 'SMA', capacityFactor: '24%', costHour: '$0.15', revenueHour: '$2.79', energyAtRisk: 'Low', roi: '8.8%', uptime: '95.1%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-008', type: 'String Inverter', oem: 'SMA', capacityFactor: '20%', costHour: '$0.15', revenueHour: '$2.70', energyAtRisk: 'Low', roi: '7.9%', uptime: '92.6%', status: 'Active', site: 'cummins-midrand' },
                { serial: 'SMA-SB-009', type: 'String Inverter', oem: 'SMA', capacityFactor: '17%', costHour: '$0.15', revenueHour: '$2.58', energyAtRisk: 'Low', roi: '7.2%', uptime: '87.3%', status: 'Active', site: 'cummins-midrand' },
                // FNB Willowbridge inverters
                { serial: 'ABB-PVI-001', type: 'Central Inverter', oem: 'ABB', capacityFactor: '26%', costHour: '$0.25', revenueHour: '$1.90', energyAtRisk: 'Low', roi: '6.8%', uptime: '96.2%', status: 'Active', site: 'fnb-willowbridge' },
                { serial: 'ABB-PVI-002', type: 'Central Inverter', oem: 'ABB', capacityFactor: '23%', costHour: '$0.25', revenueHour: '$1.84', energyAtRisk: 'Low', roi: '6.4%', uptime: '94.7%', status: 'Active', site: 'fnb-willowbridge' }
            ];

            // Populate analytics table
            const tableBody = document.getElementById('analyticsTableBody');
            if (tableBody) {
                tableBody.innerHTML = '';
                analyticsData.forEach(inverter => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${inverter.serial}</td>
                        <td>${inverter.type}</td>
                        <td>${inverter.oem}</td>
                        <td><span class="capacity-factor-badge">${inverter.capacityFactor}</span></td>
                        <td>${inverter.costHour}</td>
                        <td>${inverter.revenueHour}</td>
                        <td><span class="risk-badge risk-${inverter.energyAtRisk.toLowerCase()}">${inverter.energyAtRisk}</span></td>
                        <td><span class="roi-badge">${inverter.roi}</span></td>
                        <td><span class="uptime-badge">${inverter.uptime}</span></td>
                        <td><span class="status-badge status-active">${inverter.status}</span></td>
                    `;
                    tableBody.appendChild(row);
                });
            }

            // Add event listeners for chart controls
            setupAnalyticsControls();
            
            // Wait for Chart.js to be available
            setTimeout(() => {
                console.log('Attempting to create charts...');
                updateEnergyAtRiskChart('30d');
                updateCapacityFactorChart('7d');
            }, 500);
        }

        function setupAnalyticsControls() {
            // Energy At Risk timeframe selector
            const energyAtRiskTimeframe = document.getElementById('energyAtRiskTimeframe');
            if (energyAtRiskTimeframe) {
                energyAtRiskTimeframe.addEventListener('change', function() {
                    updateEnergyAtRiskChart(this.value);
                });
            }

            // Capacity Factor timeframe selector
            const capacityFactorTimeframe = document.getElementById('capacityFactorTimeframe');
            if (capacityFactorTimeframe) {
                capacityFactorTimeframe.addEventListener('change', function() {
                    updateCapacityFactorChart(this.value);
                });
            }


            // Analytics filter
            const analyticsFilter = document.getElementById('analyticsFilter');
            if (analyticsFilter) {
                analyticsFilter.addEventListener('change', function() {
                    filterAnalyticsTable(this.value);
                });
            }

            // Export button
            const exportBtn = document.querySelector('.export-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', function() {
                    exportAnalyticsData();
                });
            }
        }

        let energyAtRiskChartInstance = null;
        let analyticsCapacityFactorChartInstance = null;

        function updateEnergyAtRiskChart(timeframe) {
            const canvas = document.getElementById('energyAtRiskChart');
            console.log('Energy At Risk chart canvas element:', canvas);
            
            if (!canvas) {
                console.error('Energy At Risk chart canvas element not found');
                return;
            }
            
            if (typeof canvas.getContext !== 'function') {
                console.error('Energy At Risk chart canvas element is not a proper canvas element');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                return;
            }
            
            console.log('Creating Energy At Risk chart with timeframe:', timeframe);
            
            // Destroy existing chart if it exists
            if (energyAtRiskChartInstance) {
                energyAtRiskChartInstance.destroy();
            }
            
            let labels, data;
            
            if (timeframe === '7d') {
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                data = [12, 8, 15, 6, 9, 11, 7]; // Energy at risk in kWh
            } else if (timeframe === '30d') {
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                data = [48, 32, 60, 24]; // Energy at risk in kWh
            } else if (timeframe === '90d') {
                labels = ['Month 1', 'Month 2', 'Month 3'];
                data = [144, 96, 180]; // Energy at risk in kWh
            }
            
            energyAtRiskChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Energy At Risk (kWh)',
                        data: data,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return '$' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        function updateCapacityFactorChart(timeframe) {
            const canvas = document.getElementById('capacityFactorChart');
            console.log('Capacity Factor chart canvas element:', canvas);
            
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            
            if (typeof canvas.getContext !== 'function') {
                console.error('Canvas element is not a proper canvas element');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                return;
            }
            
            console.log('Creating chart with timeframe:', timeframe);
            
            // Destroy existing chart if it exists
            if (analyticsCapacityFactorChartInstance) {
                analyticsCapacityFactorChartInstance.destroy();
            }
            
            let labels, data;
            
            if (timeframe === '24h') {
                labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
                data = [0, 0, 15, 35, 25, 5]; // Capacity factor (%) for solar
            } else if (timeframe === '7d') {
                labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
                data = [22, 18, 25, 20, 28, 15, 24]; // Capacity factor (%) for solar
            } else if (timeframe === '30d') {
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                data = [21, 24, 19, 22]; // Capacity factor (%) for solar
            }
            
            analyticsCapacityFactorChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Capacity Factor (%)',
                        data: data,
                        borderColor: '#455BF1',
                        backgroundColor: 'rgba(69, 91, 241, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#455BF1',
                        pointBorderColor: '#455BF1',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        fill: true,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    elements: {
                        point: {
                            hoverBackgroundColor: '#455BF1'
                        }
                    }
                }
            });
        }


        function filterAnalyticsTable(filter) {
            const tableBody = document.getElementById('analyticsTableBody');
            const rows = tableBody.querySelectorAll('tr');
            
            rows.forEach(row => {
                // Get the site from the data-site attribute or infer from serial number
                const serial = row.cells[0].textContent;
                let site = '';
                if (serial.includes('SMA-SB')) {
                    site = 'cummins-midrand';
                } else if (serial.includes('ABB-PVI')) {
                    site = 'fnb-willowbridge';
                }
                
                if (filter === 'all') {
                    row.style.display = '';
                } else if (filter === 'cummins-midrand' && site === 'cummins-midrand') {
                    row.style.display = '';
                } else if (filter === 'fnb-willowbridge' && site === 'fnb-willowbridge') {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        function exportAnalyticsData() {
            const table = document.querySelector('.analytics-table');
            const rows = Array.from(table.querySelectorAll('tr'));
            
            let csvContent = '';
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                const rowData = cells.map(cell => `"${cell.textContent.trim()}"`).join(',');
                csvContent += rowData + '\n';
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gpu-analytics.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        }

        // GPU management functions
        function viewGpuDetails(gpuId) {
            const gpu = gpuAssets.find(g => g.id === gpuId);
            if (gpu) {
                alert(`GPU Details:\n\nName: ${gpu.name}\nModel: ${gpu.model}\nLocation: ${gpu.location}\nStatus: ${gpu.status}\nUtilization: ${gpu.utilization}%\nTemperature: ${gpu.temperature}°C\nMemory: ${gpu.memory.used}GB / ${gpu.memory.total}GB\nPower: ${gpu.power}W\nActive Jobs: ${gpu.jobs.length}\nLast Maintenance: ${gpu.lastMaintenance}\nNext Maintenance: ${gpu.nextMaintenance}`);
            }
        }

        function manageGpu(gpuId) {
            const gpu = gpuAssets.find(g => g.id === gpuId);
            if (gpu) {
                alert(`Managing GPU: ${gpu.name}\n\nManagement options:\n- Schedule maintenance\n- Update drivers\n- Configure settings\n- View logs\n\nFull management interface coming soon...`);
            }
        }

        // Solar site management functions
        function viewSiteDetails(siteId) {
            const sites = {
                'cummins-midrand': {
                    name: 'Cummins Midrand',
                    type: 'Commercial',
                    capacity: '821.88 kW',
                    location: 'Corners Bridal Veil Road',
                    currentOutput: '0 kW',
                    efficiency: '0%',
                    inverters: 9,
                    status: 'Active',
                    lastMaintenance: '2024-09-15',
                    nextMaintenance: '2024-12-15'
                },
                'fnb-willowbridge': {
                    name: 'FNB Willowbridge',
                    type: 'Commercial',
                    capacity: '51.98 kW',
                    location: '61 Carl Cronje Drive',
                    currentOutput: '0 kW',
                    efficiency: '0%',
                    inverters: 2,
                    status: 'Active',
                    lastMaintenance: '2024-09-10',
                    nextMaintenance: '2024-12-10'
                }
            };
            
            const site = sites[siteId];
            if (!site) return;
            
            // Get current performance data
            const cachedData = getCachedSiteData(siteId);
            
            // Populate the dashboard site details modal
            document.getElementById('dashboardSiteName').textContent = site.name;
            document.getElementById('dashboardSiteType').textContent = site.type;
            document.getElementById('dashboardLocation').textContent = site.location;
            document.getElementById('dashboardCapacity').textContent = site.capacity;
            document.getElementById('dashboardInverters').textContent = site.inverters;
            document.getElementById('dashboardStatus').textContent = site.status;
            document.getElementById('dashboardLastMaintenance').textContent = site.lastMaintenance;
            document.getElementById('dashboardNextMaintenance').textContent = site.nextMaintenance;
            
            // Add current performance metrics
            if (cachedData) {
                document.getElementById('dashboardCurrentOutput').textContent = cachedData.power + ' kW';
                document.getElementById('dashboardEfficiency').textContent = cachedData.efficiency + '%';
                document.getElementById('dashboardUtilization').textContent = cachedData.utilization + '%';
                document.getElementById('dashboardTemperature').textContent = cachedData.temperature + '°C';
            } else {
                document.getElementById('dashboardCurrentOutput').textContent = '0 kW';
                document.getElementById('dashboardEfficiency').textContent = '0%';
                document.getElementById('dashboardUtilization').textContent = '0%';
                document.getElementById('dashboardTemperature').textContent = '25°C';
            }
            
            // Show the modal
            document.getElementById('dashboardSiteDetailsModal').style.display = 'flex';
        }

        function manageSite(siteId) {
            const sites = {
                'cummins-midrand': 'Cummins Midrand',
                'fnb-willowbridge': 'FNB Willowbridge'
            };
            
            const siteName = sites[siteId];
            if (!siteName) return;
            
            // Set the site name in the management modal
            document.getElementById('managementSiteName').textContent = siteName;
            
            // Reset form fields
            document.getElementById('managementAction').value = '';
            document.getElementById('managementPriority').value = '';
            document.getElementById('managementNotes').value = '';
            
            // Show the modal
            document.getElementById('dashboardSiteManagementModal').style.display = 'flex';
        }



        function startGpu(gpuId) {
            const gpu = gpuAssets.find(g => g.id === gpuId);
            if (gpu) {
                gpu.status = 'active';
                gpu.utilization = 0;
                gpu.temperature = 45;
                gpu.power = 50;
                loadDashboard();
                alert(`GPU "${gpu.name}" started successfully!`);
            }
        }

        function stopGpu(gpuId) {
            const gpu = gpuAssets.find(g => g.id === gpuId);
            if (gpu) {
                gpu.status = 'idle';
                gpu.utilization = 0;
                gpu.temperature = 35;
                gpu.power = 20;
                gpu.jobs = [];
                loadDashboard();
                alert(`GPU "${gpu.name}" stopped successfully!`);
            }
        }

        // Initialize navigation and all event listeners
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers to nav buttons
            document.querySelectorAll('.nav-button').forEach(button => {
                button.addEventListener('click', function() {
                    const sectionId = this.getAttribute('data-section');
                    switchSection(sectionId);
                });
            });
            
            // Handle maintenance form submission
            const maintenanceForm = document.getElementById('maintenanceForm');
            if (maintenanceForm) {
                maintenanceForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const gpuId = this.getAttribute('data-gpu-id');
                    const gpu = gpuAssets.find(g => g.id === gpuId);
                    
                    const taskData = {
                        id: 'maint-' + Date.now(),
                        title: `${document.getElementById('maintenanceType').value.charAt(0).toUpperCase() + document.getElementById('maintenanceType').value.slice(1)} - ${gpu.name}`,
                        type: document.getElementById('maintenanceType').value.charAt(0).toUpperCase() + document.getElementById('maintenanceType').value.slice(1),
                        scheduledDate: document.getElementById('maintenanceDate').value,
                        estimatedDuration: document.getElementById('maintenanceDuration').value,
                        priority: document.getElementById('maintenancePriority').value.charAt(0).toUpperCase() + document.getElementById('maintenancePriority').value.slice(1),
                        description: document.getElementById('maintenanceDescription').value,
                        technician: document.getElementById('maintenanceTechnician').value
                    };
                    
                    // Add to maintenance tasks
                    maintenanceTasks.push(taskData);
                    
                    // Refresh maintenance display
                    loadMaintenanceTasks();
                    
                    // Close modal and show success
                    closeMaintenanceModal();
                    alert(`Maintenance task created successfully!\n\nTask: ${taskData.title}\nDate: ${new Date(taskData.scheduledDate).toLocaleDateString()}\nTechnician: ${taskData.technician}`);
                });
            }
            
            // Close modal when clicking outside
            const maintenanceModal = document.getElementById('maintenanceModal');
            if (maintenanceModal) {
                maintenanceModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeMaintenanceModal();
                    }
                });
            }
            
            // Handle Add Site form submission
            const addSiteForm = document.getElementById('addSiteForm');
            if (addSiteForm) {
                addSiteForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    // Check if connection was tested successfully
                    const testBtn = document.getElementById('testSiteConnectionBtn');
                    if (testBtn.textContent !== '✅ Connection Successful') {
                        alert('Please test the connection first before adding the site to inventory.');
                        return;
                    }
                    
                    const siteData = {
                        id: 'site-' + String(siteAssets.length + 1).padStart(3, '0'),
                        name: document.getElementById('siteName').value,
                        type: document.getElementById('siteType').value,
                        location: document.getElementById('siteLocation').value,
                        capacity: parseFloat(document.getElementById('siteCapacity').value),
                        inverterCount: parseInt(document.getElementById('inverterCount').value),
                        commissionDate: document.getElementById('commissionDate').value,
                        panelCount: parseInt(document.getElementById('panelCount').value),
                        panelWattage: parseInt(document.getElementById('panelWattage').value),
                        inverterBrand: document.getElementById('inverterBrand').value,
                        gridConnection: document.getElementById('gridConnection').value,
                        notes: document.getElementById('siteNotes').value,
                        status: 'active',
                        utilization: 0,
                        temperature: 25,
                        power: 0,
                        efficiency: 0
                    };
                    
                    // Add to site assets
                    siteAssets.push(siteData);
                    
                    // Refresh inventory display
                    loadInventoryCards();
                    
                    // Close modal and show success
                    closeAddSiteModal();
                    
                    alert(`Site "${siteData.name}" added to inventory successfully!\n\nStatus: ${siteData.status}\nCapacity: ${siteData.capacity} kW\nLocation: ${siteData.location}\nInverters: ${siteData.inverterCount}`);
                });
            }
            
            // Close Add Site modal when clicking outside
            const addSiteModal = document.getElementById('addSiteModal');
            if (addSiteModal) {
                addSiteModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeAddSiteModal();
                    }
                });
            }
            
            // Close Site Details modal when clicking outside
            const siteDetailsModal = document.getElementById('siteDetailsModal');
            if (siteDetailsModal) {
                siteDetailsModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeSiteDetailsModal();
                    }
                });
            }
            
            // Close Site Maintenance modal when clicking outside
            const siteMaintenanceModal = document.getElementById('siteMaintenanceModal');
            if (siteMaintenanceModal) {
                siteMaintenanceModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeSiteMaintenanceModal();
                    }
                });
            }
            
            // Handle Site Maintenance form submission
            const siteMaintenanceForm = document.getElementById('siteMaintenanceForm');
            if (siteMaintenanceForm) {
                siteMaintenanceForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const formData = {
                        siteName: document.getElementById('maintenanceSiteName').value,
                        type: document.getElementById('siteMaintenanceType').value,
                        date: document.getElementById('siteMaintenanceDate').value,
                        priority: document.getElementById('siteMaintenancePriority').value,
                        duration: document.getElementById('siteMaintenanceDuration').value,
                        technician: document.getElementById('siteMaintenanceTechnician').value,
                        description: document.getElementById('siteMaintenanceDescription').value
                    };
                    
                    // Validate required fields
                    if (!formData.type || !formData.date || !formData.priority || !formData.duration || !formData.technician) {
                        alert('Please fill in all required fields.');
                        return;
                    }
                    
                    // Create maintenance task
                    const taskId = 'maint-' + Date.now();
                    const maintenanceTask = {
                        id: taskId,
                        title: `${formData.siteName} - ${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}`,
                        site: formData.siteName,
                        type: formData.type.charAt(0).toUpperCase() + formData.type.slice(1),
                        scheduledDate: formData.date,
                        priority: formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1),
                        estimatedDuration: formData.duration + ' hours',
                        description: formData.description,
                        status: 'scheduled',
                        technician: formData.technician,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Add to maintenance tasks array
                    maintenanceTasks.push(maintenanceTask);
                    
                    // Refresh maintenance display
                    loadMaintenanceTasks();
                    
                    // Close modal and show success
                    closeSiteMaintenanceModal();
                    alert(`Maintenance task scheduled successfully!\n\nSite: ${formData.siteName}\nType: ${maintenanceTask.type}\nDate: ${new Date(formData.date).toLocaleDateString()}\nTechnician: ${formData.technician}\nDuration: ${formData.duration} hours`);
                });
            }
            
            // Dashboard modal event listeners
            const dashboardSiteDetailsModal = document.getElementById('dashboardSiteDetailsModal');
            if (dashboardSiteDetailsModal) {
                dashboardSiteDetailsModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeDashboardSiteDetailsModal();
                    }
                });
            }
            
            const dashboardSiteManagementModal = document.getElementById('dashboardSiteManagementModal');
            if (dashboardSiteManagementModal) {
                dashboardSiteManagementModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeDashboardSiteManagementModal();
                    }
                });
            }
            
            const dashboardManagementForm = document.getElementById('dashboardManagementForm');
            if (dashboardManagementForm) {
                dashboardManagementForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const formData = {
                        action: document.getElementById('managementAction').value,
                        priority: document.getElementById('managementPriority').value,
                        notes: document.getElementById('managementNotes').value
                    };
                    
                    // Execute management action (placeholder)
                    console.log('Management action executed:', formData);
                    
                    // Close modal and show success
                    closeDashboardSiteManagementModal();
                    alert(`Management action executed successfully!\n\nAction: ${formData.action}\nPriority: ${formData.priority}\nNotes: ${formData.notes || 'None'}`);
                });
            }
            
            // Site Components modal event listeners
            const siteComponentsModal = document.getElementById('siteComponentsModal');
            if (siteComponentsModal) {
                siteComponentsModal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        closeSiteComponentsModal();
                    }
                });
            }
            
            // Initialize with dashboard
            switchSection('dashboard');
            
            // Animate metrics on load
            animateMetrics();
        });

        // Animate metrics
        function animateMetrics() {
            const metrics = document.querySelectorAll('.metric-value');
            metrics.forEach(metric => {
                const finalValue = metric.textContent;
                const isNumeric = !isNaN(finalValue.replace(/[^\d.]/g, ''));
                
                if (isNumeric) {
                    const numericValue = parseFloat(finalValue.replace(/[^\d.]/g, ''));
                    let currentValue = 0;
                    const increment = numericValue / 30;
                    const timer = setInterval(() => {
                        currentValue += increment;
                        if (currentValue >= numericValue) {
                            currentValue = numericValue;
                            clearInterval(timer);
                        }
                        metric.textContent = finalValue.replace(/[\d,]+/, Math.round(currentValue).toLocaleString());
                    }, 50);
                }
            });
        }
