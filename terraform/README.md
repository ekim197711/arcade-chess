# Arcade Gambit infrastructure

This configuration deploys the Vite build to S3 in `eu-north-1`, served through
CloudFront at `https://www.arcadegambit.com`. A second distribution redirects
`https://arcadegambit.com` to the www domain. The ACM certificate is in `us-east-1`.

Resource names and tags use `arcadegambit`. State is stored in the existing shared
backend bucket under `arcadegambit/production/terraform.tfstate`, independently of
ScrumPrompts. Source-project state and provider caches are not copied.

From the repository root in PowerShell:

```powershell
npm --script-shell=C:\Windows\System32\cmd.exe run build
$env:AWS_PROFILE = 'mikeaa'
aws sso login --profile mikeaa
terraform -chdir=terraform/environment/production init
terraform -chdir=terraform/environment/production validate
terraform -chdir=terraform/environment/production plan
```

Build before planning so Terraform includes the current `dist/` files. Audio,
WebAssembly, and web manifest uploads have the content types required by the app.

An eventual apply requires DNS validation of the ACM certificate before the
CloudFront distributions can be created. The `certificate_validation_records`
output lists the required records. ACM validation waits for those records to be
published. The `domain_cname_records` output gives the CloudFront targets; the
apex domain requires DNS-provider support for CNAME flattening or an ALIAS/ANAME
record. No DNS records are managed by this configuration.

For application releases after infrastructure setup, run `npm run deploy -- --profile mikeaa` from the repository root. This publishes the build and a verified `deployment.json` timestamp, then invalidates CloudFront. Terraform uploads alone do not create a deployment record. See the root README for commit versioning and administrator release details.
