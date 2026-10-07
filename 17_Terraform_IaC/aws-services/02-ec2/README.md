# EC2: Elastic Compute Cloud

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## What it is

EC2 is virtual machines you rent by the second. You choose the size, the operating system image and
the network it sits in, and AWS runs it on their hardware. It is the oldest and most general compute
service: anything that runs on a Linux or Windows server runs on EC2.

Where it sits relative to things I have used in this course: a container needs a machine to run on.
On my laptop that machine is Docker Desktop's VM. On AWS it would be an EC2 instance, or a managed
service such as EKS or Fargate that is running EC2 underneath.

## AMI

An **Amazon Machine Image** is the template an instance boots from: the OS, pre-installed software,
and the initial disk contents.

- AWS publishes them (Amazon Linux 2023, Ubuntu, Windows Server).
- The Marketplace has vendor images.
- You can build your own, which is what golden image pipelines do with Packer.

An AMI is **region specific**. The same Ubuntu release has a different AMI ID in `ap-south-1` than in
`us-east-1`, which is why hardcoding an AMI ID in Terraform breaks the moment you change region. The
fix is a data source that looks it up:

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}
```

The conceptual parallel to Docker is close: AMI is to EC2 roughly what an image is to a container.
The difference is that an AMI carries a whole operating system and boots a full VM, where a container
image carries only the application layers and shares the host kernel.

## Instance types

The naming is systematic once you see it. `t3.medium`:

- `t` = family (burstable general purpose)
- `3` = generation
- `medium` = size within the family

| Family | For | Example |
|---|---|---|
| `t` | burstable, cheap, bursty workloads | `t3.micro`, free tier eligible |
| `m` | balanced general purpose | `m6i.large` |
| `c` | compute optimised, high CPU | `c6i.xlarge` |
| `r` | memory optimised | `r6i.large` |
| `i`, `d` | storage optimised, high local IO | `i4i.large` |
| `g`, `p` | GPU | `g5.xlarge` |

The `t` family's burst behaviour is worth understanding because it causes confusing production
issues: a `t3` instance earns CPU credits while idle and spends them when busy. Run it hot for long
enough and the credits run out, at which point it is throttled to its baseline and everything gets
slow for no visible reason.

## Key pairs

An SSH key pair for logging in. AWS keeps the public key, you keep the private key. The private key
is shown **once** at creation and cannot be retrieved later; lose it and you cannot SSH to instances
that use it.

Better than SSH for most cases now is **SSM Session Manager**, which gives a shell through the AWS
API with no key, no open port 22 and a full audit trail in CloudTrail.

## Security Groups

A stateful virtual firewall attached to an instance's network interface.

- **Stateful** is the key word: allow traffic in, and the reply is automatically allowed out. You do
  not write a matching outbound rule.
- Rules are **allow only.** There is no deny rule. Anything not allowed is denied.
- Default outbound is allow all; default inbound is deny all.
- A rule's source can be a CIDR **or another security group**, which is how you say "only the app tier
  may reach the database" without knowing any IPs.

That last point is the one to actually use. A database security group allowing port 3306 from the
app's security group keeps working as instances come and go, because it never mentions an address.

The classic mistake is `0.0.0.0/0` on port 22. That exposes SSH to the whole internet, and such hosts
get found within minutes.

## EBS

**Elastic Block Store** is a network attached virtual disk. It outlives the instance, so stopping an
instance does not lose the data.

| Type | What it is | Use |
|---|---|---|
| `gp3` | general purpose SSD, IOPS set independently of size | the sensible default |
| `gp2` | older general purpose SSD, IOPS tied to size | legacy |
| `io2` | provisioned IOPS SSD | demanding databases |
| `st1` | throughput optimised HDD | big sequential reads, logs |

EBS volumes are **Availability Zone scoped**, which has a real consequence: an instance in
`ap-south-1a` cannot attach a volume in `ap-south-1b`. Snapshots (stored in S3) are how you move data
between AZs or regions.

Also distinct from EBS is the **instance store**, physically attached NVMe on the host. Very fast and
**lost when the instance stops.** Only for scratch data.

The parallel to Session 13 is direct: EBS is to EC2 what a PersistentVolume is to a pod, and instance
store is what `emptyDir` is. Both pairs are "survives the compute" against "dies with it".

## Public vs private IP

| | Private IP | Public IP | Elastic IP |
|---|---|---|---|
| Reachable from internet | no | yes | yes |
| Survives a stop/start | yes | **no**, you get a new one | yes |
| Cost | free | free while attached | small charge when **not** attached |

The middle column catches people out. Stop and start an instance with an auto assigned public IP and
it comes back with a different address, breaking anything that pointed at the old one. An **Elastic
IP** is a static public address you own and can move between instances.

Note the Elastic IP billing is backwards from the intuition: you are charged for one that is
**allocated but unused**, to discourage hoarding scarce IPv4 addresses.

## Instance lifecycle

```
pending ──> running ──> stopping ──> stopped ──> (start) ──> running
                 │                        │
                 └──> shutting-down ──> terminated
```

| State | Billed for compute? | EBS kept? |
|---|---|---|
| `running` | yes | yes |
| `stopped` | no | yes, and still billed for storage |
| `terminated` | no | root volume deleted by default |

`stopped` vs `terminated` is the distinction that matters. Stopping pauses the bill for compute and
keeps the disk. Terminating is permanent, and by default takes the root EBS volume with it. A stopped
instance also usually moves to different physical hardware when restarted, which is why the public IP
changes and why instance store data is lost.

## Common use cases

- Web and application servers, usually several behind a load balancer in an Auto Scaling group.
- Self managed databases, where RDS does not fit.
- Batch and CI runners, often on **Spot** instances at up to 90% off in exchange for being
  interruptible.
- Kubernetes nodes. An EKS node group is EC2 instances.
- Lift and shift of an existing on premises server.

## What I would use in a Terraform project

For Session 19 the EC2 piece would be: an AMI looked up with a data source rather than hardcoded, a
`t2.micro` or `t3.micro` to stay inside the free tier, a security group allowing only port 80 from
the internet and port 22 from my own IP, in a public subnet with an Internet Gateway, and `user_data`
to install nginx on first boot so the instance is useful without logging into it.
