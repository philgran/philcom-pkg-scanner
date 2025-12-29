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
 */
export function buildPurl(
  dependency: Dependency,
  ecosystem: string = 'npm'
): string {
  return `pkg:${ecosystem}/${dependency.name}@${dependency.version}`;
}

/**
 * Build the OSV querybatch payload from dependencies
 */
export function buildQueryBatchPayload(
  dependencies: Dependency[],
  ecosystem: string = 'npm'
): OSVQueryBatchRequest {
  const queries: OSVQuery[] = dependencies.map((dep) => ({
    package: {
      purl: buildPurl(dep, ecosystem),
    },
  }));

  return { queries };
}

/**
 * Call the OSV API querybatch endpoint
 */
export async function queryOSVBatch(
  dependencies: Dependency[],
  ecosystem: string = 'npm'
): Promise<OSVQueryBatchResponse> {
  const payload = buildQueryBatchPayload(dependencies, ecosystem);
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
 */
export async function checkVulnerabilities(
  dependencies: Dependency[],
  ecosystem: string = 'npm'
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
  const response = await queryOSVBatch(dependencies, ecosystem);

  // Get statistics
  const stats = getVulnerabilityStats(response);

  // Build vulnerable packages array
  const packages: VulnerablePackage[] = [];

  // Loop through results and build array of package meta data
  response.results.forEach((result, index) => {
    if (result.vulns && result.vulns.length > 0) {
      const dep = dependencies[index];
      const purl = buildPurl(dep, ecosystem);

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
