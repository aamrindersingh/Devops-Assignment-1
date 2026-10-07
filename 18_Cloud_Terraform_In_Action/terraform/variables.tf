variable "aws_region" {
  description = "Region to build in"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix for every resource name"
  type        = string
  default     = "devops-hw-s19"
}

variable "vpc_cidr" {
  description = "CIDR for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "public_subnet_cidr" {
  description = "CIDR for the public subnet, must sit inside vpc_cidr"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  # t2.micro is not offered in ap-south-1 on this account, and the account
  # is on the newer Free Tier plan which refuses non eligible types outright:
  #   InvalidParameterCombination: The specified instance type is not
  #   eligible for Free Tier
  # aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true
  # lists t3.micro here, so that is the default.
  description = "EC2 size. Must be free tier eligible in the target region."
  type        = string
  default     = "t3.micro"
}

variable "allowed_ssh_cidr" {
  description = "Who may reach port 22. Defaults to nobody on purpose; set it to <your-ip>/32 if you need SSH."
  type        = string
  default     = "" # empty means the SSH rule is not created at all
}
