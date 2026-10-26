variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "bucket_name" {
  description = "Optional globally unique S3 bucket name."
  type        = string
  default     = null
}

variable "app_path" {
  description = "Absolute path to the Vite application root."
  type        = string
}

locals {
  app            = "arcadegambit"
  bucket_name    = coalesce(var.bucket_name, "${local.app}")
  website_prefix = "${var.environment}/dist"
  website_index  = "index.html"
  tags = {
    app         = "arcadegambit"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "app" {
  bucket = local.bucket_name

  tags = local.tags
}

resource "aws_s3_bucket_website_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  index_document {
    suffix = local.website_index
  }

  error_document {
    key = local.website_index
  }
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket                  = aws_s3_bucket.app.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket     = aws_s3_bucket.app.id
  policy     = data.aws_iam_policy_document.public_read.json
  depends_on = [aws_s3_bucket_public_access_block.app]
}

data "aws_iam_policy_document" "public_read" {
  statement {
    sid = "PublicReadForWebsite"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.app.arn}/*"]
  }
}
