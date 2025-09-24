const fs = require('fs');

function checkJSFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // Check for common LLM mistakes
    if (content.includes('document.getElementById') && !content.includes('DOMContentLoaded')) {
        const outsideCalls = content.match(/document\.getElementById\([^)]+\)\.addEventListener/g);
        if (outsideCalls && outsideCalls.length > 0) {
            issues.push('addEventListener calls outside DOMContentLoaded');
        }
    }
    
    // Check bracket/paren balance
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
        issues.push('Unbalanced brackets');
    }
    
    // Check for duplicate IDs
    const idMatches = content.match(/id="([^"]+)"/g) || [];
    const ids = idMatches.map(match => match.match(/id="([^"]+)"/)[1]);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        issues.push(`Duplicate IDs: ${duplicateIds.join(', ')}`);
    }
    
    // Check for undefined function calls (only check custom functions)
    const functionCalls = content.match(/\b(\w+)\(\)/g) || [];
    const functions = content.match(/function\s+(\w+)/g) || [];
    const definedFunctions = functions.map(f => f.match(/function\s+(\w+)/)[1]);
    
    const builtInFunctions = [
        'alert', 'console', 'parseInt', 'parseFloat', 'Math', 'Date', 'String', 'Number',
        'setTimeout', 'setInterval', 'addEventListener', 'querySelector', 'querySelectorAll',
        'toUpperCase', 'toLowerCase', 'trim', 'getDate', 'toISOString', 'reset', 'random',
        'getHours', 'now', 'destroy', 'preventDefault', 'remove', 'toLocaleString',
        'toLocaleDateString', 'click', 'push', 'find', 'forEach', 'map', 'filter',
        'includes', 'indexOf', 'charAt', 'slice', 'split', 'join', 'replace', 'match',
        'test', 'exec', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'propertyIsEnumerable', 'toLocaleString', 'valueOf'
    ];
    
    for (const call of functionCalls) {
        const funcName = call.replace('()', '');
        if (!definedFunctions.includes(funcName) && !builtInFunctions.includes(funcName)) {
            // Only flag if it looks like a custom function (starts with lowercase)
            if (funcName.match(/^[a-z]/)) {
                issues.push(`Possible undefined function: ${funcName}`);
            }
        }
    }
    
    return issues;
}

// Check the main HTML file
const filePath = 'admin-gpu-panel.html';
if (fs.existsSync(filePath)) {
    const issues = checkJSFile(filePath);
    if (issues.length > 0) {
        console.error(`❌ ${filePath}: ${issues.join(', ')}`);
        process.exit(1);
    } else {
        console.log(`✅ ${filePath}: No issues found`);
    }
} else {
    console.log('No HTML file found to check');
}