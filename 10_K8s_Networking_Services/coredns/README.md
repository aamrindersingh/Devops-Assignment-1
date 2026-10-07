# CoreDNS

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

All output below is from the CoreDNS running on my kind cluster.

---

## What it is

CoreDNS is the DNS server that runs inside the cluster. It is a general purpose DNS server written in
Go, built out of plugins, and it has been the Kubernetes default since 1.13 (it replaced kube-dns).

It does two jobs:

1. Answers queries for cluster names such as `webapp.dns-lab.svc.cluster.local`, by reading Services
   and Endpoints from the Kubernetes API.
2. Forwards everything else to the upstream resolver the nodes use, so pods can reach the internet.

```text
$ kubectl -n kube-system get deployment coredns -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image
NAME      READY   IMAGE
coredns   2       registry.k8s.io/coredns/coredns:v1.14.6

$ kubectl -n kube-system get svc kube-dns
NAME       TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)                  AGE
kube-dns   ClusterIP   10.96.0.10   <none>        53/UDP,53/TCP,9153/TCP   19d
```

Two replicas, so losing one node does not take DNS down with it. The Service is still called
`kube-dns` even though the software behind it is CoreDNS, kept for backwards compatibility. That
`10.96.0.10` is the address every pod has in its `/etc/resolv.conf`.

Port 9153 is the metrics port, which is how Prometheus scrapes it in
[Session 20](../../19_Monitoring_Observability_GitOps/README.md).

---

## Why Kubernetes needs it

Pod IPs change constantly. A Deployment replaces a pod and the new one has a different address, so
nothing can hardcode an IP. Services give a stable virtual IP, but something has to turn a name into
that IP, and it has to update the instant a Service is created or deleted. That is CoreDNS, watching
the API server.

The older kube-dns did the same job with three containers and a config format that was awkward to
extend. CoreDNS is one binary with a plugin chain, which is why things like rewriting a domain or
pointing one zone at an external resolver are a couple of lines.

---

## The Corefile

This is the actual config on my cluster:

```text
$ kubectl -n kube-system get configmap coredns -o jsonpath="{.data.Corefile}"
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30 {
       disable success cluster.local
       disable denial cluster.local
    }
    loop
    reload
    loadbalance
}
```

Reading it as a chain, because order matters:

| Line | What it does |
|---|---|
| `.:53` | this block serves every zone, on port 53 |
| `errors` | log errors to stdout, which is what `kubectl logs` shows |
| `health` with `lameduck 5s` | `/health` endpoint; on shutdown it keeps answering for 5s while it is removed from endpoints, so in-flight queries are not dropped |
| `ready` | readiness endpoint, so the pod is not sent traffic before its plugins are up |
| `kubernetes cluster.local ...` | **the important one.** Watches the API for Services and Endpoints and answers names under `cluster.local` |
| `pods insecure` | enables the `<ip>.<ns>.pod.cluster.local` form without verifying the pod exists |
| `fallthrough in-addr.arpa ip6.arpa` | if a reverse lookup is not a cluster IP, pass it down the chain instead of answering NXDOMAIN |
| `ttl 30` | cluster answers are cached by clients for 30s |
| `prometheus :9153` | exposes metrics |
| `forward . /etc/resolv.conf` | anything not handled above goes to the node's own resolver |
| `cache 30` | CoreDNS's own cache |
| `loop` | detects a forwarding loop at startup and refuses to run rather than melting down |
| `reload` | picks up ConfigMap edits without a restart |
| `loadbalance` | shuffles A records so clients spread out |

The `cache` block here has `disable success cluster.local` and `disable denial cluster.local`, so
cluster names are **not** cached by CoreDNS itself. That is deliberate: a Service's endpoints can
change at any moment, and a stale cached answer would send traffic to a pod that no longer exists.
External names still get the 30 second cache.

---

## Service discovery in practice

A Service is created, and within a moment its name resolves cluster wide. Nobody edits a config file.

```text
$ kubectl exec dnsutils -- dig +noall +answer webapp.dns-lab.svc.cluster.local
webapp.dns-lab.svc.cluster.local. 30 IN	A	10.96.160.110
```

The `30` in that answer is the `ttl 30` from the Corefile, visible in the response.

Forwarding out of the cluster, handled by the `forward` plugin:

```text
$ kubectl exec dnsutils -- dig +short github.com | head -2
20.207.73.82
```

Reverse lookup, handled by the `kubernetes` plugin because `in-addr.arpa` is in its zone list:

```text
$ kubectl exec dnsutils -- dig +noall +answer -x 10.96.0.1
1.0.96.10.in-addr.arpa.	30	IN	PTR	kubernetes.default.svc.cluster.local.
```

That resolved the Kubernetes API Service's own ClusterIP back to its name.

---

## How a query is resolved, start to finish

1. A pod asks for `webapp.dns-lab`.
2. The resolver appends search suffixes from `/etc/resolv.conf` in order, and sends each attempt to
   `10.96.0.10`.
3. That ClusterIP is handled by kube-proxy rules, which send the packet to one of the two CoreDNS
   pods.
4. CoreDNS runs the plugin chain. The `kubernetes` plugin recognises the `cluster.local` suffix and
   answers from its watch cache of Services.
5. If the name had **not** been a cluster name, the chain would have fallen through to `forward`,
   which sends it to the node's upstream resolver.
6. The answer comes back with a 30 second TTL.

---

## Troubleshooting DNS

My order, learned mostly from getting it wrong in Session 14:

**1. Are the CoreDNS pods healthy?**

```bash
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=50
```

**2. Does the pod have sensible resolver config?**

```bash
kubectl exec <pod> -- cat /etc/resolv.conf
```

Wrong `nameserver` or a missing `search` line points at the kubelet's `--cluster-dns` setting rather
than at CoreDNS.

**3. Test with a client that is not lying to you.**

This cost me time. busybox's `nslookup` does not honour the `search` list properly and reported
NXDOMAIN for a name that resolves fine. Use `dig` or `getent hosts` from a pod such as
`registry.k8s.io/e2e-test-images/jessie-dnsutils`.

**4. Separate "does the name resolve" from "does the Service work".**

```bash
kubectl exec <pod> -- dig +short <svc>.<ns>.svc.cluster.local   # DNS
kubectl get endpointslices -l kubernetes.io/service-name=<svc>  # is anything behind it
```

A name resolving tells you the Service object exists. It says nothing about whether any pod is behind
it. If the name resolves and the connection is still refused, the problem is endpoints or ports, not
DNS.

**5. Check the Corefile if whole classes of name fail.**

```bash
kubectl -n kube-system get configmap coredns -o jsonpath="{.data.Corefile}"
```

External names all failing points at `forward`. Cluster names failing points at the `kubernetes`
plugin or RBAC on the CoreDNS ServiceAccount.

### Things that commonly break

| Symptom | Likely cause |
|---|---|
| everything NXDOMAIN | CoreDNS pods down, or `kube-dns` Service has no endpoints |
| only external names fail | `forward` target unreachable, or the node's own resolver is broken |
| only cluster names fail | `kubernetes` plugin misconfigured, or CoreDNS cannot read the API |
| intermittent, slow lookups | too few CoreDNS replicas, or `ndots:5` multiplying external queries |
| CoreDNS crashlooping at start | `loop` plugin detected a forwarding loop, usually the node resolver pointing back at CoreDNS |

The last one is specific and easy to recognise: the log says a loop was detected, and it happens when
the node's `/etc/resolv.conf` points at the cluster DNS, so CoreDNS forwards to itself.
