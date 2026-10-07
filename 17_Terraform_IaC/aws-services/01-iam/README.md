# IAM: Identity and Access Management

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## What it is

IAM controls **who** can do **what** to **which** AWS resources. Every single AWS API call is checked
against IAM before it runs, including the ones Terraform makes. It is free, it is global rather than
per region, and it is the first thing to get right in an account.

I learned this the hard way in this session. My Terraform was correct, `init`, `fmt`, `validate` and
`plan` all passed, and `apply` still failed:

```
Error: creating S3 Bucket (devops-hw-s3-dev-4c2e53f4): ... api error AccessDenied:
User: arn:aws:iam::<account>:user/amrinder is not authorized to perform: s3:CreateBucket
on resource: "arn:aws:s3:::devops-hw-s3-dev-4c2e53f4" because no identity-based policy
allows the s3:CreateBucket action
```

The credentials were valid; `sts get-caller-identity` worked fine. The user simply had no policy
granting S3. That error message is worth reading closely because it names all four things IAM cares
about: the **principal** (`user/amrinder`), the **action** (`s3:CreateBucket`), the **resource** (the
bucket ARN), and why it was denied (no policy allows it).

## The four building blocks

| Thing | What it is | Example |
|---|---|---|
| **User** | a long lived identity for a person or a script | `amrinder`, with an access key for the CLI |
| **Group** | a collection of users, so permissions are managed once | `developers`, `admins` |
| **Role** | an identity something *assumes* temporarily, with no permanent credentials | an EC2 instance role, a role for GitHub Actions |
| **Policy** | a JSON document listing allowed or denied actions | `AmazonS3FullAccess` |

Policies attach to users, groups or roles. They do nothing on their own.

## Policies

A policy is JSON. This one allows reading one bucket and nothing else:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOneBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ]
    }
  ]
}
```

Two ARNs are needed and the reason trips people up. `s3:ListBucket` acts on the **bucket**, so its
resource is `arn:aws:s3:::my-bucket`. `s3:GetObject` acts on **objects inside** it, so its resource
is `arn:aws:s3:::my-bucket/*`. Leave off the `/*` one and listing works while reading fails.

Policy types:

- **AWS managed**, written and maintained by AWS, such as `AmazonS3FullAccess`. Convenient, usually
  broader than you need.
- **Customer managed**, written by you, reusable across identities. The right default for anything
  real.
- **Inline**, embedded in a single user or role. Dies with it, and is hard to audit.

## How a request is evaluated

1. **Explicit deny anywhere wins.** Nothing overrides it.
2. Otherwise, an **explicit allow** in any attached policy permits the action.
3. Otherwise it is **denied by default.** That is what happened to my Terraform run: no deny existed,
   there was simply no allow.

"Deny by default" is why a brand new IAM user can do essentially nothing until you attach something.

## Least privilege

Grant only what is needed, for only as long as it is needed.

Why it matters concretely: the access key for this assignment lives on my laptop and is used by
Terraform. If that key leaks and it carries `AdministratorAccess`, the attacker owns the account. If
it only carries S3 and EC2 for one project, the damage is bounded.

How to actually do it rather than just say it:

- Start from nothing and add permissions when something fails. The error message names the exact
  missing action, as mine did above.
- Use **IAM Access Analyzer** to generate a policy from the actions a principal really used.
- Scope `Resource` to specific ARNs instead of `"*"`.
- Prefer **roles** over users, so credentials are short lived and nothing long lived exists to leak.

## Roles, and why they beat access keys

A role has no password and no permanent access key. Something assumes it and gets temporary
credentials that expire, usually within an hour.

| | IAM user with an access key | IAM role |
|---|---|---|
| Credential lifetime | until you rotate it, often forever | typically 1 hour |
| Stored where | a file on disk, a CI secret, sometimes a repo by accident | nowhere, fetched on demand |
| If leaked | valid until someone notices | expires on its own |
| Rotation | manual | automatic |

Common uses:

- **EC2 instance profile.** The instance gets credentials from the metadata service, so no keys on
  the box.
- **Service account roles for EKS (IRSA).** A Kubernetes ServiceAccount maps to an IAM role, so a pod
  gets exactly the AWS permissions it needs and nothing more.
- **OIDC for GitHub Actions.** The workflow exchanges its GitHub identity token for temporary AWS
  credentials, which removes the long lived secret from the repo entirely. That is the proper fix for
  the credential handling in Sessions 16 and 17.
- **Cross account access.** A role in account B trusts account A, so no credentials are shared.

## Best practices

1. Never use the **root** user for day to day work. Lock it, put MFA on it, do not create access keys
   for it.
2. MFA on every human user.
3. Prefer roles and temporary credentials over users with access keys.
4. Permissions on **groups**, not individual users.
5. Rotate access keys, and delete the ones nobody uses.
6. Scope `Resource` rather than defaulting to `"*"`.
7. Turn on **CloudTrail** so you can answer who did what.
8. Use **SCPs** in AWS Organizations as guardrails that even an account admin cannot escape.

On rotation: the key used for this assignment was pasted into a chat window, which means it must be
treated as exposed and deleted when the work is finished. Deleting a key in IAM is instant and free,
and there is no reason to leave a key alive once it has served its purpose.

## Common use cases

- A developer who should be able to read from S3 and nothing else.
- An EC2 instance that needs to write logs to CloudWatch, done with an instance profile.
- A CI pipeline deploying to EKS, done with OIDC so no key is stored.
- An auditor with `ReadOnlyAccess` across the account.
- A third party vendor given a cross account role with a narrow policy, instead of a user.
