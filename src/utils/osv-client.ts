import { Dependency } from '../parsers/npm-parser';

export interface OSVQuery {
  package: {
    purl: string;
  };
}

export interface OSVQueryBatchRequest {
  queries: OSVQuery[];
}

export interface OSVVulnerability {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  modified?: string;
  published?: string;
  database_specific?: any;
  severity?: any[];
  affected?: any[];
  references?: any[];
}

export interface OSVQueryResult {
  vulns?: OSVVulnerability[];
}

export interface OSVQueryBatchResponse {
  results: OSVQueryResult[];
}

/**
 * Build a Package URL (purl) for a dependency
 * @param dependency - The dependency object containing name, version, and ecosystem
 * @returns A Package URL string in the format pkg:ecosystem/name@version
 */
export function buildPurl(dependency: Dependency): string {
  const ecosystem = dependency.ecosystem || 'npm';
  return `pkg:${ecosystem}/${dependency.name}@${dependency.version}`;
}

/**
 * Build the OSV querybatch payload from dependencies
 * @param dependencies - Array of dependencies to check for vulnerabilities (each with ecosystem property)
 * @returns OSV API query batch request payload
 */
export function buildQueryBatchPayload(
  dependencies: Dependency[]
): OSVQueryBatchRequest {
  const queries: OSVQuery[] = dependencies.map((dep) => ({
    package: {
      purl: buildPurl(dep),
    },
  }));

  return { queries };
}

/**
 * Call the OSV API querybatch endpoint
 * @param dependencies - Array of dependencies to check for vulnerabilities (each with ecosystem property)
 * @returns Promise resolving to the OSV API batch response
 */
export async function queryOSVBatch(
  dependencies: Dependency[]
): Promise<OSVQueryBatchResponse> {
  const payload = buildQueryBatchPayload(dependencies);
  const url = 'https://api.osv.dev/v1/querybatch';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `OSV API request failed: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as OSVQueryBatchResponse;
}

/**
 * Get vulnerability count from OSV response
 * @param response - The OSV API batch query response
 * @returns Object containing vulnerability statistics
 */
export function getVulnerabilityStats(response: OSVQueryBatchResponse): {
  totalPackages: number;
  vulnerablePackages: number;
  totalVulnerabilities: number;
} {
  let vulnerablePackages = 0;
  let totalVulnerabilities = 0;

  for (const result of response.results) {
    if (result.vulns && result.vulns.length > 0) {
      vulnerablePackages++;
      totalVulnerabilities += result.vulns.length;
    }
  }

  return {
    totalPackages: response.results.length,
    vulnerablePackages,
    totalVulnerabilities,
  };
}

export interface VulnerablePackage {
  purl: string;
  name: string;
  version: string;
  vulnerabilities: Array<{
    ghsa_id: string;
    details?: string;
  }>;
}

export interface VulnerabilityCheckResult {
  totalPackages: number;
  vulnerablePackages: number;
  totalVulnerabilities: number;
  packages: VulnerablePackage[];
}

/**
 * Check dependencies for vulnerabilities and return structured data
 * @param dependencies - Array of dependencies to check for vulnerabilities (each with ecosystem property)
 * @returns Promise resolving to structured vulnerability check results
 */
export async function checkVulnerabilities(
  dependencies: Dependency[]
): Promise<VulnerabilityCheckResult> {
  if (dependencies.length === 0) {
    return {
      totalPackages: 0,
      vulnerablePackages: 0,
      totalVulnerabilities: 0,
      packages: [],
    };
  }

  // Call OSV API
  const response = await queryOSVBatch(dependencies);

  // Get statistics
  const stats = getVulnerabilityStats(response);

  // Build vulnerable packages array
  const packages: VulnerablePackage[] = [];

  // Loop through results and build array of package meta data
  response.results.forEach((result, index) => {
    if (result.vulns && result.vulns.length > 0) {
      const dep = dependencies[index];
      const purl = buildPurl(dep);

      packages.push({
        purl,
        name: dep.name,
        version: dep.version,
        vulnerabilities: result.vulns.map((vuln) => ({
          ghsa_id: vuln.id,
          details: vuln.summary,
        })),
      });
    }
  });

  return {
    totalPackages: stats.totalPackages,
    vulnerablePackages: stats.vulnerablePackages,
    totalVulnerabilities: stats.totalVulnerabilities,
    packages,
  };
}
