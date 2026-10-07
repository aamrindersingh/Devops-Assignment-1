# Kubernetes Volumes

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Notes and hands-on output for the six storage topics in Session 13. Everything here was run on my
local 2 node kind cluster. The manifests used are in this folder.

The thing that made storage click for me: a container's own filesystem dies with the container. Every
volume type below is a different answer to the question "how long should this data live, and who else
should see it".

| Type | Lives as long as | Shared with | Typical use |
|---|---|---|---|
| `emptyDir` | the Pod | containers in the same Pod | scratch space, caches, handoff between containers |
| `hostPath` | the node | anything on that node | node agents that must read the host filesystem |
| `PersistentVolume` | until an admin deletes it | whoever claims it | real data that must outlive Pods |
| `PersistentVolumeClaim` | until deleted | the Pods that mount it | how a Pod asks for a PV |
| `StorageClass` | cluster lifetime | all claims naming it | the recipe for making PVs on demand |
| Dynamic provisioning | per claim | the claim that triggered it | not writing PV YAML by hand |

---

## 1. emptyDir

An empty directory created when the Pod is assigned to a node. Both containers in
[emptydir-pod.yaml](emptydir-pod.yaml) mount the same `scratch` volume, so what the writer writes, the
reader can read.

```text
$ kubectl apply -f 01-kubernetes-volumes/emptydir-pod.yaml
pod/emptydir-demo created

$ kubectl wait --for=condition=Ready pod/emptydir-demo --timeout=120s
pod/emptydir-demo condition met

$ kubectl exec emptydir-demo -c reader -- cat /cache/note.txt
written by the writer container
```

The reader container never wrote that file. The writer did, and they share the volume.

To check it really is tied to the Pod I made a file by hand and then deleted the Pod:

```text
$ kubectl exec emptydir-demo -c reader -- sh -c "echo i-typed-this-by-hand > /cache/manual.txt"

$ kubectl exec emptydir-demo -c reader -- ls /cache
manual.txt
note.txt

$ kubectl delete pod emptydir-demo
pod "emptydir-demo" deleted from default namespace

$ kubectl apply -f 01-kubernetes-volumes/emptydir-pod.yaml && kubectl wait --for=condition=Ready pod/emptydir-demo --timeout=120s
pod/emptydir-demo created
pod/emptydir-demo condition met

$ kubectl exec emptydir-demo -c reader -- ls /cache
note.txt
```

`manual.txt` is gone. `note.txt` is back only because the writer container recreates it in its start
command. That is the whole point of emptyDir: new Pod, new empty directory.

One mistake I made first time round: I tried to prove this using `note.txt` itself and got confused
when it reappeared. The file I test with has to be one nothing in the Pod recreates.

**What I understood:** emptyDir is for data you would be happy to lose. It is good for a scratch
directory or for passing a file from one container to another inside the same Pod. It is not storage.

---

## 2. hostPath

Mounts a path from the node's own filesystem into the Pod. [hostpath-pod.yaml](hostpath-pod.yaml)
mounts the node's `/etc` read only.

```text
$ kubectl apply -f 01-kubernetes-volumes/hostpath-pod.yaml
pod/hostpath-demo created

$ kubectl get pod hostpath-demo -o wide
NAME            READY   STATUS    RESTARTS   AGE   IP           NODE               NOMINATED NODE   READINESS GATES
hostpath-demo   1/1     Running   0          1s    10.244.1.9   devops-hw-worker   <none>           <none>

$ kubectl exec hostpath-demo -- cat /node-etc/hostname
devops-hw-worker

$ docker exec devops-hw-worker cat /etc/hostname
devops-hw-worker
```

The last two commands are the proof. Reading `/node-etc/hostname` from inside the Pod gives the same
answer as reading `/etc/hostname` directly on the node container, and it matches the NODE column. The
Pod really is looking at the node's filesystem.

**What I understood:** hostPath ties a Pod to one specific machine. If the Pod is rescheduled onto
another node it will see that node's files instead, which is almost never what an application wants.
It is also a security hole if you mount it writable, since the Pod can then edit the node. Legitimate
uses are node level agents, which is exactly how `kindnet` and `kube-proxy` get at the host.

---

## 3 and 4. PersistentVolume and PersistentVolumeClaim

A PV is a piece of storage in the cluster. A PVC is a request for some of it. They are separate so
that whoever runs the cluster and whoever writes the app do not have to be the same person.

[pv-pvc.yaml](pv-pvc.yaml) creates a 200Mi PV by hand, a claim for 100Mi, and a Pod that mounts the
claim.

