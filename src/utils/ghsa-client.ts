import { Octokit } from "octokit";

const octokit = new Octokit();

export interface GHSAAdvisory {
  ghsa_id: string;
  cve_id?: string;
  cvss?: {
    score?: number;
    vector_string?: string;
  };
  epss?: {
    percentage?: number;
    percentile?: number;
  };
  html_url?: string;
  url?: string;
  summary?: string;
  description?: string;
  severity?: string;
  published_at?: string;
  updated_at?: string;
}

/**
 * Get a GitHub Security Advisory by GHSA ID
 * @param ghsaId - The GitHub Security Advisory ID (e.g., GHSA-xxxx-xxxx-xxxx)
 * @returns Promise resolving to the advisory details, or null if not found
 */
export async function getAdvisory(ghsaId: string): Promise<GHSAAdvisory | null> {
  // Abort if no id
  if (!ghsaId) return null;

  try {
    const response = await octokit.request('GET /advisories/{ghsa_id}', {
      ghsa_id: ghsaId,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        'Accept': 'application/vnd.github+json'
      }
    });

    const advisory = response.data;

    return {
      ghsa_id: advisory.ghsa_id,
      cve_id: advisory.cve_id ?? undefined,
      cvss: advisory.cvss
        ? {
            score: advisory.cvss.score ?? undefined,
            vector_string: advisory.cvss.vector_string ?? undefined,
          }
        : undefined,
      epss: advisory.epss
        ? {
            percentage: advisory.epss.percentage ?? undefined,
            percentile: advisory.epss.percentile ?? undefined,
          }
        : undefined,
      html_url: advisory.html_url ?? undefined,
      url: advisory.url ?? undefined,
      summary: advisory.summary ?? undefined,
      description: advisory.description ?? undefined,
      severity: advisory.severity ?? undefined,
      published_at: advisory.published_at ?? undefined,
      updated_at: advisory.updated_at ?? undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch advisory ${ghsaId}:`, (error as Error).message);
    return null;
  }
}

/**
 * Get multiple advisories in batch
 * @param ghsaIds - Array of GitHub Security Advisory IDs to fetch
 * @returns Promise resolving to a Map of GHSA ID to advisory details
 */
export async function getAdvisories(
  ghsaIds: string[]
): Promise<Map<string, GHSAAdvisory>> {
  const results = new Map<string, GHSAAdvisory>();

  // Fetch advisories sequentially to avoid rate limiting
  for (const ghsaId of ghsaIds) {
    const advisory = await getAdvisory(ghsaId);
    if (advisory) {
      results.set(ghsaId, advisory);
    }
    // Small delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
