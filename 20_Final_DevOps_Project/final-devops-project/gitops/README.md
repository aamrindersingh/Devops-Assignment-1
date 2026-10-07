# GitOps

`application.yaml` is the entire deployment pipeline for this project.

Nothing in GitHub Actions touches the cluster. CI builds, tests, scans and
publishes an image. Argo CD, running inside the cluster, pulls the Helm
chart from this repository and reconciles the cluster against it.

Apply it once:

```bash
kubectl apply -f application.yaml
```

After that, the way to change what is running is to change git.

Two settings worth pointing at:

**`ignoreDifferences` on `/spec/replicas`.** The HPA writes the replica
count, and git says 2. Without this, Argo sees a scaled up Deployment as
drift and scales it back, then the HPA scales it up again, and the two
controllers fight. Telling Argo to ignore that one field is what lets
autoscaling and GitOps coexist.

**The finalizer.** Without `resources-finalizer.argocd.argoproj.io`,
deleting the Application leaves every object it created behind with
nothing managing them.
