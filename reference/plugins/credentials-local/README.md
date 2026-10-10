# credentials-local

Provider credentials in `auth.json` in the Fathom home, written atomically
with mode 0600. Implements `FathomCredentials` from
`packages/fathom_credentials`: OAuth refresh ahead of expiry, login sessions
for every flow in `FathomCredentials.Logins`, and Settings › Providers.

Context: `lib/fathom_credentials_local.ex`. Manifest: `lib/fathom_credentials_local/plugin.ex`.
