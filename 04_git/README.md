# Git and GitHub – Homework

**Name:** Amrinder Singh
**Roll No:** 24BCS10596

Both tasks were done in a fresh practice repository created with `git init`. All outputs are copied from my terminal.

---

## Task 1: `git commit -a -m` vs `git commit -m`

| | `git commit -m "msg"` | `git commit -a -m "msg"` |
|---|---|---|
| What gets committed | Only what was staged with `git add` | Every **modified or deleted tracked** file, staged automatically |
| New (untracked) files | Included only if added with `git add` | **Never** included |
| Needs `git add` first | Yes | No, for files Git already tracks |
| Risk | Forgetting to stage a change | Committing changes you did not intend to include |

### Practice

I changed a tracked file and also created a brand new file, then tried both commands.

```text
$ git init -q -b main . && git config user.name "Amrinder Singh" && git config user.email "officialamrindersinghh@gmail.com"

$ echo "line 1" > tracked.txt && git add tracked.txt && git commit -m "Add tracked.txt"
[main (root-commit) 2314eb9] Add tracked.txt
 1 file changed, 1 insertion(+)
 create mode 100644 tracked.txt

$ echo "line 2" >> tracked.txt && echo "new file" > untracked.txt

$ git status --short
 M tracked.txt
?? untracked.txt

$ git commit -m "Try commit without staging"
On branch main
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   tracked.txt

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	untracked.txt

no changes added to commit (use "git add" and/or "git commit -a")

$ git commit -a -m "Commit tracked changes with -a"
[main 1af9ac0] Commit tracked changes with -a
 1 file changed, 1 insertion(+)

$ git status --short
?? untracked.txt

$ git show --stat --oneline HEAD
1af9ac0 Commit tracked changes with -a
 tracked.txt | 1 +
 1 file changed, 1 insertion(+)

$ git add untracked.txt && git commit -m "Add untracked.txt after explicit git add"
[main 4e17602] Add untracked.txt after explicit git add
 1 file changed, 1 insertion(+)
 create mode 100644 untracked.txt
```

### What I observed

- `git commit -m` alone **refused to commit**: `no changes added to commit`, because nothing was staged.
- `git commit -a -m` committed `tracked.txt` without any `git add`.
- After that commit `untracked.txt` was still shown as `??`. The `-a` flag only covers files that Git already tracks, so a new file always needs `git add` once.

---

## Task 2: Git Cherry-Pick

`git cherry-pick <hash>` copies the change of **one** commit onto the current branch as a new commit. It is useful when only one fix from another branch is needed, not the whole branch.

### Steps

1. Made commits on `main` and checked them with `git log`.
2. Created a new branch `feature` and made 3 commits on it.
3. Used `git log --oneline` to find the hash of the commit `feature: add feature B`.
4. Switched back to `main` and cherry-picked only that commit.
5. Verified that `featureB.txt` is on `main` and that `featureA.txt` and `featureC.txt` are not.

```text
$ echo "main change 1" > main.txt && git add . && git commit -m "main: change 1"
[main b9618db] main: change 1
 1 file changed, 1 insertion(+)
 create mode 100644 main.txt

$ echo "main change 2" >> main.txt && git commit -a -m "main: change 2"
[main 2f037bd] main: change 2
 1 file changed, 1 insertion(+)

$ git log --oneline
2f037bd main: change 2
b9618db main: change 1
4e17602 Add untracked.txt after explicit git add
1af9ac0 Commit tracked changes with -a
2314eb9 Add tracked.txt

$ git checkout -b feature
Switched to a new branch 'feature'

$ echo "Feature A" > featureA.txt && git add . && git commit -m "feature: add feature A"
[feature 5456e04] feature: add feature A
 1 file changed, 1 insertion(+)
 create mode 100644 featureA.txt

$ echo "Feature B" > featureB.txt && git add . && git commit -m "feature: add feature B"
[feature dd3f7cb] feature: add feature B
 1 file changed, 1 insertion(+)
 create mode 100644 featureB.txt

$ echo "Feature C" > featureC.txt && git add . && git commit -m "feature: add feature C"
[feature f122e54] feature: add feature C
 1 file changed, 1 insertion(+)
 create mode 100644 featureC.txt

$ git log --oneline
f122e54 feature: add feature C
dd3f7cb feature: add feature B
5456e04 feature: add feature A
2f037bd main: change 2
b9618db main: change 1
4e17602 Add untracked.txt after explicit git add
1af9ac0 Commit tracked changes with -a
2314eb9 Add tracked.txt

$ git checkout main
Switched to branch 'main'

$ ls
main.txt
tracked.txt
untracked.txt

$ git cherry-pick dd3f7cb
[main 61d6fb3] feature: add feature B
 Date: Fri Sep 18 02:05:13 2026 +0530
 1 file changed, 1 insertion(+)
 create mode 100644 featureB.txt

$ git log --oneline --graph --all
* f122e54 feature: add feature C
* dd3f7cb feature: add feature B
* 5456e04 feature: add feature A
| * 61d6fb3 feature: add feature B
|/  
* 2f037bd main: change 2
* b9618db main: change 1
* 4e17602 Add untracked.txt after explicit git add
* 1af9ac0 Commit tracked changes with -a
* 2314eb9 Add tracked.txt

$ ls
featureB.txt
main.txt
tracked.txt
untracked.txt

$ cat featureB.txt
Feature B
```

### What I observed

- Before the cherry-pick, `main` had no feature files at all.
- After `git cherry-pick dd3f7cb`, `main` contains `featureB.txt` only. Feature A and Feature C stayed on the `feature` branch.
- The cherry-picked commit has a **new hash** on `main` (`61d6fb3`) even though the message and the change are the same as `dd3f7cb`. It is a copy, not the same commit, because its parent is different.
- The graph shows the two branches splitting after `main: change 2`.
- If the picked commit touched lines that differ on `main`, Git would stop with a conflict. Then I would fix the file, run `git add`, and finish with `git cherry-pick --continue` (or cancel with `git cherry-pick --abort`).
