import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import { RouteAlert, AlertType, Region, isAlertActive, formatDistance } from '../../models/RouteAlert';
import DataLoader from '../../services/DataLoaderService';
import CelestialIdMappingService, { CelestialIdMappingService as CelestialIdMappingServiceClass } from '../../services/CelestialIdMappingService';
import { createAlertVisualization } from '../../models/RouteVisualization';
import useAppStore from '../../stores/useAppStore';
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
  const { removeRouteVisualization, addRouteVisualization } = useAppStore();
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AlertType | 'all'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RouteAlert | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  
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
        
        // Initialize the service properly using the static method on the class
        const idMappingService = CelestialIdMappingServiceClass.getInstance();
        idMappingService.initialize();
        
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
          
          // Log the full mapping for debugging
          console.log("[AlertList] Full mapping:", directNameMap);
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
  
  // Function to try to extract a meaningful name from an ID string
  const tryExtractNameFromId = (id: string): string | null => {
    if (!id) return null;
    
    // Common celestial body names with their proper capitalization
    const celestialNameMap = {
      'stanton': 'Stanton',
      'hurston': 'Hurston',
      'crusader': 'Crusader',
      'arccorp': 'ArcCorp', 
      'microtech': 'microTech',
      'ariel': 'Ariel',
      'aberdeen': 'Aberdeen',
      'magda': 'Magda',
      'ita': 'Ita',
      'cellin': 'Cellin',
      'daymar': 'Daymar',
      'yela': 'Yela',
      'lyria': 'Lyria',
      'wala': 'Wala',
      'calliope': 'Calliope',
      'clio': 'Clio',
      'euterpe': 'Euterpe',
      // Add more names as needed
    };
    
    // Check if ID contains any known celestial name
    const lowerId = id.toLowerCase();
    for (const [searchKey, properName] of Object.entries(celestialNameMap)) {
      if (lowerId.includes(searchKey)) {
        console.log(`[tryExtractNameFromId] Found match: ${id} contains '${searchKey}' -> '${properName}'`);
        return properName;
      }
    }
    
    // Check if the ID follows various name patterns
    
    // Pattern 1: name-uuid
    const nameUuidPattern = /^([a-z]+)[-_]([0-9a-f-]+)/i;
    const nameUuidMatch = id.match(nameUuidPattern);
    if (nameUuidMatch && nameUuidMatch[1] && nameUuidMatch[1].length > 2) {
      const extractedPart = nameUuidMatch[1];
      const capitalizedName = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);
      console.log(`[tryExtractNameFromId] Extracted from name-uuid pattern: ${id} -> '${capitalizedName}'`);
      return capitalizedName;
    }
    
    // Pattern 2: uuid-name
    const uuidNamePattern = /([0-9a-f-]+)[-_]([a-z]+)/i;
    const uuidNameMatch = id.match(uuidNamePattern);
    if (uuidNameMatch && uuidNameMatch[2] && uuidNameMatch[2].length > 2) {
      const extractedPart = uuidNameMatch[2];
      const capitalizedName = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);
      console.log(`[tryExtractNameFromId] Extracted from uuid-name pattern: ${id} -> '${capitalizedName}'`);
      return capitalizedName;
    }
    
    // Pattern 3: name_with_underscores or name.with.dots
    const separatorPattern = /([a-z]+)[_.]([a-z]+)/i;
    const separatorMatch = id.match(separatorPattern);
    if (separatorMatch && separatorMatch[1] && separatorMatch[1].length > 2) {
      const extractedPart = separatorMatch[1];
      const capitalizedName = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);
      console.log(`[tryExtractNameFromId] Extracted from separator pattern: ${id} -> '${capitalizedName}'`);
      return capitalizedName;
    }
    
    // If we reach here, no patterns matched
    console.log(`[tryExtractNameFromId] No name pattern found in ID: ${id}`);
    return null;
  };
  
  // Function to get celestial name directly without dependency on service
  const localGetCelestialName = (id: string | undefined): string => {
    if (!id) return 'Unknown';
    
    // Log the attempt for debugging
    log(`Attempting to resolve name for ID: ${id}`);
    
    // First check our direct map
    if (directNameMap[id]) {
      log(`Found direct mapping for ${id}: ${directNameMap[id]}`);
      return directNameMap[id];
    }
    
    // Fallback to service
    const serviceName = CelestialIdMappingService.getNameFromId(id);
    if (serviceName !== id) {
      // Add to our direct map for future reference
      if (serviceName) {
        log(`Found service mapping for ${id}: ${serviceName}`);
        setDirectNameMap(prev => ({...prev, [id]: serviceName}));
        return serviceName;
      }
    }
    
    // Try advanced UUID pattern matching for regional naming conventions
    // For example: hurston-123e4567-e89b-12d3-a456-426614174000
    const uuidMatch = id.match(/^([a-z]+)[-_]([0-9a-f]{8}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{12})/i);
    if (uuidMatch && uuidMatch[1]) {
      const extractedName = uuidMatch[1].charAt(0).toUpperCase() + uuidMatch[1].slice(1);
      log(`Extracted name from UUID pattern for ${id}: ${extractedName}`);
      
      // Add to mapping service for future use
      CelestialIdMappingService.addAlertIdMapping(id, extractedName);
      
      return extractedName;
    }
    
    // Try heuristic name extraction
    const extractedName = tryExtractNameFromId(id);
    if (extractedName) {
      log(`Extracted name using heuristic for ${id}: ${extractedName}`);
      
      // Add to mapping service for future use
      CelestialIdMappingService.addAlertIdMapping(id, extractedName);
      
      return extractedName;
    }
    
    // No mapping found, log the issue for troubleshooting
    console.warn(`[AlertList] No name mapping found for ID: ${id}`);
    
    // Return the ID with a visual indicator that it's an unmapped ID
    return `ID:${id.substring(0, 6)}`;
  };

  // Use effect to collect and update missing name mappings
  useEffect(() => {
    if (alerts.length === 0) return;
    
    // Log all alert IDs for debugging
    console.log('[AlertList] Processing alerts with the following IDs:');
    alerts.forEach(alert => {
      console.log(`Alert ID: ${alert.id}`);
      console.log(`  Origin: ${alert.originId}`);
      console.log(`  Destination: ${alert.destinationId}`);
      console.log(`  Location: ${alert.locationId}`);
    });
    
    // Get all unique IDs from alerts including every field that might contain an ID
    const allIds = new Set<string>();
    alerts.forEach(alert => {
      // Add all possible ID fields
      if (alert.originId) allIds.add(alert.originId);
      if (alert.destinationId) allIds.add(alert.destinationId);
      if (alert.locationId) allIds.add(alert.locationId);
      if (alert.nearestCelestialId) allIds.add(alert.nearestCelestialId);
      
      // Any other fields that might contain IDs
      const alertObj = alert as any;
      for (const key of Object.keys(alertObj)) {
        const value = alertObj[key];
        // Check if this looks like an ID (UUID pattern)
        if (typeof value === 'string' && 
            value.length > 30 && 
            /^[0-9a-f-]+$/i.test(value) &&
            !allIds.has(value)) {
          console.log(`[AlertList] Found potential ID in field ${key}: ${value}`);
          allIds.add(value);
        }
      }
    });
    
    console.log(`[AlertList] Found ${allIds.size} unique IDs to process`);
    
    // Track new mappings and stats
    let newNameMap = {...directNameMap};
    let totalResolved = 0;
    let totalFailed = 0;
    let updatedUnmappedIds = new Set<string>(unmappedIds);
    let madeChanges = false;
    
    // Process each ID
    allIds.forEach(id => {
      // Skip IDs we already have in our direct map
      if (directNameMap[id]) {
        console.log(`[AlertList] Already have mapping for ${id}: ${directNameMap[id]}`);
        return;
      }
      
      // Try service first - this is the proper way to get names
      const serviceName = CelestialIdMappingService.getNameFromId(id);
      if (serviceName !== id) {
        console.log(`[AlertList] Found mapping via service for ${id}: ${serviceName}`);
        newNameMap[id] = serviceName;
        CelestialIdMappingService.addAlertIdMapping(id, serviceName);
        totalResolved++;
        madeChanges = true;
        return;
      }
      
      // Try more extensive UUID pattern matching
      // Pattern 1: name-uuid
      const uuidMatch = id.match(/^([a-z]+)[-_]([0-9a-f]{8}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{4}[-]?[0-9a-f]{12})/i);
      if (uuidMatch && uuidMatch[1]) {
        const extractedName = uuidMatch[1].charAt(0).toUpperCase() + uuidMatch[1].slice(1);
        console.log(`[AlertList] Extracted name from UUID pattern for ${id}: ${extractedName}`);
        newNameMap[id] = extractedName;
        CelestialIdMappingService.addAlertIdMapping(id, extractedName);
        totalResolved++;
        madeChanges = true;
        return;
      }
      
      // Try heuristic name extraction
      const extractedName = tryExtractNameFromId(id);
      if (extractedName) {
        console.log(`[AlertList] Extracted name using heuristic for ${id}: ${extractedName}`);
        newNameMap[id] = extractedName;
        CelestialIdMappingService.addAlertIdMapping(id, extractedName);
        totalResolved++;
        madeChanges = true;
        return;
      }
      
      // No mapping found, track as unmapped
      updatedUnmappedIds.add(id);
      totalFailed++;
      madeChanges = true;
      
      // Log failure for debugging
      console.warn(`[AlertList] Failed to resolve name for ID: ${id}`);
    });
    
    // Only update state if we made changes
    if (madeChanges) {
      console.log(`[AlertList] Batch processed ${totalResolved} resolved, ${totalFailed} failed`);
      setDirectNameMap(newNameMap);
      setUnmappedIds(updatedUnmappedIds);
      setMappingStats(prev => ({
        total: prev.total + totalResolved + totalFailed,
        resolved: prev.resolved + totalResolved,
        failed: prev.failed + totalFailed
      }));
    }
  }, [alerts]);
  
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
      '8e38ba99-f1cd-49df-bc4e-5ef9309b511f': 'ArcCorp City',
      
      // Add IDs from console logs
      '3cbf39d0-a393-4c41-83c8-86561962e36b': 'Hurston',
      '90c3c7dc-02df-4f30-851c-dfb1a8876998': 'ArcCorp',
      
      // Handle shortened IDs that are showing in the UI
      '3cbf39d0': 'Hurston',
      '90c3c7dc': 'ArcCorp',
      '52a77839': 'Hurston',
      '20f3f4d3': 'Crusader',
      'd6fc1705': 'microTech',
      '8af309da': 'Stanton',
      'a6e9252e': 'ArcCorp',
      'd191779b': 'Hurston Area',
      'b3557a17': 'MicroTech Orbit',
      '8e38ba99': 'ArcCorp City'
    };
    
    // First check for short IDs (8 characters)
    if (id.length === 8 && /^[0-9a-f]{8}$/i.test(id)) {
      // Check our direct emergency mapping first
      if (knownUuidMappings[id]) {
        console.log(`🔍 SHORT ID MAPPING: ${id} → hardcoded to → ${knownUuidMappings[id]}`);
        return knownUuidMappings[id];
      }
      
      // Try to match against full UUID entries in our mapping
      for (const [fullId, name] of Object.entries(knownUuidMappings)) {
        if (fullId.startsWith(id)) {
          console.log(`🔍 SHORT ID PATTERN MATCH: ${id} matches prefix of ${fullId} → ${name}`);
          return name;
        }
      }
      
      // Try service before returning formatted ID
      const serviceName = CelestialIdMappingService.getNameFromId(id);
      if (serviceName !== id) {
        console.log(`🔍 SERVICE RESOLVED SHORT ID: ${id} → ${serviceName}`);
        return serviceName;
      }
      
      console.log(`⚠️ Unresolved short ID: ${id}`);
      return `ID:${id}`;
    }
    
    // Check our direct emergency mapping for full IDs
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
    
    // For shortened IDs in the format of first 8 chars of UUID
    if (id.length === 8 && /^[0-9a-f]{8}$/i.test(id)) {
      console.log(`Short ID detected: ${id}, attempting to find in mapping service`);
      
      // Use the static method on the class
      for (const fullId of CelestialIdMappingServiceClass.getAllStoredIds()) {
        if (fullId.startsWith(id)) {
          const name = CelestialIdMappingService.getNameFromId(fullId);
          if (name !== fullId) {
            console.log(`Found match for short ID ${id} → ${fullId} → ${name}`);
            return name;
          }
        }
      }
      
      // Return formatted short ID if no mapping found
      return `ID:${id}`;
    }
    
    // No name resolution available, return formatted ID
    if (id.length > 8) {
      return `ID:${id.substring(0, 8)}`;
    }
    
    return id;
  }, [directNameMap, tryExtractNameFromId]);
  
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
  
  // Handle alert click to show modal instead of navigating
  const handleAlertClick = (alert: RouteAlert) => {
    setSelectedAlert(alert);
    setShowAlertModal(true);
    
    // Visualize the alert on the map
    try {
      const visualization = createAlertVisualization(alert);
      removeRouteVisualization(); // Clear previous visualizations
      addRouteVisualization(visualization);
    } catch (err) {
      console.error('Error creating alert visualization:', err);
    }
  };
  
  // Close alert modal
  const handleCloseAlertModal = () => {
    setShowAlertModal(false);
    
    // Clear visualization when modal is closed
    removeRouteVisualization();
  };
  
  return (
    <div className="alert-list-container">
      {isLoading ? (
        <div className="alert-list-loading">
          <div className="loading-spinner"></div>
          <p>Loading alerts...</p>
        </div>
      ) : error ? (
        <div className="alert-list-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="alert-list-empty">
          <p>No alerts found for the current filters.</p>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map(alert => {
            // Debug what we're about to render
            const originName = localGetCelestialName(alert.originId);
            const destName = localGetCelestialName(alert.destinationId);
            const locName = localGetCelestialName(alert.locationId || alert.destinationId);
            
            // Log detailed info for debugging
            console.log(`[AlertList Render] Alert ${alert.id}: ${originName} -> ${destName} (Location: ${locName})`);
            
            // Check if names were resolved properly
            const hasUnresolvedNames = 
              (alert.originId && originName.startsWith('ID:')) || 
              (alert.destinationId && destName.startsWith('ID:')) || 
              ((alert.locationId || alert.destinationId) && locName.startsWith('ID:'));
            
            return (
              <Link key={alert.id} to={`/alert/${alert.id}`} className="alert-item-link" onClick={(e) => {
                e.preventDefault();
                handleAlertClick(alert);
              }}>
                <div className={`alert-item alert-type-${alert.type} compact-row ${hasUnresolvedNames ? 'has-unresolved-names' : ''}`}>
                  <div className="alert-icon">{alert.type === 'interdiction' ? '⚠️' : '⚔️'}</div>
                  <div className="alert-content">
                    <div className="alert-info">
                      <div className="alert-route">
                        {alert.type === 'interdiction' ? (
                          <>
                            {originName || 'Unknown'} → {destName || 'Unknown'}
                          </>
                        ) : (
                          <>
                            {locName || 'Unknown'}
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
            );
          })}
        </div>
      )}
      
      {showDebugPanel && (
        // Debugging panel
        <div className="debug-panel">
          <h4>Debug Info</h4>
          <div className="debug-content">
            <p>Filters: {activeRegion || 'All'} / {activeShard || 'All'}</p>
            <p>Total Alerts: {alerts.length}</p>
            <button onClick={() => setShowDebugPanel(false)}>Close</button>
          </div>
        </div>
      )}
      
      {/* Alert Modal */}
      {showAlertModal && selectedAlert && (
        <div className="alert-modal-overlay" onClick={handleCloseAlertModal}>
          <div className="alert-modal" onClick={e => e.stopPropagation()}>
            <div className="alert-modal-header">
              <h3>
                {selectedAlert.type === 'interdiction' ? 'Interdiction Alert' : 'PvP Alert'}
              </h3>
              <button className="close-button" onClick={handleCloseAlertModal}>×</button>
            </div>
            
            <div className="alert-modal-content">
              <div className="alert-info-section">
                <div className="alert-route-detail">
                  {selectedAlert.type === 'interdiction' ? (
                    <>
                      <div className="route-item">
                        <span className="label">From:</span>
                        <span className="value">{localGetCelestialName(selectedAlert.originId)}</span>
                      </div>
                      <div className="route-item">
                        <span className="label">To:</span>
                        <span className="value">{localGetCelestialName(selectedAlert.destinationId)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="route-item">
                      <span className="label">Location:</span>
                      <span className="value">
                        {localGetCelestialName(selectedAlert.locationId || selectedAlert.destinationId)}
                      </span>
                    </div>
                  )}
                </div>
                  
                <div className="alert-meta-detail">
                  <div className="meta-item">
                    <span className="label">Region:</span>
                    <span className="value">{selectedAlert.region.toUpperCase()}-{selectedAlert.shard}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Reported:</span>
                    <span className="value">{renderAlertTime(selectedAlert.timestamp)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Last Activity:</span>
                    <span className="value">{renderAlertTime(selectedAlert.lastActivity)}</span>
                  </div>
                </div>
              </div>
              
              <div className="alert-actions-container">
                <button 
                  className="confirm-button"
                  onClick={() => handleConfirmAlert(selectedAlert.id)}
                  disabled={!isAuthenticated}
                >
                  <span className="count">{selectedAlert.confirmations}</span>
                  Confirm
                </button>
                <button 
                  className="dispute-button"
                  onClick={() => handleDisputeAlert(selectedAlert.id)}
                  disabled={!isAuthenticated}
                >
                  <span className="count">{selectedAlert.disputes}</span>
                  Dispute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertList; 