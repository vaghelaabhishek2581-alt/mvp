'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Rich Text Editor - Production-ready vanilla JavaScript implementation
 * Features: Complete formatting, tables, code blocks, export, accessibility
 */

/**
 * Command History Manager for Undo/Redo functionality
 */
class CommandHistory {
  constructor(maxSize = 100) {
    this.history = [];
    this.currentIndex = -1;
    this.maxSize = maxSize;
  }

  /**
   * Add a new state to history
   * @param {string} content - HTML content
   */
  push(content) {
    // Remove any history after current index
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state
    this.history.push(content);
    this.currentIndex++;
    
    // Limit history size
    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * Get previous state for undo
   */
  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Get next state for redo
   */
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }
}

/**
 * Formatting Commands Manager
 */
class FormattingCommands {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Execute document command with error handling
   */
  execCommand(command, value = null) {
    try {
      const result = document.execCommand(command, false, value);
      this.editor.saveState();
      this.editor.updateStats();
      return result;
    } catch (error) {
      console.error(`Command execution failed: ${command}`, error);
      return false;
    }
  }

  // Basic formatting commands
  bold() { return this.execCommand('bold'); }
  italic() { return this.execCommand('italic'); }
  underline() { return this.execCommand('underline'); }
  strikeThrough() { return this.execCommand('strikeThrough'); }
  
  // Text alignment
  alignLeft() { return this.execCommand('justifyLeft'); }
  alignCenter() { return this.execCommand('justifyCenter'); }
  alignRight() { return this.execCommand('justifyRight'); }
  alignJustify() { return this.execCommand('justifyFull'); }

  // Lists
  insertUnorderedList() { return this.execCommand('insertUnorderedList'); }
  insertOrderedList() { return this.execCommand('insertOrderedList'); }

  // Indentation
  indent() { return this.execCommand('indent'); }
  outdent() { return this.execCommand('outdent'); }

  // Font styling
  fontName(font) { return this.execCommand('fontName', font); }
  fontSize(size) { return this.execCommand('fontSize', size); }
  foreColor(color) { return this.execCommand('foreColor', color); }
  backColor(color) { return this.execCommand('backColor', color); }

  // Headings
  formatBlock(tag) { return this.execCommand('formatBlock', tag); }

  /**
   * Insert link with validation
   */
  createLink() {
    const url = prompt('Enter URL:');
    if (url && this.isValidUrl(url)) {
      return this.execCommand('createLink', url);
    }
    return false;
  }

  /**
   * URL validation
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      // Try with http prefix
      try {
        new URL('http://' + string);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  /**
   * Insert horizontal rule
   */
  insertHorizontalRule() {
    return this.execCommand('insertHorizontalRule');
  }

  /**
   * Insert image
   */
  insertImage(src) {
    if (src && (src.startsWith('http') || src.startsWith('data:'))) {
      return this.execCommand('insertImage', src);
    }
    return false;
  }
}

/**
 * Table Manager
 */
class TableManager {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Insert table
   */
  insertTable(rows = 3, cols = 3) {
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.setAttribute('border', '1');
    table.setAttribute('cellpadding', '5');
    table.setAttribute('cellspacing', '0');

    for (let r = 0; r < rows; r++) {
      const row = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const cell = r === 0 ? document.createElement('th') : document.createElement('td');
        cell.innerHTML = '&nbsp;';
        cell.setAttribute('contenteditable', 'true');
        row.appendChild(cell);
      }
      table.appendChild(row);
    }

    this.insertElementAtCursor(table);
    this.editor.saveState();
    return true;
  }

  /**
   * Add row to table
   */
  addTableRow() {
    const selection = window.getSelection();
    const cell = this.findParentCell(selection.anchorNode);
    if (!cell) return false;

    const row = cell.parentNode;
    const table = this.findParentTable(row);
    const colCount = row.children.length;

    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement('td');
      newCell.innerHTML = '&nbsp;';
      newCell.setAttribute('contenteditable', 'true');
      newRow.appendChild(newCell);
    }

    table.appendChild(newRow);
    this.editor.saveState();
    return true;
  }

  /**
   * Add column to table
   */
  addTableColumn() {
    const selection = window.getSelection();
    const cell = this.findParentCell(selection.anchorNode);
    if (!cell) return false;

    const table = this.findParentTable(cell);
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      const newCell = document.createElement(row.children[0].tagName.toLowerCase());
      newCell.innerHTML = '&nbsp;';
      newCell.setAttribute('contenteditable', 'true');
      row.appendChild(newCell);
    });

    this.editor.saveState();
    return true;
  }

  /**
   * Delete current row
   */
  deleteTableRow() {
    const selection = window.getSelection();
    const cell = this.findParentCell(selection.anchorNode);
    if (!cell) return false;

    const row = cell.parentNode;
    const table = this.findParentTable(row);
    
    if (table.querySelectorAll('tr').length > 1) {
      row.remove();
      this.editor.saveState();
      return true;
    }
    return false;
  }

  /**
   * Delete current column
   */
  deleteTableColumn() {
    const selection = window.getSelection();
    const cell = this.findParentCell(selection.anchorNode);
    if (!cell) return false;

    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    const table = this.findParentTable(cell);
    const rows = table.querySelectorAll('tr');

    if (rows[0].children.length > 1) {
      rows.forEach(row => {
        if (row.children[cellIndex]) {
          row.children[cellIndex].remove();
        }
      });
      this.editor.saveState();
      return true;
    }
    return false;
  }

  /**
   * Helper methods
   */
  findParentCell(node) {
    while (node && node.tagName !== 'TD' && node.tagName !== 'TH') {
      node = node.parentNode;
    }
    return node;
  }

  findParentTable(node) {
    while (node && node.tagName !== 'TABLE') {
      node = node.parentNode;
    }
    return node;
  }

  insertElementAtCursor(element) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(element);
      range.setStartAfter(element);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      this.editor.editorElement.appendChild(element);
    }
  }
}

