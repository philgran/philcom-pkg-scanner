import { writeFileSync } from 'fs';
import { Dependency } from '../parsers/npm-parser';
import { VulnerabilityCheckResult } from './osv-client';
import { GHSAAdvisory } from './ghsa-client';

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

  /**
   * Display vulnerability report with GHSA details
   */
  static async getReport(
    vulnerabilityResults: VulnerabilityCheckResult,
    getAdvisory: (ghsaId: string) => Promise<GHSAAdvisory | null>
  ): Promise<void> {
    // Display results
    console.log('\n=== Vulnerability Report ===');
    console.log(`Total packages checked: ${vulnerabilityResults.totalPackages}`);
    console.log(`Vulnerable packages: ${vulnerabilityResults.vulnerablePackages}`);
    console.log(`Total vulnerabilities: ${vulnerabilityResults.totalVulnerabilities}`);

    // Fetch GHSA details for each vulnerability
    if (vulnerabilityResults.packages.length > 0) {
      console.log('\n=== Fetching GHSA Details ===');

      for (const pkg of vulnerabilityResults.packages) {
        console.log(`\n${pkg.name}@${pkg.version} (${pkg.purl})`);

        for (const vuln of pkg.vulnerabilities) {
          const advisory = await getAdvisory(vuln.ghsa_id);

          if (advisory) {
            console.log(`  - ${vuln.ghsa_id}`);
            if (vuln.details) console.log(`    Summary: ${vuln.details}`);
            if (advisory.cvss?.score) console.log(`    CVSS Score: ${advisory.cvss.score}`);
            if (advisory.html_url) console.log(`    HTML: ${advisory.html_url}`);
            if (advisory.url) console.log(`    JSON: ${advisory.url}`);
          } else {
            console.log(`  - ${vuln.ghsa_id} (details not available)`);
          }

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } else {
      console.log('\n✓ No vulnerabilities found!');
    }
  }
}
