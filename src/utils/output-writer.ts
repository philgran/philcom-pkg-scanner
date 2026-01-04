import { writeFileSync } from 'fs';
import { Dependency } from '../parsers/npm-parser';
import { VulnerabilityCheckResult } from './osv-client';
import { GHSAAdvisory } from './ghsa-client';

export class OutputWriter {
  /**
   * Write dependencies to a text file, grouped by ecosystem
   * @param dependencies - Array of dependencies to write
   * @param outputPath - The file path where dependencies should be written
   */
  static writeDependencies(dependencies: Dependency[], outputPath: string): void {
    // Group dependencies by ecosystem
    const npmDeps: Dependency[] = [];
    const pypiDeps: Dependency[] = [];
    const unknownDeps: Dependency[] = [];

    for (const dep of dependencies) {
      if (dep.ecosystem === 'npm') {
        npmDeps.push(dep);
      } else if (dep.ecosystem === 'pypi') {
        pypiDeps.push(dep);
      } else {
        unknownDeps.push(dep);
      }
    }

    // Build output content with sections
    const sections: string[] = [];

    if (npmDeps.length > 0) {
      sections.push('# NPM Packages');
      sections.push(...npmDeps.map(dep => `${dep.name}@${dep.version}`));
      sections.push(''); // Empty line between sections
    }

    if (pypiDeps.length > 0) {
      sections.push('# PyPI Packages');
      sections.push(...pypiDeps.map(dep => `${dep.name}@${dep.version}`));
      sections.push(''); // Empty line between sections
    }

    if (unknownDeps.length > 0) {
      sections.push('# Other Packages');
      sections.push(...unknownDeps.map(dep => `${dep.name}@${dep.version}`));
    }

    const content = sections.join('\n');
    writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Get dependency count including duplicates with different versions
   * @param dependencies - Array of dependencies to analyze
   * @returns Object containing total count, unique count, and packages with multiple versions
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
   * @param vulnerabilityResults - The vulnerability check results from OSV API
   * @param getAdvisory - Function to fetch GHSA advisory details by ID
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
            // Pluck the summary, description is way too long for STDOUT
            if (advisory.summary) console.log(`    Summary: ${advisory.summary}`);

            // Visual cue of severity based on arbitrarily selected ranges ¯\_(ツ)_/¯
            if (advisory.cvss?.score) {
              let emoji = '🟢'; // Low severity (< 3.5)
              if (advisory.cvss.score >= 7.5) {
                emoji = '🔴'; // High/Critical severity
              } else if (advisory.cvss.score >= 3.5) {
                emoji = '🟡'; // Medium severity
              }
              console.log(`    CVSS Score: ${advisory.cvss.score} ${emoji}`);
            }

            // Expose CVE ID and link to vulnerability on NVD website
            if (advisory.cve_id) {
              console.log(`    CVE ID: ${advisory.cve_id}`)
              console.log(`    NVD link: https://nvd.nist.gov/vuln/detail/${advisory.cve_id}`)
            }

            // Display EPSS information if available
            if (advisory.epss?.percentage !== undefined && advisory.epss?.percentile !== undefined) {
              const exploitChance = (advisory.epss.percentage * 100).toFixed(2);
              const riskierThan = (advisory.epss.percentile * 100).toFixed(2);
              const lessRiskyThan = (100 - advisory.epss.percentile * 100).toFixed(2);
              console.log(`    EPSS: There is a ${exploitChance}% chance that this vulnerability will be exploited in the next 30 days.`);
              console.log(`          This vulnerability is riskier than about ${riskierThan}% of known vulnerabilities, and less risky than about ${lessRiskyThan}%.`);
            }

            // Link to advisory source in HTML and JSON since we get that for free
            if (advisory.html_url) console.log(`    HTML: ${advisory.html_url}`);
            if (advisory.url) console.log(`    JSON: ${advisory.url}`);
          } else {
            // Oops we can't find it
            console.log(`  - ${vuln.ghsa_id} (details not available)`);
          }

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } else {
      // You're good YAY!!1
      console.log('\n✓ No vulnerabilities found!');
    }
  }

  /**
   * Get vulnerability report as JSON with GHSA details
   * @param vulnerabilityResults - The vulnerability check results from OSV API
   * @param getAdvisory - Function to fetch GHSA advisory details by ID
   * @returns Promise resolving to JSON report object
   */
  static async getReportJSON(
    vulnerabilityResults: VulnerabilityCheckResult,
    getAdvisory: (ghsaId: string) => Promise<GHSAAdvisory | null>
  ): Promise<object> {
    const report = {
      summary: {
        totalPackages: vulnerabilityResults.totalPackages,
        vulnerablePackages: vulnerabilityResults.vulnerablePackages,
        totalVulnerabilities: vulnerabilityResults.totalVulnerabilities,
      },
      vulnerabilities: [] as Array<{
        package: {
          name: string;
          version: string;
          purl: string;
        };
        advisories: Array<{
          ghsa_id: string;
          cve_id?: string;
          summary?: string;
          description?: string;
          severity?: string;
          cvss?: {
            score?: number;
            vector_string?: string;
          };
          epss?: {
            percentage?: number;
            percentile?: number;
            exploitChance?: string;
            riskierThan?: string;
            lessRiskyThan?: string;
          };
          published_at?: string;
          updated_at?: string;
          html_url?: string;
          url?: string;
        }>;
      }>,
    };

    // Fetch GHSA details for each vulnerability
    for (const pkg of vulnerabilityResults.packages) {
      const packageVulns: any = {
        package: {
          name: pkg.name,
          version: pkg.version,
          purl: pkg.purl,
        },
        advisories: [],
      };

      for (const vuln of pkg.vulnerabilities) {
        const advisory = await getAdvisory(vuln.ghsa_id);

        if (advisory) {
          const advisoryData: any = {
            ghsa_id: advisory.ghsa_id,
          };

          if (advisory.cve_id) {
            advisoryData.cve_id = advisory.cve_id;
            advisoryData.nvd_link = `https://nvd.nist.gov/vuln/detail/${advisory.cve_id}`
          }
          if (advisory.summary) advisoryData.summary = advisory.summary;
          if (advisory.description) advisoryData.description = advisory.description;
          if (advisory.severity) advisoryData.severity = advisory.severity;
          if (advisory.cvss) advisoryData.cvss = advisory.cvss;

          // Add EPSS data with calculated values
          if (advisory.epss?.percentage !== undefined && advisory.epss?.percentile !== undefined) {
            advisoryData.epss = {
              percentage: advisory.epss.percentage,
              percentile: advisory.epss.percentile,
              exploitChance: (advisory.epss.percentage * 100).toFixed(2),
              riskierThan: (advisory.epss.percentile * 100).toFixed(2),
              lessRiskyThan: (100 - advisory.epss.percentile * 100).toFixed(2),
            };
          }

          if (advisory.published_at) advisoryData.published_at = advisory.published_at;
          if (advisory.updated_at) advisoryData.updated_at = advisory.updated_at;
          if (advisory.html_url) advisoryData.html_url = advisory.html_url;
          if (advisory.url) advisoryData.url = advisory.url;

          packageVulns.advisories.push(advisoryData);
        } else {
          packageVulns.advisories.push({
            ghsa_id: vuln.ghsa_id,
            error: 'Details not available',
          });
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      report.vulnerabilities.push(packageVulns);
    }

    return report;
  }
}
