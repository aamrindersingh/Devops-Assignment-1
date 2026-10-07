output "bucket_name" {
  description = "Backup bucket, set as BACKUP_BUCKET in the CronJob"
  value       = aws_s3_bucket.backups.id
}

output "bucket_arn" {
  description = "ARN of the backup bucket"
  value       = aws_s3_bucket.backups.arn
}

output "backup_user_arn" {
  description = "IAM user the backup job authenticates as"
  value       = aws_iam_user.backup.arn
}

output "retention_days" {
  description = "How long a backup is kept"
  value       = var.backup_retention_days
}

output "create_access_key_command" {
  description = "Run this by hand. The key is deliberately not created by Terraform, so it never lands in state."
  value       = "aws iam create-access-key --user-name ${aws_iam_user.backup.name}"
}
