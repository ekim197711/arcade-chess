locals {
  dist_files = fileset("${var.app_path}/dist", "**")

  content_types = {
    css         = "text/css"
    gif         = "image/gif"
    html        = "text/html"
    ico         = "image/x-icon"
    jpeg        = "image/jpeg"
    jpg         = "image/jpeg"
    js          = "application/javascript"
    json        = "application/json"
    map         = "application/json"
    mp3         = "audio/mpeg"
    ogg         = "audio/ogg"
    png         = "image/png"
    svg         = "image/svg+xml"
    txt         = "text/plain"
    wasm        = "application/wasm"
    wav         = "audio/wav"
    webp        = "image/webp"
    webmanifest = "application/manifest+json"
    woff        = "font/woff"
    woff2       = "font/woff2"
  }
}

resource "aws_s3_object" "dist" {
  for_each = local.dist_files

  bucket        = aws_s3_bucket.app.bucket
  key           = "${local.website_prefix}/${each.value}"
  source        = "${var.app_path}/dist/${each.value}"
  etag          = filemd5("${var.app_path}/dist/${each.value}")
  content_type  = lookup(local.content_types, lower(element(split(".", each.value), length(split(".", each.value)) - 1)), "application/octet-stream")
  cache_control = contains(["index.html", "build-info.json", "deployment.json"], each.value) ? "no-cache" : "public, max-age=31536000, immutable"

  depends_on = [aws_s3_bucket_policy.public_read]
}
