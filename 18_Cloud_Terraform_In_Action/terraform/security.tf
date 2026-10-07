resource "aws_security_group" "web" {
  name        = "${var.project_name}-web-sg"
  description = "HTTP from anywhere, SSH only if a CIDR is supplied"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-web-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web.id
  description       = "HTTP from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

# Only created when allowed_ssh_cidr is set. Leaving SSH open to
# 0.0.0.0/0 is the classic mistake, so the default here is no rule at all.
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  count = var.allowed_ssh_cidr == "" ? 0 : 1

  security_group_id = aws_security_group.web.id
  description       = "SSH from one specific address"
  cidr_ipv4         = var.allowed_ssh_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

# Security groups are stateful, so replies to inbound traffic are allowed
# automatically. This rule is for connections the instance starts itself,
# such as yum installing nginx.
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
