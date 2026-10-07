# Session 17: Complete CI/CD and DevSecOps

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

An eight stage pipeline with four different security scanners and a gate that decides whether the
image is allowed out. It ran four times on GitHub's hosted runners while I built it, and the
interesting evidence is that **run 2 was blocked by the gate** and run 4 was not.

Workflow: [.github/workflows/devsecops.yml](../.github/workflows/devsecops.yml)

---

## The flow

```
Code
 ↓
Build + Unit test          job 1
 ↓
SAST  ──┐                  job 2   Semgrep
SCA   ──┤  run in parallel job 3   Trivy + npm audit
Secret ─┘                  job 4   Gitleaks
 ↓
Docker build + Image scan  job 5   Trivy
 ↓
Security gate              job 6   decides
 ↓
Push image                 job 7   only if the gate opened
 ↓
Validate manifests         job 8   kubeconform
```

Jobs 2, 3 and 4 run at the same time because none of them depends on the others. The gate collects
all four results with `needs:` and `if: always()`, so it still reports even when a scan failed.

| Stage | Tool | What it looks at |
|---|---|---|
| SAST | Semgrep | my source code, for insecure patterns |
| SCA | Trivy + `npm audit` | my dependencies, for known CVEs |
| Secret scanning | Gitleaks | the git history, for committed credentials |
| Image scanning | Trivy | the built container, OS packages and app libraries |

---

## The application

[app/](app) is a small Express service with 4 unit tests. Two things in it exist specifically so the
scanners have something to find:

- `lodash` pinned to `4.17.20`, which has known CVEs
- a `/greet` endpoint that built an HTML string out of a query parameter

Both were caught. Both are fixed now, and the history shows the before and after.

---

## Run 2: the gate closes

![security gate closed](screenshots/s17-01-gate-closed.jpg)

Status **Failure**. Reading the graph: build passes, SAST and secret scanning pass, **SCA fails**,
the gate goes red, and jobs 7 and 8 show the skipped circle rather than a tick. The image was never
published.

The gate's own output:

```text
SAST:        success
SCA:         failure
Secret scan: success
Image scan:  success
Security gate closed
```

And the finding that caused it:

```text
package-lock.json (npm)
=======================
Total: 2 (HIGH: 2, CRITICAL: 0)

┌─────────┬────────────────┬──────────┬────────┬───────────────────┬───────────────┬──────────────────────────────────────────────────────────────┐
│ Library │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │                            Title                             │
├─────────┼────────────────┼──────────┼────────┼───────────────────┼───────────────┼──────────────────────────────────────────────────────────────┤
│ lodash  │ CVE-2021-23337 │ HIGH     │ fixed  │ 4.17.20           │ 4.17.21       │ nodejs-lodash: command injection via template                │
│         │                │          │        │                   │               │ https://avd.aquasec.com/nvd/cve-2021-23337                   │
│         ├────────────────┤          │        │                   ├───────────────┼──────────────────────────────────────────────────────────────┤
│         │ CVE-2026-4800  │          │        │                   │ 4.18.0        │ lodash: lodash: Arbitrary code execution via untrusted input │
│         │                │          │        │                   │               │ in template imports                                          │
└─────────┴────────────────┴──────────┴────────┴───────────────────┴───────────────┴──────────────────────────────────────────────────────────────┘
```

`npm audit` agreed, in its own format:

```text
lodash  <=4.17.23
Severity: high
Command Injection in lodash - https://github.com/advisories/GHSA-35jh-r3h4-6jhm
Regular Expression Denial of Service (ReDoS) in lodash - https://github.com/advisories/GHSA-29mw-wpgm-hmr9
lodash vulnerable to Code Injection via `_.template` imports key names - https://github.com/advisories/GHSA-r5fr-rjxr-66jc
```

This is the whole point of the session. A real CVE in a real dependency stopped a real image from
reaching a registry, with no human in the loop.

---

## Run 4: the gate opens

Fix: `"lodash": "4.17.20"` becomes `"lodash": "^4.18.1"`, lockfile regenerated.

```text
$ trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --quiet .

Report Summary

┌───────────────────┬──────┬─────────────────┐
│      Target       │ Type │ Vulnerabilities │
├───────────────────┼──────┼─────────────────┤
│ package-lock.json │ npm  │        0        │
└───────────────────┴──────┴─────────────────┘
```

![security gate open](screenshots/s17-02-gate-open.jpg)

Status **Success**, 8 jobs, 4 artifacts, and the gate output:

```text
SAST:        success
SCA:         success
Secret scan: success
Image scan:  success
Image CRITICAL: 1
Image HIGH:     26
```

---

## What SAST actually caught

This was the part I learned the most from. Semgrep failed run 1 with two findings, both on the same
line of my code:

```text
app/src/server.js
❯❱ javascript.express.security.audit.xss.direct-response-write.direct-response-write
      Detected directly writing to a Response object from user-defined input. This bypasses any HTML
      escaping and may expose your application to a Cross-Site-scripting (XSS) vulnerability.

   28┆ res.send(`<p>Hello, ${safeName(String(req.query.name || "guest"))}</p>`);

❯❱ javascript.express.security.injection.raw-html-format.raw-html-format
      User data flows into the host portion of this manually-constructed HTML. This can introduce a
      Cross-Site-Scripting (XSS) vulnerability if this comes from user-provided input.

   28┆ res.send(`<p>Hello, ${safeName(String(req.query.name || "guest"))}</p>`);

 • Findings: 2 (2 blocking)
```

