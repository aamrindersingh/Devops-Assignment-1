# Linux Fundamentals – Homework

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

My laptop runs macOS, so the Linux commands below were run inside an `ubuntu:24.04` Docker container (Tasks 1 and 2) and on a systemd-based Linux node (Task 3) — the kind control-plane node, which runs `kubelet` and `containerd` under systemd. All outputs are copied from my terminal.

The base `ubuntu:24.04` image ships neither `adduser` nor `perl`, so Task 2 needed `apt-get install -y adduser perl` first; without `perl`, `deluser --remove-home` refuses to run.

---

## Task 1: Soft Link vs Hard Link

| | Hard link | Soft (symbolic) link |
|---|---|---|
| Points to | The same **inode** (the data itself) | The **path** of another file |
| Command | `ln original.txt hardlink.txt` | `ln -s original.txt softlink.txt` |
| Own inode? | No, shares the inode of the original | Yes, it is a separate small file |
| If the original is deleted | Data is still available through the hard link | Link becomes broken (dangling) |
| Across filesystems / partitions | Not allowed | Allowed |
| Can link a directory | No | Yes |
| Looks like in `ls -l` | A normal file, link count goes up | `l` file type and `name -> target` |

### Practice: creating and deleting both links

```text
$ echo "hello from original" > original.txt

$ ln original.txt hardlink.txt

$ ln -s original.txt softlink.txt

$ ls -li
total 8
616621 -rw-r--r-- 2 root root 20 Sep 17 20:29 hardlink.txt
616621 -rw-r--r-- 2 root root 20 Sep 17 20:29 original.txt
616628 lrwxrwxrwx 1 root root 12 Sep 17 20:29 softlink.txt -> original.txt

$ stat -c "%n inode=%i links=%h type=%F" original.txt hardlink.txt softlink.txt
original.txt inode=616621 links=2 type=regular file
hardlink.txt inode=616621 links=2 type=regular file
softlink.txt inode=616628 links=1 type=symbolic link

$ echo "appended via hardlink" >> hardlink.txt

$ cat original.txt
hello from original
appended via hardlink

$ rm original.txt

$ ls -li
total 4
616621 -rw-r--r-- 1 root root 42 Sep 17 20:29 hardlink.txt
616628 lrwxrwxrwx 1 root root 12 Sep 17 20:29 softlink.txt -> original.txt

$ cat hardlink.txt
hello from original
appended via hardlink

$ cat softlink.txt
cat: softlink.txt: No such file or directory

$ unlink softlink.txt

$ rm hardlink.txt

$ ls -la
total 16
drwx------ 1 root root 4096 Sep 17 20:29 .
drwxr-xr-x 1 root root 4096 Sep 17 20:28 ..
-rw-r--r-- 1 root root 3106 Apr 22  2024 .bashrc
-rw-r--r-- 1 root root  161 Apr 22  2024 .profile
```

### What I understood

- `original.txt` and `hardlink.txt` have the **same inode number** and a link count of `2`. They are two names for the same data.
- `softlink.txt` has a **different inode**, its type is `symbolic link`, and its size is 12 bytes, which is just the length of the text `original.txt`.
- Writing through the hard link changed the content seen through the original name, because there is only one copy of the data.
- After `rm original.txt` the link count dropped to `1`, but `cat hardlink.txt` still worked. Data is only freed when the link count reaches `0`.
- The soft link broke with `No such file or directory` because the path it points to no longer exists.
- A link is deleted with `rm` or `unlink`. Deleting a link never deletes the other names.

**Interview answer in one line:** a hard link is another name for the same inode, a soft link is a separate file that stores a path to another file.

---

## Task 2: `adduser` vs `useradd`

| | `useradd` | `adduser` |
|---|---|---|
| What it is | Low-level binary, available on every Linux distribution | High-level, friendly script on Debian/Ubuntu that calls `useradd` internally |
| Home directory | Not created unless `-m` is given | Created automatically |
| Default shell | `/bin/sh` | `/bin/bash` |
| Skeleton files (`.bashrc`, `.profile`) | Not copied unless `-m` | Copied from `/etc/skel` |
| Password / full name | Must be set separately with `passwd` | Asked interactively |
| Best for | Scripts and automation, portable across distributions | Creating users by hand on Ubuntu/Debian |

**Preferred on Ubuntu: `adduser`**, because one command gives a usable account (home directory, bash shell, skeleton files, group). With `useradd` the same result needs `useradd -m -s /bin/bash user` followed by `passwd user`.

### Practice: creating a test user with both commands

`--disabled-password --gecos` were used only so that the command does not stop and wait for interactive input inside the container.

