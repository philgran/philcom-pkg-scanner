1. Add a report with these fields:
  * name: package name 
  * version: package version
  * CVE ID: `GHSA_res: cve_id`
  * description: `OSV_res: vulns[0].details`
  * severity: `GHSA_res: cvss.score`
  * advisory_link: `GHSA_res: html_url & url`
2. Add summary statistics:
    total dependencies, number/percentage vulnerable
3. Add suggested upgrades/remediations

---

4. Compare timestamps on get-version-timestamp output with now() and categorize as "active" or "inactive", or red/yellow/green

5. Separate npm dependencies from python dependencies in output file so they can be dealt with differently.