```text
$ kubectl get pv manual-pv
NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE
manual-pv   200Mi      RWO            Retain           Bound    default/manual-pvc   manual         <unset>                          28s

$ kubectl get pvc manual-pvc
NAME         STATUS   VOLUME      CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
manual-pvc   Bound    manual-pv   200Mi      RWO            manual         <unset>                 28s

$ kubectl exec manual-pv-pod -- cat /data/file.txt
data on a static PV
```

Worth noticing: the claim asked for 100Mi but the capacity column says 200Mi. Binding is not a split.
The claim got the whole PV because that was the smallest matching one, and the extra 100Mi is simply
wasted.

The first time I ran this the PVC sat in `Pending` and I thought the binding had failed. It had not, I
just checked five seconds in and the control loop had not run yet. `kubectl describe pvc` showed
`bind-completed: yes` a moment later. It also logged this warning:

```
Warning  ProvisioningFailed  persistentvolume-controller  storageclass.storage.k8s.io "manual" not found
```

That warning is harmless here. There is no StorageClass object called `manual`, so Kubernetes could
not dynamically provision anything, and it fell back to matching my hand written PV. If I had wanted
to silence it I could have used `storageClassName: ""` instead.

**What I understood:** the Pod never names a PV. It names a claim. That indirection is what lets the
same Deployment YAML run against a hostPath PV on my laptop and an EBS volume in AWS without changing
a line.

---

## 5 and 6. StorageClass and dynamic provisioning

kind ships one StorageClass already:

```text
$ kubectl get storageclass
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  19d
```

[dynamic-pvc.yaml](dynamic-pvc.yaml) has no PersistentVolume in it at all. Just a claim naming
`standard`, and a Pod. I counted the PVs before and after:

```text
$ kubectl get pv --no-headers | wc -l
       1

$ kubectl apply -f 01-kubernetes-volumes/dynamic-pvc.yaml
persistentvolumeclaim/dynamic-pvc created
pod/dynamic-pv-pod created

$ kubectl get pvc dynamic-pvc
NAME          STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
dynamic-pvc   Bound    pvc-314955f9-00c4-4b53-b8b3-0e1f912b5575   128Mi      RWO            standard       <unset>                 4s

$ kubectl get pv -o custom-columns=NAME:.metadata.name,CLAIM:.spec.claimRef.name,SC:.spec.storageClassName,SIZE:.spec.capacity.storage
NAME                                       CLAIM         SC         SIZE
manual-pv                                  manual-pvc    manual     200Mi
pvc-314955f9-00c4-4b53-b8b3-0e1f912b5575   dynamic-pvc   standard   128Mi
```

One PV before, two after, and the new one has a generated name of `pvc-` plus a UUID. Nobody wrote
that YAML. The `local-path` provisioner made it because a claim asked for it. Also note the size is
exactly 128Mi, the amount requested, not a round number off a shelf.

Checking it actually persists, this time with a file the container does not recreate on start:

```text
$ kubectl exec dynamic-pv-pod -- sh -c "echo i-typed-this-by-hand > /data/manual.txt"

$ kubectl delete pod dynamic-pv-pod
pod "dynamic-pv-pod" deleted from default namespace

$ kubectl get pvc dynamic-pvc
NAME          STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
dynamic-pvc   Bound    pvc-314955f9-00c4-4b53-b8b3-0e1f912b5575   128Mi      RWO            standard       <unset>                 88s

$ kubectl exec dynamic-pv-pod -- ls /data
hello.txt
manual.txt

$ kubectl exec dynamic-pv-pod -- cat /data/manual.txt
i-typed-this-by-hand
```

The Pod was deleted and recreated. The PVC stayed `Bound` the whole time and the file was still there.
Compare that with the emptyDir test further up, where the same experiment lost the file.

`VOLUMEBINDINGMODE: WaitForFirstConsumer` on the StorageClass is why the PV is not created the instant
the claim is made. It waits until a Pod actually needs it, so the volume gets created on whichever node
the Pod is scheduled to. For local storage that matters, because a volume on the wrong node is useless.

`RECLAIMPOLICY: Delete` means deleting the claim deletes the PV and the data with it. My hand written
PV used `Retain` instead, which keeps the data and leaves the PV in `Released` for an admin to deal
with.

**What I understood:** a StorageClass is a template for making storage on demand. Dynamic provisioning
is what happens when a claim names one. In a real cluster the provisioner would be talking to EBS or
GCE PD instead of making a directory on the node, but the YAML the application writes is identical.
