output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "availability_zone" {
  description = "AZ the subnet and instance landed in"
  value       = aws_subnet.public.availability_zone
}

output "security_group_id" {
  description = "ID of the web security group"
  value       = aws_security_group.web.id
}

output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "Public IP of the instance"
  value       = aws_instance.web.public_ip
}

output "instance_private_ip" {
  description = "Private IP, from the subnet CIDR"
  value       = aws_instance.web.private_ip
}

output "website_url" {
  description = "Open this once the instance has finished booting"
  value       = "http://${aws_instance.web.public_ip}"
}

output "bucket_name" {
  description = "Name of the assets bucket"
  value       = aws_s3_bucket.assets.id
}

output "instance_role" {
  description = "IAM role the instance assumes to read the bucket"
  value       = aws_iam_role.ec2_s3_read.name
}