/**
 * Export Manager
 */
class ExportManager {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Export to HTML
   */
  exportToHTML() {
    const content = this.editor.editorElement.innerHTML;
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .editor-table { border-collapse: collapse; width: 100%; }
        .editor-table th, .editor-table td { border: 1px solid #ddd; padding: 8px; }
        .editor-table th { background-color: #f2f2f2; }
        .code-block { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; }
        blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 20px; font-style: italic; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

    this.downloadFile(fullHTML, 'document.html', 'text/html');
  }

  /**
   * Export to plain text
   */
  exportToText() {
    const content = this.editor.editorElement.innerText || this.editor.editorElement.textContent;
    this.downloadFile(content, 'document.txt', 'text/plain');
  }

  /**
   * Export to Markdown
   */
  exportToMarkdown() {
    const content = this.convertToMarkdown(this.editor.editorElement);
    this.downloadFile(content, 'document.md', 'text/markdown');
  }

  /**
   * Convert HTML to Markdown
   */
  convertToMarkdown(element) {
    let markdown = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case 'h1': markdown += `# ${node.textContent}\n\n`; break;
          case 'h2': markdown += `## ${node.textContent}\n\n`; break;
          case 'h3': markdown += `### ${node.textContent}\n\n`; break;
          case 'h4': markdown += `#### ${node.textContent}\n\n`; break;
          case 'h5': markdown += `##### ${node.textContent}\n\n`; break;
          case 'h6': markdown += `###### ${node.textContent}\n\n`; break;
          case 'p': markdown += `${node.textContent}\n\n`; break;
          case 'strong': case 'b': markdown += `**${node.textContent}**`; break;
          case 'em': case 'i': markdown += `*${node.textContent}*`; break;
          case 'u': markdown += `<u>${node.textContent}</u>`; break;
          case 'ul':
            for (const li of node.querySelectorAll('li')) {
              markdown += `- ${li.textContent}\n`;
            }
            markdown += '\n';
            break;
          case 'ol':
            Array.from(node.querySelectorAll('li')).forEach((li, index) => {
              markdown += `${index + 1}. ${li.textContent}\n`;
            });
            markdown += '\n';
            break;
          case 'blockquote': markdown += `> ${node.textContent}\n\n`; break;
          case 'hr': markdown += '---\n\n'; break;
          case 'a': markdown += `[${node.textContent}](${node.href})`; break;
          case 'img': markdown += `![${node.alt || ''}](${node.src})\n`; break;
          case 'code': markdown += `\`${node.textContent}\``; break;
          case 'pre': markdown += `\`\`\`\n${node.textContent}\n\`\`\`\n\n`; break;
          default:
            markdown += this.convertToMarkdown(node);
        }
      }
    }
    
    return markdown;
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Print document
   */
  print() {
    const content = this.editor.editorElement.innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Print Document</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              .editor-table { border-collapse: collapse; width: 100%; }
              .editor-table th, .editor-table td { border: 1px solid #ddd; padding: 8px; }
              .code-block { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; }
              blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 20px; font-style: italic; }
              @media print { body { margin: 0; } }
          </style>
      </head>
      <body>
          ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}

/**
 * Auto-save Manager
 */
class AutoSaveManager {
  constructor(editor, interval = 30000) { // 30 seconds default
    this.editor = editor;
    this.interval = interval;
    this.timeoutId = null;
    this.lastContent = '';
    this.storageKey = 'richTextEditor_autoSave';
  }

  start() {
    this.timeoutId = setInterval(() => {
      this.save();
    }, this.interval);
  }

  stop() {
    if (this.timeoutId) {
      clearInterval(this.timeoutId);
      this.timeoutId = null;
    }
  }

