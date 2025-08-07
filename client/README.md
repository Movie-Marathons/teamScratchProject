# 🧠 Git Workflow Guide for Feature Development

This guide outlines the standard steps for creating and merging a new feature branch into the `main` branch. It includes both direct merge and pull request workflows for individual or team-based development.

---

## ✅ Local Git Workflow (Direct Merge)

### 1. Pull the latest code from the repository
```bash
git checkout main
git pull
```

---

### 2. Create your feature branch
```bash
git checkout -b feature/your-feature-name
```

---

### 3. Make your changes
- Edit or add files
- Test your changes locally

---

### 4. Stage and commit your changes
```bash
git add .
git commit -m "Add feature: Email preview component"
```

---

### 5. Switch back to the `main` branch
```bash
git checkout main
```

---

### 6. Merge your feature branch into `main`
```bash
git merge feature/your-feature-name
```

---

### 7. Push the updated `main` branch to the remote repository
```bash
git push origin main
```

---

### 8. (Optional) Delete your feature branch
```bash
git branch -d feature/your-feature-name            # Delete locally
git push origin --delete feature/your-feature-name # Delete remotely
```

---

## 🔁 Pull Request Workflow (Team Collaboration)

If your team requires pull requests (PRs) for code review:

### 1. Follow steps 1–4 from the Local Git Workflow

---

### 2. Push your feature branch to the remote
```bash
git push origin feature/your-feature-name
```

---

### 3. Create a Pull Request
- Go to your repository on GitHub/GitLab/Bitbucket
- Create a new Pull Request:
  - **Base Branch**: `main`
  - **Compare Branch**: `feature/your-feature-name`
- Add a title and description
- Request reviews from teammates (if applicable)

---

### 4. After PR approval:
- Merge the PR into `main` via the web interface
- Pull the latest `main` locally:
```bash
git checkout main
git pull
```

---

### 5. (Optional) Clean up your local/remote feature branch
```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```
