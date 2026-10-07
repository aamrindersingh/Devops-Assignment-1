resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "assets" {
  bucket        = "${var.project_name}-assets-${random_id.suffix.hex}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-assets"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------------------------
# The dependency chain the task asks to demonstrate:
#
#   aws_s3_bucket.assets
#        └── aws_iam_role_policy.s3_read   (references the bucket ARN)
#             └── aws_iam_role.ec2_s3_read
#                  └── aws_iam_instance_profile.ec2
#                       └── aws_instance.web
#
# Terraform works this order out on its own from the references. Nothing
# below uses depends_on.
#
# The point of the role: the instance reads the bucket using temporary
# credentials from the metadata service. No access key is ever written to
# the machine, so there is nothing on it to leak.
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ec2_s3_read" {
  name = "${var.project_name}-ec2-s3-read"

  # Who is allowed to assume this role. "ec2.amazonaws.com" means the
  # EC2 service does, on behalf of an instance.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "s3_read" {
  name = "${var.project_name}-s3-read"
  role = aws_iam_role.ec2_s3_read.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:ListBucket"]
      # Two ARNs, and both are needed. ListBucket acts on the bucket
      # itself, GetObject acts on the objects inside it.
      Resource = [
        aws_s3_bucket.assets.arn,
        "${aws_s3_bucket.assets.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_s3_read.name
}

resource "aws_s3_object" "note" {
  bucket       = aws_s3_bucket.assets.id
  key          = "note.txt"
  content      = "Read by the EC2 instance through its IAM role, no access key involved.\n"
  content_type = "text/plain"
}
