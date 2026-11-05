/**
 * Excel Export Utilities
 * Shared utilities for creating and styling Excel workbooks using xlsx-js-style
 */

/**
 * Common cell styles for Excel exports
 */
export const ExcelStyles = {
  header: {
    font: { bold: true, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "D3D3D3" } },
    alignment: { vertical: "center", horizontal: "left" }
  },
  
  blankSeparator: {
    fill: { 
      patternType: "gray125",
      fgColor: { rgb: "BFBFBF" },
      bgColor: { rgb: "FFFFFF" }
    },
    border: {
      top: { style: "thin", color: { rgb: "D0D0D0" } },
      bottom: { style: "thin", color: { rgb: "D0D0D0" } },
      left: { style: "thin", color: { rgb: "D0D0D0" } },
      right: { style: "thin", color: { rgb: "D0D0D0" } }
    }
  }
};

/**
 * Sanitize a sheet name for Excel
 * Excel sheet names must be:
 * - Max 31 characters
 * - Cannot contain: : \ / ? * [ ]
 * @param {string} name - Original name
 * @param {string} fallback - Fallback name if sanitization results in empty string
 * @returns {string} Sanitized sheet name
 */
export function sanitizeSheetName(name, fallback = 'Sheet') {
  if (!name) return fallback;
  
  let sanitized = name;
  // Replace each invalid character
  sanitized = sanitized.split(':').join('_');
  sanitized = sanitized.split('/').join('_');
  sanitized = sanitized.split(String.fromCharCode(92)).join('_'); // backslash
  sanitized = sanitized.split('?').join('_');
  sanitized = sanitized.split('*').join('_');
  sanitized = sanitized.split('[').join('_');
  sanitized = sanitized.split(']').join('_');
  
  // Trim and truncate to 31 characters
  sanitized = sanitized.trim().substring(0, 31);
  
  // If empty after sanitization, use fallback
  if (!sanitized || sanitized === '') {
    return fallback;
  }
  
  return sanitized;
}

/**
 * Ensure a sheet name is unique by appending a number if needed
 * @param {string} baseName - Base sheet name
 * @param {Set<string>} usedNames - Set of already used names
 * @returns {string} Unique sheet name
 */
export function makeUniqueSheetName(baseName, usedNames) {
  let uniqueName = baseName;
  let counter = 1;
  
  while (usedNames.has(uniqueName)) {
    const suffix = '_' + counter;
    // Ensure the name + suffix doesn't exceed 31 characters
    uniqueName = baseName.substring(0, 31 - suffix.length) + suffix;
    counter++;
  }
  
  return uniqueName;
}

/**
 * Apply header styling to a row in a sheet
 * @param {Object} sheet - XLSX sheet object
 * @param {number} rowNum - Row number (1-based)
 * @param {Array<string>} columns - Array of column letters (e.g., ['A', 'B', 'C'])
 * @param {Object} style - Style object (defaults to ExcelStyles.header)
 */
export function styleHeaderRow(sheet, rowNum, columns, style = ExcelStyles.header) {
  columns.forEach(col => {
    const cellRef = col + rowNum;
    if (sheet[cellRef]) {
      sheet[cellRef].s = style;
    }
  });
}

/**
 * Apply blank separator styling to a row
 * @param {Object} sheet - XLSX sheet object
 * @param {number} rowNum - Row number (1-based)
 * @param {Array<string>} columns - Array of column letters
 * @param {Object} style - Style object (defaults to ExcelStyles.blankSeparator)
 */
export function styleBlankRow(sheet, rowNum, columns, style = ExcelStyles.blankSeparator) {
  columns.forEach(col => {
    const cellRef = col + rowNum;
    // Ensure cell exists in sheet
    if (!sheet[cellRef]) {
      sheet[cellRef] = { t: 's', v: '', w: '' };
    }
    sheet[cellRef].s = style;
  });
}

/**
 * Find and style all blank separator rows in a sheet
 * @param {Object} sheet - XLSX sheet object
 * @param {Array<Array>} data - Original data array (2D array)
 * @param {Array<string>} columns - Array of column letters
 */
export function styleAllBlankRows(sheet, data, columns) {
  for (let rowNum = 2; rowNum <= data.length; rowNum++) {
    const rowData = data[rowNum - 1];
    // Check if this is a blank row (all cells empty)
    if (rowData && rowData.every(cell => cell === '')) {
      styleBlankRow(sheet, rowNum, columns);
    }
  }
}

/**
 * Generate column letters for a given count
 * @param {number} count - Number of columns
 * @returns {Array<string>} Array of column letters ['A', 'B', 'C', ...]
 */
export function getColumnLetters(count) {
  const letters = [];
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      letters.push(String.fromCharCode(65 + i)); // A-Z
    } else {
      // AA, AB, AC, etc.
      const first = Math.floor(i / 26) - 1;
      const second = i % 26;
      letters.push(
        String.fromCharCode(65 + first) + 
        String.fromCharCode(65 + second)
      );
    }
  }
  return letters;
}

/**
 * Manage export button state during export process
 * @param {HTMLElement} button - Button element
 * @param {string} state - State: 'loading', 'success', 'error', 'reset'
 * @param {string} originalHtml - Original button HTML to restore
 * @returns {Object} Object with state management methods
 */
export function createExportButtonManager(button, originalHtml) {
  return {
    setLoading: () => {
      button.disabled = true;
      button.innerHTML = '<span>⏳</span><span>Exporting...</span>';
    },
    
    setSuccess: (timeout = 2000) => {
      button.innerHTML = '<span>✓</span><span>Exported!</span>';
      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.disabled = false;
      }, timeout);
    },
    
    setError: (timeout = 2000) => {
      button.innerHTML = '<span>✗</span><span>Export Failed</span>';
      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.disabled = false;
      }, timeout);
    },
    
    reset: () => {
      button.innerHTML = originalHtml;
      button.disabled = false;
    }
  };
}

/**
 * Download an XLSX workbook as a file
 * @param {Object} workbook - XLSX workbook object
 * @param {string} filename - Filename (without extension)
 */
export function downloadWorkbook(workbook, filename) {
  const fullFilename = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  XLSX.writeFile(workbook, fullFilename);
}

/**
 * Create a standardized filename with date
 * @param {string} prefix - Filename prefix
 * @param {string} suffix - Optional suffix (defaults to current date YYYY-MM-DD)
 * @returns {string} Formatted filename
 */
export function createDateFilename(prefix, suffix = null) {
  const date = suffix || new Date().toISOString().slice(0, 10);
  const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${sanitizedPrefix}-${date}.xlsx`;
}

