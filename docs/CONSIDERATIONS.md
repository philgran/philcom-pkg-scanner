# Considerations

### Things I know and Things I don't know

| Knowns | Unknowns |
|--------|----------|
| How to scan package files for names and versions | What version is actually getting resolved when you have this: <br/> @material-ui/core@^4.11.3 <br/> @material-ui/core@^4.12.3 <br/> @material-ui/core@^5.0.0-alpha.27 <br/> @material-ui/styles@^4.11.4 |
| Packages not actively maintained are bad | How old is too old for the most recent commit? 6 months? 12 months? 2 years?
| package.json is not going to catch everything used in a project (transitive dependencies) <br/> package-lock.json or yarn.lock will catch everything used everywhere in a project | Is this sufficient for transitive depenency resolution? Or do I need more sophisticated filtering on top of just this? |
| node apps have a lockfile, so I know the full extent of transitive dependencies. | Do python apps have transitive dependencies? How do I get them? |
| CVSS seems to be an important metric, encompassing multiple facets of a vulnerability. | Is it helpful to extrapolate info from the vector? <br/>May be something useful in a UI version |


### Improvements

* Need to batch the batched API calls to OSV, large package manifests will produce a 400 bad request error
* Use the integrity hash types and the package source fields derived in npm-parser to check for packages that are not secured via sha512 or come from non-npm sources. These could be flagged as potential vulnerabilities.

### Should I be doing way more in the dependency resolution process?

I could automate the downloading and extraction of all the tgz archives referenced in lockfiles, then examine their package.json files for additional dependencies. Is this overkill?

### Should I be doing way more original checks for vulnerabilities?

I could be comparing the output of get-dependencies against a list of known packages to check for typo squatting.

### Should I be including more of the response fields from OSV and GHSA?

It seems like we're leaving a lot of data behind from these OSV and GHSA calls. I don't make sense to include it for the CLI output, we want that to be kind of short and sweet. But I *would* like to extract more of it and expose it just in the JSON response for UI comsuption.