  save() {
    try {
      const currentContent = this.editor.editorElement.innerHTML;
      if (currentContent !== this.lastContent) {
        localStorage.setItem(this.storageKey, currentContent);
        this.lastContent = currentContent;
        this.editor.updateAutoSaveStatus('Auto-saved');
        
        // Reset status after 2 seconds
        setTimeout(() => {
          this.editor.updateAutoSaveStatus('');
        }, 2000);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      this.editor.updateAutoSaveStatus('Auto-save failed');
    }
  }

  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return saved;
      }
    } catch (error) {
      console.error('Failed to load auto-saved content:', error);
    }
    return null;
  }

  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear auto-saved content:', error);
    }
  }
}

/**
 * Find and Replace Manager
 */
class FindReplaceManager {
  constructor(editor) {
    this.editor = editor;
    this.currentMatches = [];
    this.currentIndex = -1;
  }

  /**
   * Find text with optional regex
   */
  find(searchText, isRegex = false, caseSensitive = false) {
    this.clearHighlights();
    
    if (!searchText) return [];

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = isRegex ? new RegExp(searchText, flags) : new RegExp(this.escapeRegex(searchText), flags);
      
      const content = this.editor.editorElement.innerHTML;
      const matches = [];
      let match;

      while ((match = regex.exec(content)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        });
      }

