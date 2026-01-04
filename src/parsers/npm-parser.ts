import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export type PackageSource = 'npm' | 'git' | 'github' | 'gitlab' | 'bitbucket' | 'svn' | 'http' | 'https' | 'file' | 'link' | 'unknown';

export interface Dependency {
  name: string;
  version: string;
  ecosystem?: 'npm' | 'pypi';
  sha512?: boolean;
  source?: PackageSource;
  resolved?: string;
}

/**
 * This class parses package, package-lock, and yarn.lock files and returns
 * dependencies in the form {packageName}@{semVer}.
 */
export class NpmParser {
  private dependencies: Map<string, Dependency> = new Map();

  /**
   * Determine the source type from a resolved URL
   */
  private getSourceType(resolved?: string): PackageSource {
    if (!resolved) return 'unknown';

    if (resolved.startsWith('git+')) return 'git';
    if (resolved.startsWith('github:') || resolved.includes('github.com')) return 'github';
    if (resolved.startsWith('gitlab:') || resolved.includes('gitlab.com')) return 'gitlab';
    if (resolved.startsWith('bitbucket:') || resolved.includes('bitbucket.org')) return 'bitbucket';
    if (resolved.startsWith('svn+')) return 'svn';
    if (resolved.startsWith('http://')) return 'http';
    if (resolved.startsWith('https://registry.npmjs.org') || resolved.startsWith('https://registry.yarnpkg.com')) return 'npm';
    if (resolved.startsWith('https://')) return 'https';
    if (resolved.startsWith('file:')) return 'file';
    if (resolved.startsWith('link:')) return 'link';

    return 'unknown';
  }

  /**
   * Check if integrity hash is SHA-512
   */
  private isSha512(integrity?: string): boolean {
    if (!integrity) return false;
    return integrity.startsWith('sha512-');
  }

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
      const name = pkgData.name || this.extractNameFromPath(path);

      if (name && pkgData.version) {
        this.addDependency(
          name,
          pkgData.version,
          pkgData.resolved,
          pkgData.integrity
        );
      }
    }
  }

  private extractNameFromPath(path: string): string | null {
    const match = path.match(/node_modules\/([^/]+)$/);
    return match ? match[1] : null;
  }

  private extractFromDependenciesV1(dependencies: any): void {
    for (const [name, data] of Object.entries(dependencies)) {
      const depData = data as any;
      if (depData.version) {
        this.addDependency(
          name,
          depData.version,
          depData.resolved,
          depData.integrity
        );
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
          // Yarn.lock doesn't have resolved/integrity in the same format
          this.addDependency(currentPackage, currentVersion, undefined, undefined);
          currentPackage = null;
          currentVersion = null;
        }
      }
    }
  }

  private addDependency(
    name: string,
    version: string,
    resolved?: string,
    integrity?: string
  ): void {
    const key = `${name}@${version}`;

    // Only add if not already present (to avoid duplicates)
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, {
        name,
        version,
        sha512: this.isSha512(integrity),
        source: this.getSourceType(resolved),
        resolved
      });
    }
  }

  private getDependencyList(): Dependency[] {
    const result = Array.from(this.dependencies.values());

    return result.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.version.localeCompare(b.version);
    });
  }
}
