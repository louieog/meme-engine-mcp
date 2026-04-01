# API Key Storage - Security Architecture Guide

## Executive Summary

**Recommendation: Encrypted File Storage (Browser → Server → Encrypted File)**

This provides the best balance of security and usability for a local creative tool.

---

## The Options Compared

### 1. Environment Variables Only
```
.env file → Node.js process.env
```

**Best for:** Production servers, Docker, CI/CD  
**Not ideal for:** Desktop apps, multi-user local setups

| Aspect | Rating | Notes |
|--------|--------|-------|
| Security | ⭐⭐⭐⭐⭐ | Keys never leave server process |
| Usability | ⭐⭐⭐ | Requires file editing, server restart |
| Multi-user | ⭐⭐ | All users share same keys |
| Portability | ⭐⭐⭐⭐⭐ | Works everywhere |

### 2. Browser LocalStorage ❌ DON'T USE
```
Browser input → localStorage
```

**Security Risk: HIGH**

- Keys stored in plaintext in browser
- Vulnerable to XSS attacks
- Visible in DevTools
- Synced to cloud if user has browser sync

**Never use for production API keys!**

### 3. Encrypted File Storage ✅ RECOMMENDED
```
Browser input → Server → Encrypt → ~/.meme-engine/keys.enc
```

**Best for:** Local desktop apps, single-user setups

| Aspect | Rating | Notes |
|--------|--------|-------|
| Security | ⭐⭐⭐⭐ | Encrypted at rest, master password |
| Usability | ⭐⭐⭐⭐⭐ | Easy web form, persists across restarts |
| Multi-user | ⭐⭐⭐⭐ | Each user has own keys |
| Portability | ⭐⭐⭐ | Filesystem dependent |

### 4. OS Keychain (Most Secure)
```
Browser input → keytar library → OS Keychain
```

**Best for:** Maximum security requirements

| Aspect | Rating | Notes |
|--------|--------|-------|
| Security | ⭐⭐⭐⭐⭐ | OS-level protection |
| Usability | ⭐⭐⭐⭐ | Transparent to user |
| Complexity | ⭐⭐ | Requires native modules |
| Portability | ⭐⭐ | Platform-specific |

---

## Our Implementation: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (User Input)                     │
│  • Web form for API keys                                   │
│  • Master password entry                                   │
│  • Show/hide toggle                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ POST /api/settings/keys
                        │ (HTTPS in production)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVER (Node.js)                       │
│                                                             │
│  1. Validate input                                         │
│  2. Derive encryption key from master password             │
│     └─→ PBKDF2 (100,000 iterations) + Salt                │
│  3. Encrypt API keys with AES-256-GCM                      │
│  4. Store in ~/.meme-engine/keys.enc                       │
│  5. Set restrictive permissions (0o600)                   │
│                                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              FILESYSTEM (~/.meme-engine/)                   │
│  • keys.enc - Encrypted API keys                           │
│  • .salt - Random salt for key derivation                  │
│  • Permissions: User read/write only (0o700)              │
└─────────────────────────────────────────────────────────────┘
```

### Security Features

1. **Encryption**: AES-256-GCM (industry standard)
2. **Key Derivation**: PBKDF2 with 100,000 iterations
3. **Authentication**: GCM mode provides authenticated encryption
4. **File Permissions**: User-only access (Unix permissions)
5. **Memory Safety**: Keys cached in memory, cleared on restart
6. **No Browser Storage**: Keys never touch browser storage

---

## User Experience Flow

### First-Time Setup
```
1. User opens Settings page
2. Sees "API Key Status: Missing" indicators
3. Enters:
   - ComfyUI Cloud API Key
   - LLM Provider selection
   - LLM API Key
   - Master password (create new)
4. Clicks "Save"
5. Keys encrypted and stored
6. Ready to generate videos!
```

### Subsequent Use
```
1. User returns to Settings
2. System checks for encrypted keys
3. If "Remember password" was checked:
   - Keys automatically decrypted
   - Ready to use
4. If password not remembered:
   - Prompt for master password
   - Decrypt on demand
