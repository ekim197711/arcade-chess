locals {
  domain_name     = "arcadegambit.com"
  www_domain_name = "www.${local.domain_name}"
  domain_aliases  = [local.www_domain_name]
  origin_id       = "s3-website-${aws_s3_bucket.app.id}"
}

resource "aws_acm_certificate" "site" {
  provider = aws.us_east_1

  domain_name               = local.domain_name
  subject_alternative_names = [local.www_domain_name]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_acm_certificate_validation" "site" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.site.arn
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = local.domain_name
  default_root_object = local.website_index
  aliases             = local.domain_aliases
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket_website_configuration.app.website_endpoint
    origin_id   = local.origin_id
    origin_path = "/${local.website_prefix}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/${local.website_index}"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/${local.website_index}"
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
