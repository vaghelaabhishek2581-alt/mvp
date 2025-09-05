'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { FixedSizeList as List } from 'react-window';
import * as Y from 'yjs';
import * as YProsemirror from 'y-prosemirror';
import { screenplaySchema, screenplayElementTypes } from '@/lib/prosemirror/schema';
import { screenplayKeymap } from '@/lib/prosemirror/keymap';
import { screenplayCommands } from '@/lib/prosemirror/commands';
import { YSocketProvider } from '@/lib/ySocketProvider';
import React from 'react'
// Error Boundary Component
class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Editor Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="editor-error bg-red-50 border border-red-200 rounded p-4">
          <h3 className="text-red-800 font-semibold mb-2">Editor failed to initialize</h3>
          <pre className="text-sm text-red-600 mb-4">{this.state.error?.message}</pre>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// === IMPORT DEBUGGING ===
console.log('=== EDITOR.JSX IMPORT CHECK ===');
console.log('EditorState:', EditorState);
console.log('EditorView:', EditorView);
console.log('history:', history);
console.log('Y:', Y);
console.log('YProsemirror:', YProsemirror);
console.log('screenplaySchema:', screenplaySchema);
console.log('screenplayElementTypes:', screenplayElementTypes);
console.log('screenplayKeymap:', screenplayKeymap);
console.log('screenplayCommands:', screenplayCommands);
console.log('YSocketProvider:', YSocketProvider);
console.log('=== END IMPORT CHECK ===');

// Import Validation
const validateImports = () => {
  const required = {
    'EditorState': EditorState,
    'EditorView': EditorView,
    'Y': Y,
    'YProsemirror': YProsemirror,
    'screenplaySchema': screenplaySchema,
    'screenplayKeymap': screenplayKeymap,
    'screenplayCommands': screenplayCommands,
    'YSocketProvider': YSocketProvider
  };
  
  const missing = Object.entries(required)
    .filter(([name, module]) => !module)
    .map(([name]) => name);
    
  if (missing.length > 0) {
    throw new Error(`Missing imports: ${missing.join(', ')}`);
  }
  
  console.log('✅ All imports validated successfully');
};

// Debug Component
const EditorDebugger = ({ editorElement, isInitialized, debugLogs, initializationStatus }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999 }}>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
      >
        🐛 Debug ({debugLogs.length})
      </button>
      {expanded && (
        <div style={{ 
          background: 'white', 
          border: '1px solid #ccc', 
          padding: 10, 
          maxHeight: 300, 
          overflow: 'auto',
          width: 400
        }}>
          <div>DOM Ready: {!!editorElement ? '✅' : '❌'}</div>
          <div>Initialized: {isInitialized ? '✅' : '❌'}</div>
          <div>Status: {initializationStatus}</div>
          <div className="mt-2">Recent Logs:</div>
          <pre style={{ fontSize: 10, background: '#f5f5f5', padding: 5 }}>
            {debugLogs.slice(-10).join('\n')}
          </pre>
          <button
            onClick={() => console.log('Full debug logs:', debugLogs)}
            className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded"
          >
            Log All to Console
          </button>
        </div>
      )}
    </div>
  );
};
const PAGE_HEIGHT = 1122;

// Web Worker for pagination processing
const createPaginationWorker = () => {
  const workerCode = `
    self.onmessage = function(e) {
      const { elements, startIndex, chunkSize, pageHeight } = e.data;
      
      try {
        const processedPages = [];
        let currentPage = [];
        let currentPageHeight = 0;
        let pageIndex = Math.floor(startIndex / 15); // Approximate page from element index
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const elementHeight = calculateElementHeight(element);
          
          if (currentPageHeight + elementHeight > pageHeight && currentPage.length > 0) {
            processedPages.push({
              pageIndex: pageIndex++,
              elements: [...currentPage]
            });
            currentPage = [];
            currentPageHeight = 0;
          }
          
          currentPage.push(element);
          currentPageHeight += elementHeight;
        }
        
        if (currentPage.length > 0) {
          processedPages.push({
            pageIndex: pageIndex,
            elements: currentPage
          });
        }
        
        self.postMessage({
          success: true,
          pages: processedPages,
          startIndex,
          chunkSize
        });
        
      } catch (error) {
        self.postMessage({
          success: false,
          error: error.message,
          startIndex,
          chunkSize
        });
      }
    };
    
    function calculateElementHeight(element) {
      const baseHeight = 24;
      const contentLength = element.content ? element.content.length : 0;
      const linesNeeded = Math.ceil(contentLength / 60);
      
      let multiplier = 1;
      switch (element.type) {
        case 'scene_heading':
          multiplier = 1.5;
          break;
        case 'character':
          multiplier = 1.2;
          break;
        default:
          multiplier = 1;
      }
      
      return baseHeight * linesNeeded * multiplier + 12;
    }
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Web Worker for document processing
const createDocumentWorker = () => {
  const workerCode = `
    self.onmessage = function(e) {
      const { docData, operation } = e.data;
      
      try {
        switch (operation) {
          case 'extractElements':
            const elements = extractElementsFromDoc(docData);
            self.postMessage({
              success: true,
              operation: 'extractElements',
              elements
            });
            break;
            
          case 'searchElements':
            const { query } = e.data;
            const searchResults = searchInElements(docData.elements, query);
            self.postMessage({
              success: true,
              operation: 'searchElements',
              results: searchResults
            });
            break;
            
          default:
            self.postMessage({
              success: false,
              error: 'Unknown operation: ' + operation
            });
        }
      } catch (error) {
        self.postMessage({
          success: false,
          operation,
          error: error.message
        });
      }
    };
    
    function extractElementsFromDoc(docData) {
      const elements = [];
      // Process document and extract screenplay elements
      // This would be adapted based on your ProseMirror document structure
      return elements;
    }
    
    function searchInElements(elements, query) {
      return elements.filter(element => 
        element.content && element.content.toLowerCase().includes(query.toLowerCase())
      ).map((element, index) => ({
        ...element,
        elementIndex: index
      }));
    }
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Main Editor Component (wrapped in error boundary)
function EditorCore({ documentId, userId, onUsersChange }) {
  // Use callback ref instead of useRef for better DOM timing
  const [editorElement, setEditorElement] = useState(null);
  const editorRef = useCallback((node) => {
    console.log('Editor ref callback:', !!node);
    if (node !== null) {
      setEditorElement(node);
    }
  }, []);
  
  const viewRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [currentElementType, setCurrentElementType] = useState('action');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState('Starting...');
  const [debugLogs, setDebugLogs] = useState([]);

  // Debug logging function
  const addDebugLog = (message) => {
    console.log(`[Editor Debug] ${message}`);
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const calculateElementHeight = (node) => {
    const baseHeight = 24;
    const contentLength = node.textContent.length;
    const linesNeeded = Math.ceil(contentLength / 60);
    
    let multiplier = 1;
    switch (node.attrs.type) {
      case 'scene_heading':
        multiplier = 1.5;
        break;
      case 'character':
        multiplier = 1.2;
        break;
      default:
        multiplier = 1;
    }
    
    return baseHeight * linesNeeded * multiplier + 12;
  };

  // Simple pagination update (removing complex multi-threading for now)
  const updatePages = useCallback((view) => {
    if (!view || !view.state) return;
    
    addDebugLog('Updating pages');
    
    const doc = view.state.doc;
    const newPages = [];
    let currentPage = [];
    let currentPageHeight = 0;

    doc.descendants((node, pos) => {
      if (node.type.name === 'screenplay_element') {
        const elementHeight = calculateElementHeight(node);
        
        if (currentPageHeight + elementHeight > PAGE_HEIGHT && currentPage.length > 0) {
          newPages.push([...currentPage]);
          currentPage = [];
          currentPageHeight = 0;
        }
        
        currentPage.push({ node, pos });
        currentPageHeight += elementHeight;
      }
    });
    
    if (currentPage.length > 0) {
      newPages.push(currentPage);
    }

    setPages(newPages);
    addDebugLog(`Page update completed: ${newPages.length} pages`);
  }, []);

  // Alternative initialization strategy with polling

  useEffect(() => {
    let mounted = true;
    
    addDebugLog('=== INITIALIZATION START ===');
    addDebugLog(`Props check - documentId: ${!!documentId}, userId: ${!!userId}, editorElement: ${!!editorElement}`);
    
    if (!documentId || !userId) {
      addDebugLog('Missing required props - documentId or userId');
      setInitializationStatus('Error: Missing required props');
      return;
    }
    
    const initializeWhenReady = async () => {
      // Wait for DOM element
      addDebugLog('Waiting for DOM element...');
      while (!editorElement && mounted) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!mounted) {
        addDebugLog('Component unmounted during initialization');
        return;
      }
      
      addDebugLog('DOM element is ready, starting initialization');

      try {
        // Validate imports first
        addDebugLog('Validating imports...');
        validateImports();
        
        addDebugLog(`Starting editor initialization with documentId: ${documentId}, userId: ${userId}`);
        setInitializationStatus('Initializing ProseMirror and Y.js...');

        addDebugLog('Step 1: Creating Y.js document...');
        ydocRef.current = new Y.Doc();
        addDebugLog('Y.js document created successfully');
        
        addDebugLog('Step 2: Getting XML fragment...');
        const yXmlFragment = ydocRef.current.getXmlFragment('prosemirror');
        addDebugLog('XML fragment obtained successfully');

        addDebugLog('Step 3: Creating socket provider...');
        providerRef.current = new YSocketProvider(documentId, ydocRef.current);
        addDebugLog('Socket provider created successfully');
        
        providerRef.current.onConnect = () => {
          addDebugLog('Socket connected to document');
        };
        
        providerRef.current.onUserJoined = (socketId, userId, userInfo) => {
          addDebugLog(`User joined: ${userId} (socket: ${socketId})`);
        };
        
        providerRef.current.onCurrentUsers = (users) => {
          addDebugLog(`Current users updated: ${users.length} users`);
          onUsersChange?.(users);
        };

        addDebugLog('Step 4: Joining document...');
        providerRef.current.joinDocument(userId);
        addDebugLog('Document join request sent');

        addDebugLog('Step 5: Creating ProseMirror plugins...');
        const plugins = [
          YProsemirror.ySyncPlugin(yXmlFragment),
          YProsemirror.yUndoPlugin(),
          history(),
          screenplayKeymap
        ];
        
        addDebugLog(`Created ${plugins.length} plugins successfully`);

        addDebugLog('Step 6: Creating ProseMirror state...');
        const state = EditorState.create({
          schema: screenplaySchema,
          plugins: plugins
        });
        addDebugLog('ProseMirror state created successfully');

        addDebugLog('Step 7: Creating ProseMirror editor view...');
        let updateTimeout = null;
        
        viewRef.current = new EditorView(editorElement, {
          state,
          dispatchTransaction: (transaction) => {
            if (!viewRef.current || !viewRef.current.state) {
              addDebugLog('Transaction dispatch warning: EditorView or state not ready');
              return;
            }
            
            try {
              addDebugLog('Processing transaction...');
              const view = viewRef.current;
              const newState = view.state.apply(transaction);
              view.updateState(newState);
              
              // Throttle page updates
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => {
                updatePages(view);
                addDebugLog('Page update completed');
              }, 150);
              
              // Track current element type
              const { $head } = newState.selection;
              const currentNode = $head.node();
              if (currentNode && currentNode.attrs && currentNode.attrs.type) {
                setCurrentElementType(currentNode.attrs.type);
              }
            } catch (error) {
              addDebugLog(`Error applying transaction: ${error.message}`);
              console.error('Transaction error:', error);
            }
          }
        });
        addDebugLog('ProseMirror editor view created successfully');

        addDebugLog('Step 8: Performing initial page update...');
        updatePages(viewRef.current);
        addDebugLog('Initial page update completed');
        
        if (mounted) {
          addDebugLog('=== INITIALIZATION COMPLETED SUCCESSFULLY ===');
          setIsInitialized(true);
          setInitializationStatus('Ready');
        }

      } catch (error) {
        addDebugLog(`=== CRITICAL ERROR DURING INITIALIZATION ===`);
        addDebugLog(`Error message: ${error.message}`);
        addDebugLog(`Error stack: ${error.stack}`);
        console.error('Editor initialization error:', error);
        if (mounted) {
          setInitializationStatus(`Error: ${error.message}`);
          setIsInitialized(true); // Show error state
        }
      }
    };
    
    initializeWhenReady();
    
    return () => {
      mounted = false;
      addDebugLog('Starting editor cleanup');
      setIsInitialized(false);
      setInitializationStatus('Cleaning up...');
      
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
          addDebugLog('ProseMirror view destroyed');
        } catch (error) {
          addDebugLog(`Error destroying editor view: ${error.message}`);
        }
        viewRef.current = null;
      }
      
      if (providerRef.current) {
        try {
          providerRef.current.destroy();
          addDebugLog('Socket provider destroyed');
        } catch (error) {
          addDebugLog(`Error destroying provider: ${error.message}`);
        }
        providerRef.current = null;
      }
      
      if (ydocRef.current) {
        try {
          ydocRef.current.destroy();
          addDebugLog('Y.js document destroyed');
        } catch (error) {
          addDebugLog(`Error destroying Y.js doc: ${error.message}`);
        }
        ydocRef.current = null;
      }
      
      addDebugLog('Editor cleanup completed');
    };
  }, [documentId, userId, editorElement, updatePages]);

  // Fixed executeCommand function
  const executeCommand = useCallback((commandName) => {
    if (!viewRef.current || !isInitialized) {
      console.warn('Editor not ready for commands');
      return false;
    }

    try {
      const commandFunction = screenplayCommands[commandName];
      
      if (!commandFunction) {
        console.error('Command not found:', commandName);
        return false;
      }

      const command = commandFunction();
      
      if (typeof command === 'function') {
        const result = command(viewRef.current.state, viewRef.current.dispatch);
        viewRef.current.focus();
        return result;
      } else {
        console.error('Command did not return a function:', commandName);
        return false;
      }
    } catch (error) {
      console.error('Error executing command:', commandName, error);
      return false;
    }
  }, [isInitialized]);

  const getDocumentElements = useCallback(() => {
    if (!viewRef.current || !isInitialized) return [];
    
    const elements = [];
    const doc = viewRef.current.state.doc;
    
    doc.descendants((node) => {
      if (node.type.name === 'screenplay_element') {
        elements.push({
          type: node.attrs.type,
          content: node.textContent,
          dual: node.attrs.dual
        });
      }
    });
    
    return elements;
  }, [isInitialized]);

  if (!documentId || !userId) {
    return <div className="editor-loading">Missing document ID or user ID</div>;
  }

  return (
    <div className="editor-container">
      {/* Debug Component */}
      <EditorDebugger 
        editorElement={editorElement}
        isInitialized={isInitialized} 
        debugLogs={debugLogs}
        initializationStatus={initializationStatus}
      />
      
      {/* Toolbar */}
      <div className="screenplay-toolbar">
        <div className="toolbar-section">
          {Object.entries(screenplayElementTypes).map(([key, type]) => {
            const commandName = `set${key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()}`;
            return (
              <button
                key={type}
                className={`toolbar-button ${currentElementType === type ? 'active' : ''}`}
                onClick={() => executeCommand(commandName)}
                title={`${key} (Alt+${key.charAt(0)})`}
                disabled={!isInitialized}
              >
                {key.replace('_', ' ')}
              </button>
            );
          })}
        </div>
        
        <div className="toolbar-info">
          <span className="page-count">
            {pages.length} pages
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="editor-wrapper">
        {!isInitialized ? (
          <div className="editor-loading">
            <div className="text-lg font-semibold mb-4">
              {initializationStatus.startsWith('Error:') ? '❌ Editor Error' : '⏳ Initializing editor...'}
            </div>
            <div className="text-sm text-gray-600 mb-4">{initializationStatus}</div>
            
            {initializationStatus.startsWith('Error:') && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                <h4 className="font-semibold text-red-800 mb-2">Troubleshooting Steps:</h4>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  <li>Check browser console for import errors</li>
                  <li>Verify all ProseMirror packages are installed</li>
                  <li>Ensure schema, keymap, and commands files exist</li>
                  <li>Check if DOM element is ready</li>
                </ul>
              </div>
            )}
          </div>
        ) : pages.length > 0 ? (
          <div className="pages-container" style={{ height: '800px', overflow: 'auto' }}>
            {pages.map((page, index) => (
              <div key={index} className="page-container">
                <div className="page">
                  <div className="page-number">{index + 1}.</div>
                  <div className="page-content">
                    <div className="screenplay-elements">
                      {page?.map((element, elementIndex) => (
                        <div 
                          key={elementIndex}
                          className={`screenplay-element element-${element.node.attrs.type}`}
                          data-type={element.node.attrs.type}
                        >
                          {element.node.textContent}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="page-container">
            <div className="page">
              <div 
                className="page-content" 
                ref={editorRef}
                data-editor="prosemirror"
                data-ready={!!editorElement}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export with Error Boundary
export default function Editor(props) {
  return (
    <EditorErrorBoundary>
      <EditorCore {...props} />
    </EditorErrorBoundary>
  );
}