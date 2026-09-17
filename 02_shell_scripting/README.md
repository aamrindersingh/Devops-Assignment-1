# Shell Scripting – Homework

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

## Task: System Information Script

Script: [shellscript.sh](shellscript.sh)

| Requirement | How the script does it |
|---|---|
| Print the current date | `current_date=$(date)` then `echo` |
| Print the hostname | `host_name=$(hostname)` |
| Print the username | `user_name=$(whoami)` |
| Print the disk usage | `df -h` |
| Print the running processes | `ps` |
| Use variables | `current_date`, `host_name`, `user_name`, `work_dir`, `log_file`, `name`, `roll_no`, `comment` |
| Take user input | `read -p "Enter your name: " name` |
| Create a directory | `mkdir -p "$work_dir"` |
| Create a file | `touch "$log_file"` |
| Store the processes in the file using `>` | `ps > "$log_file"` |

## The script

```bash
#!/bin/bash
# System Information Script - DevOps Homework (Shell Scripting)

# Variables to store and reuse data
current_date=$(date)
host_name=$(hostname)
user_name=$(whoami)
work_dir="system_info"
log_file="$work_dir/process.log"

echo "========== System Information =========="
echo "Current date : $current_date"
echo "Hostname     : $host_name"
echo "Username     : $user_name"

echo
echo "========== Disk Usage =========="
df -h

echo
echo "========== Running Processes =========="
ps

# Take user input using read -p
echo
read -p "Enter your name: " name
read -p "Enter your roll number: " roll_no
read -p "Enter your comment: " comment

echo "My name is $name"
echo "My roll number is $roll_no"
echo "My comment is: $comment"

# Create a directory using mkdir and a file using touch
mkdir -p "$work_dir"
touch "$log_file"

# Store the running processes in the file using > output redirection
ps > "$log_file"

echo
echo "Directory '$work_dir' created"
echo "Process information saved in '$log_file'"
```

## How to run

```bash
chmod +x shellscript.sh
./shellscript.sh
```

## Output

For this capture the three answers were sent to the script through a pipe, so the `read -p` prompts are not printed (bash only shows the prompt when the input comes from a terminal). When run by hand, the prompts `Enter your name:`, `Enter your roll number:` and `Enter your comment:` appear one by one.

```text
$ printf 'Amrinder Singh\n24BCS10596\nShell scripting homework\n' | ./shellscript.sh
========== System Information ==========
Current date : Fri Sep 18 00:58:17 IST 2026
Hostname     : MacBook-Pro-8.local
Username     : amrindersinghscaler

========== Disk Usage ==========
Filesystem                                        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1                                   926Gi    12Gi   484Gi     3%    459k  4.3G    0%   /
devfs                                            202Ki   202Ki     0Bi   100%     699     0  100%   /dev
/dev/disk3s6                                     926Gi    13Gi   484Gi     3%      13  5.1G    0%   /System/Volumes/VM
/dev/disk3s2                                     926Gi   8.5Gi   484Gi     2%    1.5k  5.1G    0%   /System/Volumes/Preboot
/dev/disk3s4                                     926Gi   3.7Mi   484Gi     1%      62  5.1G    0%   /System/Volumes/Update
/dev/disk1s2                                     550Mi   6.0Mi   530Mi     2%       1  5.4M    0%   /System/Volumes/xarts
/dev/disk1s1                                     550Mi   5.8Mi   530Mi     2%      39  5.4M    0%   /System/Volumes/iSCPreboot
/dev/disk1s3                                     550Mi   3.0Mi   530Mi     1%     106  5.4M    0%   /System/Volumes/Hardware
/dev/disk3s5                                     926Gi   407Gi   484Gi    46%    3.4M  5.1G    0%   /System/Volumes/Data
map auto_home                                      0Bi     0Bi     0Bi   100%       0     0     -   /System/Volumes/Data/home
/Users/amrindersinghscaler/Downloads/Mos 2.app   926Gi   380Gi   525Gi    42%    3.0M  5.5G    0%   /private/var/folders/b1/3qwywxks0xl23dlckgzxwxsc0000gn/T/AppTranslocation/5C02C9FE-383D-4539-9FEC-781F9368F552

========== Running Processes ==========
  PID TTY           TIME CMD
62390 ttys000    0:00.42 -zsh -g --no_rcs
63059 ttys000   23:16.12 claude --chrome
63082 ttys000    0:00.89 npm exec @playwright/mcp@latest --isolated    
63085 ttys000    0:00.88 npm exec @playwright/mcp@latest  
63132 ttys000    0:35.37 node /Users/amrindersinghscaler/.npm/_npx/9833c18b2d85bc59/node_modules/.bin/playwright-mcp --isolated
63148 ttys000    0:00.35 node /Users/amrindersinghscaler/.npm/_npx/9833c18b2d85bc59/node_modules/.bin/playwright-mcp
10379 ttys002    0:00.36 /bin/zsh -il
71151 ttys004    0:00.38 /bin/zsh -i
47301 ttys005    0:00.32 /bin/zsh -i
47623 ttys006    0:00.31 /bin/zsh -il

My name is Amrinder Singh
My roll number is 24BCS10596
My comment is: Shell scripting homework

Directory 'system_info' created
Process information saved in 'system_info/process.log'
```

### Directory and file created by the script

```text
$ ls -la system_info
total 8
drwxr-xr-x  3 amrindersinghscaler  staff   96 Sep 18 00:58 .
drwxr-xr-x  6 amrindersinghscaler  staff  192 Sep 18 00:58 ..
-rw-r--r--  1 amrindersinghscaler  staff  638 Sep 18 00:58 process.log

$ cat system_info/process.log
  PID TTY           TIME CMD
62390 ttys000    0:00.42 -zsh -g --no_rcs
63059 ttys000   23:16.12 claude --chrome
63082 ttys000    0:00.89 npm exec @playwright/mcp@latest --isolated    
63085 ttys000    0:00.88 npm exec @playwright/mcp@latest  
63132 ttys000    0:35.37 node /Users/amrindersinghscaler/.npm/_npx/9833c18b2d85bc59/node_modules/.bin/playwright-mcp --isolated
63148 ttys000    0:00.35 node /Users/amrindersinghscaler/.npm/_npx/9833c18b2d85bc59/node_modules/.bin/playwright-mcp
10379 ttys002    0:00.36 /bin/zsh -il
71151 ttys004    0:00.38 /bin/zsh -i
47301 ttys005    0:00.32 /bin/zsh -i
47623 ttys006    0:00.31 /bin/zsh -il
```

## What I understood

- `$(command)` stores the output of a command in a variable.
- `read -p "text" var` prints a prompt and saves what the user types in `var`.
- `>` overwrites the file with the command output, while `>>` appends to it.
- `mkdir -p` does not fail if the directory already exists, so the script can be run many times.
- Variables should be quoted (`"$log_file"`) so that paths with spaces do not break the script.
