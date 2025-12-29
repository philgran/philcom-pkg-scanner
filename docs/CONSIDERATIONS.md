# Considerations

## Things I know and Things I don't know

| Knowns | Unknowns |
|--------|----------|
| How to scan package files for names and versions | What version is actually getting resolved when you have this: <br/> @material-ui/core@^4.11.3 <br/> @material-ui/core@^4.12.3 <br/> @material-ui/core@^5.0.0-alpha.27 <br/> @material-ui/styles@^4.11.4 |
| Packages not actively maintained are bad | How old is too old for the most recent commit? 6 months? 12 months? 2 years?
| package.json is not going to catch everything used in a project (transitive dependencies) <br/> package-lock.json or yarn.lock will catch everything used everywhere in a project | Is this sufficient for transitive depenency resolution? Or do I need more sophisticated filtering on top of just this? |
| node apps have a lockfile, so I know the full extent of transitive dependencies. | Do python apps have transitive dependencies? How do I get them? |


## Should it be compiled to a binary?

**It depends on your use case: Pros of binary compilation:**

* No Node.js installation required on target systems
* Faster startup time
* Easier distribution (single file)
* Protects source code

**Pros of keeping it as Node.js package:**

* Easier to update (npm update)
* Smaller file size
* Standard Node.js workflow
* Cross-platform without multiple builds

For a CLI tool, I'd recommend starting with npm distribution and only compile to binary if you need to support systems without Node.js.

## Installation on Other Systems

### Option A: NPM Registry (Recommended)

```
# Publish to npm
npm publish
```

```
# Install globally on any system
npm install -g philcom
```

### Option B: Direct from Git

```
npm install -g git+https://github.com/yourusername/philcom.git
```

### Option C: Local Link (Development)

```
# In project directory
npm link
# Now 'philcom' command is available globally
```

### Option D: Manual Binary Distribution

Package with pkg and distribute the binary for each platform (Windows, macOS, Linux).
