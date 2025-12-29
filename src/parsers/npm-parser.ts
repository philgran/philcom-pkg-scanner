import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface Dependency {
  name: string;
  version: string;
  ecosystem?: 'npm' | 'pypi';
}

/**
 * This class parses package, package-lock, and yarn.lock files and returns
 * dependencies in the form {packageName}@{semVer}.
 */
export class NpmParser {
  private dependencies: Map<string, Set<string>> = new Map();

  /**
   * Parse package-lock.json to extract all dependencies (direct and transitive)
   * @param filePath - The absolute path to the package-lock.json file
   * @returns Array of all dependencies found in the lock file
   */
  parsePackageLock(filePath: string): Dependency[] {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));

    // Handle both lockfileVersion 1, 2, and 3
    if (content.lockfileVersion >= 2) {
      // v2 and v3 format uses "packages" field
      this.extractFromPackagesV2(content.packages || {});
    } else {
      // v1 format uses "dependencies" field
      this.extractFromDependenciesV1(content.dependencies || {});
    }

    return this.getDependencyList();
  }

  /**
   * Parse yarn.lock to extract all dependencies (direct and transitive)
   * @param filePath - The absolute path to the yarn.lock file
   * @returns Array of all dependencies found in the yarn lock file
   */
  parseYarnLock(filePath: string): Dependency[] {
    const content = readFileSync(filePath, 'utf-8');
    this.extractFromYarnLock(content);
    return this.getDependencyList();
  }

  /**
   * Parse package.json and resolve dependencies by reading node_modules
   * @param filePath - The absolute path to the package.json file
   * @returns Array of dependencies resolved from node_modules directories
   */
  parsePackageJson(filePath: string): Dependency[] {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    const baseDir = dirname(filePath);

    const allDeps = {
      ...content.dependencies,
      ...content.devDependencies,
      ...content.peerDependencies,
      ...content.optionalDependencies
    };

    // Try to find and parse package-lock.json first
    try {
      const lockPath = join(baseDir, 'package-lock.json');
      return this.parsePackageLock(lockPath);
    } catch (error) {
      // If no lock file, just return direct dependencies
      for (const [name, version] of Object.entries(allDeps)) {
        this.addDependency(name, version as string);
      }
      return this.getDependencyList();
    }
  }

  private extractFromPackagesV2(packages: any): void {
    for (const [path, pkg] of Object.entries(packages)) {
      if (path === '') continue; // Skip root package

      const pkgData = pkg as any;
      if (pkgData.name && pkgData.version) {
        this.addDependency(pkgData.name, pkgData.version);
      } else {
        // Extract name from path (e.g., "node_modules/express" -> "express")
        const match = path.match(/node_modules\/([^/]+)$/);
        if (match && pkgData.version) {
          this.addDependency(match[1], pkgData.version);
        }
      }
    }
  }

  private extractFromDependenciesV1(dependencies: any): void {
    for (const [name, data] of Object.entries(dependencies)) {
      const depData = data as any;
      if (depData.version) {
        this.addDependency(name, depData.version);
      }

      // Recursively process nested dependencies
      if (depData.dependencies) {
        this.extractFromDependenciesV1(depData.dependencies);
      }
    }
  }

  private extractFromYarnLock(content: string): void {
    // Yarn lock file format:
    // package-name@version-range:
    //   version "actual-version"
    //   resolved "url"
    //   dependencies:
    //     dep "version"

    const lines = content.split('\n');
    let currentPackage: string | null = null;
    let currentVersion: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check if this is a package declaration line
      // Format: "package-name@version-range:" or "package-name@version-range", "other@range":
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        // Extract package name from yarn.lock entry
        // Handle entries like: "lodash@^4.17.0"  or "@babel/core@^7.0.0", "@babel/core@^7.1.0":
        // For scoped packages (@scope/name), we need to capture @scope/name before the version @
        const packageMatch = line.match(/^"?(@?[^@\s]+(?:\/[^@\s]+)?)@[^",:]+[",:]/);
        if (packageMatch) {
          currentPackage = packageMatch[1];
          currentVersion = null;
        }
      } else if (currentPackage && trimmed.startsWith('version ')) {
        // Extract version: version "1.2.3"
        const versionMatch = trimmed.match(/version\s+"([^"]+)"/);
        if (versionMatch) {
          currentVersion = versionMatch[1];
          this.addDependency(currentPackage, currentVersion);
          currentPackage = null;
          currentVersion = null;
        }
      }
    }
  }

  private addDependency(name: string, version: string): void {
    if (!this.dependencies.has(name)) {
      this.dependencies.set(name, new Set());
    }
    this.dependencies.get(name)!.add(version);
  }

  private getDependencyList(): Dependency[] {
    const result: Dependency[] = [];

    for (const [name, versions] of this.dependencies.entries()) {
      for (const version of versions) {
        result.push({ name, version });
      }
    }

    return result.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.version.localeCompare(b.version);
    });
  }
}