      this.currentMatches = matches;
      this.highlightMatches();
      return matches;
    } catch (error) {
      console.error('Find operation failed:', error);
      return [];
    }
  }

  /**
   * Replace text
   */
  replace(searchText, replaceText, isRegex = false, caseSensitive = false, replaceAll = false) {
    if (!searchText) return 0;

    try {
      const flags = caseSensitive ? (replaceAll ? 'g' : '') : (replaceAll ? 'gi' : 'i');
      const regex = isRegex ? new RegExp(searchText, flags) : new RegExp(this.escapeRegex(searchText), flags);
      
      let content = this.editor.editorElement.innerHTML;
      let replacements = 0;

      if (replaceAll) {
        const newContent = content.replace(regex, (match) => {
          replacements++;
          return replaceText;
        });
        this.editor.editorElement.innerHTML = newContent;
      } else {
        const newContent = content.replace(regex, replaceText);
        if (newContent !== content) {
          this.editor.editorElement.innerHTML = newContent;
          replacements = 1;
        }
      }

      if (replacements > 0) {
        this.editor.saveState();
        this.editor.updateStats();
      }

      return replacements;
    } catch (error) {
      console.error('Replace operation failed:', error);
      return 0;
    }
  }

  /**
   * Navigate to next match
   */
  findNext() {
    if (this.currentMatches.length === 0) return false;
    
    this.currentIndex = (this.currentIndex + 1) % this.currentMatches.length;
    this.highlightCurrentMatch();
    return true;
  }

  /**
   * Navigate to previous match
   */
  findPrevious() {
    if (this.currentMatches.length === 0) return false;
    
    this.currentIndex = this.currentIndex <= 0 ? this.currentMatches.length - 1 : this.currentIndex - 1;
    this.highlightCurrentMatch();
    return true;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Highlight matches
   */
  highlightMatches() {
    // Implementation would involve wrapping matches in highlight spans
    // Simplified for this example
  }

  /**
   * Clear highlights
   */
  clearHighlights() {
    const highlights = this.editor.editorElement.querySelectorAll('.search-highlight');
    highlights.forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  /**
   * Highlight current match
   */
  highlightCurrentMatch() {
    // Scroll to and highlight current match
    // Simplified for this example
  }
}

/**
 * Main Rich Text Editor Class
 */
class RichTextEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      autoSave: true,
      autoSaveInterval: 30000,
      maxHistorySize: 100,
      ...options
    };

    // Core components
    this.history = new CommandHistory(this.options.maxHistorySize);
    this.commands = null;
    this.tableManager = null;
    this.exportManager = null;
    this.autoSaveManager = null;
    this.findReplace = null;

    // UI elements
    this.editorElement = null;
    this.toolbarElement = null;
    this.statsElements = {};

    // State
    this.isFullScreen = false;
    this.lastContent = '';

    this.init();
  }

  /**
   * Initialize the editor
   */
  init() {
    try {
      this.createEditor();
      this.createToolbar();
      this.initializeComponents();
      this.attachEventListeners();
      this.loadAutoSavedContent();
      
      if (this.options.autoSave) {
        this.autoSaveManager.start();
      }

      // Initial state save
      this.saveState();
    } catch (error) {
      console.error('Editor initialization failed:', error);
      this.showError('Failed to initialize editor');
    }
  }

  /**
   * Create editor element
   */
  createEditor() {
    this.container.innerHTML = `
      <div class="rich-editor">
        <div class="editor-header">
          <div class="editor-stats">
            <span id="word-count">Words: 0</span>
            <span id="char-count">Characters: 0</span>
            <span id="auto-save-status"></span>
          </div>
        </div>
        
        <div class="editor-toolbar" role="toolbar" aria-label="Formatting toolbar">
          <!-- Toolbar will be populated by createToolbar() -->
        </div>
        
        <div class="editor-content">
          <div 
            class="editor-area" 
            contenteditable="true" 
            role="textbox" 
            aria-label="Rich text editor"
            aria-multiline="true"
            spellcheck="true"
          >
            <p>Start typing here...</p>
          </div>
        </div>
        
        <div class="find-replace-panel" style="display: none;">
          <div class="find-replace-controls">
            <input type="text" placeholder="Find..." class="find-input">
            <input type="text" placeholder="Replace..." class="replace-input">
            <label><input type="checkbox" class="case-sensitive"> Case sensitive</label>
            <label><input type="checkbox" class="regex-mode"> Regex</label>
            <button class="find-btn">Find</button>
            <button class="replace-btn">Replace</button>
            <button class="replace-all-btn">Replace All</button>
            <button class="close-find-btn">Close</button>
          </div>
          <div class="find-stats"></div>
        </div>
      </div>
    `;

    this.editorElement = this.container.querySelector('.editor-area');
    this.toolbarElement = this.container.querySelector('.editor-toolbar');
    this.statsElements = {
      wordCount: this.container.querySelector('#word-count'),
      charCount: this.container.querySelector('#char-count'),
      autoSaveStatus: this.container.querySelector('#auto-save-status')
    };
  }

  /**
   * Create toolbar with all formatting options
   */
  createToolbar() {
    const toolbarHTML = `
      <!-- File Operations -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="new" title="New Document (Ctrl+N)" aria-label="New document">
          📄
        </button>
        <button class="toolbar-btn" data-command="save" title="Save (Ctrl+S)" aria-label="Save document">
          💾
        </button>
        <button class="toolbar-btn" data-command="print" title="Print (Ctrl+P)" aria-label="Print document">
          🖨️
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Undo/Redo -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="undo" title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button class="toolbar-btn" data-command="redo" title="Redo (Ctrl+Y)" aria-label="Redo">
          ↷
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Basic Formatting -->
      <div class="toolbar-group">
        <button class="toolbar-btn format-btn" data-command="bold" title="Bold (Ctrl+B)" aria-label="Bold">
          <strong>B</strong>
        </button>
        <button class="toolbar-btn format-btn" data-command="italic" title="Italic (Ctrl+I)" aria-label="Italic">
          <em>I</em>
        </button>
        <button class="toolbar-btn format-btn" data-command="underline" title="Underline (Ctrl+U)" aria-label="Underline">
          <u>U</u>
        </button>
        <button class="toolbar-btn format-btn" data-command="strikeThrough" title="Strikethrough" aria-label="Strikethrough">
          <s>S</s>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Headings -->
      <div class="toolbar-group">
        <select class="toolbar-select" data-command="formatBlock" aria-label="Heading level">
          <option value="div">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Alignment -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="justifyLeft" title="Align Left" aria-label="Align left">
          ⬅️
        </button>
        <button class="toolbar-btn" data-command="justifyCenter" title="Align Center" aria-label="Align center">
          ↔️
        </button>
        <button class="toolbar-btn" data-command="justifyRight" title="Align Right" aria-label="Align right">
          ➡️
        </button>
        <button class="toolbar-btn" data-command="justifyFull" title="Justify" aria-label="Justify">
          ↕️
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Lists -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="insertUnorderedList" title="Bullet List" aria-label="Bullet list">
          • 
        </button>
        <button class="toolbar-btn" data-command="insertOrderedList" title="Numbered List" aria-label="Numbered list">
          1. 
        </button>
        <button class="toolbar-btn" data-command="indent" title="Increase Indent" aria-label="Increase indent">
          →
        </button>
        <button class="toolbar-btn" data-command="outdent" title="Decrease Indent" aria-label="Decrease indent">
          ←
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Font and Colors -->
      <div class="toolbar-group">
        <select class="toolbar-select" data-command="fontName" aria-label="Font family">
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times</option>
          <option value="Courier New">Courier</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Georgia">Georgia</option>
        </select>
        <select class="toolbar-select" data-command="fontSize" aria-label="Font size">
          <option value="1">8pt</option>
          <option value="2">10pt</option>
          <option value="3" selected>12pt</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>
        <input type="color" class="color-picker" data-command="foreColor" title="Text Color" aria-label="Text color">
        <input type="color" class="color-picker" data-command="hiliteColor" title="Background Color" aria-label="Highlight color">
      </div>

      <div class="toolbar-divider"></div>

      <!-- Insert Elements -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="createLink" title="Insert Link" aria-label="Insert link">
          🔗
        </button>
        <button class="toolbar-btn" data-command="insertImage" title="Insert Image" aria-label="Insert image">
          🖼️
        </button>
        <button class="toolbar-btn" data-command="insertTable" title="Insert Table" aria-label="Insert table">
          📊
        </button>
        <button class="toolbar-btn" data-command="insertHorizontalRule" title="Insert Horizontal Rule" aria-label="Insert horizontal rule">
          ➖
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Advanced -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="blockquote" title="Blockquote" aria-label="Blockquote">
          💬
        </button>
        <button class="toolbar-btn" data-command="code" title="Code Block" aria-label="Code block">
          💻
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Tools -->
      <div class="toolbar-group">
        <button class="toolbar-btn" data-command="find" title="Find & Replace (Ctrl+F)" aria-label="Find and replace">
          🔍
        </button>
        <button class="toolbar-btn" data-command="fullscreen" title="Full Screen (F11)" aria-label="Toggle fullscreen">
          ⛶
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Export -->
      <div class="toolbar-group">
        <select class="toolbar-select" data-command="export" aria-label="Export format">
          <option value="">Export as...</option>
          <option value="html">HTML</option>
          <option value="text">Plain Text</option>
          <option value="markdown">Markdown</option>
        </select>
      </div>
    `;

    this.toolbarElement.innerHTML = toolbarHTML;
  }

  /**
   * Initialize component managers
   */
  initializeComponents() {
    this.commands = new FormattingCommands(this);
    this.tableManager = new TableManager(this);
    this.exportManager = new ExportManager(this);
    this.autoSaveManager = new AutoSaveManager(this, this.options.autoSaveInterval);
    this.findReplace = new FindReplaceManager(this);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toolbar events
    this.toolbarElement.addEventListener('click', this.handleToolbarClick.bind(this));
    this.toolbarElement.addEventListener('change', this.handleToolbarChange.bind(this));

    // Editor events
    this.editorElement.addEventListener('input', this.handleInput.bind(this));
    this.editorElement.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.editorElement.addEventListener('paste', this.handlePaste.bind(this));
    this.editorElement.addEventListener('drop', this.handleDrop.bind(this));
    this.editorElement.addEventListener('dragover', this.handleDragOver.bind(this));

    // Find/Replace events
    this.setupFindReplaceEvents();

    // Window events
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    document.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));
  }

  /**
   * Handle toolbar button clicks
   */
  handleToolbarClick(event) {
    const button = event.target.closest('[data-command]');
    if (!button) return;

    event.preventDefault();
    const command = button.dataset.command;

    try {
      switch (command) {
        case 'new':
          this.newDocument();
          break;
        case 'save':
          this.saveDocument();
          break;
        case 'print':
          this.exportManager.print();
          break;
        case 'undo':
          this.undo();
          break;
        case 'redo':
          this.redo();
          break;
        case 'createLink':
          this.commands.createLink();
          break;
        case 'insertImage':
          this.insertImageDialog();
          break;
        case 'insertTable':
          this.insertTableDialog();
          break;
        case 'insertHorizontalRule':
          this.commands.insertHorizontalRule();
          break;
        case 'blockquote':
          this.insertBlockquote();
          break;
        case 'code':
          this.insertCodeBlock();
          break;
        case 'find':
          this.toggleFindReplace();
          break;
        case 'fullscreen':
          this.toggleFullScreen();
          break;
        default:
          // Basic formatting commands
          if (this.commands[command]) {
            this.commands[command]();
          }
      }

      this.updateToolbarState();
    } catch (error) {
      console.error('Command execution failed:', error);
      this.showError(`Failed to execute command: ${command}`);
    }
  }

  /**
   * Handle toolbar select changes
   */
  handleToolbarChange(event) {
    const select = event.target;
    const command = select.dataset.command;
    const value = select.value;

    if (!value) return;

    try {
      switch (command) {
        case 'formatBlock':
          this.commands.formatBlock(value);
          break;
        case 'fontName':
          this.commands.fontName(value);
          break;
        case 'fontSize':
          this.commands.fontSize(value);
          break;
        case 'foreColor':
          this.commands.foreColor(value);
          break;
        case 'hiliteColor':
          this.commands.backColor(value);
          break;
        case 'export':
          this.handleExport(value);
          select.value = ''; // Reset select
          break;
      }

      this.updateToolbarState();
    } catch (error) {
      console.error('Select change failed:', error);
    }
  }

  /**
   * Handle editor input
   */
  handleInput() {
    this.updateStats();
    
    // Debounced state save
    clearTimeout(this.inputTimeout);
    this.inputTimeout = setTimeout(() => {
      this.saveState();
    }, 500);
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyDown(event) {
    // Handle tab key for code blocks
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
      const selection = window.getSelection();
      if (this.isInCodeBlock(selection.anchorNode)) {
        event.preventDefault();
        document.execCommand('insertHTML', false, '    '); // 4 spaces
        return;
      }
    }
  }

  /**
   * Handle global keyboard shortcuts
   */
  handleGlobalKeyDown(event) {
    // Only handle shortcuts when editor is focused or when find panel is open
    if (!this.isEditorFocused() && !this.isFindPanelOpen()) return;

    const isCtrl = event.ctrlKey || event.metaKey;

    if (isCtrl) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          this.commands.bold();
          break;
        case 'i':
          event.preventDefault();
          this.commands.italic();
          break;
        case 'u':
          event.preventDefault();
          this.commands.underline();
          break;
        case 'z':
          if (event.shiftKey) {
            event.preventDefault();
            this.redo();
          } else {
            event.preventDefault();
            this.undo();
          }
          break;
        case 'y':
          event.preventDefault();
          this.redo();
          break;
        case 'f':
          event.preventDefault();
          this.toggleFindReplace();
          break;
        case 's':
          event.preventDefault();
          this.saveDocument();
          break;
        case 'p':
          event.preventDefault();
          this.exportManager.print();
          break;
        case 'n':
          event.preventDefault();
          this.newDocument();
          break;
      }
    } else if (event.key === 'F11') {
      event.preventDefault();
      this.toggleFullScreen();
    } else if (event.key === 'Escape') {
      if (this.isFindPanelOpen()) {
        this.toggleFindReplace();
      }
    }

    this.updateToolbarState();
  }

  /**
   * Handle paste events
   */
  handlePaste(event) {
    // Allow default paste behavior but clean up afterward
    setTimeout(() => {
      this.cleanUpPastedContent();
      this.saveState();
      this.updateStats();
    }, 10);
  }

  /**
   * Handle drag and drop
   */
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  handleDrop(event) {
    event.preventDefault();
    
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    imageFiles.forEach(file => {
      this.insertImageFromFile(file);
    });
  }

  /**
   * Save current state to history
   */
  saveState() {
    const content = this.editorElement.innerHTML;
    if (content !== this.lastContent) {
      this.history.push(content);
      this.lastContent = content;
    }
  }

  /**
   * Undo last change
   */
  undo() {
    const previousState = this.history.undo();
    if (previousState) {
      this.editorElement.innerHTML = previousState;
      this.updateStats();
    }
  }

  /**
   * Redo last undone change
   */
  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      this.editorElement.innerHTML = nextState;
      this.updateStats();
    }
  }

  /**
   * Update word and character count
   */
  updateStats() {
    try {
      const text = this.editorElement.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const characters = text.length;

      if (this.statsElements.wordCount) {
        this.statsElements.wordCount.textContent = `Words: ${words}`;
      }
      if (this.statsElements.charCount) {
        this.statsElements.charCount.textContent = `Characters: ${characters}`;
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  /**
   * Update auto-save status
   */
  updateAutoSaveStatus(status) {
    if (this.statsElements.autoSaveStatus) {
      this.statsElements.autoSaveStatus.textContent = status;
    }
  }

  /**
   * Update toolbar button states
   */
  updateToolbarState() {
    try {
      const formatButtons = this.toolbarElement.querySelectorAll('.format-btn');
      
      formatButtons.forEach(button => {
        const command = button.dataset.command;
        const isActive = document.queryCommandState(command);
        button.classList.toggle('active', isActive);
      });

      // Update undo/redo button states
      const undoBtn = this.toolbarElement.querySelector('[data-command="undo"]');
      const redoBtn = this.toolbarElement.querySelector('[data-command="redo"]');
      
      if (undoBtn) undoBtn.disabled = !this.history.canUndo();
      if (redoBtn) redoBtn.disabled = !this.history.canRedo();
    } catch (error) {
      console.error('Failed to update toolbar state:', error);
    }
  }

  /**
   * Advanced features implementation
   */
  insertBlockquote() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const blockquote = document.createElement('blockquote');
      blockquote.style.borderLeft = '4px solid #ccc';
      blockquote.style.paddingLeft = '20px';
      blockquote.style.fontStyle = 'italic';
      blockquote.style.margin = '0';
      
      try {
        range.surroundContents(blockquote);
      } catch (error) {
        blockquote.appendChild(range.extractContents());
        range.insertNode(blockquote);
      }
      
      this.saveState();
    }
  }

  insertCodeBlock() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      
      pre.style.background = '#f4f4f4';
      pre.style.padding = '10px';
      pre.style.borderRadius = '4px';
      pre.style.fontFamily = 'monospace';
      pre.className = 'code-block';
      
      const content = range.toString() || 'Enter your code here...';
      code.textContent = content;
      pre.appendChild(code);
      
      range.deleteContents();
      range.insertNode(pre);
      
      this.saveState();
    }
  }

  insertImageDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.insertImageFromFile(file);
      }
    };
    input.click();
  }

  insertImageFromFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.commands.insertImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  insertTableDialog() {
    const rows = prompt('Number of rows:', '3');
    const cols = prompt('Number of columns:', '3');
    
    if (rows && cols) {
      this.tableManager.insertTable(parseInt(rows), parseInt(cols));
    }
  }

  /**
   * Document operations
   */
  newDocument() {
    if (confirm('Create new document? Unsaved changes will be lost.')) {
      this.editorElement.innerHTML = '<p>Start typing here...</p>';
      this.history = new CommandHistory(this.options.maxHistorySize);
      this.saveState();
      this.updateStats();
      this.autoSaveManager.clear();
    }
  }

  saveDocument() {
    const content = this.editorElement.innerHTML;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    a.click();
    URL.revokeObjectURL(url);
    
    this.updateAutoSaveStatus('Document saved');
  }

  loadAutoSavedContent() {
    const autoSaved = this.autoSaveManager.load();
    if (autoSaved && confirm('Auto-saved content found. Would you like to restore it?')) {
      this.editorElement.innerHTML = autoSaved;
      this.updateStats();
    }
  }

  /**
   * Export functionality
   */
  handleExport(format) {
    switch (format) {
      case 'html':
        this.exportManager.exportToHTML();
        break;
      case 'text':
        this.exportManager.exportToText();
        break;
      case 'markdown':
        this.exportManager.exportToMarkdown();
        break;
    }
  }

  /**
   * Find and Replace functionality
   */
  setupFindReplaceEvents() {
    const panel = this.container.querySelector('.find-replace-panel');
    const findInput = panel.querySelector('.find-input');
    const replaceInput = panel.querySelector('.replace-input');
    const caseSensitive = panel.querySelector('.case-sensitive');
    const regexMode = panel.querySelector('.regex-mode');
    
    panel.querySelector('.find-btn').addEventListener('click', () => {
      const matches = this.findReplace.find(
        findInput.value,
        regexMode.checked,
        caseSensitive.checked
      );
      this.updateFindStats(matches.length, 0);
    });

    panel.querySelector('.replace-btn').addEventListener('click', () => {
      const count = this.findReplace.replace(
        findInput.value,
        replaceInput.value,
        regexMode.checked,
        caseSensitive.checked,
        false
      );
      this.showMessage(`Replaced ${count} occurrence(s)`);
    });

    panel.querySelector('.replace-all-btn').addEventListener('click', () => {
      const count = this.findReplace.replace(
        findInput.value,
        replaceInput.value,
        regexMode.checked,
        caseSensitive.checked,
        true
      );
      this.showMessage(`Replaced ${count} occurrence(s)`);
    });

    panel.querySelector('.close-find-btn').addEventListener('click', () => {
      this.toggleFindReplace();
    });

    // Enter key handling
    findInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.findReplace.findNext();
      }
    });
  }

  toggleFindReplace() {
    const panel = this.container.querySelector('.find-replace-panel');
    const isVisible = panel.style.display !== 'none';
    
    panel.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      panel.querySelector('.find-input').focus();
    } else {
      this.findReplace.clearHighlights();
      this.editorElement.focus();
    }
  }

  updateFindStats(total, current) {
    const statsEl = this.container.querySelector('.find-stats');
    statsEl.textContent = total > 0 ? `${current + 1} of ${total}` : 'No matches found';
  }

  /**
   * Full screen functionality
   */
  toggleFullScreen() {
    this.isFullScreen = !this.isFullScreen;
    this.container.classList.toggle('fullscreen', this.isFullScreen);
    
    if (this.isFullScreen) {
      this.container.style.position = 'fixed';
      this.container.style.top = '0';
      this.container.style.left = '0';
      this.container.style.width = '100vw';
      this.container.style.height = '100vh';
      this.container.style.zIndex = '9999';
      this.container.style.background = 'white';
    } else {
      this.container.style.position = '';
      this.container.style.top = '';
      this.container.style.left = '';
      this.container.style.width = '';
      this.container.style.height = '';
      this.container.style.zIndex = '';
      this.container.style.background = '';
    }
    
    this.editorElement.focus();
  }

  /**
   * Utility methods
   */
  isEditorFocused() {
    return this.container.contains(document.activeElement);
  }

  isFindPanelOpen() {
    const panel = this.container.querySelector('.find-replace-panel');
    return panel && panel.style.display !== 'none';
  }

  isInCodeBlock(node) {
    while (node && node !== this.editorElement) {
      if (node.tagName === 'PRE' || node.tagName === 'CODE') {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  cleanUpPastedContent() {
    // Remove unwanted styles and attributes from pasted content
    const elements = this.editorElement.querySelectorAll('*');
    elements.forEach(el => {
      // Remove style attributes that might break layout
      const style = el.getAttribute('style');
      if (style) {
        // Keep only safe styles
        const safeStyles = [];
        const styles = style.split(';');
        styles.forEach(s => {
          const [prop, value] = s.split(':').map(x => x.trim());
          if (['color', 'background-color', 'font-weight', 'font-style', 'text-decoration'].includes(prop)) {
            safeStyles.push(`${prop}: ${value}`);
          }
        });
        
        if (safeStyles.length > 0) {
          el.setAttribute('style', safeStyles.join('; '));
        } else {
          el.removeAttribute('style');
        }
      }
      
      // Remove unwanted attributes
      const unwantedAttrs = ['class', 'id', 'data-*'];
      unwantedAttrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          el.removeAttribute(attr);
        }
      });
    });
  }

  handleBeforeUnload(event) {
    // Auto-save before leaving
    if (this.autoSaveManager) {
      this.autoSaveManager.save();
    }
  }

  showError(message) {
    console.error(message);
    // Could implement toast notifications here
  }

  showMessage(message) {
    console.log(message);
    // Could implement toast notifications here
  }

  /**
   * Destroy editor and clean up resources
   */
  destroy() {
    try {
      if (this.autoSaveManager) {
        this.autoSaveManager.stop();
      }
      
      // Remove event listeners
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      document.removeEventListener('keydown', this.handleGlobalKeyDown);
      
      // Clear timeouts
      if (this.inputTimeout) {
        clearTimeout(this.inputTimeout);
      }
      
      // Clear container
      this.container.innerHTML = '';
      
    } catch (error) {
      console.error('Error during editor cleanup:', error);
    }
  }
}

