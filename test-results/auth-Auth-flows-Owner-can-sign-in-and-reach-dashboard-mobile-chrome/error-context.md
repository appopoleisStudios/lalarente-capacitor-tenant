# Page snapshot

```yaml
- text: LR
- heading "Welcome to Lala Rente" [level=1]
- paragraph: Sign in to your account
- text: Login as (optional)
- combobox:
  - option "Choose role (auto-detect if empty)" [selected]
  - option "Tenant"
  - option "Owner"
  - option "Vendor"
  - option "Admin"
- text: Email
- textbox: arsalanahmed82@hotmail.com
- text: Password
- textbox: 1107Mars@
- button "Sign In"
- paragraph:
  - text: Don't have an account??
  - link "Sign up":
    - /url: /auth/register
- paragraph:
  - link "Forgot your password?":
    - /url: /auth/forgot-password
- alert
```