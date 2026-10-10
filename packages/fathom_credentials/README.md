# fathom_credentials

Definition package for saved provider credentials. Plugins that call model
providers depend on it; it runs no processes.

- `FathomCredentials`: the service contract. `get/1`, `providers/0`,
  `subscribe/0` for `{:credentials, :changed}`, and `changed/0` for
  implementations to broadcast.
- `FathomCredentials.Credential`: an API key or OAuth tokens, redacted in
  `inspect/1`.
- `FathomCredentials.LoginFlow` and the `FathomCredentials.Logins` registry:
  how provider plugins add sign-in.
- `FathomCredentials.OAuth`, `DeviceCode`, `LoginUI`: helpers login flows use.

The bundled implementation is `plugins/credentials-local`.
