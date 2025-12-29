import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get the publication timestamp for a specific version of an npm package
 * @param packageName - The name of the npm package
 * @param version - The version of the package
 * @returns The ISO timestamp string when the version was published, or null if not found
 */
export async function getVersionTimestamp(
  packageName: string,
  version: string
): Promise<string | null> {
  try {
    // Use npm view to get the time data for the package
    const command = `npm view ${packageName} time --json`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.error(`Warning for ${packageName}: ${stderr}`);
    }

    // Parse the JSON output
    const timeData = JSON.parse(stdout);

    // Return the timestamp for the specific version
    if (timeData && timeData[version]) {
      return timeData[version];
    }

    return null;
  } catch (error) {
    console.error(`Error getting timestamp for ${packageName}@${version}: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Get timestamps for multiple package versions
 * @param packages - Array of {name, version} objects
 * @returns Map of "name@version" to timestamp
 */
export async function getVersionTimestamps(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const pkg of packages) {
    const timestamp = await getVersionTimestamp(pkg.name, pkg.version);
    if (timestamp) {
      results.set(`${pkg.name}@${pkg.version}`, timestamp);
    }
    // Small delay to avoid overwhelming npm registry
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
