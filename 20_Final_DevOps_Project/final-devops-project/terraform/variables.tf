variable "aws_region" {
  description = "Region for the backup bucket"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Name prefix for every resource"
  type        = string
  default     = "clip"
}

variable "backup_retention_days" {
  description = "Delete backups older than this many days"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "backup_retention_days must be between 1 and 365."
  }
}
