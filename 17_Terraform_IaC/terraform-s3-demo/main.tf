# S3 bucket names are globally unique across every AWS account, so a fixed
# name would collide with somebody else's. A random suffix avoids that.
resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "demo" {
  bucket = "${var.project_name}-${var.environment}-${random_id.suffix.hex}"

  # Lets terraform destroy remove the bucket even if objects were put in it
  # by hand. Would not be set on a production bucket.
  force_destroy = true

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

# Block every form of public access. These four are separate flags and all
# four matter; leaving any of them off is how buckets end up world readable.
resource "aws_s3_bucket_public_access_block" "demo" {
  bucket = aws_s3_bucket.demo.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "demo" {
  bucket = aws_s3_bucket.demo.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# SSE-S3 (AES256) is free and on by default for new buckets now, but
# declaring it means the state records the intent rather than relying on
# an AWS default that could change.
resource "aws_s3_bucket_server_side_encryption_configuration" "demo" {
  bucket = aws_s3_bucket.demo.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Moves old versions to cheaper storage and eventually deletes them, so
# versioning does not grow the bill without limit.
resource "aws_s3_bucket_lifecycle_configuration" "demo" {
  bucket = aws_s3_bucket.demo.id

  # Terraform does not know that versioning must exist before a lifecycle
  # rule that references noncurrent versions, so the dependency is explicit.
  depends_on = [aws_s3_bucket_versioning.demo]

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

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
}

# A small object so the bucket is not empty and the demo can read something
# back out after apply.
resource "aws_s3_object" "readme" {
  bucket       = aws_s3_bucket.demo.id
  key          = "hello.txt"
  content      = "Created by Terraform for DevOps Session 18.\n"
  content_type = "text/plain"
}
