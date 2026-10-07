# Kubernetes Object Comparisons

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Three comparisons the session asked for. Where I could check a claim against my own cluster rather
than just assert it, I did.

---

## 1. Deployment vs ReplicaSet

### Purpose

A **ReplicaSet** keeps N copies of a pod running. That is its entire job. If a pod dies it makes
another one; if there are too many it deletes some.

A **Deployment** manages ReplicaSets. It adds everything to do with **changing** the pod over time:
rolling updates, revision history and rollback.

### The relationship is real, not conceptual

You almost never create a ReplicaSet yourself, because a Deployment creates one for you. The
ownership chain is visible on any running Deployment:

```text
$ kubectl get deploy,rs,pods -l app=gitops-demo -n gitops-demo
NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/gitops-demo   2/2     2            2           9m41s

NAME                                     DESIRED   CURRENT   READY   AGE
replicaset.apps/gitops-demo-6cc5f8f5d6   2         2         2       9m41s

NAME                               READY   STATUS    RESTARTS   AGE
pod/gitops-demo-6cc5f8f5d6-slvmm   1/1     Running   0          9m41s
pod/gitops-demo-6cc5f8f5d6-w5zkt   1/1     Running   0          9m41s

$ kubectl get rs -n gitops-demo -o jsonpath="owner of the ReplicaSet: {.items[0].metadata.ownerReferences[0].kind}/{.items[0].metadata.ownerReferences[0].name}"
owner of the ReplicaSet: Deployment/gitops-demo

$ kubectl get pods -n gitops-demo -o jsonpath="owner of a Pod: {.items[0].metadata.ownerReferences[0].kind}/{.items[0].metadata.ownerReferences[0].name}"
owner of a Pod: ReplicaSet/gitops-demo-6cc5f8f5d6
```

I only ever created the Deployment. The `ownerReferences` field proves the chain:

```
Deployment  ──owns──>  ReplicaSet  ──owns──>  Pods
gitops-demo            gitops-demo-6cc5f8f5d6   ...-slvmm, ...-w5zkt
```

The `6cc5f8f5d6` in the ReplicaSet and pod names is a hash of the pod template. Change the template
and you get a different hash, which is exactly how a Deployment knows to make a **new** ReplicaSet
rather than edit the old one.

### Side by side

| | ReplicaSet | Deployment |
|---|---|---|
| Keeps N pods running | yes | yes, through a ReplicaSet |
| Self healing | yes | yes |
| `kubectl scale` | yes | yes |
| Rolling update on image change | **no** | yes |
| Revision history | no | yes, `kubectl rollout history` |
| Rollback | no | yes, `kubectl rollout undo` |
| Deployment strategies | no | RollingUpdate and Recreate |
| Created by hand in practice | rarely | almost always |

### What a ReplicaSet cannot do

In [Session 10](../../09_K8s_Pods_ReplicaSets_Deployments/README.md) I scaled a bare ReplicaSet and
killed a pod from it, and it handled both. What it could not do is change the image in a controlled
way. Editing a ReplicaSet's pod template does **not** touch the pods that already exist; the new
template only applies to pods created afterwards. A Deployment handles that by standing up a second
ReplicaSet and shifting replicas between the two.

**When you would still use a bare ReplicaSet:** essentially never. The only honest reason is
learning what a Deployment is doing underneath.

---

## 2. Deployment vs DaemonSet vs StatefulSet

All three manage pods. They differ in **how many**, **what they are called**, and **what storage
they get**.

| | Deployment | DaemonSet | StatefulSet |
|---|---|---|---|
| **How many pods** | whatever `replicas` says | exactly one per eligible node | whatever `replicas` says |
| **Pod names** | random suffix, `web-6cc5f8f5d6-slvmm` | random suffix | ordinal, `web-0`, `web-1`, `web-2` |
| **Identity across restarts** | none, a replacement is a different pod | none | stable, `web-1` is always `web-1` |
| **Start and stop order** | all at once | per node | strictly in order, 0 then 1 then 2 |
| **Scaling** | `replicas` | add or remove a node | `replicas`, applied in order |
| **Storage** | all replicas share a PVC, or none | usually `hostPath` on the node | `volumeClaimTemplates`, one PVC per pod |
| **Networking** | a normal Service load balances across them | usually reached on the node, or `hostPort` | usually a headless Service, each pod gets its own DNS name |
| **Typical use** | stateless web apps and APIs | log collectors, monitoring agents, CNI plugins | databases, Kafka, anything with a cluster identity |

