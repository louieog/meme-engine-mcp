# Deploy to GitHub Instructions

## Step 1: Create the Repository on GitHub

Go to https://github.com/new and create a new repository:
- **Repository name**: `meme-engine-mcp`
- **Description**: Viral meme video generation engine using Anthropic's Model Context Protocol (MCP) and ComfyUI Cloud
- **Visibility**: Public (or Private if you prefer)
- **Initialize**: Do NOT initialize with README (we already have one)

## Step 2: Push Your Code

Run these commands in your terminal:

```bash
# Navigate to the repo
cd /Users/orlando/meme-engine-mcp

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/meme-engine-mcp.git

# Or if you use SSH:
git remote add origin git@github.com:YOUR_USERNAME/meme-engine-mcp.git

# Verify the remote was added
git remote -v

# Push to GitHub
git push -u origin main
```

## Step 3: Verify Deployment

1. Go to https://github.com/YOUR_USERNAME/meme-engine-mcp
2. You should see all 59 files uploaded
3. The README should display automatically

## Alternative: Using GitHub CLI

If you have the GitHub CLI installed:

```bash
cd /Users/orlando/meme-engine-mcp

# Create repo and push in one command
gh repo create meme-engine-mcp --public --source=. --push
```

## Troubleshooting

### Authentication Issues

If you get authentication errors, you may need to:

1. **Use a Personal Access Token** (recommended):
   - Go to https://github.com/settings/tokens
   - Generate a new token with "repo" scope
   - Use the token as your password when pushing

2. **Or use SSH**:
   ```bash
   git remote set-url origin git@github.com:YOUR_USERNAME/meme-engine-mcp.git
   ```

### Large File Issues

If you have issues with file sizes, check that node_modules/ isn't being pushed:

```bash
# Should be empty (files are ignored)
git ls-files | grep node_modules

# If not, remove them from git
git rm -r --cached node_modules
```

## After Deployment

Once pushed, you can:

1. **Set up GitHub Actions** for CI/CD (see docs/DEPLOYMENT.md)
2. **Enable GitHub Pages** for documentation
3. **Add topics** like: meme, ai, video-generation, mcp, comfyui

Your repo is ready to go! 🚀
