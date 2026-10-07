# S3: Simple Storage Service

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## What it is

S3 is object storage. You put a file in and get it back by key over HTTP. There is no filesystem, no
mounting, no capacity to provision. It is effectively unlimited, extremely durable, and cheap.

The mental shift from a disk: S3 is not a filesystem. There are no real directories, you cannot
append to the middle of an object, and you cannot open a file handle. You `PutObject` and `GetObject`
whole. The "folders" in the console are a display convention over keys containing `/`.

The S3 bucket in [terraform-s3-demo](../../terraform-s3-demo) is the practical half of this.

## Buckets

A bucket is the top level container.

- The name is **globally unique across every AWS account on earth**. Not per account, not per region.
  If someone has `test-bucket`, nobody else can have it.
- Lives in one region, chosen at creation.
- There is no practical limit on how many objects go in one.

Global uniqueness is why my Terraform appends a random suffix:

```hcl
resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "demo" {
  bucket = "${var.project_name}-${var.environment}-${random_id.suffix.hex}"
}
```

A fixed name would work once on my account and collide for anyone else running the same code.

## Objects

An object is the data plus its metadata, addressed by a **key**.

- Key: the full path-looking string, `logs/2026/10/07/app.log`
- Size: 0 bytes up to 5 TB, with multipart upload required above 5 GB
- Metadata: content type, cache headers, and your own key/value pairs

The `/` characters are just part of the key. Listing with `prefix=logs/2026/` is how the console
fakes a folder tree.

## Storage classes

Same durability, different price and retrieval behaviour.

| Class | For | Retrieval |
|---|---|---|
| **Standard** | frequently accessed | instant |
| **Intelligent-Tiering** | unpredictable access | instant, moves data automatically |
| **Standard-IA** | infrequent but needs to be instant | instant, cheaper storage, per GB retrieval fee |
| **One Zone-IA** | infrequent, reproducible | instant, one AZ only, cheaper and less durable |
| **Glacier Instant Retrieval** | archive, occasionally needed now | instant |
| **Glacier Flexible Retrieval** | archive | minutes to hours |
| **Glacier Deep Archive** | compliance, years | up to 12 hours, cheapest |

The trap in the IA classes is the **minimum storage duration**. Standard-IA bills a minimum of 30
days per object. Storing something for a week in IA can cost more than Standard, so the cheaper class
is only cheaper if the data actually sits still.

## Versioning

With versioning on, overwriting an object keeps the old copy under a new version ID, and deleting it
writes a **delete marker** rather than removing anything.

```hcl
resource "aws_s3_bucket_versioning" "demo" {
  bucket = aws_s3_bucket.demo.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

What it protects against: an overwrite with bad data, an accidental delete, and ransomware that
encrypts objects in place. The old version is still there.

Two things to know. Versioning can be **suspended but never turned off**, so existing versions stay.
And every version is billed, which is why it should always be paired with a lifecycle rule.

## Lifecycle policies

Rules that move or delete objects automatically with age. The one in my Terraform keeps versioning
from growing without limit:

```hcl
rule {
  id     = "expire-old-versions"
  status = "Enabled"

  noncurrent_version_transition {
    noncurrent_days = 30
    storage_class   = "STANDARD_IA"
  }
  noncurrent_version_expiration {
    noncurrent_days = 90
  }
  abort_incomplete_multipart_upload {
    days_after_initiation = 7
  }
}
```

Old versions go to cheaper storage after 30 days and are deleted after 90. The third rule cleans up
failed multipart uploads, which is a genuine hidden cost: an upload that dies halfway leaves parts
that are billed and invisible in a normal listing.

## Encryption

| Type | Who holds the key | Notes |
|---|---|---|
| **SSE-S3** | AWS, transparently | AES256, free, on by default for new buckets |
| **SSE-KMS** | AWS KMS, key you control | auditable in CloudTrail, supports key rotation, small cost |
| **SSE-C** | you supply the key per request | you manage keys entirely |
| **Client side** | you, before upload | AWS never sees plaintext |

My bucket declares SSE-S3 explicitly even though it is now the default:

```hcl
rule {
  apply_server_side_encryption_by_default {
    sse_algorithm = "AES256"
  }
  bucket_key_enabled = true
}
```

Declaring a default makes the intent explicit in state and in review, instead of depending on an AWS
default that could change. For anything with real data I would use SSE-KMS, because KMS gives an
audit trail of who decrypted what.

## Bucket policies and public access

Access can come from several directions, which is why S3 leaks happen:

- **IAM policies** on the caller
- **Bucket policies**, JSON attached to the bucket
- **ACLs**, the legacy mechanism, now disabled by default
- **Block Public Access**, an override that wins over all of the above

Block Public Access is four separate switches and all four should be on unless you are deliberately
hosting a public site:

```hcl
resource "aws_s3_bucket_public_access_block" "demo" {
  bucket                  = aws_s3_bucket.demo.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

Turning on only some of them is how a bucket ends up world readable while looking locked down. The
two `block_*` flags stop new public grants; the `ignore_` and `restrict_` flags neutralise ones that
already exist.

For serving public content the right pattern is not a public bucket at all. It is CloudFront in front
of a private bucket, using an Origin Access Control so only CloudFront can read it.

## Common use cases

- Static website hosting, behind CloudFront.
- Backups and archives, with lifecycle rules into Glacier.
- Data lake storage, queried in place by Athena.
- Application assets: uploads, images, generated reports.
- **Terraform remote state**, with S3 holding the state file and DynamoDB providing a lock. That is
  the standard setup and is what I would move to if more than one person worked on this project; my
  state is currently local, which is fine for one person and wrong for a team.
- Log destination for CloudTrail, ALB access logs and VPC flow logs.

## In my Terraform project

[terraform-s3-demo](../../terraform-s3-demo) creates a bucket with a random suffix for uniqueness,
all four Block Public Access flags on, versioning enabled, SSE-S3 declared, a lifecycle rule
expiring old versions, and one object uploaded so the bucket is not empty. `force_destroy = true` is
set so `terraform destroy` can remove it even with objects in it, which I would not do on a real
bucket.
