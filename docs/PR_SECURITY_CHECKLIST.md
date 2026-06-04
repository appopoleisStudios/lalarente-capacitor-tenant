# PR security audit (SA) template

Copy into PR description and tick before merge.

- [ ] **Secrets:** No API keys, `.env`, or service role in diff
- [ ] **Auth:** New endpoints verify user JWT; `user_id` from token matches mutations
- [ ] **RLS:** New/changed tables have policies or follow-up issue filed
- [ ] **Input:** SQL via parameterized APIs; Edge validates `role`, body size, history length
- [ ] **PII:** Logs do not print full messages or IDs unnecessarily
- [ ] **Third-party:** Groq/Supabase env only in dashboard secrets
- [ ] **Dependencies:** No unexpected packages

**Reviewer sign-off:** _______________  **Date:** _______________
