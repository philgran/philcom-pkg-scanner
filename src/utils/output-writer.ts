import { writeFileSync } from 'fs';
import { Dependency } from '../parsers/npm-parser';

export class OutputWriter {
  /**
   * Write dependencies to a text file, one per line in format: name@version
   */
  static writeDependencies(dependencies: Dependency[], outputPath: string): void {
    const lines = dependencies.map(dep => `${dep.name}@${dep.version}`);
    const content = lines.join('\n') + '\n';

    writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Get dependency count including duplicates with different versions
   */
  static getDependencyStats(dependencies: Dependency[]): {
    total: number;
    unique: number;
    multipleVersions: string[];
  } {
    const nameVersionMap = new Map<string, Set<string>>();

    for (const dep of dependencies) {
      if (!nameVersionMap.has(dep.name)) {
        nameVersionMap.set(dep.name, new Set());
      }
      nameVersionMap.get(dep.name)!.add(dep.version);
    }

    const multipleVersions: string[] = [];
    for (const [name, versions] of nameVersionMap.entries()) {
      if (versions.size > 1) {
        multipleVersions.push(name);
      }
    }

    return {
      total: dependencies.length,
      unique: nameVersionMap.size,
      multipleVersions
    };
  }
}
