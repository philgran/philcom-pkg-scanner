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
 * Determine the ecosystem from the dependency source
 * For now, defaults to 'npm' but can be extended based on file type
 */
function determineEcosystem(fileType?: string): string {
  if (fileType === 'requirements.txt') {
    return 'pypi';
  }
  // Default to npm for package.json and package-lock.json
  return 'npm';
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

/**
 * Check dependencies for vulnerabilities and print results
 */
export async function checkVulnerabilities(
  dependencies: Dependency[],
  ecosystem: string = 'npm'
): Promise<void> {
  if (dependencies.length === 0) {
    console.log('No dependencies to check.');
    return;
  }

  console.log(`\nChecking ${dependencies.length} dependencies for vulnerabilities...`);

  // Call OSV API
  const response = await queryOSVBatch(dependencies, ecosystem);

  // Get statistics
  const stats = getVulnerabilityStats(response);

  console.log('\n=== Vulnerability Report ===');
  console.log(`Total packages checked: ${stats.totalPackages}`);
  console.log(`Vulnerable packages: ${stats.vulnerablePackages}`);
  console.log(`Total vulnerabilities: ${stats.totalVulnerabilities}`);

  // Show details of vulnerable packages
  if (stats.vulnerablePackages > 0) {
    console.log('\n=== Vulnerable Packages ===');
    response.results.forEach((result, index) => {
      if (result.vulns && result.vulns.length > 0) {
        const dep = dependencies[index];
        console.log(`\n${dep.name}@${dep.version}`);
        result.vulns.forEach((vuln) => {
          console.log(`  - ${vuln.id}${vuln.summary ? ': ' + vuln.summary : ''}`);
        });
      }
    });
  } else {
    console.log('\n✓ No vulnerabilities found!');
  }
}
