import json
import boto3
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="forecastingApi")

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for solar forecasting API endpoints
    """
    try:
        # TODO: Implement forecastingApi logic
        print(f"Processing forecastingApi request...")
        
        # Example environment variable access
        environment = os.environ.get('ENVIRONMENT', 'dev')
        log_level = os.environ.get('LOG_LEVEL', 'INFO')
        
        metrics.add_metric(name="RequestsProcessed", unit=MetricUnit.Count, value=1)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'forecastingApi processed successfully',
                'service': 'forecastingApi',
                'environment': environment,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        print(f"Error in forecastingApi: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }