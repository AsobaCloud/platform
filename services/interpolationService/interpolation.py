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
warnings.filterwarnings('ignore')


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
    
    def create_features(self, df: pd.DataFrame, time_column: str) -> pd.DataFrame:
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
        
        return df_features


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
    
    def __init__(self, config: Optional[Dict] = None):
        super().__init__(config)
        self.model = None
        self.feature_columns = None
        self.scaler_X = None
        self.scaler_y = None
    
    def get_method_name(self) -> str:
        return "Multi-Output LightGBM Regression"
    
    def fit(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> 'MultiOutputRegressionInterpolator':
        """Fit multi-output model"""
        
        # Create features
        df_features = self.create_features(df, time_column)
        
        # Feature columns
        self.feature_columns = ['hour', 'day_of_year', 'month', 'day_of_week', 'is_weekend',
                               'hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        
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
    
    def interpolate(self, df: pd.DataFrame, power_columns: List[str], time_column: str) -> pd.DataFrame:
        """Perform multi-output interpolation"""
        if not self.is_fitted or not self.model:
            # Fallback to spline interpolation if model training failed
            spline_interpolator = SplineInterpolator()
            spline_interpolator.fit(df, power_columns, time_column)
            return spline_interpolator.interpolate(df, power_columns, time_column)
        
        df_result = df.copy()
        df_features = self.create_features(df_result, time_column)
        
        # Find rows with any missing values
        missing_mask = df_features[power_columns].isna().any(axis=1)
        
        if missing_mask.any():
            # Prepare features
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
        
        # Apply solar constraints
        df_result = self.apply_solar_constraints(df_result, power_columns, time_column)
        
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
                         validate: bool = True) -> Dict:
        """Run interpolation and return results"""
        
        print(f"Loading data from {data_file}")
        df = pd.read_csv(data_file)
        
        print(f"Loading gap analysis from {gap_analysis_file}")
        gap_analysis = self.load_gap_analysis(gap_analysis_file)
        
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
                interpolator = interpolator_class()
                interpolator.fit(df_val, power_columns, time_column)
                
                # Interpolate validation data
                print("Performing interpolation...")
                df_interpolated = interpolator.interpolate(df_val, power_columns, time_column)
                
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
        interpolator = interpolator_class()
        interpolator.fit(df, power_columns, time_column)
        df_final = interpolator.interpolate(df, power_columns, time_column)
        
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
            validate=not args.no_validation
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