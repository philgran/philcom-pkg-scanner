import { existsSync } from 'fs';
import { basename } from 'path';
import { NpmParser, Dependency } from '../parsers/npm-parser';
import { PythonParser } from '../parsers/python-parser';

/**
 * Get all dependencies from a dependency file
 * Supports: package.json, package-lock.json, requirements.txt
 */
export function getDependencies(filePath: string): Dependency[] {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileName = basename(filePath);
  let dependencies: Dependency[] = [];

  // Determine file type and parse accordingly
  if (fileName === 'package-lock.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageLock(filePath);
  } else if (fileName === 'package.json') {
    const parser = new NpmParser();
    dependencies = parser.parsePackageJson(filePath);
  } else if (fileName === 'requirements.txt') {
    const parser = new PythonParser();
    dependencies = parser.parseRequirementsTxt(filePath);
  } else {
    throw new Error(
      'Unsupported file type. Please provide package.json, package-lock.json, or requirements.txt'
    );
  }

  return dependencies;
}
