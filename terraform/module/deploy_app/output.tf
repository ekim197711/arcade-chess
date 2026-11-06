output "bucket_name" {
  description = "Name of the S3 bucket hosting the application."
  value       = aws_s3_bucket.app.bucket
}

output "website_endpoint" {
  description = "S3 static website endpoint."
  value       = aws_s3_bucket_website_configuration.app.website_endpoint
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "Public HTTPS site URL."
  value       = "https://${local.www_domain_name}"
}

output "certificate_validation_records" {
  description = "DNS records to create at one.com to validate the ACM certificate."
  value = [
    for option in aws_acm_certificate.site.domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ]
}

output "domain_cname_records" {
  description = "DNS CNAME records to create at one.com after the certificate is issued and CloudFront is deployed."
  value = [
    {
      name  = local.domain_name
      type  = "CNAME"
      value = aws_cloudfront_distribution.root_forward.domain_name
    },
    {
      name  = local.www_domain_name
      type  = "CNAME"
      value = aws_cloudfront_distribution.site.domain_name
    },
  ]
}
