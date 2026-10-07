# AMI IDs differ per region, so look one up instead of hardcoding.
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]

  # Credentials arrive through the instance metadata service rather than
  # being written onto the box.
  iam_instance_profile = aws_iam_instance_profile.ec2.name


  # Runs once on first boot. Installs nginx and writes a page that proves
  # which instance answered, so the demo needs no SSH at all.
  user_data = <<-EOF
    #!/bin/bash
    dnf install -y nginx
    TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
    IID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
      http://169.254.169.254/latest/meta-data/instance-id)
    AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
      http://169.254.169.254/latest/meta-data/placement/availability-zone)
    cat > /usr/share/nginx/html/index.html <<HTML
    <h1>DevOps Session 19</h1>
    <p>Provisioned by Terraform</p>
    <p>Instance: $IID</p>
    <p>AZ: $AZ</p>
    HTML
    systemctl enable --now nginx
  EOF

  # Re-run user_data if it changes, rather than leaving a stale instance.
  user_data_replace_on_change = true

  metadata_options {
    # IMDSv2 only. v1 is the one involved in SSRF credential theft.
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-web"
  }
}
