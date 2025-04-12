import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import { RouteAlert, AlertType, Region, isAlertActive, formatDistance } from '../../models/RouteAlert';
import DataLoader from '../../services/DataLoaderService';
import CelestialIdMappingService from '../../services/CelestialIdMappingService';
import './AlertList.css';

// Debug logger
const DEBUG = false;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[AlertList]', ...args);
};

interface AlertListProps {
  activeRegion: Region | null;
  activeShard: number | null;
}

const AlertList: React.FC<AlertListProps> = ({ activeRegion, activeShard }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AlertType | 'all'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Local cache for direct celestial name mappings
  const [directNameMap, setDirectNameMap] = useState<Record<string, string>>({});
  const [mappingInitialized, setMappingInitialized] = useState(false);
  const [unmappedIds, setUnmappedIds] = useState<Set<string>>(new Set());
  const [mappingStats, setMappingStats] = useState({
    total: 0,
    resolved: 0,
    failed: 0
  });
  
  // Add debug panel that can be toggled
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Helper function to process IDs and extract names
  const processIdForNameMapping = (id: string, nameMap: Record<string, string>): Record<string, string> => {
    if (!id || nameMap[id]) return nameMap; // Skip if no ID or already mapped
    
    const knownNames = [
      'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
      'ariel', 'aberdeen', 'magda', 'ita', 
      'cellin', 'daymar', 'yela',
      'lyria', 'wala',
      'calliope', 'clio', 'euterpe'
    ];
    
    const lowerId = id.toLowerCase();
    for (const name of knownNames) {
      if (lowerId.includes(name)) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Create a copy to avoid modifying the input map
        const updatedMap = {...nameMap};
        updatedMap[id] = capitalizedName;
        
        // Also add to service
        CelestialIdMappingService.addAlertIdMapping(id, capitalizedName);
        
        return updatedMap;
      }
    }
    
    return nameMap; // Return unchanged if no match found
  };
  
  // Process all IDs in an alert to extract names
  const processAlertForNameMapping = (alert: RouteAlert, nameMap: Record<string, string>): Record<string, string> => {
    let updatedMap = {...nameMap};
    
    // Process origin ID
    if (alert.originId) {
      updatedMap = processIdForNameMapping(alert.originId, updatedMap);
      
      // Also add the mapping to the service if we found a name in our local map
      if (updatedMap[alert.originId]) {
        CelestialIdMappingService.addAlertIdMapping(alert.originId, updatedMap[alert.originId]);
      }
    }
    
    // Process destination ID
    if (alert.destinationId) {
      updatedMap = processIdForNameMapping(alert.destinationId, updatedMap);
      
      // Also add the mapping to the service if we found a name in our local map
      if (updatedMap[alert.destinationId]) {
        CelestialIdMappingService.addAlertIdMapping(alert.destinationId, updatedMap[alert.destinationId]);
      }
    }
    
    // Process location ID
    if (alert.locationId) {
      updatedMap = processIdForNameMapping(alert.locationId, updatedMap);
      
      // Also add the mapping to the service if we found a name in our local map
      if (updatedMap[alert.locationId]) {
        CelestialIdMappingService.addAlertIdMapping(alert.locationId, updatedMap[alert.locationId]);
      }
    }
    
    return updatedMap;
  };
  
  // Load celestial name mapping
  useEffect(() => {
    let isMounted = true;
    
    const loadNameMapping = async () => {
      try {
        console.log("[AlertList] Initializing celestial mapping service...");
        // Load celestial data for name resolution
        const celestialData = await DataLoader.loadCelestialSystem();
        
        // Create a direct mapping from IDs to names
        const directNameMap: Record<string, string> = {};
        
        if (celestialData && celestialData.celestialBodies) {
          celestialData.celestialBodies.forEach(body => {
            // Skip empty or invalid data
            if (!body.id || !body.name) return;
            
            // Store in both the mapping service and our local map
            CelestialIdMappingService.addAlertIdMapping(body.id, body.name);
            directNameMap[body.id] = body.name;
          });
        }
        
        if (celestialData && celestialData.pointsOfInterest) {
          celestialData.pointsOfInterest.forEach(poi => {
            // Skip empty or invalid data
            if (!poi.id || !poi.name) return;
            
            // Store in both the mapping service and our local map
            CelestialIdMappingService.addAlertIdMapping(poi.id, poi.name);
            directNameMap[poi.id] = poi.name;
          });
        }
        
        if (isMounted) {
          setDirectNameMap(directNameMap);
          setMappingInitialized(true);
          log("Created celestial name mapping with", Object.keys(directNameMap).length, "entries");
          console.log("[AlertList] Mapping service initialized successfully with", 
                    Object.keys(directNameMap).length, "direct mappings");
        }
      } catch (err) {
        console.error("[AlertList] Error loading celestial name mapping:", err);
        
        // Even on error, mark as initialized so we can proceed with what we have
        if (isMounted) {
          setMappingInitialized(true);
        }
      }
    };
    
    loadNameMapping();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Function to get celestial name directly without dependency on service
  const localGetCelestialName = (id: string | undefined): string => {
    if (!id) return 'Unknown';
    
    // Track total attempts
    setMappingStats(prev => ({...prev, total: prev.total + 1}));
    
    // First check our direct map
    if (directNameMap[id]) {
      setMappingStats(prev => ({...prev, resolved: prev.resolved + 1}));
      return directNameMap[id];
    }
    
    // Fallback to service
    const serviceName = CelestialIdMappingService.getNameFromId(id);
    if (serviceName !== id) {
      // Cache this successful resolution for future
      setDirectNameMap(prevMap => ({
        ...prevMap,
        [id]: serviceName
      }));
      setMappingStats(prev => ({...prev, resolved: prev.resolved + 1}));
      return serviceName;
    }
    
    // Try advanced UUID pattern matching for regional naming conventions
    // For example: hurston-123e4567-e89b-12d3-a456-426614174000
    const uuidMatch = id.match(/^([a-z]+)[-_]([0-9a-f]{8}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{12})/i);
    if (uuidMatch && uuidMatch[1]) {
      const extractedName = uuidMatch[1].charAt(0).toUpperCase() + uuidMatch[1].slice(1);
      
      // Cache this successful resolution for future
      setDirectNameMap(prevMap => ({
        ...prevMap,
        [id]: extractedName
      }));
      
      // Also add to service
      CelestialIdMappingService.addAlertIdMapping(id, extractedName);
      setMappingStats(prev => ({...prev, resolved: prev.resolved + 1}));
      
      return extractedName;
    }
    
    // Try heuristic name extraction
    const extractedName = tryExtractNameFromId(id);
    if (extractedName) {
      // Cache this successful resolution for future
      setDirectNameMap(prevMap => ({
        ...prevMap,
        [id]: extractedName
      }));
      
      // Also add to service
      CelestialIdMappingService.addAlertIdMapping(id, extractedName);
      setMappingStats(prev => ({...prev, resolved: prev.resolved + 1}));
      
      return extractedName;
    }
    
    // Record failed mapping attempt
    setUnmappedIds(prev => new Set(prev).add(id));
    setMappingStats(prev => ({...prev, failed: prev.failed + 1}));
    
    // No name found, return the original ID with logging
    console.error(`[AlertList] Failed to resolve name for ID: ${id}`);
    return id;
  };

  // Fetch alerts when region/shard filter changes
  useEffect(() => {
    let isMounted = true;
    
    const fetchAlerts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Create filter options based on selected region, shard, and type
        const filterOptions: any = {};
        if (activeRegion) filterOptions.region = activeRegion;
        if (activeShard) filterOptions.shard = activeShard;
        if (selectedType !== 'all') filterOptions.type = selectedType;
        
        log("Fetching alerts with filters:", filterOptions);
        const data = await RouteAlertService.getAlerts(filterOptions);
        log("Received alerts:", data);
        
        if (isMounted) {
          // Process alerts for name mapping
          let newNameMap = {...directNameMap};
          
          // Process each alert to build the name map
          data.forEach(alert => {
            newNameMap = processAlertForNameMapping(alert, newNameMap);
          });
          
          // Update the name map with new mappings
          if (Object.keys(newNameMap).length > Object.keys(directNameMap).length) {
            log("Updated name mappings:", newNameMap);
            setDirectNameMap(newNameMap);
          }
          
          // Sort by activity volume (confirmations + disputes) first, then by recency
          const sortedAlerts = [...data].sort((a, b) => {
            const aVolume = a.confirmations + a.disputes;
            const bVolume = b.confirmations + b.disputes;
            
            // First sort by activity volume
            if (aVolume !== bVolume) {
              return bVolume - aVolume; // Higher volume first
            }
            
            // Then by recency
            return b.lastActivity.getTime() - a.lastActivity.getTime();
          });
          
          log("Sorted alerts:", sortedAlerts);
          setAlerts(sortedAlerts);
          
          // Run validation of alert mappings after loading
          setTimeout(() => {
            if (isMounted) {
              console.log('[AlertList] Auto-validating alert mappings after load');
              // Auto-validate all alert mappings on initial load
              // This will update our stats and identify problem IDs
              
              let total = 0;
              let resolved = 0;
              let failed = 0;
              let unmapped = new Set<string>();
              
              sortedAlerts.forEach(alert => {
                // Check all IDs in this alert
                [alert.originId, alert.destinationId, alert.locationId].filter(Boolean).forEach(id => {
                  if (!id) return;
                  
                  total++;
                  
                  // Check if we have a mapping for this ID
                  const name = localGetCelestialName(id);
                  if (name === id) {
                    failed++;
                    unmapped.add(id);
                    console.log(`[AlertList] Unmapped ID: ${id}`);
                  } else {
                    resolved++;
                  }
                });
              });
              
              // Update stats with the results
              setMappingStats({
                total,
                resolved,
                failed
              });
              
              // Update unmapped IDs
              setUnmappedIds(unmapped);
              
              console.log(`[AlertList] Validation results: ${resolved}/${total} resolved (${Math.round((resolved/total)*100)}% success rate)`);
            }
          }, 1000);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load alerts. Please try again.');
          console.error('Error fetching alerts:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchAlerts();
    
    // Set up real-time updates with the same filters
    const unsubscribe = RouteAlertService.subscribeToAlerts((updatedAlerts) => {
      if (isMounted) {
        log("Real-time alert update received:", updatedAlerts.length, "alerts");
        
        // Process alerts for name mapping
        let newNameMap = {...directNameMap};
        
        // Process each alert to build the name map
        updatedAlerts.forEach(alert => {
          newNameMap = processAlertForNameMapping(alert, newNameMap);
        });
        
        // Update the name map only if new mappings were added
        if (Object.keys(newNameMap).length > Object.keys(directNameMap).length) {
          log("Updated name mappings from real-time updates:", newNameMap);
          setDirectNameMap(newNameMap);
        }
        
        // Sort by activity volume (confirmations + disputes) first, then by recency
        const sortedAlerts = [...updatedAlerts].sort((a, b) => {
          const aVolume = a.confirmations + a.disputes;
          const bVolume = b.confirmations + b.disputes;
          
          // First sort by activity volume
          if (aVolume !== bVolume) {
            return bVolume - aVolume; // Higher volume first
          }
          
          // Then by recency
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
        
        setAlerts(sortedAlerts);
        setIsLoading(false);
      }
    }, { 
      region: activeRegion || undefined, 
      shard: activeShard || undefined,
      type: selectedType !== 'all' ? selectedType : undefined
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeRegion, activeShard, selectedType]);
  
  const handleTypeFilter = (type: AlertType | 'all') => {
    setSelectedType(type);
  };
  
  const handleConfirmAlert = async (alertId: string) => {
    try {
      if (!isAuthenticated) {
        // Redirect to login or show login prompt
        return;
      }
      
      await RouteAlertService.confirmAlert(alertId);
      // Alert list will update automatically via subscription
    } catch (err) {
      console.error('Error confirming alert:', err);
    }
  };
  
  const handleDisputeAlert = async (alertId: string) => {
    try {
      if (!isAuthenticated) {
        // Redirect to login or show login prompt
        return;
      }
      
      await RouteAlertService.disputeAlert(alertId);
      // Alert list will update automatically via subscription
    } catch (err) {
      console.error('Error disputing alert:', err);
    }
  };
  
  const renderAlertTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  useEffect(() => {
    // Self-test: log alert IDs and their resolved names when alerts change
    if (alerts.length > 0 && DEBUG) {
      console.log("=== SELF-TEST: Alert ID to Name Mapping ===");
      alerts.forEach(alert => {
        // Test origin ID
        if (alert.originId) {
          const resolvedName = localGetCelestialName(alert.originId);
          console.log(`Origin ID: ${alert.originId} => ${resolvedName}`);
          if (resolvedName === alert.originId || resolvedName.includes('...')) {
            console.error(`FAILED: Origin ID ${alert.originId} not resolved properly`);
          } else {
            console.log(`PASSED: Origin ID ${alert.originId} resolved to ${resolvedName}`);
          }
        }
        
        // Test destination ID
        if (alert.destinationId) {
          const resolvedName = localGetCelestialName(alert.destinationId);
          console.log(`Destination ID: ${alert.destinationId} => ${resolvedName}`);
          if (resolvedName === alert.destinationId || resolvedName.includes('...')) {
            console.error(`FAILED: Destination ID ${alert.destinationId} not resolved properly`);
          } else {
            console.log(`PASSED: Destination ID ${alert.destinationId} resolved to ${resolvedName}`);
          }
        }
        
        // Test location ID
        if (alert.locationId) {
          const resolvedName = localGetCelestialName(alert.locationId);
          console.log(`Location ID: ${alert.locationId} => ${resolvedName}`);
          if (resolvedName === alert.locationId || resolvedName.includes('...')) {
            console.error(`FAILED: Location ID ${alert.locationId} not resolved properly`);
          } else {
            console.log(`PASSED: Location ID ${alert.locationId} resolved to ${resolvedName}`);
          }
        }
      });
      console.log("=== END SELF-TEST ===");
    }
  }, [alerts, localGetCelestialName]);
  
  // Function to try to extract a meaningful name from an ID string
  const tryExtractNameFromId = (id: string): string | null => {
    if (!id) return null;
    
    // Common celestial body names
    const celestialNames = [
      'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
      'ariel', 'aberdeen', 'magda', 'ita', 
      'cellin', 'daymar', 'yela',
      'lyria', 'wala',
      'calliope', 'clio', 'euterpe'
    ];
    
    // Check if ID contains any known celestial name
    const lowerId = id.toLowerCase();
    for (const name of celestialNames) {
      if (lowerId.includes(name)) {
        // Capitalize first letter for display
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    
    // Check if the ID follows a name-uuid pattern
    const parts = id.split('-');
    if (parts.length > 1 && parts[0].length > 2) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    
    return null;
  };
  
  // Memoize the getDisplayId function to avoid state update loops
  const getDisplayId = useCallback((id: string | undefined): string => {
    if (!id) return 'Unknown';
    
    // Handle specific known UUIDs from logs
    const knownUuidMappings: Record<string, string> = {
      // Based on logs
      '8af309da-4560-48df-8223-ddd02c016fb3': 'Stanton',
      '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': 'Hurston',
      '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': 'Crusader',
      'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': 'ArcCorp',
      'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': 'microTech',
      'd191779b-ac62-4c84-90a5-7721aefb97c4': 'Hurston Area',
      'b3557a17-1d2d-4b7b-92ef-5e20445b10ea': 'MicroTech Orbit',
      '8e38ba99-f1cd-49df-bc4e-5ef9309b511f': 'ArcCorp City'
    };
    
    // Check our direct emergency mapping first - without state updates
    if (knownUuidMappings[id]) {
      // Log what we're doing (logging doesn't cause re-renders)
      console.log(`🔍 EMERGENCY MAPPING: ${id} → hardcoded to → ${knownUuidMappings[id]}`);
      return knownUuidMappings[id];
    }
    
    // First check our direct map
    if (directNameMap[id]) {
      return directNameMap[id];
    }
    
    // Then try the mapping service
    const serviceName = CelestialIdMappingService.getNameFromId(id);
    
    if (serviceName !== id) {
      return serviceName;
    }
    
    // Try to extract name patterns from ID
    const extractedName = tryExtractNameFromId(id);
    if (extractedName) {
      return extractedName;
    }
    
    // No name resolution available, return ID
    return id;
  }, [directNameMap, tryExtractNameFromId]);
  
  // Process emergency mappings separately after render
  useEffect(() => {
    // Process all alerts through our emergency mappings
    // This runs after rendering is complete
    if (alerts.length > 0) {
      const knownUuidMappings: Record<string, string> = {
        '8af309da-4560-48df-8223-ddd02c016fb3': 'Stanton',
        '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': 'Hurston',
        '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': 'Crusader',
        'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': 'ArcCorp',
        'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': 'microTech',
        'd191779b-ac62-4c84-90a5-7721aefb97c4': 'Hurston Area',
        'b3557a17-1d2d-4b7b-92ef-5e20445b10ea': 'MicroTech Orbit',
        '8e38ba99-f1cd-49df-bc4e-5ef9309b511f': 'ArcCorp City'
      };
      
      // Update mapping state once for all matched IDs
      let newDirectNameMap = {...directNameMap};
      let totalResolved = 0;
      let totalFailed = 0;
      let newUnmapped = new Set<string>(unmappedIds);
      let madeChanges = false;
      
      // Process all possible IDs from all alerts to collect updates
      const processIds = new Set<string>();
      alerts.forEach(alert => {
        if (alert.originId) processIds.add(alert.originId);
        if (alert.destinationId) processIds.add(alert.destinationId);
        if (alert.locationId) processIds.add(alert.locationId);
      });
      
      // Process each unique ID
      processIds.forEach(id => {
        if (!id) return;
        
        // Already in our map - skip
        if (directNameMap[id]) return;
        
        // Emergency mapping
        if (knownUuidMappings[id]) {
          newDirectNameMap[id] = knownUuidMappings[id];
          CelestialIdMappingService.addAlertIdMapping(id, knownUuidMappings[id]);
          totalResolved++;
          madeChanges = true;
          return;
        }
        
        // Try the mapping service
        const serviceName = CelestialIdMappingService.getNameFromId(id);
        if (serviceName !== id) {
          newDirectNameMap[id] = serviceName;
          totalResolved++;
          madeChanges = true;
          return;
        }
        
        // Try to extract name patterns from ID
        const extractedName = tryExtractNameFromId(id);
        if (extractedName) {
          newDirectNameMap[id] = extractedName;
          CelestialIdMappingService.addAlertIdMapping(id, extractedName);
          totalResolved++;
          madeChanges = true;
          return;
        }
        
        // No resolution - track as unmapped
        newUnmapped.add(id);
        totalFailed++;
        madeChanges = true;
      });
      
      // Only update state if we made changes
      if (madeChanges) {
        console.log(`[AlertList] Batch updated ${totalResolved} mappings, ${totalFailed} failed`);
        setDirectNameMap(newDirectNameMap);
        setUnmappedIds(newUnmapped);
        setMappingStats(prev => ({
          total: prev.total + totalResolved + totalFailed,
          resolved: prev.resolved + totalResolved,
          failed: prev.failed + totalFailed
        }));
      }
    }
  }, [alerts, directNameMap, unmappedIds, tryExtractNameFromId]);
  
  // Process the alert to display IDs directly
  const processAlertForDisplay = (alert: any): void => {
    // No mapping or transforms - just direct display of IDs
    if (DEBUG) {
      console.log(`[AlertList] Processing alert: ${alert.id}, Origin: ${alert.originId}, Destination: ${alert.destinationId || alert.locationId || 'Unknown'}`);
    }
  };
  
  // Keyboard shortcut for debug panel (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Function that validates all alert IDs to see if they can be mapped
  const validateAllAlertMappings = useCallback(() => {
    console.log('[AlertList] Validating all alert mappings...');
    
    // Reset stats for new validation
    setMappingStats({
      total: 0,
      resolved: 0,
      failed: 0
    });
    
    // Clear unmapped IDs set
    setUnmappedIds(new Set());
    
    // Process all alerts and verify mapping
    alerts.forEach(alert => {
      // Check if origin ID can be mapped
      if (alert.originId) {
        const resolvedName = getDisplayId(alert.originId);
        if (resolvedName === alert.originId) {
          console.error(`[AlertList] Mapping failed for origin ID: ${alert.originId}`);
        }
      }
      
      // Check if destination ID can be mapped
      if (alert.destinationId) {
        const resolvedName = getDisplayId(alert.destinationId);
        if (resolvedName === alert.destinationId) {
          console.error(`[AlertList] Mapping failed for destination ID: ${alert.destinationId}`);
        }
      }
      
      // Check if location ID can be mapped
      if (alert.locationId) {
        const resolvedName = getDisplayId(alert.locationId);
        if (resolvedName === alert.locationId) {
          console.error(`[AlertList] Mapping failed for location ID: ${alert.locationId}`);
        }
      }
    });
    
    console.log('[AlertList] Validation complete. Success rate:', 
                Math.round((mappingStats.resolved / mappingStats.total) * 100), '%');
  }, [alerts, getDisplayId, mappingStats.resolved, mappingStats.total]);
  
  // Add debug logging for alert IDs and their mapping results
  useEffect(() => {
    if (alerts.length > 0) {
      console.log('===== ALERT ID MAPPING DEBUG =====');
      alerts.forEach(alert => {
        if (alert.type === 'interdiction') {
          console.log(`🔍 ORIGIN ID DEBUG: ${alert.originId} → resolved to → ${getDisplayId(alert.originId)}`);
          console.log(`🔍 DEST ID DEBUG: ${alert.destinationId} → resolved to → ${getDisplayId(alert.destinationId)}`);
        } else {
          console.log(`🔍 LOCATION ID DEBUG: ${alert.locationId || alert.destinationId} → resolved to → ${getDisplayId(alert.locationId || alert.destinationId)}`);
        }
      });
      console.log('==================================');
    }
  }, [alerts, getDisplayId]);
  
  return (
    <div className={`alert-list-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="alert-list-header" onClick={toggleCollapse}>
        <div className="header-title">
          <h2>Activity Alerts</h2>
          <span className="collapse-icon">{isCollapsed ? '>' : '<'}</span>
        </div>
        
        {!isCollapsed && (
          <div className="alert-type-filters">
            <button 
              className={`type-filter-btn ${selectedType === 'all' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTypeFilter('all');
              }}
            >
              All
            </button>
            <button 
              className={`type-filter-btn ${selectedType === 'interdiction' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTypeFilter('interdiction');
              }}
            >
              Interdiction
            </button>
            <button 
              className={`type-filter-btn ${selectedType === 'pvp' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTypeFilter('pvp');
              }}
            >
              PvP
            </button>
          </div>
        )}
      </div>
      
      {!isCollapsed && (
        <>
          {isLoading ? (
            <div className="alert-list-loading">
              <span className="loading-spinner"></span>
              <p>Loading alerts...</p>
            </div>
          ) : error ? (
            <div className="alert-list-error">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="alert-list-empty">
              <p>No alerts found for the selected filters.</p>
              {isAuthenticated && (
                <Link to="/create-alert" className="create-alert-btn">
                  Create Alert
                </Link>
              )}
            </div>
          ) : (
            <div className="alert-list">
              {alerts.map(alert => (
                <Link key={alert.id} to={`/alert/${alert.id}`} className="alert-item-link">
                  <div className={`alert-item alert-type-${alert.type} compact-row`}>
                    <div className="alert-icon">{alert.type === 'interdiction' ? '⚠️' : '⚔️'}</div>
                    <div className="alert-content">
                      <div className="alert-info">
                        <div className="alert-route">
                          {alert.type === 'interdiction' ? (
                            <>
                              {getDisplayId(alert.originId) || 'Unknown'} → {getDisplayId(alert.destinationId) || 'Unknown'}
                            </>
                          ) : (
                            <>
                              {getDisplayId(alert.locationId || alert.destinationId) || 'Unknown'}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="alert-meta">
                        <span className="region-shard">{alert.region.toUpperCase()}-{alert.shard}</span>
                        <span className="time-ago">{renderAlertTime(alert.lastActivity)}</span>
                      </div>
                    </div>
                    <div className="alert-stats">
                      <span className="confirm-count" title="Confirmations">{alert.confirmations}</span>
                      <span className="divider">/</span>
                      <span className="dispute-count" title="Disputes">{alert.disputes}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {isAuthenticated && (
            <div className="create-alert-container">
              <Link to="/create-alert" className="create-alert-btn full-width">
                Create Alert
              </Link>
            </div>
          )}
          
          {showDebugPanel && (
            <div className="debug-panel">
              <h3>Mapping Debug Panel</h3>
              <div className="stats">
                <p>Total IDs: {mappingStats.total}</p>
                <p>Resolved: {mappingStats.resolved}</p>
                <p>Failed: {mappingStats.failed}</p>
                <p>Success Rate: {mappingStats.total > 0 ? Math.round((mappingStats.resolved / mappingStats.total) * 100) : 0}%</p>
              </div>
              <div className="actions">
                <button onClick={validateAllAlertMappings}>
                  Validate All Mappings
                </button>
                <button onClick={() => setDirectNameMap({})}>
                  Clear Local Cache
                </button>
                <button onClick={() => CelestialIdMappingService.logMappings()}>
                  Log All Mappings
                </button>
              </div>
              {unmappedIds.size > 0 && (
                <div className="unmapped-section">
                  <h4>Unmapped IDs ({unmappedIds.size})</h4>
                  <div className="unmapped-list">
                    {Array.from(unmappedIds).map(id => (
                      <div key={id} className="unmapped-id">{id}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AlertList; 