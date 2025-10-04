#!/usr/bin/env python3
"""
Gap Analysis Tool for Solar Time Series Data
Reproducible analysis that works with any solar dataset
"""
import pandas as pd
import numpy as np
import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings
import boto3
from difflib import get_close_matches
warnings.filterwarnings('ignore')


class SolarGapAnalyzer:
    """Generic gap analyzer for solar time series data"""
    
    def __init__(self, config: Optional[Dict] = None, city_name: Optional[str] = None):
        """Initialize with optional configuration and city name"""
        self.config = config or self._default_config()
        self.city_name = city_name
        self.weather_data = None
        self.s3_client = boto3.client('s3')
        
    def _default_config(self) -> Dict:
        """Default configuration for gap analysis"""
        return {
            'time_column_patterns': ['time', 'date', 'timestamp', 'datetime'],
            'power_column_patterns': ['power', 'energy', 'watt', 'wh', 'kw', 'mw'],
            'gap_length_bins': [1, 2, 3, 6, 12, 24, 48, 168, 1000],  # hours
            'gap_length_labels': ['1h', '2h', '3h', '6h', '12h', '1d', '2d', '1w', '>1w'],
            'min_gap_size': 1,  # minimum gap size to analyze
            'max_gap_size': 1000,  # maximum gap size to analyze
            'time_frequency_detection': True,
            'output_format': 'json'  # json, csv, text
        }
    
    def detect_data_structure(self, df: pd.DataFrame) -> Dict:
        """Auto-detect time and power columns in the dataset"""
        print("Detecting data structure...")
        
        # Find time column
        time_col = None
        for pattern in self.config['time_column_patterns']:
            candidates = [col for col in df.columns if pattern.lower() in col.lower()]
            if candidates:
                time_col = candidates[0]
                break
        
        if time_col is None:
            # Try first column if it looks like datetime
            first_col = df.columns[0]
            try:
                pd.to_datetime(df[first_col].iloc[0])
                time_col = first_col
            except:
                pass
        
        # Find power/energy columns
        power_cols = []
        for pattern in self.config['power_column_patterns']:
            candidates = [col for col in df.columns if pattern.lower() in col.lower()]
            power_cols.extend(candidates)
        
        # Remove duplicates and sort
        power_cols = sorted(list(set(power_cols)))
        
        # Detect time frequency
        time_frequency = None
        if time_col and len(df) > 1:
            try:
                df_temp = df.copy()
                df_temp[time_col] = pd.to_datetime(df_temp[time_col])
                time_diff = df_temp[time_col].diff().dropna()
                if len(time_diff) > 0:
                    median_diff = time_diff.median()
                    if median_diff <= pd.Timedelta(minutes=30):
                        time_frequency = '15min'
                    elif median_diff <= pd.Timedelta(hours=1):
                        time_frequency = 'hourly'
                    elif median_diff <= pd.Timedelta(days=1):
                        time_frequency = 'daily'
                    else:
                        time_frequency = 'other'
            except:
                time_frequency = 'unknown'
        
        structure = {
            'time_column': time_col,
            'power_columns': power_cols,
            'time_frequency': time_frequency,
            'total_rows': len(df),
            'total_columns': len(df.columns)
        }
        
        print(f"Detected structure:")
        print(f"  Time column: {time_col}")
        print(f"  Power columns: {power_cols}")
        print(f"  Time frequency: {time_frequency}")
        
        return structure
    
    def find_gaps_generic(self, df: pd.DataFrame, column: str, time_col: str) -> List[Dict]:
        """Find all gaps in a time series column"""
        if column not in df.columns:
            return []
        
        # Convert to numeric, handling any non-numeric values
        series = pd.to_numeric(df[column], errors='coerce')
        
        # Find gaps
        is_missing = series.isna()
        is_not_missing = is_missing == False
        gap_starts = is_missing & (is_not_missing.shift(1).fillna(False))
        gap_ends = is_not_missing & (is_missing.shift(1).fillna(False))
        
        gaps = []
        current_gap_start = None
        current_gap_length = 0
        
        for i, (missing, gap_start, gap_end) in enumerate(zip(is_missing, gap_starts, gap_ends)):
            if gap_start:
                current_gap_start = i
                current_gap_length = 1
            elif missing and current_gap_start is not None:
                current_gap_length += 1
            elif gap_end and current_gap_start is not None:
                # Gap ended
                gap_info = {
                    'start_index': current_gap_start,
                    'end_index': i - 1,
                    'length': current_gap_length,
                    'start_time': df.iloc[current_gap_start][time_col] if time_col in df.columns else None,
                    'end_time': df.iloc[i-1][time_col] if time_col in df.columns else None
                }
                gaps.append(gap_info)
                current_gap_start = None
                current_gap_length = 0
        
        # Handle gap that extends to end of data
        if current_gap_start is not None:
            gap_info = {
                'start_index': current_gap_start,
                'end_index': len(df) - 1,
                'length': current_gap_length,
                'start_time': df.iloc[current_gap_start][time_col] if time_col in df.columns else None,
                'end_time': df.iloc[-1][time_col] if time_col in df.columns else None
            }
            gaps.append(gap_info)
        
        return gaps
    
    def analyze_gaps_generic(self, df: pd.DataFrame, structure: Dict) -> Dict:
        """Analyze gap patterns across all power columns"""
        print("Analyzing gap patterns...")
        
        time_col = structure['time_column']
        power_cols = structure['power_columns']
        
        if not time_col or not power_cols:
            return {'error': 'Could not detect time or power columns'}
        
        # Convert time column to datetime
        try:
            df[time_col] = pd.to_datetime(df[time_col])
        except Exception as e:
            return {'error': f'Could not convert time column to datetime: {e}'}
        
        analysis = {
            'dataset_info': {
                'total_rows': len(df),
                'time_range': {
                    'start': df[time_col].min().isoformat(),
                    'end': df[time_col].max().isoformat(),
                    'duration_days': (df[time_col].max() - df[time_col].min()).days
                },
                'time_frequency': structure['time_frequency']
            },
            'columns': {},
            'overall_stats': {}
        }
        
        all_gaps = []
        
        # Analyze each power column
        for col in power_cols:
            print(f"  Analyzing {col}...")
            gaps = self.find_gaps_generic(df, col, time_col)
            
            if gaps:
                gap_lengths = [gap['length'] for gap in gaps]
                
                col_analysis = {
                    'total_gaps': len(gaps),
                    'total_missing_values': sum(gap_lengths),
                    'missing_percentage': (sum(gap_lengths) / len(df)) * 100,
                    'gap_length_stats': {
                        'min': min(gap_lengths),
                        'max': max(gap_lengths),
                        'mean': np.mean(gap_lengths),
                        'median': np.median(gap_lengths),
                        'std': np.std(gap_lengths)
                    },
                    'gap_length_distribution': self._bin_gap_lengths(gap_lengths),
                    'gaps': gaps[:10]  # Store first 10 gaps as examples
                }
                
                analysis['columns'][col] = col_analysis
                all_gaps.extend(gaps)
        
        # Overall statistics
        if all_gaps:
            all_gap_lengths = [gap['length'] for gap in all_gaps]
            analysis['overall_stats'] = {
                'total_gaps': len(all_gaps),
                'total_missing_values': sum(all_gap_lengths),
                'overall_missing_percentage': (sum(all_gap_lengths) / (len(df) * len(power_cols))) * 100,
                'gap_length_stats': {
                    'min': min(all_gap_lengths),
                    'max': max(all_gap_lengths),
                    'mean': np.mean(all_gap_lengths),
                    'median': np.median(all_gap_lengths),
                    'std': np.std(all_gap_lengths)
                },
                'gap_length_distribution': self._bin_gap_lengths(all_gap_lengths)
            }
        
        return analysis
    
    def _bin_gap_lengths(self, gap_lengths: List[int]) -> Dict:
        """Bin gap lengths into categories"""
        bins = self.config['gap_length_bins']
        labels = self.config['gap_length_labels']
        
        hist, _ = np.histogram(gap_lengths, bins=bins)
        
        distribution = {}
        for i in range(len(bins) - 1):
            distribution[labels[i]] = int(hist[i])
        
        return distribution
    
    def _find_nearest_city(self, city_name: str) -> str:
        """Find the nearest city in the S3 weather database"""
        if not city_name:
            return None
            
        try:
            # List all cities in the weather database
            response = self.s3_client.list_objects_v2(
                Bucket='visualcrossing-city-database',
                Delimiter='/'
            )
            
            available_cities = []
            if 'CommonPrefixes' in response:
                for prefix in response['CommonPrefixes']:
                    city = prefix['Prefix'].rstrip('/')
                    available_cities.append(city)
            
            if not available_cities:
                print(f"Warning: No cities found in weather database")
                return None
            
            # Find closest match
            closest_match = get_close_matches(
                city_name.lower(), 
                [city.lower() for city in available_cities], 
                n=1, 
                cutoff=0.6
            )
            
            if closest_match:
                # Get the original case version
                matched_city = next(city for city in available_cities if city.lower() == closest_match[0])
                print(f"Found nearest city: {matched_city} (requested: {city_name})")
                return matched_city
            else:
                print(f"Warning: No close match found for {city_name}. Available cities: {available_cities}")
                return None
                
        except Exception as e:
            print(f"Error finding nearest city: {e}")
            return None
    
    def _load_weather_data(self, city_name: str) -> Optional[pd.DataFrame]:
        """Load weather data for the specified city"""
        if not city_name:
            return None
            
        try:
            # Find nearest city
            nearest_city = self._find_nearest_city(city_name)
            if not nearest_city:
                return None
            
            # Load weather data
            s3_key = f"{nearest_city}/weather_data.csv"
            response = self.s3_client.get_object(
                Bucket='visualcrossing-city-database',
                Key=s3_key
            )
            
            weather_df = pd.read_csv(response['Body'])
            weather_df['datetime'] = pd.to_datetime(weather_df['datetime'])
            
            print(f"Loaded weather data for {nearest_city}: {len(weather_df)} records")
            print(f"Weather data range: {weather_df['datetime'].min()} to {weather_df['datetime'].max()}")
            
            return weather_df
            
        except Exception as e:
            print(f"Error loading weather data for {city_name}: {e}")
            return None
    
    def _analyze_solar_physics_violations(self, df: pd.DataFrame, power_columns: List[str]) -> Dict:
        """Detect gaps that violate solar physics"""
        violations = {
            'nighttime_data_present': 0,
            'daytime_zero_unexpected': 0,
            'power_exceeds_capacity': 0,
            'negative_power': 0,
            'total_violations': 0
        }
        
        if 'Time' not in df.columns:
            return violations
            
        df_temp = df.copy()
        df_temp['Time'] = pd.to_datetime(df_temp['Time'])
        df_temp['hour'] = df_temp['Time'].dt.hour
        
        for _, row in df_temp.iterrows():
            hour = row['hour']
            power_vals = [row[col] for col in power_columns if pd.notna(row[col])]
            
            if not power_vals:
                continue
            
            # Check for nighttime power (should be 0)
            if (hour <= 5 or hour >= 19) and any(p > 10 for p in power_vals):
                violations['nighttime_data_present'] += 1
                
            # Check for unexpected daytime zeros (potential sensor issues)
            if (9 <= hour <= 15) and all(p == 0 for p in power_vals):
                violations['daytime_zero_unexpected'] += 1
            
            # Check for negative power
            if any(p < 0 for p in power_vals):
                violations['negative_power'] += 1
            
            # Check for unrealistic power values (assuming max 10kW per inverter)
            if any(p > 10000 for p in power_vals):
                violations['power_exceeds_capacity'] += 1
        
        violations['total_violations'] = sum(violations.values())
        return violations
    
    def _analyze_weather_correlation(self, gaps: List[Dict], weather_df: pd.DataFrame) -> Dict:
        """Check if gaps correlate with weather events"""
        correlations = {
            'storm_related': 0,
            'maintenance_weather': 0,  # Gaps during good weather (planned maintenance)
            'equipment_weather': 0,   # Gaps during bad weather (equipment protection)
            'clear_weather_gaps': 0,
            'total_weather_correlated': 0
        }
        
        if weather_df is None or not gaps:
            return correlations
        
        for gap in gaps:
            if not gap.get('start_time'):
                continue
                
            gap_start = pd.to_datetime(gap['start_time'])
            
            # Check weather conditions during gap
            weather_window = weather_df[
                (weather_df['datetime'] >= gap_start - pd.Timedelta(hours=2)) &
                (weather_df['datetime'] <= gap_start + pd.Timedelta(hours=2))
            ]
            
            if not weather_window.empty:
                avg_wind = weather_window['wind_speed'].mean()
                avg_cloud = weather_window['cloud_cover'].mean()
                avg_temp = weather_window['temperature'].mean()
                
                # Storm conditions (high wind, heavy clouds)
                if avg_wind > 50 or avg_cloud > 80:
                    correlations['storm_related'] += 1
                    correlations['equipment_weather'] += 1
                
                # Clear weather (low clouds, good conditions)
                elif avg_cloud < 20 and avg_wind < 20:
                    correlations['clear_weather_gaps'] += 1
                    correlations['maintenance_weather'] += 1
        
        correlations['total_weather_correlated'] = (
            correlations['storm_related'] + 
            correlations['maintenance_weather'] + 
            correlations['clear_weather_gaps']
        )
        
        return correlations
    
    def _get_specific_interpolation_methods(self, patterns: Dict, gap_dist: Dict) -> Dict:
        """More specific method recommendations based on detailed patterns"""
        
        methods = {
            'short_gaps_1_3h': [],
            'medium_gaps_4_12h': [],
            'long_gaps_1d_plus': [],
            'system_failures': [],
            'individual_failures': []
        }
        
        # Pattern-specific recommendations
        failure_types = patterns.get('failure_types', {})
        cross_correlation = patterns.get('cross_equipment_correlation', {})
        
        if cross_correlation.get('simultaneous_failures') == 'high':
            methods['system_failures'] = [
                'multi_output_gaussian_process',
                'physics_based_system_model',
                'weather_correlation_interpolation'
            ]
        
        if any(col.get('degradation') == 'detected' for col in failure_types.values()):
            methods['individual_failures'] = [
                'degradation_aware_splines',
                'equipment_aging_models',
                'performance_trend_extrapolation'
            ]
        
        # Add specific parameters for each method
        method_configs = {}
        for category, method_list in methods.items():
            for method in method_list:
                method_configs[method] = self._get_method_parameters(method, patterns)
        
        return {
            'recommended_methods': methods,
            'method_configurations': method_configs
        }
    
    def _get_method_parameters(self, method: str, patterns: Dict) -> Dict:
        """Get specific parameters for each interpolation method"""
        configs = {
            'multi_output_gaussian_process': {
                'kernel': 'RBF + Matern',
                'length_scales': [1.0, 10.0, 50.0],  # time, weather, equipment
                'alpha': 1e-6,
                'optimize': True
            },
            'physics_based_system_model': {
                'use_solar_position': True,
                'model_panel_temperature': True,
                'include_shading_analysis': True,
                'equipment_specifications': True
            },
            'degradation_aware_splines': {
                'spline_order': 3,
                'smoothing_factor': 'adaptive',
                'degrade_over_time': True,
                'equipment_age_weighting': True
            },
            'weather_correlation_interpolation': {
                'use_weather_features': True,
                'correlation_threshold': 0.3,
                'weather_lag_hours': 2
            }
        }
        
        return configs.get(method, {})
    
    def _assess_gap_impact(self, gaps: List[Dict], df: pd.DataFrame) -> Dict:
        """Assess the impact of gaps on different analyses"""
        
        impact = {
            'daily_energy_calculation': 'low',
            'peak_power_analysis': 'low',
            'performance_ratio_calculation': 'low',
            'fault_detection': 'low',
            'overall_impact': 'low'
        }
        
        if not gaps or 'Time' not in df.columns:
            return impact
        
        df_temp = df.copy()
        df_temp['Time'] = pd.to_datetime(df_temp['Time'])
        
        peak_hour_gaps = 0
        full_day_gaps = 0
        short_gaps = 0
        
        for gap in gaps:
            if not gap.get('start_time'):
                continue
                
            start_hour = pd.to_datetime(gap['start_time']).hour
            length = gap['length']
            
            # Peak sun hours (10 AM - 2 PM)
            if 10 <= start_hour <= 14 or (start_hour < 10 and start_hour + length > 10):
                peak_hour_gaps += 1
            
            # Full day gaps affect performance ratio
            if length >= 24:
                full_day_gaps += 1
            
            # Frequent short gaps affect fault detection
            if length <= 2:
                short_gaps += 1
        
        # Assess impact levels
        if peak_hour_gaps > len(gaps) * 0.3:
            impact['peak_power_analysis'] = 'high'
            impact['daily_energy_calculation'] = 'high'
        
        if full_day_gaps > len(gaps) * 0.1:
            impact['performance_ratio_calculation'] = 'high'
        
        if short_gaps > len(gaps) * 0.5:
            impact['fault_detection'] = 'high'
        
        # Overall impact assessment
        high_impacts = sum(1 for v in impact.values() if v == 'high')
        if high_impacts >= 2:
            impact['overall_impact'] = 'high'
        elif high_impacts == 1:
            impact['overall_impact'] = 'medium'
        
        return impact
    
    def _recommend_validation_strategy(self, patterns: Dict, gap_dist: Dict) -> Dict:
        """Recommend how to validate interpolation results"""
        
        validation = {
            'primary_strategy': 'time_series_split_validation',
            'metrics': [],
            'special_considerations': [],
            'validation_blocks': 'unknown'
        }
        
        # Choose validation based on gap patterns
        if patterns.get('temporal_clustering', {}).get('clustered') == 'high':
            validation['primary_strategy'] = 'block_wise_validation'
            validation['special_considerations'].append('Test on similar clustered missing periods')
            validation['validation_blocks'] = 'clustered_gaps'
        
        elif patterns.get('cross_equipment_correlation', {}).get('simultaneous_failures') == 'high':
            validation['primary_strategy'] = 'system_level_validation'
            validation['special_considerations'].append('Validate system-wide power conservation')
            validation['validation_blocks'] = 'system_failures'
        
        else:
            validation['primary_strategy'] = 'time_series_split_validation'
            validation['validation_blocks'] = 'temporal_split'
        
        # Solar-specific metrics
        validation['metrics'] = [
            'mae_during_peak_hours',
            'daily_energy_error',
            'power_curve_shape_preservation',
            'physical_constraint_violations',
            'weather_correlation_accuracy'
        ]
        
        return validation

    def classify_failure_patterns(self, analysis: Dict) -> Dict:
        """Classify specific types of equipment failure patterns"""
        print("Classifying failure patterns...")
        
        if 'error' in analysis:
            return {'error': analysis['error']}
        
        columns = analysis.get('columns', {})
        if not columns:
            print(f"Available keys in analysis: {list(analysis.keys())}")
            return {'error': 'No column data available for pattern analysis'}
        
        patterns = {
            'failure_types': {},
            'cross_equipment_correlation': {},
            'temporal_clustering': {},
            'pattern_summary': {}
        }
        
        # Analyze each column for failure patterns
        for col_name, col_data in columns.items():
            gaps = col_data.get('gaps', [])
            if not gaps:
                continue
            
            # Extract gap timing information
            gap_times = []
            gap_lengths = []
            for gap in gaps:
                if gap.get('start_time'):
                    gap_times.append(pd.to_datetime(gap['start_time']))
                    gap_lengths.append(gap['length'])
            
            if not gap_times:
                continue
            
            gap_times = pd.Series(gap_times)
            gap_lengths = pd.Series(gap_lengths)
            
            # Classify failure pattern for this column
            col_patterns = self._analyze_column_failure_pattern(gap_times, gap_lengths, col_name)
            patterns['failure_types'][col_name] = col_patterns
        
        # Analyze cross-equipment correlation
        patterns['cross_equipment_correlation'] = self._analyze_cross_equipment_correlation(columns)
        
        # Analyze temporal clustering
        patterns['temporal_clustering'] = self._analyze_temporal_clustering(columns)
        
        # Generate pattern summary
        patterns['pattern_summary'] = self._generate_pattern_summary(patterns)
        
        return patterns
    
    def _analyze_column_failure_pattern(self, gap_times: pd.Series, gap_lengths: pd.Series, col_name: str) -> Dict:
        """Analyze failure pattern for a single column"""
        patterns = {
            'randomness': 'unknown',
            'systematic': 'unknown',
            'degradation': 'unknown',
            'maintenance_like': 'unknown',
            'weather_correlated': 'unknown'
        }
        
        if len(gap_times) < 3:
            return patterns
        
        # Analyze randomness vs systematic patterns
        time_diffs = gap_times.diff().dropna()
        if len(time_diffs) > 1:
            # Convert Timedelta to hours for comparison
            time_diffs_hours = time_diffs.dt.total_seconds() / 3600
            cv = time_diffs_hours.std() / time_diffs_hours.mean() if time_diffs_hours.mean() > 0 else 0
            if cv > 1.5:
                patterns['randomness'] = 'high'
            elif cv < 0.5:
                patterns['systematic'] = 'high'
            else:
                patterns['randomness'] = 'moderate'
        
        # Analyze degradation (increasing gap length over time)
        if len(gap_lengths) > 5:
            # Check if gap lengths increase over time
            time_numeric = pd.to_numeric(gap_times)
            correlation = np.corrcoef(time_numeric, gap_lengths)[0, 1]
            if correlation > 0.3:
                patterns['degradation'] = 'detected'
            elif correlation < -0.3:
                patterns['degradation'] = 'improving'
            else:
                patterns['degradation'] = 'stable'
        
        # Analyze maintenance-like patterns (regular intervals)
        if len(gap_times) > 4:
            time_diffs_hours = time_diffs.dt.total_seconds() / 3600
            # Look for regular intervals (weekly, monthly patterns)
            if len(time_diffs_hours) > 2:
                mean_interval = time_diffs_hours.mean()
                std_interval = time_diffs_hours.std()
                if std_interval / mean_interval < 0.3:  # Low coefficient of variation
                    if 160 < mean_interval < 200:  # Weekly pattern
                        patterns['maintenance_like'] = 'weekly'
                    elif 700 < mean_interval < 800:  # Monthly pattern
                        patterns['maintenance_like'] = 'monthly'
                    else:
                        patterns['maintenance_like'] = 'regular'
        
        return patterns
    
    def _analyze_cross_equipment_correlation(self, columns: Dict) -> Dict:
        """Analyze if equipment failures are correlated across columns"""
        correlation_analysis = {
            'simultaneous_failures': 'unknown',
            'independent_failures': 'unknown',
            'cascading_failures': 'unknown'
        }
        
        if len(columns) < 2:
            return correlation_analysis
        
        # Extract gap times for all columns
        all_gap_times = {}
        for col_name, col_data in columns.items():
            gaps = col_data.get('gaps', [])
            gap_times = []
            for gap in gaps:
                if gap.get('start_time'):
                    gap_times.append(pd.to_datetime(gap['start_time']))
            all_gap_times[col_name] = gap_times
        
        # Check for simultaneous failures (within 1 hour)
        simultaneous_count = 0
        total_overlaps = 0
        
        col_names = list(all_gap_times.keys())
        for i in range(len(col_names)):
            for j in range(i + 1, len(col_names)):
                col1_times = all_gap_times[col_names[i]]
                col2_times = all_gap_times[col_names[j]]
                
                # Check for overlaps within 1 hour
                for t1 in col1_times:
                    for t2 in col2_times:
                        if abs((t1 - t2).total_seconds()) < 3600:  # Within 1 hour
                            simultaneous_count += 1
                        total_overlaps += 1
        
        if total_overlaps > 0:
            overlap_ratio = simultaneous_count / total_overlaps
            if overlap_ratio > 0.3:
                correlation_analysis['simultaneous_failures'] = 'high'
            elif overlap_ratio > 0.1:
                correlation_analysis['simultaneous_failures'] = 'moderate'
            else:
                correlation_analysis['independent_failures'] = 'high'
        
        return correlation_analysis
    
    def _analyze_temporal_clustering(self, columns: Dict) -> Dict:
        """Analyze temporal clustering of failures"""
        clustering_analysis = {
            'clustered': 'unknown',
            'distributed': 'unknown',
            'seasonal': 'unknown'
        }
        
        # Combine all gap times across all columns
        all_gap_times = []
        for col_data in columns.values():
            gaps = col_data.get('gaps', [])
            for gap in gaps:
                if gap.get('start_time'):
                    all_gap_times.append(pd.to_datetime(gap['start_time']))
        
        if len(all_gap_times) < 5:
            return clustering_analysis
        
        all_gap_times = pd.Series(all_gap_times).sort_values()
        
        # Analyze clustering
        time_diffs = all_gap_times.diff().dropna()
        if len(time_diffs) > 1:
            # Check for clustering (many short intervals)
            short_intervals = time_diffs[time_diffs < pd.Timedelta(hours=24)]
            clustering_ratio = len(short_intervals) / len(time_diffs)
            
            if clustering_ratio > 0.5:
                clustering_analysis['clustered'] = 'high'
            elif clustering_ratio < 0.2:
                clustering_analysis['distributed'] = 'high'
            else:
                clustering_analysis['clustered'] = 'moderate'
        
        # Analyze seasonal patterns
        if len(all_gap_times) > 10:
            months = all_gap_times.dt.month
            month_counts = months.value_counts()
            if len(month_counts) > 1:
                # Check if failures are concentrated in certain months
                max_month_ratio = month_counts.max() / len(all_gap_times)
                if max_month_ratio > 0.4:
                    clustering_analysis['seasonal'] = 'high'
                elif max_month_ratio > 0.25:
                    clustering_analysis['seasonal'] = 'moderate'
        
        return clustering_analysis
    
    def _generate_pattern_summary(self, patterns: Dict) -> Dict:
        """Generate summary of failure patterns"""
        summary = {
            'primary_pattern': 'unknown',
            'secondary_patterns': [],
            'interpolation_complexity': 'unknown'
        }
        
        # Analyze cross-equipment correlation
        cross_corr = patterns.get('cross_equipment_correlation', {})
        if cross_corr.get('simultaneous_failures') == 'high':
            summary['primary_pattern'] = 'system_wide_failures'
            summary['interpolation_complexity'] = 'high'
        elif cross_corr.get('independent_failures') == 'high':
            summary['primary_pattern'] = 'individual_equipment_failures'
            summary['interpolation_complexity'] = 'medium'
        
        # Analyze temporal clustering
        temporal = patterns.get('temporal_clustering', {})
        if temporal.get('clustered') == 'high':
            summary['secondary_patterns'].append('temporal_clustering')
        if temporal.get('seasonal') == 'high':
            summary['secondary_patterns'].append('seasonal_patterns')
        
        # Analyze individual failure types
        failure_types = patterns.get('failure_types', {})
        for col_patterns in failure_types.values():
            if col_patterns.get('degradation') == 'detected':
                summary['secondary_patterns'].append('equipment_degradation')
            if col_patterns.get('maintenance_like') != 'unknown':
                summary['secondary_patterns'].append('maintenance_patterns')
            if col_patterns.get('randomness') == 'high':
                summary['secondary_patterns'].append('random_failures')
        
        return summary

    def recommend_methods_generic(self, analysis: Dict) -> Dict:
        """Recommend interpolation methods based on gap analysis and failure patterns"""
        print("Generating method recommendations...")
        
        if 'error' in analysis:
            return {'error': analysis['error']}
        
        # First classify failure patterns
        patterns = self.classify_failure_patterns(analysis)
        if 'error' in patterns:
            return {'error': patterns['error']}
        
        overall_stats = analysis.get('overall_stats', {})
        gap_dist = overall_stats.get('gap_length_distribution', {})
        pattern_summary = patterns.get('pattern_summary', {})
        
        recommendations = {
            'primary_method': 'unknown',
            'method_parameters': {},
            'reasoning': [],
            'pattern_based_recommendations': {}
        }
        
        # Analyze gap patterns
        short_gaps = gap_dist.get('1h', 0) + gap_dist.get('2h', 0) + gap_dist.get('3h', 0)
        medium_gaps = gap_dist.get('6h', 0) + gap_dist.get('12h', 0) + gap_dist.get('1d', 0)
        long_gaps = gap_dist.get('2d', 0) + gap_dist.get('1w', 0) + gap_dist.get('>1w', 0)
        
        total_gaps = sum(gap_dist.values())
        
        if total_gaps == 0:
            recommendations['reasoning'].append("No gaps found - no interpolation needed")
            return recommendations
        
        # Pattern-based method selection
        primary_pattern = pattern_summary.get('primary_pattern', 'unknown')
        
        if primary_pattern == 'system_wide_failures':
            recommendations['primary_method'] = 'system_level_interpolation'
            recommendations['method_parameters'] = {
                'use_system_correlation': True,
                'model_backup_power': True,
                'include_grid_status': True
            }
            recommendations['reasoning'].append("System-wide failures detected - use system-level interpolation with backup power modeling")
        
        elif primary_pattern == 'individual_equipment_failures':
            # Check for specific failure types
            secondary_patterns = pattern_summary.get('secondary_patterns', [])
            
            if 'equipment_degradation' in secondary_patterns:
                recommendations['primary_method'] = 'degradation_aware_interpolation'
                recommendations['method_parameters'] = {
                    'use_degradation_curves': True,
                    'model_equipment_age': True,
                    'include_performance_trends': True
                }
                recommendations['reasoning'].append("Equipment degradation detected - use degradation-aware interpolation with performance trends")
            
            elif 'maintenance_patterns' in secondary_patterns:
                recommendations['primary_method'] = 'maintenance_aware_interpolation'
                recommendations['method_parameters'] = {
                    'use_maintenance_schedules': True,
                    'model_planned_outages': True,
                    'include_preventive_maintenance': True
                }
                recommendations['reasoning'].append("Maintenance patterns detected - use maintenance-aware interpolation with scheduled outages")
            
            elif 'random_failures' in secondary_patterns:
                recommendations['primary_method'] = 'equipment_specific_interpolation'
                recommendations['method_parameters'] = {
                    'model_individual_equipment': True,
                    'use_equipment_correlation': False,
                    'include_equipment_specs': True
                }
                recommendations['reasoning'].append("Random individual failures detected - use equipment-specific interpolation")
            
            else:
                recommendations['primary_method'] = 'multi_output_regression'
                recommendations['method_parameters'] = {
                    'model_equipment_independently': True,
                    'use_equipment_correlation': True
                }
                recommendations['reasoning'].append("Individual equipment failures detected - use multi-output regression")
        
        else:
            # Fallback to gap-length based recommendations
            if short_gaps > total_gaps * 0.7:
                recommendations['primary_method'] = 'spline_interpolation'
                recommendations['reasoning'].append("Mostly short gaps (1-3 hours) - spline interpolation recommended")
            elif medium_gaps > total_gaps * 0.3:
                recommendations['primary_method'] = 'gaussian_process'
                recommendations['reasoning'].append("Significant medium gaps (6-24 hours) - Gaussian Process recommended")
            elif long_gaps > total_gaps * 0.2:
                recommendations['primary_method'] = 'physics_based_model'
                recommendations['reasoning'].append("Many long gaps (>24 hours) - physics-based models recommended")
        
        # Add solar-specific constraints
        recommendations['method_parameters']['apply_solar_constraints'] = True
        recommendations['reasoning'].append("Apply solar physics constraints (nighttime = 0, etc.)")
        
        # Add gap-specific recommendations
        recommendations['gap_specific_recommendations'] = {
            'short_gaps': 'spline_interpolation' if short_gaps > total_gaps * 0.5 else 'multi_output_regression',
            'medium_gaps': 'multi_output_regression' if medium_gaps > total_gaps * 0.3 else 'gaussian_process',
            'long_gaps': 'physics_based_model' if long_gaps > total_gaps * 0.2 else 'multi_output_regression'
        }
        
        # Add detailed configuration for each method
        recommendations['configuration'] = {
            'multi_output_regression': {
                'model_equipment_independently': recommendations['method_parameters'].get('model_equipment_independently', True),
                'use_equipment_correlation': recommendations['method_parameters'].get('use_equipment_correlation', True),
                'correlation_features': ['inverter_1', 'inverter_2', 'inverter_3'] if len(analysis.get('columns', {})) >= 3 else [],
                'shared_features': ['weather_data', 'time_features'],
                'apply_solar_constraints': True,
                'solar_constraints': {
                    'nighttime_zero': True,
                    'max_power_limits': {'inverter_1': 1500, 'inverter_2': 1500, 'inverter_3': 1500},
                    'negative_clipping': True,
                    'max_efficiency': 0.95
                },
                'model_parameters': {
                    'n_estimators': 200,
                    'max_depth': 6,
                    'learning_rate': 0.1,
                    'feature_fraction': 0.9,
                    'random_state': 42
                }
            },
            'spline_interpolation': {
                'method': 'cubic',
                'fill_value': 'extrapolate',
                'apply_solar_constraints': True,
                'solar_constraints': {
                    'nighttime_zero': True,
                    'negative_clipping': True
                }
            },
            'gaussian_process': {
                'kernel': 'rbf',
                'alpha': 1e-6,
                'apply_solar_constraints': True,
                'solar_constraints': {
                    'nighttime_zero': True,
                    'negative_clipping': True
                }
            },
            'physics_based_model': {
                'use_solar_position': True,
                'use_weather_correlation': True,
                'apply_solar_constraints': True,
                'solar_constraints': {
                    'nighttime_zero': True,
                    'negative_clipping': True,
                    'max_efficiency': 0.95
                }
            }
        }
        
        # Add pattern-specific recommendations
        recommendations['pattern_based_recommendations'] = {
            'failure_patterns': patterns.get('failure_types', {}),
            'cross_equipment_correlation': patterns.get('cross_equipment_correlation', {}),
            'temporal_clustering': patterns.get('temporal_clustering', {}),
            'pattern_summary': pattern_summary
        }
        
        return recommendations
    
    def analyze_dataset(self, filepath: str) -> Dict:
        """Complete analysis of a solar dataset with enhanced features"""
        print(f"Analyzing dataset: {filepath}")
        
        try:
            # Load data
            df = pd.read_csv(filepath)
            print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
            
            # Detect structure
            structure = self.detect_data_structure(df)
            
            # Load weather data if city specified
            if self.city_name:
                print(f"Loading weather data for {self.city_name}...")
                self.weather_data = self._load_weather_data(self.city_name)
            
            # Analyze gaps
            analysis = self.analyze_gaps_generic(df, structure)
            
            # Enhanced analysis with new features
            enhanced_analysis = self._perform_enhanced_analysis(df, analysis, structure)
            
            # Generate recommendations
            recommendations = self.recommend_methods_generic(enhanced_analysis)
            
            # Combine results
            results = {
                'filepath': filepath,
                'city_name': self.city_name,
                'structure': structure,
                'analysis': enhanced_analysis,
                'recommendations': recommendations
            }
            
            return results
            
        except Exception as e:
            return {'error': f'Analysis failed: {str(e)}'}
    
    def _perform_enhanced_analysis(self, df: pd.DataFrame, analysis: Dict, structure: Dict) -> Dict:
        """Perform enhanced analysis with solar physics, weather correlation, etc."""
        print("Performing enhanced analysis...")
        
        enhanced_analysis = analysis.copy()
        
        # Get power columns
        power_columns = structure.get('power_columns', [])
        
        # 1. Solar Physics Violations Analysis
        print("  Analyzing solar physics violations...")
        physics_violations = self._analyze_solar_physics_violations(df, power_columns)
        enhanced_analysis['solar_physics_violations'] = physics_violations
        
        # 2. Weather Correlation Analysis (if weather data available)
        if self.weather_data is not None:
            print("  Analyzing weather correlation...")
            # Get all gaps from analysis
            all_gaps = []
            for col_data in analysis.get('columns', {}).values():
                gaps = col_data.get('gaps', [])
                all_gaps.extend(gaps)
            
            weather_correlation = self._analyze_weather_correlation(all_gaps, self.weather_data)
            enhanced_analysis['weather_correlation'] = weather_correlation
        else:
            enhanced_analysis['weather_correlation'] = {'note': 'No weather data available'}
        
        # 3. Gap Impact Assessment
        print("  Assessing gap impact...")
        all_gaps = []
        for col_data in analysis.get('columns', {}).values():
            gaps = col_data.get('gaps', [])
            all_gaps.extend(gaps)
        
        gap_impact = self._assess_gap_impact(all_gaps, df)
        enhanced_analysis['gap_impact_assessment'] = gap_impact
        
        # 4. Enhanced Interpolation Methods
        print("  Generating enhanced interpolation methods...")
        patterns = self.classify_failure_patterns(enhanced_analysis)
        gap_dist = analysis.get('overall_stats', {}).get('gap_length_distribution', {})
        
        enhanced_methods = self._get_specific_interpolation_methods(patterns, gap_dist)
        enhanced_analysis['enhanced_interpolation_methods'] = enhanced_methods
        
        # 5. Validation Strategy Recommendations
        print("  Recommending validation strategy...")
        validation_strategy = self._recommend_validation_strategy(patterns, gap_dist)
        enhanced_analysis['validation_strategy'] = validation_strategy
        
        return enhanced_analysis
    
    def save_results(self, results: Dict, output_path: str):
        """Save analysis results in specified format"""
        if self.config['output_format'] == 'json':
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2, default=str)
        elif self.config['output_format'] == 'csv':
            # Save summary as CSV
            summary_data = []
            if 'analysis' in results and 'columns' in results['analysis']:
                for col, col_analysis in results['analysis']['columns'].items():
                    summary_data.append({
                        'column': col,
                        'total_gaps': col_analysis['total_gaps'],
                        'missing_percentage': col_analysis['missing_percentage'],
                        'mean_gap_length': col_analysis['gap_length_stats']['mean']
                    })
            
            if summary_data:
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_csv(output_path, index=False)
        else:  # text format
            with open(output_path, 'w') as f:
                f.write(self._format_text_report(results))
    
    def _format_text_report(self, results: Dict) -> str:
        """Format results as human-readable text report"""
        report = []
        report.append("SOLAR GAP ANALYSIS REPORT")
        report.append("=" * 50)
        
        if 'error' in results:
            report.append(f"ERROR: {results['error']}")
            return "\n".join(report)
        
        # Dataset info
        dataset_info = results['analysis']['dataset_info']
        report.append(f"\nDataset: {results['filepath']}")
        report.append(f"Total rows: {dataset_info['total_rows']:,}")
        report.append(f"Time range: {dataset_info['time_range']['start']} to {dataset_info['time_range']['end']}")
        report.append(f"Duration: {dataset_info['time_range']['duration_days']} days")
        report.append(f"Time frequency: {dataset_info['time_frequency']}")
        
        # Overall stats
        overall_stats = results['analysis']['overall_stats']
        report.append(f"\nOVERALL STATISTICS:")
        report.append(f"Total gaps: {overall_stats['total_gaps']:,}")
        report.append(f"Total missing values: {overall_stats['total_missing_values']:,}")
        report.append(f"Overall missing percentage: {overall_stats['overall_missing_percentage']:.1f}%")
        
        gap_stats = overall_stats['gap_length_stats']
        report.append(f"\nGap length statistics:")
        report.append(f"  Min: {gap_stats['min']} hours")
        report.append(f"  Max: {gap_stats['max']} hours")
        report.append(f"  Mean: {gap_stats['mean']:.1f} hours")
        report.append(f"  Median: {gap_stats['median']:.1f} hours")
        
        # Gap distribution
        gap_dist = overall_stats['gap_length_distribution']
        report.append(f"\nGap length distribution:")
        for label, count in gap_dist.items():
            report.append(f"  {label}: {count} gaps")
        
        # Recommendations
        recommendations = results['recommendations']
        report.append(f"\nRECOMMENDATIONS:")
        report.append(f"Primary methods: {', '.join(recommendations['primary_methods'])}")
        report.append(f"Secondary methods: {', '.join(recommendations['secondary_methods'])}")
        if recommendations['avoid_methods']:
            report.append(f"Avoid methods: {', '.join(recommendations['avoid_methods'])}")
        
        report.append(f"\nReasoning:")
        for reason in recommendations['reasoning']:
            report.append(f"  - {reason}")
        
        return "\n".join(report)


def main():
    """Command line interface for gap analysis"""
    parser = argparse.ArgumentParser(description='Analyze gaps in solar time series data')
    parser.add_argument('input_file', help='Path to CSV file with solar data')
    parser.add_argument('-o', '--output', help='Output file path (default: input_file_gap_analysis.json)')
    parser.add_argument('-f', '--format', choices=['json', 'csv', 'text'], default='json',
                       help='Output format (default: json)')
    parser.add_argument('-c', '--config', help='Path to configuration JSON file')
    parser.add_argument('--city', help='City name for weather data correlation (e.g., "Midrand")')
    
    args = parser.parse_args()
    
    # Load configuration if provided
    config = None
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)
    
    # Set output path
    if args.output:
        output_path = args.output
    else:
        input_path = Path(args.input_file)
        output_path = input_path.parent / f"{input_path.stem}_gap_analysis.{args.format}"
    
    # Create analyzer and run analysis
    analyzer = SolarGapAnalyzer(config, city_name=args.city)
    if config and 'output_format' in config:
        analyzer.config['output_format'] = args.format
    
    results = analyzer.analyze_dataset(args.input_file)
    
    # Save results
    analyzer.save_results(results, output_path)
    
    print(f"\nAnalysis complete! Results saved to: {output_path}")
    
    # Print summary to console
    if 'error' not in results:
        overall_stats = results['analysis']['overall_stats']
        print(f"\nSUMMARY:")
        print(f"Total gaps: {overall_stats['total_gaps']:,}")
        print(f"Missing percentage: {overall_stats['overall_missing_percentage']:.1f}%")
        
        # Enhanced summary with new features
        if 'solar_physics_violations' in results['analysis']:
            violations = results['analysis']['solar_physics_violations']
            print(f"Solar physics violations: {violations['total_violations']}")
        
        if 'weather_correlation' in results['analysis']:
            weather = results['analysis']['weather_correlation']
            if 'total_weather_correlated' in weather:
                print(f"Weather-correlated gaps: {weather['total_weather_correlated']}")
        
        if 'gap_impact_assessment' in results['analysis']:
            impact = results['analysis']['gap_impact_assessment']
            print(f"Overall gap impact: {impact['overall_impact']}")
        
        if 'primary_method' in results['recommendations']:
            print(f"Recommended method: {results['recommendations']['primary_method']}")
        else:
            print(f"Recommended methods: {', '.join(results['recommendations'].get('primary_methods', []))}")


if __name__ == "__main__":
    main()