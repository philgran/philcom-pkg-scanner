import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface Dependency {
  name: string;
  version: string;
}

export class NpmParser {
  private dependencies: Map<string, Set<string>> = new Map();

  /**
   * Parse package-lock.json to extract all dependencies (direct and transitive)
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
   * Parse package.json and resolve dependencies by reading node_modules
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
