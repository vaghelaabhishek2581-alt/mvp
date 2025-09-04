'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PresenceAvatars } from '@/components/ui/presence-avatars';
import { ImportExport } from '@/components/ui/import-export';
import Editor from '@/components/Editor';
import { Film, Users, Wifi, WifiOff } from 'lucide-react';

export default function Home() {
  const [documentId, setDocumentId] = useState('');
  const [userId, setUserId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const editorRef = useState(null);

  const handleJoin = () => {
    if (documentId.trim() && userId.trim()) {
      setIsJoined(true);
    } else {
      alert('Please enter both Document ID and User ID');
    }
  };

  const handleLeave = () => {
    setIsJoined(false);
    setUsers([]);
    setDocumentId('');
    setUserId('');
  };

  const handleImport = (elements) => {
    // Import functionality would be handled by the editor
    console.log('Importing elements:', elements);
  };

  const getElements = () => {
    // Get elements from editor
    return editorRef.current?.getDocumentElements() || [];
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Film className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Screenplay Editor
            </CardTitle>
            <p className="text-gray-600">
              Collaborative screenplay editing with real-time sync
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="documentId" className="text-sm font-medium text-gray-700">
                Document ID
              </label>
              <Input
                id="documentId"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Enter document ID"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium text-gray-700">
                User ID
              </label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your name"
                className="w-full"
              />
            </div>
            <Button 
              onClick={handleJoin} 
              className="w-full"
              disabled={!documentId.trim() || !userId.trim()}
            >
              Join Document
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
        <div className="flex items-center space-x-4">
          <Film className="w-6 h-6 text-blue-600" />
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="font-mono">
              {documentId}
            </Badge>
            <Badge variant="secondary">
              {userId}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Users */}
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">{users.length + 1}</span>
            <PresenceAvatars users={users} />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Import/Export */}
          <ImportExport onImport={handleImport} getElements={getElements} />

          <Button variant="outline" size="sm" onClick={handleLeave}>
            Leave
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          documentId={documentId}
          userId={userId}
          onUsersChange={setUsers}
          ref={editorRef}
        />
      </div>
    </div>
  );
}