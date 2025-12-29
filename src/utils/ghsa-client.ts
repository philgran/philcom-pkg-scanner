import { Octokit } from "octokit";

const octokit = new Octokit();

export interface GHSAAdvisory {
  ghsa_id: string;
  cve_id?: string;
  cvss?: {
    score?: number;
    vector_string?: string;
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