### Seen on my own cluster

**DaemonSet.** `node-exporter` from the monitoring stack has exactly two pods for two nodes, one
each. I never set a replica count:

```
monitoring-prometheus-node-exporter-mm66f   devops-hw-control-plane
monitoring-prometheus-node-exporter-vvzlz   devops-hw-worker
```

In [Session 10](../../09_K8s_Pods_ReplicaSets_Deployments/README.md) my own DaemonSet showed
`DESIRED 1` on a two node cluster, because the control plane carries a `NoSchedule` taint that the
DaemonSet did not tolerate. node-exporter lands on both nodes because it **does** tolerate it, which
it has to, since a monitoring agent that skips the control plane is useless.

**StatefulSet.** The headless Service section of the main [README](../README.md) shows `web-stateful-0`,
`web-stateful-1`, `web-stateful-2` and each one resolvable by its own DNS name. Compare with the
Deployment pod names above, which are random and meaningless.

### Choosing between them

- Can any replica serve any request, and can you throw one away without losing anything?
  **Deployment.**
- Does it need to run on every node because it is doing something node specific?
  **DaemonSet.**
- Does a replica have an identity that others depend on, such as "the primary", or its own data?
  **StatefulSet.**

The ordering guarantee is what people underestimate. A StatefulSet will not start `web-1` until
`web-0` is Ready, and scales down in reverse. For a database that is the difference between a clean
join and a split brain.

---

## 3. ReplicaSet vs Service

These two get compared because beginners expect one object to do both jobs. They do not overlap at
all.

| | ReplicaSet | Service |
|---|---|---|
| **Responsibility** | make sure N pods exist | give a stable address to reach whatever pods exist |
| **Operates on** | pod lifecycle | network traffic |
| **If it is missing** | pods are not replaced when they die | pods run, but nothing can reliably find them |
| **Knows about pods via** | label selector | label selector |
| **Creates pods** | yes | never |

The thing they share is the **label selector**, and that is the source of most confusion. Both find
their pods by labels, but they do completely different things once they have found them.

### Why a Service is needed at all

Every pod gets an IP, so in principle you could talk to a pod directly. Three reasons that falls
apart:

1. **Pod IPs do not survive.** A pod replaced by its ReplicaSet comes back with a different IP.
   Anything that cached the old one is broken.
2. **There are several of them.** 2 replicas means 2 IPs, and the caller should not have to pick.
3. **There is no name.** Without a Service there is no DNS entry, so there is nothing stable to put
   in a config file.

A Service solves all three with one ClusterIP and one DNS name that never change for the life of the
Service.

### How traffic actually reaches a pod

1. The client resolves the Service name, and CoreDNS returns the **ClusterIP**.
2. That ClusterIP is virtual. No network interface anywhere has it.
3. The client sends a packet to it.
4. `kube-proxy` has written rules on the node (iptables or IPVS) that rewrite the destination to one
   of the pod IPs in the Service's EndpointSlice.
5. The packet goes to the real pod.

The EndpointSlice is the join between the two objects, and it is maintained by the endpoints
controller, not by the ReplicaSet:

```
ReplicaSet ──creates──> Pods ──labels──> EndpointSlice <──reads── Service
```

So the ReplicaSet makes pods and labels them. The Service selects on those labels and the controller
writes the matching pod IPs into an EndpointSlice. kube-proxy turns that list into routing rules.
Neither object talks to the other directly.

### The failure this explains

In [Session 14](../../13_K8s_Troubleshooting/README.md) I broke a Service by labelling the pods
`app=webfrontend` while the Service selected `app=web-frontend`. The ReplicaSet was perfectly happy,
2 pods `Running`, because it uses its own selector and does not care what the Service thinks. The
Service found nothing, its EndpointSlice was empty, and every connection was refused.

That is the clearest demonstration of the split: **the ReplicaSet's job succeeded and the Service's
job failed, at the same time, over the same pods.** Checking `kubectl get pods` would have told you
everything was fine. Only `kubectl get endpointslices` showed the problem.