// CSS Styles
const editorStyles = `
  .rich-editor {
    border: 1px solid #ddd;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: white;
    overflow: hidden;
  }

  .editor-header {
    background: #f8f9fa;
    padding: 8px 16px;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #6c757d;
  }

  .editor-toolbar {
    background: #ffffff;
    padding: 8px;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .toolbar-group {
    display: flex;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: #dee2e6;
    margin: 0 4px;
  }

  .toolbar-btn {
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    min-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-btn:hover {
    background: #f8f9fa;
    border-color: #dee2e6;
  }

  .toolbar-btn:active,
  .toolbar-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }

  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar-select {
    padding: 4px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    font-size: 12px;
    min-width: 80px;
  }

  .color-picker {
    width: 32px;
    height: 24px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    cursor: pointer;
  }

  .editor-content {
    position: relative;
  }

  .editor-area {
    padding: 20px;
    min-height: 400px;
    outline: none;
    line-height: 1.6;
    font-size: 14px;
  }

  .editor-area:focus {
    box-shadow: inset 0 0 0 2px rgba(0, 123, 255, 0.25);
  }

  .editor-table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
  }

  .editor-table th,
  .editor-table td {
    border: 1px solid #ddd;
    padding: 8px;
    min-width: 50px;
  }

  .editor-table th {
    background-color: #f2f2f2;
    font-weight: bold;
  }

  .code-block {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    overflow-x: auto;
    margin: 10px 0;
  }

  blockquote {
    border-left: 4px solid #007bff;
    padding-left: 16px;
    margin: 10px 0;
    font-style: italic;
    color: #6c757d;
  }

  .find-replace-panel {
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    padding: 12px;
  }

  .find-replace-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .find-replace-controls input[type="text"] {
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
  }

  .find-replace-controls button {
    padding: 6px 12px;
    border: 1px solid #007bff;
    border-radius: 4px;
    background: #007bff;
    color: white;
    cursor: pointer;
    font-size: 12px;
  }

  .find-replace-controls button:hover {
    background: #0056b3;
  }

  .find-stats {
    margin-top: 8px;
    font-size: 12px;
    color: #6c757d;
  }

  .search-highlight {
    background: yellow;
    padding: 1px 2px;
  }

  .search-highlight.current {
    background: orange;
  }

  .fullscreen .editor-area {
    min-height: calc(100vh - 200px);
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .editor-toolbar {
      padding: 4px;
    }
    
    .toolbar-group {
      gap: 1px;
    }
    
    .toolbar-btn {
      min-width: 28px;
      height: 28px;
      font-size: 12px;
      padding: 4px 6px;
    }
    
    .toolbar-select {
      font-size: 11px;
      min-width: 60px;
    }
    
    .editor-area {
      padding: 12px;
      font-size: 16px; /* Better for mobile typing */
    }
    
    .find-replace-controls {
      flex-direction: column;
      align-items: stretch;
    }
    
    .find-replace-controls input[type="text"] {
      margin-bottom: 8px;
    }
  }

  /* Print styles */
  @media print {
    .editor-header,
    .editor-toolbar,
    .find-replace-panel {
      display: none;
    }
    
    .editor-content {
      box-shadow: none;
      border: none;
    }
    
    .editor-area {
      padding: 0;
      min-height: auto;
    }
  }
`;

// React Component Wrapper
export default function Editor({ documentId, userId, onUsersChange }) {
  const editorRef = useRef(null);
  const editorInstanceRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && !editorInstanceRef.current) {
      // Inject styles
      const styleSheet = document.createElement('style');
      styleSheet.textContent = editorStyles;
      document.head.appendChild(styleSheet);

      // Initialize editor
      editorInstanceRef.current = new RichTextEditor(editorRef.current, {
        autoSave: true,
        autoSaveInterval: 30000
      });
    }

    return () => {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={editorRef}
      className="w-full h-full"
      style={{ minHeight: '600px' }}
    />
  );
}