#!/usr/bin/env python3
"""
Solar Interpolation Engine
Takes gap analysis results and performs the recommended interpolation methods
"""
import pandas as pd
import numpy as np
import argparse
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import warnings
from abc import ABC, abstractmethod
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import MinMaxScaler
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, Matern, WhiteKernel
from scipy import interpolate
import lightgbm as lgb
import boto3
from difflib import get_close_matches
warnings.filterwarnings('ignore')


class InterpolationConfig:
    """Parse and validate gap analysis recommendations"""
    
    def __init__(self, gap_analysis: Dict):
        self.gap_analysis = gap_analysis
        self.recommendations = gap_analysis.get('recommendations', {})
        self.config = self.recommendations.get('configuration', {})
    
    def get_method_config(self, method_name: str) -> Dict:
        """Get configuration for specific method"""
        return self.config.get(method_name, {})
    
    def should_model_independently(self, method_name: str) -> bool:
        """Check if equipment should be modeled independently"""
        method_config = self.get_method_config(method_name)
        return method_config.get('model_equipment_independently', False)
    
    def should_use_correlation(self, method_name: str) -> bool:
        """Check if equipment correlation should be used"""
        method_config = self.get_method_config(method_name)
        return method_config.get('use_equipment_correlation', False)
    
    def get_correlation_features(self, method_name: str) -> List[str]:
        """Get correlation features to add"""
        method_config = self.get_method_config(method_name)
        return method_config.get('correlation_features', [])
    
    def get_solar_constraints(self, method_name: str) -> Dict:
        """Get solar constraint configuration"""
        method_config = self.get_method_config(method_name)
        return method_config.get('solar_constraints', {})
    
    def get_model_parameters(self, method_name: str) -> Dict:
        """Get model parameters"""
        method_config = self.get_method_config(method_name)
        return method_config.get('model_parameters', {})
    
    def get_gap_specific_recommendations(self) -> Dict:
        """Get gap-specific method recommendations"""
        return self.recommendations.get('gap_specific_recommendations', {})
    
    def validate_configuration(self, method_name: str) -> Dict:
        """Validate that configuration is complete and consistent"""
        method_config = self.get_method_config(method_name)
        validation = {
            'valid': True,
            'warnings': [],
            'errors': []
        }
        
        if not method_config:
            validation['valid'] = False
            validation['errors'].append(f"No configuration found for method: {method_name}")
            return validation
        
        # Check for required parameters
        if method_name == 'multi_output_regression':
            required_params = ['model_equipment_independently', 'use_equipment_correlation']
            for param in required_params:
                if param not in method_config:
                    validation['warnings'].append(f"Missing parameter: {param}")
        
        # Check solar constraints
        solar_constraints = method_config.get('solar_constraints', {})
        if not solar_constraints:
            validation['warnings'].append("No solar constraints specified")
        
        return validation


class InterpolationMetrics:
    """Calculate interpolation performance metrics"""
    
    @staticmethod
    def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray, method_name: str) -> Dict:
        """Calculate comprehensive interpolation metrics"""
        
        # Remove any NaN values for metric calculation
        mask = ~(np.isnan(y_true) | np.isnan(y_pred))
        if mask.sum() == 0:
            return {'error': 'No valid data points for metric calculation'}
        
        y_true_clean = y_true[mask]
        y_pred_clean = y_pred[mask]
        
        # Basic metrics
        mae = mean_absolute_error(y_true_clean, y_pred_clean)
        mse = mean_squared_error(y_true_clean, y_pred_clean)
        rmse = np.sqrt(mse)
        
        # R² score
        r2 = r2_score(y_true_clean, y_pred_clean)
        
        # SMAPE (Symmetric Mean Absolute Percentage Error) - handle division by zero
        denominator = np.abs(y_pred_clean) + np.abs(y_true_clean)
        smape_mask = denominator > 1e-8  # Avoid division by very small numbers
        if smape_mask.sum() > 0:
            smape = np.mean(2 * np.abs(y_pred_clean[smape_mask] - y_true_clean[smape_mask]) / 
                           denominator[smape_mask]) * 100
        else:
            smape = 0.0
        
        # MAPE (Mean Absolute Percentage Error) - handle division by zero
        with np.errstate(divide='ignore', invalid='ignore'):
            mape_mask = np.abs(y_true_clean) > 1e-8  # Avoid division by very small numbers
            if mape_mask.sum() > 0:
                mape = np.mean(np.abs((y_true_clean[mape_mask] - y_pred_clean[mape_mask]) / 
                                     np.abs(y_true_clean[mape_mask]))) * 100
            else:
                mape = 0.0
            mape = np.nan_to_num(mape, nan=0.0, posinf=100.0, neginf=100.0)
        
        # Normalized RMSE (NRMSE)
        y_range = np.max(y_true_clean) - np.min(y_true_clean)
        nrmse = (rmse / y_range * 100) if y_range > 0 else 0
        
        # Mean Bias Error (MBE)
        mbe = np.mean(y_pred_clean - y_true_clean)
        
        # Correlation coefficient
        correlation = np.corrcoef(y_true_clean, y_pred_clean)[0, 1] if len(y_true_clean) > 1 else 0
        
        metrics = {
            'method': method_name,
            'samples_used': len(y_true_clean),
            'mae': float(mae),
            'mse': float(mse),
            'rmse': float(rmse),
            'r2_score': float(r2),
            'smape_percent': float(smape),
            'mape_percent': float(mape),
            'nrmse_percent': float(nrmse),
            'mean_bias_error': float(mbe),
            'correlation': float(correlation)
        }
        
        return metrics


