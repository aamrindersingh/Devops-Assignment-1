# VPC: Virtual Private Cloud

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## What it is

A VPC is your own private network inside AWS. You choose the IP range, carve it into subnets, and
decide what can route where. EC2 instances, RDS databases and load balancers all live inside one.

Every account gets a **default VPC** per region, already wired for internet access. It is why you can
launch an EC2 instance and reach it without reading any of this. It is also why people deploy
databases onto public subnets by accident.

## CIDR

A CIDR block is an IP range written as `address/prefix`. The prefix is how many bits are fixed, so
the rest are available for hosts.

| CIDR | Addresses | Usable in AWS |
|---|---|---|
| `/16` | 65,536 | 65,531 |
| `/20` | 4,096 | 4,091 |
| `/24` | 256 | 251 |
| `/28` | 16 | 11 |

AWS reserves **5 addresses in every subnet**: network address, VPC router, DNS, one for future use,
and broadcast. So a `/28` gives you 11 usable, not 16. That matters when sizing small subnets.

Use private ranges (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`. A VPC CIDR cannot be
changed after creation, only extended with secondary blocks, so pick something roomy. `10.0.0.0/16`
is the usual choice.

The other rule: if you might ever peer this VPC with another one, or connect it to an office network,
the ranges must not overlap. Two VPCs both on `10.0.0.0/16` cannot be peered, and that is painful to
discover later.

## Subnets

A subnet is a slice of the VPC CIDR that lives in exactly **one Availability Zone**. Being AZ bound
is the whole reason you create several: spreading subnets across AZs is how an application survives
one AZ failing.

A typical layout for `10.0.0.0/16` in two AZs:

| Subnet | CIDR | AZ | Type |
|---|---|---|---|
| public-1a | `10.0.1.0/24` | ap-south-1a | public |
| public-1b | `10.0.2.0/24` | ap-south-1b | public |
| private-1a | `10.0.11.0/24` | ap-south-1a | private |
| private-1b | `10.0.12.0/24` | ap-south-1b | private |

## Public vs private subnet

This is the part that confuses people, because **there is no "public" checkbox.** A subnet is public
purely because of its route table:

- **Public subnet:** its route table has a route `0.0.0.0/0 -> Internet Gateway`.
- **Private subnet:** it does not.

That one route is the entire difference. Everything else follows from it.

| | Public subnet | Private subnet |
|---|---|---|
| Default route points at | Internet Gateway | NAT Gateway, or nothing |
| Can be reached from the internet | yes, with a public IP | no |
| Can reach the internet | yes | only outbound, via NAT |
| What goes here | load balancers, bastion hosts, NAT Gateways | app servers, databases, caches |

## Route tables

A route table is a list of "traffic for this destination goes to that target". Each subnet is
associated with exactly one.

A public subnet's table:

| Destination | Target |
|---|---|
| `10.0.0.0/16` | `local` |
| `0.0.0.0/0` | `igw-xxxx` |

A private subnet's table:

| Destination | Target |
|---|---|
| `10.0.0.0/16` | `local` |
| `0.0.0.0/0` | `nat-xxxx` |

The `local` route is created automatically and cannot be removed. It is why everything inside a VPC
can reach everything else by default, with security groups doing the actual restricting.

Routing is **most specific wins**. A route for `10.0.5.0/24` beats `0.0.0.0/0` for an address in that
range.

## Internet Gateway

A horizontally scaled, highly available component attached to the VPC that allows two way internet
traffic. One per VPC.

An instance needs three things to be reachable from the internet, and all three:

1. a **public IP** (or Elastic IP)
2. a route to an **IGW**
3. a **security group** allowing the port

Missing any one of them and it does not work, which is the usual cause of "my instance has a public
IP but I cannot reach it".

## NAT Gateway

Lets instances in a **private** subnet make outbound connections (package updates, API calls, pulling
container images) while remaining unreachable from outside.

It is one way by design: outbound is allowed, inbound connections are not.

Practical notes that matter:

- The NAT Gateway itself lives in a **public** subnet, and needs an Elastic IP.
- It is **AZ specific.** For real high availability you need one per AZ, otherwise losing that AZ cuts
  internet access for private subnets in the others.
- It is **not cheap**: roughly $32 a month per gateway plus data processing charges. One per AZ across
  three AZs is around $100/month before any traffic. It is frequently the largest line item in a small
  AWS bill.

For this reason I would not create one in a learning project. **VPC endpoints** are the cheaper answer
where they fit: a Gateway endpoint for S3 and DynamoDB is free and keeps that traffic off the NAT
entirely.

A **NAT Instance** is the old do-it-yourself version on an EC2 box. Cheaper, but you own the patching
and it is a single point of failure.

## Security Groups vs Network ACLs

Both filter traffic, at different layers.

| | Security Group | Network ACL |
|---|---|---|
| Attached to | an ENI, so effectively an instance | a subnet |
| Stateful? | **yes**, replies are automatic | **no**, you need an explicit rule each way |
| Rules | allow only | allow **and** deny |
| Evaluation | all rules together | in number order, first match wins |
| Default | deny inbound, allow outbound | default NACL allows everything |

The stateful difference is the one that causes real debugging pain. With a security group, allowing
inbound 443 is enough. With a NACL you must also allow the **outbound ephemeral port range**
(1024-65535), because the reply goes back on a high port. Forget that and connections hang with no
obvious cause.

In practice: use security groups for nearly everything. Reach for NACLs only when you need an
explicit **deny**, such as blocking a specific IP range, since security groups cannot express that.

## Common use cases

- **Three tier application.** Public subnets hold the load balancer, private subnets hold the app, a
  separate private tier holds the database with a security group that only accepts the app's group.
- **EKS cluster.** Worker nodes in private subnets, load balancers in public ones.
- **Hybrid connectivity.** Site-to-Site VPN or Direct Connect into on premises, with non overlapping
  CIDRs.
- **Isolated environments.** A VPC each for dev, staging and prod so a mistake cannot cross.

## How this maps to Kubernetes networking

Having done Sessions 11 and 12 first, the parallels are close enough to be useful:

| AWS VPC | Kubernetes |
|---|---|
| Security Group | NetworkPolicy |
| Public subnet | a node with an external IP, or a LoadBalancer Service |
| Private subnet | ClusterIP, internal only |
| Internet Gateway | the cluster's egress and ingress path |
| Route table | kube-proxy's routing rules |

Both default to flat and open internally, and both make you add restriction deliberately.

## What Session 19 builds

VPC `10.0.0.0/16`, one public subnet with an Internet Gateway and a route table sending `0.0.0.0/0`
to it, a security group allowing 80 from anywhere and 22 from my own IP only, an EC2 instance in the
public subnet, and an S3 bucket alongside. No NAT Gateway, deliberately, because of the cost noted
above.
