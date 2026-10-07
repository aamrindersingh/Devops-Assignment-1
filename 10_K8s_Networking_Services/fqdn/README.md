# FQDN and Kubernetes Service DNS

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Tested on my kind cluster. For the test I made a namespace `dns-lab` with a Service called `webapp`
in it, then did all the lookups from a pod in the `default` namespace, so the cross namespace
behaviour is actually visible.

---

## What an FQDN is

A fully qualified domain name is the complete name of a host, read right to left from the root. In
`webapp.dns-lab.svc.cluster.local` every part means something:

```
webapp   .   dns-lab   .   svc   .   cluster.local
  │            │            │            │
  │            │            │            └─ cluster domain (configurable, this is the default)
  │            │            └─ the kind of object, "svc" for Service, "pod" for a Pod
  │            └─ the namespace the Service lives in
  └─ the Service name
```

The general form is:

```
<service>.<namespace>.svc.<cluster-domain>
```

A Service does not need a cluster domain to be reachable from inside, but the full name is the only
one guaranteed to resolve from anywhere in the cluster, which the test below shows.

---

## Why a short name sometimes works

Every pod gets a `/etc/resolv.conf` written by the kubelet:

```text
$ kubectl exec dnsutils -- cat /etc/resolv.conf
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

Three parts:

- **`nameserver 10.96.0.10`** is the `kube-dns` Service, which fronts the CoreDNS pods.
- **`search`** is a list of suffixes the resolver appends to a short name, in order. The first one
  contains the pod's **own** namespace, which is why a name with no namespace resolves to a Service
  in the same namespace.
- **`options ndots:5`** means any name with fewer than 5 dots is tried with the search suffixes
  **first**, before being tried as an absolute name.

---

## The test

All four lookups were done from a pod in `default`, against a Service in `dns-lab`:

```text
$ bash dnstest.sh webapp webapp.dns-lab webapp.dns-lab.svc webapp.dns-lab.svc.cluster.local
webapp                               -> NXDOMAIN
webapp.dns-lab                       -> 10.96.160.110
webapp.dns-lab.svc                   -> 10.96.160.110
webapp.dns-lab.svc.cluster.local     -> 10.96.160.110
```

| Name tried | Result | Why |
|---|---|---|
| `webapp` | NXDOMAIN | search appends `default.svc.cluster.local` first, and there is no `webapp` in `default` |
| `webapp.dns-lab` | resolved | the first suffix fails, the second, `svc.cluster.local`, completes it correctly |
| `webapp.dns-lab.svc` | resolved | completed by the third suffix, `cluster.local` |
| `webapp.dns-lab.svc.cluster.local` | resolved | already complete, no suffix needed |

So the short name is not special, it is just the search list doing the work. Move the client pod to
another namespace and `webapp` alone stops resolving, while the full name keeps working.

### A mistake worth recording

My first attempt used busybox's `nslookup` and it reported `webapp.dns-lab` as **NXDOMAIN**, which
would have been the wrong conclusion to write down. busybox's nslookup does not follow the `search`
list the way the normal resolver does.

Re-running through `getent hosts`, which goes through the real libc resolver, gave the correct
answer. Same for `dig`. The lesson is that the DNS client inside a debug container can lie to you,
and busybox in particular is known for this. For DNS debugging, use a pod with `dig` in it, such as
`registry.k8s.io/e2e-test-images/jessie-dnsutils`.

---

## Other DNS names in a cluster

| Object | Name form | Example |
|---|---|---|
| Service | `<svc>.<ns>.svc.cluster.local` | `webapp.dns-lab.svc.cluster.local` |
| Named port (SRV) | `_<port>._<proto>.<svc>.<ns>.svc.cluster.local` | `_http._tcp.webapp.dns-lab.svc.cluster.local` |
| Pod in a StatefulSet | `<pod>.<svc>.<ns>.svc.cluster.local` | `web-stateful-1.web-service-headless.default.svc.cluster.local` |
| Pod by IP | `<ip-with-dashes>.<ns>.pod.cluster.local` | `10-244-1-5.default.pod.cluster.local` |

The StatefulSet form is the one that matters in practice. It is how a replica gets a stable name that
survives rescheduling, which is what makes clustered databases possible on Kubernetes. That form was
tested in the headless Service section of the main [README](../README.md).

---

## Pod to Service communication

What actually happens when a pod requests `http://webapp.dns-lab`:

1. The resolver in the pod appends search suffixes until one resolves, and sends the query to
   `10.96.0.10`.
2. CoreDNS answers with the Service's **ClusterIP**, here `10.96.160.110`. That IP belongs to no
   network interface anywhere.
3. The pod opens a connection to that IP.
4. `kube-proxy` has programmed rules on the node that rewrite the destination to one of the real pod
   IPs behind the Service, picked per connection.
5. The packet goes to the chosen pod.

Two things follow from this that caused me confusion earlier in the course:

- **DNS resolving does not mean the Service works.** CoreDNS answers from the Service object, not
  from its endpoints. A Service with a broken selector and zero endpoints still resolves perfectly,
  and then refuses the connection. That was the exact failure in
  [Session 14](../../13_K8s_Troubleshooting/README.md).
- **The ClusterIP never changes while the Service exists**, even as pods behind it are replaced. That
  stability is the whole reason to use a Service instead of pod IPs.

---

## ndots:5 and the cost of short names

`ndots:5` has a side effect worth knowing. An external name like `github.com` has one dot, which is
fewer than 5, so the resolver tries all three search suffixes **first**:

```
github.com.default.svc.cluster.local   NXDOMAIN
github.com.svc.cluster.local           NXDOMAIN
github.com.cluster.local               NXDOMAIN
github.com                             answer
```

Four queries instead of one, for every external lookup. On a busy service this is real load on
CoreDNS. The fix is a trailing dot, `github.com.`, which marks the name absolute and skips the search
list, or lowering `ndots` for that pod with `dnsConfig`.
