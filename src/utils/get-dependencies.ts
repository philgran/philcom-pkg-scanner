import { existsSync, statSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { NpmParser, Dependency } from '../parsers/npm-parser';
import { PythonParser } from '../parsers/python-parser';

/**
 * Parse a single dependency file
 */
function parseDependencyFile(filePath: string): Dependency[] {
  const fileName = basename(filePath);
  let dependencies: Dependency[] = [];

  // Determine file type and parse accordingly
  if (fileName === 'package-lock.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageLock(filePath);
  } else if (fileName === 'yarn.lock') {
    const parser = new NpmParser();
    dependencies = parser.parseYarnLock(filePath);
  } else if (fileName === 'package.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageJson(filePath);
  } else if (fileName === 'requirements.txt') {
    const parser = new PythonParser();
    dependencies = parser.parseRequirementsTxt(filePath);
  }

  return dependencies;
}

/**
 * Recursively find all dependency files in a directory
 */
function findDependencyFiles(dirPath: string): string[] {
  const dependencyFiles: string[] = [];
  const targetFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'requirements.txt'];

  function scanDirectory(currentPath: string) {
    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        // Skip node_modules and hidden directories
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
          }
          scanDirectory(fullPath);
        } else if (entry.isFile() && targetFiles.includes(entry.name)) {
          dependencyFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Warning: Could not read directory ${currentPath}`);
    }
  }

  scanDirectory(dirPath);
  return dependencyFiles;
}

/**
 * Get all dependencies from a directory (scans recursively for dependency files)
 * Supports: package.json, package-lock.json, yarn.lock, requirements.txt
 */
export function getDependencies(dirPath: string): Dependency[] {
  if (!existsSync(dirPath)) {
    throw new Error(`Path not found: ${dirPath}`);
  }

  const stats = statSync(dirPath);

  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  // Find all dependency files recursively
  const dependencyFiles = findDependencyFiles(dirPath);

  if (dependencyFiles.length === 0) {
    console.warn('No dependency files found in directory');
    return [];
  }

  console.log(`Found ${dependencyFiles.length} dependency file(s):`);
  dependencyFiles.forEach(file => {
    console.log(`  - ${file}`);
  });

  // Parse all files and collect dependencies
  const allDependencies = new Map<string, Dependency>();

  for (const file of dependencyFiles) {
    try {
      const deps = parseDependencyFile(file);

      // Deduplicate by name@version
      deps.forEach(dep => {
        const key = `${dep.name}@${dep.version}`;
        if (!allDependencies.has(key)) {
          allDependencies.set(key, dep);
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not parse ${file}: ${(error as Error).message}`);
    }
  }

  return Array.from(allDependencies.values()).sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.version.localeCompare(b.version);
  });
}
