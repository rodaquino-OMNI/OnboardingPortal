variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "enable_key_rotation" {
  description = "Enable KMS key rotation"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
