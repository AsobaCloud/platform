"""Common utilities for ONA Platform services."""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from botocore.exceptions import ClientError

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()
metrics = Metrics()

# Initialize boto3 clients
s3_client = boto3.client('s3')
dynamodb_client = boto3.client('dynamodb')
ssm_client = boto3.client('ssm')


def get_parameter(name: str, decrypt: bool = True) -> str:
    """Get parameter from SSM Parameter Store."""
    try:
        response = ssm_client.get_parameter(
            Name=name,
            WithDecryption=decrypt
        )
        return response['Parameter']['Value']
    except ClientError as e:
        logger.error(f"Failed to get parameter {name}: {e}")
        raise


def get_env_var(name: str, default: Optional[str] = None) -> str:
    """Get environment variable with optional default."""
    value = os.environ.get(name, default)
    if value is None:
        raise ValueError(f"Environment variable {name} not set")
    return value


def json_serial(obj: Any) -> str:
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def upload_to_s3(bucket: str, key: str, data: Any, metadata: Optional[Dict] = None) -> None:
    """Upload data to S3 with optional metadata."""
    try:
        if isinstance(data, (dict, list)):
            data = json.dumps(data, default=json_serial)
        
        put_args = {
            'Bucket': bucket,
            'Key': key,
            'Body': data
        }
        
        if metadata:
            put_args['Metadata'] = metadata
            
        s3_client.put_object(**put_args)
        logger.info(f"Uploaded to s3://{bucket}/{key}")
        
    except ClientError as e:
        logger.error(f"Failed to upload to S3: {e}")
        raise


def download_from_s3(bucket: str, key: str) -> bytes:
    """Download data from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except ClientError as e:
        logger.error(f"Failed to download from S3: {e}")
        raise


def get_current_timestamp() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def create_response(status_code: int, body: Any, headers: Optional[Dict] = None) -> Dict:
    """Create standardized Lambda response."""
    response = {
        'statusCode': status_code,
        'body': json.dumps(body, default=json_serial)
    }
    
    if headers:
        response['headers'] = headers
    else:
        response['headers'] = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    
    return response


class ServiceError(Exception):
    """Base exception for service errors."""
    pass


class ValidationError(ServiceError):
    """Validation error exception."""
    pass


class ProcessingError(ServiceError):
    """Processing error exception."""
    pass