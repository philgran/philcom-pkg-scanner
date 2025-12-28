import { readFileSync } from 'fs';

export interface Dependency {
  name: string;
  version: string;
}

export class PythonParser {
  /**
   * Parse requirements.txt to extract dependencies
   * Note: requirements.txt only contains direct dependencies, not transitive ones
   * unless they were explicitly pinned by pip freeze
   */
  parseRequirementsTxt(filePath: string): Dependency[] {
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
