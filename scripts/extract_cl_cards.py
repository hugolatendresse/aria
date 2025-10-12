#!/usr/bin/env python3
"""
Extract chainladder-python API information for prompt generation.
"""

import inspect
import json
import sys

try:
    import chainladder as cl
except ImportError:
    print("Error: chainladder library not installed. Run: pip install chainladder", file=sys.stderr)
    sys.exit(1)

TARGETS = [
    cl.Triangle
]

def get_full_docstring(s): 
    """Get complete docstring."""
    return (s or "").strip()

def get_class_info(obj):
    """Extract class information for prompt generation."""
    try:
        signature = str(inspect.signature(obj.__init__)) if hasattr(obj, "__init__") else None
        # Clean up signature - remove 'self' parameter
        if signature and signature.startswith("(self"):
            if signature == "(self)":
                signature = "()"
            else:
                signature = "(" + signature[6:]  # Remove "(self, "
    except (ValueError, TypeError):
        signature = None
    
    # Get attributes that end with underscore (fitted attributes)
    fitted_attrs = [a for a in dir(obj) if a.endswith("_") and not a.startswith("_")][:8]
    
    # Get common methods (excluding private ones)
    methods = [m for m in dir(obj) if not m.startswith("_") and callable(getattr(obj, m, None))][:8]
    
    return {
        "name": obj.__name__,
        "module": obj.__module__,
        "full_name": f"{obj.__module__}.{obj.__name__}",
        "signature": signature,
        "doc": get_full_docstring(inspect.getdoc(obj)),
        "fitted_attributes": fitted_attrs,  # ultimate_, ibnr_, ldf_, etc.
        "key_methods": methods[:6]  # fit, transform, etc.
    }

def main():
    cards = []
    for obj in TARGETS:
        try:
            info = get_class_info(obj)
            cards.append(info)
        except Exception as e:
            print(f"Warning: Could not extract info for {obj}: {e}", file=sys.stderr)
            continue
    
    output = {
        "chainladder_version": cl.__version__,
        "extraction_date": "auto-generated",
        "cards": cards
    }
    
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