```text
$ useradd lowlevel_user

$ grep lowlevel_user /etc/passwd
lowlevel_user:x:1001:1001::/home/lowlevel_user:/bin/sh

$ ls -ld /home/lowlevel_user
ls: cannot access '/home/lowlevel_user': No such file or directory

$ adduser --disabled-password --gecos "Test User" testuser
info: Adding user `testuser' ...
info: Selecting UID/GID from range 1000 to 59999 ...
info: Adding new group `testuser' (1002) ...
info: Adding new user `testuser' (1002) with group `testuser (1002)' ...
info: Creating home directory `/home/testuser' ...
info: Copying files from `/etc/skel' ...
info: Adding new user `testuser' to supplemental / extra groups `users' ...
info: Adding user `testuser' to group `users' ...

$ grep testuser /etc/passwd
testuser:x:1002:1002:Test User,,,:/home/testuser:/bin/bash

$ ls -la /home/testuser
total 20
drwxr-x--- 2 testuser testuser 4096 Sep 17 20:29 .
drwxr-xr-x 1 root     root     4096 Sep 17 20:29 ..
-rw-r--r-- 1 testuser testuser  220 Sep 17 20:29 .bash_logout
-rw-r--r-- 1 testuser testuser 3771 Sep 17 20:29 .bashrc
-rw-r--r-- 1 testuser testuser  807 Sep 17 20:29 .profile

$ id testuser
uid=1002(testuser) gid=1002(testuser) groups=1002(testuser),100(users)

$ ls -l $(which adduser) $(which useradd)
-rwxr-xr-x 1 root root  55191 Jul  5  2023 /usr/sbin/adduser
-rwxr-xr-x 1 root root 142784 May 30  2024 /usr/sbin/useradd

$ deluser --remove-home testuser
info: Looking for files to backup/remove ...
info: Removing files ...
warn: `/usr/bin/crontab' not executed. Skipping crontab removal. Package `cron' required.
info: Removing user `testuser' ...

$ userdel lowlevel_user
```

### What I understood

- `useradd lowlevel_user` added a line to `/etc/passwd`, but the shell is `/bin/sh` and the home directory **does not exist**.
- `adduser testuser` created the group, the home directory `/home/testuser`, copied `.bashrc`, `.profile`, `.bash_logout` from `/etc/skel`, and set the shell to `/bin/bash`.
- `adduser` is a much smaller file than `useradd` because it is a script wrapping the real binary.
- `deluser --remove-home` failed in the minimal container because that feature needs the `perl` package. On a normal Ubuntu install it works. `userdel -r` is the low-level equivalent.

---

## Task 3: `journalctl`

`journalctl` reads the logs collected by `systemd-journald`. It shows kernel, boot and service logs from one place, and the logs can be filtered by service, time and priority.

A plain Docker container does not run systemd, so there is no journal inside it. I ran these commands on a Linux node that boots with systemd (the control-plane node of my local Kubernetes cluster), where `kubelet` and `containerd` run as systemd services.

```text
$ journalctl --no-pager -n 5
Sep 17 19:31:57 devops-hw-control-plane containerd[129]: time="2026-09-17T19:31:57.110278387Z" level=info msg="RemovePodSandbox \"5c343a51f0377c456e6f6f8b03b90436f8d5ccdfc7de2a906b90a519905628f4\" returns successfully"
Sep 17 19:36:51 devops-hw-control-plane containerd[129]: time="2026-09-17T19:36:51.347108176Z" level=info msg="container event discarded" container=c49ee9ba5b95907dfd068beccfe5a70ad0184a1428f6e90f61856bb0979bc546 type=CONTAINER_STOPPED_EVENT
Sep 17 19:36:51 devops-hw-control-plane containerd[129]: time="2026-09-17T19:36:51.377962259Z" level=info msg="container event discarded" container=5c343a51f0377c456e6f6f8b03b90436f8d5ccdfc7de2a906b90a519905628f4 type=CONTAINER_STOPPED_EVENT
Sep 17 19:36:57 devops-hw-control-plane containerd[129]: time="2026-09-17T19:36:57.085000220Z" level=info msg="container event discarded" container=c49ee9ba5b95907dfd068beccfe5a70ad0184a1428f6e90f61856bb0979bc546 type=CONTAINER_DELETED_EVENT
Sep 17 19:36:57 devops-hw-control-plane containerd[129]: time="2026-09-17T19:36:57.123850512Z" level=info msg="container event discarded" container=5c343a51f0377c456e6f6f8b03b90436f8d5ccdfc7de2a906b90a519905628f4 type=CONTAINER_DELETED_EVENT

$ journalctl --no-pager -u kubelet -n 5
Sep 17 19:31:51 devops-hw-control-plane kubelet[761]: I0917 19:31:51.789708     761 reconciler_common.go:299] "Volume detached for volume \"webhook-cert\" (UniqueName: \"kubernetes.io/secret/125db177-303f-4846-bc82-7c0678230362-webhook-cert\") on node \"devops-hw-control-plane\" DevicePath \"\""
Sep 17 19:31:52 devops-hw-control-plane kubelet[761]: I0917 19:31:52.489705     761 server.go:177] "Pod update broadcasted" podUID="125db177-303f-4846-bc82-7c0678230362" type="MODIFIED"
Sep 17 19:31:52 devops-hw-control-plane kubelet[761]: I0917 19:31:52.496096     761 server.go:190] "Pod removed broadcasted" podUID="125db177-303f-4846-bc82-7c0678230362"
Sep 17 19:31:52 devops-hw-control-plane kubelet[761]: I0917 19:31:52.993546     761 kubelet_volumes.go:161] "Cleaned up orphaned pod volumes dir" podUID="125db177-303f-4846-bc82-7c0678230362" path="/var/lib/kubelet/pods/125db177-303f-4846-bc82-7c0678230362/volumes"
Sep 17 19:31:57 devops-hw-control-plane kubelet[761]: I0917 19:31:57.064183     761 scope.go:118] "RemoveContainer" containerID="c49ee9ba5b95907dfd068beccfe5a70ad0184a1428f6e90f61856bb0979bc546"

$ journalctl --no-pager -u containerd --since "10 min ago" -p warning -n 5
-- No entries --

$ journalctl --no-pager -p err -n 3
-- No entries --

$ journalctl --disk-usage
Archived and active journals take up 8M in the file system.

$ journalctl --list-boots
IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY
  0 66f8fba16d7747ab8dba296bc7b9d03a Thu 2026-09-17 18:57:41 UTC Thu 2026-09-17 19:36:57 UTC

$ systemctl is-active kubelet containerd
active
active
```

