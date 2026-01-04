Maintaining this devlog is an idea I learned from my friend Jeff at Nvidia, he maintains a devlog so he can remember what he did and why on long-running projects. This is the first time I tried it because this is the first thing I've done where I thought I needed it.

# Day 1

Lots of vibe coding to scaffold a CLI project. CLI apps are not traditionally my wheelhouse but it's fine because it's all typescript and I can understand and visualize it at a glance. Got useable output on the dependency resolution, now trying to do something with it.

### Hours later

This is actually really cool, not having to worry about the browser and the constant nag of visual things not being perfect during the dev cycle. Figured out a couple different ways to invoke the project from the command line, depending on the desired test outcome from various states of semi-doneness. Should I compile this thing to a binary at the end?

Hooked up the API calls for OSV and GHSA lookups, rendering basic output to STDOUT. Will fill in all the details later. Started researching a bunch of the data in these responses since it seems pretty important to the business mission of Socket.


# Day 2

I realized I'm not resolving transitive dependencies in python. That's a dealbreaker, it must be done.

### Attempt 1: hybrid approach

Using node exec, tried to run python commands in a shell. Installed pipdeptree and got it working thru exec. But it runs in the context of the node app, not in the python app it's scanning, so it's returning globally installed packages on the host system. Boo.

### Attempt 2: node python bridge with deno

`deno_python` is a module that provides "seamless integration" between the runtimes. But I've been running in node this whole time, will my project even work in deno? Quick download and test run: silent failure, no output. Considering time contraints and my lack of knowledge about the deno ecosystem I deemed this a non-starter.

### Attempt 3: full fledged python in node using exec

The plan here is to fire up a venv, copy the requirements.txt, install all packages, then install pipdeptree and run it to find transitive dependencies. The only requirement should be python on the host system. (Maybe it's time to containerize this? Do people containerize packages meant to run as CLI scripts?)

**Some time later**

On second thought this approach sucks because there's no way we're going to magically find python version compatibility with all installed packages in a project. Some projects would have a python version set somewhere via pyenv or asdf or something similar (.tool-versions in my case), but I don't want to be scanning around filesystems for what version of python I need just to get these dependencies. So I'm backing out of this rabbit hole.

### Attempt 4: 

I just fetched the JSON manifest from pypi.org. This was the first thing I tried, but I mistakenly chose two packages that did not have dependencies, so I thought it was not returning the right data. Turns out you just need to get a package that requires other dependencies and you'll see them in the output 😐😑

**More time later**

Finally this is working well. I'm running into a problem with version ranges. In the `requires_dist` field we sometimes have operators defining version constraints. I attempted to resolve these by fetching the latest version that satisfies the contstraint, but doing this recursively was just way too many API calls and it was taking forever. So now we're just parsing direct dependencies from the requirements.txt, and the versions in their `requires_dist` field from PyPi, then we stop there. So there's no recursive dependency resolution on the python side. Hopefully this is not an immediate fail. 😬 I want to continue making progress on the rest of it, so maybe we'll come back to this later.

**More time later**

I had to make some decisions about how to handle ranges, so we're just grabbing the lowest version it could possibly be for now.


# Day 3

Trying to tighten up everything I've already built out. Doing more research on important metrics for software vulnerabilities in order to pull useful info from the scans.

Having trouble deciding what to do for 3-2 suggested upgrades/remediations. The data I can find is mostly buried in the description of the GHSA response, so I'd need to scan that text string for keywords and extract things related to "upgrade" "fix" "remediate", seems like I should look for a better path forward on that one.

I think I've hit all the specific requirements at this point. I was hoping to build a UI...maybe time to start on that now? Would be cool to add Rust crate support, but that's delving into more unknowns, I should probably just whip up a quick UI since I am already 1337 on that front.

**Womp womps**

I wanted to inetgrate the output of get-version-timestamp to check for stale packages, but those calls were taking forever to complete. Also it doesn't seem to be working correctly anymore? **Not sure where I was going with that it was 6 days ago.**

**A short time later**

I was able to get the get-version-timestamp command working again, but it just can't handle a ton of lookups. Even 25 entries took almost a minute to run. There's probably a more efficient way to do this, but I don't think it's worth the time at the moment, so I'm pulling the ripcord.

**Another short time later**

I am really hitting a wall on getting the GHSA data from github. I need to increase my request quota somehow, which probably means getting some kind of token and authorizing my app and a bunch of other overhead that seems out of scope for this project. I guess I could also just massively trim down my test data, but does that diminish the authenticity of this whole thing? Should I expose the fact that this project is not at all scalable? It is just a coding exercise, so how resilient does it really need to be? My fixtures are taken from real world current and former projects, some super old with massive vulnerabilities. Still I think it would better if everything just worked all the time with the test data...

**Also later**

I trimmed down my fixtures files, I think brevity and illustration of the ideas in this project is more important than using inputs from real-world scenarios. I tried building a UI for this on a branch and running it in the same project, but there are problems with inconsistences in how my packages are using ES module syntax or commonJS syntax. I know there are fixes for this in configuration, but it feels out of scope for this project.