output "bucket_name" {
  description = "Name of the created bucket"
  value       = aws_s3_bucket.demo.id
}

output "bucket_arn" {
  description = "ARN of the created bucket"
  value       = aws_s3_bucket.demo.arn
}

output "bucket_region" {
  description = "Region the bucket lives in"
  value       = aws_s3_bucket.demo.region
}

output "versioning_status" {
  description = "Whether object versioning is on"
  value       = aws_s3_bucket_versioning.demo.versioning_configuration[0].status
}

output "object_key" {
  description = "Key of the object uploaded by Terraform"
  value       = aws_s3_object.readme.key
}
