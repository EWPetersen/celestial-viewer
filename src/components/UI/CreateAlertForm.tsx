import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import useAppStore from '../../stores/useAppStore';
import { AlertType, DistanceUnit, Region } from '../../models/RouteAlert';
import InterdictionService from '../../services/InterdictionService';
import { Vector3 } from '../../utils/coordinateUtils';
import { createAlertVisualization } from '../../models/RouteVisualization';
import './CreateAlertForm.css';

interface FormData {
  type: AlertType;
  region: Region;
  shard: number;
  originId: string;
  destinationId: string;
  locationId: string;
  distanceTraveled: number;
  distanceUnit: DistanceUnit;
}

interface CreateAlertFormProps {
  isInline?: boolean;
  onComplete?: () => void;
}

const CreateAlertForm: React.FC<CreateAlertFormProps> = ({ isInline = false, onComplete }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext);
  const celestialSystem = useAppStore(state => state.celestialSystem);
  const selectCelestialBody = useAppStore(state => state.selectCelestialBody);
  const addRouteVisualization = useAppStore(state => state.addRouteVisualization);
  const removeRouteVisualization = useAppStore(state => state.removeRouteVisualization);
  
  // Initialize alert type from URL query parameter
  const initialType = searchParams.get('type') === 'pvp' ? 'pvp' : 'interdiction';
  
  const [formData, setFormData] = useState<FormData>({
    type: initialType,
    region: '' as Region,
    shard: 0,
    originId: '',
    destinationId: '',
    locationId: '',
    distanceTraveled: 0,
    distanceUnit: '' as DistanceUnit
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celestialBodies, setCelestialBodies] = useState<{ id: string; name: string; }[]>([]);
  const [lineOfSightError, setLineOfSightError] = useState<string | null>(null);
  const [tempRouteVisualization, setTempRouteVisualization] = useState<string | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  
  // Check authentication and redirect if not logged in - only if not inline
  useEffect(() => {
    if (!isAuthenticated && !isInline) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate, isInline]);
  
  // Extract celestial bodies for dropdowns
  useEffect(() => {
    if (celestialSystem) {
      const bodies = celestialSystem.celestialBodies.map(body => ({
        id: body.id,
        name: body.name
      }));
      
      // Add points of interest
      const pois = celestialSystem.pointsOfInterest.map(poi => ({
        id: poi.id,
        name: poi.name
      }));
      
      setCelestialBodies([...bodies, ...pois]);
    }
  }, [celestialSystem]);
  
  // Clean up temporary route visualization when form is closed
  useEffect(() => {
    return () => {
      if (tempRouteVisualization) {
        removeRouteVisualization(tempRouteVisualization);
      }
    };
  }, [tempRouteVisualization, removeRouteVisualization]);
  
  // Check line of sight between origin and destination
  const checkLineOfSight = (originId: string, destinationId: string): boolean => {
    if (!celestialSystem) return true; // Can't check, so assume it's valid
    
    // Find origin and destination in both celestialBodies and pointsOfInterest
    const originBody = celestialSystem.celestialBodies.find(body => body.id === originId);
    const destinationBody = celestialSystem.celestialBodies.find(body => body.id === destinationId);
    
    const originPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === originId);
    const destinationPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === destinationId);
    
    // Combine body and POI data to get complete objects
    const origin = originBody || originPOI;
    const destination = destinationBody || destinationPOI;
    
    if (!origin || !destination) return true; // Can't check, so assume it's valid
    
    // Get types and parent IDs (handling both body and POI structures)
    const originType = originBody ? originBody.type : (originPOI ? originPOI.type : null);
    const destinationType = destinationBody ? destinationBody.type : (destinationPOI ? destinationPOI.type : null);
    const originParentId = originBody ? originBody.parentId : (originPOI ? originPOI.parentId : null);
    const destinationParentId = destinationBody ? destinationBody.parentId : (destinationPOI ? destinationPOI.parentId : null);
    
    console.log(`Checking line of sight between ${origin.name} (${originType}) and ${destination.name} (${destinationType})`);
    console.log(`Origin parent: ${originParentId}, Destination parent: ${destinationParentId}`);
    
    // Determine entity types for special handling
    const isOriginPlanet = originType === 'planet';
    const isDestinationPlanet = destinationType === 'planet';
    const isOriginMoon = originType === 'moon';
    const isDestinationMoon = destinationType === 'moon';
    const isOriginLagrange = originType === 'lagrangepoint';
    const isDestinationLagrange = destinationType === 'lagrangepoint';
    const isOriginJumpPoint = originType === 'jumppoint';
    const isDestinationJumpPoint = destinationType === 'jumppoint';
    
    // NEW RULE: Allow unrestricted travel between planets, Lagrange points, and jump points
    // If either origin or destination is a planet, Lagrange point, or jump point, they can travel between each other
    if ((isOriginPlanet || isOriginLagrange || isOriginJumpPoint) && 
        (isDestinationPlanet || isDestinationLagrange || isDestinationJumpPoint)) {
      // Allow travel between these entity types, skip parent checks
      console.log('Allowing travel between planet/Lagrange point/jump point');
    }
    // If one is a planet and one is a moon, check if the moon belongs to that planet
    else if (isOriginPlanet && isDestinationMoon) {
      if (destinationParentId !== origin.id) {
        return false; // Can't travel to a moon of a different planet
      }
    }
    else if (isDestinationPlanet && isOriginMoon) {
      if (originParentId !== destination.id) {
        return false; // Can't travel from a moon to a different planet
      }
    }
    // If both are moons, they must have the same parent planet
    else if (isOriginMoon && isDestinationMoon) {
      if (originParentId !== destinationParentId) {
        return false; // Can't travel between moons of different planets
      }
    }
    // For other celestial body types (station types, other POIs)
    else {
      // For POIs, check if they have the same parent
      if (originParentId !== destinationParentId) {
        return false; // Must have same parent for direct travel
      }
    }
    
    // Get the positions
    const originPos: Vector3 = origin.position;
    const destPos: Vector3 = destination.position;
    
    // Check for obstacles (planets or moons) between the two points
    const obstacles = celestialSystem.celestialBodies.filter(body => {
      // Skip the origin and destination themselves
      if (body.id === originId || body.id === destinationId) return false;
      
      // Only consider large bodies like planets and moons
      if (body.type !== 'planet' && body.type !== 'moon') return false;
      
      // Get the body position and radius
      const bodyPos = body.position;
      const bodyRadius = body.radius;
      
      // Special check for Lagrange points - add debug logging
      if (isOriginLagrange && isDestinationLagrange) {
        // For Lagrange points, we need to be especially careful about obstacles
        // Particularly checking if their parent planet is in the way
        if (originParentId && body.id === originParentId) {
          console.log(`Checking if parent planet ${body.name} blocks line of sight between Lagrange points`);
          // Continue with the collision check below
        }
      }
      
      // Calculate closest point on line to the body center
      const t = closestPointOnLine(originPos, destPos, bodyPos);
      const clampedT = Math.max(0, Math.min(1, t)); // Ensure t is between 0 and 1
      
      // Calculate the closest point
      const closestPoint = {
        x: originPos.x + clampedT * (destPos.x - originPos.x),
        y: originPos.y + clampedT * (destPos.y - originPos.y),
        z: originPos.z + clampedT * (destPos.z - originPos.z)
      };
      
      // Calculate distance from closest point to body center
      const distance = Math.sqrt(
        Math.pow(closestPoint.x - bodyPos.x, 2) +
        Math.pow(closestPoint.y - bodyPos.y, 2) +
        Math.pow(closestPoint.z - bodyPos.z, 2)
      );
      
      // Add debug logging for obstacles
      const hasCollision = distance < bodyRadius;
      if (hasCollision) {
        console.log(`Line of sight blocked by ${body.name} (distance: ${distance}, radius: ${bodyRadius})`);
      }
      
      // If distance is less than body radius, there's an intersection
      return hasCollision;
    });
    
    const hasLineOfSight = obstacles.length === 0;
    if (!hasLineOfSight) {
      console.log(`Line of sight check failed: ${obstacles.length} obstacle(s) in the way`);
    }
    
    return hasLineOfSight;
  };
  
  // Helper function to calculate the parameter t for the closest point on a line
  const closestPointOnLine = (lineStart: Vector3, lineEnd: Vector3, point: Vector3): number => {
    const lineVector = {
      x: lineEnd.x - lineStart.x,
      y: lineEnd.y - lineStart.y,
      z: lineEnd.z - lineStart.z
    };
    
    const pointVector = {
      x: point.x - lineStart.x,
      y: point.y - lineStart.y,
      z: point.z - lineStart.z
    };
    
    // Calculate dot products
    const lineLengthSquared = 
      lineVector.x * lineVector.x + 
      lineVector.y * lineVector.y + 
      lineVector.z * lineVector.z;
    
    // If line has zero length, return 0
    if (lineLengthSquared === 0) return 0;
    
    const t = (
      pointVector.x * lineVector.x + 
      pointVector.y * lineVector.y + 
      pointVector.z * lineVector.z
    ) / lineLengthSquared;
    
    return t;
  };
  
  // Create a temporary route visualization between origin and destination
  const createTempRouteVisualization = (originId: string, destinationId: string) => {
    // Remove any existing temporary route visualization
    if (tempRouteVisualization) {
      removeRouteVisualization(tempRouteVisualization);
    }
    
    // Create a new alert-like object for visualization
    const tempAlertData = {
      id: `temp-route-${Date.now()}`,
      type: 'interdiction',
      originId,
      destinationId,
      distanceTraveled: 0,
      distanceUnit: 'km',
      confirmations: 0,
      disputes: 0,
      lastActivity: new Date()
    };
    
    // Create a visualization from this data
    const visualization = createAlertVisualization(tempAlertData);
    
    // Remember the ID for cleanup
    setTempRouteVisualization(visualization.id);
    
    // Add the visualization to the map
    addRouteVisualization(visualization);
    
    return visualization.id;
  };
  
  const validateDistance = (originId: string, destinationId: string, distanceValue: number, unit: DistanceUnit): { isValid: boolean; warning: string | null } => {
    if (!celestialSystem || !originId || !destinationId) {
      return { isValid: true, warning: null }; // Can't validate without full data
    }
    
    // Find origin and destination objects
    const originBody = celestialSystem.celestialBodies.find(body => body.id === originId);
    const destinationBody = celestialSystem.celestialBodies.find(body => body.id === destinationId);
    
    const originPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === originId);
    const destinationPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === destinationId);
    
    // Get the actual objects
    const origin = originBody || originPOI;
    const destination = destinationBody || destinationPOI;
    
    if (!origin || !destination) {
      return { isValid: true, warning: null }; // Can't validate
    }
    
    // Calculate total distance in meters
    const totalDistanceMeters = Math.sqrt(
      Math.pow(destination.position.x - origin.position.x, 2) +
      Math.pow(destination.position.y - origin.position.y, 2) +
      Math.pow(destination.position.z - origin.position.z, 2)
    );
    
    // Convert entered distance to meters
    let distanceInMeters = distanceValue;
    switch (unit) {
      case 'km':
        distanceInMeters = distanceValue * 1000;
        break;
      case 'Mm' as DistanceUnit:
        distanceInMeters = distanceValue * 1000000;
        break;
      case 'Gm' as DistanceUnit:
        distanceInMeters = distanceValue * 1000000000;
        break;
      default:
        // Already in meters
        break;
    }
    
    // Format total distance for display
    const formatDistance = (meters: number): string => {
      if (meters >= 1000000000) {
        return `${(meters / 1000000000).toFixed(2)} Gm`;
      } else if (meters >= 1000000) {
        return `${(meters / 1000000).toFixed(2)} Mm`;
      } else if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
      } else {
        return `${meters.toFixed(2)} m`;
      }
    };
    
    const totalDistance = formatDistance(totalDistanceMeters);
    
    // Check if distance is greater than total distance
    if (distanceInMeters > totalDistanceMeters) {
      return { 
        isValid: false, 
        warning: null
      };
    }
    
    // Check if distance is less than 50% of total (warning, not error)
    if (distanceInMeters < totalDistanceMeters * 0.5) {
      return { 
        isValid: true, 
        warning: `This alert is positioned closer to the origin than the destination (${formatDistance(distanceInMeters)} out of ${totalDistance}). Most interdictions happen near the destination. Is this correct?`
      };
    }
    
    return { isValid: true, warning: null };
  };
  
  // Update the distance input handler to focus camera on the route at the specified distance and show alert ping
  const handleDistanceUpdate = (distance: number, unit: DistanceUnit) => {
    if (!celestialSystem || !formData.originId || !formData.destinationId || distance <= 0 || !unit) {
      return; // Can't proceed without all required data
    }
    
    // Find the origin and destination entities
    const originBody = celestialSystem.celestialBodies.find(body => body.id === formData.originId);
    const originPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === formData.originId);
    const origin = originBody || originPOI;
    
    const destinationBody = celestialSystem.celestialBodies.find(body => body.id === formData.destinationId);
    const destinationPOI = celestialSystem.pointsOfInterest.find(poi => poi.id === formData.destinationId);
    const destination = destinationBody || destinationPOI;
    
    if (!origin || !destination) {
      return; // Can't proceed without valid origin and destination
    }
    
    // Convert the entered distance to meters for calculation
    let distanceInMeters = distance;
    switch (unit) {
      case 'km':
        distanceInMeters = distance * 1000;
        break;
      case 'Mm' as DistanceUnit:
        distanceInMeters = distance * 1000000;
        break;
      case 'Gm' as DistanceUnit:
        distanceInMeters = distance * 1000000000;
        break;
      default:
        // Already in meters or invalid unit
        break;
    }
    
    // Calculate the total distance between origin and destination
    const totalDistanceMeters = Math.sqrt(
      Math.pow(destination.position.x - origin.position.x, 2) +
      Math.pow(destination.position.y - origin.position.y, 2) +
      Math.pow(destination.position.z - origin.position.z, 2)
    );
    
    // Calculate the point along the route at the specified distance
    const ratio = Math.min(distanceInMeters / totalDistanceMeters, 1.0);
    
    // Update the temporary route visualization with the new alert position
    if (tempRouteVisualization) {
      // Remove existing visualization
      removeRouteVisualization(tempRouteVisualization);
    }
    
    // Create a new alert-like object for visualization with distance
    const tempAlertData = {
      id: `temp-route-${Date.now()}`,
      type: 'interdiction',
      originId: formData.originId,
      destinationId: formData.destinationId,
      distanceTraveled: distance,
      distanceUnit: unit,
      confirmations: 0,
      disputes: 0,
      lastActivity: new Date(),
      activityLevel: 0.9 // High activity level for visualization
    };
    
    // Create a visualization from this data
    const visualization = createAlertVisualization(tempAlertData);
    
    // Remember the ID for cleanup
    setTempRouteVisualization(visualization.id);
    
    // Add the visualization to the map
    addRouteVisualization(visualization);
    
    // Focus the camera on the alert location
    if (ratio > 0) {
      console.log(`Focusing camera on route at ${ratio.toFixed(2)} of the route (${distance} ${unit})`);
      
      // Calculate the actual point in space
      const alertPosition = {
        x: origin.position.x + ratio * (destination.position.x - origin.position.x),
        y: origin.position.y + ratio * (destination.position.y - origin.position.y),
        z: origin.position.z + ratio * (destination.position.z - origin.position.z)
      };
      
      // Set the camera target to focus on this position
      useAppStore.getState().setCameraTarget({
        x: alertPosition.x,
        y: alertPosition.y,
        z: alertPosition.z
      });
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'shard') {
      setFormData({ ...formData, [name]: parseInt(value, 10) || 10 });
    } else if (name === 'distanceTraveled') {
      // Parse the value and ensure it's not NaN
      const numericValue = parseFloat(value);
      const newValue = isNaN(numericValue) ? 0 : numericValue;
      setFormData({ ...formData, [name]: newValue });
      
      // Clear previous errors
      setDistanceError(null);
      setDistanceWarning(null);
      
      // Validate distance if both origin and destination are set
      if (formData.originId && formData.destinationId && newValue > 0 && formData.distanceUnit) {
        const { isValid, warning } = validateDistance(
          formData.originId, 
          formData.destinationId, 
          newValue, 
          formData.distanceUnit
        );
        
        if (!isValid) {
          setDistanceError(`Distance traveled cannot exceed the total distance between origin and destination.`);
        } else if (warning) {
          setDistanceWarning(warning);
        }
        
        // Focus camera on the route at the specified distance if valid
        if (isValid && newValue > 0) {
          handleDistanceUpdate(newValue, formData.distanceUnit);
        }
      }
    } else if (name === 'distanceUnit') {
      const newUnit = value as DistanceUnit;
      setFormData({ ...formData, [name]: newUnit });
      
      // Re-validate with new unit
      if (formData.originId && formData.destinationId && formData.distanceTraveled > 0) {
        const { isValid, warning } = validateDistance(
          formData.originId, 
          formData.destinationId, 
          formData.distanceTraveled, 
          newUnit
        );
        
        setDistanceError(isValid ? null : `Distance traveled cannot exceed the total distance between origin and destination.`);
        setDistanceWarning(warning);
        
        // Focus camera on the route at the specified distance if valid
        if (isValid && formData.distanceTraveled > 0) {
          handleDistanceUpdate(formData.distanceTraveled, newUnit);
        }
      }
    } else if (name === 'originId') {
      setFormData({ ...formData, [name]: value });
      
      // Clear any previous line of sight errors and distance validations
      setLineOfSightError(null);
      setDistanceError(null);
      setDistanceWarning(null);
      
      // If a valid celestial body ID is selected, trigger camera focus
      if (value) {
        selectCelestialBody(value);
        
        // If destination is already selected, check line of sight and create visualization
        if (formData.destinationId) {
          const hasLineOfSight = checkLineOfSight(value, formData.destinationId);
          
          if (hasLineOfSight) {
            createTempRouteVisualization(value, formData.destinationId);
            
            // Also validate distance if it's set
            if (formData.distanceTraveled > 0) {
              const { isValid, warning } = validateDistance(
                value, 
                formData.destinationId, 
                formData.distanceTraveled, 
                formData.distanceUnit
              );
              
              setDistanceError(isValid ? null : `Distance traveled cannot exceed the total distance between origin and destination.`);
              setDistanceWarning(warning);
            }
          } else {
            setLineOfSightError("Direct travel not possible: Celestial bodies must share the same parent. Planets can travel to each other, and moons can only travel to their parent planet or to other moons of the same planet.");
            if (tempRouteVisualization) {
              removeRouteVisualization(tempRouteVisualization);
              setTempRouteVisualization(null);
            }
          }
        }
      }
    } else if (name === 'destinationId') {
      setFormData({ ...formData, [name]: value });
      
      // Clear any previous line of sight errors and distance validations
      setLineOfSightError(null);
      setDistanceError(null);
      setDistanceWarning(null);
      
      // If a valid celestial body ID is selected, trigger camera focus
      if (value) {
        selectCelestialBody(value);
        
        // If origin is already selected, check line of sight and create visualization
        if (formData.originId) {
          const hasLineOfSight = checkLineOfSight(formData.originId, value);
          
          if (hasLineOfSight) {
            createTempRouteVisualization(formData.originId, value);
            
            // Also validate distance if it's set
            if (formData.distanceTraveled > 0) {
              const { isValid, warning } = validateDistance(
                formData.originId, 
                value, 
                formData.distanceTraveled, 
                formData.distanceUnit
              );
              
              setDistanceError(isValid ? null : `Distance traveled cannot exceed the total distance between origin and destination.`);
              setDistanceWarning(warning);
            }
          } else {
            setLineOfSightError("Direct travel not possible: Celestial bodies must share the same parent. Planets can travel to each other, and moons can only travel to their parent planet or to other moons of the same planet.");
            if (tempRouteVisualization) {
              removeRouteVisualization(tempRouteVisualization);
              setTempRouteVisualization(null);
            }
          }
        }
      }
    } else if (name === 'locationId') {
      setFormData({ ...formData, [name]: value });
      
      // If a valid celestial body ID is selected, trigger camera focus
      if (value) {
        selectCelestialBody(value);
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleTypeChange = (type: AlertType) => {
    setFormData({ ...formData, type });
    
    // Clear any line of sight errors when changing type
    setLineOfSightError(null);
    
    // Remove any temporary route visualization
    if (tempRouteVisualization) {
      removeRouteVisualization(tempRouteVisualization);
      setTempRouteVisualization(null);
    }
  };
  
  const validateForm = (): boolean => {
    if (formData.type === 'interdiction') {
      if (!formData.originId || !formData.destinationId) {
        setError('Please select both origin and destination');
        return false;
      }
      
      if (formData.originId === formData.destinationId) {
        setError('Origin and destination cannot be the same');
        return false;
      }
      
      if (formData.distanceTraveled <= 0) {
        setError('Distance traveled must be greater than 0');
        return false;
      }
      
      // Validate distance
      const { isValid, warning } = validateDistance(
        formData.originId,
        formData.destinationId,
        formData.distanceTraveled,
        formData.distanceUnit
      );
      
      if (!isValid) {
        setDistanceError(`Distance traveled cannot exceed the total distance between origin and destination.`);
        return false;
      }
      
      // Distance warning doesn't prevent form submission, just warns the user
      setDistanceWarning(warning);
    } else {
      if (!formData.locationId) {
        setError('Please select a location');
        return false;
      }
    }
    
    return true;
  };
  
  const handleCancel = () => {
    // Clean up any temporary route visualizations
    if (tempRouteVisualization) {
      removeRouteVisualization(tempRouteVisualization);
    }
    
    if (isInline && onComplete) {
      onComplete();
    } else {
      navigate('/');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous errors
    setError(null);
    
    // Validate line of sight first
    if (formData.type === 'interdiction' && formData.originId && formData.destinationId) {
      const hasLineOfSight = checkLineOfSight(formData.originId, formData.destinationId);
      if (!hasLineOfSight) {
        setLineOfSightError("Direct travel not possible: Celestial bodies must share the same parent. Planets can travel to each other, and moons can only travel to their parent planet or to other moons of the same planet.");
        
        // Find the celestial bodies to provide a more helpful error
        const originBody = celestialSystem?.celestialBodies.find(body => body.id === formData.originId);
        const destBody = celestialSystem?.celestialBodies.find(body => body.id === formData.destinationId);
        
        if (originBody && destBody) {
          setError(`Cannot create alert: No quantum travel path between ${originBody.name} and ${destBody.name}. Please select a compatible destination.`);
        } else {
          setError("Cannot create alert: No quantum travel path between these locations. Please select a compatible destination.");
        }
        
        return;
      }
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const alertData = formData.type === 'interdiction' 
        ? {
            type: formData.type,
            region: formData.region,
            shard: formData.shard,
            originId: formData.originId,
            destinationId: formData.destinationId,
            distanceTraveled: formData.distanceTraveled,
            distanceUnit: formData.distanceUnit
          }
        : {
            type: formData.type as 'pvp',
            region: formData.region,
            shard: formData.shard,
            locationId: formData.locationId,
            originId: '',
            destinationId: formData.locationId,
            distanceTraveled: undefined,
            distanceUnit: undefined
          };
      
      const createdAlert = await RouteAlertService.createAlert(alertData);
      
      // Remove any temporary route visualization
      if (tempRouteVisualization) {
        removeRouteVisualization(tempRouteVisualization);
      }
      
      // Call onComplete callback if in inline mode
      if (isInline && onComplete) {
        onComplete();
      } else {
        // Navigate to the alert detail page
        navigate(`/alert/${createdAlert.id}`);
      }
    } catch (err) {
      setError('Failed to create alert. Please try again.');
      console.error('Error creating alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  const formClass = isInline ? 'inline-alert-form' : 'create-alert-container';
  
  return (
    <div className={formClass}>
      <div className="create-alert-card">
        <h2>Create {formData.type === 'interdiction' ? 'Interdiction' : 'PvP'} Alert</h2>
        
        {error && (
          <div className="alert-error-message">
            {error}
          </div>
        )}
        
        {lineOfSightError && (
          <div className="alert-error-message line-of-sight-error">
            {lineOfSightError}
          </div>
        )}
        
        <div className="alert-type-selector">
          <button 
            className={`type-button ${formData.type === 'interdiction' ? 'active' : ''}`}
            onClick={() => handleTypeChange('interdiction')}
            type="button"
          >
            Interdiction Alert
          </button>
          <button 
            className={`type-button ${formData.type === 'pvp' ? 'active' : ''}`}
            onClick={() => handleTypeChange('pvp')}
            type="button"
          >
            PvP Alert
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="alert-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="region">Region</label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                <option value="">Select Region</option>
                <option value="us">US</option>
                <option value="eu">EU</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="shard">Shard</label>
              <select
                id="shard"
                name="shard"
                value={formData.shard || ''}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                <option value="">Select Shard</option>
                {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map(shard => (
                  <option key={shard} value={shard}>
                    {shard.toString().padStart(3, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {formData.type === 'interdiction' ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="originId">Origin</label>
                  <select
                    id="originId"
                    name="originId"
                    value={formData.originId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Select Origin</option>
                    {celestialBodies.map(body => (
                      <option key={body.id} value={body.id}>
                        {body.name}
                      </option>
                    ))}
                  </select>
                  {formData.originId && formData.destinationId && !lineOfSightError && 
                    <span className="valid-route-indicator" title="Valid route path"></span>
                  }
                </div>
                
                <div className="form-group">
                  <label htmlFor="destinationId">
                    Destination
                    {lineOfSightError && (
                      <span className="destination-error-hint"> (Select compatible destination)</span>
                    )}
                  </label>
                  <select
                    id="destinationId"
                    name="destinationId"
                    value={formData.destinationId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    required
                    className={lineOfSightError ? "error-select" : ""}
                  >
                    <option value="">Select Destination</option>
                    {celestialBodies.map(body => (
                      <option key={body.id} value={body.id}>
                        {body.name}
                      </option>
                    ))}
                  </select>
                  {formData.originId && formData.destinationId && !lineOfSightError && 
                    <span className="valid-route-indicator" title="Valid route path"></span>
                  }
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="distanceTraveled">Distance Traveled</label>
                  <div className="distance-input-group">
                    <input
                      type="number"
                      id="distanceTraveled"
                      name="distanceTraveled"
                      value={isNaN(formData.distanceTraveled) ? '' : formData.distanceTraveled}
                      onChange={handleInputChange}
                      min="0"
                      step="0.1"
                      disabled={isSubmitting}
                      required
                      className={distanceError ? "error-input" : ""}
                    />
                    <select
                      id="distanceUnit"
                      name="distanceUnit"
                      value={formData.distanceUnit}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      required
                    >
                      <option value="">Select Unit</option>
                      <option value="km">km</option>
                      <option value="Mm">Mm</option>
                      <option value="Gm">Gm</option>
                    </select>
                  </div>
                  {distanceError && (
                    <div className="alert-error-message">
                      {distanceError}
                    </div>
                  )}
                  {distanceWarning && !distanceError && (
                    <div className="alert-warning-message">
                      {distanceWarning}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="locationId">Location</label>
              <select
                id="locationId"
                name="locationId"
                value={formData.locationId}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                <option value="">Select Location</option>
                {celestialBodies.map(body => (
                  <option key={body.id} value={body.id}>
                    {body.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting || lineOfSightError !== null}
            >
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAlertForm; 