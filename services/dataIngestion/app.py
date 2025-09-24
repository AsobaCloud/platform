import json
import boto3
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="dataIngestion")

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for data ingestion and preprocessing
    """
    try:
        # TODO: Implement dataIngestion logic
        print(f"Processing dataIngestion request...")
        
        # Example environment variable access
        environment = os.environ.get('ENVIRONMENT', 'dev')
        log_level = os.environ.get('LOG_LEVEL', 'INFO')
        
        metrics.add_metric(name="RequestsProcessed", unit=MetricUnit.Count, value=1)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'dataIngestion processed successfully',
                'service': 'dataIngestion',
                'environment': environment,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        print(f"Error in dataIngestion: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }