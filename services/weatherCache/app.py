import json
import boto3
import pandas as pd
from datetime import datetime, timedelta
import asyncio
import aiohttp
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="weatherCache")
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for weather cache updates
    """
    try:
        # Initialize asyncio for concurrent API calls
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Get all active locations
        locations = get_all_active_locations()
        
        # Batch fetch weather data
        weather_results = loop.run_until_complete(
            fetch_all_weather_async(locations)
        )
        
        # Update S3 cache
        update_weather_cache(locations, weather_results)
        
        # Update forecast if it's 6 AM
        if datetime.now().hour == 6:
            forecast_results = loop.run_until_complete(
                fetch_all_forecasts_async(locations)
            )
            update_forecast_cache(locations, forecast_results)
        
        metrics.add_metric(name="LocationsUpdated", unit=MetricUnit.Count, value=len(locations))
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Weather updated for {len(locations)} locations',
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error in weather cache: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

async def fetch_all_weather_async(locations):
    """Asynchronously fetch weather for all locations"""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_weather_async(session, loc) for loc in locations]
        return await asyncio.gather(*tasks, return_exceptions=True)

async def fetch_weather_async(session, location):
    """Fetch weather for a single location"""
    try:
        # TODO: Implement actual weather API call
        # For now, return mock data
        return {
            'location': location,
            'temperature': 25.0,
            'humidity': 60.0,
            'wind_speed': 5.0,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error fetching weather for {location}: {e}")
        return None

def get_all_active_locations():
    """Get all active locations from DynamoDB"""
    try:
        table = dynamodb.Table('ona-platform-locations')
        response = table.scan()
        return [item['location_id'] for item in response['Items']]
    except Exception as e:
        print(f"Error getting locations: {e}")
        return ['default_location']  # Fallback

def update_weather_cache(locations, weather_results):
    """Update weather cache in S3"""
    bucket = os.environ.get('INPUT_BUCKET', 'sa-api-client-input')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    for i, location in enumerate(locations):
        if weather_results[i] and not isinstance(weather_results[i], Exception):
            key = f"weather-cache/{location}/{timestamp}.json"
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=json.dumps(weather_results[i]),
                ContentType='application/json'
            )

async def fetch_all_forecasts_async(locations):
    """Asynchronously fetch forecasts for all locations"""
    # TODO: Implement forecast fetching
    return [None] * len(locations)

def update_forecast_cache(locations, forecast_results):
    """Update forecast cache in S3"""
    # TODO: Implement forecast cache update
    pass