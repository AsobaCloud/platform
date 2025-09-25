const fs = require('fs');
const vm = require('vm');

function checkJSFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // 1. JAVASCRIPT SYNTAX VALIDATION - Most Critical Check
    try {
        // Extract JavaScript code from HTML file
        const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
        const inlineScripts = content.match(/onclick="([^"]*)"|onload="([^"]*)"|onchange="([^"]*)"|onsubmit="([^"]*)"/g) || [];
        
        // Check each script block
        scriptMatches.forEach((scriptBlock, index) => {
            const scriptContent = scriptBlock.replace(/<\/?script[^>]*>/g, '');
            if (scriptContent.trim()) {
                try {
                    // Try to parse the JavaScript
                    vm.createScript(scriptContent, `script-block-${index}`);
                } catch (error) {
                    const lineNumber = getLineNumber(content, scriptBlock);
                    issues.push(`JavaScript syntax error in script block ${index + 1} at line ${lineNumber}: ${error.message}`);
                }
            }
        });
        
        // Check inline JavaScript
        inlineScripts.forEach((inlineScript, index) => {
            const jsCode = inlineScript.match(/="([^"]*)"/)[1];
            if (jsCode.trim()) {
                try {
                    vm.createScript(jsCode, `inline-script-${index}`);
                } catch (error) {
                    const lineNumber = getLineNumber(content, inlineScript);
                    issues.push(`JavaScript syntax error in inline script at line ${lineNumber}: ${error.message}`);
                }
            }
        });
        
    } catch (error) {
        issues.push(`JavaScript parsing failed: ${error.message}`);
    }
    
    // 2. VARIABLE SCOPE CONFLICTS - Check for duplicate variable declarations within functions
    const functionBlocks = content.match(/function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
    functionBlocks.forEach((funcBlock, funcIndex) => {
        const variableDeclarations = funcBlock.match(/(let|const|var)\s+(\w+)/g) || [];
        const variableNames = variableDeclarations.map(decl => decl.match(/(let|const|var)\s+(\w+)/)[2]);
        const duplicateVariables = variableNames.filter((name, index) => variableNames.indexOf(name) !== index);
        
        if (duplicateVariables.length > 0) {
            const lineNumber = getLineNumber(content, funcBlock);
            issues.push(`Duplicate variable declarations in function at line ${lineNumber}: ${duplicateVariables.join(', ')}`);
        }
    });
    
    // 3. MISSING FUNCTION DEFINITIONS - Check for undefined function calls
    const functionDefinitions = content.match(/function\s+(\w+)/g) || [];
    const definedFunctionNames = functionDefinitions.map(f => f.match(/function\s+(\w+)/)[1]);
    
    const functionCalls = content.match(/\b(\w+)\s*\(/g) || [];
    const builtInFunctions = [
        'alert', 'console', 'parseInt', 'parseFloat', 'Math', 'Date', 'String', 'Number',
        'setTimeout', 'setInterval', 'addEventListener', 'querySelector', 'querySelectorAll',
        'toUpperCase', 'toLowerCase', 'trim', 'getDate', 'toISOString', 'reset', 'random',
        'getHours', 'destroy', 'preventDefault', 'remove', 'toLocaleString',
        'toLocaleDateString', 'click', 'push', 'find', 'forEach', 'map', 'filter',
        'includes', 'indexOf', 'charAt', 'slice', 'split', 'join', 'replace', 'match',
        'test', 'exec', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'propertyIsEnumerable', 'getTime', 'update', 'getContext', 'closest', 'classList',
        'add', 'remove', 'contains', 'toggle', 'getMinutes', 'getSeconds', 'getMilliseconds',
        'getFullYear', 'getMonth', 'getDay', 'setHours', 'setMinutes', 'setSeconds', 'setTime',
        'log', 'error', 'warn', 'info', 'round', 'floor', 'ceil', 'max', 'min', 'abs',
        'createElement', 'appendChild', 'removeChild', 'insertBefore', 'replaceChild',
        'getAttribute', 'setAttribute', 'removeAttribute', 'hasAttribute', 'getElementsByTagName',
        'getElementsByClassName', 'createTextNode', 'innerHTML', 'innerText', 'textContent',
        'value', 'checked', 'selected', 'disabled', 'style', 'className', 'id', 'parentNode',
        'childNodes', 'firstChild', 'lastChild', 'nextSibling', 'previousSibling',
        'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'
    ];
    
    const customFunctionCalls = functionCalls
        .map(call => call.match(/\b(\w+)\s*\(/)[1])
        .filter(funcName => !builtInFunctions.includes(funcName) && funcName.match(/^[a-z]/));
    
    const undefinedFunctions = customFunctionCalls.filter(funcName => !definedFunctionNames.includes(funcName));
    
    if (undefinedFunctions.length > 0) {
        const uniqueUndefinedFunctions = [...new Set(undefinedFunctions)];
        issues.push(`Undefined function calls: ${uniqueUndefinedFunctions.join(', ')}`);
    }
    
    // 4. EXISTING CHECKS (Maintained for backward compatibility)
    
    // Check for common LLM mistakes
    if (content.includes('document.getElementById') && !content.includes('DOMContentLoaded')) {
        const outsideCalls = content.match(/document\.getElementById\([^)]+\)\.addEventListener/g);
        if (outsideCalls && outsideCalls.length > 0) {
            issues.push('addEventListener calls outside DOMContentLoaded');
        }
    }
    
    // Check for specific problematic addEventListener patterns
    const problematicPatterns = [
        /document\.getElementById\s*\(\s*['"][^'"]*['"]\s*\)\.addEventListener/g,
        /document\.querySelector\s*\(\s*['"][^'"]*['"]\s*\)\.addEventListener/g
    ];
    
    problematicPatterns.forEach(pattern => {
        let patternMatch;
        while ((patternMatch = pattern.exec(content)) !== null) {
            const lineNumber = getLineNumber(content, patternMatch.index);
            const context = content.substring(Math.max(0, patternMatch.index - 50), patternMatch.index + 50);
            issues.push(`Potential null reference in addEventListener at line ${lineNumber}: ${context.trim()}`);
        }
    });
    
    // Check for duplicate global variable declarations
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
    const duplicateFunctions = definedFunctionNames.filter((func, index) => definedFunctionNames.indexOf(func) !== index);
    if (duplicateFunctions.length > 0) {
        issues.push(`Duplicate function definitions: ${duplicateFunctions.join(', ')}`);
    }
    
    return issues;
}

// Helper function to get line number from content and position
function getLineNumber(content, searchString) {
    if (typeof searchString === 'number') {
        // searchString is an index
        return content.substring(0, searchString).split('\n').length;
    } else {
        // searchString is a string
        const index = content.indexOf(searchString);
        return index !== -1 ? content.substring(0, index).split('\n').length : 0;
    }
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