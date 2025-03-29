import { DataLoader } from '../DataLoader';
import { CelestialEntity, Position } from '../interfaces';

describe('DataLoader', () => {
  let dataLoader: DataLoader;
  
  beforeEach(() => {
    // Reset the singleton instance before each test
    jest.resetModules();
    // Get fresh instance
    dataLoader = require('../DataLoader').DataLoader.getInstance();
    // Mock fetch to prevent actual network requests
    global.fetch = jest.fn();
  });

  const mockPosition = (x: number, y: number, z: number): Position => ({ x, y, z });

  const createMockEntity = (
    name: string,
    type: string,
    position: Position,
    children: CelestialEntity[] = []
  ): CelestialEntity => {
    return {
      name,
      type,
      position,
      arrivalRadius: 100000,
      atmoHeight: 0,
      obstructionRadius: 50000,
      orbitalMarkers: {
        om1: null, om2: null, om3: null, om4: null, om5: null, om6: null
      },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      size: 100000,
      system_entity_name: `ooc_${name.toLowerCase()}`,
      children
    };
  };

  describe('processSystemData', () => {
    test('should compute correct absolute positions for a simple hierarchy', async () => {
      // Prepare test data
      const mockRoot = createMockEntity(
        'Stanton',
        'star',
        mockPosition(0, 0, 0),
        [
          createMockEntity(
            'Crusader',
            'planet',
            mockPosition(10000000, 0, 0),
            [
              createMockEntity(
                'Daymar',
                'moon',
                mockPosition(5000000, 0, 0)
              )
            ]
          )
        ]
      );

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRoot
      });

      // Process the data
      const systemData = await dataLoader.loadSystemData(true);

      // Extract entities by name for easier testing
      const entityByName: Record<string, any> = {};
      Object.values(systemData.entities).forEach(entity => {
        entityByName[entity.name] = entity;
      });

      // Verify absolute positions
      expect(entityByName['Stanton'].absolutePosition).toEqual(mockPosition(0, 0, 0));
      expect(entityByName['Crusader'].absolutePosition).toEqual(mockPosition(10000000, 0, 0));
      // Daymar's position should be Crusader's absolute position + Daymar's relative position
      expect(entityByName['Daymar'].absolutePosition).toEqual(mockPosition(15000000, 0, 0));
    });

    test('should handle special types with absolute positions', async () => {
      // Prepare test data with a reststop (which should have absolute position)
      const mockRoot = createMockEntity(
        'Stanton',
        'star',
        mockPosition(0, 0, 0),
        [
          createMockEntity(
            'Crusader',
            'planet',
            mockPosition(10000000, 0, 0),
            [
              createMockEntity(
                'Daymar',
                'moon',
                mockPosition(5000000, 0, 0),
                [
                  createMockEntity(
                    'Rest & Relax',
                    'reststop', // This type should use absolute position
                    mockPosition(1000000, 2000000, 3000000)
                  )
                ]
              )
            ]
          )
        ]
      );

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRoot
      });

      // Process the data
      const systemData = await dataLoader.loadSystemData(true);

      // Extract entities by name for easier testing
      const entityByName: Record<string, any> = {};
      Object.values(systemData.entities).forEach(entity => {
        entityByName[entity.name] = entity;
      });

      // Verify that the reststop has its specified absolute position
      // and not parent-relative position
      expect(entityByName['Rest & Relax'].absolutePosition).toEqual(
        mockPosition(1000000, 2000000, 3000000)
      );
    });

    test('should handle the real Stanton > Crusader > Daymar > Grim HEX path', async () => {
      // Prepare test data for a real path in the Stanton system
      const grimHEX = createMockEntity(
        'Grim HEX',
        'station',
        mockPosition(100000, 200000, 300000)
      );
      
      const daymar = createMockEntity(
        'Daymar',
        'moon',
        mockPosition(5000000, 0, 0),
        [grimHEX]
      );
      
      const crusader = createMockEntity(
        'Crusader',
        'planet',
        mockPosition(10000000, 0, 0),
        [daymar]
      );
      
      const stanton = createMockEntity(
        'Stanton',
        'star',
        mockPosition(0, 0, 0),
        [crusader]
      );

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => stanton
      });

      // Process the data
      const systemData = await dataLoader.loadSystemData(true);

      // Extract entities by name for easier testing
      const entityByName: Record<string, any> = {};
      Object.values(systemData.entities).forEach(entity => {
        entityByName[entity.name] = entity;
      });

      // Verify the absolute positions along the path
      expect(entityByName['Stanton'].absolutePosition).toEqual(mockPosition(0, 0, 0));
      expect(entityByName['Crusader'].absolutePosition).toEqual(mockPosition(10000000, 0, 0));
      expect(entityByName['Daymar'].absolutePosition).toEqual(mockPosition(15000000, 0, 0));
      expect(entityByName['Grim HEX'].absolutePosition).toEqual(mockPosition(15100000, 200000, 300000));
    });
    
    test('should skip null or invalid entities', async () => {
      // Prepare test data with a null child
      const mockRoot = createMockEntity(
        'Stanton',
        'star',
        mockPosition(0, 0, 0),
        [
          null as unknown as CelestialEntity,
          createMockEntity(
            'Crusader',
            'planet',
            mockPosition(10000000, 0, 0)
          ),
          // Invalid entity with missing position
          {
            name: 'Invalid',
            type: 'planet',
            arrivalRadius: 100000,
            atmoHeight: 0,
            obstructionRadius: 50000,
            orbitalMarkers: {
              om1: null, om2: null, om3: null, om4: null, om5: null, om6: null
            },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
            size: 100000,
            system_entity_name: 'ooc_invalid'
          } as unknown as CelestialEntity
        ]
      );

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRoot
      });

      // Process the data
      const systemData = await dataLoader.loadSystemData(true);

      // There should only be 2 entities: root and Crusader
      // The null and invalid entities should be skipped
      expect(Object.keys(systemData.entities).length).toBe(2);
      
      // Check that only Stanton and Crusader are included
      const names = Object.values(systemData.entities).map(e => e.name);
      expect(names).toContain('Stanton');
      expect(names).toContain('Crusader');
      expect(names).not.toContain('Invalid');
    });
  });
  
  describe('helper methods', () => {
    test('getParentChain should return the correct parent chain', async () => {
      // Create a simple hierarchy
      const grimHEX = createMockEntity(
        'Grim HEX',
        'station',
        mockPosition(100000, 200000, 300000)
      );
      
      const daymar = createMockEntity(
        'Daymar',
        'moon',
        mockPosition(5000000, 0, 0),
        [grimHEX]
      );
      
      const crusader = createMockEntity(
        'Crusader',
        'planet',
        mockPosition(10000000, 0, 0),
        [daymar]
      );
      
      const stanton = createMockEntity(
        'Stanton',
        'star',
        mockPosition(0, 0, 0),
        [crusader]
      );

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => stanton
      });

      // Process the data
      const systemData = await dataLoader.loadSystemData(true);

      // Find Grim HEX entity
      const grimHEXEntity = Object.values(systemData.entities).find(
        entity => entity.name === 'Grim HEX'
      );
      
      expect(grimHEXEntity).toBeDefined();
      
      if (grimHEXEntity) {
        // Get the parent chain
        const parentChain = dataLoader.getParentChain(grimHEXEntity.id);
        
        // Check the chain order and names
        expect(parentChain.length).toBe(4);
        expect(parentChain[0].name).toBe('Stanton');
        expect(parentChain[1].name).toBe('Crusader');
        expect(parentChain[2].name).toBe('Daymar');
        expect(parentChain[3].name).toBe('Grim HEX');
      }
    });
  });
}); 