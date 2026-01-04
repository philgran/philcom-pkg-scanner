import { existsSync, statSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { NpmParser, Dependency } from '../parsers/npm-parser';
import { PythonParser } from '../parsers/python-parser';

/**
 * Parse a single dependency file based on its type
 * @param filePath - The absolute path to the dependency file
 * @returns Promise resolving to array of dependencies extracted from the file
 */
async function parseDependencyFile(filePath: string): Promise<Dependency[]> {
  const fileName = basename(filePath);
  let dependencies: Dependency[] = [];
  let ecosystem: 'npm' | 'pypi' | undefined;

  // Determine file type and parse accordingly
  if (fileName === 'package-lock.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageLock(filePath);
    ecosystem = 'npm';
  } else if (fileName === 'yarn.lock') {
    const parser = new NpmParser();
    dependencies = parser.parseYarnLock(filePath);
    ecosystem = 'npm';
  } else if (fileName === 'package.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageJson(filePath);
    ecosystem = 'npm';
  } else if (fileName === 'requirements.txt') {
    const parser = new PythonParser();
    dependencies = await parser.parseRequirementsTxt(filePath);
    ecosystem = 'pypi';
  }

  // console.log('DEPS', dependencies)

  // Add ecosystem to each dependency
  return dependencies.map(dep => ({ ...dep, ecosystem }));
}

/**
 * Recursively find all dependency files in a directory
 * @param dirPath - The directory path to search
 * @returns Array of absolute paths to found dependency files
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
 * Get all dependencies from a path (file or directory)
 * Supports: package.json, package-lock.json, yarn.lock, requirements.txt
 * @param path - The file or directory path to scan for dependency files
 * @returns Promise resolving to array of all unique dependencies found, deduplicated by name@version
 */
export async function getDependencies(path: string): Promise<Dependency[]> {
  if (!existsSync(path)) {
    throw new Error(`Path not found: ${path}`);
  }

  const stats = statSync(path);
  let dependencyFiles: string[] = [];

  if (stats.isFile()) {
    // Single file - validate it's a supported dependency file
    const fileName = basename(path);
    const supportedFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'requirements.txt'];

    if (!supportedFiles.includes(fileName)) {
      throw new Error(`Unsupported file type: ${fileName}. Supported files: ${supportedFiles.join(', ')}`);
    }

    dependencyFiles = [path];
    console.log(`Processing file: ${path}`);
  } else if (stats.isDirectory()) {
    // Directory - find all dependency files recursively
    dependencyFiles = findDependencyFiles(path);

    if (dependencyFiles.length === 0) {
      console.warn('No dependency files found in directory');
      return [];
    }

    console.log(`Found ${dependencyFiles.length} dependency file(s):`);
    dependencyFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
  } else {
    throw new Error(`Path is neither a file nor a directory: ${path}`);
  }

  // Parse all files and collect dependencies
  const allDependencies = new Map<string, Dependency>();

  for (const file of dependencyFiles) {
    try {
      const deps = await parseDependencyFile(file);

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
