<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Roles live only in public.user_roles, checked via has_role(); privileged writes go through SECURITY DEFINER RPCs that verify the caller — profiles only allow self-update of name/language, so status/permissions can't be self-escalated.
- Internal staff sign in with a username mapped to a synthetic email (usernameToEmail in src/lib/roles.ts); accounts are created server-side by admins, because auth requires an email.
- UI strings live in src/lib/i18n.tsx (es/en/ca, Spanish default) — no i18n library, to keep bundle small.
- Signed-in pages live under src/routes/_authenticated (client-only gate); the welcome/login page is the public index.
