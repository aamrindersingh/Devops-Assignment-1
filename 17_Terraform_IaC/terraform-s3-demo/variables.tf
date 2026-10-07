variable "aws_region" {
  description = "AWS region to create resources in"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Name prefix used for resources and tags"
  type        = string
  default     = "devops-hw-s3"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "project_name must be lowercase letters, digits and hyphens only, because it becomes part of an S3 bucket name."
  }
}

variable "environment" {
  description = "Environment label"
  type        = string
  default     = "dev"
}

variable "enable_versioning" {
  description = "Keep previous versions of every object"
  type        = bool
  default     = true
}