I had already written a `safeName()` helper that strips `< > & " ' \``, so my first reaction was that
this was a false positive. It is not really, and arguing with it would have been the wrong move:

- the scanner cannot know that `safeName` is a sanitizer. It sees untrusted input reaching an HTML
  sink and says so. Any custom sanitizer has this problem.
- more importantly it was right about the pattern. My helper is a blocklist, and blocklists on HTML
  are a bad bet. Today it strips six characters. The next person to touch it might add a feature that
  slips past.

So I fixed the cause rather than silencing the rule. `/greet` now returns JSON:

```js
app.get("/greet", (req, res) => {
  res.json({ greeting: `Hello, ${safeName(String(req.query.name || "guest"))}` });
});
```

No HTML is built, so there is no HTML injection sink to get wrong. Run 2 had SAST green.

**The general lesson:** when a scanner flags you, the three options are fix the code, fix the
architecture so the pattern disappears, or suppress with a written justification. Suppressing should
be the rarest, and it should never be the first thing you reach for.

---

## Secret scanning

Gitleaks runs with `fetch-depth: 0` so it reads the whole commit history, not just the current tree.
That matters because a secret that was committed and then deleted is still in the history and still
compromised.

Config is in [security/.gitleaks.toml](security/.gitleaks.toml). It extends the default ruleset and
allowlists exactly two things: the dummy `s3cr3t-demo` password from the Session 14 troubleshooting
lab, and `AKIAIOSFODNN7EXAMPLE`, which is AWS's own published example key. Both are documented in the
config with a comment saying why.

An allowlist entry should always be narrow and explained. A broad `paths` exclusion is how real
secrets end up getting ignored.

Gitleaks passed on every run and uploaded `gitleaks-results.sarif` as an artifact.

---

## Image scanning, and what I chose not to gate on

The image scan reports **1 CRITICAL and 26 HIGH**, and the gate still opens. That needs explaining,
because at first glance it looks like the gate is not doing its job.

The CRITICAL is:

```
CVE-2026-59873 | tar 6.2.1 -> fixed in 7.5.19
  target: Node.js
  title: tar: node-tar: Denial of Service via crafted gzip bomb
```

`tar` here is bundled inside npm, inside the `node:20-alpine` base image. I did not choose it, it is
not in my `package.json`, and I cannot fix it by editing my code. Most of the 26 HIGH findings are
the same shape: `libcrypto3` and `libssl3` from Alpine, and transitive packages like
`brace-expansion` and `cross-spawn`.

If I had gated on "zero CRITICAL in the image", this pipeline could never go green no matter what I
did to my application, and the usual outcome of a gate like that is somebody disables it. So the
split is:

| Check | Gating? | Why |
|---|---|---|
| SCA on `package-lock.json`, `--ignore-unfixed` | **yes** | these are dependencies I chose and can upgrade today |
| SAST on my source | **yes** | it is my code |
| Secret scanning | **yes** | never acceptable |
| Image scan (base image CVEs) | reported | fixing needs a base image bump, tracked separately |

`--ignore-unfixed` on the SCA is deliberate too. A CVE with no patch released is real, but failing a
build over something nobody can fix just teaches people to ignore the build.

The honest next step for the base image findings would be rebuilding on a newer `node:20-alpine`
digest on a schedule, and tracking the remainder. Reporting them in the job summary at least keeps
them visible instead of invisible.

---

## Kubernetes hardening

[k8s/deployment.yaml](k8s/deployment.yaml) applies the settings a cluster policy scanner looks for:

```yaml
      securityContext:            # pod level
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
```

```yaml
          securityContext:        # container level
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

Plus resource requests and limits, and both probes. The Dockerfile also ends with `USER node`, so the
image does not depend on the manifest to avoid running as root.

### Validating them in the pipeline

My first attempt used `kubectl apply --dry-run=client` and it failed:

```text
error: error validating "16_Complete_CICD_DevSecOps/k8s/deployment.yaml": error validating data:
failed to download openapi: Get "http://localhost:8080/openapi/v2?timeout=32s": dial tcp [::1]:8080:
connect: connection refused
```

`--dry-run=client` sounds offline but still fetches the OpenAPI schema from a cluster, and a hosted
runner has no cluster. `kubeconform` carries the schemas with it and validates genuinely offline,
which is what job 8 uses now.

---

## What I understood

- The four scanners answer four different questions and none of them substitutes for another. SCA
  would never have found the XSS, and SAST would never have found the lodash CVE.
- A gate is only useful if it can realistically pass. Where you put the threshold is a judgement
  call, and getting it wrong in the strict direction is how gates get turned off.
- `needs:` plus `if: always()` is the pattern for a gate job: it has to see every result, including
  the failures, or it cannot report usefully.
- Secret scanning needs full history. The default shallow checkout would have missed anything that
  was committed and later removed.
- Arguing with a scanner finding is usually a worse use of time than removing the pattern it is
  complaining about.

---

## Files

```
16_Complete_CICD_DevSecOps/
├── app/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   └── users.js
│   └── test/
│       └── users.test.js
├── k8s/
│   └── deployment.yaml
├── security/
│   └── .gitleaks.toml
├── screenshots/
└── README.md

.github/workflows/devsecops.yml
```
