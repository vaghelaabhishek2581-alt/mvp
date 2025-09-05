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

const ELEMENTS_PER_PAGE = 15;
const PAGE_HEIGHT = 1122;
const WORKER_CHUNK_SIZE = 50; // Process pages in chunks of 50

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

export default function Editor({ documentId, userId, onUsersChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const paginationWorkersRef = useRef([]);
  const documentWorkerRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [currentElementType, setCurrentElementType] = useState('action');
  const [isInitialized, setIsInitialized] = useState(false);
  const [processingPages, setProcessingPages] = useState(false);
  const [workerPool, setWorkerPool] = useState([]);

  // Initialize worker pool
  useEffect(() => {
    const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8); // Max 8 workers
    const workers = [];
    
    console.log(`Initializing ${numWorkers} web workers for pagination`);
    
    for (let i = 0; i < numWorkers; i++) {
      try {
        const worker = createPaginationWorker();
        workers.push(worker);
      } catch (error) {
        console.warn('Failed to create worker:', error);
      }
    }
    
    // Create document processing worker
    try {
      documentWorkerRef.current = createDocumentWorker();
    } catch (error) {
      console.warn('Failed to create document worker:', error);
    }
    
    paginationWorkersRef.current = workers;
    setWorkerPool(workers);
    
    return () => {
      // Cleanup workers
      workers.forEach(worker => {
        try {
          worker.terminate();
        } catch (error) {
          console.warn('Error terminating worker:', error);
        }
      });
      
      if (documentWorkerRef.current) {
        try {
          documentWorkerRef.current.terminate();
        } catch (error) {
          console.warn('Error terminating document worker:', error);
        }
      }
    };
  }, []);

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

  // Multi-threaded pagination update
  const updatePages = useCallback(async (view) => {
    if (!view || !view.state || paginationWorkersRef.current.length === 0) {
      return fallbackUpdatePages(view);
    }
    
    setProcessingPages(true);
    
    try {
      const doc = view.state.doc;
      const allElements = [];
      
      // Extract all elements from document
      doc.descendants((node, pos) => {
        if (node.type.name === 'screenplay_element') {
          allElements.push({
            type: node.attrs.type,
            content: node.textContent,
            dual: node.attrs.dual,
            pos
          });
        }
      });

      if (allElements.length === 0) {
        setPages([]);
        setProcessingPages(false);
        return;
      }

      console.log(`Processing ${allElements.length} elements across ${paginationWorkersRef.current.length} workers`);

      // Split work across workers
      const chunkSize = Math.ceil(allElements.length / paginationWorkersRef.current.length);
      const workerPromises = [];
      
      for (let i = 0; i < paginationWorkersRef.current.length; i++) {
        const startIndex = i * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, allElements.length);
        const chunk = allElements.slice(startIndex, endIndex);
        
        if (chunk.length === 0) continue;
        
        const worker = paginationWorkersRef.current[i];
        
        const promise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Worker timeout'));
          }, 10000); // 10 second timeout
          
          worker.onmessage = (e) => {
            clearTimeout(timeout);
            if (e.data.success) {
              resolve(e.data.pages);
            } else {
              reject(new Error(e.data.error));
            }
          };
          
          worker.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
          
          worker.postMessage({
            elements: chunk,
            startIndex,
            chunkSize: chunk.length,
            pageHeight: PAGE_HEIGHT
          });
        });
        
        workerPromises.push(promise);
      }

      // Wait for all workers to complete
      const results = await Promise.allSettled(workerPromises);
      
      // Combine results from all workers
      const allPages = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allPages.push(...result.value);
        } else {
          console.error(`Worker ${index} failed:`, result.reason);
        }
      });

      // Sort pages by index and convert to the expected format
      allPages.sort((a, b) => a.pageIndex - b.pageIndex);
      
      const finalPages = allPages.map(page => 
        page.elements.map(element => ({
          node: {
            attrs: { type: element.type, dual: element.dual },
            textContent: element.content
          },
          pos: element.pos
        }))
      );

      setPages(finalPages);
      console.log(`Pagination completed: ${finalPages.length} pages processed by ${paginationWorkersRef.current.length} workers`);
      
    } catch (error) {
      console.error('Multi-threaded pagination failed, falling back to single-thread:', error);
      fallbackUpdatePages(view);
    } finally {
      setProcessingPages(false);
    }
  }, []);

  // Fallback single-threaded pagination
  const fallbackUpdatePages = useCallback((view) => {
    if (!view || !view.state) return;
    
    console.log('Using fallback single-threaded pagination');
    
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
    console.log(`Single-threaded pagination completed: ${newPages.length} pages`);
  }, []);

  // Multi-threaded document search
  const searchDocument = useCallback(async (query) => {
    if (!documentWorkerRef.current || !viewRef.current) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Search timeout'));
      }, 5000);

      documentWorkerRef.current.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.success && e.data.operation === 'searchElements') {
          resolve(e.data.results);
        } else {
          reject(new Error(e.data.error));
        }
      };

      const elements = getDocumentElements();
      documentWorkerRef.current.postMessage({
        operation: 'searchElements',
        docData: { elements },
        query
      });
    });
  }, []);

  useEffect(() => {
    if (!documentId || !userId || !editorRef.current) return;

    console.log('Initializing editor with multi-threading support:', { documentId, userId });

    try {
      // Initialize Yjs
      ydocRef.current = new Y.Doc();
      const yXmlFragment = ydocRef.current.getXmlFragment('prosemirror');

      // Initialize socket provider
      providerRef.current = new YSocketProvider(documentId, ydocRef.current);
      
      providerRef.current.onConnect = () => {
        console.log('Connected to document');
      };
      
      providerRef.current.onUserJoined = (socketId, userId, userInfo) => {
        console.log('User joined:', userId);
      };
      
      providerRef.current.onCurrentUsers = (users) => {
        onUsersChange?.(users);
      };

      // Join document
      providerRef.current.joinDocument(userId);

      // Create ProseMirror state
      const state = EditorState.create({
        schema: screenplaySchema,
        plugins: [
          YProsemirror.ySyncPlugin(yXmlFragment),
          YProsemirror.yUndoPlugin(),
          history(),
          screenplayKeymap
        ]
      });

      // Create editor view with throttled updates for performance
      let updateTimeout = null;
      
      viewRef.current = new EditorView(editorRef.current, {
        state,
        dispatchTransaction: (transaction) => {
          if (!viewRef.current || !viewRef.current.state) {
            console.warn('EditorView or state not ready for transaction');
            return;
          }
          
          try {
            const view = viewRef.current;
            const newState = view.state.apply(transaction);
            view.updateState(newState);
            
            // Throttle page updates for better performance with large documents
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              updatePages(view);
            }, 150); // 150ms debounce
            
            // Track current element type
            const { $head } = newState.selection;
            const currentNode = $head.node();
            if (currentNode && currentNode.attrs && currentNode.attrs.type) {
              setCurrentElementType(currentNode.attrs.type);
            }
          } catch (error) {
            console.error('Error applying transaction:', error);
          }
        }
      });

      updatePages(viewRef.current);
      setIsInitialized(true);

    } catch (error) {
      console.error('Error initializing editor:', error);
    }

    return () => {
      console.log('Cleaning up editor...');
      setIsInitialized(false);
      
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
        } catch (error) {
          console.error('Error destroying editor view:', error);
        }
        viewRef.current = null;
      }
      
      if (providerRef.current) {
        try {
          providerRef.current.destroy();
        } catch (error) {
          console.error('Error destroying provider:', error);
        }
        providerRef.current = null;
      }
      
      if (ydocRef.current) {
        try {
          ydocRef.current.destroy();
        } catch (error) {
          console.error('Error destroying Y.js doc:', error);
        }
        ydocRef.current = null;
      }
    };
  }, [documentId, userId, updatePages]);

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

  // Optimized PageComponent with memoization
  const PageComponent = useCallback(({ index, style }) => {
    if (!pages[index]) {
      return (
        <div style={style} className="page-loading">
          <div className="page">
            <div className="page-content">Loading page {index + 1}...</div>
          </div>
        </div>
      );
    }

    return (
      <div style={style} className="page-container">
        <div className="page">
          <div className="page-number">{index + 1}.</div>
          <div className="page-content">
            <div className="screenplay-elements">
              {pages[index]?.map((element, elementIndex) => (
                <div 
                  key={`${index}-${elementIndex}`}
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
    );
  }, [pages]);

  if (!documentId || !userId) {
    return <div className="editor-loading">Missing document ID or user ID</div>;
  }

  return (
    <div className="editor-container">
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
                disabled={!isInitialized || processingPages}
              >
                {key.replace('_', ' ')}
              </button>
            );
          })}
        </div>
        
        <div className="toolbar-info">
          {processingPages && (
            <span className="processing-indicator">
              Processing pages with {workerPool.length} workers...
            </span>
          )}
          <span className="page-count">
            {pages.length} pages • {workerPool.length} workers active
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="editor-wrapper">
        {!isInitialized ? (
          <div className="editor-loading">
            <div>Initializing editor...</div>
            <div>Setting up {workerPool.length} web workers for optimization</div>
          </div>
        ) : pages.length > 0 ? (
          <List
            height={800}
            itemCount={pages.length}
            itemSize={PAGE_HEIGHT + 40}
            width="100%"
            overscanCount={5} // Increased for better performance with 300+ pages
            useIsScrolling={true} // Optimize rendering during scroll
          >
            {PageComponent}
          </List>
        ) : (
          <div className="page-container">
            <div className="page">
              <div className="page-content" ref={editorRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}