class BaseInterpolator(ABC):
    """Abstract base class for all interpolation methods"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.is_fitted = False
        self.metadata = {}
        self.scaler = None
    
    @abstractmethod
    def get_method_name(self) -> str:
        """Return human-readable method name"""
        pass
    
    @abstractmethod
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> 'BaseInterpolator':
        """Fit the interpolator to training data"""
        pass
    
    @abstractmethod
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Perform interpolation on missing values"""
        pass
    
    def apply_solar_constraints(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Apply solar physics constraints"""
        df_result = df.copy()
        
        # Convert time column to datetime
        df_result[time_column] = pd.to_datetime(df_result[time_column])
        df_result['hour'] = df_result[time_column].dt.hour
        
        # Solar constraint: nighttime power = 0
        night_mask = (df_result['hour'] <= 5) | (df_result['hour'] >= 19)
        
        for col in power_columns:
            df_result.loc[night_mask, col] = 0
            # Ensure no negative values
            df_result[col] = df_result[col].clip(lower=0)
        
        # Remove temporary hour column
        df_result = df_result.drop('hour', axis=1)
        
        return df_result
    
    def create_features(self, df: pd.DataFrame, time_column: str, weather_data: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """Create basic features for interpolation"""
        df_features = df.copy()
        
        # Convert to datetime
        df_features[time_column] = pd.to_datetime(df_features[time_column])
        
        # Basic time features
        df_features['hour'] = df_features[time_column].dt.hour
        df_features['day_of_year'] = df_features[time_column].dt.dayofyear
        df_features['month'] = df_features[time_column].dt.month
        df_features['day_of_week'] = df_features[time_column].dt.dayofweek
        df_features['is_weekend'] = df_features['day_of_week'].isin([5, 6]).astype(int)
        
        # Cyclical encoding
        df_features['hour_sin'] = np.sin(2 * np.pi * df_features['hour'] / 24)
        df_features['hour_cos'] = np.cos(2 * np.pi * df_features['hour'] / 24)
        df_features['day_sin'] = np.sin(2 * np.pi * df_features['day_of_year'] / 365)
        df_features['day_cos'] = np.cos(2 * np.pi * df_features['day_of_year'] / 365)
        
        # Add weather features if available
        if weather_data is not None:
            df_features = self._add_weather_features(df_features, time_column, weather_data)
        
        return df_features
    
    def _add_weather_features(self, df: pd.DataFrame, time_column: str, weather_data: pd.DataFrame) -> pd.DataFrame:
        """Add comprehensive weather features to the dataframe"""
        df_weather = df.copy()
        
        # Merge weather data on datetime (include all available weather columns)
        weather_cols = ['datetime', 'temperature', 'humidity', 'wind_speed', 'cloud_cover', 
                       'solar_radiation', 'solar_energy', 'uv_index']
        available_cols = [col for col in weather_cols if col in weather_data.columns]
        
        df_weather = df_weather.merge(
            weather_data[available_cols], 
            left_on=time_column, 
            right_on='datetime', 
            how='left'
        )
        
        # Fill missing weather data with forward/backward fill
        weather_data_cols = [col for col in available_cols if col != 'datetime']
        for col in weather_data_cols:
            df_weather[col] = df_weather[col].fillna(method='ffill').fillna(method='bfill')
        
        # 1. Basic weather features
        df_weather['temp_effect'] = np.maximum(0, 1 - (df_weather['temperature'] - 25) * 0.004)  # Temperature derating
        df_weather['cloud_effect'] = np.maximum(0, 1 - df_weather['cloud_cover'] / 100)  # Cloud impact
        df_weather['wind_cooling'] = np.minimum(1, df_weather['wind_speed'] / 10)  # Wind cooling effect
        
        # 2. Advanced solar physics features
        if 'solar_radiation' in df_weather.columns:
            # Panel temperature modeling (realistic physics-based)
            solar_heating = df_weather['solar_radiation'] * 0.03  # Solar heating coefficient
            wind_cooling = df_weather['wind_speed'] * 0.15  # Realistic convective cooling coefficient
            
            # Calculate raw panel temperature
            df_weather['panel_temp'] = df_weather['temperature'] + solar_heating - wind_cooling
            
            # Physical constraints: panels can't be colder than ambient air
            df_weather['panel_temp'] = np.maximum(df_weather['panel_temp'], df_weather['temperature'])
            
            # Additional safety: cap maximum cooling effect at 10°C below ambient
            max_cooling = 10.0
            df_weather['panel_temp'] = np.maximum(df_weather['panel_temp'], df_weather['temperature'] - max_cooling)
            
            df_weather['temp_efficiency'] = np.maximum(0.7, 1 - (df_weather['panel_temp'] - 25) * 0.0045)  # Panel efficiency
            
            # Effective irradiance (adjusted for atmospheric conditions)
            df_weather['effective_irradiance'] = df_weather['solar_radiation'] * df_weather['cloud_effect']
            df_weather['effective_irradiance'] = df_weather['effective_irradiance'] * (1 - df_weather['humidity'] / 1000)  # Humidity impact
            
            # Solar intensity features
            df_weather['solar_intensity'] = df_weather['solar_radiation'] / 1000  # Normalize to 0-1
            df_weather['solar_potential'] = df_weather['solar_radiation'] * df_weather['temp_efficiency']
        
        # 3. Weather pattern features
        # Rolling weather statistics (3-hour windows) - fill NaN values
        for col in ['temperature', 'humidity', 'wind_speed', 'cloud_cover']:
            if col in df_weather.columns:
                df_weather[f'{col}_3h_mean'] = df_weather[col].rolling(window=3, center=True).mean().fillna(df_weather[col])
                df_weather[f'{col}_3h_std'] = df_weather[col].rolling(window=3, center=True).std().fillna(0)
                df_weather[f'{col}_3h_max'] = df_weather[col].rolling(window=3, center=True).max().fillna(df_weather[col])
                df_weather[f'{col}_3h_min'] = df_weather[col].rolling(window=3, center=True).min().fillna(df_weather[col])
        
        # Weather persistence (how long conditions last) - fill NaN values
        df_weather['weather_change'] = 0
        if 'cloud_cover' in df_weather.columns:
            df_weather['cloud_change'] = df_weather['cloud_cover'].diff().abs().fillna(0)
            df_weather['weather_change'] = df_weather['weather_change'] + (df_weather['cloud_change'] > 20).astype(int)
        
        if 'temperature' in df_weather.columns:
            df_weather['temp_change'] = df_weather['temperature'].diff().abs().fillna(0)
            df_weather['weather_change'] = df_weather['weather_change'] + (df_weather['temp_change'] > 2).astype(int)
        
        # 4. Solar-weather interactions
        if 'solar_radiation' in df_weather.columns:
            # Weather lag effects (weather impact on solar generation) - fill NaN values
            df_weather['weather_lag_1h'] = df_weather['cloud_cover'].shift(1).fillna(df_weather['cloud_cover']) if 'cloud_cover' in df_weather.columns else 0
            df_weather['weather_lag_2h'] = df_weather['cloud_cover'].shift(2).fillna(df_weather['cloud_cover']) if 'cloud_cover' in df_weather.columns else 0
            
            # Solar generation potential
            df_weather['solar_potential'] = df_weather['solar_radiation'] * df_weather['temp_efficiency'] * df_weather['cloud_effect']
            
            # Weather-solar correlation features
            df_weather['weather_solar_ratio'] = df_weather['solar_radiation'] / (df_weather['cloud_cover'] + 1)  # Avoid division by zero
        
        # 5. Seasonal weather patterns
        df_weather['season'] = ((df_weather['month'] % 12 + 3) // 3).astype(int)  # 1=Winter, 2=Spring, 3=Summer, 4=Fall
        df_weather['is_summer'] = (df_weather['season'] == 3).astype(int)
        df_weather['is_winter'] = (df_weather['season'] == 1).astype(int)
        
        # Seasonal weather adjustments
        if 'temperature' in df_weather.columns:
            df_weather['temp_seasonal'] = df_weather['temperature'] * df_weather['is_summer']  # Summer temperature effect
            df_weather['temp_winter'] = df_weather['temperature'] * df_weather['is_winter']  # Winter temperature effect
        
        # Remove the extra datetime column
        df_weather = df_weather.drop('datetime', axis=1)
        
        return df_weather


class SplineInterpolator(BaseInterpolator):
    """Spline-based interpolation for short gaps"""
    
    def get_method_name(self) -> str:
        return "Cubic Spline Interpolation"
    
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> 'SplineInterpolator':
        """Splines don't require fitting"""
        self.is_fitted = True
        self.metadata = {
            'method': 'cubic_spline',
            'interpolation_order': 3,
            'extrapolation': 'constant'
        }
        return self
    
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Perform spline interpolation"""
        df_result = df.copy()
        
        # Convert time to numeric for interpolation
        df_result[time_column] = pd.to_datetime(df_result[time_column])
        time_numeric = pd.to_numeric(df_result[time_column])
        
        for col in power_columns:
            if col in df_result.columns:
                # Get non-missing values
                mask = df_result[col].notna()
                
                if mask.sum() > 3:  # Need at least 4 points for cubic spline
                    # Create spline interpolator
                    spline = interpolate.interp1d(
                        time_numeric[mask], 
                        df_result[col][mask], 
                        kind='cubic',
                        fill_value='extrapolate',
                        bounds_error=False
                    )
                    
                    # Fill missing values
                    missing_mask = df_result[col].isna()
                    if missing_mask.any():
                        df_result.loc[missing_mask, col] = spline(time_numeric[missing_mask])
        
        # Apply solar constraints
        df_result = self.apply_solar_constraints(df_result, power_columns, time_column)
        
        return df_result


class GaussianProcessInterpolator(BaseInterpolator):
    """Gaussian Process interpolation for medium gaps"""
    
    def __init__(self, config: Optional[Dict] = None):
        super().__init__(config)
        self.gp_models = {}
    
    def get_method_name(self) -> str:
        return "Gaussian Process Regression"
    
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> 'GaussianProcessInterpolator':
        """Fit GP models for each power column"""
        
        # Create features
        df_features = self.create_features(df, time_column)
        
        feature_cols = ['hour', 'day_of_year', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        
        for col in power_columns:
            if col in df_features.columns:
                # Get complete cases
                complete_mask = df_features[col].notna()
                
                if complete_mask.sum() > 10:  # Need sufficient data
                    X_train = df_features.loc[complete_mask, feature_cols]
                    y_train = df_features.loc[complete_mask, col]
                    
                    # Configure kernel
                    kernel = (RBF(length_scale=10.0) * 
                             Matern(length_scale=5.0, nu=1.5) + 
                             WhiteKernel(noise_level=1e-2))
                    
                    # Fit GP model
                    gp = GaussianProcessRegressor(
                        kernel=kernel,
                        alpha=1e-6,
                        n_restarts_optimizer=3,
                        random_state=42
                    )
                    
                    # Scale features
                    scaler = MinMaxScaler()
                    X_train_scaled = scaler.fit_transform(X_train)
                    
                    gp.fit(X_train_scaled, y_train)
                    
                    self.gp_models[col] = {
                        'model': gp,
                        'scaler': scaler,
                        'feature_cols': feature_cols
                    }
        
        self.is_fitted = True
        self.metadata = {
            'method': 'gaussian_process',
            'models_trained': len(self.gp_models),
            'kernel_type': 'RBF + Matern + WhiteNoise'
        }
        
        return self
    
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Perform GP interpolation"""
        if not self.is_fitted:
            raise ValueError("Must call fit() before interpolate()")
        
        df_result = df.copy()
        df_features = self.create_features(df_result, time_column)
        
        for col in power_columns:
            if col in self.gp_models and col in df_features.columns:
                model_info = self.gp_models[col]
                gp_model = model_info['model']
                scaler = model_info['scaler']
                feature_cols = model_info['feature_cols']
                
                # Find missing values
                missing_mask = df_features[col].isna()
                
                if missing_mask.any():
                    # Prepare features for missing values
                    X_missing = df_features.loc[missing_mask, feature_cols]
                    X_missing_scaled = scaler.transform(X_missing)
                    
                    # Predict
                    y_pred, y_std = gp_model.predict(X_missing_scaled, return_std=True)
                    
                    # Fill missing values
                    df_result.loc[missing_mask, col] = y_pred
        
        # Apply solar constraints
        df_result = self.apply_solar_constraints(df_result, power_columns, time_column)
        
        return df_result


class PhysicsBasedInterpolator(BaseInterpolator):
    """Physics-based solar interpolation"""
    
    def __init__(self, config: Optional[Dict] = None):
        super().__init__(config)
        self.system_parameters = {}
    
    def get_method_name(self) -> str:
        return "Physics-Based Solar Model"
    
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> 'PhysicsBasedInterpolator':
        """Estimate system parameters from available data"""
        
        df_temp = df.copy()
        df_temp[time_column] = pd.to_datetime(df_temp[time_column])
        df_temp['hour'] = df_temp[time_column].dt.hour
        
        for col in power_columns:
            if col in df_temp.columns:
                # Estimate maximum capacity (peak power during good conditions)
                daytime_mask = (df_temp['hour'] >= 6) & (df_temp['hour'] <= 18)
                daytime_data = df_temp.loc[daytime_mask, col].dropna()
                
                if len(daytime_data) > 0:
                    self.system_parameters[col] = {
                        'max_capacity': float(daytime_data.quantile(0.95)),
                        'mean_daytime': float(daytime_data.mean()),
                        'peak_hour': int(daytime_data.idxmax() if len(daytime_data) > 0 else 12)
                    }
        
        self.is_fitted = True
        self.metadata = {
            'method': 'physics_based',
            'estimated_parameters': len(self.system_parameters)
        }
        
        return self
    
    def calculate_theoretical_solar_curve(self, hours: np.ndarray, max_capacity: float, peak_hour: int = 12) -> np.ndarray:
        """Calculate theoretical solar power curve"""
        # Simple solar curve model (bell curve centered at solar noon)
        power = np.zeros_like(hours, dtype=float)
        
        # Daytime hours (6 AM to 6 PM)
        daytime_mask = (hours >= 6) & (hours <= 18)
        
        if daytime_mask.any():
            # Bell curve for solar generation
            daytime_hours = hours[daytime_mask]
            # Normalize to [-π/2, π/2] range around peak_hour
            normalized_hours = (daytime_hours - peak_hour) * np.pi / 6
            power[daytime_mask] = max_capacity * np.maximum(0, np.cos(normalized_hours))
        
        return power
    
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Perform physics-based interpolation"""
        if not self.is_fitted:
            raise ValueError("Must call fit() before interpolate()")
        
        df_result = df.copy()
        df_result[time_column] = pd.to_datetime(df_result[time_column])
        df_result['hour'] = df_result[time_column].dt.hour
        
        for col in power_columns:
            if col in self.system_parameters and col in df_result.columns:
                params = self.system_parameters[col]
                
                # Find missing values
                missing_mask = df_result[col].isna()
                
                if missing_mask.any():
                    # Calculate theoretical curve for missing hours
                    missing_hours = df_result.loc[missing_mask, 'hour'].values
                    theoretical_power = self.calculate_theoretical_solar_curve(
                        missing_hours, 
                        params['max_capacity'],
                        params.get('peak_hour', 12)
                    )
                    
                    # Fill missing values
                    df_result.loc[missing_mask, col] = theoretical_power
        
        # Remove temporary hour column
        df_result = df_result.drop('hour', axis=1)
        
        # Apply solar constraints
        df_result = self.apply_solar_constraints(df_result, power_columns, time_column)
        
        return df_result


class MultiOutputRegressionInterpolator(BaseInterpolator):
    """Multi-output regression for correlated equipment"""
    
    def __init__(self, config: Optional[Dict] = None, interpolation_config: Optional[InterpolationConfig] = None):
        super().__init__(config)
        self.interp_config = interpolation_config
        self.model = None
        self.feature_columns = None
        self.scaler_X = None
        self.scaler_y = None
    
    def get_method_name(self) -> str:
        return "Multi-Output LightGBM Regression"
    
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str, weather_data: Optional[pd.DataFrame] = None) -> 'MultiOutputRegressionInterpolator':
        """Adaptive fitting based on gap analysis recommendations"""
        
        # Get method-specific configuration
        method_config = self.interp_config.get_method_config('multi_output_regression') if self.interp_config else {}
        
        # Decision 1: Model independently or together?
        model_independently = method_config.get('model_equipment_independently', True)
        use_correlation = method_config.get('use_equipment_correlation', False)
        
        if model_independently and use_correlation:
            # Train separate models but add cross-equipment features
            self._fit_independent_with_correlation(df, power_columns, time_column, weather_data, method_config)
        elif model_independently:
            # Train completely separate models
            self._fit_independent_models(df, power_columns, time_column, weather_data, method_config)
        else:
            # Train single multi-output model
            self._fit_multi_output_model(df, power_columns, time_column, weather_data, method_config)
        
        return self
    
    def _fit_independent_with_correlation(self, df: pd.DataFrame, power_columns: List[str], 
                                        time_column: str, weather_data: Optional[pd.DataFrame], 
                                        method_config: Dict):
        """Train independent models with PROPER correlation features (no data leakage)"""
        
        # Create base features
        df_features = self.create_features(df, time_column, weather_data)
        
        # Train individual models with proper correlation features
        self.model = {}
        model_params = method_config.get('model_parameters', {})
        correlation_features = method_config.get('correlation_features', power_columns)
        
        for target_col in power_columns:
            print(f"Training model for {target_col}...")
            
            # Get rows where target column has data
            target_complete_mask = df_features[target_col].notna()
            
            if target_complete_mask.sum() < 50:
                print(f"Insufficient data for {target_col}, skipping...")
                continue
            
            # Create correlation features ONLY from other equipment that has data at same time
            df_with_correlation = df_features.copy()
            
            for corr_col in correlation_features:
                if corr_col != target_col and corr_col in df_features.columns:
                    
                    # SAFE CORRELATION FEATURES:
                    # 1. Historical correlation (only past data, no leakage)
                    df_with_correlation[f'{corr_col}_hist_1h'] = df_features[corr_col].shift(1).fillna(0)
                    df_with_correlation[f'{corr_col}_hist_2h'] = df_features[corr_col].shift(2).fillna(0)
                    df_with_correlation[f'{corr_col}_hist_3h'] = df_features[corr_col].shift(3).fillna(0)
                    
                    # 2. Historical rolling statistics (backward-looking only)
                    df_with_correlation[f'{corr_col}_hist_mean_6h'] = (
                        df_features[corr_col].shift(1).rolling(window=6, min_periods=1).mean().fillna(0)
                    )
                    df_with_correlation[f'{corr_col}_hist_std_6h'] = (
                        df_features[corr_col].shift(1).rolling(window=6, min_periods=1).std().fillna(0)
                    )
                    
                    # 3. Equipment availability indicator (no leakage)
                    df_with_correlation[f'{corr_col}_available'] = (~df_features[corr_col].isna()).astype(int)
                    df_with_correlation[f'{corr_col}_available_lag1'] = df_with_correlation[f'{corr_col}_available'].shift(1).fillna(0)
            
            # Select training data (only where target is available)
            train_mask = target_complete_mask
            
            # Compute correlation strength features on training data only
            correlation_strengths = {}
            for corr_col in correlation_features:
                if corr_col != target_col and corr_col in df_features.columns:
                    # Calculate correlation on training data
                    train_data = df_features.loc[train_mask, [target_col, corr_col]].dropna()
                    if len(train_data) > 10:
                        correlation_strength = abs(train_data[target_col].corr(train_data[corr_col]))
                        correlation_strengths[corr_col] = correlation_strength
                        # Add as constant feature
                        df_with_correlation[f'{corr_col}_correlation_strength'] = correlation_strength
                    else:
                        correlation_strengths[corr_col] = 0.0
                        df_with_correlation[f'{corr_col}_correlation_strength'] = 0.0
            
            # Get feature columns (exclude all target power columns to prevent leakage)
            feature_cols = self._get_safe_feature_columns(df_with_correlation, exclude=power_columns)
            
            # Prepare training data
            X_train = df_with_correlation.loc[train_mask, feature_cols]
            y_train = df_features.loc[train_mask, target_col]
            
            # Remove any remaining NaN values
            train_clean_mask = ~(X_train.isna().any(axis=1) | y_train.isna())
            if train_clean_mask.sum() < 50:
                print(f"Insufficient clean training data for {target_col}, skipping...")
                continue
                
            X_train_clean = X_train.loc[train_clean_mask]
            y_train_clean = y_train.loc[train_clean_mask]
            
            # Scale features
            scaler = MinMaxScaler()
            X_train_scaled = scaler.fit_transform(X_train_clean)
            
            # Train model
            lgb_model = lgb.LGBMRegressor(
                n_estimators=model_params.get('n_estimators', 200),
                learning_rate=model_params.get('learning_rate', 0.1),
                max_depth=model_params.get('max_depth', 6),
                feature_fraction=model_params.get('feature_fraction', 0.9),
                random_state=model_params.get('random_state', 42),
                verbose=-1
            )
            
            lgb_model.fit(X_train_scaled, y_train_clean)
            
            self.model[target_col] = {
                'model': lgb_model,
                'scaler': scaler,
                'feature_cols': feature_cols,
                'correlation_strengths': correlation_strengths
            }
            
            print(f"Model for {target_col} trained with {len(feature_cols)} features on {len(y_train_clean)} samples")
        
        self.is_fitted = True
        self.metadata = {
            'method': 'multi_output_lgb_with_safe_correlation',
            'models_trained': len(self.model),
            'correlation_features_used': True,
            'leakage_prevention': 'historical_features_only'
        }
    
    def _fit_independent_models(self, df: pd.DataFrame, power_columns: List[str], 
                              time_column: str, weather_data: Optional[pd.DataFrame], 
                              method_config: Dict):
        """Train completely separate models (original behavior)"""
        
        # Create features
        df_features = self.create_features(df, time_column, weather_data)
        
        # Feature columns (include weather if available)
        self.feature_columns = ['hour', 'day_of_year', 'month', 'day_of_week', 'is_weekend',
                               'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        
        # Add weather features if available
        if weather_data is not None:
            # Basic weather features
            basic_weather = ['temperature', 'humidity', 'wind_speed', 'cloud_cover', 'solar_radiation', 'solar_energy', 'uv_index']
            basic_weather = [col for col in basic_weather if col in df_features.columns]
            
            # Derived weather features
            derived_weather = ['temp_effect', 'cloud_effect', 'wind_cooling', 'panel_temp', 'temp_efficiency',
                             'effective_irradiance', 'solar_intensity', 'solar_potential', 'weather_change',
                             'weather_lag_1h', 'weather_lag_2h', 'weather_solar_ratio', 'season', 'is_summer', 'is_winter',
                             'temp_seasonal', 'temp_winter']
            derived_weather = [col for col in derived_weather if col in df_features.columns]
            
            # Rolling weather statistics
            rolling_weather = []
            for base_col in ['temperature', 'humidity', 'wind_speed', 'cloud_cover']:
                if base_col in df_features.columns:
                    rolling_weather.extend([f'{base_col}_3h_mean', f'{base_col}_3h_std', f'{base_col}_3h_max', f'{base_col}_3h_min'])
            rolling_weather = [col for col in rolling_weather if col in df_features.columns]
            
            # Add all weather features
            self.feature_columns.extend(basic_weather + derived_weather + rolling_weather)
        
        # Get complete cases (all power columns have values)
        complete_mask = df_features[power_columns].notna().all(axis=1)
        
        if complete_mask.sum() > 100:  # Need sufficient training data
            X_train = df_features.loc[complete_mask, self.feature_columns]
            y_train = df_features.loc[complete_mask, power_columns]
            
            # Scale features
            self.scaler_X = MinMaxScaler()
            self.scaler_y = MinMaxScaler()
            
            X_train_scaled = self.scaler_X.fit_transform(X_train)
            y_train_scaled = self.scaler_y.fit_transform(y_train)
            
            # Train LightGBM model for each target
            self.model = {}
            for i, col in enumerate(power_columns):
                lgb_model = lgb.LGBMRegressor(
                    n_estimators=200,
                    learning_rate=0.1,
                    max_depth=6,
                    random_state=42,
                    verbose=-1
                )
                lgb_model.fit(X_train_scaled, y_train_scaled[:, i])
                self.model[col] = lgb_model
        
        self.is_fitted = True
        self.metadata = {
            'method': 'multi_output_lgb',
            'models_trained': len(self.model) if self.model else 0,
            'training_samples': complete_mask.sum() if 'complete_mask' in locals() else 0
        }
        
        return self
    
    def _get_feature_columns(self, df_features: pd.DataFrame, exclude: List[str] = None) -> List[str]:
        """Get feature columns excluding specified columns"""
        exclude = exclude or []
        feature_cols = []
        
        for col in df_features.columns:
            if col not in exclude and col not in ['Time', 'datetime']:
                # Check if it's a numeric column
                if pd.api.types.is_numeric_dtype(df_features[col]):
                    feature_cols.append(col)
        
        return feature_cols
    
    def _get_safe_feature_columns(self, df_features: pd.DataFrame, exclude: List[str] = None) -> List[str]:
        """Get feature columns excluding power columns to prevent data leakage"""
        exclude = exclude or []
        feature_cols = []
        
        for col in df_features.columns:
            if col not in exclude and col not in ['Time', 'datetime']:
                # Only include numeric columns that are NOT target power columns
                if pd.api.types.is_numeric_dtype(df_features[col]):
                    # Additional safety: exclude any column that looks like a power measurement
                    if not any(power_col in col for power_col in exclude if isinstance(power_col, str)):
                        feature_cols.append(col)
        
        return feature_cols
    
    def _fit_multi_output_model(self, df: pd.DataFrame, power_columns: List[str], 
                               time_column: str, weather_data: Optional[pd.DataFrame], 
                               method_config: Dict):
        """Train single multi-output model"""
        # Create features
        df_features = self.create_features(df, time_column, weather_data)
        
        # Feature columns (include weather if available)
        self.feature_columns = ['hour', 'day_of_year', 'month', 'day_of_week', 'is_weekend',
                               'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        
        # Add weather features if available
        if weather_data is not None:
            # Basic weather features
            basic_weather = ['temperature', 'humidity', 'wind_speed', 'cloud_cover', 'solar_radiation', 'solar_energy', 'uv_index']
            basic_weather = [col for col in basic_weather if col in df_features.columns]
            
            # Derived weather features
            derived_weather = ['temp_effect', 'cloud_effect', 'wind_cooling', 'panel_temp', 'temp_efficiency',
                             'effective_irradiance', 'solar_intensity', 'solar_potential', 'weather_change',
                             'weather_lag_1h', 'weather_lag_2h', 'weather_solar_ratio', 'season', 'is_summer', 'is_winter',
                             'temp_seasonal', 'temp_winter']
            derived_weather = [col for col in derived_weather if col in df_features.columns]
            
            # Rolling weather statistics
            rolling_weather = []
            for base_col in ['temperature', 'humidity', 'wind_speed', 'cloud_cover']:
                if base_col in df_features.columns:
                    rolling_weather.extend([f'{base_col}_3h_mean', f'{base_col}_3h_std', f'{base_col}_3h_max', f'{base_col}_3h_min'])
            rolling_weather = [col for col in rolling_weather if col in df_features.columns]
            
            # Add all weather features
            self.feature_columns.extend(basic_weather + derived_weather + rolling_weather)
        
        # Get complete cases (all power columns have values)
        complete_mask = df_features[power_columns].notna().all(axis=1)
        
        if complete_mask.sum() > 100:  # Need sufficient training data
            X_train = df_features.loc[complete_mask, self.feature_columns]
            y_train = df_features.loc[complete_mask, power_columns]
            
            # Scale features
            self.scaler_X = MinMaxScaler()
            self.scaler_y = MinMaxScaler()
            
            X_train_scaled = self.scaler_X.fit_transform(X_train)
            y_train_scaled = self.scaler_y.fit_transform(y_train)
            
            # Train single LightGBM model for all outputs
            model_params = method_config.get('model_parameters', {})
            self.model = lgb.LGBMRegressor(
                n_estimators=model_params.get('n_estimators', 200),
                learning_rate=model_params.get('learning_rate', 0.1),
                max_depth=model_params.get('max_depth', 6),
                feature_fraction=model_params.get('feature_fraction', 0.9),
                random_state=model_params.get('random_state', 42),
                verbose=-1
            )
            self.model.fit(X_train_scaled, y_train_scaled)
        
        self.is_fitted = True
        self.metadata = {
            'method': 'multi_output_lgb_single_model',
            'models_trained': 1,
            'training_samples': complete_mask.sum() if 'complete_mask' in locals() else 0
        }
    
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str, weather_data: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """Perform multi-output interpolation"""
        if not self.is_fitted or not self.model:
            # Fallback to spline interpolation if model training failed
            spline_interpolator = SplineInterpolator()
            spline_interpolator.fit(df, power_columns, time_column, weather_data)
            return spline_interpolator.interpolate(df, power_columns, time_column, weather_data)
        
        df_result = df.copy()
        df_features = self.create_features(df_result, time_column, weather_data)
        
        # Add SAFE correlation features if this was used during training
        if (self.interp_config and 
            self.interp_config.should_use_correlation('multi_output_regression') and
            self.interp_config.should_model_independently('multi_output_regression')):
            
            correlation_features = self.interp_config.get_correlation_features('multi_output_regression')
            if not correlation_features:
                correlation_features = power_columns
            
            # Create the same safe correlation features used in training
            for target_col in power_columns:
                for corr_col in correlation_features:
                    if corr_col != target_col and corr_col in df_features.columns:
                        # Historical features only (no leakage)
                        df_features[f'{corr_col}_hist_1h'] = df_features[corr_col].shift(1).fillna(0)
                        df_features[f'{corr_col}_hist_2h'] = df_features[corr_col].shift(2).fillna(0)
                        df_features[f'{corr_col}_hist_3h'] = df_features[corr_col].shift(3).fillna(0)
                        
                        # Historical statistics
                        df_features[f'{corr_col}_hist_mean_6h'] = (
                            df_features[corr_col].shift(1).rolling(window=6, min_periods=1).mean().fillna(0)
                        )
                        df_features[f'{corr_col}_hist_std_6h'] = (
                            df_features[corr_col].shift(1).rolling(window=6, min_periods=1).std().fillna(0)
                        )
                        
                        # Availability indicators
                        df_features[f'{corr_col}_available'] = (~df_features[corr_col].isna()).astype(int)
                        df_features[f'{corr_col}_available_lag1'] = df_features[f'{corr_col}_available'].shift(1).fillna(0)
                        
                        # Correlation strength (constant from training)
                        if target_col in self.model and 'correlation_strengths' in self.model[target_col]:
                            correlation_strength = self.model[target_col]['correlation_strengths'].get(corr_col, 0.0)
                            df_features[f'{corr_col}_correlation_strength'] = correlation_strength
                        else:
                            df_features[f'{corr_col}_correlation_strength'] = 0.0
        
        # Find rows with any missing values
        missing_mask = df_features[power_columns].isna().any(axis=1)
        
        if missing_mask.any():
            # Handle different model types
            if isinstance(self.model, dict):
                # Check if models are stored as dictionaries (new adaptive method) or direct models (original method)
                sample_model = list(self.model.values())[0]
                if isinstance(sample_model, dict):
                    # Independent models with correlation (new adaptive method)
                    for col in power_columns:
                        if col in self.model:
                            # Find missing values for this specific column
                            col_missing_mask = df_features[col].isna()
                            
                            if col_missing_mask.any():
                                model_info = self.model[col]
                                feature_cols = model_info['feature_cols']
                                
                                # Prepare features for missing values
                                X_missing = df_features.loc[col_missing_mask, feature_cols]
                                
                                # Handle any remaining NaN in features
                                X_missing = X_missing.fillna(0)
                                
                                # Scale and predict
                                X_missing_scaled = model_info['scaler'].transform(X_missing)
                                predictions = model_info['model'].predict(X_missing_scaled)
                                
                                # Fill missing values
                                df_result.loc[col_missing_mask, col] = predictions
                                
                                print(f"Filled {col_missing_mask.sum()} missing values for {col}")
                else:
                    # Original independent models (no configuration)
                    X_missing = df_features.loc[missing_mask, self.feature_columns]
                    X_missing_scaled = self.scaler_X.transform(X_missing)
                    
                    # Predict each column
                    predictions = np.zeros((missing_mask.sum(), len(power_columns)))
                    for i, col in enumerate(power_columns):
                        if col in self.model:
                            predictions[:, i] = self.model[col].predict(X_missing_scaled)
                    
                    # Inverse transform predictions
                    predictions_unscaled = self.scaler_y.inverse_transform(predictions)
                    
                    # Fill missing values
                    for i, col in enumerate(power_columns):
                        col_missing_mask = df_features.loc[missing_mask, col].isna()
                        if col_missing_mask.any():
                            df_result.loc[missing_mask & df_features[col].isna(), col] = predictions_unscaled[col_missing_mask, i]
            else:
                # Single multi-output model (original method)
                X_missing = df_features.loc[missing_mask, self.feature_columns]
                X_missing_scaled = self.scaler_X.transform(X_missing)
                
                # Predict each column
                predictions = np.zeros((missing_mask.sum(), len(power_columns)))
                for i, col in enumerate(power_columns):
                    if col in self.model:
                        predictions[:, i] = self.model[col].predict(X_missing_scaled)
                
                # Inverse transform predictions
                predictions_unscaled = self.scaler_y.inverse_transform(predictions)
                
                # Fill missing values
                for i, col in enumerate(power_columns):
                    col_missing_mask = df_features.loc[missing_mask, col].isna()
                    if col_missing_mask.any():
                        df_result.loc[missing_mask & df_features[col].isna(), col] = predictions_unscaled[col_missing_mask, i]
        
        # Apply solar constraints based on configuration
        if self.interp_config:
            df_result = self.apply_configuration_solar_constraints(df_result, power_columns, time_column)
        else:
            df_result = self.apply_solar_constraints(df_result, power_columns, time_column)
        
        return df_result
    
    def apply_configuration_solar_constraints(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Apply solar constraints based on gap analysis recommendations"""
        
        # Get constraint configuration
        constraints = self.interp_config.get_solar_constraints('multi_output_regression')
        
        df_result = df.copy()
        df_result[time_column] = pd.to_datetime(df_result[time_column])
        df_result['hour'] = df_result[time_column].dt.hour
        
        for col in power_columns:
            # Apply nighttime constraint if recommended
            if constraints.get('nighttime_zero', True):
                night_mask = (df_result['hour'] <= 5) | (df_result['hour'] >= 19)
                df_result.loc[night_mask, col] = 0
            
            # Apply negative clipping if recommended
            if constraints.get('negative_clipping', True):
                df_result[col] = df_result[col].clip(lower=0)
            
            # Apply max power limits if specified
            max_power_limits = constraints.get('max_power_limits', {})
            if col in max_power_limits:
                df_result[col] = df_result[col].clip(upper=max_power_limits[col])
            
            # Apply max efficiency constraint if specified
            max_efficiency = constraints.get('max_efficiency', 1.0)
            if max_efficiency < 1.0:
                # Scale down predictions by efficiency factor
                df_result[col] = df_result[col] * max_efficiency
        
        df_result = df_result.drop('hour', axis=1)
        return df_result


class InterpolationEngine:
    """Main engine for running interpolation methods"""
    
    def __init__(self):
        self.interpolators = {
            'spline_interpolation': SplineInterpolator,
            'gaussian_process': GaussianProcessInterpolator,
            'physics_based_model': PhysicsBasedInterpolator,
            'multi_output_regression': MultiOutputRegressionInterpolator,
            'system_level_interpolation': MultiOutputRegressionInterpolator,  # Alias
            'degradation_aware_interpolation': GaussianProcessInterpolator,   # Fallback
            'maintenance_aware_interpolation': PhysicsBasedInterpolator,      # Fallback
            'equipment_specific_interpolation': SplineInterpolator           # Fallback
        }
        self.s3_client = boto3.client('s3')
        self.weather_data = None
    
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
    
    def load_gap_analysis(self, gap_analysis_file: str) -> Dict:
        """Load gap analysis results"""
        try:
            with open(gap_analysis_file, 'r') as f:
                if gap_analysis_file.endswith('.json'):
                    return json.load(f)
                else:
                    # Try to parse as JSON anyway
                    content = f.read()
                    return json.loads(content)
        except Exception as e:
            raise ValueError(f"Could not load gap analysis file: {e}")
    
    def extract_data_structure(self, gap_analysis: Dict) -> Dict:
        """Extract data structure information from gap analysis"""
        structure = gap_analysis.get('structure', {})
        
        return {
            'time_column': structure.get('time_column'),
            'power_columns': structure.get('power_columns', []),
            'time_frequency': structure.get('time_frequency'),
            'total_rows': structure.get('total_rows'),
        }
    
    def get_recommended_method(self, gap_analysis: Dict, user_method: Optional[str] = None) -> str:
        """Get recommended interpolation method"""
        if user_method:
            return user_method
        
        recommendations = gap_analysis.get('recommendations', {})
        
        # Try different possible keys for recommendations
        method = (recommendations.get('primary_method') or 
                 recommendations.get('primary_methods', ['spline_interpolation'])[0] if 
                 isinstance(recommendations.get('primary_methods'), list) else
                 'spline_interpolation')
        
        return method
    
    def create_validation_split(self, df: pd.DataFrame, power_columns: List[str], 
                              validation_ratio: float = 0.15) -> Tuple[pd.DataFrame, Dict]:
        """Create validation split by artificially removing some data"""
        df_validation = df.copy()
        
        # Find complete rows (all power columns have data)
        complete_mask = df[power_columns].notna().all(axis=1)
        complete_indices = df[complete_mask].index.tolist()
        
        if len(complete_indices) < 20:
            return df_validation, {'error': 'Insufficient complete data for validation'}
        
        # Randomly select validation indices
        np.random.seed(42)  # For reproducibility
        n_validation = max(10, int(len(complete_indices) * validation_ratio))
        validation_indices = np.random.choice(complete_indices, size=n_validation, replace=False)
        
        # Store original values
        validation_data = {}
        for col in power_columns:
            validation_data[col] = df.loc[validation_indices, col].copy()
        
        # Remove values for validation
        for col in power_columns:
            df_validation.loc[validation_indices, col] = np.nan
        
        validation_info = {
            'validation_indices': validation_indices.tolist(),
            'validation_data': validation_data,
            'n_validation_points': len(validation_indices)
        }
        
        return df_validation, validation_info
    
    def run_interpolation(self, data_file: str, gap_analysis_file: str, 
                         method_name: Optional[str] = None, 
                         output_dir: str = 'output',
                         validate: bool = True,
                         city_name: Optional[str] = None) -> Dict:
        """Run interpolation and return results"""
        
        print(f"Loading data from {data_file}")
        df = pd.read_csv(data_file)
        
        print(f"Loading gap analysis from {gap_analysis_file}")
        gap_analysis = self.load_gap_analysis(gap_analysis_file)
        
        # Load weather data if city specified
        if city_name:
            print(f"Loading weather data for {city_name}...")
            self.weather_data = self._load_weather_data(city_name)
        else:
            print("No city specified - interpolation will use time features only")
        
        # Extract structure
        structure = self.extract_data_structure(gap_analysis)
        time_column = structure['time_column']
        power_columns = structure['power_columns']
        
        if not time_column or not power_columns:
            raise ValueError("Could not extract data structure from gap analysis")
        
        print(f"Data structure:")
        print(f"  Time column: {time_column}")
        print(f"  Power columns: {power_columns}")
        
        # Get method
        method = self.get_recommended_method(gap_analysis, method_name)
        print(f"Using interpolation method: {method}")
        
        if method not in self.interpolators:
            raise ValueError(f"Unknown interpolation method: {method}")
        
        # Create output directory
        Path(output_dir).mkdir(exist_ok=True)
        
        results = {
            'method_used': method,
            'data_structure': structure,
            'metrics': {},
            'files_created': []
        }
        
        # Validation
        if validate:
            print("Creating validation split...")
            df_val, validation_info = self.create_validation_split(df, power_columns)
            
            if 'error' not in validation_info:
                # Train on validation data
                print("Training interpolator...")
                interpolator_class = self.interpolators[method]
                
                # Create configuration parser for validation
                interp_config = InterpolationConfig(gap_analysis)
                
                # Create interpolator with configuration
                interpolator = interpolator_class(interpolation_config=interp_config)
                interpolator.fit(df_val, power_columns, time_column, self.weather_data)
                
                # Interpolate validation data
                print("Performing interpolation...")
                df_interpolated = interpolator.interpolate(df_val, power_columns, time_column, self.weather_data)
                
                # Calculate metrics
                print("Calculating validation metrics...")
                validation_metrics = {}
                for col in power_columns:
                    if col in validation_info['validation_data']:
                        y_true = validation_info['validation_data'][col].values
                        y_pred = df_interpolated.loc[validation_info['validation_indices'], col].values
                        
                        col_metrics = InterpolationMetrics.calculate_metrics(y_true, y_pred, f"{method}_{col}")
                        validation_metrics[col] = col_metrics
                
                results['validation_metrics'] = validation_metrics
                
                # Overall metrics (average across columns)
                if validation_metrics:
                    avg_metrics = {}
                    metric_keys = ['mae', 'rmse', 'r2_score', 'smape_percent', 'mape_percent', 'correlation']
                    for key in metric_keys:
                        values = [m[key] for m in validation_metrics.values() if key in m and not np.isnan(m[key])]
                        if values:
                            avg_metrics[f'avg_{key}'] = np.mean(values)
                    
                    results['overall_metrics'] = avg_metrics
        
        # Full interpolation on original data
        print("Performing full interpolation on original data...")
        interpolator_class = self.interpolators[method]
        
        # Create configuration parser
        interp_config = InterpolationConfig(gap_analysis)
        
        # Create interpolator with configuration
        interpolator = interpolator_class(interpolation_config=interp_config)
        
        # Validate configuration
        validation = interp_config.validate_configuration(method)
        if not validation['valid']:
            print(f"Configuration validation failed: {validation['errors']}")
        if validation['warnings']:
            print(f"Configuration warnings: {validation['warnings']}")
        
        interpolator.fit(df, power_columns, time_column, self.weather_data)
        df_final = interpolator.interpolate(df, power_columns, time_column, self.weather_data)
        
        # Save interpolated data
        output_file = Path(output_dir) / f"{Path(data_file).stem}_interpolated_{method}.csv"
        df_final.to_csv(output_file, index=False)
        results['files_created'].append(str(output_file))
        print(f"Saved interpolated data to: {output_file}")
        
        # Save metadata
        metadata = {
            'interpolator_metadata': interpolator.metadata,
            'method_used': method,
            'original_data_shape': df.shape,
            'interpolated_data_shape': df_final.shape,
            'missing_values_filled': {},
        }
        
        # Calculate missing values filled
        for col in power_columns:
            if col in df.columns and col in df_final.columns:
                original_missing = df[col].isna().sum()
                final_missing = df_final[col].isna().sum()
                metadata['missing_values_filled'][col] = original_missing - final_missing
        
        results['metadata'] = metadata
        
        # Save results summary
        summary_file = Path(output_dir) / f"{Path(data_file).stem}_interpolation_summary_{method}.json"
        with open(summary_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        results['files_created'].append(str(summary_file))
        print(f"Saved summary to: {summary_file}")
        
        return results
    
    def list_available_methods(self) -> List[str]:
        """List all available interpolation methods"""
        return list(self.interpolators.keys())


def main():
    """Command line interface"""
    parser = argparse.ArgumentParser(description='Run solar data interpolation based on gap analysis')
    parser.add_argument('data_file', nargs='?', help='Path to CSV file with solar data')
    parser.add_argument('gap_analysis_file', nargs='?', help='Path to gap analysis JSON file')
    parser.add_argument('-m', '--method', help='Interpolation method to use (overrides recommendation)')
    parser.add_argument('-o', '--output-dir', default='output', help='Output directory (default: output)')
    parser.add_argument('--no-validation', action='store_true', help='Skip validation metrics')
    parser.add_argument('--list-methods', action='store_true', help='List available methods and exit')
    parser.add_argument('--city', help='City name for weather data (e.g., "Midrand", "Johannesburg")')
    
    args = parser.parse_args()
    
    engine = InterpolationEngine()
    
    if args.list_methods:
        print("Available interpolation methods:")
        for method in engine.list_available_methods():
            print(f"  - {method}")
        return
    
    if not args.data_file or not args.gap_analysis_file:
        parser.error("data_file and gap_analysis_file are required when not using --list-methods")
    
    try:
        results = engine.run_interpolation(
            data_file=args.data_file,
            gap_analysis_file=args.gap_analysis_file,
            method_name=args.method,
            output_dir=args.output_dir,
            validate=not args.no_validation,
            city_name=args.city
        )
        
        print(f"\nInterpolation complete!")
        print(f"Method used: {results['method_used']}")
        
        if 'overall_metrics' in results:
            metrics = results['overall_metrics']
            print(f"\nValidation Metrics (averaged across columns):")
            if 'avg_r2_score' in metrics:
                print(f"  R² Score: {metrics['avg_r2_score']:.4f}")
            if 'avg_smape_percent' in metrics:
                print(f"  SMAPE: {metrics['avg_smape_percent']:.2f}%")
            if 'avg_mape_percent' in metrics:
                print(f"  MAPE: {metrics['avg_mape_percent']:.2f}%")
            if 'avg_mae' in metrics:
                print(f"  MAE: {metrics['avg_mae']:.2f}")
            if 'avg_rmse' in metrics:
                print(f"  RMSE: {metrics['avg_rmse']:.2f}")
            if 'avg_correlation' in metrics:
                print(f"  Correlation: {metrics['avg_correlation']:.4f}")
        
        print(f"\nFiles created:")
        for file_path in results['files_created']:
            print(f"  - {file_path}")
            
    except Exception as e:
        print(f"Error: {e}")
        return 1

if __name__ == "__main__":
    main()