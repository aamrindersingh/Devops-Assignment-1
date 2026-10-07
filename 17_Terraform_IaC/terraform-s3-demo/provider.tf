# Pin the provider so a future major release cannot change behaviour
# underneath this project without an explicit version bump.
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Tags applied to every resource this provider creates, so everything
  # made by this project can be found and cleaned up later.
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "Terraform"
      Owner     = "24BCS10596"
    }
  }
}
