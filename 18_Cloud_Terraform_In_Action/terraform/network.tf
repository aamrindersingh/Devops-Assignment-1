# ---------------------------------------------------------------------------
# VPC and networking
#
#   VPC 10.0.0.0/16
#    └── public subnet 10.0.1.0/24  (ap-south-1a)
#         ├── route 0.0.0.0/0 -> Internet Gateway   <- this is what makes it public
#         └── EC2 instance
#
# No NAT Gateway on purpose. It would cost roughly $32/month and nothing
# here sits in a private subnet.
# ---------------------------------------------------------------------------

# Look the AZs up rather than hardcoding "ap-south-1a", so the same code
# works in a region with different AZ names.
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # Both are needed for instances to get DNS names inside the VPC.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidr
  availability_zone = data.aws_availability_zones.available.names[0]

  # Without this an instance launched here gets no public IP and is
  # unreachable even with the IGW route in place.
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # The local route for 10.0.0.0/16 is created automatically and is not
  # written here. This is the route that makes the subnet public.
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
