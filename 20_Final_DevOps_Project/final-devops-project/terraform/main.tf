resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  bucket_name   = "${var.project_name}-backups-${random_id.suffix.hex}"
  backup_prefix = "backups/"
}

# ---------------------------------------------------------------------------
# Where database dumps go
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "backups" {
  bucket = local.bucket_name
  # Set so terraform destroy works for a coursework project. A real backup
  # bucket would not have this, for the obvious reason.
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

# Backups are worthless if they grow without limit and someone turns them
# off to save money, so they expire on a schedule.
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket     = aws_s3_bucket.backups.id
  depends_on = [aws_s3_bucket_versioning.backups]

  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    filter { prefix = local.backup_prefix }

    expiration { days = var.backup_retention_days }
    noncurrent_version_expiration { noncurrent_days = 7 }
    abort_incomplete_multipart_upload { days_after_initiation = 3 }
  }
}

# ---------------------------------------------------------------------------
# Identity for the backup job
#
# On EKS this whole block would be an IAM role assumed through IRSA and
# there would be no access key anywhere. kind has no OIDC provider, so the
# honest fallback is a user with the narrowest policy that still works.
#
# Narrow means: one action, one prefix, one bucket. The job can write a
# backup and can do nothing else. It cannot read backups, cannot delete
# them, cannot list the bucket, and cannot see any other bucket.
# ---------------------------------------------------------------------------
resource "aws_iam_user" "backup" {
  name = "${var.project_name}-backup-writer"
  path = "/service/"
}

resource "aws_iam_user_policy" "backup_write_only" {
  name = "${var.project_name}-backup-write-only"
  user = aws_iam_user.backup.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "WriteBackupsOnly"
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${aws_s3_bucket.backups.arn}/${local.backup_prefix}*"
    }]
  })
}
