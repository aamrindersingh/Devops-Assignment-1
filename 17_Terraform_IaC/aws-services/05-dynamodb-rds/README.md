# DynamoDB and RDS: Database Services

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Two managed database services that solve different problems. RDS runs a relational database for you.
DynamoDB is a NoSQL key value and document store with no servers at all.

---

# DynamoDB

## What it is

A fully managed NoSQL database. There is no instance to size, no version to patch and no connection
pool. You create a table and read and write it over the AWS API, and it scales to whatever throughput
you ask for.

Single digit millisecond latency at effectively any scale is the headline, and the reason is that
every access is designed to be a direct lookup by key rather than a search.

## Tables, items and attributes

The relational words map roughly, but not exactly:

| DynamoDB | Roughly like | Difference |
|---|---|---|
| Table | table | no fixed schema beyond the key |
| Item | row | max 400 KB, attributes vary per item |
| Attribute | column | each item can have different ones |

Only the **key** attributes are required and typed up front. Everything else is per item. Two items
in the same table can have completely different fields, which is what "schemaless" means here.

## Partition key and sort key

This is the part that decides whether a DynamoDB table works well or badly.

**Partition key** (required). DynamoDB hashes it to choose which physical partition stores the item.
Alone, it must be unique per item.

**Sort key** (optional). With one, the primary key is the **pair**. Several items can share a
partition key as long as the sort key differs, and they are stored sorted, which makes range queries
on them cheap.

```
Table: Orders
  Partition key: customer_id
  Sort key:      order_date

customer_id  order_date    total
C001         2026-01-15    450
C001         2026-03-22    1200     <- same partition, different sort key
C001         2026-10-07    300
C002         2026-02-11    890
```

"All orders for C001 between March and October" is one efficient query, because those items are
adjacent and sorted.

### The thing to get right

**You design the key around your queries, not around the data.** This is the opposite of relational
modelling, where you normalise first and write whatever query you need later. In DynamoDB a query the
key does not support means a **Scan**, which reads the entire table and gets slower and more expensive
as the table grows.

A **hot partition** is the other failure. Choosing a partition key with few distinct values, say
`status` with three possible values, funnels all traffic into three partitions and throttles. A good
partition key has high cardinality and even access.

**Global Secondary Indexes** let you query on other attributes, effectively a second copy of the
table with a different key. They cost extra storage and write capacity.

## Capacity modes

- **On-demand**: pay per request, scales instantly. Right for unpredictable traffic and for learning.
- **Provisioned**: you set read and write capacity units, cheaper at steady predictable load, can
  autoscale.

## Use cases

- Session and token stores
- User profiles and preferences
- Shopping carts
- IoT and event ingestion at high write rates
- Leaderboards and counters
- **Terraform state locking**, paired with an S3 backend. A small table where the lock is one item.

---

# RDS

## What it is

A managed relational database. AWS runs the instance, the backups, the patching, the failover and
the replicas. You still get a normal SQL database with a normal connection string, so existing
applications do not change.

What AWS takes over: provisioning, OS and engine patching, automated backups, point in time
recovery, failover, replicas, monitoring. What stays yours: schema design, indexes, queries, and
whether your application opens too many connections.

## Supported engines

| Engine | Notes |
|---|---|
| PostgreSQL | strong default for new work |
| MySQL | very widely used |
| MariaDB | MySQL fork |
| Oracle | licence required |
| SQL Server | licence required |
| **Aurora** (MySQL and PostgreSQL compatible) | AWS's own, separates storage from compute, faster failover |

Aurora is worth calling out as a different architecture rather than just another engine: storage is a
distributed layer across three AZs with six copies, so failover is seconds rather than a minute, and
read replicas share the same storage instead of replicating into their own.

## DB instances

Sized like EC2, because underneath it is EC2: `db.t3.micro`, `db.m6g.large`, `db.r6g.xlarge`. Storage
is EBS, usually `gp3`, and can autoscale.

`db.t3.micro` is free tier eligible, which is what a learning project would use.

## Security

Layered, and all layers matter:

1. **Network.** Put it in a **private subnet.** An RDS instance should never have `publicly_accessible
   = true` outside a sandbox.
2. **Security group.** Allow 5432 or 3306 **only from the application's security group**, not from a
   CIDR. That keeps working as app instances come and go.
3. **Credentials.** Store in Secrets Manager, which can rotate them automatically. Never in code, and
   never in a Terraform variable that ends up in state.
4. **Encryption.** At rest with KMS, which must be enabled **at creation** and cannot be turned on
   later without a snapshot and restore. In transit with TLS.
5. **IAM database authentication** as an alternative to passwords, using short lived tokens.

The Terraform specific warning: a `password` attribute goes into the state file in plaintext. That is
one of the main reasons state must be stored in an encrypted S3 bucket with tight access, and why my
`.gitignore` excludes `*.tfstate`.

## Backups

- **Automated backups**: daily snapshot plus transaction logs, retained 1 to 35 days, enabling
  **point in time recovery** to any second in the window.
- **Manual snapshots**: taken on demand, kept until you delete them.

A restore always creates a **new instance**. You cannot restore in place, so the recovery runbook
involves repointing the application at a new endpoint.

## Multi-AZ

A synchronous standby in a second Availability Zone.

- The standby is **not readable.** It is purely for failover. This surprises people who expect to get
  a free read replica out of it.
- Failover is automatic, typically 60 to 120 seconds, and the **endpoint name stays the same** while
  the DNS record is repointed.
- It roughly doubles the cost.

## Read replicas

Asynchronous copies used to scale reads.

- **Readable**, unlike the Multi-AZ standby.
- Up to 15 for most engines.
- Can live in another region, which is useful for disaster recovery and for serving distant users.
- Can be **promoted** to a standalone primary.
- **Eventually consistent**, so replication lag means a read just after a write may return stale
  data. An application that writes then immediately reads back has to account for that.

| | Multi-AZ standby | Read replica |
|---|---|---|
| Replication | synchronous | asynchronous |
| Readable | no | yes |
| Purpose | availability | read scaling |
| Failover | automatic | manual promotion |
| Cross region | no | yes |

## Use cases

- Any application with a normal relational schema and joins
- Transactional systems that need ACID guarantees
- Reporting, served off a read replica so analytics do not hurt the primary
- Lifting an existing MySQL or PostgreSQL application into AWS unchanged

---

# Choosing between them

| | DynamoDB | RDS |
|---|---|---|
| Model | key value / document | relational |
| Schema | flexible beyond the key | fixed, migrations to change |
| Queries | by key, or by index | arbitrary SQL, joins, aggregates |
| Scaling | horizontal, automatic | vertical, plus read replicas |
| Transactions | limited, up to 100 items | full ACID |
| Latency | single digit ms, predictable | depends on query and instance |
| Ops burden | none | low, but you size and tune it |
| Cost shape | per request or per capacity | per hour the instance exists |

**DynamoDB** when the access patterns are known and simple, the scale is large or spiky, and you want
no servers. Session stores, carts, event streams.

**RDS** when you need joins and ad hoc queries, when the data is genuinely relational, or when you are
moving an existing SQL application.

The honest summary: DynamoDB is cheaper and faster when it fits, and painful when your queries change
in a way the key design did not anticipate. RDS is more flexible and makes you do more operational
thinking. For a project where the query patterns are still moving, relational is usually the safer
starting point.
