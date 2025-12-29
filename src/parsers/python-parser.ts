import { readFileSync } from 'fs';

export interface Dependency {
  name: string;
  version: string;
}

export class PythonParser {
  /**
   * Parse requirements.txt to extract dependencies (direct + one level of transitive deps)
   * @param filePath - The absolute path to the requirements.txt file
   * @returns Array of dependencies extracted from the file
   */
  async parseRequirementsTxt(filePath: string): Promise<Dependency[]> {
    // Parse direct dependencies from requirements.txt
    const directDeps = this.parseRequirementsTxtDirect(filePath);

    if (directDeps.length === 0) {
      return [];
    }

    console.log('Fetching first-level dependencies from PyPI API...');

    // Fetch first-level transitive dependencies (no recursion)
    const allDeps = await this.fetchFirstLevelDependencies(directDeps);

    return allDeps;
  }

  /**
   * Parse requirements.txt to extract direct dependencies only
   * @param filePath - The absolute path to the requirements.txt file
   * @returns Array of dependencies extracted from the file
   */
  private parseRequirementsTxtDirect(filePath: string): Dependency[] {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const dependencies: Dependency[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Skip pip flags and options
      if (trimmed.startsWith('-')) {
        continue;
      }

      // Parse dependency
      const dep = this.parseDependencyLine(trimmed);
      if (dep) {
        dependencies.push(dep);
      }
    }

    return dependencies.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.version.localeCompare(b.version);
    });
  }

  /**
   * Fetch first-level dependencies from PyPI API (no recursion)
   * @param directDeps - Array of direct dependencies from requirements.txt
   * @returns Array of all dependencies including one level of transitive deps
   */
  private async fetchFirstLevelDependencies(directDeps: Dependency[]): Promise<Dependency[]> {
    const allDeps = new Map<string, string>();

    // Add all direct dependencies, normalizing version ranges to exact versions
    for (const dep of directDeps) {
      const normalizedVersion = this.normalizeVersion(dep.version);
      if (normalizedVersion) {
        allDeps.set(dep.name, normalizedVersion);
      }
    }

    // Fetch first-level transitive dependencies for each direct dependency
    for (const dep of directDeps) {
      const normalizedVersion = this.normalizeVersion(dep.version);
      if (!normalizedVersion) {
        continue;
      }

      try {
        const subDeps = await this.fetchPyPIDependencies(dep.name, normalizedVersion);

        // Add transitive dependencies, normalizing their versions
        for (const subDep of subDeps) {
          if (!allDeps.has(subDep.name)) {
            const normalizedSubVersion = this.normalizeVersion(subDep.version);
            if (normalizedSubVersion) {
              allDeps.set(subDep.name, normalizedSubVersion);
            }
          }
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to fetch dependencies for ${dep.name}@${normalizedVersion}: ${(error as Error).message}`);
      }
    }

    // Convert to array and sort
    return Array.from(allDeps.entries())
      .map(([name, version]) => ({ name, version }))
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return a.version.localeCompare(b.version);
      });
  }

  /**
   * Normalize a version string to an exact version for scanning
   * For exact versions: return as-is
   * For ranges: extract the lowest possible version
   * For wildcards: extract the major version
   * @param version - The version string (may be exact, range, or wildcard)
   * @returns Normalized exact version, or null if cannot be normalized
   */
  private normalizeVersion(version: string): string | null {
    // Already exact version
    if (!/[<>=!~,*]/.test(version)) {
      return version;
    }

    // Handle wildcards like "2.*" -> "2.0.0"
    if (version.includes('*')) {
      const parts = version.split('.');
      const normalized = parts.map(p => p === '*' ? '0' : p).join('.');
      // Ensure at least 3 parts
      const versionParts = normalized.split('.');
      while (versionParts.length < 3) {
        versionParts.push('0');
      }
      return versionParts.join('.');
    }

    // Handle version constraints - extract the lowest possible version
    // Split by comma to handle compound constraints like ">=1.7.4,!=1.8.1,<3.0.0"
    const constraints = version.split(',').map(s => s.trim());

    // Find >= or > constraints (lower bounds)
    for (const constraint of constraints) {
      // Match >= or >
      const match = constraint.match(/^>=?\s*([0-9.]+)/);
      if (match) {
        return match[1];
      }
    }

    // If no lower bound found, look for == constraints
    for (const constraint of constraints) {
      const match = constraint.match(/^==\s*([0-9.]+)/);
      if (match) {
        return match[1];
      }
    }

    // If only upper bounds or != constraints, try to extract a version from any constraint
    for (const constraint of constraints) {
      const match = constraint.match(/[0-9]+\.[0-9.]+/);
      if (match) {
        return match[0];
      }
    }

    // Cannot normalize
    return null;
  }

  /**
   * Fetch dependencies for a package from PyPI JSON API
   * @param packageName - The package name
   * @param version - The package version
   * @returns Array of dependencies from requires_dist field
   */
  private async fetchPyPIDependencies(packageName: string, version: string): Promise<Dependency[]> {
    const url = `https://pypi.org/pypi/${packageName}/${version}/json`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { info?: { requires_dist?: string[] } };
      const requiresDist: string[] = data.info?.requires_dist || [];

      return this.parseRequiresDist(requiresDist);
    } catch (error) {
      throw new Error(`Failed to fetch PyPI data: ${(error as Error).message}`);
    }
  }

  /**
   * Parse requires_dist array from PyPI API response
   * @param requiresDist - Array of requirement strings from PyPI
   * @returns Array of dependencies
   */
  private parseRequiresDist(requiresDist: string[]): Dependency[] {
    const dependencies: Dependency[] = [];

    for (const req of requiresDist) {
      // Skip extras and environment markers
      // Example: "requests (>=2.0.0) ; extra == 'dev'"
      // Example: "pytest ; python_version >= '3.6'"
      if (req.includes(';')) {
        const beforeSemicolon = req.split(';')[0].trim();
        const dep = this.parseDependencyLine(beforeSemicolon);
        if (dep) {
          dependencies.push(dep);
        }
      } else {
        const dep = this.parseDependencyLine(req);
        if (dep) {
          dependencies.push(dep);
        }
      }
    }

    return dependencies;
  }

  /**
   * Parse a single dependency line from requirements.txt
   * @param line - A single line from requirements.txt
   * @returns Dependency object with name and version, or null if line cannot be parsed
   */
  private parseDependencyLine(line: string): Dependency | null {
    // Handle various requirement specifier formats:
    // package==1.0.0
    // package>=1.0.0
    // package~=1.0.0
    // package[extra]==1.0.0
    // git+https://...
    // file:///...
    // package @ https://...

    // Skip VCS and file URLs
    if (line.startsWith('git+') || line.startsWith('hg+') ||
        line.startsWith('svn+') || line.startsWith('bzr+') ||
        line.startsWith('file:') || line.includes(' @ ')) {
      return null;
    }

    // Remove extras (e.g., package[extra])
    const withoutExtras = line.replace(/\[.*?\]/, '');

    // Match package name and version
    // Matches: package==1.0.0, package>=1.0.0, etc.
    const match = withoutExtras.match(/^([a-zA-Z0-9\-_.]+)\s*([=<>!~]+)\s*(.+?)(\s*;.*)?$/);

    if (match) {
      const name = match[1].trim();
      const version = match[3].trim();
      return { name, version };
    }

    // If no version specifier, treat it as unversioned
    const nameOnlyMatch = withoutExtras.match(/^([a-zA-Z0-9\-_.]+)\s*$/);
    if (nameOnlyMatch) {
      return { name: nameOnlyMatch[1].trim(), version: '*' };
    }

    return null;
  }
}
