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
    
    // Check for specific problematic addEventListener patterns that could cause null reference errors
    const problematicPatterns = [
        /document\.getElementById\s*\(\s*['"][^'"]*['"]\s*\)\.addEventListener/g,
        /document\.querySelector\s*\(\s*['"][^'"]*['"]\s*\)\.addEventListener/g
    ];
    
    problematicPatterns.forEach(pattern => {
        let patternMatch;
        while ((patternMatch = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, patternMatch.index).split('\n').length;
            const context = content.substring(Math.max(0, patternMatch.index - 50), patternMatch.index + 50);
            issues.push(`Potential null reference in addEventListener at line ${lineNumber}: ${context.trim()}`);
        }
    });
    
    // Check for duplicate variable declarations (only global scope duplicates)
    const globalVariableDeclarations = content.match(/^(let|const|var)\s+(\w+)/gm) || [];
    const globalVariableNames = globalVariableDeclarations.map(decl => decl.match(/^(let|const|var)\s+(\w+)/)[2]);
    const duplicateGlobalVariables = globalVariableNames.filter((name, index) => globalVariableNames.indexOf(name) !== index);
    if (duplicateGlobalVariables.length > 0) {
        issues.push(`Duplicate global variable declarations: ${duplicateGlobalVariables.join(', ')}`);
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
    
    // Check for duplicate function definitions
    const functions = content.match(/function\s+(\w+)/g) || [];
    const functionNames = functions.map(f => f.match(/function\s+(\w+)/)[1]);
    const duplicateFunctions = functionNames.filter((func, index) => functionNames.indexOf(func) !== index);
    if (duplicateFunctions.length > 0) {
        issues.push(`Duplicate function definitions: ${duplicateFunctions.join(', ')}`);
    }
    
    // Check for undefined function calls (only check custom functions)
    const functionCalls = content.match(/\b(\w+)\(\)/g) || [];
    const definedFunctions = functionNames;
    
    const builtInFunctions = [
        'alert', 'console', 'parseInt', 'parseFloat', 'Math', 'Date', 'String', 'Number',
        'setTimeout', 'setInterval', 'addEventListener', 'querySelector', 'querySelectorAll',
        'toUpperCase', 'toLowerCase', 'trim', 'getDate', 'toISOString', 'reset', 'random',
        'getHours', 'now', 'destroy', 'preventDefault', 'remove', 'toLocaleString',
        'toLocaleDateString', 'click', 'push', 'find', 'forEach', 'map', 'filter',
        'includes', 'indexOf', 'charAt', 'slice', 'split', 'join', 'replace', 'match',
        'test', 'exec', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'propertyIsEnumerable', 'toLocaleString', 'valueOf', 'getTime', 'update',
        'getContext', 'closest', 'classList', 'add', 'remove', 'contains', 'toggle',
        'getMinutes', 'getSeconds', 'getMilliseconds', 'getFullYear', 'getMonth',
        'getDay', 'setHours', 'setMinutes', 'setSeconds', 'setTime'
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