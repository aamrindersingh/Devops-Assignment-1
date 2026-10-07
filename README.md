# DevOps Assignment 1

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Homework for the DevOps course. Every topic has its own folder with a `README.md` that contains the commands I ran, the output from my terminal, and what I understood.

## Section A – submission links

| # | Topic | README |
|---|---|---|
| 1 | Linux Fundamentals | [01_Linux_Fundamental/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/01_Linux_Fundamental/README.md) |
| 2 | Shell Scripting | [02_shell_scripting/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/02_shell_scripting/README.md) |
| 3 | Networking | [03_networking/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/03_networking/README.md) |
| 4 | Git and GitHub | [04_git/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/04_git/README.md) |
| 5 | Docker Fundamentals | [05_Docker_Fundamental/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/05_Docker_Fundamental/README.md) |
| 6 | Docker Images | [06_DockerFiles_Images/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/06_DockerFiles_Images/README.md) |
| 7 | Docker Networking | [07_Docker_Networking/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/07_Docker_Networking/README.md) |
| 8 | Kubernetes Fundamentals | [08_Kubernetes_Fundamentals/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/08_Kubernetes_Fundamentals/README.md) |
| 9 | Kubernetes Pods, ReplicaSets & Deployments | [09_K8s_Pods_ReplicaSets_Deployments/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/09_K8s_Pods_ReplicaSets_Deployments/README.md) |
| 10 | Kubernetes Networking & Services | [10_K8s_Networking_Services/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/10_K8s_Networking_Services/README.md) |
| 11 | Kubernetes Ingress, ConfigMaps & Secrets | [11_K8s_Ingress_ConfigMaps_Secrets/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/11_K8s_Ingress_ConfigMaps_Secrets/README.md) |
| 12 | Kubernetes Storage, HPA & Probes | [12_K8s_Storage_HPA_Probes/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/12_K8s_Storage_HPA_Probes/README.md) |
| 13 | Kubernetes Troubleshooting | [13_K8s_Troubleshooting/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/13_K8s_Troubleshooting/README.md) |
| 14 | Helm | [14_Helm/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/14_Helm/README.md) |
| 15 | CI/CD & GitHub Actions | [15_CICD_GitHub_Actions/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/15_CICD_GitHub_Actions/README.md) |
| 16 | Complete CI/CD & DevSecOps | [16_Complete_CICD_DevSecOps/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/16_Complete_CICD_DevSecOps/README.md) |
| 17 | Terraform & Infrastructure as Code | [17_Terraform_IaC/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/17_Terraform_IaC/README.md) |
| 18 | Cloud & Terraform in Action | [18_Cloud_Terraform_In_Action/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/18_Cloud_Terraform_In_Action/README.md) |
| 19 | Monitoring, Observability & GitOps | [19_Monitoring_Observability_GitOps/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/19_Monitoring_Observability_GitOps/README.md) |
| 20 | Final DevOps Project | [20_Final_DevOps_Project/README.md](https://github.com/aamrindersingh/Devops-Assignment-1/blob/main/20_Final_DevOps_Project/README.md) |


The folder numbers are one behind the session numbers in the assignment, because Sessions 01 and 02
are combined in `01_Linux_Fundamental`. Each README is titled with its session number so the two line
up.

Session 21 (`20_Final_DevOps_Project`) is a link shortener called **clip**, wired through the whole
chain: GitHub Actions with four security scanners and a gate, an image in GHCR, a Helm chart
reconciled onto the cluster by Argo CD, Prometheus scraping metrics the application emits itself,
and a nightly backup into an S3 bucket that Terraform provisions.

## Environment

- macOS (Apple Silicon) with Docker Desktop
- Linux tasks: `ubuntu:24.04` container
- Kubernetes: local 2-node cluster created with [kind](https://kind.sigs.k8s.io/) (`08_Kubernetes_Fundamentals/kind-cluster.yaml`)
- Helm v4.3.0, Terraform v1.16.5, Trivy, Semgrep and Gitleaks for Sessions 15 to 20
- AWS `ap-south-1` for Sessions 18 and 19. Resources were created for real and then destroyed
- Monitoring: kube-prometheus-stack. GitOps: Argo CD, both on the kind cluster
- Class repository used for the labs: <https://github.com/Nency-Ravaliya/devops-heros>
