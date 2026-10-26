locals {
  forward_bucket_name = local.domain_name
  forward_origin_id   = "s3-website-${aws_s3_bucket.root_forward.id}"
}

resource "aws_s3_bucket" "root_forward" {
  bucket = "arcadegambit-root-forward"
  tags   = local.tags
}

resource "aws_s3_bucket_website_configuration" "root_forward" {
  bucket = aws_s3_bucket.root_forward.id

  redirect_all_requests_to {
    host_name = local.www_domain_name
    protocol  = "https"
  }
}

resource "aws_cloudfront_distribution" "root_forward" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.domain_name} to ${local.www_domain_name}"
  aliases         = [local.domain_name]
  price_class     = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket_website_configuration.root_forward.website_endpoint
    origin_id   = local.forward_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.forward_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  tags = local.tags
}
