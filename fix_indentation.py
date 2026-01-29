#!/usr/bin/env python3
import re

# Read the file
with open(r"c:\infradb\frontend\src\App.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find ERDiagramViewer function and fix its indentation
er_diagram_start = content.find("function ERDiagramViewer({raw, darkMode, filterTables})")
er_diagram_end = content.find("// ===== ENHANCED DASHBOARD VIEW COMPONENT =====", er_diagram_start)

if er_diagram_start != -1 and er_diagram_end != -1:
    er_section = content[er_diagram_start:er_diagram_end]
    
    # Fix indentation within ERDiagramViewer
    # The function starts with "function " at column 6, so internal code should be indented 8+ spaces
    lines = er_section.split('\n')
    fixed_lines = []
    in_function = False
    function_depth = 0
    
    for line in lines:
        if line.strip().startswith('function ERDiagramViewer'):
            in_function = True
            fixed_lines.append(line)  # Keep "      function ERDiagramViewer..."
            function_depth = 0
        elif in_function and line.strip() and not line.strip().startswith('//'):
            # Get leading whitespace
            leading = len(line) - len(line.lstrip())
            stripped = line.lstrip()
            
            # Count braces to determine proper indentation
            if stripped.startswith('}'):
                function_depth -= 1
                fixed_lines.append('      ' + '  ' * max(0, function_depth) + stripped)
            else:
                # Regular line
                fixed_lines.append('      ' + '  ' * (function_depth + 1) + stripped)
                
            # Update depth for next line
            function_depth += line.count('{') - line.count('}')
        else:
            fixed_lines.append(line)
    
    fixed_er_section = '\n'.join(fixed_lines)
    new_content = content[:er_diagram_start] + fixed_er_section + content[er_diagram_end:]
    
    # Write back
    with open(r"c:\infradb\frontend\src\App.jsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print("Fixed ERDiagramViewer indentation")
else:
    print("Could not find ERDiagramViewer function")
