output "bucket_name" {
  description = "Name of the S3 bucket hosting the arcadegambit-application."
  value       = module.arcadegambit-app.bucket_name
}

output "website_endpoint" {
  description = "S3 static website endpoint."
  value       = module.arcadegambit-app.website_endpoint
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = module.arcadegambit-app.cloudfront_domain_name
}

output "site_url" {
  description = "Public HTTPS site URL."
  value       = module.arcadegambit-app.site_url
}

output "certificate_validation_records" {
  description = "DNS records to create at one.com to validate the ACM certificate."
  value       = module.arcadegambit-app.certificate_validation_records
}

output "domain_cname_records" {
  description = "DNS CNAME records to create at one.com after the certificate is issued and CloudFront is deployed."
  value       = module.arcadegambit-app.domain_cname_records
}
