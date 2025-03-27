import { CelestialSystem } from '../../stores/useAppStore';
import { isValidJson } from '../../utils/validationUtils';

/**
 * DataLoader service for loading celestial data
 * This service handles fetching and parsing data from the static JSON file
 */
export class DataLoader {
  private static instance: DataLoader;
  private dataPath: string = '/data/stanton_extract.json';
  private cachedSystem: CelestialSystem | null = null;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of the DataLoader
   */
  public static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }

  /**
   * Set the path to the data file
   * @param path Path to the data file
   */
  public setDataPath(path: string): void {
    this.dataPath = path;
    // Reset cache when changing data source
    this.cachedSystem = null;
  }

  /**
   * Load celestial system data from the specified file
   * @param forceRefresh Force a refresh of the data (ignore cache)
   * @returns Promise with the loaded celestial system data
   */
  public async loadCelestialSystem(forceRefresh: boolean = false): Promise<CelestialSystem> {
    // Return cached data if available and refresh not forced
    if (this.cachedSystem && !forceRefresh) {
      return Promise.resolve(this.cachedSystem);
    }

    try {
      const response = await fetch(this.dataPath);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
      }
      
      const jsonData = await response.text();
      
      if (!isValidJson(jsonData)) {
        throw new Error('Invalid JSON data received');
      }
      
      const systemData = JSON.parse(jsonData) as CelestialSystem;
      
      // Cache the loaded data
      this.cachedSystem = systemData;
      
      return systemData;
    } catch (error) {
      console.error('Error loading celestial data:', error);
      throw error;
    }
  }

  /**
   * Clear the cached data
   */
  public clearCache(): void {
    this.cachedSystem = null;
  }
}

// Export a default instance for easy imports
export default DataLoader.getInstance(); 