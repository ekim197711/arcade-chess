terraform {
  required_version = ">= 1.4.0"

  backend "s3" {
    bucket = "tf-states-337909745036-eu-north-1"
    key    = "arcadegambit/production/terraform.tfstate"
    region = "eu-north-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

module "arcadegambit-app" {
  source = "../../module/deploy_app"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
  environment = "production"
  app_path    = abspath("${path.root}/../../..")
}