### Commands I practised

| Command | Purpose |
|---|---|
| `journalctl` | All logs, oldest first |
| `journalctl -n 20` | Last 20 lines |
| `journalctl -f` | Follow new logs live, like `tail -f` |
| `journalctl -u kubelet` | Logs of one specific service (unit) |
| `journalctl -u ssh --since "1 hour ago"` | One service, filtered by time |
| `journalctl -p err` | Only priority `err` and worse |
| `journalctl -b` | Logs from the current boot |
| `journalctl --list-boots` | List recorded boots |
| `journalctl -k` | Kernel messages only |
| `journalctl --disk-usage` | Space used by the journal |
| `journalctl --no-pager` | Print directly instead of opening a pager, useful in scripts |

### What I understood

- `-u <service>` is the option used most often, to find out why a service failed after `systemctl status` shows it as failed.
- `-p err` and `--since` cut the noise down quickly. On this node there were no error-level entries, so the output was `-- No entries --`.

---

## Task 4: Linux Command Cheat Sheet

| Category | Command | Purpose |
|---|---|---|
| Navigation | `pwd`, `ls -la`, `cd` | Where am I, list files including hidden, change directory |
| Files | `touch`, `mkdir -p`, `cp -r`, `mv`, `rm -rf` | Create, copy, move/rename, delete |
| Viewing | `cat`, `less`, `head -n`, `tail -f` | Read files, follow a growing log |
| Searching | `grep -rin "text" .`, `find / -name "*.log"` | Search inside files, search for files |
| Text processing | `wc -l`, `sort`, `uniq -c`, `cut`, `awk`, `sed` | Count, sort, de-duplicate, pick columns, replace text |
| Permissions | `chmod 755`, `chown user:group`, `umask` | Change mode and owner |
| Users | `whoami`, `id`, `adduser`, `passwd`, `su -`, `sudo` | Identity and user management |
| Processes | `ps aux`, `top`, `kill -9 PID`, `jobs`, `bg`, `fg` | Inspect and control processes |
| Disk and memory | `df -h`, `du -sh *`, `free -h`, `lsblk` | Disk space, folder sizes, RAM, block devices |
| Services | `systemctl status/start/stop/enable`, `journalctl -u` | Manage services and read their logs |
| Networking | `ip a`, `ping`, `ss -tulnp`, `curl`, `dig` | Addresses, reachability, open ports, HTTP, DNS |
| Archives | `tar -czvf`, `tar -xzvf`, `zip`, `unzip` | Compress and extract |
| Packages | `apt update`, `apt install`, `apt remove` | Install software on Ubuntu/Debian |
| Links | `ln`, `ln -s`, `unlink` | Hard and soft links |
| Help | `man`, `--help`, `which`, `history` | Documentation and command lookup |

Permission numbers: `r=4`, `w=2`, `x=1`. So `chmod 755` means owner `rwx`, group `r-x`, others `r-x`.
