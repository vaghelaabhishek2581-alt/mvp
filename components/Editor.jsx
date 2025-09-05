'use client';

import { useEffect, useRef, useState } from 'react';
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

const ELEMENTS_PER_PAGE = 15; // Approximate elements per page
const PAGE_HEIGHT = 1122; // A4 height in pixels at 96dpi

export default function Editor({ documentId, userId, onUsersChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [currentElementType, setCurrentElementType] = useState('action');

  useEffect(() => {
    if (!documentId || !userId) return;

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

    // Create editor view
    viewRef.current = new EditorView(editorRef.current, {
      state,
      dispatchTransaction: (transaction) => {
        const newState = viewRef.current.state.apply(transaction);
        viewRef.current.updateState(newState);
        
        // Update pages when content changes
        updatePages();
        
        // Track current element type
        const { $head } = newState.selection;
        const currentNode = $head.node();
        if (currentNode && currentNode.attrs && currentNode.attrs.type) {
          setCurrentElementType(currentNode.attrs.type);
        }
      }
    });

    const updatePages = () => {
      const doc = viewRef.current.state.doc;
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
    };

    updatePages();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, [documentId, userId]);

  const calculateElementHeight = (node) => {
    const baseHeight = 24; // Base line height
    const contentLength = node.textContent.length;
    const linesNeeded = Math.ceil(contentLength / 60); // Approx 60 chars per line
    
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
    
    return baseHeight * linesNeeded * multiplier + 12; // Add spacing
  };

  const executeCommand = (command) => {
    if (viewRef.current) {
      command(viewRef.current.state, viewRef.current.dispatch);
      viewRef.current.focus();
    }
  };

  const getDocumentElements = () => {
    if (!viewRef.current) return [];
    
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
  };

  const PageComponent = ({ index, style }) => (
    <div style={style} className="page-container">
      <div className="page">
        <div className="page-number">{index + 1}.</div>
        <div className="page-content">
          {/* Page content would be rendered here */}
          <div className="screenplay-elements">
            {pages[index]?.map((element, elementIndex) => (
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
  );

  return (
    <div className="editor-container">
      {/* Toolbar */}
      <div className="screenplay-toolbar">
        {Object.entries(screenplayElementTypes).map(([key, type]) => (
          <button
            key={type}
            className={`toolbar-button ${currentElementType === type ? 'active' : ''}`}
            onClick={() => executeCommand(screenplayCommands[`set${key.charAt(0) + key.slice(1).toLowerCase()}`])}
            title={`${key} (Alt+${key.charAt(0)})`}
          >
            {key.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="editor-wrapper">
        {pages.length > 0 ? (
          <List
            height={800}
            itemCount={pages.length}
            itemSize={PAGE_HEIGHT + 40} // Page height + margin
            width="100%"
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