# Data Model

## Configuration layers

```text
Repository policy/template (committed, non-secret)
  -> User profile overlay (local, non-secret)
    -> Secret references (local secret storage, environment, SSH agent)
      -> Runtime override (temporary and local)