```

### Fallback to Environment Variables
```
If ~/.meme-engine/keys.enc doesn't exist:
  → Fall back to .env / environment variables
  → Show "Using environment variables" badge
```

---

## Threat Model

### What We Protect Against

| Threat | Mitigation |
|--------|------------|
| **Key theft via XSS** | Keys never stored in browser |
| **Key theft via local file access** | File permissions (0o600) |
| **Key theft via backup** | Encrypted, need master password |
| **Key exposure in logs** | Masked in API responses |
| **Key exposure in memory dumps** | Keys in memory only, cleared on exit |

### What We Don't Protect Against

| Threat | Reason | Mitigation |
|--------|--------|------------|
| **Master password guessing** | User-chosen password | Enforce strong passwords |
| **Memory inspection while running** | Process needs keys | Use OS keychain if critical |
| **Server compromise** | Keys in process memory | Limit server exposure |

---

## Code Implementation

### Encryption (Server-Side)

```typescript
// Key derivation
const salt = await getSalt();
const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

// Encryption
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(data, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

// Store: iv:authTag:encryptedData
```

### API Endpoint

```typescript
// POST /api/settings/keys
export async function POST(request: NextRequest) {
  const { comfyCloudApiKey, llmApiKey, masterPassword } = await request.json();
  
  // Encrypt and store
  await saveKeys({ comfyCloudApiKey, llmApiKey }, masterPassword);
  
  // Also set in environment for current process
  process.env.COMFY_CLOUD_API_KEY = comfyCloudApiKey;
  
  return NextResponse.json({ success: true });
}
```

### UI Component

```typescript
// Settings form with password validation
<Input type="password" placeholder="Master password (min 8 chars)" />
<Input type="password" placeholder="Confirm password" />
<Button>Save API Keys</Button>
```

---

## Comparison with Alternatives

### vs Environment Variables Only

| Factor | Env Vars | Encrypted File |
|--------|----------|----------------|
| User-friendly | ❌ Edit file | ✅ Web form |
| Server restart | ❌ Required | ✅ Not needed |
| Key rotation | ❌ Manual | ✅ Easy UI |
| Multi-user | ❌ Shared | ✅ Per-user |
| Security | ✅ High | ✅ High |

### vs OS Keychain

| Factor | OS Keychain | Encrypted File |
|--------|-------------|----------------|
| Security | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Setup complexity | Medium | Low |
| Native dependencies | Yes | No |
| Cross-platform | Complex | Simple |
| User control | Limited | Full |

---

## Migration Path

### From Environment Variables

```bash
# 1. Current: .env file
COMFY_CLOUD_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# 2. Start server
npm run dev

# 3. Go to Settings page
# 4. Enter keys in web form
# 5. Create master password
# 6. Save

# 7. Now stored in ~/.meme-engine/keys.enc
# 8. Can delete .env if desired
```

### Backwards Compatibility

```typescript
// Priority order for key resolution:
1. Memory cache (current session)
2. Decrypted file (~/.meme-engine/keys.enc)
3. Environment variables (fallback)
```

---

## Production Considerations

### HTTPS Required

In production, API key transmission must use HTTPS:

```typescript
// middleware.ts
if (process.env.NODE_ENV === 'production' && !request.secure) {
  return NextResponse.redirect(
    `https://${request.headers.get('host')}${request.url}`
  );
}
```

### Rate Limiting

Protect the settings endpoint:

```typescript
// Limit attempts to prevent brute force
const rateLimit = new Map<string, number>();

if (rateLimit.get(ip) > 5) {
  return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
}
```

### Audit Logging

Log key changes (without logging the actual keys):

```typescript
console.log(`[Settings] API keys updated by user at ${new Date().toISOString()}`);
```

---

## Summary

**Best choice for Meme Engine MCP: Encrypted File Storage**

- ✅ User-friendly web form
- ✅ Secure encryption (AES-256-GCM)
- ✅ No browser storage vulnerabilities
- ✅ Falls back to environment variables
- ✅ Per-user key storage
- ✅ Cross-platform compatible
- ✅ No native dependencies

This provides security comparable to password managers while maintaining the ease of use expected in a creative tool.
