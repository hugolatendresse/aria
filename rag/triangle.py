"""
Minimal triangle functionality - just convert input data to chainladder Triangle.
"""

import uuid
import pandas as pd
from typing import Dict, Any
import logging

try:
    import chainladder as cl
    CHAINLADDER_AVAILABLE = True
except ImportError:
    CHAINLADDER_AVAILABLE = False

logger = logging.getLogger(__name__)

# In-memory storage
triangles_storage: Dict[str, Any] = {}  # {triangle_id: {'triangle': cl.Triangle, 'exposure': exposure_data}}

def dev_select(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform development factor selection using chainladder.
    
    Uses cl.Development for age-to-age factors, LDF, CDF calculation.
    """
    try:
        if not CHAINLADDER_AVAILABLE:
            raise ValueError("chainladder library not available")
            
        # Extract parameters
        triangle_id = input_data['triangle_id']
        averaging = input_data.get('averaging', 'volume')
        min_obs = input_data.get('min_obs', 1)
        
        # Get triangle from storage
        if triangle_id not in triangles_storage:
            raise ValueError(f"Triangle {triangle_id} not found")
        
        triangle = triangles_storage[triangle_id]['triangle']
        
        # Create and fit Development object
        dev = cl.Development(average=averaging, n_periods=min_obs)
        dev.fit(triangle)
        
        # Extract results
        age_to_age = dev.ldf_.values.tolist() if hasattr(dev, 'ldf_') else []
        ldf = dev.ldf_.values.tolist() if hasattr(dev, 'ldf_') else []
        cdf = dev.cdf_.values.tolist() if hasattr(dev, 'cdf_') else []
        
        return {
            "age_to_age": age_to_age,
            "LDF": ldf,
            "CDF": cdf,
            "tail_factor": 1.0,
            "diagnostics": {
                "method": averaging,
                "periods_used": min_obs,
                "triangle_shape": triangle.shape
            }
        }
        
    except Exception as e:
        return {
            "age_to_age": None,
            "LDF": None,
            "CDF": None,
            "tail_factor": None,
            "diagnostics": {"error": f"Dev select failed: {str(e)}"}
        }

def triangle_build(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a chainladder Triangle from input data.
    
    Optionally accepts exposure data for IBNR methods that require it.
    """
    try:
        if not CHAINLADDER_AVAILABLE:
            raise ValueError("chainladder library not available")
        
        # Extract data (no validation - trust input for POC)
        rows = input_data['rows']
        value_type = input_data['value_type'] 
        metric = input_data['metric']
        exposure = input_data.get('exposure', None)  # Optional exposure per origin
        
        df = pd.DataFrame(rows)
        df['origin'] = pd.to_datetime(df['origin'], format='%Y')
        df['valuation'] = df['origin'] + pd.to_timedelta(df['dev'], unit='D') * 30.44
        df = df.rename(columns={'value': metric})
        
        # Create chainladder Triangle
        triangle = cl.Triangle(
            df,
            origin='origin',
            development='valuation', 
            columns=[metric],
            cumulative=(value_type == 'cumulative')
        )
        
        if value_type == 'incremental':
            triangle = triangle.incr_to_cum()
        
        # Prepare exposure data if provided
        exposure_data = None
        if exposure is not None:
            if isinstance(exposure, list):
                # Create exposure triangle structure
                exposure_data = triangle.latest_diagonal * 0  # Zero out existing data
                for i, exp_value in enumerate(exposure):
                    if i < exposure_data.shape[2]:  # Don't exceed triangle dimensions
                        exposure_data.values[0, 0, i] = exp_value
        
        triangle_id = str(uuid.uuid4())
        triangles_storage[triangle_id] = {
            'triangle': triangle,
            'exposure': exposure_data
        }
        
        return {
            "triangle_id": triangle_id,
            "profile": {
                "n_origin": triangle.shape[0], 
                "n_dev": triangle.shape[1],
                "has_exposure": exposure_data is not None
            },
            "warnings": []
        }
        
    except Exception as e:
        return {
            "triangle_id": None,
            "profile": None,
            "warnings": [f"Triangle build failed: {str(e)}"]
        }

def tail_constant(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply constant tail factor using cl.TailConstant.
    """
    try:
        if not CHAINLADDER_AVAILABLE:
            raise ValueError("chainladder library not available")
            
        # Extract parameters
        triangle_id = input_data['triangle_id']
        tail_factor = input_data.get('tail_factor', 1.05)
        
        # Get triangle from storage
        if triangle_id not in triangles_storage:
            raise ValueError(f"Triangle {triangle_id} not found")
        
        triangle = triangles_storage[triangle_id]['triangle']
        
        # Apply TailConstant
        tail = cl.TailConstant(tail_factor)
        tail.fit_transform(triangle)
        
        return {
            "tail_factor": float(tail.tail_.values[0, 0]) if hasattr(tail, 'tail_') else tail_factor,
            "ldf": tail.ldf_.values.tolist() if hasattr(tail, 'ldf_') else [],
            "cdf": tail.cdf_.values.tolist() if hasattr(tail, 'cdf_') else [],
            "diagnostics": {
                "method": "constant",
                "input_factor": tail_factor,
                "triangle_shape": triangle.shape
            }
        }
        
    except Exception as e:
        return {
            "tail_factor": None,
            "ldf": None,
            "cdf": None,
            "diagnostics": {"error": f"Tail constant failed: {str(e)}"}
        }

def tail_curve(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply curve-fitted tail using cl.TailCurve.
    """
    try:
        if not CHAINLADDER_AVAILABLE:
            raise ValueError("chainladder library not available")
            
        # Extract parameters
        triangle_id = input_data['triangle_id']
        extrap_periods = input_data.get('extrap_periods', 100)
        fit_period = input_data.get('fit_period', None)
        
        # Get triangle from storage
        if triangle_id not in triangles_storage:
            raise ValueError(f"Triangle {triangle_id} not found")
        
        triangle = triangles_storage[triangle_id]['triangle']
        
        # Apply TailCurve
        tail_params = {"extrap_periods": extrap_periods}
        if fit_period:
            tail_params["fit_period"] = fit_period
            
        tail = cl.TailCurve(**tail_params)
        tail.fit_transform(triangle)
        
        return {
            "tail_factor": float(tail.tail_.values[0, 0]) if hasattr(tail, 'tail_') else None,
            "ldf": tail.ldf_.values.tolist() if hasattr(tail, 'ldf_') else [],
            "cdf": tail.cdf_.values.tolist() if hasattr(tail, 'cdf_') else [],
            "diagnostics": {
                "method": "curve",
                "extrap_periods": extrap_periods,
                "fit_period": fit_period,
                "triangle_shape": triangle.shape
            }
        }
        
    except Exception as e:
        return {
            "tail_factor": None,
            "ldf": None,
            "cdf": None,
            "diagnostics": {"error": f"Tail curve failed: {str(e)}"}
        }

def ibnr_estimate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate IBNR and Ultimate using various actuarial methods.
    
    Available methods: chainladder, bornhuetter_ferguson, benktander, expected_losses
    
    TODO: case_outstanding, cape_cod, berquist_sherman, frequency_severity
    """
    try:
        if not CHAINLADDER_AVAILABLE:
            raise ValueError("chainladder library not available")
            
        # Extract parameters
        triangle_id = input_data['triangle_id']
        method = input_data.get('method', 'chainladder')
        apriori = input_data.get('apriori', None)
        n_iters = input_data.get('n_iters', 1)
        trend = input_data.get('trend', 0.0)
        
        # Get triangle from storage
        if triangle_id not in triangles_storage:
            raise ValueError(f"Triangle {triangle_id} not found")
        
        triangle_data = triangles_storage[triangle_id]
        triangle = triangle_data['triangle']
        stored_exposure = triangle_data.get('exposure')
        
        # Select and configure method
        if method == 'chainladder':
            model = cl.Chainladder()
        elif method == 'bornhuetter_ferguson':
            if apriori is None:
                raise ValueError("apriori required for BornhuetterFerguson")
            model = cl.BornhuetterFerguson(apriori=apriori)
        elif method == 'benktander':
            model_params = {'n_iters': n_iters}
            if apriori is not None:
                model_params['apriori'] = apriori
            model = cl.Benktander(**model_params)
        elif method == 'expected_losses':
            # Expected losses = Benktander with n_iters=0
            if apriori is None:
                raise ValueError("apriori required for expected_losses")
            model = cl.Benktander(apriori=apriori, n_iters=0)
        elif method in ['case_outstanding', 'cape_cod', 'berquist_sherman', 'frequency_severity']:
            raise ValueError(f"Method '{method}' not yet implemented - see TODO in MCP tool docstring")
        else:
            raise ValueError(f"Unknown method: {method}")
        
        # Fit the model
        if method in ['bornhuetter_ferguson', 'benktander', 'expected_losses']:
            if stored_exposure is not None:
                model.fit(triangle, sample_weight=stored_exposure)
            else:
                raise ValueError(f"{method} method requires exposure data in triangle_build")
        else:
            model.fit(triangle)
        
        # Extract results
        ultimate = model.ultimate_.values.tolist() if hasattr(model, 'ultimate_') else []
        ibnr = model.ibnr_.values.tolist() if hasattr(model, 'ibnr_') else []
        
        # Additional method-specific outputs
        diagnostics = {
            "method": method,
            "triangle_shape": triangle.shape
        }
        
        if hasattr(model, 'apriori_'):
            diagnostics["apriori"] = float(model.apriori_.values[0, 0])
        if method == 'benktander' or method == 'expected_losses':
            diagnostics["n_iters"] = n_iters
        if method == 'cape_cod' and trend != 0.0:
            diagnostics["trend"] = trend
        
        return {
            "ultimate": ultimate,
            "ibnr": ibnr,
            "latest_diagonal": triangle.latest_diagonal.values.tolist() if hasattr(triangle, 'latest_diagonal') else [],
            "diagnostics": diagnostics
        }
        
    except Exception as e:
        return {
            "ultimate": None,
            "ibnr": None,
            "latest_diagonal": None,
            "diagnostics": {"error": f"IBNR estimation failed: {str(e)}"}
        }