1. Add a report with these fields:
  * name: package name 
  * version: package version
  * CVE ID: `OSV_res: vulns[0].database_specific.id`
  * description: `OSV_res: vulns[0].database_specific.details`
  * severity: `GHSA_res: cvss.score`
  * advisory_link: `GHSA_res: html_url & url`
2. Add summary statistics:
    total dependencies, number/percentage vulnerable
3. Add suggested upgrades/remediations