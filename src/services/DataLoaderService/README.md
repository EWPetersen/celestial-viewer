# DataLoaderService

This service is responsible for loading and processing celestial data from the JSON file. It calculates absolute positions for all entities based on their parent-child relationships, handles special cases, and provides a clean data structure for rendering and querying.

## Key Features

- Loads and parses data from `/rc/stanton_extract.json`
- Recursively processes the entity hierarchy
- Computes correct absolute positions for all entities
- Handles special cases for `landingzone` and `reststop` entities
- Provides a clean, indexed data structure for easy access
- Includes utility functions for traversing the hierarchy
- Converts the processed data to formats required by the application

## Usage

```typescript
import DataLoader from '../services/DataLoaderService';

// Basic usage:
async function loadAndRenderData() {
  try {
    // Load raw system data with computed absolute positions
    const systemData = await DataLoader.loadSystemData();
    
    // Or load data in the format expected by the application store
    const celestialSystem = await DataLoader.loadCelestialSystem();
    
    // Access entities by type
    const planets = DataLoader.getEntitiesByType('planet');
    
    // Get all children of a specific entity
    const moonsOfCrusader = DataLoader.getChildrenOfEntity(crusaderId);
    
    // Get the parent chain of an entity
    const pathToGrimHex = DataLoader.getParentChain(grimHexId);
  } catch (error) {
    console.error('Failed to load celestial data:', error);
  }
}
```

## Entity Transformation Logic

The service computes absolute positions using these rules:

1. The root entity (Stanton) is at position `(0, 0, 0)`
2. For normal entities, the absolute position is:
   ```
   entity.absolutePosition = parent.absolutePosition + entity.relativePosition
   ```
3. Special case: entities of type `landingzone` or `reststop` always use their position as absolute, regardless of their parent

## Data Structure

The service produces a structured `SystemData` object:

```typescript
interface SystemData {
  root: string; // ID of the root entity
  entities: Record<string, ProcessedEntity>; // Map of all entities by ID
  entityByType: Record<string, string[]>; // Map of entity IDs by type
}
```

Each entity includes both relative and absolute positions:

```typescript
interface ProcessedEntity {
  id: string;
  name: string;
  type: string;
  parent: string | null;
  relativePosition: Position;  // Original position from JSON
  absolutePosition: Position;  // Computed absolute position
  arrivalRadius: number;
  atmoHeight: number;
  obstructionRadius: number;
  size: number;
  system_entity_name: string;
  children: string[]; // Array of child entity IDs
}
```

## Adapter Functions

The service includes adapter functions to convert the processed data to formats required by other parts of the application:

```typescript
// Convert to the CelestialSystem format expected by the app store
const celestialSystem = systemDataToCelestialSystem(systemData);
``` 