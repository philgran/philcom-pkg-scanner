import * as levenshtein from 'fast-levenshtein';
import { Dependency } from '../parsers/npm-parser';
import { POPULAR_NPM_PACKAGES, POPULAR_PYPI_PACKAGES } from './CONSTANTS';

export interface TyposquattingResult {
  package: string;
  version: string;
  isTyposquatting: boolean;
  suspectedTarget?: string;
  distance?: number;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Check if a package name might be typosquatting a popular package
 * @param packageName - The package name to check
 * @param ecosystem - The package ecosystem ('npm' or 'pypi')
 * @returns Object with typosquatting detection results
 */
export function checkTyposquatting(
  packageName: string,
  ecosystem: string
): Omit<TyposquattingResult, 'package' | 'version'> {
  // Select appropriate popular packages list
  const popularPackages = ecosystem === 'npm' ? POPULAR_NPM_PACKAGES : POPULAR_PYPI_PACKAGES;

  // If the package is in the popular list, it's not typosquatting
  if (popularPackages.includes(packageName)) {
    return { isTyposquatting: false };
  }

  let closestMatch: string | undefined;
  let minDistance = Infinity;

  // Check against all popular packages
  for (const popularPkg of popularPackages) {
    const distance = levenshtein.get(packageName, popularPkg);

    // Only consider if the names are similar in length (within 2 characters)
    const lengthDiff = Math.abs(packageName.length - popularPkg.length);
    if (lengthDiff > 2) continue;

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = popularPkg;
    }
  }

  // Determine if it's likely typosquatting based on distance
  // Distance of 1-2: high confidence (single typo or missing/extra char)
  // Distance of 3: medium confidence (couple typos)
  if (minDistance === 1) {
    return {
      isTyposquatting: true,
      suspectedTarget: closestMatch,
      distance: minDistance,
      confidence: 'high',
    };
  } else if (minDistance === 2) {
    return {
      isTyposquatting: true,
      suspectedTarget: closestMatch,
      distance: minDistance,
      confidence: 'high',
    };
  } else if (minDistance === 3) {
    return {
      isTyposquatting: true,
      suspectedTarget: closestMatch,
      distance: minDistance,
      confidence: 'medium',
    };
  }

  return { isTyposquatting: false };
}

/**
 * Scan a list of dependencies for potential typosquatting
 * @param dependencies - Array of dependencies to scan
 * @returns Array of typosquatting results for flagged packages
 */
export function scanForTyposquatting(dependencies: Dependency[]): TyposquattingResult[] {
  const results: TyposquattingResult[] = [];

  for (const dep of dependencies) {
    const result = checkTyposquatting(dep.name, dep.ecosystem || 'npm');

    if (result.isTyposquatting) {
      results.push({
        package: dep.name,
        version: dep.version,
        ...result,
      });
    }
  }

  return results;
}

/**
 * Create a map of package names to their typosquatting results for quick lookup
 * @param dependencies - Array of dependencies to scan
 * @returns Map of package@version to typosquatting result
 */
export function createTyposquattingMap(dependencies: Dependency[]): Map<string, TyposquattingResult> {
  const map = new Map<string, TyposquattingResult>();
  const results = scanForTyposquatting(dependencies);

  for (const result of results) {
    const key = `${result.package}@${result.version}`;
    map.set(key, result);
  }

  return map;
}
